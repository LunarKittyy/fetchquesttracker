# Collaborative Spaces Implementation Plan

> **Status**: Future Feature — Comprehensive design document  
> **Estimated Effort**: Large (4-6 weeks)  
> **Priority**: When you're ready for the next major milestone

---

## Overview

Enable users to share spaces with friends for collaborative quest tracking. Perfect for squad play in ARC Raiders where team members can see each other's progress, contribute items, and coordinate loot runs.

### Design Goals

1. **Reuse existing infrastructure** — Build on current Firebase Auth, Firestore, Storage, and Cloud Functions
2. **Maintain simplicity** — Keep the clean, focused UI that already works well
3. **Progressive complexity** — Start with core sharing, layer on advanced collaboration later
4. **Storage fairness** — All storage (images) counts toward the owner's quota

---

## Data Model

### Current Structure (Owner-Only)

```
users/{userId}
  ├── email, displayName, settings, activeSpaceId
  └── spaces/{spaceId}
        ├── name, color, categories, lastModified
        ├── items[]
        └── archivedItems[]

userStorage/{userId}
  └── bytesUsed, lastUpdated
```

### New Structure (Collaborative)

```
users/{userId}
  ├── email, displayName, settings, activeSpaceId
  ├── sharedWithMe[]  ← Array of {ownerId, spaceId, role} for quick sidebar lookup
  └── spaces/{spaceId}
        ├── name, color, categories, lastModified
        ├── items[]
        ├── archivedItems[]
        ├── isShared: boolean
        ├── collaborators: {   ← Map of userId -> role/permissions
        │     "uid123": {
        │       role: "editor" | "helper" | "viewer",
        │       displayName: "FriendName",
        │       addedAt: timestamp
        │     }
        │   }
        └── pendingInvites: {  ← Map of inviteCode -> invite details
              "abc123": {
                role: "editor",
                createdAt: timestamp,
                expiresAt: timestamp
              }
            }

invites/{inviteCode}         ← Top-level for quick code lookup
  ├── ownerId: string
  ├── spaceId: string
  ├── spaceName: string
  ├── role: "editor" | "helper" | "viewer"
  ├── createdAt: timestamp
  ├── expiresAt: timestamp  (7 days default)
  └── usedBy: string | null
```

### Role Definitions

| Role       | Can View | Can Edit Items | Can Propose    | Can Manage Collaborators |
| ---------- | -------- | -------------- | -------------- | ------------------------ |
| **Viewer** | ✅       | ❌             | ❌             | ❌                       |
| **Helper** | ✅       | ❌             | ✅ (proposals) | ❌                       |
| **Editor** | ✅       | ✅             | ✅             | ❌                       |
| **Owner**  | ✅       | ✅             | ✅             | ✅                       |

---

## Implementation Phases

### Phase 1: Invite System & Read-Only Sharing

**Goal**: Let users share a space link that others can view (read-only).

#### 1.1 Backend: Invite Code Generation (Cloud Function)

**New file**: `functions/invites.js`

```javascript
// HTTP Callable Function: createInvite
exports.createInvite = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated");

  const { spaceId, role = "viewer", expiresInDays = 7 } = data;
  const userId = context.auth.uid;

  // Verify user owns this space
  const spaceRef = db.doc(`users/${userId}/spaces/${spaceId}`);
  const space = await spaceRef.get();
  if (!space.exists)
    throw new functions.https.HttpsError("not-found", "Space not found");

  // Generate unique invite code (8 chars, alphanumeric)
  const inviteCode = generateInviteCode();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  // Create invite document
  await db.doc(`invites/${inviteCode}`).set({
    ownerId: userId,
    spaceId,
    spaceName: space.data().name,
    role,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt,
    usedBy: null,
  });

  // Also store in space's pendingInvites for owner visibility
  await spaceRef.update({
    [`pendingInvites.${inviteCode}`]: {
      role,
      createdAt: new Date(),
      expiresAt,
    },
  });

  return { inviteCode, expiresAt: expiresAt.toISOString() };
});
```

#### 1.2 Backend: Accept Invite (Cloud Function)

