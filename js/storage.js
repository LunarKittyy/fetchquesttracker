/**
 * Storage Module
 * Handles LocalStorage and Cloud sync operations
 */

import { state, syncActiveSpace, DEFAULT_CATEGORIES, STORAGE_KEY, setPendingLocalChange, pendingLocalChange } from './state.js';
import { normalizeItem } from './utils.js';
import { showAlert } from './popup.js';

// --- Module State ---
let cloudSyncTimeout = null;
let syncTimeInterval = null;

// DOM element references (set via init)
let elements = {
    saveIndicator: null,
    lastSynced: null,
    storageFill: null,
    storageText: null
};

let saveIndicatorTimeout = null;

// Callback references (set via init)
let renderSpacesCallback = null;
let updateSyncStatusUICallback = null;

/**
 * Initialize storage module with DOM elements and callbacks
 */
export function initStorage(domElements, callbacks) {
    elements = { ...elements, ...domElements };
    if (callbacks.renderSpaces) renderSpacesCallback = callbacks.renderSpaces;
    if (callbacks.updateSyncStatusUI) updateSyncStatusUICallback = callbacks.updateSyncStatusUI;
}

/**
 * Save state to both localStorage and cloud (if logged in)
 */
export function saveState() {
    saveStateLocal();
    // Mark that we have a pending local change
    setPendingLocalChange(true);
    // Auto-sync to cloud (debounced)
    if (window.FirebaseBridge?.currentUser) {
        debouncedCloudSync();
    }
}

/**
 * Save to localStorage only (no cloud sync)
 * Used for local preferences like activeSpaceId
 */
export function saveStateLocal() {
    try {
        // For logged-in users, strip base64 images to save localStorage space
        // (images are stored in Firebase Storage instead)
        if (window.FirebaseBridge?.currentUser) {
            const stateForLocal = JSON.parse(JSON.stringify(state));
            stateForLocal.spaces.forEach(space => {
                (space.items || []).forEach(item => {
                    if (item.imageUrl && item.imageUrl.startsWith('data:')) {
                        item.imageUrl = null; // Will be loaded from cloud
                    }
                    (item.objectives || []).forEach(obj => {
                        if (obj.imageUrl && obj.imageUrl.startsWith('data:')) {
                            obj.imageUrl = null;
                        }
                    });
                });
                (space.archivedItems || []).forEach(item => {
                    if (item.imageUrl && item.imageUrl.startsWith('data:')) {
                        item.imageUrl = null;
                    }
                });
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stateForLocal));
        } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }
        showSaveIndicator();
        // Update spaces progress live
        if (renderSpacesCallback) renderSpacesCallback();
    } catch (e) {
        console.error('Failed to save to localStorage:', e);
        // If quota exceeded, try saving without images
        if (e.name === 'QuotaExceededError') {
            try {
                const minimalState = JSON.parse(JSON.stringify(state));
                minimalState.spaces.forEach(space => {
                    (space.items || []).forEach(item => { item.imageUrl = null; });
                    (space.archivedItems || []).forEach(item => { item.imageUrl = null; });
                });
                localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalState));
                console.log('Saved without images due to quota');

                // Notify non-logged-in users about storage limits
                if (!window.FirebaseBridge?.currentUser) {
                    showAlert('⚠️ Storage limit reached!\n\nYour browser storage is full. Images have been removed to save your data.\n\nSign in to get cloud storage and keep your images safe!', 'STORAGE WARNING');
                }
            } catch (e2) {
                console.error('Still failed to save:', e2);
                // Critical error - notify user
                if (!window.FirebaseBridge?.currentUser) {
                    showAlert('❌ Storage full!\n\nUnable to save your data. Please sign in for cloud storage, or export your data and clear some quests.', 'STORAGE ERROR');
                }
            }
        }
    }
}

/**
 * Debounced cloud sync to prevent excessive API calls
 */
