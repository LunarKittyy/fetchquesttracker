/**
 * FETCH QUEST v3.0 - Main Application Coordinator
 * ES Module-based architecture
 */

// --- Core Imports ---
import {
    state, syncActiveSpace, DEFAULT_CATEGORIES, STORAGE_KEY,
    currentType, setCurrentType, tempObjectives, setTempObjectives,
    tempImageData, setTempImageData, searchQuery, setSearchQuery,
    bulkMode, selectedItems, pendingLocalChange, setPendingLocalChange
} from './js/state.js';

import {
    $, $$, generateId, escapeHtml, isItemComplete, getItemProgress,
    sortItems, getUniqueCategories, groupItemsByCategory, getCategoryProgress, normalizeItem, debounce
} from './js/utils.js';

import { initPopup, showPopup, showConfirm, showAlert, showPrompt } from './js/popup.js';
import { initParticleElements, initParticles, celebrate, playSound, resizeCanvas } from './js/particles.js';
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
    handleGoogleSignIn, handleLogout, handleExportData, handleDeleteAccount, handleRealtimeUpdate
} from './js/auth-ui.js';

// --- DOM Element References ---
const elements = {
    // Form elements
    form: $('#add-quest-form'),
    addQuestForm: $('.add-quest-wrapper'),
    itemName: $('#item-name'),
    itemImage: $('#item-image'),
    itemCategory: $('#item-category'),
    itemGoal: $('#item-goal'),
    itemColor: $('#item-color'),
    itemPriority: $('#item-priority'),
    typeToggle: $('.type-toggle'),
    typeBtns: $$('.type-btn'),
    objectivesList: $('#objectives-list'),
    btnAddObjective: $('#btn-add-objective'),
    btnAddImage: $('#btn-add-image'),
    imagePreview: $('#image-preview'),

    // Color/Priority pickers
    btnColorPicker: $('#btn-color-picker'),
    colorIndicator: $('#color-indicator'),
    colorDropdown: $('#color-dropdown'),
    btnPriorityPicker: $('#btn-priority-picker'),
    priorityIndicator: $('#priority-indicator'),
    priorityDropdown: $('#priority-dropdown'),

    // Quest display
    questContainer: $('#quest-container'),
    emptyState: $('#empty-state'),

    // Modals
    modalCategory: $('#modal-category'),
    categoryInput: $('#new-category-name'),
    btnAddCategory: $('#btn-add-category'),
    btnSaveCategory: $('#btn-save-category'),
    modalImage: $('#modal-image'),
    btnImageUrl: $('#btn-image-url'),
    btnImageLocal: $('#btn-image-local'),
    imageUrlInput: $('#image-url-input'),
    imageUrlField: $('#image-url-field'),
    imageFileInput: $('#image-file-input'),
    imageModalPreview: $('#image-modal-preview'),
    imageModalPreviewImg: $('#image-modal-preview img'),
    btnRemoveImage: $('#btn-remove-image'),
    btnSaveImage: $('#btn-save-image'),
    modalSettings: $('#modal-settings'),
    btnSettings: $('#btn-settings'),
    settingShiftAmount: $('#setting-shift-amount'),
    settingCtrlAmount: $('#setting-ctrl-amount'),
    settingAutoArchive: $('#setting-auto-archive'),
    settingMultiColumn: $('#setting-multi-column'),
    settingsBtnExport: $('#settings-export'),
    settingsBtnImport: $('#settings-import'),
    settingsBtnClear: $('#settings-clear'),
    fileImport: $('#file-import'),

    // Status bar
    statusTotal: $('#status-total'),
    statusComplete: $('#status-complete'),
    saveIndicator: $('#save-indicator'),

    // Archive
    archivePanel: $('#archive-panel'),
    archiveTrigger: $('#archive-trigger'),
    archiveContainer: $('#archive-container'),
    archiveCount: $('#archive-count'),

    // Spaces
    spacesList: $('#spaces-list'),
    btnAddSpace: $('#btn-add-space'),

    // Search
    searchInput: $('#search-input'),
    searchClear: $('#search-clear'),
    searchAllSpaces: $('#search-all-spaces'),

    // Bulk actions
    btnBulkMode: $('#btn-bulk-mode'),
    bulkActionsBar: $('#bulk-actions-bar'),
    bulkCount: $('#bulk-count'),
    bulkSelectAll: $('#bulk-select-all'),
    bulkArchive: $('#bulk-archive'),
    bulkDelete: $('#bulk-delete'),
    bulkCancel: $('#bulk-cancel'),

    // Auth elements
    btnLogin: $('#btn-login'),
    userMenu: $('#user-menu'),
    btnUserMenu: $('#btn-user-menu'),
    userEmail: $('#user-email'),
    userDropdown: $('#user-dropdown'),
    btnLogout: $('#btn-logout'),
    btnExportData: $('#btn-export-data'),
    btnDeleteAccount: $('#btn-delete-account'),
    modalAuth: $('#modal-auth'),
    authTabs: $$('.auth-tab'),
    formSignin: $('#form-signin'),
    formSignup: $('#form-signup'),
    formReset: $('#form-reset'),
    signinError: $('#signin-error'),
    signupError: $('#signup-error'),
    resetError: $('#reset-error'),
    resetMessage: $('#reset-message'),
    authDivider: $('#auth-divider'),
    btnGoogleSignin: $('#btn-google-signin'),
    btnForgotPassword: $('#btn-forgot-password'),
    btnBackToSignin: $('#btn-back-to-signin'),
    syncStatus: $('#sync-status'),
    lastSynced: $('#last-synced'),
    storageUsage: $('#storage-usage'),
    storageFill: $('#storage-fill'),
    storageText: $('#storage-text'),

    // Statistics
    modalStatistics: $('#modal-statistics'),
    btnStatistics: $('#btn-statistics'),
    statTotal: $('#stat-total'),
    statCompleted: $('#stat-completed'),
    statActive: $('#stat-active'),
    statRate: $('#stat-rate'),
    statsCategories: $('#stats-categories'),
    statsSpaces: $('#stats-spaces'),

    // Category manager
    btnManageCategories: $('#btn-manage-categories'),
    modalCategories: $('#modal-categories'),
    categoriesList: $('#categories-list'),
    btnShareProgress: $('#btn-share-progress'),

    // File manager
    modalFiles: $('#modal-files'),
    filesList: $('#files-list'),
    btnRefreshFiles: $('#btn-refresh-files'),

    // Context menu
    contextMenu: $('#context-menu'),

    // Particles & sounds
    particlesCanvas: $('#particles-canvas'),
    celebrationOverlay: $('#celebration-overlay'),
    soundTick: $('#sound-tick'),
    soundComplete: $('#sound-complete'),
    soundFanfare: $('#sound-fanfare')
};

