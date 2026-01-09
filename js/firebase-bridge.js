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
    getDocFromServer,
    serverTimestamp,
    collection,
    getDocs,
    deleteDoc,
    writeBatch,
    onSnapshot,
    enableMultiTabIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
    getStorage,
    ref,
    uploadString,
    getDownloadURL,
    deleteObject,
    listAll
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";
import {
    initializeAppCheck,
    ReCaptchaV3Provider
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app-check.js";
import { Logger } from './logger.js';

const log = Logger.module('Firebase');

// Current policy version - increment when Privacy Policy or Terms of Service are updated
// Users will be prompted to accept updated policies when this increases
export const CURRENT_POLICY_VERSION = 1;

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
let storage = null;
let googleProvider = null;

// Mobile detection - used to determine auth method
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
}

if (isFirebaseConfigured()) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        storage = getStorage(app);
        googleProvider = new GoogleAuthProvider();

        // Enable offline persistence
        enableMultiTabIndexedDbPersistence(db).catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
            } else if (err.code === 'unimplemented') {
                console.warn('The current browser doesn\'t support all of the features required to enable persistence.');
            }
        });

        // Initialize App Check with reCAPTCHA v3 (skip for localhost)
        const isLocalhost = window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname.startsWith('192.168.');

        if (!isLocalhost) {
            initializeAppCheck(app, {
                provider: new ReCaptchaV3Provider('6Ld2ETAsAAAAALgMe6039Lu-9s2yl3xZ5I5yhT2e'),
                isTokenAutoRefreshEnabled: true
            });
        } else {
            console.log('⚠️ App Check disabled for local development');
        }

        log.info('Firebase initialized successfully');
    } catch (error) {
        log.error('Firebase initialization failed', error.message);
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

// Storage limits
const USER_STORAGE_LIMIT_MB = 10;
const USER_STORAGE_LIMIT_BYTES = USER_STORAGE_LIMIT_MB * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 800;
const IMAGE_QUALITY = 0.7;

// Compress and resize image
async function compressImage(base64Data) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            // Calculate new dimensions
            let width = img.width;
            let height = img.height;

            if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
                if (width > height) {
                    height = (height / width) * MAX_IMAGE_DIMENSION;
                    width = MAX_IMAGE_DIMENSION;
                } else {
                    width = (width / height) * MAX_IMAGE_DIMENSION;
                    height = MAX_IMAGE_DIMENSION;
                }
            }

            // Create canvas and draw resized image
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to compressed JPEG
            const compressed = canvas.toDataURL('image/jpeg', IMAGE_QUALITY);
            resolve(compressed);
        };
        img.onerror = () => resolve(base64Data); // Return original if error
        img.src = base64Data;
    });
}

// Get base64 data size in bytes
function getBase64Size(base64String) {
    if (!base64String) return 0;
    // Remove data URL prefix
    const base64 = base64String.split(',')[1] || base64String;
    // Calculate size (base64 is ~4/3 of original size)
    return Math.ceil((base64.length * 3) / 4);
}