```javascript
// HTTP Callable Function: acceptInvite
exports.acceptInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated");

  const { inviteCode } = data;
  const userId = context.auth.uid;
  const userDisplayName = context.auth.token.name || context.auth.token.email;

  // Get invite
  const inviteRef = db.doc(`invites/${inviteCode}`);
  const invite = await inviteRef.get();

  if (!invite.exists)
    throw new functions.https.HttpsError("not-found", "Invite not found");

  const inviteData = invite.data();

  // Check expiry
  if (inviteData.expiresAt.toDate() < new Date()) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Invite expired"
    );
  }

  // Check not already used
  if (inviteData.usedBy) {
    throw new functions.https.HttpsError(
      "already-exists",
      "Invite already used"
    );
  }

  // Can't join your own space
  if (inviteData.ownerId === userId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Cannot join your own space"
    );
  }

  const batch = db.batch();

  // 1. Add user to space's collaborators
  const spaceRef = db.doc(
    `users/${inviteData.ownerId}/spaces/${inviteData.spaceId}`
  );
  batch.update(spaceRef, {
    isShared: true,
    [`collaborators.${userId}`]: {
      role: inviteData.role,
      displayName: userDisplayName,
      addedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  });

  // 2. Add to user's sharedWithMe array
  const userRef = db.doc(`users/${userId}`);
  batch.update(userRef, {
    sharedWithMe: admin.firestore.FieldValue.arrayUnion({
      ownerId: inviteData.ownerId,
      spaceId: inviteData.spaceId,
      spaceName: inviteData.spaceName,
      role: inviteData.role,
    }),
  });

  // 3. Mark invite as used
  batch.update(inviteRef, { usedBy: userId });

  // 4. Remove from pendingInvites
  batch.update(spaceRef, {
    [`pendingInvites.${inviteCode}`]: admin.firestore.FieldValue.delete(),
  });

  await batch.commit();

  return {
    success: true,
    spaceName: inviteData.spaceName,
    role: inviteData.role,
  };
});
```

#### 1.3 Firestore Rules Updates

**Modify**: `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function: Check if user is collaborator on a space
    function isCollaborator(ownerId, spaceId) {
      let space = get(/databases/$(database)/documents/users/$(ownerId)/spaces/$(spaceId));
      return space != null &&
             space.data.collaborators != null &&
             request.auth.uid in space.data.collaborators;
    }

    function getRole(ownerId, spaceId) {
      let space = get(/databases/$(database)/documents/users/$(ownerId)/spaces/$(spaceId));
      return space.data.collaborators[request.auth.uid].role;
    }

    // Users collection
    match /users/{userId} {
      // Owner can read/write their own doc
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // Spaces subcollection
      match /spaces/{spaceId} {
        // Owner has full access
        allow read, write: if request.auth != null && request.auth.uid == userId;

        // Collaborators can read
        allow read: if request.auth != null && isCollaborator(userId, spaceId);

        // Editors can write items (but not space settings)
        allow update: if request.auth != null &&
                        isCollaborator(userId, spaceId) &&
                        getRole(userId, spaceId) == 'editor' &&
                        // Only allow updating items/archivedItems, not name/color/collaborators
                        request.resource.data.diff(resource.data).affectedKeys()
                          .hasOnly(['items', 'archivedItems', 'lastModified']);
      }
    }

    // Invites collection - publicly readable by code (for preview),
    // but only Cloud Functions can create/modify
    match /invites/{inviteCode} {
      allow read: if request.auth != null;
      allow write: if false;  // Cloud Functions only
    }

    // userStorage - unchanged
    match /userStorage/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false;
    }
  }
}
```

#### 1.4 Frontend: Sharing UI

**New file**: `js/sharing.js`

