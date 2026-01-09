/**
 * Sharing Module
 * Handles invite creation, acceptance, and shared spaces UI
 */

import { showAlert, showConfirm, showToast, completeToast } from './popup.js';
import { Logger } from './logger.js';

const log = Logger.module('Sharing');

// Firebase Functions reference (loaded dynamically)
let functionsRef = null;

/**
 * Initialize Functions reference
 */
async function getFunctionsRef() {
    if (functionsRef) return functionsRef;

    const { getFunctions, httpsCallable } = await import(
        "https://www.gstatic.com/firebasejs/11.0.1/firebase-functions.js"
    );
    const { getApp } = await import(
        "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js"
    );

    functionsRef = getFunctions(getApp(), "us-east1");
    return functionsRef;
}

/**
 * Call a Cloud Function
 */
async function callFunction(name, data) {
    const { httpsCallable } = await import(
        "https://www.gstatic.com/firebasejs/11.0.1/firebase-functions.js"
    );
    const functions = await getFunctionsRef();
    const fn = httpsCallable(functions, name);
    return fn(data);
}

/**
 * Generate a share link for a space
 * @param {string} spaceId - The space to share
 * @param {string} role - "viewer" or "editor"
 * @returns {Promise<{success: boolean, url?: string, expiresAt?: string, error?: string}>}
 */
export async function createShareLink(spaceId, role = "viewer") {
    try {
        const result = await callFunction("createInvite", { spaceId, role });

        const baseUrl = window.location.origin + window.location.pathname;
        const shareUrl = `${baseUrl}?invite=${result.data.inviteCode}`;

        return {
            success: true,
            url: shareUrl,
            inviteCode: result.data.inviteCode,
            expiresAt: result.data.expiresAt,
        };
    } catch (error) {
        log.error('Failed to create share link', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Check for invite code in URL and process it
 * Call this on page load after user is authenticated
 */
export async function checkAndAcceptInvite() {
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get("invite");

    if (!inviteCode) return null;

    // Clear the URL parameter
    window.history.replaceState({}, "", window.location.pathname);

    // Check if user is logged in
    if (!window.FirebaseBridge?.currentUser) {
        // Store invite code for after login
        sessionStorage.setItem("pendingInvite", inviteCode);
        showAlert("Sign in to accept this invite.", "SIGN IN REQUIRED");
        return null;
    }

    return acceptInvite(inviteCode);
}

/**
 * Accept an invite code
 */
export async function acceptInvite(inviteCode) {
    try {
        showToast("Joining space...");
        const result = await callFunction("acceptInvite", { inviteCode });

        await showAlert(
            `You now have ${result.data.role} access to "${result.data.spaceName}".`,
            "JOINED SPACE"
        );
        window.location.reload();

        return result.data;
    } catch (error) {
        log.error('Failed to accept invite', error.message);

        // User-friendly error messages
        if (error.code === "functions/not-found") {
            showAlert("This invite link is invalid or has expired.", "INVALID INVITE");
        } else if (error.code === "functions/already-exists") {
            showAlert("You're already a member of this space.", "ALREADY JOINED");
        } else if (error.code === "functions/failed-precondition") {
            showAlert("This invite has expired.", "EXPIRED INVITE");
        } else if (error.code === "functions/invalid-argument") {
            showAlert("You can't join your own space.", "INVALID");
        } else {
            showAlert(error.message || "Something went wrong.", "ERROR");
        }

        return null;
    }
}

/**
 * Check for pending invite after login
 */
export async function processPendingInvite() {
    const inviteCode = sessionStorage.getItem("pendingInvite");
    if (inviteCode) {
        sessionStorage.removeItem("pendingInvite");
        return acceptInvite(inviteCode);
    }
    return null;
}

/**
 * Revoke a collaborator's access (owner only)
 */
export async function revokeAccess(spaceId, targetUserId) {
    const confirmed = await showConfirm(
        "Remove this collaborator from the space?",
        "REMOVE ACCESS",
        true
    );

    if (!confirmed) return null;

    try {
        await callFunction("revokeAccess", { spaceId, targetUserId });
        return { success: true };
    } catch (error) {
        log.error('Failed to revoke access', error.message);
        showAlert(error.message || "Failed to remove collaborator.", "ERROR");
        return { success: false, error: error.message };
    }
}

/**
 * Leave a shared space (collaborator removes themselves)
 */
export async function leaveSharedSpace(ownerId, spaceId, spaceName) {
    const confirmed = await showConfirm(
        `Leave "${spaceName}"? You'll need a new invite to rejoin.`,
        "LEAVE SPACE",
        true
    );

    if (!confirmed) return null;

    try {
        showToast(`Leaving...`);
        await callFunction("leaveSpace", { ownerId, spaceId });
        completeToast(`Left "${spaceName}"`);
        return { success: true };
    } catch (error) {
        log.error('Failed to leave space', error.message);
        showAlert(error.message || "Failed to leave space.", "ERROR");
        return { success: false, error: error.message };
    }
}

/**
 * Clean up all shared spaces before account deletion
 * Silently leaves all spaces where isOwned is false
 */
export async function cleanupSharedSpaces(spaces) {
    if (!spaces || spaces.length === 0) return;

    const sharedSpaces = spaces.filter(s => s.isOwned === false);
    if (sharedSpaces.length === 0) return;

    const { showToast, completeToast } = await import('./popup.js');
    showToast(`Cleaning up ${sharedSpaces.length} shared spaces...`);

    for (const space of sharedSpaces) {
        try {
            log.info(`Auto-leaving space: ${space.name}`);
            await callFunction("leaveSpace", {
                ownerId: space.ownerId,
                spaceId: space.id
            });
        } catch (error) {
            log.warn(`Failed to auto-leave space ${space.id}:`, error.message);
        }
    }

    completeToast("Cleanup complete", 1000);
}

/**
 * Copy text to clipboard with fallback
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        return true;
    }
}

/**
 * List active (non-expired, unused) invites for a space
 */
export async function listActiveInvites(spaceId) {
    try {
        const result = await callFunction("listInvites", { spaceId });
        return result.data.invites || [];
    } catch (error) {
        log.error('Failed to list invites', error.message);
        return [];
    }
}

/**
 * Revoke an invite link (owner only)
 */
export async function revokeInviteLink(inviteCode) {
    const confirmed = await showConfirm(
        "Revoke this invite link? It can no longer be used.",
        "REVOKE LINK",
        true
    );

    if (!confirmed) return null;

    showToast("Revoking...");

    try {
        await callFunction("revokeInvite", { inviteCode });
        completeToast("Invite revoked");
        return { success: true };
    } catch (error) {
        log.error('Failed to revoke invite', error.message);
        showAlert(error.message || "Failed to revoke invite.", "ERROR");
        return { success: false, error: error.message };
    }
}

