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
    const space = state.spaces.find(s => s.id === spaceId);
    if (!space) return;

    contextMenuTarget = { type: 'space', id: spaceId, data: space };

    const menuItems = [
        {
            label: 'Edit Space',
            action: 'edit-space',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
        },
        { divider: true },
        {
            label: 'Delete Space',
            action: 'delete-space',
            danger: true,
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
        }
    ];

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
    const item = state.items.find(i => i.id === itemId);
    if (!item) return;

    contextMenuTarget = { type: 'quest', id: itemId, data: item };

    const menuItems = [
        {
            label: 'Edit Name',
            action: 'edit-name',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
        },
        {
            label: 'Edit Tags',
            action: 'edit-tags',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>'
        },
        {
            label: 'Archive',
            action: 'archive-quest',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>'
        },
        { divider: true },
        {
            label: 'Delete',
            action: 'delete-quest',
            danger: true,
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
        }
    ];

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
        case 'edit-name':
            if (target.type === 'quest') {
                const card = $(`.quest-card[data-id="${target.id}"]`);
                const nameEl = card?.querySelector('.quest-name-text');
                if (nameEl) nameEl.click();
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
