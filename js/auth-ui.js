/**
 * Auth UI Module
 * Authentication UI handlers and state management
 */

import { state, STORAGE_KEY, syncActiveSpace } from './state.js';
import { $, $$ } from './utils.js';
import { saveState, loadState, updateLastSyncedDisplay, updateStorageDisplay, startSyncTimeInterval } from './storage.js';
import { sortItems } from './utils.js';

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
 * Open auth modal
 */
export function openAuthModal() {
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
        if (elements.userEmail) elements.userEmail.textContent = user.email || user.displayName || 'User';
        closeAuthModal();

        console.log('📥 Loading data from cloud...');
        const result = await window.FirebaseBridge.loadFromCloud();
        console.log('📥 Load result:', result);

        if (result.success && result.state) {
            state.spaces = result.state.spaces;
            state.activeSpaceId = result.state.activeSpaceId || state.spaces[0]?.id;
            state.shiftAmount = result.state.shiftAmount;
            state.ctrlAmount = result.state.ctrlAmount;
            state.autoArchive = result.state.autoArchive;
            syncActiveSpace();

            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

            sortItems(state.items);
            if (renderCallback) renderCallback();
            if (renderArchiveCallback) renderArchiveCallback();
            if (renderSpacesCallback) renderSpacesCallback();

            window.FirebaseBridge.startRealtimeSync();
            startSyncTimeInterval();
        }

        updateLastSyncedDisplay();
        updateStorageDisplay();
    } else {
        if (elements.btnLogin) elements.btnLogin.classList.remove('hidden');
        if (elements.userMenu) elements.userMenu.classList.add('hidden');
        if (elements.userDropdown) elements.userDropdown.classList.add('hidden');

        window.FirebaseBridge?.stopRealtimeSync();
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
        showResetMessage('Password reset email sent! Check your inbox.');
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
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
    } else {
        await showAlert('Failed to delete account: ' + result.error, 'ERROR');
    }
}

/**
 * Handle realtime data update from Firebase
 */
export function handleRealtimeUpdate(data, pendingLocalChange, callbacks) {
    if (pendingLocalChange) {
        console.log('🔄 Realtime update ignored (pending local change)');
        return;
    }

    console.log('🔄 Realtime update received');
    document.body.classList.add('sync-update');

    if (data.spaces) {
        state.spaces = data.spaces;
        state.activeSpaceId = data.activeSpaceId || state.spaces[0]?.id;
        syncActiveSpace();
    }

    if (callbacks.render) callbacks.render();
    if (callbacks.renderArchive) callbacks.renderArchive();
    if (callbacks.renderSpaces) callbacks.renderSpaces();

    setTimeout(() => {
        document.body.classList.remove('sync-update');
    }, 100);

    updateLastSyncedDisplay();
}
