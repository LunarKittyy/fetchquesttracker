/**
 * FETCH QUEST v3.0 - Main Application Coordinator
 * ES Module-based architecture
 */

// --- Logger (must be first for error boundary) ---
import './js/logger.js';

// --- Core Imports ---
import {
    state, syncActiveSpace, DEFAULT_CATEGORIES, STORAGE_KEY,
    currentType, setCurrentType, tempObjectives, setTempObjectives,
    tempImageData, setTempImageData, searchQuery, setSearchQuery,
    bulkMode, selectedItems, addSelectedItem,
    selectedTags, setSelectedTags, clearSelectedTags, isViewOnly
} from './js/state.js';

import {
    $, $$, generateId, escapeHtml, isItemComplete, getItemProgress,
    sortItems, getUniqueCategories, groupItemsByCategory, getCategoryProgress, normalizeItem, debounce,
    findItemAcrossSpaces
} from './js/utils.js';

import { initPopup, showPopup, showConfirm, showAlert, showPrompt, showToast, completeToast } from './js/popup.js';
import { initParticleElements, initParticles, celebrate, resizeCanvas } from './js/particles.js';
import {
    initStorage, saveState, saveStateLocal, loadState, exportData, importData,
    updateLastSyncedDisplay, updateStorageDisplay, startSyncTimeInterval, showSaveIndicator
} from './js/storage.js';

import {
    initSpaces, renderSpaces, handleSpaceAction, handleAddSpace, openSpaceEditModal,
    updateColorSwatchSelection, handleColorSwatchClick, handleSaveSpace, handleDeleteSpace
} from './js/spaces.js';

import {
    initArchive, handleArchiveToggle, archiveItem, restoreItem,
    deleteArchivedItem, deleteAllArchived, renderArchive, handleArchiveAction
} from './js/archive.js';

import {
    initBulk, toggleBulkMode, exitBulkMode, updateBulkCount,
    handleBulkCardClick, bulkArchiveItems, bulkDeleteItems, selectAllItems
} from './js/bulk.js';

import {
    initContextMenu, showContextMenu, hideContextMenu,
    handleSpaceContextMenu, handleQuestContextMenu, handleContextMenuAction
} from './js/context-menu.js';

import { initStatistics, openStatistics, renderStatistics } from './js/statistics.js';
import { initFileManager, openFileManager, loadStorageFiles, handleFileClick } from './js/file-manager.js';

import {
    addItem, updateItemField, deleteItem, insertItemIntoDOM, createQuestCardHTML,
    cleanupEmptyCategory, updateCategoryCount, updateCategoryProgress, updateCategoryDropdown,
    updateCardProgress, updateObjectiveDisplay, initQuests
} from './js/quests.js';

import {
    initAuthUI, openAuthModal, closeAuthModal, switchAuthTab, showPasswordReset,
    updateAuthUI, updateSyncStatusUI, handleSignIn, handleSignUp, handlePasswordReset,
    handleGoogleSignIn, handleLogout, handleExportData, handleDeleteAccount, handleChangeName,
    handleShowInfo
} from './js/auth-ui.js';

import { parseItemInput } from './js/input-parser.js';
import { initBulkEntry } from './js/bulk-entry.js';
import { createShareLink, checkAndAcceptInvite, processPendingInvite, copyToClipboard, listActiveInvites, revokeInviteLink } from './js/sharing.js';

// --- Reorganized Imports ---
import { elements } from './js/elements.js';
import { handleCloseModal, closeAllModals } from './js/modals.js';
import {
    handleFormSubmit, handleTypeToggle, updateFormContentState,
    handleAddObjective, handleRemoveObjective, renderObjectives,
    handleOpenImageModal, handleImageUrlOption, handleImageLocalOption,
    handleImageUrlChange, handleImageFileSelect, handleSaveImage, handleRemoveImage
} from './js/form-logic.js';
import {
    openTagManager, handleAddTag, handleTagListClick, updateTagPickerDropdown, updateTagIndicator,
    handleTagPickerClick, openEditTagsModal, handleEditTagsClick, saveItemTags, initTagColorPicker,
    populateSelectByTagDropdown, handleSelectByTagClick,
    openFormTagsModal, handleFormTagsClick, closeFormTagsModal
} from './js/tags.js';
import { openCategoryManager, handleAddCategory, handleCategoryListClick } from './js/categories.js';

import { handleQuestAction, handleNotesBlur } from './js/quest-events.js';
import { initDragDrop } from './js/drag-drop.js';


