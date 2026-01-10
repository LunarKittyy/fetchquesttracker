/**
 * SyncManager - Unified sync layer for FetchQuest
 * Handles all cloud synchronization with Firestore
 */

import {
    doc, setDoc, getDoc, getDocFromServer, collection, getDocs,
    writeBatch, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { CURRENT_POLICY_VERSION } from './firebase-bridge.js';

// ============================================================================
// SYNC LOGGING
// ============================================================================

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
let currentLogLevel = LOG_LEVELS.INFO;
const logHistory = [];
const MAX_LOG_HISTORY = 50;

function formatTime() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
}

export const SyncLog = {
    setLevel(level) {
        currentLogLevel = LOG_LEVELS[level] ?? LOG_LEVELS.INFO;
    },

    _log(level, icon, msg, data = null) {
        if (LOG_LEVELS[level] < currentLogLevel) return;

        const entry = { time: formatTime(), level, icon, msg, data };
        logHistory.push(entry);
        if (logHistory.length > MAX_LOG_HISTORY) logHistory.shift();

        const prefix = `[SYNC] ${icon}`;
        if (data) {
            console.log(`${prefix} ${msg}`, data);
        } else {
            console.log(`${prefix} ${msg}`);
        }
    },

    debug(msg, data) { this._log('DEBUG', '🔍', msg, data); },
    info(msg, data) { this._log('INFO', '▶', msg, data); },
    success(msg, data) { this._log('INFO', '✓', msg, data); },
    warn(msg, data) { this._log('WARN', '⚠', msg, data); },
    error(msg, data) { this._log('ERROR', '✗', msg, data); },
    incoming(msg, data) { this._log('INFO', '◀', msg, data); },

    getHistory() { return [...logHistory]; }
};

// Sync debug state exposed for logger.js
window.SyncDebug = {
    getStatus: () => syncManagerInstance?.status || 'idle',
    getLastSyncTime: () => syncManagerInstance?.lastSyncTime,
    hasPendingChanges: () => syncManagerInstance?.pendingChanges || false,
    getLogs: () => [...logHistory]
};

// ============================================================================
// SYNC MANAGER
// ============================================================================

let syncManagerInstance = null;

export class SyncManager {
    constructor() {
        this.status = 'idle'; // idle, syncing, synced, error, offline
        this.lastSyncTime = null;
        this.pendingChanges = false;
        this.statusListeners = [];
        this.dataListeners = [];
        this.unsubscribers = [];
        this.saveTimeout = null;
        this.saveDebounceMs = 500;
        this.isInitializing = false;

        // Singleton
        if (syncManagerInstance) {
            SyncLog.warn('SyncManager already exists, returning existing instance');
            return syncManagerInstance;
        }
        syncManagerInstance = this;

        // Debug mode now handled by logger.js

        SyncLog.info('SyncManager initialized');
    }

    // -------------------------------------------------------------------------
    // Getters
    // -------------------------------------------------------------------------

    get db() {
        return window.FirebaseBridge?.getDb?.() || window.FirebaseBridge?.db || null;
    }

    get user() {
        return window.FirebaseBridge?.currentUser;
    }

    get isLoggedIn() {
        return !!this.user;
    }

    // -------------------------------------------------------------------------
    // Status Management
    // -------------------------------------------------------------------------

    setStatus(status) {
        if (this.status === status) return;
        this.status = status;
        this.statusListeners.forEach(cb => cb(status));
    }

    onStatusChange(callback) {
        this.statusListeners.push(callback);
        callback(this.status);
        return () => {
            this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
        };
    }

    // -------------------------------------------------------------------------
    // Data Change Listeners
    // -------------------------------------------------------------------------

    onDataChange(callback) {
        this.dataListeners.push(callback);
        return () => {
            this.dataListeners = this.dataListeners.filter(cb => cb !== callback);
        };
    }

    notifyDataChange(data) {
        if (this.isInitializing) {
            SyncLog.debug('Skipping notification (initializing)');
            return;
        }

        if (this.pendingChanges) {
            SyncLog.debug('Received update while changes pending (will reconcile)');
        }

        SyncLog.incoming('Data changed from server');
        this.dataListeners.forEach(cb => cb(data));
    }

