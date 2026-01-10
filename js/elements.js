/**
 * FETCH QUEST DOM ELEMENTS
 * Centralized reference to all DOM elements used across the application.
 */

import { $, $$ } from './utils.js';

export const elements = {
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
    itemFields: $('#item-fields'),
    questFields: $('#quest-fields'),
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
    settingsBtnExport: $('#settings-btn-export'),
    settingsBtnImport: $('#settings-btn-import'),
    settingsBtnClear: $('#settings-btn-clear'),
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
    btnSelectByTag: $('#btn-select-by-tag'),
    selectByTagDropdown: $('#select-by-tag-dropdown'),
    bulkArchive: $('#bulk-archive'),
    bulkDelete: $('#bulk-delete'),
    bulkCancel: $('#bulk-cancel'),

    // Auth elements
    btnLogin: $('#btn-login'),
    userMenu: $('#user-menu'),
    btnUserMenu: $('#btn-user-menu'),
    userDisplayName: $('#user-display-name'),
    btnShowInfo: $('#btn-show-info'),
    userDropdown: $('#user-dropdown'),
    btnLogout: $('#btn-logout'),
    btnExportData: $('#btn-export-data'),
    btnChangeName: $('#btn-change-name'),
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

    // Tag manager
    btnManageTags: $('#btn-manage-tags'),
    modalTags: $('#modal-tags'),
    tagsList: $('#tags-list'),
    newTagName: $('#new-tag-name'),
    btnTagColor: $('#btn-tag-color'),
    btnAddTag: $('#btn-add-tag'),
    tagColorDropdown: $('#tag-color-dropdown'),

    // Tag picker (in form)
    btnTagPicker: $('#btn-tag-picker'),
    tagIndicator: $('#tag-indicator'),
    tagDropdown: $('#tag-dropdown'),

    // Edit Tags modal (context menu)
    modalEditTags: $('#modal-edit-tags'),
    editTagsItemId: $('#edit-tags-item-id'),
    editTagsList: $('#edit-tags-list'),
    btnSaveTags: $('#btn-save-tags'),

    // File manager
    modalFiles: $('#modal-files'),
    filesList: $('#files-list'),
    btnRefreshFiles: $('#btn-refresh-files'),

    // Share modal
    modalShare: $('#modal-share'),
    shareSpaceId: $('#share-space-id'),
    shareRole: $('#share-role'),
    shareLinkContainer: $('#share-link-container'),
    shareLinkUrl: $('#share-link-url'),
    shareLinkExpiry: $('#share-link-expiry'),
    btnGenerateShareLink: $('#btn-generate-share-link'),
    btnCopyShareLink: $('#btn-copy-share-link'),

    // Context menu
    contextMenu: $('#context-menu'),

    // Particles
    particlesCanvas: $('#particles-canvas'),
    celebrationOverlay: $('#celebration-overlay')
};