// --- Main Render Function ---
function render() {
    updateCategoryDropdown();
    updateStatusBar();
    renderSpaces();

    if (elements.questContainer) {
        elements.questContainer.classList.toggle('multi-column', state.multiColumn);
    }

    const existingGroups = elements.questContainer?.querySelectorAll('.category-group') || [];
    existingGroups.forEach(g => g.remove());

    let itemsToRender = state.items;

    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchAllSpacesChecked = elements.searchAllSpaces?.checked;

        if (searchAllSpacesChecked) {
            itemsToRender = [];
            state.spaces.forEach(space => {
                const matches = space.items.filter(item =>
                    item.name.toLowerCase().includes(query) ||
                    item.category.toLowerCase().includes(query)
                );
                itemsToRender.push(...matches);
            });
        } else {
            itemsToRender = state.items.filter(item =>
                item.name.toLowerCase().includes(query) ||
                item.category.toLowerCase().includes(query)
            );
        }
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

    return `
        <section class="category-group" data-category="${escapeHtml(category)}">
            <div class="category-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                <h2 class="category-name">${escapeHtml(category)}</h2>
                <span class="category-count">${categoryItems.length}</span>
                <div class="category-progress-wrapper">
                    <div class="category-progress">
                        <div class="category-progress-fill" style="width: ${progress.percent}%"></div>
                    </div>
                    <span class="category-progress-text">${progress.current}/${progress.total}</span>
                </div>
            </div>
            <div class="category-items">${itemsHTML}</div>
        </section>
    `;
}

function updateStatusBar() {
    const total = state.items.length;
    const complete = state.items.filter(i => isItemComplete(i)).length;

    if (elements.statusTotal) elements.statusTotal.textContent = total;
    if (elements.statusComplete) elements.statusComplete.textContent = complete;
}