export function debouncedCloudSync() {
    if (cloudSyncTimeout) clearTimeout(cloudSyncTimeout);
    console.log('🔄 Cloud sync queued (2s debounce)');
    cloudSyncTimeout = setTimeout(async () => {
        if (!window.FirebaseBridge?.currentUser) {
            console.log('❌ No user, skipping sync');
            return;
        }

        // Check if user is hovering on a quest card - delay sync to prevent hover interruption
        // Skip this check on mobile since :hover doesn't work reliably and mouseleave never fires
        if (!window.FirebaseBridge?.isMobile) {
            const hoveredCard = document.querySelector('.quest-card:hover');
            if (hoveredCard) {
                console.log('🔄 Delaying sync (user hovering)');
                // Wait for hover to end, then retry
                hoveredCard.addEventListener('mouseleave', () => {
                    debouncedCloudSync();
                }, { once: true });
                return;
            }
        }

        console.log('🔄 Starting cloud sync...');
        if (updateSyncStatusUICallback) updateSyncStatusUICallback('syncing');
        const result = await window.FirebaseBridge.saveToCloud(state);
        console.log('🔄 Sync result:', result);
        if (result.success) {
            setPendingLocalChange(false); // Local changes are now synced
            window.FirebaseBridge.updateLastSyncTime();
            if (updateSyncStatusUICallback) updateSyncStatusUICallback('synced');
            updateLastSyncedDisplay();
            console.log('✅ Cloud sync complete');
        } else {
            if (updateSyncStatusUICallback) updateSyncStatusUICallback('error');
            console.error('❌ Cloud sync failed:', result.error);
        }
    }, 2000); // 2 second debounce
}

/**
 * Update the "last synced" display text
 */
export function updateLastSyncedDisplay() {
    if (elements.lastSynced && window.FirebaseBridge) {
        elements.lastSynced.textContent = window.FirebaseBridge.getRelativeSyncTime();
    }
    updateStorageDisplay();
}

/**
 * Update storage usage display bar
 */
export function updateStorageDisplay() {
    if (!window.FirebaseBridge || !elements.storageFill || !elements.storageText) return;
    const info = window.FirebaseBridge.getStorageInfo();

    // Update bar width
    elements.storageFill.style.width = `${info.percent}%`;

    // Update bar color based on usage
    elements.storageFill.className = 'storage-fill';
    if (info.percent >= 90) {
        elements.storageFill.classList.add('danger');
    } else if (info.percent >= 70) {
        elements.storageFill.classList.add('warning');
    }

    // Update text
    elements.storageText.textContent = `${info.usedMB} / ${info.limitMB} MB`;
}

/**
 * Show the save indicator briefly
 */
export function showSaveIndicator() {
    if (!elements.saveIndicator) return;
    if (saveIndicatorTimeout) {
        clearTimeout(saveIndicatorTimeout);
    }
    elements.saveIndicator.classList.add('visible');
    saveIndicatorTimeout = setTimeout(() => {
        elements.saveIndicator.classList.remove('visible');
    }, 1500);
}

/**
 * Load state from localStorage
 */