// --- Main Render Function ---
function render() {
    updateCategoryDropdown();

    updateStatusBar();
    renderSpaces();

    // Set view-only mode class for shared spaces where user is viewer
    document.body.classList.toggle('view-only', isViewOnly());

    if (elements.questContainer) {
        elements.questContainer.classList.toggle('multi-column', state.multiColumn);
    }

    const existingGroups = elements.questContainer?.querySelectorAll('.category-group') || [];
    existingGroups.forEach(g => g.remove());

    let itemsToRender = state.items || [];

    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchAllSpacesChecked = elements.searchAllSpaces?.checked;

        // Check for tag: prefix for filtering
        const tagPrefix = 'tag:';
        const hasTagPrefix = query.startsWith(tagPrefix);
        const tagFilter = hasTagPrefix ? query.slice(tagPrefix.length).trim() : null;

        // Helper function to check if item matches search query
        const matchesSearch = (item, space) => {
            if (tagFilter) {
                // Filter by tag: prefix - match priority, category, or custom tag names
                if (item.priority && item.priority.toLowerCase() === tagFilter) return true;
                if (item.category && item.category.toLowerCase() === tagFilter) return true;
                if (item.type && item.type.toLowerCase() === tagFilter) return true;
                // Check custom tags (using global state.tags)
                if (item.tags && (state.tags || []).length > 0) {
                    const matchingTag = (state.tags || []).find(t =>
                        item.tags.includes(t.id) && t.name.toLowerCase() === tagFilter
                    );
                    if (matchingTag) return true;
                }
                return false;
            } else {
                // Regular search - only match item name
                return item.name.toLowerCase().includes(query);
            }
        };

        if (searchAllSpacesChecked) {
            itemsToRender = [];
            (state.spaces || []).forEach(space => {
                const matches = (space.items || []).filter(item => matchesSearch(item, space));
                // Add space name for display (will be cleaned up when search is cleared)
                matches.forEach(item => {
                    item._searchSpaceName = space.name;
                });
                itemsToRender.push(...matches);
            });
        } else {
            const currentSpace = (state.spaces || []).find(s => s.id === state.activeSpaceId);
            itemsToRender = (state.items || []).filter(item => matchesSearch(item, currentSpace));
        }
    } else {
        // Clean up _searchSpaceName from all items when not searching
        (state.spaces || []).forEach(space => {
            (space.items || []).forEach(item => {
                delete item._searchSpaceName;
            });
        });
    }

    if (itemsToRender.length === 0) {
        elements.emptyState?.classList.remove('hidden');
    } else {
        elements.emptyState?.classList.add('hidden');

        const grouped = groupItemsByCategory(itemsToRender);
        let html = '';
        Object.entries(grouped).forEach(([category, categoryItems]) => {
            html += createCategoryGroupHTML(category, categoryItems);
        });

        elements.questContainer?.insertAdjacentHTML('beforeend', html);
    }
}

function createCategoryGroupHTML(category, categoryItems) {
    const progress = getCategoryProgress(categoryItems);
    const itemsHTML = categoryItems.map(item => createQuestCardHTML(item)).join('');

    const isCollapsed = state.collapsedCategories.has(category);

    return `
        <section class="category-group ${isCollapsed ? 'collapsed' : ''}" data-category="${escapeHtml(category)}">
            <div class="category-header">
                <button class="btn-collapse-category" data-action="collapse-category" title="${isCollapsed ? 'Expand' : 'Collapse'}">
                    <svg viewBox="0 0 24 24" fill="none" class="icon-chevron" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </button>
                <h2 class="category-name">${escapeHtml(category)}</h2>
                <span class="category-count">${categoryItems.length}</span>
                <div class="category-progress-wrapper">
                    <div class="category-progress">
                        <div class="category-progress-fill" style="width: ${progress.percent}%"></div>
                    </div>
                    <span class="category-progress-text">${progress.current}/${progress.total}</span>
                </div>
            </div>
            <div class="category-items ${isCollapsed ? 'hidden' : ''}">${itemsHTML}</div>
        </section>
    `;
}

function updateStatusBar() {
    const items = state.items || [];
    const total = items.length;
    const complete = items.filter(i => isItemComplete(i)).length;

    if (elements.statusTotal) elements.statusTotal.textContent = total;
    if (elements.statusComplete) elements.statusComplete.textContent = complete;
}

/**
 * Keep the add form open for a grace period after dropdown selection
 * Prevents form from collapsing when cursor moves outside during selection
 */
function keepFormOpen() {
    elements.form?.classList.add('keep-open');
    setTimeout(() => {
        // Only remove if not pinned
        if (elements.btnPinForm?.classList.contains('active')) return;
        elements.form?.classList.remove('keep-open');
    }, 2500);
}

// --- Form Handlers logic moved to js/form-logic.js ---
// --- Modal Handlers logic moved to js/modals.js ---


