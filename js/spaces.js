/**
 * Spaces Management Module
 * Handles space creation, editing, switching
 */

import { state, syncActiveSpace, DEFAULT_CATEGORIES, isViewOnly } from './state.js';
import { $, $$, escapeHtml, getItemProgress } from './utils.js';
import { saveState, saveStateLocal } from './storage.js';
import { showConfirm, showAlert } from './popup.js';
import { playSound } from './particles.js';

// Callback references (set via init)
let renderCallback = null;
let renderArchiveCallback = null;
let updateCategoryDropdownCallback = null;

/**
 * Initialize spaces module with callbacks
 */
export function initSpaces(callbacks) {
    if (callbacks.render) renderCallback = callbacks.render;
    if (callbacks.renderArchive) renderArchiveCallback = callbacks.renderArchive;
    if (callbacks.updateCategoryDropdown) updateCategoryDropdownCallback = callbacks.updateCategoryDropdown;
}

/**
 * Render the spaces sidebar
 */
export function renderSpaces() {
    const list = $('#spaces-list');
    if (!list) return;

    list.innerHTML = state.spaces.map(space => {
        const isActive = space.id === state.activeSpaceId;
        const progress = calculateSpaceProgress(space);
        const isShared = space.isOwned === false;
        const roleLabel = space.myRole === 'editor' ? 'E' : 'V';

        return `
            <div class="space-tab ${isActive ? 'active' : ''} ${isShared ? 'shared-space' : ''}" 
                 data-id="${space.id}" 
                 data-owner-id="${space.ownerId || ''}"
                 style="--space-color: ${space.color || 'var(--clr-accent-primary)'}">
                <div class="space-progress" title="Completion: ${Math.round(progress)}%">
                    <div class="space-progress-fill" style="height: ${progress}%"></div>
                </div>
                <button class="space-tab-button" title="${escapeHtml(space.name)}${isShared ? ' (Shared)' : ''}">
                    ${isShared ? '<span class="space-shared-icon" title="Shared with you">⤵</span>' : ''}
                    ${escapeHtml(space.name)}
                    ${isShared ? `<span class="space-role-badge" title="${space.myRole}">${roleLabel}</span>` : ''}
                </button>
            </div>
        `;
    }).join('');
}

/**
 * Calculate overall progress percentage for a space
 * @param {Object} space - The space object
 * @returns {number} Progress percentage (0-100)
 */
export function calculateSpaceProgress(space) {
    const items = space.items || [];
    const archivedItems = space.archivedItems || [];
    const allItems = [...items, ...archivedItems];

    if (allItems.length === 0) return 0;

    let totalCurrent = 0;
    let totalTarget = 0;

    allItems.forEach(item => {
        const prog = getItemProgress(item);
        totalCurrent += prog.current;
        totalTarget += prog.total;
    });

    return totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;
}

/**
 * Handle click on space tab
 * @param {Event} e - Click event
 */
export function handleSpaceAction(e) {
    const tab = e.target.closest('.space-tab');
    if (!tab) return;

    const spaceId = tab.dataset.id;

    // If already active space, do nothing (use right-click to edit)
    if (spaceId === state.activeSpaceId) {
        return;
    }

    // Single click on different space = switch to it
    switchSpace(spaceId);
}

/**
 * Switch to a different space
 * @param {string} spaceId - ID of space to switch to
 */
export function switchSpace(spaceId) {
    state.activeSpaceId = spaceId;
    syncActiveSpace();
    saveStateLocal(); // Local only - don't sync just for switching spaces

    // Update view-only mode class for shared spaces
    document.body.classList.toggle('view-only', isViewOnly());

    // Complete re-render
    if (renderCallback) renderCallback();
    if (renderArchiveCallback) renderArchiveCallback();
    renderSpaces();
    if (updateCategoryDropdownCallback) updateCategoryDropdownCallback();

    playSound('tick');
}

/**
 * Handle adding a new space
 */