export function loadState() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        let parsed = stored ? JSON.parse(stored) : null;

        if (parsed) {
            // Ensure global settings are loaded
            state.soundEnabled = parsed.soundEnabled !== false;
            state.shiftAmount = parsed.shiftAmount || 5;
            state.ctrlAmount = parsed.ctrlAmount || 10;
            state.autoArchive = parsed.autoArchive !== false;

            if (parsed.spaces && Array.isArray(parsed.spaces) && parsed.spaces.length > 0) {
                state.spaces = parsed.spaces;
                state.activeSpaceId = parsed.activeSpaceId || state.spaces[0].id;
            } else {
                // Migration: Create first space from existing v2 data
                const defaultSpace = {
                    id: 'space-' + Date.now(),
                    name: 'MAIN',
                    color: '#4ecdb4',
                    items: parsed.items || [],
                    archivedItems: parsed.archivedItems || [],
                    categories: parsed.categories || [...DEFAULT_CATEGORIES]
                };
                state.spaces = [defaultSpace];
                state.activeSpaceId = defaultSpace.id;
                delete parsed.items;
                delete parsed.archivedItems;
                delete parsed.categories;
            }
        } else {
            // Initial State
            const defaultSpace = {
                id: 'space-' + Date.now(),
                name: 'MAIN',
                color: '#4ecdb4',
                items: [],
                archivedItems: [],
                categories: [...DEFAULT_CATEGORIES]
            };
            state.spaces = [defaultSpace];
            state.activeSpaceId = defaultSpace.id;
        }

        // Set active space pointer and sync top-level state for legacy code
        syncActiveSpace();

        // Load global tags (or migrate from space-level tags)
        if (Array.isArray(parsed?.tags)) {
            state.tags = parsed.tags;
        } else {
            // Migration: collect tags from all spaces into global tags array
            const seenTagIds = new Set();
            state.tags = [];
            state.spaces.forEach(space => {
                if (Array.isArray(space.tags)) {
                    space.tags.forEach(tag => {
                        if (!seenTagIds.has(tag.id)) {
                            seenTagIds.add(tag.id);
                            state.tags.push(tag);
                        }
                    });
                    // Clear space-level tags after migration
                    delete space.tags;
                }
            });
        }

        // Normalize items across all spaces
        state.spaces.forEach(space => {
            space.items = (space.items || []).map(item => normalizeItem(item));
            space.archivedItems = (space.archivedItems || []).map(item => normalizeItem(item));
        });

    } catch (e) {
        console.error('Failed to load from localStorage:', e);
        const defaultSpace = {
            id: 'space-' + Date.now(),
            name: 'MAIN',
            color: '#4ecdb4',
            items: [],
            archivedItems: [],
            categories: [...DEFAULT_CATEGORIES]
        };
        state.spaces.length = 0;
        state.spaces.push(defaultSpace);
        state.activeSpaceId = defaultSpace.id;
        state.tags = [];
        state.soundEnabled = false;
        state.shiftAmount = 5;
        state.ctrlAmount = 10;
        state.autoArchive = true;
        syncActiveSpace();
    }
}

/**
 * Export data as JSON file download
 */
export function exportData() {
    if (state.items.length === 0) return;

    const exportObj = {
        version: 2,
        exportedAt: new Date().toISOString(),
        categories: state.categories,
        items: state.items
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObj, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `fetch_quest_backup_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
}

/**
 * Import data from JSON file
 * @param {File} file - The file to import
 * @param {Function} callbacks - Object with render, sortItems callbacks
 */
export function importData(file, callbacks = {}) {
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);

            // Handle both v1 (array) and v2 (object) formats
            let importedItems = [];
            let importedCategories = [];

            if (Array.isArray(data)) {
                // v1 format
                importedItems = data;
            } else if (data.items) {
                // v2 format
                importedItems = data.items;
                importedCategories = data.categories || [];
            }

            // Add imported items
            importedItems.forEach(item => {
                const normalized = normalizeItem({
                    ...item,
                    id: undefined, // Will be generated
                    createdAt: Date.now()
                });
                state.items.push(normalized);
            });

            // Merge categories
            importedCategories.forEach(cat => {
                if (!state.categories.includes(cat)) {
                    state.categories.push(cat);
                }
            });

            if (callbacks.sortItems) callbacks.sortItems();
            saveState();
            if (callbacks.render) callbacks.render();

        } catch (err) {
            console.error('Import failed:', err);
            showAlert('Failed to import data. Please ensure the file is valid JSON.', 'IMPORT ERROR');
        }
    };
    reader.readAsText(file);
}

/**
 * Start the sync time update interval
 */
export function startSyncTimeInterval() {
    if (syncTimeInterval) clearInterval(syncTimeInterval);
    syncTimeInterval = setInterval(updateLastSyncedDisplay, 10000); // Update every 10s
}

/**
 * Stop the sync time update interval
 */
export function stopSyncTimeInterval() {
    if (syncTimeInterval) {
        clearInterval(syncTimeInterval);
        syncTimeInterval = null;
    }
}