function handleOpenAddCategoryModal() {
    closeAllModals();
    elements.categoryInput.value = '';
    elements.modalCategory?.classList.remove('hidden');
    elements.categoryInput.focus();
}

function handleSaveCategory() {
    const cat = elements.categoryInput.value.trim();
    if (cat && !state.categories.includes(cat)) {
        state.categories.push(cat);
        saveState();
        updateCategoryDropdown();
        elements.itemCategory.value = cat;
    }
    elements.modalCategory?.classList.add('hidden');
}

// --- Settings Handlers ---
function handleOpenSettings() {
    closeAllModals();
    if (elements.settingShiftAmount) elements.settingShiftAmount.value = state.shiftAmount;
    if (elements.settingCtrlAmount) elements.settingCtrlAmount.value = state.ctrlAmount;
    if (elements.settingAutoArchive) elements.settingAutoArchive.checked = state.autoArchive;
    if (elements.settingMultiColumn) elements.settingMultiColumn.checked = state.multiColumn;
    elements.modalSettings?.classList.remove('hidden');
}

function handleSettingChange(e) {
    const id = e.target.id;
    if (id === 'setting-shift-amount') state.shiftAmount = parseInt(e.target.value) || 5;
    if (id === 'setting-ctrl-amount') state.ctrlAmount = parseInt(e.target.value) || 10;
    if (id === 'setting-auto-archive') state.autoArchive = e.target.checked;
    if (id === 'setting-multi-column') {
        state.multiColumn = e.target.checked;
        elements.questContainer?.classList.toggle('multi-column', state.multiColumn);
    }
    saveState();
}

function handleExport() {
    exportData();
}

function handleImportClick() {
    elements.fileImport?.click();
}

function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
        importData(file, { sortItems: () => sortItems(state.items), render });
    }
    e.target.value = '';
}

async function handleClearAllData() {
    const isLoggedIn = window.FirebaseBridge?.currentUser;
    const warningMsg = isLoggedIn
        ? 'Delete ALL data including cloud data? This cannot be undone!'
        : 'Delete ALL local data? This cannot be undone!';

    const confirmed1 = await showConfirm(warningMsg, 'CLEAR DATA', true);
    if (!confirmed1) return;
    const confirmed2 = await showConfirm('Really? This will permanently remove everything.', 'FINAL WARNING', true);
    if (!confirmed2) return;

    // Show loading state
    elements.modalSettings?.classList.add('hidden');

    try {
        // 1. If logged in, delete all cloud data first
        if (isLoggedIn && window.FirebaseBridge) {
            console.log('🗑️ Clearing cloud data...');

            // Delete all storage files
            const storageResult = await window.FirebaseBridge.listStorageFiles();
            if (storageResult.success && storageResult.files.length > 0) {
                console.log(`🗑️ Deleting ${storageResult.files.length} storage files...`);
                for (const file of storageResult.files) {
                    await window.FirebaseBridge.deleteStorageFile(file.fullPath);
                }
            }

            // Delete all spaces from Firestore
            for (const space of state.spaces) {
                await window.FirebaseBridge.deleteSpace(space.id);
            }

            // Refresh storage usage from Firestore after Cloud Functions update
            setTimeout(async () => {
                await window.FirebaseBridge.fetchStorageUsage();
                updateStorageDisplay();
            }, 1500);

            console.log('✅ Cloud data cleared');
        }

        // 2. Clear all local state
        state.spaces.length = 0;
        state.activeSpaceId = null;
        state.tags = []; // Reset custom tags

        // 3. Clear localStorage completely
        localStorage.removeItem(STORAGE_KEY);

        // 4. Re-initialize with a fresh default space
        syncActiveSpace(); // This creates a default space if none exist

        // 5. Re-render everything
        render();
        renderArchive();
        renderSpaces();
        updateCategoryDropdown();

        showAlert('All data has been cleared.', 'SUCCESS');
    } catch (error) {
        console.error('Error clearing data:', error);
        showAlert('Error clearing data: ' + error.message, 'ERROR');
    }
}

// --- Image Handlers logic moved to js/form-logic.js ---

// --- Image Handlers logic moved to js/form-logic.js ---

// --- Category Manager logic moved to js/categories.js ---

function shareProgress() {
    elements.modalSettings?.classList.add('hidden');

    const space = state.spaces.find(s => s.id === state.activeSpaceId);
    if (!space) return;

    const items = space.items || [];
    const archived = space.archivedItems || [];
    const totalItems = items.length + archived.length;
    const completedItems = archived.length + items.filter(i => isItemComplete(i)).length;

    const text = `📦 ${space.name}\nProgress: ${completedItems}/${totalItems} items complete\n(${totalItems > 0 ? Math.round(completedItems / totalItems * 100) : 0}%)`;

    navigator.clipboard.writeText(text).then(() => {
        showAlert('Progress copied to clipboard!', 'SUCCESS');
    }).catch(() => {
        showAlert('Could not copy to clipboard.', 'ERROR');
    });
}

