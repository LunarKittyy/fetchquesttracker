/**
 * Context Menu Module
 * Custom right-click context menus for spaces and quests
 */

import { state } from './state.js';
import { $ } from './utils.js';
import { showConfirm } from './popup.js';

// Module state
let contextMenuTarget = null;
let elements = {
    contextMenu: null
};

// Callbacks
let openSpaceEditModalCallback = null;
let handleDeleteSpaceCallback = null;
let archiveItemCallback = null;
let deleteItemCallback = null;
let editTagsCallback = null;
let shareSpaceCallback = null;

/**
 * Initialize context menu module
 */
export function initContextMenu(domElements, callbacks) {
    elements = { ...elements, ...domElements };
    if (callbacks.openSpaceEditModal) openSpaceEditModalCallback = callbacks.openSpaceEditModal;
    if (callbacks.handleDeleteSpace) handleDeleteSpaceCallback = callbacks.handleDeleteSpace;
    if (callbacks.archiveItem) archiveItemCallback = callbacks.archiveItem;
    if (callbacks.deleteItem) deleteItemCallback = callbacks.deleteItem;
    if (callbacks.editTags) editTagsCallback = callbacks.editTags;
    if (callbacks.shareSpace) shareSpaceCallback = callbacks.shareSpace;
}

/**
 * Show context menu at cursor position
 * @param {Event} e - The contextmenu event
 * @param {Array} menuItems - Array of menu item objects
 */
export function showContextMenu(e, menuItems) {
    e.preventDefault();
    if (!elements.contextMenu) return;

    // Build menu HTML
    const menuContainer = elements.contextMenu.querySelector('.context-menu-items');
    menuContainer.innerHTML = menuItems.map(item => {
        if (item.divider) return '<div class="context-menu-divider"></div>';
        return `
            <button class="context-menu-item ${item.danger ? 'danger' : ''}" data-action="${item.action}">
                ${item.icon || ''}
                <span>${item.label}</span>
            </button>
        `;
    }).join('');

    // Position menu
    const x = e.clientX;
    const y = e.clientY;

    elements.contextMenu.style.left = x + 'px';
    elements.contextMenu.style.top = y + 'px';
    elements.contextMenu.classList.remove('hidden');

    // Adjust if menu goes off screen
    const rect = elements.contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        elements.contextMenu.style.left = (x - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        elements.contextMenu.style.top = (y - rect.height) + 'px';
    }
}

/**
 * Hide the context menu
 */
export function hideContextMenu() {
    if (elements.contextMenu) {
        elements.contextMenu.classList.add('hidden');
    }
    contextMenuTarget = null;
}

/**
 * Handle right-click on space tab
 * @param {Event} e - The contextmenu event
 */
export function handleSpaceContextMenu(e) {
    const spaceTab = e.target.closest('.space-tab');
    if (!spaceTab) return;

    const spaceId = spaceTab.dataset.id;
    const space = (state.spaces || []).find(s => s.id === spaceId);
    if (!space) return;

    contextMenuTarget = { type: 'space', id: spaceId, data: space };

    const isSharedSpace = space.isOwned === false;

    const menuItems = [
        {
            label: isSharedSpace ? 'View Space' : 'Edit Space',
            action: 'edit-space',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
        }
    ];

    // Only show Share option for owned spaces
    if (!isSharedSpace) {
        menuItems.push({
            label: 'Share Space',
            action: 'share-space',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>'
        });
    }

    menuItems.push({ divider: true });
    menuItems.push({
        label: isSharedSpace ? 'Leave Space' : 'Delete Space',
        action: 'delete-space',
        danger: !isSharedSpace,
        icon: isSharedSpace
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
    });

    showContextMenu(e, menuItems);
}

/**
 * Handle right-click on quest card
 * @param {Event} e - The contextmenu event
 */
export function handleQuestContextMenu(e) {
    const card = e.target.closest('.quest-card');
    if (!card) return;

    const itemId = card.dataset.id;
    const item = (state.items || []).find(i => i.id === itemId);
    if (!item) return;

    contextMenuTarget = { type: 'quest', id: itemId, data: item };

    const isSharedSpace = item.isOwned === false;
    let menuItems;

    if (isSharedSpace) {
        // Viewers can only copy ID/JSON
        menuItems = [
            { label: 'Copy ID', action: 'copy-id', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' },
            { label: 'Copy JSON', action: 'copy-json', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>' }
        ];
    } else {
        // Owners/Editors get full options
        menuItems = [
            { label: 'Copy ID', action: 'copy-id', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' },
            { label: 'Copy JSON', action: 'copy-json', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>' },
            { divider: true },
            { label: 'Delete', action: 'delete-quest', danger: true, icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' }
        ];
    }
    showContextMenu(e, menuItems);
}

/**
 * Handle context menu item click
 * @param {Event} e - Click event
 */
export function handleContextMenuAction(e) {
    const item = e.target.closest('.context-menu-item');
    if (!item) return;

    const action = item.dataset.action;
    if (!contextMenuTarget) return;

    // Save target before hiding (hideContextMenu sets contextMenuTarget to null)
    const target = contextMenuTarget;
    hideContextMenu();

    switch (action) {
        case 'edit-space':
            if (target.type === 'space' && openSpaceEditModalCallback) {
                openSpaceEditModalCallback(target.id);
            }
            break;
        case 'delete-space':
            if (target.type === 'space' && handleDeleteSpaceCallback) {
                $('#edit-space-id').value = target.id;
                handleDeleteSpaceCallback();
            }
            break;
        case 'share-space':
            if (target.type === 'space' && shareSpaceCallback) {
                shareSpaceCallback(target.id);
            }
            break;
        case 'edit-name':
            if (target.type === 'quest') {
                const card = $(`.quest-card[data-id="${target.id}"]`);
                const nameEl = card?.querySelector('.quest-name-text');
                if (nameEl) nameEl.click();
                if (nameEl) nameEl.click();
            }
            break;
        case 'edit-category':
            if (target.type === 'quest') {
                import('./quest-events.js').then(module => {
                    module.startCategoryEdit(target.id);
                });
            }
            break;
        case 'archive-quest':
            if (target.type === 'quest' && archiveItemCallback) {
                archiveItemCallback(target.id);
            }
            break;
        case 'edit-tags':
            if (target.type === 'quest' && editTagsCallback) {
                editTagsCallback(target.id);
            }
            break;
        case 'delete-quest':
            if (target.type === 'quest' && deleteItemCallback) {
                showConfirm('Remove this target?', 'DELETE ITEM', true).then(confirmed => {
                    if (confirmed) deleteItemCallback(target.id);
                });
            }
            break;
    }
}

/**
 * Get current context menu target
 * @returns {Object|null}
 */
export function getContextMenuTarget() {
    return contextMenuTarget;
}