// --- Form Handlers ---
function handleFormSubmit(e) {
    e.preventDefault();

    const name = elements.itemName.value.trim();
    const hasImage = tempImageData || elements.itemImage.value;

    if (!name && !hasImage) return;

    addItem({
        type: currentType,
        name: name || 'Unnamed Item',
        imageUrl: tempImageData || elements.itemImage.value || null,
        category: elements.itemCategory.value,
        color: elements.itemColor.value || null,
        priority: elements.itemPriority.value || null,
        target: parseInt(elements.itemGoal.value) || 1,
        objectives: currentType === 'quest' ? [...tempObjectives] : []
    });

    // Reset form
    elements.itemName.value = '';
    elements.itemImage.value = '';
    elements.itemColor.value = '';
    elements.itemPriority.value = '';
    setTempImageData(null);
    elements.btnAddImage?.classList.remove('has-image');
    elements.imagePreview?.classList.add('hidden');
    elements.itemGoal.value = '4';
    setTempObjectives([]);
    if (elements.objectivesList) elements.objectivesList.innerHTML = '';
    elements.itemName.focus();
    updateFormContentState();
}

function handleTypeToggle(e) {
    const btn = e.target.closest('.type-btn');
    if (!btn) return;

    const newType = btn.dataset.type;
    setCurrentType(newType);
    elements.typeBtns.forEach(b => b.classList.toggle('active', b.dataset.type === newType));
    elements.addQuestForm?.classList.toggle('quest-mode', newType === 'quest');
}

// Update form's has-content class based on whether user entered any content
function updateFormContentState() {
    const hasText = elements.itemName?.value.trim().length > 0;
    const hasImage = tempImageData !== null || elements.btnAddImage?.classList.contains('has-image');
    const hasObjectives = tempObjectives.length > 0;

    if (hasText || hasImage || hasObjectives) {
        elements.form?.classList.add('has-content');
    } else {
        elements.form?.classList.remove('has-content');
    }
}

function handleAddObjective() {
    const id = generateId();
    const newObj = { id, name: '', current: 0, target: 1 };
    setTempObjectives([...tempObjectives, newObj]);
    renderObjectives();
    updateFormContentState();
}

function handleRemoveObjective(e) {
    const btn = e.target.closest('.btn-remove-objective');
    if (!btn) return;
    const id = btn.dataset.id;
    setTempObjectives(tempObjectives.filter(o => o.id !== id));
    renderObjectives();
}

function renderObjectives() {
    if (!elements.objectivesList) return;
    elements.objectivesList.innerHTML = tempObjectives.map(obj => `
        <div class="objective-row" data-id="${obj.id}">
            <input type="text" class="objective-name-input" placeholder="Objective name" value="${escapeHtml(obj.name)}" data-field="name">
            <input type="number" class="objective-target-input" min="1" value="${obj.target}" data-field="target">
            <button type="button" class="btn-remove-objective" data-id="${obj.id}">×</button>
        </div>
    `).join('');

    elements.objectivesList.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', (e) => {
            const row = e.target.closest('.objective-row');
            const id = row.dataset.id;
            const field = e.target.dataset.field;
            const value = field === 'target' ? parseInt(e.target.value) : e.target.value;
            setTempObjectives(tempObjectives.map(o => o.id === id ? { ...o, [field]: value } : o));
        });
    });
}

