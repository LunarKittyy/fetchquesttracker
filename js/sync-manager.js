/**
 * SyncManager - Unified sync layer for FetchQuest
 * Handles all cloud synchronization with Firestore
 */

import {
    doc, setDoc, getDoc, getDocFromServer, collection, getDocs,
    writeBatch, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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

        // Update debug overlay if active
        if (debugOverlay) updateDebugOverlay();
    },

    debug(msg, data) { this._log('DEBUG', '🔍', msg, data); },
    info(msg, data) { this._log('INFO', '▶', msg, data); },
    success(msg, data) { this._log('INFO', '✓', msg, data); },
    warn(msg, data) { this._log('WARN', '⚠', msg, data); },
    error(msg, data) { this._log('ERROR', '✗', msg, data); },
    incoming(msg, data) { this._log('INFO', '◀', msg, data); },

    getHistory() { return [...logHistory]; }
};

// ============================================================================
// DEBUG OVERLAY
// ============================================================================

let debugOverlay = null;

function createDebugOverlay() {
    if (debugOverlay) return debugOverlay;

    const overlay = document.createElement('div');
    overlay.id = 'sync-debug-overlay';
    overlay.innerHTML = `
        <style>
            #sync-debug-overlay {
                position: fixed;
                bottom: 16px;
                right: 16px;
                width: 320px;
                max-height: 300px;
                background: rgba(0, 0, 0, 0.9);
                color: #0f0;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 11px;
                border-radius: 8px;
                padding: 12px;
                z-index: 99999;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            }
            #sync-debug-overlay .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                padding-bottom: 8px;
                border-bottom: 1px solid #333;
            }
            #sync-debug-overlay .status {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            #sync-debug-overlay .status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #666;
            }
            #sync-debug-overlay .status-dot.idle { background: #666; }
            #sync-debug-overlay .status-dot.syncing { background: #ff0; animation: pulse 1s infinite; }
            #sync-debug-overlay .status-dot.synced { background: #0f0; }
            #sync-debug-overlay .status-dot.error { background: #f00; }
            #sync-debug-overlay .status-dot.offline { background: #f80; }
            @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
            #sync-debug-overlay .close-btn {
                background: none;
                border: none;
                color: #666;
                cursor: pointer;
                font-size: 14px;
            }
            #sync-debug-overlay .close-btn:hover { color: #fff; }
            #sync-debug-overlay .stats {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 4px;
                margin-bottom: 8px;
                font-size: 10px;
                color: #888;
            }
            #sync-debug-overlay .logs {
                max-height: 180px;
                overflow-y: auto;
                font-size: 10px;
            }
            #sync-debug-overlay .log-entry {
                padding: 2px 0;
                border-bottom: 1px solid #222;
            }
            #sync-debug-overlay .log-entry.WARN { color: #ff0; }
            #sync-debug-overlay .log-entry.ERROR { color: #f00; }
        </style>
        <div class="header">
            <div class="status">
                <div class="status-dot" id="sync-status-dot"></div>
                <span id="sync-status-text">Idle</span>
            </div>
            <button class="close-btn" onclick="this.closest('#sync-debug-overlay').remove()">×</button>
        </div>
        <div class="stats">
            <div>Last sync: <span id="sync-last-time">Never</span></div>
            <div>Pending: <span id="sync-pending">0</span></div>
        </div>
        <div class="logs" id="sync-logs"></div>
    `;
    document.body.appendChild(overlay);
    debugOverlay = overlay;
    return overlay;
}

function updateDebugOverlay() {
    if (!debugOverlay) return;

    const statusDot = debugOverlay.querySelector('#sync-status-dot');
    const statusText = debugOverlay.querySelector('#sync-status-text');
    const lastTime = debugOverlay.querySelector('#sync-last-time');
    const pending = debugOverlay.querySelector('#sync-pending');
    const logsEl = debugOverlay.querySelector('#sync-logs');

    if (statusDot && syncManagerInstance) {
        statusDot.className = `status-dot ${syncManagerInstance.status}`;
        statusText.textContent = syncManagerInstance.status.charAt(0).toUpperCase() + syncManagerInstance.status.slice(1);
        lastTime.textContent = syncManagerInstance.lastSyncTime
            ? new Date(syncManagerInstance.lastSyncTime).toLocaleTimeString()
            : 'Never';
        pending.textContent = syncManagerInstance.pendingChanges ? 'Yes' : 'No';
    }

    if (logsEl) {
        logsEl.innerHTML = logHistory.slice(-15).map(entry =>
            `<div class="log-entry ${entry.level}">
                <span style="color:#666">${entry.time}</span> ${entry.icon} ${entry.msg}
            </div>`
        ).join('');
        logsEl.scrollTop = logsEl.scrollHeight;
    }
}

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
        this.saveDebounceMs = 2000;
        this.isInitializing = false;

        // Singleton
        if (syncManagerInstance) {
            SyncLog.warn('SyncManager already exists, returning existing instance');
            return syncManagerInstance;
        }
        syncManagerInstance = this;

        // Check for debug mode
        if (new URLSearchParams(window.location.search).has('sync-debug')) {
            this.enableDebugOverlay();
        }

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
        if (debugOverlay) updateDebugOverlay();
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
        if (this.pendingChanges) {
            SyncLog.debug('Skipping notification (pending local changes)');
            return;
        }
        if (this.isInitializing) {
            SyncLog.debug('Skipping notification (initializing)');
            return;
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
        if (debugOverlay) updateDebugOverlay();

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

        const startTime = Date.now();
        const batch = writeBatch(this.db);
        let savedCount = 0;
        let globalSaved = false;

        // Check if global settings need saving
        const globalMod = state._localModified || 0;
        const lastGlobalSync = this.lastGlobalSyncedLocal || 0;

        if (!this.lastSyncTime || globalMod > lastGlobalSync) {
            const userRef = doc(this.db, 'users', this.user.uid);
            batch.set(userRef, {
                email: this.user.email,
                displayName: this.user.displayName || '',
                settings: {
                    soundEnabled: state.soundEnabled,
                    shiftAmount: state.shiftAmount,
                    ctrlAmount: state.ctrlAmount,
                    autoArchive: state.autoArchive
                },
                tags: state.tags || [],
                activeSpaceId: state.activeSpaceId,
                lastModified: serverTimestamp()
            }, { merge: true });
            globalSaved = true;
            this._syncingGlobalTimestamp = globalMod;
        }

        // Check each owned space for changes
        for (const space of state.spaces) {
            // Skip shared spaces - only save owned spaces
            if (space.isShared === true || space.isOwned === false) continue;

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

            const spaceRef = doc(this.db, 'users', this.user.uid, 'spaces', space.id);
            batch.set(spaceRef, {
                name: space.name,
                color: space.color,
                items: processedItems,
                archivedItems: processedArchived,
                categories: space.categories || [],
                collaborators: space.collaborators || null,
                lastModified: serverTimestamp()
            });

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

            // Delay clearing pendingChanges to allow onSnapshot to fire with our data
            setTimeout(() => {
                this.pendingChanges = false;
                if (debugOverlay) updateDebugOverlay();
            }, 500);

            return { success: true };
        } catch (error) {
            SyncLog.error('Cloud save failed', error.message);
            this.setStatus('error');
            // Clean up markers
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
                soundEnabled: userData.settings?.soundEnabled ?? false,
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

    enableDebugOverlay() {
        createDebugOverlay();
        SyncLog.info('Debug overlay enabled');
    }

    disableDebugOverlay() {
        if (debugOverlay) {
            debugOverlay.remove();
            debugOverlay = null;
        }
    }

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
