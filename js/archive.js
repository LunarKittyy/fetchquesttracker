/**
 * Archive Module
 * Handles archive panel functionality
 */

import { state } from './state.js';
import { $, escapeHtml, getTimeAgo } from './utils.js';
import { saveState } from './storage.js';
import { showConfirm } from './popup.js';

// Callback references
let insertItemIntoDOMCallback = null;
let cleanupEmptyCategoryCallback = null;
let updateCategoryProgressCallback = null;
let updateStatusBarCallback = null;

// DOM elements
let elements = {
    archivePanel: null,
    archiveContainer: null,
    archiveCount: null
};

/**
 * Initialize archive module
 */
export function initArchive(domElements, callbacks) {
    elements = { ...elements, ...domElements };
    if (callbacks.insertItemIntoDOM) insertItemIntoDOMCallback = callbacks.insertItemIntoDOM;
    if (callbacks.cleanupEmptyCategory) cleanupEmptyCategoryCallback = callbacks.cleanupEmptyCategory;
    if (callbacks.updateCategoryProgress) updateCategoryProgressCallback = callbacks.updateCategoryProgress;
    if (callbacks.updateStatusBar) updateStatusBarCallback = callbacks.updateStatusBar;
}

/**
 * Toggle archive panel open/closed
 */
export function handleArchiveToggle() {
    if (elements.archivePanel) {
        elements.archivePanel.classList.toggle('open');
    }
}

/**
 * Archive an item by moving it to archivedItems
 * @param {string} itemId - ID of item to archive
 */
export function archiveItem(itemId) {
    // Try current space first, then search all spaces (for cross-space search results)
    let itemIndex = state.items.findIndex(i => i.id === itemId);
    let targetSpace = null;
    
    if (itemIndex === -1) {
        // Search all spaces
        for (const space of state.spaces) {
            const idx = space.items.findIndex(i => i.id === itemId);
            if (idx !== -1) {
                itemIndex = idx;
                targetSpace = space;
                break;
            }
        }
    }
    if (itemIndex === -1) return;

    const items = targetSpace ? targetSpace.items : state.items;
    const archivedItems = targetSpace ? targetSpace.archivedItems : state.archivedItems;
    
    const item = items[itemIndex];
    item.archivedAt = Date.now();
    archivedItems.unshift(item);
    items.splice(itemIndex, 1);
    saveState();

    // Remove from DOM
    const card = $(`.quest-card[data-id="${itemId}"]`);
    if (card) {
        card.style.transform = 'translateX(100%)';
        card.style.opacity = '0';
        setTimeout(() => {
            card.remove();
            if (cleanupEmptyCategoryCallback) cleanupEmptyCategoryCallback(item.category);
            if (updateCategoryProgressCallback) updateCategoryProgressCallback(item.category);
        }, 300);
    }

    renderArchive();
    if (updateStatusBarCallback) updateStatusBarCallback();
}

/**
 * Restore an archived item back to active items
 * @param {string} itemId - ID of item to restore
 */
export function restoreItem(itemId) {
    const itemIndex = state.archivedItems.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return;

    const item = state.archivedItems[itemIndex];
    delete item.archivedAt;
    // Reset progress to allow re-tracking
    if (item.type === 'item') {
        item.current = 0;
    } else {
        item.objectives.forEach(obj => {
            obj.current = 0;
            obj.complete = false;
        });
    }
    item.completedAt = null;

    state.items.push(item);
    state.archivedItems.splice(itemIndex, 1);
    saveState();

    if (insertItemIntoDOMCallback) insertItemIntoDOMCallback(item);
    renderArchive();
    if (updateStatusBarCallback) updateStatusBarCallback();
}

/**
 * Permanently delete an archived item
 * @param {string} itemId - ID of item to delete
 */
export function deleteArchivedItem(itemId) {
    const itemIndex = state.archivedItems.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return;

    const item = state.archivedItems[itemIndex];

    // Delete images from Firebase Storage if user is logged in and item has storage images
    // Note: Images stay in 'items' folder even when archived, so use 'items' prefix
    if (window.FirebaseBridge?.currentUser && item.imageUrl) {
        if (window.FirebaseBridge.isStorageUrl(item.imageUrl)) {
            window.FirebaseBridge.deleteItemImages(state.activeSpaceId, item.id, 'items')
                .then(async result => {
                    if (result.success && result.deletedCount > 0) {
                        console.log(`🗑️ Cleaned up ${result.deletedCount} storage file(s) for deleted archived item`);
                        // Refresh storage display after Cloud Functions update
                        setTimeout(async () => {
                            await window.FirebaseBridge.fetchStorageUsage();
                            const { updateStorageDisplay } = await import('./storage.js');
                            updateStorageDisplay();
                        }, 1500);
                    }
                })
                .catch(err => console.warn('Could not cleanup storage files:', err));
        }
    }

    state.archivedItems.splice(itemIndex, 1);
    saveState();
    renderArchive();
}

