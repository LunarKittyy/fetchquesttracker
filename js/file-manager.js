/**
 * File Manager Module
 * Manages Firebase Storage files
 */

import { $ } from './utils.js';
import { showConfirm, showAlert } from './popup.js';
import { updateStorageDisplay } from './storage.js';

// DOM elements
let elements = {
    modalFiles: null,
    filesList: null
};

/**
 * Initialize file manager module
 */
export function initFileManager(domElements) {
    elements = { ...elements, ...domElements };
}

/**
 * Open the file manager modal
 */
export function openFileManager() {
    if (!elements.modalFiles) return;
    
    // Close all other modals first
    document.querySelectorAll('.modal:not(.hidden)').forEach(modal => {
        modal.classList.add('hidden');
    });
    
    elements.modalFiles.classList.remove('hidden');
    loadStorageFiles();
}

/**
 * Load list of files from Firebase Storage
 */
export async function loadStorageFiles() {
    if (!elements.filesList) return;
    elements.filesList.innerHTML = '<div class="files-loading">Loading files...</div>';

    if (!window.FirebaseBridge?.currentUser) {
        elements.filesList.innerHTML = '<div class="files-empty">Sign in to view cloud storage files.</div>';
        return;
    }

    const result = await window.FirebaseBridge.listStorageFiles();

    if (!result.success || result.files.length === 0) {
        elements.filesList.innerHTML = '<div class="files-empty">No files in storage.</div>';
        return;
    }

    elements.filesList.innerHTML = result.files.map(file => `
        <div class="file-item" data-path="${file.fullPath}" title="${file.path}">
            <img src="${file.url}" alt="${file.name}" loading="lazy">
        </div>
    `).join('');
}

/**
 * Handle clicking on a file (to delete it)
 * @param {Event} e - Click event
 */
export async function handleFileClick(e) {
    const item = e.target.closest('.file-item');
    if (!item) return;

    const path = item.dataset.path;
    if (!path) return;

    const confirmed = await showConfirm('Delete this file? If it belongs to a quest, the image will be removed.', 'DELETE FILE', true);
    if (!confirmed) return;

    item.style.opacity = '0.5';
    const result = await window.FirebaseBridge.deleteStorageFile(path);

    if (result.success) {
        item.remove();
        // Fetch updated storage usage from Firestore after a brief delay
        // (allows Cloud Functions to update the userStorage document)
        setTimeout(async () => {
            await window.FirebaseBridge.fetchStorageUsage();
            updateStorageDisplay();
        }, 1500);
        updateStorageDisplay();
    } else {
        item.style.opacity = '1';
        await showAlert('Failed to delete file: ' + (result.error || 'Unknown error'), 'ERROR');
    }
}
