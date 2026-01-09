/**
 * Auth UI Module
 * Authentication UI handlers and state management
 */

import { state, STORAGE_KEY, syncActiveSpace } from './state.js';
import { $, $$ } from './utils.js';
import { saveState, loadState, updateLastSyncedDisplay, updateStorageDisplay, startSyncTimeInterval } from './storage.js';
import { sortItems } from './utils.js';
import { syncManager } from './sync-manager.js';
import { CURRENT_POLICY_VERSION } from './firebase-bridge.js';

// Callbacks
let renderCallback = null;
let renderArchiveCallback = null;
let renderSpacesCallback = null;

// DOM elements cache
let elements = {};

/**
 * Initialize auth UI module
 */
export function initAuthUI(domElements, callbacks) {
    elements = domElements;
    if (callbacks.render) renderCallback = callbacks.render;
    if (callbacks.renderArchive) renderArchiveCallback = callbacks.renderArchive;
    if (callbacks.renderSpaces) renderSpacesCallback = callbacks.renderSpaces;
}

/**
 * Check if running on mobile Firefox
 */
function isMobileFirefox() {
    const ua = navigator.userAgent;
    const isFirefox = /Firefox/i.test(ua);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua);
    return isFirefox && isMobile;
}

/**
 * Open auth modal
 */
export async function openAuthModal() {
    // Check for mobile Firefox - login doesn't work there
    if (isMobileFirefox()) {
        const { showAlert } = await import('./popup.js');
        await showAlert(
            'Login is not supported in Firefox on mobile devices due to browser limitations. Please use Chrome or another browser to log in.',
            'BROWSER NOT SUPPORTED'
        );
        return;
    }

    // Close all other modals first
    document.querySelectorAll('.modal:not(.hidden)').forEach(modal => {
        modal.classList.add('hidden');
    });

    if (elements.modalAuth) {
        elements.modalAuth.classList.remove('hidden');
        switchAuthTab('signin');
        clearAuthErrors();
    }
}

/**
 * Close auth modal
 */
export function closeAuthModal() {
    if (elements.modalAuth) {
        elements.modalAuth.classList.add('hidden');
        clearAuthErrors();
    }
}

/**
 * Switch between signin/signup tabs
 */
export function switchAuthTab(tab) {
    elements.authTabs?.forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });

    if (elements.formSignin) elements.formSignin.classList.toggle('hidden', tab !== 'signin');
    if (elements.formSignup) elements.formSignup.classList.toggle('hidden', tab !== 'signup');
    if (elements.formReset) elements.formReset.classList.add('hidden');
    if (elements.authDivider) elements.authDivider.classList.remove('hidden');
    if (elements.btnGoogleSignin) elements.btnGoogleSignin.classList.remove('hidden');

    clearAuthErrors();
}

/**
 * Show password reset form
 */
export function showPasswordReset() {
    if (elements.formSignin) elements.formSignin.classList.add('hidden');
    if (elements.formSignup) elements.formSignup.classList.add('hidden');
    if (elements.formReset) elements.formReset.classList.remove('hidden');
    if (elements.authDivider) elements.authDivider.classList.add('hidden');
    if (elements.btnGoogleSignin) elements.btnGoogleSignin.classList.add('hidden');
    elements.authTabs?.forEach(t => t.classList.remove('active'));
    clearAuthErrors();
}

/**
 * Clear auth error messages
 */
export function clearAuthErrors() {
    ['signinError', 'signupError', 'resetError', 'resetMessage'].forEach(key => {
        if (elements[key]) {
            elements[key].classList.add('hidden');
            elements[key].textContent = '';
        }
    });
}

/**
 * Show auth error
 */
export function showAuthError(form, message) {
    const errorEl = form === 'signin' ? elements.signinError :
        form === 'signup' ? elements.signupError : elements.resetError;
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }
}

/**
 * Show reset message
 */
export function showResetMessage(message) {
    if (elements.resetMessage) {
        elements.resetMessage.textContent = message;
        elements.resetMessage.classList.remove('hidden');
    }
}

/**
 * Toggle user dropdown
 */
export function toggleUserDropdown() {
    if (elements.userDropdown) {
        elements.userDropdown.classList.toggle('hidden');
    }
}

/**
 * Update UI based on auth state
 */
