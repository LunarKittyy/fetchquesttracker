/**
 * Firebase Bridge
 * Connects Firebase ES modules with the main app
 * This script runs first and exposes Firebase functionality globally
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    sendPasswordResetEmail,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { 
    getFirestore,
    doc, 
    setDoc, 
    getDoc, 
    serverTimestamp,
    collection,
    getDocs,
    deleteDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Firebase Configuration - FetchQuest Project
const firebaseConfig = {
    apiKey: "AIzaSyCkMgwo6oujPMhqUrAnIQMwbzV582MFglA",
    authDomain: "fetchquesttracker.firebaseapp.com",
    projectId: "fetchquesttracker",
    storageBucket: "fetchquesttracker.firebasestorage.app",
    messagingSenderId: "46789887406",
    appId: "1:46789887406:web:134954eadbe63c4187743f",
    measurementId: "G-W1LXRR26NG"
};

// Check if Firebase is configured
const isFirebaseConfigured = () => {
    return firebaseConfig.apiKey !== "YOUR_API_KEY" && 
           firebaseConfig.projectId !== "YOUR_PROJECT_ID";
};

// Initialize Firebase
let app = null;
let auth = null;
let db = null;
let googleProvider = null;

if (isFirebaseConfigured()) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        googleProvider = new GoogleAuthProvider();
        console.log('🔥 Firebase initialized successfully');
    } catch (error) {
        console.error('Firebase initialization failed:', error);
    }
} else {
    console.log('Firebase not configured - using localStorage only');
}

// Error message mapping
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

// Expose Firebase Bridge globally for app.js to use
window.FirebaseBridge = {
    isConfigured: isFirebaseConfigured(),
    
    // Auth state
    currentUser: null,
    authStateListeners: [],
    
    // Subscribe to auth changes
    onAuthChange(callback) {
        this.authStateListeners.push(callback);
        // Call immediately with current state
        callback(this.currentUser);
        return () => {
            this.authStateListeners = this.authStateListeners.filter(cb => cb !== callback);
        };
    },
    
    // Sign up with email/password
    async signUp(email, password, displayName = '') {
        if (!auth) return { success: false, error: 'Firebase not configured' };
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            if (displayName) {
                await updateProfile(userCredential.user, { displayName });
            }
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: getAuthErrorMessage(error.code) };
        }
    },
    
    // Sign in with email/password
    async signIn(email, password) {
        if (!auth) return { success: false, error: 'Firebase not configured' };
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: getAuthErrorMessage(error.code) };
        }
    },
    
    // Sign in with Google
    async signInWithGoogle() {
        if (!auth || !googleProvider) return { success: false, error: 'Firebase not configured' };
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const isNewUser = result._tokenResponse?.isNewUser || false;
            return { success: true, user: result.user, isNewUser };
        } catch (error) {
            return { success: false, error: getAuthErrorMessage(error.code) };
        }
    },
    
    // Sign out
    async signOut() {
        if (!auth) return { success: false, error: 'Firebase not configured' };
        try {
            await firebaseSignOut(auth);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    // Password reset
    async resetPassword(email) {
        if (!auth) return { success: false, error: 'Firebase not configured' };
        try {
            await sendPasswordResetEmail(auth, email);
            return { success: true };
        } catch (error) {
            return { success: false, error: getAuthErrorMessage(error.code) };
        }
    },
    
    // Firestore: Save state
    async saveToCloud(state) {
        if (!db || !this.currentUser) return { success: false, error: 'Not logged in' };
        try {
            const userRef = doc(db, 'users', this.currentUser.uid);
            await setDoc(userRef, {
                email: this.currentUser.email,
                displayName: this.currentUser.displayName || '',
                settings: {
                    soundEnabled: state.soundEnabled,
                    shiftAmount: state.shiftAmount,
                    ctrlAmount: state.ctrlAmount,
                    autoArchive: state.autoArchive
                },
                activeSpaceId: state.activeSpaceId,
                lastModified: serverTimestamp()
            }, { merge: true });

            // Save spaces
            const batch = writeBatch(db);
            for (const space of state.spaces) {
                const spaceRef = doc(db, 'users', this.currentUser.uid, 'spaces', space.id);
                batch.set(spaceRef, {
                    name: space.name,
                    color: space.color,
                    items: space.items || [],
                    archivedItems: space.archivedItems || [],
                    categories: space.categories || [],
                    lastModified: serverTimestamp()
                });
            }
            await batch.commit();
            return { success: true };
        } catch (error) {
            console.error('Cloud save error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Firestore: Load state
    async loadFromCloud() {
        if (!db || !this.currentUser) return { success: false, error: 'Not logged in' };
        try {
            const userRef = doc(db, 'users', this.currentUser.uid);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists()) {
                return { success: true, state: null }; // New user
            }
            
            const userData = userSnap.data();
            const spacesRef = collection(db, 'users', this.currentUser.uid, 'spaces');
            const spacesSnap = await getDocs(spacesRef);
            
            const spaces = [];
            spacesSnap.forEach(doc => {
                spaces.push({ id: doc.id, ...doc.data() });
            });

            return {
                success: true,
                state: {
                    spaces: spaces,
                    activeSpaceId: userData.activeSpaceId,
                    soundEnabled: userData.settings?.soundEnabled ?? false,
                    shiftAmount: userData.settings?.shiftAmount ?? 5,
                    ctrlAmount: userData.settings?.ctrlAmount ?? 10,
                    autoArchive: userData.settings?.autoArchive ?? true
                }
            };
        } catch (error) {
            console.error('Cloud load error:', error);
            return { success: false, error: error.message };
        }
    },
    
    // Track last sync time
    lastSyncTime: null,
    
    // Get relative time string
    getRelativeSyncTime() {
        if (!this.lastSyncTime) return 'Not synced yet';
        const seconds = Math.floor((Date.now() - this.lastSyncTime) / 1000);
        if (seconds < 5) return 'Just now';
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    },
    
    // Update last sync time
    updateLastSyncTime() {
        this.lastSyncTime = Date.now();
    },
    
    // Export user data (GDPR)
    async exportUserData() {
        if (!db || !this.currentUser) return { success: false, error: 'Not logged in' };
        try {
            const userRef = doc(db, 'users', this.currentUser.uid);
            const userSnap = await getDoc(userRef);
            const spacesRef = collection(db, 'users', this.currentUser.uid, 'spaces');
            const spacesSnap = await getDocs(spacesRef);
            
            const spaces = [];
            spacesSnap.forEach(doc => {
                spaces.push({ id: doc.id, ...doc.data() });
            });
            
            const exportData = {
                exportDate: new Date().toISOString(),
                user: {
                    email: this.currentUser.email,
                    displayName: this.currentUser.displayName
                },
                userData: userSnap.exists() ? userSnap.data() : {},
                spaces: spaces
            };
            
            return { success: true, data: exportData };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    // Delete account and all data (GDPR)
    async deleteAccount() {
        if (!db || !auth || !this.currentUser) return { success: false, error: 'Not logged in' };
        try {
            // Delete all spaces
            const spacesRef = collection(db, 'users', this.currentUser.uid, 'spaces');
            const spacesSnap = await getDocs(spacesRef);
            const batch = writeBatch(db);
            spacesSnap.forEach(docRef => {
                batch.delete(doc(db, 'users', this.currentUser.uid, 'spaces', docRef.id));
            });
            await batch.commit();
            
            // Delete user document
            const userRef = doc(db, 'users', this.currentUser.uid);
            await deleteDoc(userRef);
            
            // Delete the Firebase auth account
            await this.currentUser.delete();
            
            return { success: true };
        } catch (error) {
            console.error('Delete account error:', error);
            // If requires recent login
            if (error.code === 'auth/requires-recent-login') {
                return { success: false, error: 'Please sign out and sign in again before deleting your account.' };
            }
            return { success: false, error: error.message };
        }
    }
};

// Initialize auth state listener
if (auth) {
    onAuthStateChanged(auth, (user) => {
        window.FirebaseBridge.currentUser = user;
        console.log('Auth state changed:', user ? user.email : 'signed out');
        window.FirebaseBridge.authStateListeners.forEach(cb => cb(user));
    });
}

console.log('🔌 Firebase Bridge loaded');
