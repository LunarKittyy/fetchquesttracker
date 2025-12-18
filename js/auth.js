/**
 * Firebase Authentication Module
 * Handles user sign up, sign in, Google auth, password reset, and session management
 */

import { auth, isFirebaseConfigured } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    sendPasswordResetEmail,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

// Current user state
let currentUser = null;
let authStateListeners = [];

/**
 * Sign up with email and password
 * @param {string} email 
 * @param {string} password 
 * @param {string} displayName - Optional display name
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
export async function signUp(email, password, displayName = '') {
    if (!isFirebaseConfigured() || !auth) {
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Set display name if provided
        if (displayName) {
            await updateProfile(userCredential.user, { displayName });
        }
        
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('Sign up error:', error);
        return { success: false, error: getAuthErrorMessage(error.code) };
    }
}

/**
 * Sign in with email and password
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
export async function signIn(email, password) {
    if (!isFirebaseConfigured() || !auth) {
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error('Sign in error:', error);
        return { success: false, error: getAuthErrorMessage(error.code) };
    }
}

/**
 * Sign in with Google
 * @returns {Promise<{success: boolean, user?: object, error?: string, isNewUser?: boolean}>}
 */
export async function signInWithGoogle() {
    if (!isFirebaseConfigured() || !auth) {
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        const result = await signInWithPopup(auth, googleProvider);
        const isNewUser = result._tokenResponse?.isNewUser || false;
        return { success: true, user: result.user, isNewUser };
    } catch (error) {
        console.error('Google sign in error:', error);
        return { success: false, error: getAuthErrorMessage(error.code) };
    }
}

/**
 * Sign out current user
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function signOut() {
    if (!isFirebaseConfigured() || !auth) {
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        await firebaseSignOut(auth);
        return { success: true };
    } catch (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send password reset email
 * @param {string} email 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function resetPassword(email) {
    if (!isFirebaseConfigured() || !auth) {
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true };
    } catch (error) {
        console.error('Password reset error:', error);
        return { success: false, error: getAuthErrorMessage(error.code) };
    }
}

/**
 * Get current authenticated user
 * @returns {object|null}
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Check if user is logged in
 * @returns {boolean}
 */
export function isLoggedIn() {
    return currentUser !== null;
}

/**
 * Subscribe to auth state changes
 * @param {function} callback - Called with user object or null
 * @returns {function} Unsubscribe function
 */
export function onAuthChange(callback) {
    authStateListeners.push(callback);
    
    // Call immediately with current state
    callback(currentUser);
    
    return () => {
        authStateListeners = authStateListeners.filter(cb => cb !== callback);
    };
}

/**
 * Initialize auth state listener
 * Call this once on app startup
 */
export function initAuth() {
    if (!isFirebaseConfigured() || !auth) {
        console.log('Auth not initialized - Firebase not configured');
        return;
    }

    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        console.log('Auth state changed:', user ? user.email : 'signed out');
        
        // Notify all listeners
        authStateListeners.forEach(callback => callback(user));
    });
}

/**
 * Convert Firebase error codes to user-friendly messages
 * @param {string} errorCode 
 * @returns {string}
 */
function getAuthErrorMessage(errorCode) {
    const errorMessages = {
        'auth/email-already-in-use': 'This email is already registered. Try signing in instead.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/operation-not-allowed': 'Email/password sign-in is not enabled.',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password. Try again or reset your password.',
        'auth/invalid-credential': 'Invalid email or password.',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
        'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
        'auth/cancelled-popup-request': 'Sign-in was cancelled.',
        'auth/network-request-failed': 'Network error. Check your connection.'
    };

    return errorMessages[errorCode] || 'An error occurred. Please try again.';
}
