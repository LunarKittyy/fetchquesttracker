/**
 * Invite Functions for Collaborative Spaces
 * All invite/join logic is handled server-side for security.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Lazy getter for Firestore (admin is initialized in index.js)
function getDb() {
    return admin.firestore();
}

/**
 * Generate a random invite code (8 alphanumeric chars)
 */
function generateInviteCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Create an invite link for a space.
 * Only the space owner can call this.
 */
exports.createInvite = functions
    .region("us-east1")
    .https.onCall(async (data, context) => {
        // 1. Auth check
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
        }

        const { spaceId, role = "viewer", expiresInDays = 7 } = data;
        const userId = context.auth.uid;

        // 2. Validate role
        const validRoles = ["viewer", "editor"];
        if (!validRoles.includes(role)) {
            throw new functions.https.HttpsError("invalid-argument", "Invalid role");
        }

        // 3. Verify user owns this space
        const spaceRef = getDb().doc(`users/${userId}/spaces/${spaceId}`);
        const spaceSnap = await spaceRef.get();

        if (!spaceSnap.exists) {
            throw new functions.https.HttpsError("not-found", "Space not found");
        }

        // 4. Generate unique invite code
        let inviteCode = generateInviteCode();
        let inviteRef = getDb().doc(`invites/${inviteCode}`);
        let attempts = 0;

        // Ensure uniqueness (very unlikely to collide, but be safe)
        while ((await inviteRef.get()).exists && attempts < 5) {
            inviteCode = generateInviteCode();
            inviteRef = getDb().doc(`invites/${inviteCode}`);
            attempts++;
        }

        const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

        // 5. Create invite document
        await inviteRef.set({
            ownerId: userId,
            spaceId: spaceId,
            spaceName: spaceSnap.data().name || "Unnamed Space",
            role: role,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: expiresAt,
            usedBy: null,
        });

        return {
            inviteCode: inviteCode,
            expiresAt: expiresAt.toISOString(),
        };
    });

/**
 * Accept an invite and join a shared space.
 */
exports.acceptInvite = functions
    .region("us-east1")
    .https.onCall(async (data, context) => {
        // 1. Auth check
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
        }

        const { inviteCode } = data;
        const userId = context.auth.uid;
        const userDisplayName = context.auth.token.name || context.auth.token.email || "Unknown";

        if (!inviteCode || typeof inviteCode !== "string") {
            throw new functions.https.HttpsError("invalid-argument", "Invalid invite code");
        }

        // 2. Get invite
        const inviteRef = getDb().doc(`invites/${inviteCode}`);
        const inviteSnap = await inviteRef.get();

        if (!inviteSnap.exists) {
            throw new functions.https.HttpsError("not-found", "Invite not found or expired");
        }

        const invite = inviteSnap.data();

        // 3. Check expiry
        if (invite.expiresAt.toDate() < new Date()) {
            throw new functions.https.HttpsError("failed-precondition", "Invite has expired");
        }

        // 4. Check not already used
        if (invite.usedBy) {
            // If used by THIS user, return success (idempotent)
            if (invite.usedBy === userId) {
                return {
                    success: true,
                    spaceName: invite.spaceName,
                    role: invite.role,
                    alreadyJoined: true,
                };
            }
            throw new functions.https.HttpsError("already-exists", "This invite was already used by someone else");
        }

        // 5. Can't join your own space
        if (invite.ownerId === userId) {
            throw new functions.https.HttpsError("invalid-argument", "Cannot join your own space");
        }

        // 6. Check if already a collaborator
        const spaceRef = getDb().doc(`users/${invite.ownerId}/spaces/${invite.spaceId}`);
        const spaceSnap = await spaceRef.get();

        if (!spaceSnap.exists) {
            throw new functions.https.HttpsError("not-found", "Space no longer exists");
        }

        const spaceData = spaceSnap.data();
        if (spaceData.collaborators && spaceData.collaborators[userId]) {
            throw new functions.https.HttpsError("already-exists", "Already a collaborator");
        }

        // 7. Perform all updates in a batch
        const batch = getDb().batch();

        // Add user to space's collaborators
        batch.update(spaceRef, {
            isShared: true,
            [`collaborators.${userId}`]: {
                role: invite.role,
                displayName: userDisplayName,
                addedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
        });

        // Add to user's sharedWithMe array
        const userRef = getDb().doc(`users/${userId}`);
        batch.set(userRef, {
            sharedWithMe: admin.firestore.FieldValue.arrayUnion({
                ownerId: invite.ownerId,
                spaceId: invite.spaceId,
                spaceName: invite.spaceName,
                role: invite.role,
            }),
        }, { merge: true });

        // Mark invite as used
        batch.update(inviteRef, { usedBy: userId });

        await batch.commit();

        return {
            success: true,
            spaceName: invite.spaceName,
            role: invite.role,
        };
    });

