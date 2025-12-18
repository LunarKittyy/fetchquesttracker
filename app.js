/**
 * FETCH QUEST v2.1 - Enhanced Loot & Quest Tracker
 * Vanilla JavaScript with localStorage persistence
 * Surgical DOM updates for smooth UX
 */

(function () {
    'use strict';

    // --- Constants ---
    const STORAGE_KEY = 'fetchquest_data_v2';
    const DEFAULT_CATEGORIES = ['Misc', 'Main Quest', 'Side Quest', 'Crafting', 'Collectibles'];

    // --- State ---
    let state = {
        spaces: [],
        activeSpaceId: null,
        soundEnabled: false,
        shiftAmount: 5,
        ctrlAmount: 10,
        autoArchive: true
    };

    // Pointers for active space data (to minimize changes to existing code)
    let activeSpace = null;

    // --- DOM References ---
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const elements = {
        form: $('#add-quest-form'),
        itemName: $('#item-name'),
        itemGoal: $('#item-goal'),
        itemImage: $('#item-image'),
        itemCategory: $('#item-category'),
        addQuestForm: $('#add-quest-form'),
        questContainer: $('#quest-container'),
        emptyState: $('#empty-state'),
        fileImport: $('#file-import'),
        statusTotal: $('#status-total'),
        statusComplete: $('#status-complete'),
        // Search
        searchInput: $('#search-input'),
        searchAllSpaces: $('#search-all-spaces'),
        searchClear: $('#search-clear'),
        typeBtns: $$('.type-btn'),
        itemFields: $('#item-fields'),
        questFields: $('#quest-fields'),
        objectivesList: $('#objectives-list'),
        btnAddObjective: $('#btn-add-objective'),
        btnAddCategory: $('#btn-add-category'),
        modalCategory: $('#modal-category'),
        newCategoryName: $('#new-category-name'),
        btnSaveCategory: $('#btn-save-category'),
        particlesCanvas: $('#particles-canvas'),
        celebrationOverlay: $('#celebration-overlay'),
        soundTick: $('#sound-tick'),
        soundComplete: $('#sound-complete'),
        soundFanfare: $('#sound-fanfare'),
        // Image picker elements
        btnAddImage: $('#btn-add-image'),
        imagePreview: $('#image-preview'),
        modalImage: $('#modal-image'),
        btnImageUrl: $('#btn-image-url'),
        btnImageLocal: $('#btn-image-local'),
        imageUrlInput: $('#image-url-input'),
        imageUrlField: $('#image-url-field'),
        imageFileInput: $('#image-file-input'),
        imageModalPreview: $('#image-modal-preview'),
        imageModalPreviewImg: $('#image-modal-preview-img'),
        btnRemoveImage: $('#btn-remove-image'),
        btnSaveImage: $('#btn-save-image'),
        saveIndicator: $('#save-indicator'),
        // Settings modal elements
        btnSettings: $('#btn-settings'),
        modalSettings: $('#modal-settings'),
        settingShiftAmount: $('#setting-shift-amount'),
        settingCtrlAmount: $('#setting-ctrl-amount'),
        settingSoundEnabled: $('#setting-sound-enabled'),
        settingsBtnExport: $('#settings-btn-export'),
        settingsBtnImport: $('#settings-btn-import'),
        settingsBtnClear: $('#settings-btn-clear'),
        settingAutoArchive: $('#setting-auto-archive'),
        btnManageCategories: $('#btn-manage-categories'),
        btnShareProgress: $('#btn-share-progress'),
        modalCategories: $('#modal-categories'),
        categoriesList: $('#categories-list'),
        // Archive panel elements
        archivePanel: $('#archive-panel'),
        archiveTrigger: $('#archive-trigger'),
        archiveContainer: $('#archive-container'),
        archiveCount: $('#archive-count'),
        // Spaces sidebar
        spacesList: $('#spaces-list'),
        btnAddSpace: $('#btn-add-space'),
        // Color picker dropdown
        btnColorPicker: $('#btn-color-picker'),
        colorDropdown: $('#color-dropdown'),
        colorIndicator: $('#color-indicator'),
        itemColor: $('#item-color'),
        // Priority picker dropdown
        btnPriorityPicker: $('#btn-priority-picker'),
        priorityDropdown: $('#priority-dropdown'),
        priorityIndicator: $('#priority-indicator'),
        itemPriority: $('#item-priority'),
        // Bulk mode
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
        userDropdown: $('#user-dropdown'),
        userEmail: $('#user-email'),
        syncStatus: $('#sync-status'),
        btnSyncNow: $('#btn-sync-now'),
        btnLogout: $('#btn-logout'),
        modalAuth: $('#modal-auth'),
        authTabs: $$('.auth-tab'),
        formSignin: $('#form-signin'),
        formSignup: $('#form-signup'),
        formReset: $('#form-reset'),
        signinError: $('#signin-error'),
        signupError: $('#signup-error'),
        resetError: $('#reset-error'),
        resetMessage: $('#reset-message'),
        btnForgotPassword: $('#btn-forgot-password'),
        btnBackToSignin: $('#btn-back-to-signin'),
        btnGoogleSignin: $('#btn-google-signin'),
        authDivider: $('#auth-divider'),
        // Migration modal
        modalMigrate: $('#modal-migrate'),
        migrateSpacesCount: $('#migrate-spaces-count'),
        migrateItemsCount: $('#migrate-items-count'),
        btnMigrateSkip: $('#btn-migrate-skip'),
        btnMigrateUpload: $('#btn-migrate-upload'),
        // Account management
        lastSynced: $('#last-synced'),
        btnExportData: $('#btn-export-data'),
        btnDeleteAccount: $('#btn-delete-account'),
        // Storage display
        storageUsage: $('#storage-usage'),
        storageFill: $('#storage-fill'),
        storageText: $('#storage-text'),
        // File manager
        modalFiles: $('#modal-files'),
        filesList: $('#files-list'),
        btnRefreshFiles: $('#btn-refresh-files')
    };

    let currentType = 'item';
    let tempObjectives = [];
    let tempImageData = null;
    let particleCtx = null;
    let particles = [];
    let animationsPaused = false;
    let saveIndicatorTimeout = null;
    let searchQuery = '';
    let bulkMode = false;
    let selectedItems = new Set();
    let cloudSyncTimeout = null;
    let syncTimeInterval = null;
    let pendingLocalChange = false; // Flag to prevent incoming sync from overwriting local changes

    // --- LocalStorage Functions ---
    function saveState() {
        saveStateLocal();
        // Mark that we have a pending local change
        pendingLocalChange = true;
        // Auto-sync to cloud (debounced)
        if (window.FirebaseBridge?.currentUser) {
            debouncedCloudSync();
        }
    }

    // Save to localStorage only (no cloud sync) - for local preferences like activeSpaceId
    function saveStateLocal() {
        try {
            // For logged-in users, strip base64 images to save localStorage space
            // (images are stored in Firebase Storage instead)
            if (window.FirebaseBridge?.currentUser) {
                const stateForLocal = JSON.parse(JSON.stringify(state));
                stateForLocal.spaces.forEach(space => {
                    (space.items || []).forEach(item => {
                        if (item.imageUrl && item.imageUrl.startsWith('data:')) {
                            item.imageUrl = null; // Will be loaded from cloud
                        }
                        (item.objectives || []).forEach(obj => {
                            if (obj.imageUrl && obj.imageUrl.startsWith('data:')) {
                                obj.imageUrl = null;
                            }
                        });
                    });
                    (space.archivedItems || []).forEach(item => {
                        if (item.imageUrl && item.imageUrl.startsWith('data:')) {
                            item.imageUrl = null;
                        }
                    });
                });
                localStorage.setItem(STORAGE_KEY, JSON.stringify(stateForLocal));
            } else {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            }
            showSaveIndicator();
            // Update spaces progress live
            renderSpaces();
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
            // If quota exceeded, try saving without images
            if (e.name === 'QuotaExceededError') {
                try {
                    const minimalState = JSON.parse(JSON.stringify(state));
                    minimalState.spaces.forEach(space => {
                        (space.items || []).forEach(item => { item.imageUrl = null; });
                        (space.archivedItems || []).forEach(item => { item.imageUrl = null; });
                    });
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalState));
                    console.log('Saved without images due to quota');

                    // Notify non-logged-in users about storage limits
                    if (!window.FirebaseBridge?.currentUser) {
                        alert('⚠️ Storage limit reached!\n\nYour browser storage is full. Images have been removed to save your data.\n\nSign in to get cloud storage and keep your images safe!');
                    }
                } catch (e2) {
                    console.error('Still failed to save:', e2);
                    // Critical error - notify user
                    if (!window.FirebaseBridge?.currentUser) {
                        alert('❌ Storage full!\n\nUnable to save your data. Please sign in for cloud storage, or export your data and clear some quests.');
                    }
                }
            }
        }
    }

    function debouncedCloudSync() {
        if (cloudSyncTimeout) clearTimeout(cloudSyncTimeout);
        console.log('🔄 Cloud sync queued (2s debounce)');
        cloudSyncTimeout = setTimeout(async () => {
            if (!window.FirebaseBridge?.currentUser) {
                console.log('❌ No user, skipping sync');
                return;
            }

            // Check if user is hovering on a quest card - delay sync to prevent hover interruption
            const hoveredCard = document.querySelector('.quest-card:hover');
            if (hoveredCard) {
                console.log('🔄 Delaying sync (user hovering)');
                // Wait for hover to end, then retry
                hoveredCard.addEventListener('mouseleave', () => {
                    debouncedCloudSync();
                }, { once: true });
                return;
            }

            console.log('🔄 Starting cloud sync...');
            updateSyncStatusUI('syncing');
            const result = await window.FirebaseBridge.saveToCloud(state);
            console.log('🔄 Sync result:', result);
            if (result.success) {
                pendingLocalChange = false; // Local changes are now synced
                window.FirebaseBridge.updateLastSyncTime();
                updateSyncStatusUI('synced');
                updateLastSyncedDisplay();
                console.log('✅ Cloud sync complete');
            } else {
                updateSyncStatusUI('error');
                console.error('❌ Cloud sync failed:', result.error);
            }
        }, 2000); // 2 second debounce
    }

    function updateLastSyncedDisplay() {
        if (elements.lastSynced && window.FirebaseBridge) {
            elements.lastSynced.textContent = window.FirebaseBridge.getRelativeSyncTime();
        }
        updateStorageDisplay();
    }

    function updateStorageDisplay() {
        if (!window.FirebaseBridge || !elements.storageFill || !elements.storageText) return;
        const info = window.FirebaseBridge.getStorageInfo();

        // Update bar width
        elements.storageFill.style.width = `${info.percent}%`;

        // Update bar color based on usage
        elements.storageFill.className = 'storage-fill';
        if (info.percent >= 90) {
            elements.storageFill.classList.add('danger');
        } else if (info.percent >= 70) {
            elements.storageFill.classList.add('warning');
        }

        // Update text
        elements.storageText.textContent = `${info.usedMB} / ${info.limitMB} MB`;
    }

    function showSaveIndicator() {
        if (saveIndicatorTimeout) {
            clearTimeout(saveIndicatorTimeout);
        }
        elements.saveIndicator.classList.add('visible');
        saveIndicatorTimeout = setTimeout(() => {
            elements.saveIndicator.classList.remove('visible');
        }, 1500);
    }

    function loadState() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            let parsed = stored ? JSON.parse(stored) : null;

            if (parsed) {
                // Ensure global settings are loaded
                state.soundEnabled = parsed.soundEnabled !== false;
                state.shiftAmount = parsed.shiftAmount || 5;
                state.ctrlAmount = parsed.ctrlAmount || 10;
                state.autoArchive = parsed.autoArchive !== false;

                if (parsed.spaces && Array.isArray(parsed.spaces) && parsed.spaces.length > 0) {
                    state.spaces = parsed.spaces;
                    state.activeSpaceId = parsed.activeSpaceId || state.spaces[0].id;
                } else {
                    // Migration: Create first space from existing v2 data
                    const defaultSpace = {
                        id: 'space-' + Date.now(),
                        name: 'MAIN',
                        color: '#4ecdb4',
                        items: parsed.items || [],
                        archivedItems: parsed.archivedItems || [],
                        categories: parsed.categories || [...DEFAULT_CATEGORIES]
                    };
                    state.spaces = [defaultSpace];
                    state.activeSpaceId = defaultSpace.id;
                    delete parsed.items;
                    delete parsed.archivedItems;
                    delete parsed.categories;
                }
            } else {
                // Initial State
                const defaultSpace = {
                    id: 'space-' + Date.now(),
                    name: 'MAIN',
                    color: '#4ecdb4',
                    items: [],
                    archivedItems: [],
                    categories: [...DEFAULT_CATEGORIES]
                };
                state.spaces = [defaultSpace];
                state.activeSpaceId = defaultSpace.id;
            }

            // Set active space pointer and sync top-level state for legacy code
            syncActiveSpace();

            // Normalize items across all spaces
            state.spaces.forEach(space => {
                space.items = (space.items || []).map(item => normalizeItem(item));
                space.archivedItems = (space.archivedItems || []).map(item => normalizeItem(item));
            });

        } catch (e) {
            console.error('Failed to load from localStorage:', e);
            const defaultSpace = {
                id: 'space-' + Date.now(),
                name: 'MAIN',
                color: '#4ecdb4',
                items: [],
                archivedItems: [],
                categories: [...DEFAULT_CATEGORIES]
            };
            state = {
                spaces: [defaultSpace],
                activeSpaceId: defaultSpace.id,
                soundEnabled: false,
                shiftAmount: 5,
                ctrlAmount: 10,
                autoArchive: true
            };
            syncActiveSpace();
        }
    }

    function syncActiveSpace() {
        activeSpace = state.spaces.find(s => s.id === state.activeSpaceId) || state.spaces[0];
        state.activeSpaceId = activeSpace.id;

        // Expose items/archivedItems/categories at top level of state for existing code compatibility
        // Using Object.defineProperty to keep them in sync with activeSpace
        Object.defineProperty(state, 'items', {
            get: () => activeSpace.items,
            set: (val) => { activeSpace.items = val; },
            configurable: true
        });
        Object.defineProperty(state, 'archivedItems', {
            get: () => activeSpace.archivedItems,
            set: (val) => { activeSpace.archivedItems = val; },
            configurable: true
        });
        Object.defineProperty(state, 'categories', {
            get: () => activeSpace.categories,
            set: (val) => { activeSpace.categories = val; },
            configurable: true
        });
    }

    function normalizeItem(item) {
        return {
            id: item.id || generateId(),
            type: item.type || 'item',
            name: item.name || 'Unknown',
            imageUrl: item.imageUrl || null,
            category: item.category || 'Misc',
            current: item.current || 0,
            target: item.target || 1,
            objectives: (item.objectives || []).map(obj => ({
                id: obj.id || generateId(),
                name: obj.name || 'Objective',
                imageUrl: obj.imageUrl || null,
                current: obj.current || 0,
                target: obj.target || 1,
                complete: obj.complete || false
            })),
            createdAt: item.createdAt || Date.now(),
            completedAt: item.completedAt || null,
            color: item.color || null,
            priority: item.priority || null,
            notes: item.notes || ''
        };
    }

    // --- Spaces Management ---
    function renderSpaces() {
        const list = elements.spacesList;
        if (!list) return;

        list.innerHTML = state.spaces.map(space => {
            const isActive = space.id === state.activeSpaceId;
            const progress = calculateSpaceProgress(space);

            return `
                <div class="space-tab ${isActive ? 'active' : ''}" 
                     data-id="${space.id}" 
                     style="--space-color: ${space.color || 'var(--clr-accent-primary)'}">
                    <div class="space-progress" title="Completion: ${Math.round(progress)}%">
                        <div class="space-progress-fill" style="height: ${progress}%"></div>
                    </div>
                    <button class="space-tab-button" title="${escapeHtml(space.name)}">
                        ${escapeHtml(space.name)}
                    </button>
                </div>
            `;
        }).join('');
    }

    function calculateSpaceProgress(space) {
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

    function handleSpaceAction(e) {
        const tab = e.target.closest('.space-tab');
        if (!tab) return;

        const spaceId = tab.dataset.id;

        // Double-click or click on active space = open edit modal
        if (spaceId === state.activeSpaceId) {
            openSpaceEditModal(spaceId);
            return;
        }

        // Single click on different space = switch to it
        switchSpace(spaceId);
    }

    function switchSpace(spaceId) {
        state.activeSpaceId = spaceId;
        syncActiveSpace();
        saveStateLocal(); // Local only - don't sync just for switching spaces

        // Complete re-render
        render();
        renderArchive();
        renderSpaces();
        updateCategoryDropdown();

        playSound('tick');
    }

    function handleAddSpace() {
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

    function openSpaceEditModal(spaceId) {
        const space = state.spaces.find(s => s.id === spaceId);
        if (!space) return;

        const modal = $('#modal-space');
        if (!modal) return;

        $('#edit-space-id').value = spaceId;
        $('#edit-space-name').value = space.name;
        $('#edit-space-color').value = space.color;

        // Update modal title
        modal.querySelector('.modal-title').textContent = 'EDIT SPACE';

        // Show delete button only if not the last space
        const deleteBtn = $('#btn-delete-space');
        deleteBtn.style.display = state.spaces.length > 1 ? 'block' : 'none';

        // Highlight selected color
        updateColorSwatchSelection(space.color);

        modal.classList.remove('hidden');
        $('#edit-space-name').focus();
    }

    function updateColorSwatchSelection(color) {
        const swatches = $$('#color-presets .color-swatch');
        swatches.forEach(swatch => {
            swatch.classList.toggle('selected', swatch.dataset.color === color);
        });
    }

    function handleColorSwatchClick(e) {
        const swatch = e.target.closest('.color-swatch');
        if (!swatch) return;

        const color = swatch.dataset.color;
        $('#edit-space-color').value = color;
        updateColorSwatchSelection(color);
    }

    function handleSaveSpace() {
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
        render();
        renderArchive();
        renderSpaces();
        updateCategoryDropdown();

        $('#modal-space').classList.add('hidden');
        playSound('tick');
    }

    function handleDeleteSpace() {
        const spaceId = $('#edit-space-id').value;
        if (!spaceId) return;

        const space = state.spaces.find(s => s.id === spaceId);
        if (!space) return;

        if (state.spaces.length <= 1) {
            alert('Cannot delete the last remaining space.');
            return;
        }

        if (!confirm(`Permanently delete "${space.name}" and all its quests? This cannot be undone.`)) {
            return;
        }

        state.spaces = state.spaces.filter(s => s.id !== spaceId);
        state.activeSpaceId = state.spaces[0].id;
        syncActiveSpace();

        saveState();
        render();
        renderArchive();
        renderSpaces();
        updateCategoryDropdown();

        $('#modal-space').classList.add('hidden');
        playSound('tick');
    }

    // --- Utility Functions ---
    function generateId() {
        return 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function isItemComplete(item) {
        if (item.type === 'quest' && item.objectives.length > 0) {
            return item.objectives.every(obj => obj.current >= obj.target);
        }
        return item.current >= item.target;
    }

    function getItemProgress(item) {
        if (item.type === 'quest' && item.objectives.length > 0) {
            const total = item.objectives.reduce((sum, obj) => sum + obj.target, 0);
            const current = item.objectives.reduce((sum, obj) => sum + Math.min(obj.current, obj.target), 0);
            return { current, total };
        }
        return { current: item.current, total: item.target };
    }

    function sortItems() {
        // Priority order: high=0, medium=1, none=2, low=3
        const priorityOrder = { high: 0, medium: 1, '': 2, null: 2, low: 3 };

        state.items.sort((a, b) => {
            // Completed items go to bottom
            const aComplete = isItemComplete(a);
            const bComplete = isItemComplete(b);
            if (aComplete !== bComplete) return aComplete ? 1 : -1;

            // Sort by priority
            const aPriority = priorityOrder[a.priority] ?? 2;
            const bPriority = priorityOrder[b.priority] ?? 2;
            if (aPriority !== bPriority) return aPriority - bPriority;

            // Then by creation time (newest first)
            return (b.createdAt || 0) - (a.createdAt || 0);
        });
    }

    function getUniqueCategories() {
        const fromItems = state.items.map(i => i.category || 'Misc');
        const all = [...new Set([...state.categories, ...fromItems])];
        return all.sort();
    }

    function groupItemsByCategory(items = null) {
        const itemsToGroup = items || state.items;
        const categories = [...new Set(itemsToGroup.map(i => i.category || 'Misc'))];
        const grouped = {};
        categories.forEach(cat => {
            const catItems = itemsToGroup.filter(i => (i.category || 'Misc') === cat);
            if (catItems.length > 0) {
                grouped[cat] = catItems;
            }
        });
        return grouped;
    }

    function getCategoryProgress(categoryItems) {
        let current = 0;
        let total = 0;
        categoryItems.forEach(item => {
            const prog = getItemProgress(item);
            current += prog.current;
            total += prog.total;
        });
        return { current, total, percent: total > 0 ? (current / total) * 100 : 0 };
    }

    // --- Sound Functions ---
    function playSound(type) {
        if (!state.soundEnabled) return;

        const sounds = {
            tick: elements.soundTick,
            complete: elements.soundComplete,
            fanfare: elements.soundFanfare
        };

        const sound = sounds[type];
        if (sound) {
            sound.currentTime = 0;
            sound.volume = type === 'fanfare' ? 0.3 : 0.5;
            sound.play().catch(() => { });
        }
    }

    // --- Particle System ---
    function initParticles() {
        const canvas = elements.particlesCanvas;
        if (!canvas) return;

        particleCtx = canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        requestAnimationFrame(updateParticles);
    }

    function resizeCanvas() {
        const canvas = elements.particlesCanvas;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function createParticles(x, y, count = 30, type = 'burst') {
        const colors = ['#ffd666', '#e8b84a', '#4ecdb4', '#5cb572', '#ffffff'];

        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
            const velocity = type === 'burst' ? 3 + Math.random() * 5 : 1 + Math.random() * 2;
            const size = type === 'burst' ? 3 + Math.random() * 4 : 2 + Math.random() * 3;

            particles.push({
                x,
                y,
                vx: Math.cos(angle) * velocity,
                vy: Math.sin(angle) * velocity - (type === 'confetti' ? 2 : 0),
                size,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 1,
                decay: 0.015 + Math.random() * 0.01,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2
            });
        }
    }

    function updateParticles() {
        if (!particleCtx) return;

        const canvas = elements.particlesCanvas;
        particleCtx.clearRect(0, 0, canvas.width, canvas.height);

        particles = particles.filter(p => p.life > 0);

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15; // gravity
            p.life -= p.decay;
            p.rotation += p.rotationSpeed;

            particleCtx.save();
            particleCtx.translate(p.x, p.y);
            particleCtx.rotate(p.rotation);
            particleCtx.globalAlpha = p.life;
            particleCtx.fillStyle = p.color;
            particleCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            particleCtx.restore();
        });

        requestAnimationFrame(updateParticles);
    }

    // --- Celebration Effects ---
    function celebrate(element, type = 'item') {
        // Get element position for particles
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        // Add celebrating class for CSS animations
        element.classList.add('celebrating');
        setTimeout(() => element.classList.remove('celebrating'), 600);

        // Particles
        createParticles(x, y, type === 'quest' ? 50 : 25, 'burst');

        // Screen effects for quest completion
        if (type === 'quest') {
            document.body.classList.add('shake');
            elements.celebrationOverlay.classList.add('active');
            setTimeout(() => {
                document.body.classList.remove('shake');
                elements.celebrationOverlay.classList.remove('active');
            }, 600);
            playSound('fanfare');
        } else {
            playSound('complete');
        }
    }

    // --- CRUD Operations ---
    function addItem(data) {
        const newItem = normalizeItem({
            id: generateId(),
            type: data.type || 'item',
            name: data.name,
            imageUrl: data.imageUrl || null,
            category: data.category || 'Misc',
            color: data.color || null,
            priority: data.priority || null,
            current: 0,
            target: data.target || 1,
            objectives: data.objectives || [],
            createdAt: Date.now()
        });

        state.items.push(newItem);
        sortItems();
        saveState();

        // Surgical DOM insertion
        insertItemIntoDOM(newItem);
    }

    function updateItemField(id, field, value, objectiveId = null) {
        const item = state.items.find(i => i.id === id);
        if (!item) return;

        const wasComplete = isItemComplete(item);

        if (objectiveId) {
            const objective = item.objectives.find(o => o.id === objectiveId);
            if (objective) {
                objective[field] = value;
                if (field === 'current') {
                    objective.complete = objective.current >= objective.target;
                }
            }
        } else {
            item[field] = value;
        }

        const isNowComplete = isItemComplete(item);

        if (!wasComplete && isNowComplete) {
            item.completedAt = Date.now();
        } else if (wasComplete && !isNowComplete) {
            item.completedAt = null;
        }

        saveState();

        // Return completion status change
        return { wasComplete, isNowComplete };
    }

    function deleteItem(id) {
        const item = state.items.find(i => i.id === id);
        if (!item) return;

        const category = item.category;
        const card = $(`.quest-card[data-id="${id}"]`);

        // Remove from state first
        state.items = state.items.filter(i => i.id !== id);
        saveState();

        if (card) {
            // Animate out
            card.style.transition = 'all 0.3s ease';
            card.style.opacity = '0';
            card.style.transform = 'translateX(-20px) scale(0.95)';
            card.style.marginBottom = '0';
            card.style.paddingTop = '0';
            card.style.paddingBottom = '0';
            card.style.maxHeight = card.offsetHeight + 'px';

            setTimeout(() => {
                card.style.maxHeight = '0';
            }, 10);

            setTimeout(() => {
                card.remove();
                cleanupEmptyCategory(category);
                updateStatusBar();
                updateCategoryDropdown();

                // Show empty state if no items
                if (state.items.length === 0) {
                    elements.emptyState.classList.remove('hidden');
                }
            }, 300);
        } else {
            cleanupEmptyCategory(category);
            updateStatusBar();
            updateCategoryDropdown();
            if (state.items.length === 0) {
                elements.emptyState.classList.remove('hidden');
            }
        }
    }

    // --- Surgical DOM Updates ---

    // Insert a new item into the DOM without full re-render
    function insertItemIntoDOM(item) {
        const category = item.category;
        let categoryGroup = $(`.category-group[data-category="${escapeHtml(category)}"]`);

        // Hide empty state
        elements.emptyState.classList.add('hidden');

        // Create category group if it doesn't exist
        if (!categoryGroup) {
            const categoryItems = state.items.filter(i => i.category === category);
            const progress = getCategoryProgress(categoryItems);

            const groupHTML = `
                <section class="category-group" data-category="${escapeHtml(category)}">
                    <div class="category-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                        <h2 class="category-name">${escapeHtml(category)}</h2>
                        <span class="category-count">0</span>
                        <div class="category-progress-wrapper">
                            <div class="category-progress">
                                <div class="category-progress-fill" style="width: ${progress.percent}%"></div>
                            </div>
                            <span class="category-progress-text">${progress.current}/${progress.total}</span>
                        </div>
                    </div>
                    <div class="category-items"></div>
                </section>
            `;

            elements.questContainer.insertAdjacentHTML('beforeend', groupHTML);
            categoryGroup = $(`.category-group[data-category="${escapeHtml(category)}"]`);
        }

        const itemsContainer = categoryGroup.querySelector('.category-items');
        const cardHTML = createQuestCardHTML(item);

        // Insert at the beginning (newest first among incomplete)
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = cardHTML;
        const newCard = tempContainer.firstElementChild;

        // Add entrance animation - fly down from above
        newCard.style.opacity = '0';
        newCard.style.transform = 'translateY(-40px) scale(0.95)';

        // Find the correct position (after any complete items if this is incomplete, etc.)
        const isComplete = isItemComplete(item);
        const cards = itemsContainer.querySelectorAll('.quest-card');
        let inserted = false;
        let insertBeforeCard = null;

        for (const existingCard of cards) {
            const existingId = existingCard.dataset.id;
            const existingItem = state.items.find(i => i.id === existingId);
            if (existingItem) {
                const existingComplete = isItemComplete(existingItem);
                // Insert before first complete item if we're incomplete
                // Or insert by date comparison
                if (!isComplete && existingComplete) {
                    insertBeforeCard = existingCard;
                    inserted = true;
                    break;
                }
                // Insert before older items of same completion status
                if (isComplete === existingComplete && item.createdAt > (existingItem.createdAt || 0)) {
                    insertBeforeCard = existingCard;
                    inserted = true;
                    break;
                }
            }
        }

        // FLIP animation: capture old positions of cards that will move
        const cardsToAnimate = [];
        if (insertBeforeCard) {
            let sibling = insertBeforeCard;
            while (sibling) {
                const rect = sibling.getBoundingClientRect();
                cardsToAnimate.push({ el: sibling, oldTop: rect.top });
                sibling = sibling.nextElementSibling;
            }
        }

        // Insert the new card
        if (inserted && insertBeforeCard) {
            itemsContainer.insertBefore(newCard, insertBeforeCard);
        } else {
            itemsContainer.appendChild(newCard);
        }

        // Animate existing cards from old position to new position (push down effect)
        cardsToAnimate.forEach(({ el, oldTop }) => {
            const newTop = el.getBoundingClientRect().top;
            const deltaY = oldTop - newTop;
            if (deltaY !== 0) {
                el.style.transform = `translateY(${deltaY}px)`;
                el.style.transition = 'none';
                requestAnimationFrame(() => {
                    el.style.transition = 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)';
                    el.style.transform = 'translateY(0)';
                });
            }
        });

        // Animate in with a smooth fly-down effect
        requestAnimationFrame(() => {
            newCard.style.transition = 'opacity 0.4s ease-out, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
            newCard.style.opacity = '1';
            newCard.style.transform = 'translateY(0) scale(1)';
        });

        // Update category count and progress
        updateCategoryCount(category);
        updateCategoryProgress(category);
        updateStatusBar();
        updateCategoryDropdown();
    }

    // Remove empty category groups
    function cleanupEmptyCategory(category) {
        const categoryItems = state.items.filter(i => i.category === category);
        if (categoryItems.length === 0) {
            const groupEl = $(`.category-group[data-category="${escapeHtml(category)}"]`);
            if (groupEl) {
                groupEl.style.transition = 'all 0.2s ease';
                groupEl.style.opacity = '0';
                setTimeout(() => groupEl.remove(), 200);
            }
        } else {
            updateCategoryCount(category);
            updateCategoryProgress(category);
        }
    }

    // Update category item count
    function updateCategoryCount(category) {
        const groupEl = $(`.category-group[data-category="${escapeHtml(category)}"]`);
        if (!groupEl) return;

        const categoryItems = state.items.filter(i => i.category === category);
        const countEl = groupEl.querySelector('.category-count');
        if (countEl) {
            countEl.textContent = categoryItems.length;
        }
    }

    function updateCardProgress(id) {
        const item = state.items.find(i => i.id === id);
        if (!item) return;

        const card = $(`.quest-card[data-id="${id}"]`);
        if (!card) return;

        const isComplete = isItemComplete(item);
        const progress = getItemProgress(item);
        const percent = Math.min(100, (progress.current / progress.total) * 100);

        // Update progress bar
        const progressFill = card.querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = `${percent}%`;
            progressFill.classList.add('updating');
            setTimeout(() => progressFill.classList.remove('updating'), 500);
        }

        // Update count display
        const countCurrent = card.querySelector('.quest-count-current');
        const countTarget = card.querySelector('.quest-count-target');
        if (countCurrent) {
            countCurrent.textContent = progress.current;
            // Only animate if not in sync mode
            if (!document.body.classList.contains('sync-update')) {
                countCurrent.classList.add('bumping');
                setTimeout(() => countCurrent.classList.remove('bumping'), 250);
            }
        }
        if (countTarget) {
            countTarget.textContent = progress.total;
        }

        // Update complete state
        if (isComplete && !card.classList.contains('complete')) {
            card.classList.add('complete');

            // Add trophy icon if not present
            const questName = card.querySelector('.quest-name');
            if (questName && !questName.querySelector('.trophy-icon')) {
                const trophyHTML = `<svg class="trophy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                    <path d="M4 22h16"/>
                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                </svg>`;
                questName.insertAdjacentHTML('afterbegin', trophyHTML);
            }

            // Add complete tag
            const tags = card.querySelector('.quest-tags');
            if (tags && !tags.querySelector('.quest-complete-tag')) {
                const tag = document.createElement('span');
                tag.className = 'quest-complete-tag';
                tag.textContent = 'ACQUIRED';
                tags.appendChild(tag);
            }

            // Celebrate!
            celebrate(card, item.type);

            // Auto-archive: mark as pending, will archive on mouse leave (if enabled)
            if (state.autoArchive) {
                card.classList.add('pending-archive');
                // Add mouse leave handler for delayed archive
                const handleMouseLeave = () => {
                    const pendingItem = state.items.find(i => i.id === item.id);
                    if (pendingItem && isItemComplete(pendingItem) && card.classList.contains('pending-archive')) {
                        setTimeout(() => {
                            // Double check it's still complete and pending
                            const stillPending = card.classList.contains('pending-archive');
                            const stillComplete = state.items.find(i => i.id === item.id);
                            if (stillPending && stillComplete && isItemComplete(stillComplete)) {
                                archiveItem(item.id);
                            }
                        }, 800);
                    }
                    card.removeEventListener('mouseleave', handleMouseLeave);
                };
                card.addEventListener('mouseleave', handleMouseLeave, { once: true });
            }
        } else if (!isComplete && card.classList.contains('complete')) {
            card.classList.remove('complete');
            card.classList.remove('pending-archive'); // Cancel pending archive

            // Remove trophy and complete tag
            const trophy = card.querySelector('.trophy-icon');
            const completeTag = card.querySelector('.quest-complete-tag');
            if (trophy) trophy.remove();
            if (completeTag) completeTag.remove();
        }

        // Update buttons
        const btnIncrement = card.querySelector('.btn-increment');
        const btnDecrement = card.querySelector('.btn-decrement');
        if (btnIncrement) {
            btnIncrement.disabled = isComplete;
            if (isComplete) {
                btnIncrement.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                `;
            } else {
                btnIncrement.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                `;
            }
        }
        if (btnDecrement) {
            btnDecrement.disabled = progress.current <= 0;
        }

        // Update category progress
        updateCategoryProgress(item.category);

        // Update status bar
        updateStatusBar();
    }

    function updateObjectiveDisplay(itemId, objectiveId) {
        const item = state.items.find(i => i.id === itemId);
        if (!item) return;

        const objective = item.objectives.find(o => o.id === objectiveId);
        if (!objective) return;

        const objEl = $(`.objective-item[data-objective-id="${objectiveId}"]`);
        if (!objEl) return;

        const isObjComplete = objective.current >= objective.target;

        // Update checkbox
        const checkbox = objEl.querySelector('.objective-checkbox');
        if (checkbox) {
            if (isObjComplete) {
                checkbox.classList.add('checked');
                checkbox.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
            } else {
                checkbox.classList.remove('checked');
                checkbox.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
            }
        }

        // Update count
        const countEl = objEl.querySelector('.objective-count');
        if (countEl) {
            countEl.textContent = `${objective.current}/${objective.target}`;
        }

        // Update complete state
        if (isObjComplete) {
            objEl.classList.add('complete');
            playSound('tick');
        } else {
            objEl.classList.remove('complete');
        }

        // Update buttons
        const btnInc = objEl.querySelector('.objective-btn.increment');
        const btnDec = objEl.querySelector('.objective-btn.decrement');
        if (btnInc) btnInc.disabled = isObjComplete;
        if (btnDec) btnDec.disabled = objective.current <= 0;

        // Update parent card progress
        updateCardProgress(itemId);
    }

    function updateCategoryProgress(category) {
        const groupEl = $(`.category-group[data-category="${escapeHtml(category)}"]`);
        if (!groupEl) return;

        const categoryItems = state.items.filter(i => i.category === category);
        const progress = getCategoryProgress(categoryItems);

        const fillEl = groupEl.querySelector('.category-progress-fill');
        const textEl = groupEl.querySelector('.category-progress-text');

        if (fillEl) {
            fillEl.style.width = `${progress.percent}%`;
        }
        if (textEl) {
            textEl.textContent = `${progress.current}/${progress.total}`;
        }
    }

    function updateStatusBar() {
        const total = state.items.length;
        const complete = state.items.filter(i => isItemComplete(i)).length;

        elements.statusTotal.textContent = total;
        elements.statusComplete.textContent = complete;
    }

    // --- Import/Export ---
    function exportData() {
        if (state.items.length === 0) return;

        const exportData = {
            version: 2,
            exportedAt: new Date().toISOString(),
            categories: state.categories,
            items: state.items
        };

        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const link = document.createElement('a');
        link.setAttribute('href', dataStr);
        link.setAttribute('download', `fetch_quest_backup_${Date.now()}.json`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    function importData(file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = JSON.parse(e.target.result);

                // Handle both v1 (array) and v2 (object) formats
                let importedItems = [];
                let importedCategories = [];

                if (Array.isArray(data)) {
                    // v1 format
                    importedItems = data;
                } else if (data.items) {
                    // v2 format
                    importedItems = data.items;
                    importedCategories = data.categories || [];
                }

                // Add imported items
                importedItems.forEach(item => {
                    const normalized = normalizeItem({
                        ...item,
                        id: generateId(),
                        createdAt: Date.now()
                    });
                    state.items.push(normalized);
                });

                // Merge categories
                importedCategories.forEach(cat => {
                    if (!state.categories.includes(cat)) {
                        state.categories.push(cat);
                    }
                });

                sortItems();
                saveState();
                render();

            } catch (err) {
                console.error('Import failed:', err);
                alert('Failed to import data. Please ensure the file is valid JSON.');
            }
        };
        reader.readAsText(file);
    }

    // --- Rendering ---
    function createQuestCardHTML(item) {
        const isComplete = isItemComplete(item);
        const progress = getItemProgress(item);
        const percent = Math.min(100, (progress.current / progress.total) * 100);

        const segmentCount = Math.min(progress.total, 20);
        let segmentsHTML = '';
        for (let i = 0; i < segmentCount; i++) {
            segmentsHTML += '<div class="progress-segment"></div>';
        }

        let imageHTML = '';
        if (item.imageUrl) {
            imageHTML = `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" class="quest-image" loading="lazy" onerror="this.style.display='none'">`;
        }

        let objectivesHTML = '';
        if (item.type === 'quest' && item.objectives.length > 0) {
            const objItems = item.objectives.map(obj => {
                const objComplete = obj.current >= obj.target;
                return `
                    <div class="objective-item ${objComplete ? 'complete' : ''}" data-item-id="${item.id}" data-objective-id="${obj.id}">
                        <div class="objective-checkbox ${objComplete ? 'checked' : ''}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${objComplete ? '3' : '2'}">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                        </div>
                        ${obj.imageUrl ? `<img src="${escapeHtml(obj.imageUrl)}" alt="" class="objective-image" onerror="this.style.display='none'">` : ''}
                        <div class="objective-info">
                            <span class="objective-name">${escapeHtml(obj.name)}</span>
                        </div>
                        <div class="objective-controls">
                            <button class="objective-btn decrement" data-action="obj-decrement" ${obj.current <= 0 ? 'disabled' : ''}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </button>
                            <span class="objective-count">${obj.current}/${obj.target}</span>
                            <button class="objective-btn increment" data-action="obj-increment" ${objComplete ? 'disabled' : ''}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            objectivesHTML = `
                <div class="quest-objectives">
                    <div class="quest-objectives-title">OBJECTIVES</div>
                    ${objItems}
                </div>
            `;
        }

        return `
            <article class="quest-card ${isComplete ? 'complete' : ''} ${item.imageUrl ? 'has-image' : ''}" data-id="${item.id}" data-type="${item.type}" ${item.color ? `style="--quest-color: ${item.color}" data-color="${item.color}"` : ''}>
                <div class="quest-card-inner">
                    <div class="quest-content">
                        <div class="quest-header">
                            <div class="quest-info">
                                <div class="quest-tags">
                                    ${item.type === 'quest' ? '<span class="quest-type-tag">QUEST</span>' : ''}
                                    ${item.priority ? `<span class="quest-priority-tag priority-${item.priority}">${item.priority.toUpperCase()}</span>` : ''}
                                    <span class="quest-category-tag">${escapeHtml(item.category)}</span>
                                    ${isComplete ? '<span class="quest-complete-tag">ACQUIRED</span>' : ''}
                                </div>
                                <h3 class="quest-name">
                                    ${isComplete ? `
                                        <svg class="trophy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                                            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                                            <path d="M4 22h16"/>
                                            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                                            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                                            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                                        </svg>
                                    ` : ''}
                                    <span class="quest-name-text" data-action="edit-name">${escapeHtml(item.name)}</span>
                                </h3>
                            </div>
                            <div class="quest-actions">
                                <button class="btn-archive" data-action="archive" title="Archive">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="21 8 21 21 3 21 3 8"/>
                                        <rect x="1" y="3" width="22" height="5"/>
                                        <line x1="10" y1="12" x2="14" y2="12"/>
                                    </svg>
                                </button>
                                <button class="btn-delete" data-action="delete" title="Delete">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3 6 5 6 21 6"/>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        
                        <div class="progress-container">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${percent}%"></div>
                                <div class="progress-segments">${segmentsHTML}</div>
                            </div>
                        </div>
                        
                        ${item.type === 'item' ? `
                            <div class="quest-controls">
                                <button class="btn-control btn-decrement" data-action="decrement" ${item.current <= 0 ? 'disabled' : ''}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <line x1="5" y1="12" x2="19" y2="12"/>
                                    </svg>
                                </button>
                                <span class="quest-count">
                                    <span class="quest-count-current">${progress.current}</span>
                                    <span class="quest-count-divider">/</span>
                                    <span class="quest-count-target">${progress.total}</span>
                                </span>
                                <button class="btn-control btn-increment" data-action="increment" ${isComplete ? 'disabled' : ''}>
                                    ${isComplete ? `
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                            <polyline points="22 4 12 14.01 9 11.01"/>
                                        </svg>
                                    ` : `
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <line x1="12" y1="5" x2="12" y2="19"/>
                                            <line x1="5" y1="12" x2="19" y2="12"/>
                                        </svg>
                                    `}
                                </button>
                            </div>
                        ` : objectivesHTML}
                        
                        <div class="quest-notes-section">
                            <button class="btn-notes-toggle ${item.notes ? 'has-notes' : ''}" data-action="toggle-notes" title="Notes">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                    <line x1="16" y1="13" x2="8" y2="13"/>
                                    <line x1="16" y1="17" x2="8" y2="17"/>
                                </svg>
                            </button>
                            <div class="quest-notes hidden">
                                <textarea class="notes-textarea" data-action="update-notes" placeholder="Add notes...">${escapeHtml(item.notes || '')}</textarea>
                            </div>
                        </div>
                    </div>
                    ${item.imageUrl ? `
                        <div class="quest-image-wrapper">
                            <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" class="quest-image" loading="lazy" onerror="this.style.display='none'">
                        </div>
                    ` : ''}
                </div>
            </article>
        `;
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
                <div class="category-items">
                    ${itemsHTML}
                </div>
            </section>
        `;
    }


    function render() {
        updateCategoryDropdown();
        updateStatusBar();
        renderSpaces();

        // Clear existing groups
        const existingGroups = elements.questContainer.querySelectorAll('.category-group');
        existingGroups.forEach(g => g.remove());

        // Get items to display, applying search filter
        let itemsToRender = state.items;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const searchAllSpaces = elements.searchAllSpaces?.checked;

            if (searchAllSpaces) {
                // Search across all spaces
                itemsToRender = [];
                state.spaces.forEach(space => {
                    const matches = space.items.filter(item =>
                        item.name.toLowerCase().includes(query) ||
                        item.category.toLowerCase().includes(query)
                    );
                    itemsToRender.push(...matches);
                });
            } else {
                // Search current space only
                itemsToRender = state.items.filter(item =>
                    item.name.toLowerCase().includes(query) ||
                    item.category.toLowerCase().includes(query)
                );
            }
        }

        if (itemsToRender.length === 0) {
            elements.emptyState.classList.remove('hidden');
        } else {
            elements.emptyState.classList.add('hidden');

            const grouped = groupItemsByCategory(itemsToRender);
            let html = '';
            Object.entries(grouped).forEach(([category, categoryItems]) => {
                html += createCategoryGroupHTML(category, categoryItems);
            });

            elements.questContainer.insertAdjacentHTML('beforeend', html);
        }
    }

    function updateCategoryDropdown() {
        const categories = getUniqueCategories();
        const currentValue = elements.itemCategory.value;

        elements.itemCategory.innerHTML = categories.map(cat =>
            `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`
        ).join('');

        if (categories.includes(currentValue)) {
            elements.itemCategory.value = currentValue;
        }
    }

    // Update form's has-content class based on whether user entered any content
    function updateFormContentState() {
        const hasText = elements.itemName.value.trim().length > 0;
        const hasImage = tempImageData !== null || elements.btnAddImage.classList.contains('has-image');
        const hasObjectives = tempObjectives.length > 0;

        if (hasText || hasImage || hasObjectives) {
            elements.form.classList.add('has-content');
        } else {
            elements.form.classList.remove('has-content');
        }
    }

    // --- Event Handlers ---
    function handleFormSubmit(e) {
        e.preventDefault();

        const name = elements.itemName.value.trim();
        const hasImage = tempImageData || elements.itemImage.value;

        // Require either a name OR an image
        if (!name && !hasImage) return;

        const data = {
            type: currentType,
            name: name || 'Unnamed Item',  // Default name if image-only
            imageUrl: tempImageData || elements.itemImage.value || null,
            category: elements.itemCategory.value,
            color: elements.itemColor.value || null,
            priority: elements.itemPriority.value || null,
            target: parseInt(elements.itemGoal.value) || 1,
            objectives: currentType === 'quest' ? [...tempObjectives] : []
        };

        addItem(data);

        // Keep form expanded briefly to prevent jarring collapse when moving mouse down
        elements.addQuestForm.classList.add('keep-open');
        setTimeout(() => {
            elements.addQuestForm.classList.remove('keep-open');
        }, 1500);

        // Reset form
        elements.itemName.value = '';
        elements.itemImage.value = '';
        elements.itemColor.value = '';
        elements.itemPriority.value = '';
        tempImageData = null;
        elements.btnAddImage.classList.remove('has-image');
        elements.imagePreview.classList.add('hidden');
        elements.itemGoal.value = '4';
        tempObjectives = [];
        elements.objectivesList.innerHTML = '';
        elements.itemName.focus();
        updateFormContentState();

        // Reset color picker
        elements.colorDropdown.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('active'));
        elements.colorDropdown.querySelector('.color-none').classList.add('active');
        elements.colorIndicator.style.background = '';
        elements.colorIndicator.classList.remove('has-color');

        // Reset priority picker
        elements.priorityDropdown.querySelectorAll('.priority-option').forEach(opt => opt.classList.remove('active'));
        elements.priorityDropdown.querySelector('[data-priority=""]').classList.add('active');
        elements.priorityIndicator.textContent = '—';
        elements.priorityIndicator.className = 'priority-indicator';

        playSound('tick');
    }

    function handleTypeToggle(e) {
        const btn = e.target.closest('.type-btn');
        if (!btn) return;

        currentType = btn.dataset.type;

        elements.typeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (currentType === 'item') {
            elements.itemFields.classList.remove('hidden');
            elements.questFields.classList.add('hidden');
        } else {
            elements.itemFields.classList.add('hidden');
            elements.questFields.classList.remove('hidden');
        }
    }

    function handleAddObjective() {
        const id = generateId();
        tempObjectives.push({
            id,
            name: '',
            imageUrl: null,
            current: 0,
            target: 1
        });

        const row = document.createElement('div');
        row.className = 'objective-row';
        row.dataset.id = id;
        row.innerHTML = `
            <input type="text" class="input-field objective-name-input" placeholder="Objective name..." required>
            <input type="number" class="input-field input-number objective-target-input" min="1" max="999" value="1">
            <button type="button" class="btn-remove-objective" data-action="remove-objective">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;

        elements.objectivesList.appendChild(row);
        row.querySelector('.objective-name-input').focus();

        // Update tempObjectives when inputs change
        row.querySelector('.objective-name-input').addEventListener('input', (e) => {
            const obj = tempObjectives.find(o => o.id === id);
            if (obj) obj.name = e.target.value.trim();
        });

        row.querySelector('.objective-target-input').addEventListener('input', (e) => {
            const obj = tempObjectives.find(o => o.id === id);
            if (obj) obj.target = parseInt(e.target.value) || 1;
        });
        updateFormContentState();
    }

    function handleRemoveObjective(e) {
        const btn = e.target.closest('[data-action="remove-objective"]');
        if (!btn) return;

        const row = btn.closest('.objective-row');
        if (!row) return;

        const id = row.dataset.id;
        tempObjectives = tempObjectives.filter(o => o.id !== id);
        row.remove();
        updateFormContentState();
    }

    function handleQuestAction(e) {
        const card = e.target.closest('.quest-card');

        // In bulk mode, clicking anywhere on card toggles selection
        if (bulkMode && card) {
            e.preventDefault();
            e.stopPropagation();
            handleBulkCardClick(card);
            return;
        }

        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        // card already defined above for bulk mode check
        const objItem = btn.closest('.objective-item');

        if (!card) return;
        const itemId = card.dataset.id;
        const item = state.items.find(i => i.id === itemId);
        if (!item) return;

        // Determine increment amount based on modifier keys
        let amount = 1;
        if (e.ctrlKey || e.metaKey) {
            amount = state.ctrlAmount || 10;
        } else if (e.shiftKey) {
            amount = state.shiftAmount || 5;
        }

        switch (action) {
            case 'increment':
                if (item.current < item.target) {
                    const newValue = Math.min(item.current + amount, item.target);
                    updateItemField(itemId, 'current', newValue);
                    updateCardProgress(itemId);
                    playSound('tick');
                }
                break;

            case 'decrement':
                if (item.current > 0) {
                    const newValue = Math.max(item.current - amount, 0);
                    updateItemField(itemId, 'current', newValue);
                    updateCardProgress(itemId);
                }
                break;

            case 'obj-increment':
                if (objItem) {
                    const objId = objItem.dataset.objectiveId;
                    const obj = item.objectives.find(o => o.id === objId);
                    if (obj && obj.current < obj.target) {
                        const newValue = Math.min(obj.current + amount, obj.target);
                        updateItemField(itemId, 'current', newValue, objId);
                        updateObjectiveDisplay(itemId, objId);
                    }
                }
                break;

            case 'obj-decrement':
                if (objItem) {
                    const objId = objItem.dataset.objectiveId;
                    const obj = item.objectives.find(o => o.id === objId);
                    if (obj && obj.current > 0) {
                        const newValue = Math.max(obj.current - amount, 0);
                        updateItemField(itemId, 'current', newValue, objId);
                        updateObjectiveDisplay(itemId, objId);
                    }
                }
                break;

            case 'delete':
                if (confirm('Remove this target?')) {
                    deleteItem(itemId);
                }
                break;

            case 'edit-name':
                const nameEl = card.querySelector('.quest-name-text');
                if (!nameEl || nameEl.querySelector('input')) return; // Already editing

                const currentName = item.name;
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'inline-edit-input';
                input.value = currentName;

                const finishEdit = () => {
                    const newName = input.value.trim() || currentName;
                    if (newName !== currentName) {
                        updateItemField(itemId, 'name', newName);
                    }
                    nameEl.textContent = newName;
                };

                input.addEventListener('blur', finishEdit);
                input.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
                    if (ev.key === 'Escape') { input.value = currentName; input.blur(); }
                });

                nameEl.textContent = '';
                nameEl.appendChild(input);
                input.focus();
                input.select();
                break;

            case 'toggle-notes':
                const notesSection = card.querySelector('.quest-notes');
                if (notesSection) {
                    notesSection.classList.toggle('hidden');
                    const textarea = notesSection.querySelector('.notes-textarea');
                    if (!notesSection.classList.contains('hidden') && textarea) {
                        textarea.focus();
                    }
                }
                break;

            case 'archive':
                // Move item to archive
                const itemIndex = state.items.findIndex(i => i.id === itemId);
                if (itemIndex !== -1) {
                    const [archivedItem] = state.items.splice(itemIndex, 1);
                    archivedItem.archivedAt = Date.now();
                    state.archivedItems.push(archivedItem);
                    saveState();

                    // Remove card from DOM
                    card.style.transition = 'all 0.3s ease';
                    card.style.transform = 'scale(0.9)';
                    card.style.opacity = '0';
                    setTimeout(() => {
                        card.remove();
                        cleanupEmptyCategory(item.category);
                        renderArchive();
                    }, 300);
                }
                break;

            case 'update-notes':
                // Handled by blur event below
                break;
        }
    }

    function handleNotesBlur(e) {
        if (!e.target.classList.contains('notes-textarea')) return;

        const card = e.target.closest('.quest-card');
        if (!card) return;

        const itemId = card.dataset.id;
        const item = state.items.find(i => i.id === itemId);
        if (!item) return;

        const newNotes = e.target.value;
        if (item.notes !== newNotes) {
            updateItemField(itemId, 'notes', newNotes);
            // Update button indicator
            const btn = card.querySelector('.btn-notes-toggle');
            if (btn) {
                btn.classList.toggle('has-notes', !!newNotes.trim());
            }
        }
    }

    function handleAddCategory() {
        elements.modalCategory.classList.remove('hidden');
        elements.newCategoryName.value = '';
        elements.newCategoryName.focus();
    }

    function handleSaveCategory() {
        const name = elements.newCategoryName.value.trim();
        if (!name) return;

        if (!state.categories.includes(name)) {
            state.categories.push(name);
            saveState();
            updateCategoryDropdown();
        }

        elements.itemCategory.value = name;
        elements.modalCategory.classList.add('hidden');
    }

    function handleCloseModal(e) {
        // Use closest() to handle clicks on child elements (like SVG inside X button)
        if (e.target.classList.contains('modal-backdrop') ||
            e.target.closest('.modal-close') ||
            e.target.closest('.modal-cancel')) {
            // Find the closest modal and hide it
            const modal = e.target.closest('.modal');
            if (modal) {
                modal.classList.add('hidden');
            }
        }
    }

    function handleSoundToggle() {
        state.soundEnabled = elements.toggleSound.checked;
        saveState();
    }

    function handleExport() {
        exportData();
    }

    function handleImportClick() {
        elements.fileImport.click();
    }

    function handleFileChange(e) {
        const file = e.target.files[0];
        if (file) {
            importData(file);
        }
        e.target.value = null;
    }

    function handleKeydown(e) {
        if (e.key === 'Escape') {
            elements.modalCategory.classList.add('hidden');
            elements.modalImage.classList.add('hidden');
            elements.modalSettings.classList.add('hidden');
        }
        if (e.key === 'Enter' && !elements.modalCategory.classList.contains('hidden')) {
            handleSaveCategory();
        }
    }

    // --- Settings Handlers ---
    function handleOpenSettings() {
        // Sync modal with current state (with null checks)
        if (elements.settingShiftAmount) elements.settingShiftAmount.value = state.shiftAmount;
        if (elements.settingCtrlAmount) elements.settingCtrlAmount.value = state.ctrlAmount;
        if (elements.settingSoundEnabled) elements.settingSoundEnabled.checked = state.soundEnabled;
        if (elements.settingAutoArchive) elements.settingAutoArchive.checked = state.autoArchive;
        if (elements.modalSettings) elements.modalSettings.classList.remove('hidden');
    }

    function handleSettingChange() {
        state.shiftAmount = parseInt(elements.settingShiftAmount.value) || 5;
        state.ctrlAmount = parseInt(elements.settingCtrlAmount.value) || 10;
        state.soundEnabled = elements.settingSoundEnabled?.checked ?? false;
        state.autoArchive = elements.settingAutoArchive?.checked ?? true;

        // Sync header toggle
        if (elements.toggleSound) {
            elements.toggleSound.checked = state.soundEnabled;
        }
        saveState();
    }

    function handleClearAllData() {
        if (confirm('Are you sure you want to delete ALL data? This cannot be undone!')) {
            if (confirm('Really? This will permanently remove all your tracked items.')) {
                state.items = [];
                state.archivedItems = [];
                state.categories = [...DEFAULT_CATEGORIES];
                saveState();
                render();
                renderArchive();
                updateCategoryDropdown();
                elements.modalSettings.classList.add('hidden');
            }
        }
    }

    // --- Archive Panel Handlers ---
    function handleArchiveToggle() {
        elements.archivePanel.classList.toggle('open');
    }

    function archiveItem(itemId) {
        const itemIndex = state.items.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;

        const item = state.items[itemIndex];
        item.archivedAt = Date.now();
        state.archivedItems.unshift(item);
        state.items.splice(itemIndex, 1);
        saveState();

        // Remove from DOM
        const card = $(`.quest-card[data-id="${itemId}"]`);
        if (card) {
            card.style.transform = 'translateX(100%)';
            card.style.opacity = '0';
            setTimeout(() => {
                card.remove();
                cleanupEmptyCategory(item.category);
                updateCategoryProgress(item.category);
            }, 300);
        }

        renderArchive();
        updateStatusBar();
    }

    function restoreItem(itemId) {
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

        insertItemIntoDOM(item);
        renderArchive();
        updateStatusBar();
    }

    function deleteArchivedItem(itemId) {
        const itemIndex = state.archivedItems.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;

        state.archivedItems.splice(itemIndex, 1);
        saveState();
        renderArchive();
    }

    function deleteAllArchived() {
        if (state.archivedItems.length === 0) return;
        if (!confirm(`Delete all ${state.archivedItems.length} archived items? This cannot be undone.`)) return;

        state.archivedItems = [];
        saveState();
        renderArchive();
    }

    function renderArchive() {
        const container = elements.archiveContainer;
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

    function getTimeAgo(timestamp) {
        if (!timestamp) return '';
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    function handleArchiveAction(e) {
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


    // --- Image Picker Handlers ---
    function handleOpenImageModal() {
        elements.modalImage.classList.remove('hidden');
        elements.imageUrlInput.classList.add('hidden');
        elements.imageModalPreview.classList.add('hidden');
        elements.btnImageUrl.classList.remove('active');
        elements.btnImageLocal.classList.remove('active');
        elements.imageUrlField.value = '';
    }

    function handleImageUrlOption() {
        elements.btnImageUrl.classList.add('active');
        elements.btnImageLocal.classList.remove('active');
        elements.imageUrlInput.classList.remove('hidden');
        elements.imageUrlField.focus();
    }

    function handleImageLocalOption() {
        elements.btnImageUrl.classList.remove('active');
        elements.btnImageLocal.classList.add('active');
        elements.imageFileInput.click();
    }

    function handleImageUrlChange() {
        const url = elements.imageUrlField.value.trim();
        if (url) {
            elements.imageModalPreviewImg.src = url;
            elements.imageModalPreview.classList.remove('hidden');
        } else {
            elements.imageModalPreview.classList.add('hidden');
        }
    }

    function handleImageFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            const base64 = event.target.result;
            elements.imageModalPreviewImg.src = base64;
            elements.imageModalPreview.classList.remove('hidden');
            elements.imageUrlInput.classList.add('hidden');
        };
        reader.readAsDataURL(file);
        e.target.value = null;
    }

    function handleRemovePreviewImage() {
        elements.imageModalPreview.classList.add('hidden');
        elements.imageModalPreviewImg.src = '';
        elements.imageUrlField.value = '';
    }

    function handleSaveImage() {
        const previewSrc = elements.imageModalPreviewImg.src;
        if (previewSrc && previewSrc !== window.location.href) {
            tempImageData = previewSrc;
            elements.btnAddImage.classList.add('has-image');
            // Show small preview in form
            elements.imagePreview.innerHTML = `<img src="${tempImageData}" alt="Preview">`;
            elements.imagePreview.classList.remove('hidden');
        } else {
            tempImageData = null;
            elements.btnAddImage.classList.remove('has-image');
            elements.imagePreview.classList.add('hidden');
        }
        elements.modalImage.classList.add('hidden');
        updateFormContentState();
    }

    // --- Bulk Mode Functions ---
    function toggleBulkMode() {
        bulkMode = !bulkMode;
        document.body.classList.toggle('bulk-mode', bulkMode);
        elements.btnBulkMode.classList.toggle('active', bulkMode);
        elements.bulkActionsBar.classList.toggle('hidden', !bulkMode);

        if (!bulkMode) {
            exitBulkMode();
        } else {
            selectedItems.clear();
            updateBulkCount();
        }
    }

    function exitBulkMode() {
        bulkMode = false;
        document.body.classList.remove('bulk-mode');
        elements.btnBulkMode.classList.remove('active');
        elements.bulkActionsBar.classList.add('hidden');
        selectedItems.clear();
        $$('.quest-card.selected').forEach(card => card.classList.remove('selected'));
    }

    function updateBulkCount() {
        elements.bulkCount.textContent = selectedItems.size;
    }

    function handleBulkCardClick(card) {
        const itemId = card.dataset.id;
        if (selectedItems.has(itemId)) {
            selectedItems.delete(itemId);
            card.classList.remove('selected');
        } else {
            selectedItems.add(itemId);
            card.classList.add('selected');
        }
        updateBulkCount();
    }

    function bulkArchiveItems() {
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
        render();
        renderArchive();
    }

    function bulkDeleteItems() {
        const itemsToDelete = [...selectedItems];

        itemsToDelete.forEach(itemId => {
            const itemIndex = state.items.findIndex(i => i.id === itemId);
            if (itemIndex !== -1) {
                state.items.splice(itemIndex, 1);
            }
        });

        saveState();
        exitBulkMode();
        render();
    }

    // --- Auth UI Handlers ---
    function openAuthModal() {
        if (elements.modalAuth) {
            elements.modalAuth.classList.remove('hidden');
            switchAuthTab('signin');
            clearAuthErrors();
        }
    }

    function closeAuthModal() {
        if (elements.modalAuth) {
            elements.modalAuth.classList.add('hidden');
            clearAuthErrors();
        }
    }

    function switchAuthTab(tab) {
        // Update tab buttons
        elements.authTabs.forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });

        // Show/hide forms
        if (elements.formSignin) elements.formSignin.classList.toggle('hidden', tab !== 'signin');
        if (elements.formSignup) elements.formSignup.classList.toggle('hidden', tab !== 'signup');
        if (elements.formReset) elements.formReset.classList.add('hidden');

        // Show/hide divider and Google button for reset form
        if (elements.authDivider) elements.authDivider.classList.toggle('hidden', false);
        if (elements.btnGoogleSignin) elements.btnGoogleSignin.classList.toggle('hidden', false);

        clearAuthErrors();
    }

    function showPasswordReset() {
        if (elements.formSignin) elements.formSignin.classList.add('hidden');
        if (elements.formSignup) elements.formSignup.classList.add('hidden');
        if (elements.formReset) elements.formReset.classList.remove('hidden');
        if (elements.authDivider) elements.authDivider.classList.add('hidden');
        if (elements.btnGoogleSignin) elements.btnGoogleSignin.classList.add('hidden');
        elements.authTabs.forEach(t => t.classList.remove('active'));
        clearAuthErrors();
    }

    function clearAuthErrors() {
        if (elements.signinError) {
            elements.signinError.classList.add('hidden');
            elements.signinError.textContent = '';
        }
        if (elements.signupError) {
            elements.signupError.classList.add('hidden');
            elements.signupError.textContent = '';
        }
        if (elements.resetError) {
            elements.resetError.classList.add('hidden');
            elements.resetError.textContent = '';
        }
        if (elements.resetMessage) {
            elements.resetMessage.classList.add('hidden');
            elements.resetMessage.textContent = '';
        }
    }

    function showAuthError(form, message) {
        const errorEl = form === 'signin' ? elements.signinError :
            form === 'signup' ? elements.signupError : elements.resetError;
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        }
    }

    function showResetMessage(message) {
        if (elements.resetMessage) {
            elements.resetMessage.textContent = message;
            elements.resetMessage.classList.remove('hidden');
        }
    }

    function toggleUserDropdown() {
        if (elements.userDropdown) {
            elements.userDropdown.classList.toggle('hidden');
        }
    }

    async function updateAuthUI(user) {
        if (user) {
            // User is logged in
            if (elements.btnLogin) elements.btnLogin.classList.add('hidden');
            if (elements.userMenu) elements.userMenu.classList.remove('hidden');
            if (elements.userEmail) elements.userEmail.textContent = user.email || user.displayName || 'User';
            closeAuthModal();

            // Load data from cloud
            console.log('📥 Loading data from cloud...');
            const result = await window.FirebaseBridge.loadFromCloud();
            console.log('📥 Load result:', result);
            if (result.success && result.state) {
                // Cloud has data - use it
                state.spaces = result.state.spaces;
                state.activeSpaceId = result.state.activeSpaceId || state.spaces[0]?.id;
                state.shiftAmount = result.state.shiftAmount;
                state.ctrlAmount = result.state.ctrlAmount;
                state.autoArchive = result.state.autoArchive;

                // Also save to localStorage for offline access
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

                // Re-render with cloud data
                sortItems();
                render();
                renderArchive();
                renderSpaces();
                updateStorageDisplay();
                console.log('✅ Cloud data loaded and rendered');
            } else {
                console.log('ℹ️ No cloud data or error, using local data');
            }

            // Start real-time sync
            window.FirebaseBridge.startRealtimeSync();
            window.FirebaseBridge.onDataChange(handleRealtimeUpdate);
        } else {
            // User is logged out
            if (elements.btnLogin) elements.btnLogin.classList.remove('hidden');
            if (elements.userMenu) elements.userMenu.classList.add('hidden');
            if (elements.userDropdown) elements.userDropdown.classList.add('hidden');

            // Stop real-time sync
            if (window.FirebaseBridge) {
                window.FirebaseBridge.stopRealtimeSync();
            }
        }
    }

    function handleRealtimeUpdate(data) {
        console.log('📡 Received real-time update');
        if (data.spaces) {
            // Check if user is hovering on a quest card - delay update to prevent hover interruption
            const hoveredCard = document.querySelector('.quest-card:hover');
            if (hoveredCard) {
                console.log('📡 Delaying update (user hovering)');
                hoveredCard.addEventListener('mouseleave', () => {
                    handleRealtimeUpdate(data);
                }, { once: true });
                return;
            }

            // Skip incoming sync if we have pending local changes (prevents reverting to old state)
            if (pendingLocalChange) {
                console.log('📡 Skipping incoming sync (local changes pending)');
                return;
            }

            // Disable animations for entire sync process
            document.body.classList.add('sync-update');

            // Get the active space from incoming data
            const incomingActiveSpace = data.spaces.find(s => s.id === state.activeSpaceId);
            const currentActiveSpace = state.spaces.find(s => s.id === state.activeSpaceId);

            if (!incomingActiveSpace || !currentActiveSpace) {
                // Space mismatch - do full update
                state.spaces = data.spaces;
                state.activeSpaceId = state.activeSpaceId || state.spaces[0]?.id;
                syncActiveSpace();
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                sortItems();
                render();
                renderArchive();
                renderSpaces();
                setTimeout(() => document.body.classList.remove('sync-update'), 500);
                return;
            }

            // Compare only items in the active space (what's currently displayed)
            const incomingItems = JSON.stringify(incomingActiveSpace.items || []);
            const currentItems = JSON.stringify(currentActiveSpace.items || []);

            if (incomingItems === currentItems) {
                // Check space metadata (name, color) for sidebar update
                const incomingMeta = JSON.stringify(data.spaces.map(s => ({ id: s.id, name: s.name, color: s.color })));
                const currentMeta = JSON.stringify(state.spaces.map(s => ({ id: s.id, name: s.name, color: s.color })));

                if (incomingMeta !== currentMeta) {
                    // Only update sidebar, not quest list
                    state.spaces = data.spaces;
                    syncActiveSpace();
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                    renderSpaces();
                    console.log('📡 Sidebar updated (space metadata changed)');
                } else {
                    console.log('📡 No visible changes, skipping render');
                }
                setTimeout(() => document.body.classList.remove('sync-update'), 100);
                return;
            }

            console.log('📡 Items changed, doing surgical update');

            // Find changed items and update only those
            const oldItems = currentActiveSpace.items || [];
            const newItems = incomingActiveSpace.items || [];

            // Update state first
            state.spaces = data.spaces;
            syncActiveSpace();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

            // Count changes to decide if full or surgical update
            let changesCount = 0;

            // Check each new item
            newItems.forEach(newItem => {
                const oldItem = oldItems.find(i => i.id === newItem.id);
                if (!oldItem) {
                    // New item added
                    changesCount++;
                } else if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
                    // Item changed - do surgical update
                    changesCount++;
                    updateCardProgress(newItem.id);
                }
            });

            // Check for removed items
            oldItems.forEach(oldItem => {
                if (!newItems.find(i => i.id === oldItem.id)) {
                    changesCount++;
                }
            });

            // If more than 3 changes or items added/removed, do full render
            if (changesCount > 3 || newItems.length !== oldItems.length) {
                sortItems();
                render();
                renderArchive();
            }

            renderSpaces();

            // Re-enable animations after render completes
            setTimeout(() => document.body.classList.remove('sync-update'), 500);
            console.log(`📡 Updated ${changesCount} items`);
        }
    }

    function updateSyncStatusUI(status) {
        if (!elements.syncStatus) return;
        elements.syncStatus.className = 'sync-status';
        if (status === 'syncing') {
            if (elements.lastSynced) elements.lastSynced.textContent = 'Syncing...';
            elements.syncStatus.classList.add('syncing');
        } else if (status === 'synced') {
            // updateLastSyncedDisplay will set the time
            updateLastSyncedDisplay();
        } else if (status === 'error') {
            if (elements.lastSynced) elements.lastSynced.textContent = 'Sync error';
            elements.syncStatus.classList.add('error');
        }
    }

    // --- Category Manager ---
    function openCategoryManager() {
        if (!elements.modalCategories) return;
        // Close settings modal first
        if (elements.modalSettings) {
            elements.modalSettings.classList.add('hidden');
        }
        elements.modalCategories.classList.remove('hidden');
        renderCategoryList();
    }

    function renderCategoryList() {
        if (!elements.categoriesList) return;

        // Get all categories in the active space
        const categories = state.categories || [];

        if (categories.length === 0) {
            elements.categoriesList.innerHTML = '<div class="categories-empty">No custom categories.</div>';
            return;
        }

        // Count how many items use each category
        const countByCategory = {};
        state.items.forEach(item => {
            const cat = item.category || 'Uncategorized';
            countByCategory[cat] = (countByCategory[cat] || 0) + 1;
        });

        elements.categoriesList.innerHTML = categories.map(cat => {
            const count = countByCategory[cat] || 0;
            const isDefault = DEFAULT_CATEGORIES.includes(cat);
            return `
                <div class="category-item" data-category="${cat}">
                    <div>
                        <span class="category-item-name">${cat}</span>
                        <span class="category-item-count">(${count} items)</span>
                    </div>
                    <button class="category-item-delete" ${isDefault || count > 0 ? 'disabled' : ''} 
                            title="${isDefault ? 'Default category' : count > 0 ? 'Category in use' : 'Delete category'}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            `;
        }).join('');
    }

    function handleCategoryClick(e) {
        const deleteBtn = e.target.closest('.category-item-delete');
        if (!deleteBtn || deleteBtn.disabled) return;

        const item = deleteBtn.closest('.category-item');
        const category = item?.dataset.category;
        if (!category) return;

        // Remove from categories
        const idx = state.categories.indexOf(category);
        if (idx !== -1) {
            state.categories.splice(idx, 1);
            saveState();
            updateCategoryDropdown();
            renderCategoryList();
        }
    }

    // --- Share Progress ---
    function shareProgress() {
        // Close settings modal first
        if (elements.modalSettings) {
            elements.modalSettings.classList.add('hidden');
        }

        // Copy progress summary to clipboard
        const space = state.spaces.find(s => s.id === state.activeSpaceId);
        if (!space) return;

        const items = space.items || [];
        const archived = space.archivedItems || [];
        const totalItems = items.length + archived.length;
        const completedItems = archived.length + items.filter(i => isItemComplete(i)).length;

        const text = `📦 ${space.name}\n` +
            `Progress: ${completedItems}/${totalItems} items complete\n` +
            `(${totalItems > 0 ? Math.round(completedItems / totalItems * 100) : 0}%)`;

        navigator.clipboard.writeText(text).then(() => {
            alert('Progress copied to clipboard!');
        }).catch(() => {
            alert('Could not copy to clipboard.');
        });
    }

    // --- File Manager ---
    function openFileManager() {
        if (!elements.modalFiles) return;
        elements.modalFiles.classList.remove('hidden');
        loadStorageFiles();
    }

    async function loadStorageFiles() {
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

    async function handleFileClick(e) {
        const item = e.target.closest('.file-item');
        if (!item) return;

        const path = item.dataset.path;
        if (!path) return;

        if (!confirm('Delete this file? If it belongs to a quest, the image will be removed.')) {
            return;
        }

        item.style.opacity = '0.5';
        const result = await window.FirebaseBridge.deleteStorageFile(path);

        if (result.success) {
            item.remove();
            // Reset storage tracking (we'll recalculate on next sync)
            window.FirebaseBridge.storageUsedBytes = 0;
            updateStorageDisplay();
        } else {
            item.style.opacity = '1';
            alert('Failed to delete file: ' + (result.error || 'Unknown error'));
        }
    }

    // Auth handlers using FirebaseBridge
    async function handleSignIn(e) {
        e.preventDefault();
        const email = $('#signin-email').value;
        const password = $('#signin-password').value;

        if (!window.FirebaseBridge?.isConfigured) {
            showAuthError('signin', 'Firebase not configured. Please add your config to js/firebase-config.js');
            return;
        }

        clearAuthErrors();
        const result = await window.FirebaseBridge.signIn(email, password);
        if (!result.success) {
            showAuthError('signin', result.error);
        }
        // Auth state change listener will handle UI update
    }

    async function handleSignUp(e) {
        e.preventDefault();
        const name = $('#signup-name').value;
        const email = $('#signup-email').value;
        const password = $('#signup-password').value;

        console.log('handleSignUp called, FirebaseBridge:', window.FirebaseBridge);
        console.log('isConfigured:', window.FirebaseBridge?.isConfigured);

        if (!window.FirebaseBridge || !window.FirebaseBridge.isConfigured) {
            showAuthError('signup', 'Firebase not configured. Please add your config to js/firebase-config.js');
            return;
        }

        clearAuthErrors();
        console.log('Calling signUp with:', email);
        const result = await window.FirebaseBridge.signUp(email, password, name);
        console.log('signUp result:', result);
        if (!result.success) {
            showAuthError('signup', result.error);
        }
    }

    async function handlePasswordReset(e) {
        e.preventDefault();
        const email = $('#reset-email').value;

        if (!window.FirebaseBridge?.isConfigured) {
            showAuthError('reset', 'Firebase not configured.');
            return;
        }

        clearAuthErrors();
        const result = await window.FirebaseBridge.resetPassword(email);
        if (result.success) {
            showResetMessage('Password reset email sent! Check your inbox.');
        } else {
            showAuthError('reset', result.error);
        }
    }

    async function handleGoogleSignIn() {
        if (!window.FirebaseBridge?.isConfigured) {
            showAuthError('signin', 'Firebase not configured.');
            return;
        }

        clearAuthErrors();
        const result = await window.FirebaseBridge.signInWithGoogle();
        if (!result.success) {
            showAuthError('signin', result.error);
        }
    }

    async function handleLogout() {
        if (window.FirebaseBridge?.isConfigured) {
            await window.FirebaseBridge.signOut();
        }
        updateAuthUI(null);
        if (elements.userDropdown) elements.userDropdown.classList.add('hidden');
    }

    async function handleExportData() {
        if (!window.FirebaseBridge?.currentUser) {
            alert('Not logged in');
            return;
        }

        const result = await window.FirebaseBridge.exportUserData();
        if (result.success) {
            const dataStr = JSON.stringify(result.data, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fetchquest-data-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            alert('Export failed: ' + result.error);
        }
        if (elements.userDropdown) elements.userDropdown.classList.add('hidden');
    }

    async function handleDeleteAccount() {
        if (!window.FirebaseBridge?.currentUser) {
            alert('Not logged in');
            return;
        }

        // First confirmation
        const confirm1 = confirm(
            '⚠️ DELETE ACCOUNT\n\n' +
            'This will permanently delete:\n' +
            '• Your account\n' +
            '• All your cloud-saved data\n' +
            '• All spaces and quests stored online\n\n' +
            'Your local data will NOT be deleted.\n\n' +
            'Are you sure you want to continue?'
        );

        if (!confirm1) return;

        // Second confirmation - type to confirm
        const userEmail = window.FirebaseBridge.currentUser.email;
        const confirm2 = prompt(
            '🚨 FINAL CONFIRMATION\n\n' +
            `Type your email (${userEmail}) to confirm deletion:`
        );

        if (confirm2 !== userEmail) {
            alert('Email did not match. Account NOT deleted.');
            return;
        }

        const result = await window.FirebaseBridge.deleteAccount();
        if (result.success) {
            alert('Account deleted successfully.');
            updateAuthUI(null);
        } else {
            alert('Delete failed: ' + result.error);
        }
        if (elements.userDropdown) elements.userDropdown.classList.add('hidden');
    }

    // --- Animation Pause on Blur ---
    function handleWindowFocus() {
        animationsPaused = false;
        document.body.classList.remove('animations-paused');
    }

    function handleWindowBlur() {
        animationsPaused = true;
        document.body.classList.add('animations-paused');
    }

    // --- Textarea auto-resize ---
    function handleTextareaInput(e) {
        const textarea = e.target;
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    // --- Initialization ---
    function init() {
        loadState();
        sortItems();
        render();
        initParticles();

        // Event listeners
        elements.form.addEventListener('submit', handleFormSubmit);
        elements.typeBtns.forEach(btn => btn.addEventListener('click', handleTypeToggle));
        elements.btnAddObjective.addEventListener('click', handleAddObjective);
        elements.objectivesList.addEventListener('click', handleRemoveObjective);
        elements.questContainer.addEventListener('click', handleQuestAction);
        elements.questContainer.addEventListener('blur', handleNotesBlur, true); // capture phase for blur
        elements.btnAddCategory.addEventListener('click', handleAddCategory);
        elements.btnSaveCategory.addEventListener('click', handleSaveCategory);
        elements.modalCategory.addEventListener('click', handleCloseModal);
        elements.fileImport.addEventListener('change', handleFileChange);
        document.addEventListener('keydown', handleKeydown);

        // Image picker listeners
        if (elements.btnAddImage) elements.btnAddImage.addEventListener('click', handleOpenImageModal);
        if (elements.btnImageUrl) elements.btnImageUrl.addEventListener('click', handleImageUrlOption);
        if (elements.btnImageLocal) elements.btnImageLocal.addEventListener('click', handleImageLocalOption);
        if (elements.imageUrlField) elements.imageUrlField.addEventListener('input', handleImageUrlChange);
        if (elements.imageFileInput) elements.imageFileInput.addEventListener('change', handleImageFileSelect);
        if (elements.btnRemoveImage) elements.btnRemoveImage.addEventListener('click', handleRemovePreviewImage);
        if (elements.btnSaveImage) elements.btnSaveImage.addEventListener('click', handleSaveImage);
        if (elements.modalImage) elements.modalImage.addEventListener('click', handleCloseModal);

        // Settings modal listeners
        if (elements.btnSettings) elements.btnSettings.addEventListener('click', handleOpenSettings);
        if (elements.modalSettings) elements.modalSettings.addEventListener('click', handleCloseModal);
        if (elements.settingShiftAmount) elements.settingShiftAmount.addEventListener('change', handleSettingChange);
        if (elements.settingCtrlAmount) elements.settingCtrlAmount.addEventListener('change', handleSettingChange);
        if (elements.settingAutoArchive) elements.settingAutoArchive.addEventListener('change', handleSettingChange);
        if (elements.settingsBtnExport) elements.settingsBtnExport.addEventListener('click', handleExport);
        if (elements.settingsBtnImport) elements.settingsBtnImport.addEventListener('click', handleImportClick);
        if (elements.settingsBtnClear) elements.settingsBtnClear.addEventListener('click', handleClearAllData);

        // Archive panel listeners
        if (elements.archiveTrigger) elements.archiveTrigger.addEventListener('click', handleArchiveToggle);
        if (elements.archiveContainer) elements.archiveContainer.addEventListener('click', handleArchiveAction);

        // Spaces sidebar listeners
        if (elements.btnAddSpace) {
            elements.btnAddSpace.addEventListener('click', handleAddSpace);
        } else {
            console.warn('btnAddSpace element not found');
        }
        if (elements.spacesList) {
            elements.spacesList.addEventListener('click', handleSpaceAction);
        } else {
            console.warn('spacesList element not found');
        }

        // Space modal listeners
        const modalSpace = $('#modal-space');
        if (modalSpace) {
            modalSpace.addEventListener('click', handleCloseModal);
            $('#color-presets').addEventListener('click', handleColorSwatchClick);
            $('#btn-save-space').addEventListener('click', handleSaveSpace);
            $('#btn-delete-space').addEventListener('click', handleDeleteSpace);
        }

        // Color picker dropdown (portal)
        if (elements.btnColorPicker) {
            elements.btnColorPicker.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = elements.colorDropdown.classList.contains('hidden');
                elements.priorityDropdown.classList.add('hidden');

                if (isHidden) {
                    // Position dropdown relative to button
                    const rect = elements.btnColorPicker.getBoundingClientRect();
                    elements.colorDropdown.style.top = (rect.bottom + 8) + 'px';
                    elements.colorDropdown.style.left = rect.left + 'px';
                    elements.colorDropdown.classList.remove('hidden');
                } else {
                    elements.colorDropdown.classList.add('hidden');
                }
            });

            elements.colorDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
                const option = e.target.closest('.color-option');
                if (!option) return;

                // Update selection
                elements.colorDropdown.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
                option.classList.add('active');

                // Update hidden input and indicator
                const color = option.dataset.color || '';
                elements.itemColor.value = color;
                if (color) {
                    elements.colorIndicator.style.background = color;
                    elements.colorIndicator.classList.add('has-color');
                } else {
                    elements.colorIndicator.style.background = '';
                    elements.colorIndicator.classList.remove('has-color');
                }

                // Close dropdown
                elements.colorDropdown.classList.add('hidden');
            });
        }

        // Priority picker dropdown (portal)
        if (elements.btnPriorityPicker) {
            elements.btnPriorityPicker.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = elements.priorityDropdown.classList.contains('hidden');
                elements.colorDropdown.classList.add('hidden');

                if (isHidden) {
                    // Position dropdown relative to button
                    const rect = elements.btnPriorityPicker.getBoundingClientRect();
                    elements.priorityDropdown.style.top = (rect.bottom + 8) + 'px';
                    elements.priorityDropdown.style.left = rect.left + 'px';
                    elements.priorityDropdown.classList.remove('hidden');
                } else {
                    elements.priorityDropdown.classList.add('hidden');
                }
            });

            elements.priorityDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
                const option = e.target.closest('.priority-option');
                if (!option) return;

                // Update selection
                elements.priorityDropdown.querySelectorAll('.priority-option').forEach(o => o.classList.remove('active'));
                option.classList.add('active');

                // Update hidden input and indicator
                const priority = option.dataset.priority || '';
                elements.itemPriority.value = priority;

                const labels = { high: 'H', medium: 'M', low: 'L', '': '—' };
                elements.priorityIndicator.textContent = labels[priority] || '—';
                elements.priorityIndicator.className = 'priority-indicator' + (priority ? ` priority-${priority}` : '');

                // Close dropdown
                elements.priorityDropdown.classList.add('hidden');
            });
        }

        // Close dropdowns on outside click
        document.addEventListener('click', () => {
            elements.colorDropdown?.classList.add('hidden');
            elements.priorityDropdown?.classList.add('hidden');
        });

        // Animation pause on window blur
        window.addEventListener('focus', handleWindowFocus);
        window.addEventListener('blur', handleWindowBlur);

        // Textarea auto-resize and form content state
        elements.itemName.addEventListener('input', handleTextareaInput);
        elements.itemName.addEventListener('input', updateFormContentState);

        // Search functionality
        let searchTimeout;
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    searchQuery = e.target.value.trim();
                    elements.searchClear?.classList.toggle('hidden', !searchQuery);
                    render();
                }, 150);
            });
        }

        if (elements.searchClear) {
            elements.searchClear.addEventListener('click', () => {
                elements.searchInput.value = '';
                searchQuery = '';
                elements.searchClear.classList.add('hidden');
                render();
            });
        }

        if (elements.searchAllSpaces) {
            elements.searchAllSpaces.addEventListener('change', () => {
                if (searchQuery) render();
            });
        }

        // Bulk mode handlers
        if (elements.btnBulkMode) {
            elements.btnBulkMode.addEventListener('click', toggleBulkMode);
        }
        if (elements.bulkSelectAll) {
            elements.bulkSelectAll.addEventListener('click', () => {
                const cards = $$('.quest-card');
                cards.forEach(card => {
                    card.classList.add('selected');
                    selectedItems.add(card.dataset.id);
                });
                updateBulkCount();
            });
        }
        if (elements.bulkArchive) {
            elements.bulkArchive.addEventListener('click', () => {
                if (selectedItems.size === 0) return;
                bulkArchiveItems();
            });
        }
        if (elements.bulkDelete) {
            elements.bulkDelete.addEventListener('click', () => {
                if (selectedItems.size === 0) return;
                if (confirm(`Delete ${selectedItems.size} items permanently?`)) {
                    bulkDeleteItems();
                }
            });
        }
        if (elements.bulkCancel) {
            elements.bulkCancel.addEventListener('click', exitBulkMode);
        }

        // Auth event listeners
        if (elements.btnLogin) {
            elements.btnLogin.addEventListener('click', openAuthModal);
        }
        if (elements.btnUserMenu) {
            elements.btnUserMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleUserDropdown();
            });
        }
        if (elements.btnLogout) {
            elements.btnLogout.addEventListener('click', handleLogout);
        }
        if (elements.modalAuth) {
            elements.modalAuth.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-backdrop') ||
                    e.target.closest('.modal-close')) {
                    closeAuthModal();
                }
            });
        }
        elements.authTabs.forEach(tab => {
            tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
        });
        if (elements.formSignin) {
            elements.formSignin.addEventListener('submit', handleSignIn);
        }
        if (elements.formSignup) {
            elements.formSignup.addEventListener('submit', handleSignUp);
        }
        if (elements.formReset) {
            elements.formReset.addEventListener('submit', handlePasswordReset);
        }
        if (elements.btnForgotPassword) {
            elements.btnForgotPassword.addEventListener('click', showPasswordReset);
        }
        if (elements.btnBackToSignin) {
            elements.btnBackToSignin.addEventListener('click', () => switchAuthTab('signin'));
        }
        if (elements.btnGoogleSignin) {
            elements.btnGoogleSignin.addEventListener('click', handleGoogleSignIn);
        }
        // Close user dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (elements.userDropdown && !elements.userDropdown.classList.contains('hidden')) {
                if (!e.target.closest('.user-menu')) {
                    elements.userDropdown.classList.add('hidden');
                }
            }
        });

        // Export data handler
        if (elements.btnExportData) {
            elements.btnExportData.addEventListener('click', handleExportData);
        }
        // Delete account handler
        if (elements.btnDeleteAccount) {
            elements.btnDeleteAccount.addEventListener('click', handleDeleteAccount);
        }

        // Storage usage click -> open file manager
        if (elements.storageUsage) {
            elements.storageUsage.addEventListener('click', openFileManager);
        }
        if (elements.modalFiles) {
            elements.modalFiles.addEventListener('click', handleCloseModal);
        }
        if (elements.btnRefreshFiles) {
            elements.btnRefreshFiles.addEventListener('click', loadStorageFiles);
        }
        if (elements.filesList) {
            elements.filesList.addEventListener('click', handleFileClick);
        }

        // Category manager handlers
        if (elements.btnManageCategories) {
            elements.btnManageCategories.addEventListener('click', openCategoryManager);
        }
        if (elements.modalCategories) {
            elements.modalCategories.addEventListener('click', handleCloseModal);
        }
        if (elements.categoriesList) {
            elements.categoriesList.addEventListener('click', handleCategoryClick);
        }
        if (elements.btnShareProgress) {
            elements.btnShareProgress.addEventListener('click', shareProgress);
        }

        // Render archive and spaces on load
        renderArchive();
        renderSpaces();

        // Subscribe to Firebase auth state changes
        if (window.FirebaseBridge?.isConfigured) {
            window.FirebaseBridge.onAuthChange(updateAuthUI);
            // Update relative sync time every 10 seconds
            syncTimeInterval = setInterval(updateLastSyncedDisplay, 10000);
            console.log('FETCH QUEST v2.2 initialized. Firebase active.');
        } else {
            console.log('FETCH QUEST v2.2 initialized. Local storage only.');
        }
    }

    // Start the app
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