    // -------------------------------------------------------------------------
    // Save Operations
    // -------------------------------------------------------------------------

    save(state) {
        if (!this.isLoggedIn) {
            SyncLog.debug('Not logged in, skipping cloud save');
            return;
        }

        this.pendingChanges = true;

        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        SyncLog.info(`Save queued (${this.saveDebounceMs}ms debounce)`);

        this.saveTimeout = setTimeout(() => {
            this.saveNow(state);
        }, this.saveDebounceMs);
    }

    async saveNow(state) {
        if (!this.isLoggedIn || !this.db) {
            SyncLog.warn('Cannot save: not logged in or no database');
            return { success: false, error: 'Not logged in' };
        }

        // Check if user is hovering on a quest card (desktop only)
        if (!window.FirebaseBridge?.isMobile) {
            const hoveredCard = document.querySelector('.quest-card:hover');
            if (hoveredCard) {
                SyncLog.debug('Delaying save (user hovering on card)');
                hoveredCard.addEventListener('mouseleave', () => {
                    this.save(state);
                }, { once: true });
                return { success: false, error: 'Delayed for hover' };
            }
        }

        // Check if a card is being dragged
        const draggingCard = document.querySelector('.quest-card.dragging');
        if (draggingCard) {
            SyncLog.debug('Delaying save (card being dragged)');
            const checkDragEnd = () => {
                if (!document.querySelector('.quest-card.dragging')) {
                    this.save(state);
                } else {
                    requestAnimationFrame(checkDragEnd);
                }
            };
            requestAnimationFrame(checkDragEnd);
            return { success: false, error: 'Delayed for drag' };
        }

        const startTime = Date.now();
        const batch = writeBatch(this.db);
        let savedCount = 0;
        let globalSaved = false;

        // Check if global settings need saving
        const globalMod = state._localModified || 0;
        const lastGlobalSync = this.lastGlobalSyncedLocal || 0;

        if (!this.lastSyncTime || globalMod > lastGlobalSync) {
            const userRef = doc(this.db, 'users', this.user.uid);
            const userData = {
                email: this.user.email,
                displayName: this.user.displayName || '',
                settings: {

                    shiftAmount: state.shiftAmount,
                    ctrlAmount: state.ctrlAmount,
                    autoArchive: state.autoArchive
                },
                tags: state.tags || [],
                activeSpaceId: state.activeSpaceId,
                lastModified: serverTimestamp()
            };

            // Set policy version on first save (new users)
            if (!this.lastSyncTime) {
                userData.acceptedPolicyVersion = CURRENT_POLICY_VERSION;
            }

            batch.set(userRef, userData, { merge: true });
            globalSaved = true;
            this._syncingGlobalTimestamp = globalMod;
        }

        // Check each owned space for changes
        for (const space of state.spaces) {
            // Skip if not owned AND not an editor (viewers cannot save)
            if (space.isOwned === false && space.myRole !== 'editor') continue;

            const localMod = space._localModified || 0;
            const lastSync = space._lastSyncedLocal || 0;

            // Only save if it's never been saved or has local changes
            if (this.lastSyncTime && localMod <= lastSync && lastSync !== 0) continue;

            // Process images if bridge has the function
            let processedItems = space.items || [];
            let processedArchived = space.archivedItems || [];

            if (window.FirebaseBridge?.processItemsForUpload) {
                processedItems = await window.FirebaseBridge.processItemsForUpload(
                    space.items || [], space.id, 'items'
                );
                processedArchived = await window.FirebaseBridge.processItemsForUpload(
                    space.archivedItems || [], space.id, 'archived'
                );
            }

            // Determine target path (use ownerId if it's a shared space)
            const targetOwnerId = (space.isOwned === false && space.ownerId)
                ? space.ownerId
                : this.user.uid;

            const spaceRef = doc(this.db, 'users', targetOwnerId, 'spaces', space.id);

            batch.set(spaceRef, {
                name: space.name,
                color: space.color,
                items: processedItems,
                archivedItems: processedArchived,
                categories: space.categories || [],
                // collaborators: explicitly excluded to prevent overwrite
                lastModified: serverTimestamp()
            }, { merge: true });

            space._syncingTimestamp = localMod || Date.now();
            savedCount++;
        }

        if (savedCount === 0 && !globalSaved) {
            SyncLog.debug('No changes to save');
            this.pendingChanges = false;
            this.setStatus('synced');
            return { success: true };
        }

        SyncLog.info(`Syncing ${globalSaved ? 'settings + ' : ''}${savedCount} space(s)...`);
        this.setStatus('syncing');

        try {
            await batch.commit();

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
            SyncLog.success(`Cloud save complete (${elapsed}s)`);

            // Update sync markers
            if (globalSaved) {
                this.lastGlobalSyncedLocal = this._syncingGlobalTimestamp;
                delete this._syncingGlobalTimestamp;
            }

            for (const space of state.spaces) {
                if (space._syncingTimestamp) {
                    space._lastSyncedLocal = space._syncingTimestamp;
                    delete space._syncingTimestamp;
                }
            }

            this.lastSyncTime = Date.now();
            this.setStatus('synced');

            // Update FirebaseBridge sync time for UI display
            window.FirebaseBridge?.updateLastSyncTime?.();

            setTimeout(() => {
                this.pendingChanges = false;
            }, 500);

            return { success: true };
        } catch (error) {
            SyncLog.error('Cloud save failed', error.message);
            this.setStatus('error');
            this.pendingChanges = false;
            // Clean up temporary markers
            delete this._syncingGlobalTimestamp;
            state.spaces.forEach(s => delete s._syncingTimestamp);
            return { success: false, error: error.message };
        }
    }