// --- Tag Manager logic moved to js/tags.js ---

// --- Select by Tag (Bulk Mode) ---
// --- Select by Tag logic moved to js/tags.js ---

// --- Share Modal ---
async function openShareModal(spaceId) {
    if (!window.FirebaseBridge?.currentUser) {
        showAlert('Sign in to share spaces.', 'SIGN IN REQUIRED');
        return;
    }

    const space = state.spaces.find(s => s.id === spaceId);
    if (!space) return;

    // Reset modal state
    elements.shareSpaceId.value = spaceId;
    elements.shareRole.value = 'viewer';
    elements.shareLinkContainer?.classList.add('hidden');
    elements.shareLinkExpiry?.classList.add('hidden');
    elements.shareLinkUrl.value = '';

    // Update modal title
    const modal = elements.modalShare;
    const titleEl = modal?.querySelector('.modal-title');
    if (titleEl) titleEl.textContent = `SHARE: ${space.name}`;

    // Show modal immediately while loading
    modal?.classList.remove('hidden');

    // Load and render active invites
    const invitesSection = $('#active-invites-section');
    const invitesList = $('#active-invites-list');

    if (invitesSection && invitesList) {
        invitesList.innerHTML = '<p class="settings-hint">Loading...</p>';
        invitesSection.classList.remove('hidden');

        const invites = await listActiveInvites(spaceId);

        if (invites.length > 0) {
            invitesList.innerHTML = invites.map(invite => {
                const expiresDate = new Date(invite.expiresAt);
                const daysLeft = Math.ceil((expiresDate - new Date()) / (1000 * 60 * 60 * 24));
                return `
                <div class="invite-item" data-invite-code="${invite.inviteCode}">
                    <div class="invite-info">
                        <code class="invite-code">${invite.inviteCode}</code>
                        <span class="collaborator-role ${invite.role}">${invite.role}</span>
                        <span class="invite-expiry">${daysLeft}d left</span>
                    </div>
                    <button type="button" class="btn-revoke-invite" data-invite-code="${invite.inviteCode}" title="Revoke">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            `;
            }).join('');

            // Add click handlers for revoke buttons
            invitesList.querySelectorAll('.btn-revoke-invite').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const inviteCode = btn.dataset.inviteCode;
                    const result = await revokeInviteLink(inviteCode);
                    if (result && result.success) {
                        openShareModal(spaceId); // Refresh the modal
                    }
                });
            });

            // Add click handlers for invite codes (copy full link)
            invitesList.querySelectorAll('.invite-code').forEach(codeEl => {
                codeEl.style.cursor = 'pointer';
                codeEl.title = 'Click to copy link';
                codeEl.addEventListener('click', async () => {
                    const inviteCode = codeEl.textContent;
                    const baseUrl = window.location.origin + window.location.pathname;
                    const shareUrl = `${baseUrl}?invite=${inviteCode}`;
                    await copyToClipboard(shareUrl);
                    showToast('Link copied!');
                });
            });
        } else {
            invitesSection.classList.add('hidden');
        }
    }

    // Show collaborators section if there are any
    const collabSection = $('#collaborators-section');
    const collabList = $('#collaborators-list');

    if (collabSection && collabList) {
        const collaborators = space.collaborators || {};
        const collabEntries = Object.entries(collaborators);

        if (collabEntries.length > 0) {
            collabSection.classList.remove('hidden');
            collabList.innerHTML = collabEntries.map(([userId, data]) => `
                <div class="collaborator-item" data-user-id="${userId}">
                    <div class="collaborator-info">
                        <span class="collaborator-email">${escapeHtml(data.displayName || data.email || 'Unknown')}</span>
                        <span class="collaborator-role ${data.role}">${data.role}</span>
                    </div>
                    <button type="button" class="btn-remove-collaborator" data-user-id="${userId}" title="Remove access">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            `).join('');

            // Add click handlers for remove buttons
            collabList.querySelectorAll('.btn-remove-collaborator').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const targetUserId = btn.dataset.userId;
                    const { revokeAccess } = await import('./js/sharing.js');
                    const result = await revokeAccess(spaceId, targetUserId);
                    if (result && result.success) {
                        // Remove from local state and re-render
                        delete space.collaborators[targetUserId];
                        openShareModal(spaceId); // Refresh the modal
                    }
                });
            });
        } else {
            collabSection.classList.add('hidden');
        }
    }
}

