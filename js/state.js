/**
 * State Management Module
 * Central state and constants for the Quest Tracker
 */

// --- Constants ---
export const STORAGE_KEY = 'fetchquest_data_v2';
export const DEFAULT_CATEGORIES = ['Misc', 'Main Quest', 'Side Quest', 'Crafting', 'Collectibles'];

// --- State ---
export const state = {
    spaces: [],
    activeSpaceId: null,
    tags: [],  // Global tags (cross-space)
    soundEnabled: false,
    shiftAmount: 5,
    ctrlAmount: 10,
    autoArchive: true,
    multiColumn: false
};

// Active space pointer (for compatibility with existing code)
let activeSpace = null;

/**
 * Get the currently active space
 * @returns {Object|null} The active space object
 */
export function getActiveSpace() {
    return activeSpace;
}

/**
 * Set the active space pointer
 * @param {Object} space - The space to set as active
 */
export function setActiveSpace(space) {
    activeSpace = space;
}

/**
 * Sync the active space pointer with state
 * Sets up property descriptors for backward compatibility
 */
export function syncActiveSpace() {
    // Find the active space, or fallback to the first space
    activeSpace = state.spaces.find(s => s.id === state.activeSpaceId) || state.spaces[0];

    // If no spaces exist at all, create a default one
    if (!activeSpace) {
        const defaultSpace = {
            id: 'space-' + Date.now(),
            name: 'MAIN',
            color: '#4ecdb4',
            items: [],
            archivedItems: [],
            categories: [...DEFAULT_CATEGORIES]
        };
        state.spaces = [defaultSpace];
        activeSpace = defaultSpace;
    }

    state.activeSpaceId = activeSpace.id;

    // Expose items/archivedItems/categories at top level of state for existing code compatibility
    // Using Object.defineProperty to keep them in sync with activeSpace
    Object.defineProperty(state, 'items', {
        get: () => activeSpace ? activeSpace.items : [],
        set: (val) => { if (activeSpace) activeSpace.items = val; },
        configurable: true
    });
    Object.defineProperty(state, 'archivedItems', {
        get: () => activeSpace ? activeSpace.archivedItems : [],
        set: (val) => { if (activeSpace) activeSpace.archivedItems = val; },
        configurable: true
    });
    Object.defineProperty(state, 'categories', {
        get: () => activeSpace ? activeSpace.categories : [...DEFAULT_CATEGORIES],
        set: (val) => { if (activeSpace) activeSpace.categories = val; },
        configurable: true
    });
}

// --- UI State (not persisted) ---
export let currentType = 'item';
export let tempObjectives = [];
export let tempImageData = null;
export let searchQuery = '';
export let bulkMode = false;
export let selectedItems = new Set();
export let pendingLocalChange = false;
export let isInitialSyncInProgress = false;
export let selectedTags = []; // Tags selected in form

// Setters for mutable UI state
export function setCurrentType(type) { currentType = type; }
export function setTempObjectives(objectives) { tempObjectives = objectives; }
export function setTempImageData(data) { tempImageData = data; }
export function setSearchQuery(query) { searchQuery = query; }
export function setBulkMode(mode) { bulkMode = mode; }
export function clearSelectedItems() { selectedItems.clear(); }
export function addSelectedItem(id) { selectedItems.add(id); }
export function removeSelectedItem(id) { selectedItems.delete(id); }
export function setPendingLocalChange(val) { pendingLocalChange = val; }
export function setInitialSyncInProgress(val) { isInitialSyncInProgress = val; }
export function setSelectedTags(tags) { selectedTags = tags; }
export function clearSelectedTags() { selectedTags = []; }