// --- Quest Action Handler ---
function handleQuestAction(e) {
    const btn = e.target.closest('[data-action]');
    const card = e.target.closest('.quest-card');

    if (bulkMode && card && !btn) {
        handleBulkCardClick(card);
        return;
    }

    if (!btn && !card) return;

    const action = btn?.dataset.action;
    const itemId = card?.dataset.id;

    if (!action && !itemId) return;

    const item = state.items.find(i => i.id === itemId);

    switch (action) {
        case 'increment':
        case 'decrement': {
            if (!item) return;
            let delta = action === 'increment' ? 1 : -1;
            if (e.shiftKey) delta *= state.shiftAmount;
            if (e.ctrlKey) delta *= state.ctrlAmount;
            const newVal = Math.max(0, item.current + delta);
            updateItemField(itemId, 'current', newVal);
            updateCardProgress(itemId, archiveItem);
            if (action === 'increment') playSound('tick');
            break;
        }
        case 'obj-increment':
        case 'obj-decrement': {
            const objEl = btn.closest('.objective-item');
            const objId = objEl?.dataset.objectiveId;
            const objective = item?.objectives.find(o => o.id === objId);
            if (!objective) return;
            let delta = action === 'obj-increment' ? 1 : -1;
            if (e.shiftKey) delta *= state.shiftAmount;
            if (e.ctrlKey) delta *= state.ctrlAmount;
            const newVal = Math.max(0, objective.current + delta);
            updateItemField(itemId, 'current', newVal, objId);
            updateObjectiveDisplay(itemId, objId, archiveItem);
            break;
        }
        case 'archive':
            archiveItem(itemId);
            break;
        case 'delete':
            showConfirm('Remove this target?', 'DELETE ITEM', true).then(confirmed => {
                if (confirmed) deleteItem(itemId);
            });
            break;
        case 'toggle-notes': {
            const notesSection = card.querySelector('.quest-notes');
            notesSection?.classList.toggle('hidden');
            break;
        }
        case 'edit-name': {
            const nameEl = e.target.closest('.quest-name-text');
            if (!nameEl || !item) return;
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'quest-name-edit';
            input.value = item.name;
            nameEl.replaceWith(input);
            input.focus();
            input.select();
            input.addEventListener('blur', () => {
                const newName = input.value.trim() || item.name;
                updateItemField(itemId, 'name', newName);
                const span = document.createElement('span');
                span.className = 'quest-name-text';
                span.dataset.action = 'edit-name';
                span.textContent = newName;
                input.replaceWith(span);
            });
            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') input.blur();
                if (ev.key === 'Escape') {
                    input.value = item.name;
                    input.blur();
                }
            });
            break;
        }
    }
}

function handleNotesBlur(e) {
    if (e.target.classList.contains('notes-textarea')) {
        const card = e.target.closest('.quest-card');
        if (card) {
            updateItemField(card.dataset.id, 'notes', e.target.value);
        }
    }
}

// --- Modal Handlers ---
function handleCloseModal(e) {
    if (e.target.classList.contains('modal-backdrop') || e.target.closest('.modal-close')) {
        e.target.closest('.modal')?.classList.add('hidden');
    }
}

function handleAddCategory() {
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
    const confirmed1 = await showConfirm('Delete ALL data? This cannot be undone!', 'CLEAR DATA', true);
    if (!confirmed1) return;
    const confirmed2 = await showConfirm('Really? This will permanently remove everything.', 'FINAL WARNING', true);
    if (!confirmed2) return;

    state.items.length = 0;
    state.archivedItems.length = 0;
    state.categories = [...DEFAULT_CATEGORIES];
    saveState();
    render();
    renderArchive();
    updateCategoryDropdown();
    elements.modalSettings?.classList.add('hidden');
}

// --- Image Handlers ---
function handleOpenImageModal() {
    elements.modalImage?.classList.remove('hidden');
    elements.imageUrlInput?.classList.add('hidden');
    elements.imageModalPreview?.classList.add('hidden');
    elements.btnImageUrl?.classList.remove('active');
    elements.btnImageLocal?.classList.remove('active');
    if (elements.imageUrlField) elements.imageUrlField.value = '';
}

function handleImageUrlOption() {
    elements.btnImageUrl?.classList.add('active');
    elements.btnImageLocal?.classList.remove('active');
    elements.imageUrlInput?.classList.remove('hidden');
    elements.imageUrlField?.focus();
}

function handleImageLocalOption() {
    elements.btnImageUrl?.classList.remove('active');
    elements.btnImageLocal?.classList.add('active');
    elements.imageFileInput?.click();
}

function handleImageUrlChange() {
    const url = elements.imageUrlField?.value.trim();
    if (url && elements.imageModalPreviewImg) {
        elements.imageModalPreviewImg.src = url;
        elements.imageModalPreview?.classList.remove('hidden');
    } else {
        elements.imageModalPreview?.classList.add('hidden');
    }
}

function handleImageFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        if (elements.imageModalPreviewImg) elements.imageModalPreviewImg.src = event.target.result;
        elements.imageModalPreview?.classList.remove('hidden');
        elements.imageUrlInput?.classList.add('hidden');
    };
    reader.readAsDataURL(file);
    e.target.value = null;
}

function handleRemovePreviewImage() {
    elements.imageModalPreview?.classList.add('hidden');
    if (elements.imageModalPreviewImg) elements.imageModalPreviewImg.src = '';
    if (elements.imageUrlField) elements.imageUrlField.value = '';
}

function handleSaveImage() {
    const previewSrc = elements.imageModalPreviewImg?.src;
    if (previewSrc && previewSrc !== window.location.href) {
        setTempImageData(previewSrc);
        elements.btnAddImage?.classList.add('has-image');
        if (elements.imagePreview) {
            elements.imagePreview.innerHTML = `<img src="${tempImageData}" alt="Preview">`;
            elements.imagePreview.classList.remove('hidden');
        }
    } else {
        setTempImageData(null);
        elements.btnAddImage?.classList.remove('has-image');
        elements.imagePreview?.classList.add('hidden');
    }
    elements.modalImage?.classList.add('hidden');
    updateFormContentState();
}

// --- Category Manager ---
function openCategoryManager() {
    elements.modalSettings?.classList.add('hidden');
    elements.modalCategories?.classList.remove('hidden');
    renderCategoryList();
}

function renderCategoryList() {
    if (!elements.categoriesList) return;
    // Count how many items use each category
    const usageCount = {};
    state.items.forEach(item => {
        const cat = item.category || 'Misc';
        usageCount[cat] = (usageCount[cat] || 0) + 1;
    });

    elements.categoriesList.innerHTML = state.categories.map(cat => {
        const count = usageCount[cat] || 0;
        const isUsed = count > 0;
        // Allow deleting ANY category that's not in use (including presets)
        return `
            <div class="category-item" data-category="${escapeHtml(cat)}">
                <div class="category-item-info">
                    <span class="category-item-name">${escapeHtml(cat)}</span>
                    ${isUsed ? `<span class="category-item-count">(${count} item${count !== 1 ? 's' : ''})</span>` : ''}
                </div>
                <button class="category-item-delete${isUsed ? ' is-disabled' : ''}" data-in-use="${isUsed}" title="${isUsed ? 'In use' : 'Delete'}">×</button>
            </div>
        `;
    }).join('');
}

