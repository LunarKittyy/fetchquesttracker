/**
 * Bulk Operations Module
 * Multi-select mode for mass archive/delete
 */

import { state, selectedItems, clearSelectedItems, addSelectedItem, removeSelectedItem, setBulkMode, bulkMode } from './state.js';
import { $$ } from './utils.js';
import { saveState } from './storage.js';

// DOM elements
let elements = {
    btnBulkMode: null,
    bulkActionsBar: null,
    bulkCount: null
};

// Callbacks
let renderCallback = null;
let renderArchiveCallback = null;

/**
 * Initialize bulk module
 */
export function initBulk(domElements, callbacks) {
    elements = { ...elements, ...domElements };
    if (callbacks.render) renderCallback = callbacks.render;
    if (callbacks.renderArchive) renderArchiveCallback = callbacks.renderArchive;
}

/**
 * Toggle bulk selection mode
 */
export function toggleBulkMode() {
    const newMode = !bulkMode;
    setBulkMode(newMode);
    document.body.classList.toggle('bulk-mode', newMode);
    if (elements.btnBulkMode) elements.btnBulkMode.classList.toggle('active', newMode);
    if (elements.bulkActionsBar) elements.bulkActionsBar.classList.toggle('hidden', !newMode);

    if (!newMode) {
        exitBulkMode();
    } else {
        clearSelectedItems();
        updateBulkCount();
    }
}

/**
 * Exit bulk mode and clear selections
 */
export function exitBulkMode() {
    setBulkMode(false);
    document.body.classList.remove('bulk-mode');
    if (elements.btnBulkMode) elements.btnBulkMode.classList.remove('active');
    if (elements.bulkActionsBar) elements.bulkActionsBar.classList.add('hidden');
    clearSelectedItems();
    $$('.quest-card.selected').forEach(card => card.classList.remove('selected'));
}

/**
 * Update bulk selection count display
 */
export function updateBulkCount() {
    if (elements.bulkCount) {
        elements.bulkCount.textContent = selectedItems.size;
    }
}

/**
 * Handle clicking on a card in bulk mode
 * @param {HTMLElement} card - The quest card element
 */
export function handleBulkCardClick(card) {
    const itemId = card.dataset.id;
    if (selectedItems.has(itemId)) {
        removeSelectedItem(itemId);
        card.classList.remove('selected');
    } else {
        addSelectedItem(itemId);
        card.classList.add('selected');
    }
    updateBulkCount();
}

/**
 * Archive all selected items
 */
export function bulkArchiveItems() {
    const itemsToArchive = [...selectedItems];

    itemsToArchive.forEach(itemId => {
        const itemIndex = state.items.findIndex(i => i.id === itemId);
        if (itemIndex !== -1) {
            const [archivedItem] = state.items.splice(itemIndex, 1);
            archivedItem.archivedAt = Date.now();
            state.archivedItems.push(archivedItem);
        }
    });

    saveState();
    exitBulkMode();
    if (renderCallback) renderCallback();
    if (renderArchiveCallback) renderArchiveCallback();
}

/**
 * Delete all selected items permanently
 */
export function bulkDeleteItems() {
    const itemsToDelete = [...selectedItems];

    itemsToDelete.forEach(itemId => {
        const itemIndex = state.items.findIndex(i => i.id === itemId);
        if (itemIndex !== -1) {
            state.items.splice(itemIndex, 1);
        }
    });

    saveState();
    exitBulkMode();
    if (renderCallback) renderCallback();
}

/**
 * Select all visible items
 */
export function selectAllItems() {
    const cards = $$('.quest-card');
    cards.forEach(card => {
        const itemId = card.dataset.id;
        addSelectedItem(itemId);
        card.classList.add('selected');
    });
    updateBulkCount();
}