/**
 * Revoke a collaborator's access to a space.
 * Only the space owner can call this.
 */
exports.revokeAccess = functions
    .region("us-east1")
    .https.onCall(async (data, context) => {
        // 1. Auth check
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
        }

        const { spaceId, targetUserId } = data;
        const ownerId = context.auth.uid;

        if (!spaceId || !targetUserId) {
            throw new functions.https.HttpsError("invalid-argument", "Missing spaceId or targetUserId");
        }

        // 2. Verify caller owns this space
        const spaceRef = getDb().doc(`users/${ownerId}/spaces/${spaceId}`);
        const spaceSnap = await spaceRef.get();

        if (!spaceSnap.exists) {
            throw new functions.https.HttpsError("not-found", "Space not found");
        }

        const spaceData = spaceSnap.data();

        // 3. Verify target is actually a collaborator
        if (!spaceData.collaborators || !spaceData.collaborators[targetUserId]) {
            throw new functions.https.HttpsError("not-found", "User is not a collaborator");
        }

        // 4. Perform updates in batch
        const batch = getDb().batch();

        // Remove from collaborators
        batch.update(spaceRef, {
            [`collaborators.${targetUserId}`]: admin.firestore.FieldValue.delete(),
        });

        // Remove from target user's sharedWithMe
        const targetUserRef = getDb().doc(`users/${targetUserId}`);
        batch.set(targetUserRef, {
            sharedWithMe: admin.firestore.FieldValue.arrayRemove({
                ownerId: ownerId,
                spaceId: spaceId,
                spaceName: spaceData.name,
                role: spaceData.collaborators[targetUserId].role,
            }),
        }, { merge: true });

        // Check if any collaborators remain
        const remainingCollabs = Object.keys(spaceData.collaborators).filter(id => id !== targetUserId);
        if (remainingCollabs.length === 0) {
            batch.update(spaceRef, { isShared: false });
        }

        await batch.commit();

        return { success: true };
    });

/**
 * Leave a shared space (user removes themselves).
 */
exports.leaveSpace = functions
    .region("us-east1")
    .https.onCall(async (data, context) => {
        // 1. Auth check
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
        }

        const { ownerId, spaceId } = data;
        const userId = context.auth.uid;

        if (!ownerId || !spaceId) {
            throw new functions.https.HttpsError("invalid-argument", "Missing ownerId or spaceId");
        }

        // Can't leave your own space
        if (ownerId === userId) {
            throw new functions.https.HttpsError("invalid-argument", "Cannot leave your own space");
        }

        // 2. Verify space exists and user is a collaborator
        const spaceRef = getDb().doc(`users/${ownerId}/spaces/${spaceId}`);
        const spaceSnap = await spaceRef.get();

        if (!spaceSnap.exists) {
            throw new functions.https.HttpsError("not-found", "Space not found");
        }

        const spaceData = spaceSnap.data();

        if (!spaceData.collaborators || !spaceData.collaborators[userId]) {
            throw new functions.https.HttpsError("not-found", "Not a collaborator");
        }

        // 3. Perform updates in batch
        const batch = getDb().batch();

        // Remove from collaborators
        batch.update(spaceRef, {
            [`collaborators.${userId}`]: admin.firestore.FieldValue.delete(),
        });

        // Remove from user's sharedWithMe
        const userRef = getDb().doc(`users/${userId}`);
        batch.set(userRef, {
            sharedWithMe: admin.firestore.FieldValue.arrayRemove({
                ownerId: ownerId,
                spaceId: spaceId,
                spaceName: spaceData.name,
                role: spaceData.collaborators[userId].role,
            }),
        }, { merge: true });

        // Check if any collaborators remain
        const remainingCollabs = Object.keys(spaceData.collaborators).filter(id => id !== userId);
        if (remainingCollabs.length === 0) {
            batch.update(spaceRef, { isShared: false });
        }

        await batch.commit();

        return { success: true };
    });