export async function updateAuthUI(user) {
    if (user) {
        if (elements.btnLogin) elements.btnLogin.classList.add('hidden');
        if (elements.userMenu) elements.userMenu.classList.remove('hidden');
        if (elements.userDisplayName) elements.userDisplayName.textContent = user.displayName || user.email?.split('@')[0] || 'User';
        closeAuthModal();

        // Load cloud data via SyncManager
        const result = await syncManager.load();

        if (result.success && result.state) {
            // Apply cloud state
            state.spaces = result.state.spaces;
            state.activeSpaceId = result.state.activeSpaceId || state.spaces[0]?.id;
            state.tags = result.state.tags || [];
            state.shiftAmount = result.state.shiftAmount;
            state.ctrlAmount = result.state.ctrlAmount;
            state.autoArchive = result.state.autoArchive;
            syncActiveSpace();

            // Persist to localStorage
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

            // Render UI
            sortItems(state.items);
            if (renderCallback) renderCallback();
            if (renderArchiveCallback) renderArchiveCallback();
            if (renderSpacesCallback) renderSpacesCallback();
        }

        // Start real-time sync and register data change handler
        syncManager.start();
        syncManager.onDataChange((data) => {
            handleRealtimeUpdate(data);
        });
        syncManager.onStatusChange(updateSyncStatusUI);

        startSyncTimeInterval();

        // Fetch authoritative storage usage
        await window.FirebaseBridge?.fetchStorageUsage?.();
        updateLastSyncedDisplay();
        updateStorageDisplay();

        // Check if user needs to accept updated policies
        await checkPolicyVersion();

        // Check if user needs to set a display name
        await checkDisplayName();
    } else {
        if (elements.btnLogin) elements.btnLogin.classList.remove('hidden');
        if (elements.userMenu) elements.userMenu.classList.add('hidden');
        if (elements.userDropdown) elements.userDropdown.classList.add('hidden');

        syncManager.stop();
    }
}

/**
 * Update sync status UI indicator
 */
export function updateSyncStatusUI(status) {
    const syncStatus = elements.syncStatus;
    if (!syncStatus) return;

    syncStatus.classList.remove('syncing', 'synced', 'error');
    syncStatus.classList.add(status);
}

/**
 * Check if user has meaningful local data
 */
function hasLocalData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return false;
        const data = JSON.parse(stored);
        // Check if there are any spaces with items
        return data.spaces?.some(s => s.items && s.items.length > 0);
    } catch {
        return false;
    }
}

/**
 * Handle sign in form submit
 */
export async function handleSignIn(e) {
    e.preventDefault();
    const email = $('#signin-email').value;
    const password = $('#signin-password').value;

    if (!window.FirebaseBridge?.isConfigured) {
        showAuthError('signin', 'Firebase not configured.');
        return;
    }

    // Warn if local data exists
    if (hasLocalData()) {
        const { showConfirm } = await import('./popup.js');
        const confirmed = await showConfirm(
            'Signing in will replace your local data with cloud data. Continue?',
            'OVERWRITE LOCAL DATA',
            true
        );
        if (!confirmed) return;
    }

    clearAuthErrors();
    const result = await window.FirebaseBridge.signIn(email, password);
    if (!result.success) {
        showAuthError('signin', result.error);
    }
}

/**
 * Handle sign up form submit
 */
export async function handleSignUp(e) {
    e.preventDefault();
    const name = $('#signup-name').value;
    const email = $('#signup-email').value;
    const password = $('#signup-password').value;

    if (!window.FirebaseBridge?.isConfigured) {
        showAuthError('signup', 'Firebase not configured.');
        return;
    }

    clearAuthErrors();
    const result = await window.FirebaseBridge.signUp(email, password, name);
    if (!result.success) {
        showAuthError('signup', result.error);
    }
}

/**
 * Handle password reset form submit
 */
export async function handlePasswordReset(e) {
    e.preventDefault();
    const email = $('#reset-email').value;

    if (!window.FirebaseBridge?.isConfigured) {
        showAuthError('reset', 'Firebase not configured.');
        return;
    }

    clearAuthErrors();
    const result = await window.FirebaseBridge.resetPassword(email);
    if (result.success) {
        showResetMessage('Password reset email sent. Check your Inbox or Spam folder!');
    } else {
        showAuthError('reset', result.error);
    }
}

/**
 * Handle Google sign in
 */
export async function handleGoogleSignIn() {
    if (!window.FirebaseBridge?.isConfigured) {
        showAuthError('signin', 'Firebase not configured.');
        return;
    }

    // Warn if local data exists
    if (hasLocalData()) {
        const { showConfirm } = await import('./popup.js');
        const confirmed = await showConfirm(
            'Signing in will replace your local data with cloud data. Continue?',
            'OVERWRITE LOCAL DATA',
            true
        );
        if (!confirmed) return;
    }

    clearAuthErrors();
    const result = await window.FirebaseBridge.signInWithGoogle();

    if (!result.success) {
        showAuthError('signin', result.error);
    }
}

