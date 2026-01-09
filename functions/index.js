const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

// Export invite functions
const invites = require("./invites.js");
exports.createInvite = invites.createInvite;
exports.acceptInvite = invites.acceptInvite;
exports.revokeAccess = invites.revokeAccess;
exports.leaveSpace = invites.leaveSpace;
exports.listInvites = invites.listInvites;
exports.revokeInvite = invites.revokeInvite;
exports.onSpaceDelete = invites.onSpaceDelete;

/**
 * Triggered when a file is uploaded to Firebase Storage.
 * Updates the user's storage usage in Firestore.
 */
exports.onFileUpload = functions
  .region("us-east1")
  .storage.object()
  .onFinalize(async (object) => {
    const filePath = object.name;

    // Only track files in users/ directory
    if (!filePath || !filePath.startsWith("users/")) {
      return null;
    }

    const userId = filePath.split("/")[1];
    const fileSize = parseInt(object.size, 10);

    if (!userId || isNaN(fileSize)) {
      console.error("Invalid userId or fileSize", { filePath, fileSize });
      return null;
    }

    const storageRef = db.doc(`userStorage/${userId}`);

    try {
      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(storageRef);
        const currentBytes = doc.exists ? (doc.data().bytesUsed || 0) : 0;

        transaction.set(storageRef, {
          bytesUsed: currentBytes + fileSize,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });

      console.log(`User ${userId}: Added ${fileSize} bytes (file: ${filePath})`);
    } catch (error) {
      console.error(`Error updating storage for user ${userId}:`, error);
    }

    return null;
  });

/**
 * Triggered when a file is deleted from Firebase Storage.
 * Updates the user's storage usage in Firestore.
 */
exports.onFileDelete = functions
  .region("us-east1")
  .storage.object()
  .onDelete(async (object) => {
    const filePath = object.name;

    // Only track files in users/ directory
    if (!filePath || !filePath.startsWith("users/")) {
      return null;
    }

    const userId = filePath.split("/")[1];
    const fileSize = parseInt(object.size, 10);

    if (!userId || isNaN(fileSize)) {
      console.error("Invalid userId or fileSize", { filePath, fileSize });
      return null;
    }

    const storageRef = db.doc(`userStorage/${userId}`);

    try {
      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(storageRef);
        const currentBytes = doc.exists ? (doc.data().bytesUsed || 0) : 0;

        // Ensure we don't go below 0
        transaction.set(storageRef, {
          bytesUsed: Math.max(0, currentBytes - fileSize),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });

      console.log(`User ${userId}: Removed ${fileSize} bytes (file: ${filePath})`);
    } catch (error) {
      console.error(`Error updating storage for user ${userId}:`, error);
    }

    return null;
  });