// Expose Firebase Bridge globally for app.js to use
window.FirebaseBridge = {
    isConfigured: isFirebaseConfigured(),
    isMobile: isMobileDevice(), // Expose mobile detection

    // Storage tracking
    storageUsedBytes: 0,
    storageLimitBytes: USER_STORAGE_LIMIT_BYTES,
    storageLimitMB: USER_STORAGE_LIMIT_MB,

    // Auth state
    currentUser: null,
    authStateListeners: [],
    authInitialized: false,

    // Subscribe to auth changes
    onAuthChange(callback) {
        this.authStateListeners.push(callback);
        // Call immediately with current state ONLY if we've received an update from Firebase
        if (this.authInitialized) {
            callback(this.currentUser);
        }
        return () => {
            this.authStateListeners = this.authStateListeners.filter(cb => cb !== callback);
        };
    },

    // Database accessor for SyncManager
    getDb() { return db; },


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

    // Sign in with Google (uses popup on all platforms)
    // Note: signInWithRedirect doesn't work on modern browsers (Chrome M115+, Firefox 109+, Safari 16.1+)
    // due to third-party cookie blocking. Popup is more reliable.
    async signInWithGoogle() {
        if (!auth || !googleProvider) return { success: false, error: 'Firebase not configured' };

        try {
            console.log('🔐 Starting Google sign-in with popup...');
            const result = await signInWithPopup(auth, googleProvider);
            const isNewUser = result._tokenResponse?.isNewUser || false;
            console.log('✅ Google sign-in successful:', result.user.email);
            return { success: true, user: result.user, isNewUser };
        } catch (error) {
            log.error('Google sign-in error', error.code);

            // Provide more helpful error messages for common mobile issues
            if (error.code === 'auth/popup-blocked') {
                return {
                    success: false,
                    error: 'Popup was blocked. Please allow popups for this site and try again.'
                };
            }
            if (error.code === 'auth/popup-closed-by-user') {
                return {
                    success: false,
                    error: 'Sign-in was cancelled. Please try again.'
                };
            }

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

    // Helper: Check if string is a base64 data URL
    isBase64Image(str) {
        return str && typeof str === 'string' && str.startsWith('data:image');
    },

    // Helper: Check if URL is a Firebase Storage URL (already uploaded)
    isStorageUrl(str) {
        return str && typeof str === 'string' && str.includes('firebasestorage.googleapis.com');
    },

    // Fetch storage usage from Firestore (authoritative source tracked by Cloud Functions)
    async fetchStorageUsage() {
        if (!db || !this.currentUser) return { success: false };
        try {
            const storageDocRef = doc(db, 'userStorage', this.currentUser.uid);
            const storageSnap = await getDoc(storageDocRef);

            if (storageSnap.exists()) {
                const data = storageSnap.data();
                this.storageUsedBytes = data.bytesUsed || 0;
                console.log(`📊 Storage usage loaded: ${(this.storageUsedBytes / (1024 * 1024)).toFixed(2)} MB`);
            } else {
                // New user, no storage used yet
                this.storageUsedBytes = 0;
            }
            return { success: true, bytesUsed: this.storageUsedBytes };
        } catch (error) {
            log.error('Error fetching storage usage', error.message);
            return { success: false, error: error.message };
        }
    },

    // Get storage usage info
    getStorageInfo() {
        const usedMB = (this.storageUsedBytes / (1024 * 1024)).toFixed(2);
        const percent = Math.min(100, (this.storageUsedBytes / this.storageLimitBytes) * 100).toFixed(1);
        return {
            usedBytes: this.storageUsedBytes,
            usedMB: parseFloat(usedMB),
            limitMB: this.storageLimitMB,
            percent: parseInt(percent),
            remaining: this.storageLimitBytes - this.storageUsedBytes
        };
    },

    // Helper: Upload a single base64 image to Storage (with compression)
    async uploadImage(base64Data, path) {
        if (!storage || !this.currentUser) return null;

        // Skip if already a storage URL
        if (this.isStorageUrl(base64Data)) return base64Data;

        try {
            // Compress image first
            const compressed = await compressImage(base64Data);
            const imageSize = getBase64Size(compressed);

            // Check storage limit
            if (this.storageUsedBytes + imageSize > this.storageLimitBytes) {
                console.warn('Storage limit exceeded, skipping image upload');
                return null;
            }

            const storageRef = ref(storage, `users/${this.currentUser.uid}/${path}`);
            await uploadString(storageRef, compressed, 'data_url');
            const url = await getDownloadURL(storageRef);

            // Track storage usage
            this.storageUsedBytes += imageSize;

            return url;
        } catch (error) {
            log.error('Image upload error', error.message);
            return null;
        }
    },

    // Helper: Process items/spaces and upload images, returning modified data with URLs
    async processItemsForUpload(items, spaceId, prefix = 'items') {
        const processedItems = [];
        for (const item of items) {
            const processedItem = { ...item };

            // Upload main image if base64
            if (this.isBase64Image(item.imageUrl)) {
                const path = `${spaceId}/${prefix}/${item.id}/main.jpg`;
                const url = await this.uploadImage(item.imageUrl, path);
                if (url) processedItem.imageUrl = url;
            }

            // Process objectives if they have images
            if (item.objectives && item.objectives.length > 0) {
                processedItem.objectives = [];
                for (const obj of item.objectives) {
                    const processedObj = { ...obj };
                    if (this.isBase64Image(obj.imageUrl)) {
                        const objPath = `${spaceId}/${prefix}/${item.id}/obj_${obj.id}.jpg`;
                        const objUrl = await this.uploadImage(obj.imageUrl, objPath);
                        if (objUrl) processedObj.imageUrl = objUrl;
                    }
                    processedItem.objectives.push(processedObj);
                }
            }

            processedItems.push(processedItem);
        }
        return processedItems;
    },

    // Firestore: Save state (with image upload to Storage)
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
                tags: state.tags || [],  // Global tags
                activeSpaceId: state.activeSpaceId,
                storageUsedBytes: this.storageUsedBytes,
                lastModified: serverTimestamp()
            }, { merge: true });

            // Save spaces with uploaded images (skip shared spaces - only save owned spaces)
            const batch = writeBatch(db);
            for (const space of state.spaces) {
                // Skip shared spaces - don't save to our own collection
                // Check isShared flag since isOwned might be undefined
                if (space.isShared === true) {
                    continue;
                }

                // Process items and upload base64 images to Storage
                const processedItems = await this.processItemsForUpload(
                    space.items || [], space.id, 'items'
                );
                const processedArchived = await this.processItemsForUpload(
                    space.archivedItems || [], space.id, 'archived'
                );

                const spaceRef = doc(db, 'users', this.currentUser.uid, 'spaces', space.id);
                batch.set(spaceRef, {
                    name: space.name,
                    color: space.color,
                    items: processedItems,
                    archivedItems: processedArchived,
                    categories: space.categories || [],
                    collaborators: space.collaborators || null,
                    lastModified: serverTimestamp()
                });
            }
            await batch.commit();
            return { success: true };
        } catch (error) {
            log.error('Cloud save error', error.message);
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

            // Restore storage usage tracking
            if (userData.storageUsedBytes) {
                this.storageUsedBytes = userData.storageUsedBytes;
            }

            // Load user's own spaces
            const spacesRef = collection(db, 'users', this.currentUser.uid, 'spaces');
            const spacesSnap = await getDocs(spacesRef);

            const spaces = [];
            spacesSnap.forEach(doc => {
                spaces.push({ id: doc.id, ...doc.data(), isOwned: true });
            });

            // Load shared spaces from sharedWithMe array
            const sharedWithMe = userData.sharedWithMe || [];
            for (const shared of sharedWithMe) {
                try {
                    const sharedSpaceRef = doc(db, 'users', shared.ownerId, 'spaces', shared.spaceId);
                    // Use getDocFromServer to bypass cache and get fresh data
                    const sharedSpaceSnap = await getDocFromServer(sharedSpaceRef);
                    if (sharedSpaceSnap.exists()) {
                        spaces.push({
                            id: shared.spaceId,
                            ...sharedSpaceSnap.data(),
                            isShared: true,
                            isOwned: false,
                            ownerId: shared.ownerId,
                            myRole: shared.role
                        });
                    }
                } catch (e) {
                    console.warn('Could not load shared space:', shared.spaceId, e);
                }
            }

            return {
                success: true,
                state: {
                    spaces: spaces,
                    sharedWithMe: sharedWithMe,
                    tags: userData.tags || [],  // Global tags
                    activeSpaceId: userData.activeSpaceId,
                    soundEnabled: userData.settings?.soundEnabled ?? false,
                    shiftAmount: userData.settings?.shiftAmount ?? 5,
                    ctrlAmount: userData.settings?.ctrlAmount ?? 10,
                    autoArchive: userData.settings?.autoArchive ?? true
                }
            };
        } catch (error) {
            log.error('Cloud load error', error.message);
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
            // Delete all storage files first
            const storageResult = await this.listStorageFiles();
            if (storageResult.success && storageResult.files.length > 0) {
                console.log(`🗑️ Deleting ${storageResult.files.length} storage files...`);
                for (const file of storageResult.files) {
                    await this.deleteStorageFile(file.fullPath);
                }
            }

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
            log.error('Delete account error', error.code);
            // If requires recent login
            if (error.code === 'auth/requires-recent-login') {
                return { success: false, error: 'Please sign out and sign in again before deleting your account.' };
            }
            return { success: false, error: error.message };
        }
    },

    // List all files in user's storage
    async listStorageFiles() {
        if (!storage || !this.currentUser) return { success: false, files: [] };
        try {
            const userRef = ref(storage, `users/${this.currentUser.uid}`);
            const result = await listAll(userRef);

            // Recursively list all files
            const files = [];

            async function listFolder(folderRef, path = '') {
                const contents = await listAll(folderRef);
                for (const item of contents.items) {
                    try {
                        const url = await getDownloadURL(item);
                        files.push({
                            name: item.name,
                            fullPath: item.fullPath,
                            path: path + '/' + item.name,
                            url: url
                        });
                    } catch (e) {
                        console.warn('Could not get URL for', item.fullPath);
                    }
                }
                for (const prefix of contents.prefixes) {
                    await listFolder(prefix, path + '/' + prefix.name);
                }
            }

            await listFolder(userRef);
            return { success: true, files };
        } catch (error) {
            console.error('List files error:', error);
            return { success: false, files: [], error: error.message };
        }
    },

    // Delete a file from storage
    async deleteStorageFile(fullPath) {
        if (!storage || !this.currentUser) return { success: false };
        try {
            const fileRef = ref(storage, fullPath);
            await deleteObject(fileRef);
            return { success: true };
        } catch (error) {
            console.error('Delete file error:', error);
            return { success: false, error: error.message };
        }
    },

    // Delete all images associated with an item (main image + objective images)
    async deleteItemImages(spaceId, itemId, prefix = 'items') {
        if (!storage || !this.currentUser) return { success: false };
        try {
            // Path where item images are stored: users/{uid}/{spaceId}/{prefix}/{itemId}/
            const itemFolderPath = `users/${this.currentUser.uid}/${spaceId}/${prefix}/${itemId}`;
            const itemFolderRef = ref(storage, itemFolderPath);

            // List all files in the item's folder
            const contents = await listAll(itemFolderRef);

            if (contents.items.length === 0) {
                console.log('📁 No images found for item:', itemId);
                return { success: true, deletedCount: 0 };
            }

            // Delete each file
            let deletedCount = 0;
            for (const fileRef of contents.items) {
                try {
                    await deleteObject(fileRef);
                    deletedCount++;
                    console.log('🗑️ Deleted image:', fileRef.fullPath);
                } catch (e) {
                    console.warn('Could not delete:', fileRef.fullPath, e);
                }
            }

            console.log(`🗑️ Deleted ${deletedCount} image(s) for item:`, itemId);
            return { success: true, deletedCount };
        } catch (error) {
            // If folder doesn't exist, that's OK (item had no uploaded images)
            if (error.code === 'storage/object-not-found') {
                return { success: true, deletedCount: 0 };
            }
            console.error('Delete item images error:', error);
            return { success: false, error: error.message };
        }
    },

    // Recalculate storage used (call after deleting files)
    async recalculateStorage() {
        const result = await this.listStorageFiles();
        if (result.success) {
            // Estimate size from file count (rough estimate)
            // We can't get exact sizes without downloading, so we track on upload instead
            return { success: true, fileCount: result.files.length };
        }
        return { success: false };
    },

    // Delete a space from Firestore
    async deleteSpace(spaceId) {
        if (!db || !this.currentUser) return { success: false, error: 'Not logged in' };
        try {
            const spaceRef = doc(db, 'users', this.currentUser.uid, 'spaces', spaceId);
            await deleteDoc(spaceRef);
            console.log('🗑️ Space deleted from cloud:', spaceId);
            return { success: true };
        } catch (error) {
            console.error('Delete space error:', error);
            return { success: false, error: error.message };
        }
    }
};

// Initialize auth state listener
if (auth) {
    onAuthStateChanged(auth, (user) => {
        window.FirebaseBridge.currentUser = user;
        window.FirebaseBridge.authInitialized = true;
        console.log('Auth state changed:', user ? user.email : 'signed out');
        window.FirebaseBridge.authStateListeners.forEach(cb => cb(user));
    });
}

log.info('Firebase Bridge loaded');