function handleCategoryClick(e) {
    const deleteBtn = e.target.closest('.category-item-delete');
    if (!deleteBtn) return;

    // Show alert if category is in use
    if (deleteBtn.dataset.inUse === 'true') {
        showAlert('Category is in use by items and cannot be deleted.', 'ERROR');
        return;
    }

    const item = deleteBtn.closest('.category-item');
    const category = item?.dataset.category;
    if (!category) return;

    const idx = state.categories.indexOf(category);
    if (idx !== -1) {
        state.categories.splice(idx, 1);
        saveState();
        updateCategoryDropdown();
        renderCategoryList();
    }
}

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
function init() {
    // Initialize modules
    initPopup();
    initParticleElements();
    initStorage({
        saveIndicator: elements.saveIndicator,
        lastSynced: elements.lastSynced,
        storageFill: elements.storageFill,
        storageText: elements.storageText
    }, { renderSpaces, updateSyncStatusUI });

    initSpaces({ render, renderArchive, updateCategoryDropdown });
    initArchive({ archivePanel: elements.archivePanel, archiveContainer: elements.archiveContainer, archiveCount: elements.archiveCount },
        { insertItemIntoDOM, cleanupEmptyCategory, updateCategoryProgress, updateStatusBar });
    initBulk({ btnBulkMode: elements.btnBulkMode, bulkActionsBar: elements.bulkActionsBar, bulkCount: elements.bulkCount },
        { render, renderArchive });
    initContextMenu({ contextMenu: elements.contextMenu },
        { openSpaceEditModal, handleDeleteSpace, archiveItem, deleteItem });
    initStatistics({
        modalStatistics: elements.modalStatistics, modalSettings: elements.modalSettings,
        statTotal: elements.statTotal, statCompleted: elements.statCompleted,
        statActive: elements.statActive, statRate: elements.statRate,
        statsCategories: elements.statsCategories, statsSpaces: elements.statsSpaces
    });
    initFileManager({ modalFiles: elements.modalFiles, filesList: elements.filesList });
    initQuests({ renderArchive, updateStatusBar });
    initAuthUI({
        modalAuth: elements.modalAuth, authTabs: elements.authTabs,
        formSignin: elements.formSignin, formSignup: elements.formSignup,
        formReset: elements.formReset, signinError: elements.signinError,
        signupError: elements.signupError, resetError: elements.resetError,
        resetMessage: elements.resetMessage, authDivider: elements.authDivider,
        btnGoogleSignin: elements.btnGoogleSignin, btnLogin: elements.btnLogin,
        userMenu: elements.userMenu, userEmail: elements.userEmail,
        userDropdown: elements.userDropdown, syncStatus: elements.syncStatus
    }, { render, renderArchive, renderSpaces });

    // Load state and render
    loadState();
    sortItems(state.items);
    render();
    initParticles();
    renderArchive();
    renderSpaces();

    // Event listeners
    elements.form?.addEventListener('submit', handleFormSubmit);
    elements.typeBtns.forEach(btn => btn.addEventListener('click', handleTypeToggle));
    elements.btnAddObjective?.addEventListener('click', handleAddObjective);
    elements.objectivesList?.addEventListener('click', handleRemoveObjective);
    elements.questContainer?.addEventListener('click', handleQuestAction);
    elements.questContainer?.addEventListener('blur', handleNotesBlur, true);
    elements.btnAddCategory?.addEventListener('click', handleAddCategory);
    elements.btnSaveCategory?.addEventListener('click', handleSaveCategory);
    elements.modalCategory?.addEventListener('click', handleCloseModal);
    elements.categoriesList?.addEventListener('click', handleCategoryClick);
    elements.fileImport?.addEventListener('change', handleFileChange);
    document.addEventListener('keydown', handleKeydown);

    // Image picker
    elements.btnAddImage?.addEventListener('click', handleOpenImageModal);
    elements.btnImageUrl?.addEventListener('click', handleImageUrlOption);
    elements.btnImageLocal?.addEventListener('click', handleImageLocalOption);
    elements.imageUrlField?.addEventListener('input', handleImageUrlChange);
    elements.imageFileInput?.addEventListener('change', handleImageFileSelect);
    elements.btnRemoveImage?.addEventListener('click', handleRemovePreviewImage);
    elements.btnSaveImage?.addEventListener('click', handleSaveImage);
    elements.modalImage?.addEventListener('click', handleCloseModal);

    // Form content state - prevent collapse when has content
    elements.itemName?.addEventListener('input', updateFormContentState);

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
        });
    }

    // Close dropdowns on outside click
    document.addEventListener('click', () => {
        elements.colorDropdown?.classList.add('hidden');
        elements.priorityDropdown?.classList.add('hidden');
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
    elements.questContainer?.addEventListener('contextmenu', handleQuestContextMenu);
    document.addEventListener('click', hideContextMenu);

    // Space modal
    const modalSpace = $('#modal-space');
    if (modalSpace) {
        modalSpace.addEventListener('click', handleCloseModal);
        $('#color-presets')?.addEventListener('click', handleColorSwatchClick);
        $('#btn-save-space')?.addEventListener('click', handleSaveSpace);
        $('#btn-delete-space')?.addEventListener('click', handleDeleteSpace);
    }

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
    elements.btnDeleteAccount?.addEventListener('click', handleDeleteAccount);

    // Category manager
    elements.btnManageCategories?.addEventListener('click', openCategoryManager);
    elements.modalCategories?.addEventListener('click', handleCloseModal);
    elements.categoriesList?.addEventListener('click', handleCategoryClick);
    elements.btnShareProgress?.addEventListener('click', shareProgress);

    // File manager
    elements.storageUsage?.addEventListener('click', openFileManager);
    elements.modalFiles?.addEventListener('click', handleCloseModal);
    elements.btnRefreshFiles?.addEventListener('click', loadStorageFiles);
    elements.filesList?.addEventListener('click', handleFileClick);

    // Window handlers
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('resize', resizeCanvas);

    // Firebase auth listener
    if (window.FirebaseBridge?.isConfigured) {
        window.FirebaseBridge.onAuthChange(updateAuthUI);
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