async function handleGenerateShareLink() {
    const spaceId = elements.shareSpaceId.value;
    const role = elements.shareRole.value;

    if (!spaceId) return;

    elements.btnGenerateShareLink.disabled = true;
    showToast('Generating link...');

    const result = await createShareLink(spaceId, role);

    elements.btnGenerateShareLink.disabled = false;

    if (result.success) {
        completeToast('Link generated!');
        elements.shareLinkUrl.value = result.url;
        elements.shareLinkContainer?.classList.remove('hidden');

        const expiryDate = new Date(result.expiresAt);
        elements.shareLinkExpiry.textContent = `Expires: ${expiryDate.toLocaleDateString()}`;
        elements.shareLinkExpiry?.classList.remove('hidden');

        // Auto-copy to clipboard
        await copyToClipboard(result.url);
        // We already have the success toast, no need for another one

        // Refresh the active invites list
        openShareModal(spaceId);
    } else {
        completeToast('Failed', 500);
        showAlert(result.error || 'Failed to generate link.', 'ERROR');
    }
}

async function handleCopyShareLink() {
    const url = elements.shareLinkUrl.value;
    if (!url) return;

    const success = await copyToClipboard(url);
    if (success) {
        elements.btnCopyShareLink.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
        setTimeout(() => {
            elements.btnCopyShareLink.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        }, 2000);
    }
}