    // -------------------------------------------------------------------------
    // Load Operations
    // -------------------------------------------------------------------------

    async load() {
        if (!this.isLoggedIn || !this.db) {
            SyncLog.warn('Cannot load: not logged in or no database');
            return { success: false, error: 'Not logged in' };
        }

        SyncLog.info('Loading from cloud...');
        this.setStatus('syncing');
        this.isInitializing = true;

        try {
            const userRef = doc(this.db, 'users', this.user.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                SyncLog.info('New user, no cloud data');
                this.setStatus('synced');
                this.isInitializing = false;
                return { success: true, state: null };
            }

            const userData = userSnap.data();

            // Load owned spaces
            const spacesRef = collection(this.db, 'users', this.user.uid, 'spaces');
            const spacesSnap = await getDocs(spacesRef);

            const spaces = [];
            spacesSnap.forEach(docSnap => {
                spaces.push({
                    id: docSnap.id,
                    ...docSnap.data(),
                    isOwned: true,
                    _cloudTimestamp: docSnap.data().lastModified?.toMillis?.() || Date.now(),
                    _lastSyncedLocal: Date.now()
                });
            });

            // Load shared spaces
            const sharedWithMe = userData.sharedWithMe || [];
            for (const shared of sharedWithMe) {
                try {
                    const sharedSpaceRef = doc(this.db, 'users', shared.ownerId, 'spaces', shared.spaceId);
                    const sharedSpaceSnap = await getDocFromServer(sharedSpaceRef);
                    if (sharedSpaceSnap.exists()) {
                        spaces.push({
                            id: shared.spaceId,
                            ...sharedSpaceSnap.data(),
                            isShared: true,
                            isOwned: false,
                            ownerId: shared.ownerId,
                            myRole: shared.role,
                            _cloudTimestamp: sharedSpaceSnap.data().lastModified?.toMillis?.() || Date.now()
                        });
                    }
                } catch (e) {
                    SyncLog.warn(`Could not load shared space: ${shared.spaceId}`, e.message);
                }
            }

            const cloudState = {
                spaces,
                sharedWithMe,
                tags: userData.tags || [],
                activeSpaceId: userData.activeSpaceId,

                shiftAmount: userData.settings?.shiftAmount ?? 5,
                ctrlAmount: userData.settings?.ctrlAmount ?? 10,
                autoArchive: userData.settings?.autoArchive ?? true
            };

            SyncLog.success(`Loaded ${spaces.length} space(s) from cloud`);
            this.lastSyncTime = Date.now();
            this.lastGlobalSyncedLocal = Date.now();
            this.setStatus('synced');
            this.isInitializing = false;

            return { success: true, state: cloudState };
        } catch (error) {
            SyncLog.error('Cloud load failed', error.message);
            this.setStatus('error');
            this.isInitializing = false;
            return { success: false, error: error.message };
        }
    }

