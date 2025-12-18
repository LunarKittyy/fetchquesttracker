/**
 * Cloud Sync Module
 * Handles Firestore data synchronization with conflict resolution
 */

import { db, isFirebaseConfigured } from './firebase-config.js';
import { getCurrentUser, isLoggedIn } from './auth.js';
import { 
    doc, 
    setDoc, 
    getDoc, 
    serverTimestamp,
    collection,
    getDocs,
    deleteDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Debounce timer for auto-save
let saveTimeout = null;
const SAVE_DEBOUNCE_MS = 2000;

// Sync status
let syncStatus = 'idle'; // 'idle', 'syncing', 'synced', 'error'
let syncStatusListeners = [];

/**
 * Get user document reference
 */
function getUserDocRef() {
    const user = getCurrentUser();
    if (!user || !db) return null;
    return doc(db, 'users', user.uid);
}

/**
 * Save entire state to Firestore
 * @param {object} state - The complete app state
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveToCloud(state) {
    if (!isFirebaseConfigured() || !isLoggedIn() || !db) {
        return { success: false, error: 'Not configured or not logged in' };
    }

    try {
        updateSyncStatus('syncing');
        
        const userRef = getUserDocRef();
        if (!userRef) {
            throw new Error('No user reference');
        }

        // Save user settings and metadata
        await setDoc(userRef, {
            email: getCurrentUser().email,
            displayName: getCurrentUser().displayName || '',
            settings: {
                soundEnabled: state.soundEnabled,
                shiftAmount: state.shiftAmount,
                ctrlAmount: state.ctrlAmount,
                autoArchive: state.autoArchive
            },
            activeSpaceId: state.activeSpaceId,
            lastModified: serverTimestamp()
        }, { merge: true });

        // Save each space as a subcollection document
        const batch = writeBatch(db);
        
        for (const space of state.spaces) {
            const spaceRef = doc(db, 'users', getCurrentUser().uid, 'spaces', space.id);
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
        
        updateSyncStatus('synced');
        return { success: true };
    } catch (error) {
        console.error('Cloud save error:', error);
        updateSyncStatus('error');
        return { success: false, error: error.message };
    }
}

/**
 * Load state from Firestore
 * @returns {Promise<{success: boolean, state?: object, error?: string}>}
 */
export async function loadFromCloud() {
    if (!isFirebaseConfigured() || !isLoggedIn() || !db) {
        return { success: false, error: 'Not configured or not logged in' };
    }

    try {
        updateSyncStatus('syncing');
        
        const userRef = getUserDocRef();
        if (!userRef) {
            throw new Error('No user reference');
        }

        // Get user document
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            // New user - no cloud data yet
            updateSyncStatus('synced');
            return { success: true, state: null };
        }

        const userData = userSnap.data();

        // Get spaces subcollection
        const spacesRef = collection(db, 'users', getCurrentUser().uid, 'spaces');
        const spacesSnap = await getDocs(spacesRef);
        
        const spaces = [];
        spacesSnap.forEach(doc => {
            spaces.push({
                id: doc.id,
                ...doc.data()
            });
        });

        const cloudState = {
            spaces: spaces,
            activeSpaceId: userData.activeSpaceId,
            soundEnabled: userData.settings?.soundEnabled ?? false,
            shiftAmount: userData.settings?.shiftAmount ?? 5,
            ctrlAmount: userData.settings?.ctrlAmount ?? 10,
            autoArchive: userData.settings?.autoArchive ?? true,
            lastModified: userData.lastModified
        };

        updateSyncStatus('synced');
        return { success: true, state: cloudState };
    } catch (error) {
        console.error('Cloud load error:', error);
        updateSyncStatus('error');
        return { success: false, error: error.message };
    }
}

/**
 * Check if cloud has newer data than local
 * @param {number} localTimestamp - Last modified timestamp of local data
 * @returns {Promise<{hasNewer: boolean, cloudTimestamp?: number}>}
 */
export async function checkCloudNewer(localTimestamp) {
    if (!isFirebaseConfigured() || !isLoggedIn() || !db) {
        return { hasNewer: false };
    }

    try {
        const userRef = getUserDocRef();
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            return { hasNewer: false };
        }

        const cloudTimestamp = userSnap.data().lastModified?.toMillis() || 0;
        return { 
            hasNewer: cloudTimestamp > localTimestamp,
            cloudTimestamp 
        };
    } catch (error) {
        console.error('Cloud check error:', error);
        return { hasNewer: false };
    }
}

/**
 * Delete a space from cloud
 * @param {string} spaceId 
 */
export async function deleteSpaceFromCloud(spaceId) {
    if (!isFirebaseConfigured() || !isLoggedIn() || !db) {
        return { success: false };
    }

    try {
        const spaceRef = doc(db, 'users', getCurrentUser().uid, 'spaces', spaceId);
        await deleteDoc(spaceRef);
        return { success: true };
    } catch (error) {
        console.error('Cloud delete error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Debounced save - call this on every state change
 * @param {object} state 
 */
export function debouncedSave(state) {
    if (!isLoggedIn()) return;
    
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(() => {
        saveToCloud(state);
    }, SAVE_DEBOUNCE_MS);
}

/**
 * Update sync status and notify listeners
 * @param {string} status 
 */
function updateSyncStatus(status) {
    syncStatus = status;
    syncStatusListeners.forEach(cb => cb(status));
}

/**
 * Get current sync status
 * @returns {string}
 */
export function getSyncStatus() {
    return syncStatus;
}

/**
 * Subscribe to sync status changes
 * @param {function} callback 
 * @returns {function} Unsubscribe
 */
export function onSyncStatusChange(callback) {
    syncStatusListeners.push(callback);
    callback(syncStatus);
    
    return () => {
        syncStatusListeners = syncStatusListeners.filter(cb => cb !== callback);
    };
}

/**
 * Create initial user document in Firestore
 * Call after successful signup
 * @param {object} user - Firebase user object
 */
export async function createUserDocument(user) {
    if (!isFirebaseConfigured() || !db) {
        return { success: false };
    }

    try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
            email: user.email,
            displayName: user.displayName || '',
            createdAt: serverTimestamp(),
            settings: {
                soundEnabled: false,
                shiftAmount: 5,
                ctrlAmount: 10,
                autoArchive: true
            }
        });
        return { success: true };
    } catch (error) {
        console.error('Create user doc error:', error);
        return { success: false, error: error.message };
    }
}