/**
 * Handle logout
 */
export async function handleLogout() {
    if (elements.userDropdown) elements.userDropdown.classList.add('hidden');
    await window.FirebaseBridge?.signOut();
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
}

/**
 * Handle export user data (GDPR)
 */
export async function handleExportData() {
    if (elements.userDropdown) elements.userDropdown.classList.add('hidden');

    if (!window.FirebaseBridge?.currentUser) return;

    const result = await window.FirebaseBridge.exportUserData();
    if (result.success) {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(result.data, null, 2));
        const link = document.createElement('a');
        link.href = dataStr;
        link.download = `fetchquest_export_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
    }
}

/**
 * Handle delete account
 */
export async function handleDeleteAccount() {
    const { showConfirm, showPrompt, showAlert } = await import('./popup.js');

    if (elements.userDropdown) elements.userDropdown.classList.add('hidden');

    const confirmed1 = await showConfirm('Delete your account and ALL data permanently?', 'DELETE ACCOUNT', true);
    if (!confirmed1) return;

    const confirmText = await showPrompt('Type DELETE to confirm:', 'CONFIRM DELETION');
    if (confirmText !== 'DELETE') {
        if (confirmText !== null) {
            await showAlert('Account deletion cancelled.', 'CANCELLED');
        }
        return;
    }

    const result = await window.FirebaseBridge.deleteAccount();
    if (result.success) {
        // Clean up shared spaces before reload
        const { cleanupSharedSpaces } = await import('./sharing.js');
        await cleanupSharedSpaces(state.spaces);

        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
    } else {
        await showAlert('Failed to delete account: ' + result.error, 'ERROR');
    }
}

/**
 * Handle show info button click (streamer privacy)
 */
export async function handleShowInfo() {
    const user = window.FirebaseBridge?.currentUser;
    if (!user) return;

    const { showAlert } = await import('./popup.js');
    await showAlert(`Your account email is: ${user.email}`, 'ACCOUNT DETAILS');
}

/**
 * Handle realtime data update from SyncManager
 */
function handleRealtimeUpdate(data) {
    document.body.classList.add('sync-update');

    if (data.type === 'spaces' && data.spaces) {
        // Preserve shared spaces (those we don't own)
        const sharedSpaces = state.spaces.filter(s => s.isOwned === false);

        // For owned spaces, compare timestamps and only update if incoming is newer
        const mergedOwnedSpaces = data.spaces.map(incomingSpace => {
            const localSpace = state.spaces.find(s => s.id === incomingSpace.id && s.isOwned !== false);

            if (localSpace) {
                // Always accept collaborators from server (since client doesn't write them)
                if (incomingSpace.collaborators) {
                    localSpace.collaborators = incomingSpace.collaborators;
                }

                // Preserve sync markers
                incomingSpace._localModified = localSpace._localModified;
                incomingSpace._lastSyncedLocal = localSpace._lastSyncedLocal;

                // Compare timestamps
                const incomingTime = incomingSpace._cloudTimestamp || 0;
                const localTime = localSpace._localModified || localSpace._cloudTimestamp || 0;

                if (localTime > incomingTime) {
                    SyncLog.debug(`Keeping local version of "${localSpace.name}" (local edit is newer)`);
                    return { ...localSpace, isOwned: true };
                } else if (localTime < incomingTime) {
                    SyncLog.info(`Updating "${localSpace.name}" from server (server is newer)`);
                }
            }

            return { ...incomingSpace, isOwned: true };
        });

        state.spaces = [...mergedOwnedSpaces, ...sharedSpaces];

        // Only update activeSpaceId if the current one no longer exists
        const currentSpaceExists = state.spaces.some(s => s.id === state.activeSpaceId);
        if (!currentSpaceExists) {
            state.activeSpaceId = state.spaces[0]?.id;
        }
        syncActiveSpace();
    }

    // Handle shared space updates from owner
    if (data.type === 'sharedSpaceUpdate' && data.space) {
        const incomingSpace = data.space;
        const existingIndex = state.spaces.findIndex(s => s.id === incomingSpace.id && s.isOwned === false);

        if (existingIndex >= 0) {
            const existingSpace = state.spaces[existingIndex];
            const isViewer = existingSpace.myRole === 'viewer';

            if (isViewer) {
                // Viewers always accept incoming data
                state.spaces[existingIndex] = incomingSpace;
            } else {
                // Editors use timestamp comparison
                // Preserve sync markers
                incomingSpace._localModified = existingSpace._localModified;
                incomingSpace._lastSyncedLocal = existingSpace._lastSyncedLocal;

                const incomingTime = incomingSpace._cloudTimestamp || 0;
                const localTime = existingSpace._localModified || existingSpace._cloudTimestamp || 0;

                if (incomingTime >= localTime) {
                    state.spaces[existingIndex] = incomingSpace;
                }
            }
        } else {
            // New shared space
            state.spaces.push(incomingSpace);
        }

        syncActiveSpace();
    }

    // Render updates
    if (renderCallback) renderCallback();
    if (renderArchiveCallback) renderArchiveCallback();
    if (renderSpacesCallback) renderSpacesCallback();

    setTimeout(() => {
        document.body.classList.remove('sync-update');
    }, 100);

    updateLastSyncedDisplay();
}

/**
 * Check if user's accepted policy version is current
 * Shows policy update modal if outdated
 */
async function checkPolicyVersion() {
    if (!window.FirebaseBridge?.currentUser || !window.FirebaseBridge?.getDb) return;

    const { doc, getDoc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js');
    const db = window.FirebaseBridge.getDb();
    const uid = window.FirebaseBridge.currentUser.uid;

    try {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};
        const acceptedVersion = userData.acceptedPolicyVersion || 0;

        if (acceptedVersion < CURRENT_POLICY_VERSION) {
            // Show policy update modal
            const modal = $('#modal-policy');
            if (modal) {
                modal.classList.remove('hidden');

                // Setup accept button handler
                const acceptBtn = $('#btn-accept-policy');
                if (acceptBtn) {
                    acceptBtn.onclick = async () => {
                        await handlePolicyAccept(userRef, setDoc, serverTimestamp);
                        modal.classList.add('hidden');
                    };
                }
            }
        }
    } catch (error) {
        console.error('Policy version check failed:', error);
    }
}

/**
 * Handle policy accept button click
 */
async function handlePolicyAccept(userRef, setDoc, serverTimestamp) {
    try {
        await setDoc(userRef, {
            acceptedPolicyVersion: CURRENT_POLICY_VERSION,
            policyAcceptedAt: serverTimestamp()
        }, { merge: true });
        console.log('Policy accepted, version:', CURRENT_POLICY_VERSION);
    } catch (error) {
        console.error('Failed to update policy acceptance:', error);
    }
}

/**
 * Check if user needs to set a display name
 * Shows prompt after Google sign-in or if missing
 */
async function checkDisplayName() {
    const user = window.FirebaseBridge?.currentUser;
    if (!user) return;

    // Skip if user already has a display name
    if (user.displayName && user.displayName.trim()) return;

    const { showPrompt } = await import('./popup.js');
    const { updateProfile } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js');

    const name = await showPrompt(
        'What should we call you?',
        'ADD USERNAME',
        ''
    );

    let displayName;
    if (name && name.trim()) {
        displayName = name.trim();
    } else {
        // Skip - use email prefix
        displayName = user.email?.split('@')[0] || 'User';
    }

    try {
        await updateProfile(user, { displayName });
        // Update UI
        if (elements.userDisplayName) {
            elements.userDisplayName.textContent = displayName;
        }
        console.log('Display name set to:', displayName);
    } catch (error) {
        console.error('Failed to set display name:', error);
    }
}

/**
 * Handle change name button click (user dropdown)
 */
export async function handleChangeName() {
    if (elements.userDropdown) elements.userDropdown.classList.add('hidden');

    const user = window.FirebaseBridge?.currentUser;
    if (!user) return;

    const { showPrompt } = await import('./popup.js');
    const { updateProfile } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js');

    const currentName = user.displayName || '';
    const name = await showPrompt(
        'Enter your new display name:',
        'CHANGE NAME',
        currentName
    );

    if (name === null) return; // Cancelled

    const displayName = name.trim() || user.email?.split('@')[0] || 'User';

    try {
        await updateProfile(user, { displayName });

        // Sync display name to Firestore for persistence
        const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js');
        const db = window.FirebaseBridge.getDb();
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
            displayName,
            displayNameUpdatedAt: serverTimestamp()
        }, { merge: true });

        if (elements.userDisplayName) {
            elements.userDisplayName.textContent = displayName;
        }
        const { showToast } = await import('./popup.js');
        showToast('Name updated!');
    } catch (error) {
        console.error('Failed to change name:', error);
        const { showAlert } = await import('./popup.js');
        showAlert('Failed to update name.', 'ERROR');
    }
}