/**
 * Delete all archived items
 */
export async function deleteAllArchived() {
    if (state.archivedItems.length === 0) return;

    const confirmed = await showConfirm(`Delete all ${state.archivedItems.length} archived items? This cannot be undone.`, 'CLEAR ARCHIVE', true);
    if (!confirmed) return;

    // Delete images from Firebase Storage for all archived items with storage images
    // Note: Images stay in 'items' folder even when archived, so use 'items' prefix
    if (window.FirebaseBridge?.currentUser) {
        const itemsWithStorageImages = state.archivedItems.filter(
            item => item.imageUrl && window.FirebaseBridge.isStorageUrl(item.imageUrl)
        );
        
        // Delete in background, don't block the UI
        if (itemsWithStorageImages.length > 0) {
            Promise.all(
                itemsWithStorageImages.map(item =>
                    window.FirebaseBridge.deleteItemImages(state.activeSpaceId, item.id, 'items')
                )
            ).then(async results => {
                const totalDeleted = results.reduce((sum, r) => sum + (r.deletedCount || 0), 0);
                if (totalDeleted > 0) {
                    console.log(`🗑️ Cleaned up ${totalDeleted} storage file(s) from ${itemsWithStorageImages.length} archived items`);
                    // Refresh storage display after Cloud Functions update
                    setTimeout(async () => {
                        await window.FirebaseBridge.fetchStorageUsage();
                        const { updateStorageDisplay } = await import('./storage.js');
                        updateStorageDisplay();
                    }, 1500);
                }
            }).catch(err => console.warn('Could not cleanup storage files:', err));
        }
    }

    state.archivedItems = [];
    saveState();
    renderArchive();
}

/**
 * Render the archive panel contents
 */
export function renderArchive() {
    const container = elements.archiveContainer;
    if (!container || !elements.archiveCount) return;

    elements.archiveCount.textContent = state.archivedItems.length;

    if (state.archivedItems.length === 0) {
        container.innerHTML = `
            <div class="archive-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 12l2 2 4-4"/>
                    <circle cx="12" cy="12" r="10"/>
                </svg>
                <p>No completed quests yet</p>
            </div>
        `;
        return;
    }

    // Add delete all button at top
    let html = `
        <button class="btn btn-danger archive-delete-all" data-action="delete-all" style="margin-bottom: 1rem; width: 100%;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            DELETE ALL
        </button>
    `;

    html += state.archivedItems.map(item => {
        const timeAgo = getTimeAgo(item.archivedAt || item.completedAt);
        const imageHTML = item.imageUrl
            ? `<img src="${escapeHtml(item.imageUrl)}" class="archive-card-image" alt="">`
            : '';
        return `
            <div class="archive-card" data-id="${item.id}">
                ${imageHTML}
                <div class="archive-card-info">
                    <div class="archive-card-name">${escapeHtml(item.name)}</div>
                    <div class="archive-card-meta">
                        <span>${escapeHtml(item.category)}</span>
                        <span>•</span>
                        <span>${timeAgo}</span>
                    </div>
                </div>
                <button class="archive-card-restore" data-action="restore" title="Restore to active">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="1 4 1 10 7 10"/>
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                    </svg>
                </button>
                <button class="archive-card-delete" data-action="delete" title="Delete permanently">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

/**
 * Handle archive panel actions (restore, delete, delete-all)
 * @param {Event} e - Click event
 */
export function handleArchiveAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;

    // Handle delete all (not in a card)
    if (action === 'delete-all') {
        deleteAllArchived();
        return;
    }

    const card = btn.closest('.archive-card');
    if (!card) return;
    const itemId = card.dataset.id;

    if (action === 'restore') {
        restoreItem(itemId);
    } else if (action === 'delete') {
        deleteArchivedItem(itemId);
    }
}