```javascript
/**
 * Sharing Module
 * Handles invite generation, acceptance, and shared spaces UI
 */

import { db } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";
import { httpsCallable, getFunctions } from "firebase/functions";
import { showPopup, showConfirm, showAlert } from "./popup.js";

const functions = getFunctions();

/**
 * Generate share link for a space
 */
export async function createShareLink(spaceId, role = "viewer") {
  try {
    const createInvite = httpsCallable(functions, "createInvite");
    const result = await createInvite({ spaceId, role });

    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?invite=${result.data.inviteCode}`;

    return { success: true, url: shareUrl, expiresAt: result.data.expiresAt };
  } catch (error) {
    console.error("Failed to create share link:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Accept an invite from URL parameter
 */
export async function acceptInviteFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const inviteCode = params.get("invite");

  if (!inviteCode) return null;

  // Clear the URL param
  window.history.replaceState({}, "", window.location.pathname);

  try {
    const accept = httpsCallable(functions, "acceptInvite");
    const result = await accept({ inviteCode });

    showAlert(
      `Joined Space!`,
      `You now have ${result.data.role} access to "${result.data.spaceName}".`
    );

    return result.data;
  } catch (error) {
    if (error.code === "not-found") {
      showAlert(
        "Invalid Invite",
        "This invite link is invalid or has expired."
      );
    } else if (error.code === "already-exists") {
      showAlert("Already Used", "This invite has already been used.");
    } else {
      showAlert("Error", error.message);
    }
    return null;
  }
}

/**
 * Render share modal for a space
 */
export function openShareModal(spaceId, spaceName) {
  // Implementation: Show modal with:
  // - Role selector (Viewer/Helper/Editor)
  // - Generate link button
  // - Copy to clipboard
  // - List of current collaborators
  // - Remove collaborator buttons
}
```

#### 1.5 Frontend: Shared Spaces in Sidebar

**Modify**: `js/spaces.js`

Add a "Shared With Me" section below user's own spaces:

```javascript
// In renderSpaces()
function renderSpaces() {
  // ... existing own spaces rendering ...

  // Render shared spaces section
  renderSharedSpaces();
}

function renderSharedSpaces() {
  const user = getCurrentUser();
  if (!user || !user.sharedWithMe?.length) return;

  const container = $("#shared-spaces-list");
  container.innerHTML = `
    <div class="sidebar-section-header">Shared With Me</div>
    ${user.sharedWithMe
      .map(
        (shared) => `
      <div class="space-tab shared" 
           data-owner="${shared.ownerId}" 
           data-space="${shared.spaceId}">
        <span class="space-name">${escapeHtml(shared.spaceName)}</span>
        <span class="space-role">${shared.role}</span>
      </div>
    `
      )
      .join("")}
  `;
}
```

---

### Phase 2: Real-Time Collaboration

**Goal**: Collaborators see live updates as changes happen.

#### 2.1 Extend Real-Time Listeners

**Modify**: `js/auth-ui.js` (or new `js/realtime-collab.js`)

```javascript
// Subscribe to shared spaces in addition to own spaces
function subscribeToSharedSpaces() {
  const user = getCurrentUser();
  if (!user?.sharedWithMe?.length) return;

  user.sharedWithMe.forEach((shared) => {
    const spaceRef = doc(db, "users", shared.ownerId, "spaces", shared.spaceId);

    onSnapshot(spaceRef, (snapshot) => {
      if (!snapshot.exists()) {
        // Space was deleted or access revoked
        handleSharedSpaceRemoved(shared);
        return;
      }

      // Update local cache of shared space
      updateSharedSpaceCache(shared.ownerId, shared.spaceId, snapshot.data());

      // Re-render if this space is currently active
      if (isViewingSharedSpace(shared.ownerId, shared.spaceId)) {
        renderSharedSpace();
      }
    });
  });
}
```

#### 2.2 Presence Indicators (Optional Enhancement)

Show who else is currently viewing the shared space:

```javascript
// Firestore presence using RTDB (more efficient for presence)
// Or simple polling-based presence in Firestore

// When viewing shared space:
await updateDoc(spaceRef, {
  [`presence.${userId}`]: {
    displayName: user.displayName,
    lastSeen: serverTimestamp(),
  },
});

// Cleanup on disconnect handled by Cloud Function or client beforeunload
```

---

### Phase 3: Helper Mode & Proposals

**Goal**: Helpers can propose contributions that owners approve/reject.

#### 3.1 Proposal Data Structure

```javascript
// In space document, add proposals subcollection or array:
proposals: [
  {
    id: "prop_123",
    type: "increment", // or "complete", "add_item", etc.
    itemId: "item_xyz",
    proposedBy: "uid_helper",
    proposedByName: "HelperName",
    proposedAt: timestamp,
    details: { amount: 5 }, // type-specific
    status: "pending", // "pending" | "approved" | "rejected"
  },
];
```

#### 3.2 Proposal UI

Add visual indicators on items with pending proposals:

- Badge showing "3 pending"
- Expand to see who proposed what
- One-click approve/reject for owners

#### 3.3 Proposal Actions (Cloud Functions)

```javascript
exports.createProposal = functions.https.onCall(async (data, context) => {
  // Verify user is helper on this space
  // Add proposal to space document
  // Notify owner (optional: in-app notification or email)
});

exports.resolveProposal = functions.https.onCall(async (data, context) => {
  // Verify user is owner
  // If approved, apply the change
  // Update proposal status
});
```

---

### Phase 4: Advanced Features

#### 4.1 Contribution Tracking

Log who contributed what over time:

```javascript
// In items, track contribution history
contributions: [
  { userId: "uid", displayName: "Name", amount: 5, timestamp: ... }
]
```

Show in item details: "Total: 25 — You: 15, Luna: 10"

#### 4.2 Access Revocation

```javascript
exports.revokeAccess = functions.https.onCall(async (data, context) => {
  const { spaceId, targetUserId } = data;
  // Verify caller is owner
  // Remove from collaborators
  // Remove from target's sharedWithMe
  // Clear any real-time listeners (client handles on next load)
});
```

#### 4.3 Transfer Ownership

Allow owner to transfer space to a collaborator:

```javascript
exports.transferOwnership = functions.https.onCall(async (data, context) => {
  // Move space document to new owner
  // Update all collaborator references
  // Transfer storage quota responsibility
});
```

---

## Files to Create/Modify

### New Files

| File                   | Purpose                          |
| ---------------------- | -------------------------------- |
| `functions/invites.js` | Cloud Functions for invite CRUD  |
| `js/sharing.js`        | Frontend sharing logic           |
| `js/proposals.js`      | Helper proposals logic (Phase 3) |

### Modified Files

| File                 | Changes                              |
| -------------------- | ------------------------------------ |
| `firestore.rules`    | Add collaborator read/write rules    |
| `storage.rules`      | Allow collaborators to read images   |
| `functions/index.js` | Import and export new functions      |
| `js/spaces.js`       | Add shared spaces section to sidebar |
| `js/auth-ui.js`      | Subscribe to shared spaces on login  |
| `js/cloud-sync.js`   | Handle shared space data separately  |
| `js/state.js`        | Add sharedSpaces to state            |
| `index.html`         | Add share modal HTML                 |
| `style.css`          | Share modal and shared space styling |
| `mobile.css`         | Mobile share UI                      |

---

## Reusing Existing Infrastructure

| Existing Feature                       | Reused For                            |
| -------------------------------------- | ------------------------------------- |
| Firebase Auth (`auth.js`)              | User identity for collaborators       |
| Firestore sync (`cloud-sync.js`)       | Extended for shared spaces            |
| Real-time listeners (`auth-ui.js`)     | Subscribe to collaborator changes     |
| Cloud Functions (`functions/index.js`) | Add invite/proposal functions         |
| Popup system (`popup.js`)              | Share modal, invite acceptance        |
| Context menus (`context-menu.js`)      | "Share" option on spaces              |
| Storage rules                          | Extended for collaborator read access |

---

## Security Considerations

1. **Invite codes are single-use** — Prevents link sharing abuse
2. **Expiring invites** — 7-day default, owner can revoke anytime
3. **Role-based permissions** — Firestore rules enforce at database level
4. **Storage stays with owner** — No free quota for collaborators
5. **No direct Firestore writes from collaborators** — All changes through Cloud Functions for validation (except Editors editing items)

---

## Migration Path

1. **No breaking changes** — Existing users unaffected
2. **Lazy migration** — `sharedWithMe` array added on first invite acceptance
3. **Gradual rollout** — Feature flag to enable for testing users first

---

## Testing Strategy

### Unit Tests (if adding test framework later)

- Invite code generation uniqueness
- Permission checking logic
- Proposal state machine

### Manual Testing Checklist

**Phase 1 Tests:**

- [ ] Owner generates invite link
- [ ] Link copies to clipboard correctly
- [ ] Friend opens link and sees preview (space name, role)
- [ ] Friend accepts invite (logged in)
- [ ] Friend prompted to login if not authenticated
- [ ] Shared space appears in friend's sidebar
- [ ] Friend can view all items in shared space
- [ ] Friend CANNOT edit items (viewer role)
- [ ] Owner sees friend in collaborators list
- [ ] Owner can remove friend's access
- [ ] Expired invite shows error message
- [ ] Already-used invite shows error message

**Phase 2 Tests:**

- [ ] Changes by owner appear in real-time for collaborators
- [ ] Changes by editor appear in real-time for owner
- [ ] Presence indicator shows who's viewing

**Phase 3 Tests:**

- [ ] Helper can propose item increment
- [ ] Owner sees pending proposal badge
- [ ] Owner approves proposal, item updates
- [ ] Owner rejects proposal, no change
- [ ] Helper sees their proposal status

---

## Estimated Timeline

| Phase   | Duration | Deliverable                               |
| ------- | -------- | ----------------------------------------- |
| Phase 1 | 2 weeks  | Invite system + read-only viewing         |
| Phase 2 | 1 week   | Real-time sync for shared spaces          |
| Phase 3 | 2 weeks  | Helper proposals + approval flow          |
| Phase 4 | 1+ weeks | Contribution tracking, ownership transfer |

---

## Open Questions

1. **Notification system?** — How to notify owners of new proposals/joins?

   - Option A: In-app badge/counter
   - Option B: Email notifications (requires SendGrid/etc.)
   - Option C: Browser push notifications

2. **Maximum collaborators?** — Limit per space? (Suggest: 10)

3. **Link-based vs. Username-based invites?**

   - Current design: Link-based (simpler, no user search needed)
   - Alternative: Search by email/username (requires user discovery feature)

4. **Offline support?** — Should collaborators have offline access to shared spaces?
   - Current design: Online-only for shared (simpler)
   - Their own spaces still work offline

---

## Next Steps

When ready to implement:

1. Start with Phase 1 backend (Cloud Functions for invites)
2. Update Firestore rules incrementally
3. Build share modal UI
4. Test with two accounts
5. Iterate on UX before Phase 2