// --- Keyboard & Window Handlers ---
function handleKeydown(e) {
    if (e.key === 'Escape') {
        $$('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
        hideContextMenu();
        if (bulkMode) exitBulkMode();
    }
}

function handleWindowFocus() {
    document.body.classList.remove('paused');
}

function handleWindowBlur() {
    document.body.classList.add('paused');
}

// --- Initialization ---
async function init() {
    // Start loading bar
    const { loadingBar } = await import('./js/loading-bar.js');
    loadingBar.start();

    // Initialize dragging
    initDragDrop(elements.questContainer);

    initPopup();
    initParticleElements();
    initStorage({
        saveIndicator: elements.saveIndicator,
        lastSynced: elements.lastSynced,
        storageFill: elements.storageFill,
        storageText: elements.storageText
    }, { renderSpaces, updateSyncStatusUI });

    loadingBar.set(20);

    initSpaces({ render, renderArchive, updateCategoryDropdown });
    initArchive({ archivePanel: elements.archivePanel, archiveContainer: elements.archiveContainer, archiveCount: elements.archiveCount },
        { insertItemIntoDOM, cleanupEmptyCategory, updateCategoryProgress, updateStatusBar });
    initBulk({ btnBulkMode: elements.btnBulkMode, bulkActionsBar: elements.bulkActionsBar, bulkCount: elements.bulkCount },
        { render, renderArchive });
    initContextMenu({ contextMenu: elements.contextMenu },
        { openSpaceEditModal, handleDeleteSpace, archiveItem, deleteItem, editTags: openEditTagsModal, shareSpace: openShareModal });
    initStatistics({
        modalStatistics: elements.modalStatistics, modalSettings: elements.modalSettings,
        statTotal: elements.statTotal, statCompleted: elements.statCompleted,
        statActive: elements.statActive, statRate: elements.statRate,
        statsCategories: elements.statsCategories, statsSpaces: elements.statsSpaces
    });

    loadingBar.set(40);

    initFileManager({ modalFiles: elements.modalFiles, filesList: elements.filesList });
    initBulkEntry({ render });
    initQuests({ renderArchive, updateStatusBar });
    initAuthUI({
        modalAuth: elements.modalAuth, authTabs: elements.authTabs,
        formSignin: elements.formSignin, formSignup: elements.formSignup,
        formReset: elements.formReset, signinError: elements.signinError,
        signupError: elements.signupError, resetError: elements.resetError,
        resetMessage: elements.resetMessage, authDivider: elements.authDivider,
        btnGoogleSignin: elements.btnGoogleSignin, btnLogin: elements.btnLogin,
        userMenu: elements.userMenu, userDisplayName: elements.userDisplayName,
        userDropdown: elements.userDropdown, syncStatus: elements.syncStatus
    }, { render, renderArchive, renderSpaces });

    // Load state and render
    loadState();
    sortItems(state.items);
    render();

    loadingBar.set(60);

    initParticles();
    renderArchive();
    renderSpaces();

    loadingBar.finish();

    // Event listener for form reset from form-logic.js
    document.addEventListener('form-reset', () => {
        updateTagIndicator();
        updateTagPickerDropdown();
        // Close tag dropdown when form resets
        elements.tagDropdown?.classList.add('hidden');
    });

    // Global render event (for DnD and Category updates)
    document.addEventListener('render-app', () => render());

    // Event listeners
    elements.form?.addEventListener('submit', handleFormSubmit);
    elements.typeBtns.forEach(btn => btn.addEventListener('click', handleTypeToggle));
    elements.btnAddObjective?.addEventListener('click', handleAddObjective);
    elements.objectivesList?.addEventListener('click', handleRemoveObjective);
    elements.questContainer?.addEventListener('click', handleQuestAction);
    elements.questContainer?.addEventListener('blur', handleNotesBlur, true);
    elements.imageModalPreview?.addEventListener('click', handleOpenImageModal);
    elements.btnAddCategory?.addEventListener('click', handleOpenAddCategoryModal);
    elements.btnSaveCategory?.addEventListener('click', handleSaveCategory);
    elements.modalCategory?.addEventListener('click', handleCloseModal);
    elements.categoriesList?.addEventListener('click', handleCategoryListClick);
    elements.fileImport?.addEventListener('change', handleFileChange);
    document.addEventListener('keydown', handleKeydown);

    // Image picker
    elements.btnAddImage?.addEventListener('click', handleOpenImageModal);
    elements.btnImageUrl?.addEventListener('click', handleImageUrlOption);
    elements.btnImageLocal?.addEventListener('click', handleImageLocalOption);
    elements.imageUrlField?.addEventListener('input', handleImageUrlChange);
    elements.imageFileInput?.addEventListener('change', handleImageFileSelect);
    elements.btnRemoveImage?.addEventListener('click', handleRemoveImage);
    elements.btnSaveImage?.addEventListener('click', handleSaveImage);
    elements.modalImage?.addEventListener('click', handleCloseModal);

    // Form content state - prevent collapse when has content
    elements.itemName?.addEventListener('input', updateFormContentState);

    // Number input validation
    document.addEventListener('input', (e) => {
        if (e.target?.classList?.contains('input-number')) {
            // Remove non-numeric and limit to 4 digits
            e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
        }
    });
    document.addEventListener('blur', (e) => {
        if (e.target?.classList?.contains('input-number')) {
            const min = parseInt(e.target.min) || 1;
            const max = parseInt(e.target.max) || 9999;
            let val = parseInt(e.target.value) || min;
            e.target.value = Math.max(min, Math.min(max, val));
        }
    }, true);

    // Pin button - keep form open when adding multiple items
    elements.btnPinForm?.addEventListener('click', (e) => {
        e.stopPropagation();
        const form = elements.form;
        if (form) {
            form.classList.toggle('keep-open');
            elements.btnPinForm.classList.toggle('active', form.classList.contains('keep-open'));
        }
    });

    // Color picker dropdown
    if (elements.btnColorPicker) {
        elements.btnColorPicker.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = elements.colorDropdown?.classList.contains('hidden');
            elements.priorityDropdown?.classList.add('hidden');

            if (isHidden) {
                const rect = elements.btnColorPicker.getBoundingClientRect();
                if (elements.colorDropdown) {
                    elements.colorDropdown.style.top = (rect.bottom + 8) + 'px';
                    elements.colorDropdown.style.left = rect.left + 'px';
                    elements.colorDropdown.classList.remove('hidden');
                }
            } else {
                elements.colorDropdown?.classList.add('hidden');
            }
        });

        elements.colorDropdown?.addEventListener('click', (e) => {
            e.stopPropagation();
            const option = e.target.closest('.color-option');
            if (!option) return;

            elements.colorDropdown.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');

            const color = option.dataset.color || '';
            elements.itemColor.value = color;
            if (color) {
                elements.colorIndicator.style.background = color;
                elements.colorIndicator?.classList.add('has-color');
            } else {
                elements.colorIndicator.style.background = '';
                elements.colorIndicator?.classList.remove('has-color');
            }

            elements.colorDropdown.classList.add('hidden');
            keepFormOpen();
        });
    }

    // Priority picker dropdown
    if (elements.btnPriorityPicker) {
        elements.btnPriorityPicker.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = elements.priorityDropdown?.classList.contains('hidden');
            elements.colorDropdown?.classList.add('hidden');

            if (isHidden) {
                const rect = elements.btnPriorityPicker.getBoundingClientRect();
                if (elements.priorityDropdown) {
                    elements.priorityDropdown.style.top = (rect.bottom + 8) + 'px';
                    elements.priorityDropdown.style.left = rect.left + 'px';
                    elements.priorityDropdown.classList.remove('hidden');
                }
            } else {
                elements.priorityDropdown?.classList.add('hidden');
            }
        });

        elements.priorityDropdown?.addEventListener('click', (e) => {
            e.stopPropagation();
            const option = e.target.closest('.priority-option');
            if (!option) return;

            elements.priorityDropdown.querySelectorAll('.priority-option').forEach(o => o.classList.remove('active'));
            option.classList.add('active');

            const priority = option.dataset.priority || '';
            elements.itemPriority.value = priority;

            const labels = { high: 'H', medium: 'M', low: 'L', '': '—' };
            elements.priorityIndicator.textContent = labels[priority] || '—';
            elements.priorityIndicator.className = 'priority-indicator' + (priority ? ` priority-${priority}` : '');

            elements.priorityDropdown.classList.add('hidden');
            keepFormOpen();
        });
    }

    // Close dropdowns on outside click
    document.addEventListener('click', () => {
        elements.colorDropdown?.classList.add('hidden');
        elements.priorityDropdown?.classList.add('hidden');
        elements.tagDropdown?.classList.add('hidden');
        elements.tagColorDropdown?.classList.add('hidden');
        elements.selectByTagDropdown?.classList.add('hidden');
        elements.userDropdown?.classList.add('hidden');
    });

    // Settings
    elements.btnSettings?.addEventListener('click', handleOpenSettings);
    elements.modalSettings?.addEventListener('click', handleCloseModal);
    elements.settingShiftAmount?.addEventListener('change', handleSettingChange);
    elements.settingCtrlAmount?.addEventListener('change', handleSettingChange);
    elements.settingAutoArchive?.addEventListener('change', handleSettingChange);
    elements.settingMultiColumn?.addEventListener('change', handleSettingChange);
    elements.settingsBtnExport?.addEventListener('click', handleExport);
    elements.settingsBtnImport?.addEventListener('click', handleImportClick);
    elements.settingsBtnClear?.addEventListener('click', handleClearAllData);

    // Category Manager
    elements.btnManageCategories?.addEventListener('click', openCategoryManager);
    elements.modalCategories?.addEventListener('click', handleCloseModal);
    elements.btnAddCategoryManage?.addEventListener('click', handleAddCategory);
    elements.categoriesList?.addEventListener('click', handleCategoryListClick);

    elements.btnStatistics?.addEventListener('click', openStatistics);
    elements.modalStatistics?.addEventListener('click', handleCloseModal);

    // Archive
    elements.archiveTrigger?.addEventListener('click', handleArchiveToggle);
    elements.archiveContainer?.addEventListener('click', handleArchiveAction);

    // Spaces
    elements.btnAddSpace?.addEventListener('click', handleAddSpace);
    elements.spacesList?.addEventListener('click', handleSpaceAction);
    elements.spacesList?.addEventListener('contextmenu', handleSpaceContextMenu);

    // Context menu
    elements.contextMenu?.addEventListener('click', handleContextMenuAction);
    // elements.questContainer?.addEventListener('contextmenu', handleQuestContextMenu); // Disabled as requested
    document.addEventListener('click', hideContextMenu);

    // Space modal
    const modalSpace = $('#modal-space');
    if (modalSpace) {
        modalSpace.addEventListener('click', handleCloseModal);
        $('#color-presets')?.addEventListener('click', handleColorSwatchClick);
        $('#btn-save-space')?.addEventListener('click', handleSaveSpace);
        $('#btn-delete-space')?.addEventListener('click', handleDeleteSpace);
    }

    // Category Collapse delegation
    elements.questContainer?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-collapse-category');
        if (btn) {
            const group = btn.closest('.category-group');
            const category = group?.dataset.category;
            if (category) {
                if (state.collapsedCategories.has(category)) {
                    state.collapsedCategories.delete(category);
                } else {
                    state.collapsedCategories.add(category);
                }
                render();
            }
        }
    });

    // Quest container delegation
    elements.questContainer?.addEventListener('click', handleQuestAction);
    elements.questContainer?.addEventListener('focusout', handleNotesBlur);

    // Search
    let searchTimeout;
    elements.searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            setSearchQuery(e.target.value.trim());
            elements.searchClear?.classList.toggle('hidden', !searchQuery);
            render();
        }, 150);
    });
    elements.searchClear?.addEventListener('click', () => {
        if (elements.searchInput) elements.searchInput.value = '';
        setSearchQuery('');
        elements.searchClear?.classList.add('hidden');
        render();
    });
    elements.searchAllSpaces?.addEventListener('change', () => {
        if (searchQuery) render();
    });

    // Bulk mode
    elements.btnBulkMode?.addEventListener('click', toggleBulkMode);
    elements.bulkSelectAll?.addEventListener('click', selectAllItems);
    elements.bulkArchive?.addEventListener('click', () => {
        if (selectedItems.size > 0) bulkArchiveItems();
    });
    elements.bulkDelete?.addEventListener('click', async () => {
        if (selectedItems.size === 0) return;
        const confirmed = await showConfirm(`Delete ${selectedItems.size} items permanently?`, 'BULK DELETE', true);
        if (confirmed) bulkDeleteItems();
    });
    elements.bulkCancel?.addEventListener('click', exitBulkMode);

    // Select by Tag (bulk mode)
    if (elements.btnSelectByTag) {
        elements.btnSelectByTag.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = elements.selectByTagDropdown?.classList.contains('hidden');
            if (isHidden) {
                populateSelectByTagDropdown();
                const rect = elements.btnSelectByTag.getBoundingClientRect();
                if (elements.selectByTagDropdown) {
                    elements.selectByTagDropdown.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
                    elements.selectByTagDropdown.style.left = rect.left + 'px';
                    elements.selectByTagDropdown.classList.remove('hidden');
                }
            } else {
                elements.selectByTagDropdown?.classList.add('hidden');
            }
        });
        elements.selectByTagDropdown?.addEventListener('click', (e) => {
            e.stopPropagation();
            handleSelectByTagClick(e);
        });
    }

    // Auth
    elements.btnLogin?.addEventListener('click', openAuthModal);
    elements.btnUserMenu?.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.userDropdown?.classList.toggle('hidden');
    });
    elements.btnLogout?.addEventListener('click', handleLogout);
    elements.modalAuth?.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop') || e.target.closest('.modal-close')) closeAuthModal();
    });
    elements.authTabs.forEach(tab => tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab)));
    elements.formSignin?.addEventListener('submit', handleSignIn);
    elements.formSignup?.addEventListener('submit', handleSignUp);
    elements.formReset?.addEventListener('submit', handlePasswordReset);
    elements.btnForgotPassword?.addEventListener('click', showPasswordReset);
    elements.btnBackToSignin?.addEventListener('click', () => switchAuthTab('signin'));
    elements.btnGoogleSignin?.addEventListener('click', handleGoogleSignIn);
    elements.btnExportData?.addEventListener('click', handleExportData);
    elements.btnChangeName?.addEventListener('click', handleChangeName);
    elements.btnShowInfo?.addEventListener('click', handleShowInfo);
    elements.btnDeleteAccount?.addEventListener('click', handleDeleteAccount);



    // Tag manager
    elements.btnManageTags?.addEventListener('click', openTagManager);
    elements.modalTags?.addEventListener('click', handleCloseModal);
    elements.tagsList?.addEventListener('click', handleTagListClick);
    elements.btnAddTag?.addEventListener('click', handleAddTag);
    elements.newTagName?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag();
        }
    });

    // Edit Tags modal (context menu)
    elements.modalEditTags?.addEventListener('click', handleCloseModal);
    elements.editTagsList?.addEventListener('click', handleEditTagsClick);
    elements.btnSaveTags?.addEventListener('click', saveItemTags);

    // Tag color picker (in tag manager)
    // Tag color picker
    initTagColorPicker();

    // Tag picker - now opens a modal instead of dropdown
    if (elements.btnTagPicker) {
        elements.btnTagPicker.addEventListener('click', (e) => {
            e.stopPropagation();
            openFormTagsModal();
            keepFormOpen();
        });
    }

    // Form Tags Modal event listeners
    elements.modalFormTags?.addEventListener('click', handleCloseModal);
    elements.formTagsList?.addEventListener('click', handleFormTagsClick);
    elements.btnSaveFormTags?.addEventListener('click', closeFormTagsModal);

    // File manager
    elements.storageUsage?.addEventListener('click', openFileManager);
    elements.modalFiles?.addEventListener('click', handleCloseModal);
    elements.btnRefreshFiles?.addEventListener('click', loadStorageFiles);
    elements.filesList?.addEventListener('click', handleFileClick);

    // Share modal
    elements.btnGenerateShareLink?.addEventListener('click', handleGenerateShareLink);
    elements.btnCopyShareLink?.addEventListener('click', handleCopyShareLink);
    elements.modalShare?.addEventListener('click', handleCloseModal);

    // Note: Invite check moved to auth callback below to ensure auth state is ready

    // Window handlers
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('resize', resizeCanvas);

    // Firebase auth listener
    if (window.FirebaseBridge?.isConfigured) {
        window.FirebaseBridge.onAuthChange(async (user) => {
            updateAuthUI(user);
            if (user) {
                // Process any pending invite after login
                await processPendingInvite();
            }
            // Check for invite code in URL (now that auth state is known)
            checkAndAcceptInvite();
        });
        startSyncTimeInterval();
        console.log('FETCH QUEST v3.0 initialized. Firebase active.');
    } else {
        console.log('FETCH QUEST v3.0 initialized. Local storage only.');
    }
}

// Start app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