    // -------------------------------------------------------------------------
    // Real-time Sync
    // -------------------------------------------------------------------------

    async start() {
        if (!this.isLoggedIn || !this.db) {
            SyncLog.warn('Cannot start sync: not logged in');
            return;
        }

        // Wait for auth token to be fully ready
        try {
            await this.user.getIdToken();
        } catch (error) {
            SyncLog.warn('Auth token not ready, delaying sync start');
            return;
        }

        // Stop existing listeners first
        this.stop();

        SyncLog.info('Starting real-time sync...');

        // Listen to user's own spaces
        const spacesRef = collection(this.db, 'users', this.user.uid, 'spaces');
        const unsubSpaces = onSnapshot(spacesRef, (snapshot) => {
            if (snapshot.metadata.hasPendingWrites) {
                SyncLog.debug('Ignoring own pending write');
                return;
            }

            const spaces = [];
            snapshot.forEach(docSnap => {
                spaces.push({
                    id: docSnap.id,
                    ...docSnap.data(),
                    isOwned: true,
                    _cloudTimestamp: docSnap.data().lastModified?.toMillis?.() || Date.now()
                });
            });

            this.notifyDataChange({ type: 'spaces', spaces });
        }, (error) => {
            SyncLog.error('Real-time listener error', error.message);
        });

        this.unsubscribers.push(unsubSpaces);

        // Setup shared space listeners
        await this.setupSharedSpaceListeners();

        SyncLog.success('Real-time sync active');
    }

    async setupSharedSpaceListeners() {
        if (!this.isLoggedIn || !this.db) return;

        try {
            const userDocRef = doc(this.db, 'users', this.user.uid);
            const userDocSnap = await getDoc(userDocRef);
            const userData = userDocSnap.data() || {};
            const sharedWithMe = userData.sharedWithMe || [];

            for (const shared of sharedWithMe) {
                const sharedSpaceRef = doc(this.db, 'users', shared.ownerId, 'spaces', shared.spaceId);
                const unsubShared = onSnapshot(sharedSpaceRef, (docSnap) => {
                    if (!docSnap.exists()) {
                        SyncLog.warn(`Shared space no longer exists: ${shared.spaceId}`);
                        return;
                    }

                    const spaceData = docSnap.data();
                    SyncLog.incoming(`Shared space updated: "${spaceData.name}"`);

                    this.notifyDataChange({
                        type: 'sharedSpaceUpdate',
                        space: {
                            id: shared.spaceId,
                            ...spaceData,
                            isShared: true,
                            isOwned: false,
                            ownerId: shared.ownerId,
                            myRole: shared.role,
                            _cloudTimestamp: spaceData.lastModified?.toMillis?.() || Date.now()
                        }
                    });
                }, (error) => {
                    SyncLog.warn(`Shared space listener error: ${shared.spaceId}`, error.message);
                });

                this.unsubscribers.push(unsubShared);
            }

            if (sharedWithMe.length > 0) {
                SyncLog.info(`Listening to ${sharedWithMe.length} shared space(s)`);
            }
        } catch (e) {
            SyncLog.warn('Could not setup shared space listeners', e.message);
        }
    }

    stop() {
        if (this.unsubscribers.length > 0) {
            SyncLog.info('Stopping real-time sync...');
            this.unsubscribers.forEach(unsub => unsub());
            this.unsubscribers = [];
        }
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        this.setStatus('idle');
    }

    // -------------------------------------------------------------------------
    // Debug
    // -------------------------------------------------------------------------
    getLogs() {
        return SyncLog.getHistory();
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const syncManager = new SyncManager();

// Expose for debugging in console
window.syncManager = syncManager;
window.SyncLog = SyncLog;