export function handleAddSpace() {
    // Close all other modals first
    document.querySelectorAll('.modal:not(.hidden)').forEach(modal => {
        modal.classList.add('hidden');
    });

    const colors = ['#e8b84a', '#4ecdb4', '#d45454', '#5cb572', '#6366f1', '#a855f7', '#ec4899'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    // Open modal for new space
    const modal = $('#modal-space');
    if (!modal) return;

    $('#edit-space-id').value = '';
    $('#edit-space-name').value = '';
    $('#edit-space-color').value = randomColor;

    // Update modal title for new space
    modal.querySelector('.modal-title').textContent = 'NEW SPACE';
    $('#btn-delete-space').style.display = 'none';

    // Highlight selected color
    updateColorSwatchSelection(randomColor);

    modal.classList.remove('hidden');
    $('#edit-space-name').focus();
}

/**
 * Open the space edit modal for an existing space
 * @param {string} spaceId - ID of space to edit
 */
export function openSpaceEditModal(spaceId) {
    // Close all other modals first
    document.querySelectorAll('.modal:not(.hidden)').forEach(modal => {
        modal.classList.add('hidden');
    });

    const space = state.spaces.find(s => s.id === spaceId);
    if (!space) return;

    const modal = $('#modal-space');
    if (!modal) return;

    const isShared = space.isShared === true;
    const saveBtn = $('#btn-save-space');
    const deleteBtn = $('#btn-delete-space');
    const nameInput = $('#edit-space-name');
    const colorPresets = $('#color-presets');

    $('#edit-space-id').value = spaceId;
    nameInput.value = space.name;
    $('#edit-space-color').value = space.color;
    // Store ownerId for leave action
    modal.dataset.ownerId = space.ownerId || '';

    if (isShared) {
        // Shared space - user is a guest
        modal.querySelector('.modal-title').textContent = 'SHARED SPACE';
        // Make name and color read-only
        nameInput.disabled = true;
        colorPresets.style.pointerEvents = 'none';
        colorPresets.style.opacity = '0.5';
        // Hide save button
        if (saveBtn) saveBtn.style.display = 'none';
        // Show leave button instead of delete
        deleteBtn.textContent = 'LEAVE SPACE';
        deleteBtn.classList.remove('btn-danger');
        deleteBtn.classList.add('btn-warning');
        deleteBtn.style.display = 'block';
    } else {
        // Owned space - normal edit
        modal.querySelector('.modal-title').textContent = 'EDIT SPACE';
        nameInput.disabled = false;
        colorPresets.style.pointerEvents = '';
        colorPresets.style.opacity = '';
        if (saveBtn) saveBtn.style.display = '';
        deleteBtn.textContent = 'DELETE';
        deleteBtn.classList.add('btn-danger');
        deleteBtn.classList.remove('btn-warning');
        // Show delete button only if not the last space
        deleteBtn.style.display = state.spaces.length > 1 ? 'block' : 'none';
    }

    // Highlight selected color
    updateColorSwatchSelection(space.color);

    modal.classList.remove('hidden');
    if (!isShared) nameInput.focus();
}

/**
 * Update color swatch selection in the modal
 * @param {string} color - The selected color
 */
export function updateColorSwatchSelection(color) {
    const swatches = $$('#color-presets .color-swatch');
    swatches.forEach(swatch => {
        swatch.classList.toggle('selected', swatch.dataset.color === color);
    });
}

/**
 * Handle color swatch click in modal
 * @param {Event} e - Click event
 */
export function handleColorSwatchClick(e) {
    const swatch = e.target.closest('.color-swatch');
    if (!swatch) return;

    const color = swatch.dataset.color;
    $('#edit-space-color').value = color;
    updateColorSwatchSelection(color);
}

/**
 * Handle saving space from modal
 */
export function handleSaveSpace() {
    const spaceId = $('#edit-space-id').value;
    const name = $('#edit-space-name').value.trim().toUpperCase();
    const color = $('#edit-space-color').value;

    if (!name) {
        $('#edit-space-name').focus();
        return;
    }

    if (spaceId) {
        // Editing existing space
        const space = state.spaces.find(s => s.id === spaceId);
        if (space) {
            space.name = name;
            space.color = color;
        }
    } else {
        // Creating new space
        const newSpace = {
            id: 'space-' + Date.now(),
            name: name,
            color: color,
            items: [],
            archivedItems: [],
            categories: [...DEFAULT_CATEGORIES]
        };
        state.spaces.push(newSpace);
        state.activeSpaceId = newSpace.id;
        syncActiveSpace();
    }

    saveState();
    if (renderCallback) renderCallback();
    if (renderArchiveCallback) renderArchiveCallback();
    renderSpaces();
    if (updateCategoryDropdownCallback) updateCategoryDropdownCallback();

    $('#modal-space').classList.add('hidden');
    playSound('tick');
}

/**
 * Handle deleting a space (or leaving if it's a shared space)
 */
export async function handleDeleteSpace() {
    const spaceId = $('#edit-space-id').value;
    if (!spaceId) return;

    const space = state.spaces.find(s => s.id === spaceId);
    if (!space) return;

    // If it's a shared space, handle as "leave" instead of "delete"
    if (space.isShared === true) {
        const { leaveSharedSpace } = await import('./sharing.js');
        const result = await leaveSharedSpace(space.ownerId, spaceId, space.name);

        if (result && result.success) {
            // Remove from local state
            state.spaces = state.spaces.filter(s => s.id !== spaceId);
            if (state.activeSpaceId === spaceId) {
                state.activeSpaceId = state.spaces[0]?.id;
            }
            syncActiveSpace();
            saveState();
            if (renderCallback) renderCallback();
            if (renderArchiveCallback) renderArchiveCallback();
            renderSpaces();
            if (updateCategoryDropdownCallback) updateCategoryDropdownCallback();
            $('#modal-space').classList.add('hidden');
            playSound('tick');
        }
        return;
    }

    // Regular delete flow for owned spaces
    if (state.spaces.length <= 1) {
        await showAlert('Cannot delete the last remaining space.', 'ERROR');
        return;
    }

    const confirmed = await showConfirm(`Permanently delete "${space.name}" and all its quests? This cannot be undone.`, 'DELETE SPACE', true);
    if (!confirmed) return;

    // Delete images from Firebase Storage for all items in this space
    // Note: All images are stored in 'items' folder, even for archived items
    if (window.FirebaseBridge?.currentUser) {
        // Collect all items with storage images (both active and archived)
        const allItems = [...(space.items || []), ...(space.archivedItems || [])];
        const itemsWithStorageImages = allItems.filter(
            item => item.imageUrl && window.FirebaseBridge.isStorageUrl(item.imageUrl)
        );

        if (itemsWithStorageImages.length > 0) {
            console.log(`🗑️ Deleting ${itemsWithStorageImages.length} items' images from space ${space.name}...`);
            try {
                const results = await Promise.all(
                    itemsWithStorageImages.map(item =>
                        window.FirebaseBridge.deleteItemImages(spaceId, item.id, 'items')
                    )
                );
                const totalDeleted = results.reduce((sum, r) => sum + (r.deletedCount || 0), 0);
                console.log(`🗑️ Cleaned up ${totalDeleted} storage file(s) from deleted space`);

                // Refresh storage display after Cloud Functions update
                setTimeout(async () => {
                    await window.FirebaseBridge.fetchStorageUsage();
                    const { updateStorageDisplay } = await import('./storage.js');
                    updateStorageDisplay();
                }, 1500);
            } catch (err) {
                console.warn('Could not cleanup storage files for space:', err);
            }
        }

        // Delete space from Firestore
        await window.FirebaseBridge.deleteSpace(spaceId);
    }

    state.spaces = state.spaces.filter(s => s.id !== spaceId);
    state.activeSpaceId = state.spaces[0].id;
    syncActiveSpace();

    saveState();
    if (renderCallback) renderCallback();
    if (renderArchiveCallback) renderArchiveCallback();
    renderSpaces();
    if (updateCategoryDropdownCallback) updateCategoryDropdownCallback();

    $('#modal-space').classList.add('hidden');
    playSound('tick');
}
