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
        items: [],
        archivedItems: [],
        categories: [...DEFAULT_CATEGORIES],
        soundEnabled: false,  // Sound OFF by default
        shiftAmount: 5,
        ctrlAmount: 10,
        autoArchive: true
    };

    // --- DOM References ---
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const elements = {
        form: $('#add-quest-form'),
        itemName: $('#item-name'),
        itemGoal: $('#item-goal'),
        itemImage: $('#item-image'),
        itemCategory: $('#item-category'),
        questContainer: $('#quest-container'),
        emptyState: $('#empty-state'),
        fileImport: $('#file-import'),
        statusTotal: $('#status-total'),
        statusComplete: $('#status-complete'),
        typeBtns: $$('.type-btn'),
        itemFields: $('#item-fields'),
        questFields: $('#quest-fields'),
        objectivesList: $('#objectives-list'),
        btnAddObjective: $('#btn-add-objective'),
        btnAddCategory: $('#btn-add-category'),
        modalCategory: $('#modal-category'),
        newCategoryName: $('#new-category-name'),
        btnSaveCategory: $('#btn-save-category'),
        toggleSound: $('#toggle-sound'),
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
        // Archive panel elements
        archivePanel: $('#archive-panel'),
        archiveTrigger: $('#archive-trigger'),
        archiveContainer: $('#archive-container'),
        archiveCount: $('#archive-count')
    };

    let currentType = 'item';
    let tempObjectives = [];
    let tempImageData = null;
    let particleCtx = null;
    let particles = [];
    let animationsPaused = false;
    let saveIndicatorTimeout = null;

    // --- LocalStorage Functions ---
    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            showSaveIndicator();
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
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
            if (stored) {
                const parsed = JSON.parse(stored);
                state.items = parsed.items || [];
                state.archivedItems = parsed.archivedItems || [];
                state.categories = parsed.categories || [...DEFAULT_CATEGORIES];
                state.soundEnabled = parsed.soundEnabled !== false;
                state.shiftAmount = parsed.shiftAmount || 5;
                state.ctrlAmount = parsed.ctrlAmount || 10;
                state.autoArchive = parsed.autoArchive !== false;

                // Ensure all items have required properties
                state.items = state.items.map(item => normalizeItem(item));
                state.archivedItems = state.archivedItems.map(item => normalizeItem(item));
            }
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
            state = { items: [], archivedItems: [], categories: [...DEFAULT_CATEGORIES], soundEnabled: false, shiftAmount: 5, ctrlAmount: 10, autoArchive: true };
        }
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
            completedAt: item.completedAt || null
        };
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
        state.items.sort((a, b) => {
            const aComplete = isItemComplete(a);
            const bComplete = isItemComplete(b);
            if (aComplete !== bComplete) return aComplete ? 1 : -1;
            return (b.createdAt || 0) - (a.createdAt || 0);
        });
    }

    function getUniqueCategories() {
        const fromItems = state.items.map(i => i.category || 'Misc');
        const all = [...new Set([...state.categories, ...fromItems])];
        return all.sort();
    }

    function groupItemsByCategory() {
        const categories = getUniqueCategories();
        const grouped = {};
        categories.forEach(cat => {
            const catItems = state.items.filter(i => (i.category || 'Misc') === cat);
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

        // Add entrance animation
        newCard.style.opacity = '0';
        newCard.style.transform = 'translateY(-10px)';

        // Find the correct position (after any complete items if this is incomplete, etc.)
        const isComplete = isItemComplete(item);
        const cards = itemsContainer.querySelectorAll('.quest-card');
        let inserted = false;

        for (const existingCard of cards) {
            const existingId = existingCard.dataset.id;
            const existingItem = state.items.find(i => i.id === existingId);
            if (existingItem) {
                const existingComplete = isItemComplete(existingItem);
                // Insert before first complete item if we're incomplete
                // Or insert by date comparison
                if (!isComplete && existingComplete) {
                    itemsContainer.insertBefore(newCard, existingCard);
                    inserted = true;
                    break;
                }
                // Insert before older items of same completion status
                if (isComplete === existingComplete && item.createdAt > (existingItem.createdAt || 0)) {
                    itemsContainer.insertBefore(newCard, existingCard);
                    inserted = true;
                    break;
                }
            }
        }

        if (!inserted) {
            itemsContainer.appendChild(newCard);
        }

        // Animate in
        requestAnimationFrame(() => {
            newCard.style.transition = 'all 0.3s ease-out';
            newCard.style.opacity = '1';
            newCard.style.transform = 'translateY(0)';
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
            countCurrent.classList.add('bumping');
            setTimeout(() => countCurrent.classList.remove('bumping'), 250);
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
            <article class="quest-card ${isComplete ? 'complete' : ''}" data-id="${item.id}" data-type="${item.type}">
                ${imageHTML}
                <div class="quest-header">
                    <div class="quest-info">
                        <div class="quest-tags">
                            ${item.type === 'quest' ? '<span class="quest-type-tag">QUEST</span>' : ''}
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
                            ${escapeHtml(item.name)}
                        </h3>
                    </div>
                    <button class="btn-delete" data-action="delete" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
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

        // Clear existing groups
        const existingGroups = elements.questContainer.querySelectorAll('.category-group');
        existingGroups.forEach(g => g.remove());

        if (state.items.length === 0) {
            elements.emptyState.classList.remove('hidden');
        } else {
            elements.emptyState.classList.add('hidden');

            const grouped = groupItemsByCategory();
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
            target: parseInt(elements.itemGoal.value) || 1,
            objectives: currentType === 'quest' ? [...tempObjectives] : []
        };

        addItem(data);

        // Reset form
        elements.itemName.value = '';
        elements.itemImage.value = '';
        tempImageData = null;
        elements.btnAddImage.classList.remove('has-image');
        elements.imagePreview.classList.add('hidden');
        elements.itemGoal.value = '4';
        tempObjectives = [];
        elements.objectivesList.innerHTML = '';
        elements.itemName.focus();
        updateFormContentState();

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
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        const card = btn.closest('.quest-card');
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
        if (e.target.classList.contains('modal-backdrop') ||
            e.target.classList.contains('modal-close') ||
            e.target.classList.contains('modal-cancel')) {
            elements.modalCategory.classList.add('hidden');
            elements.modalImage.classList.add('hidden');
            elements.modalSettings.classList.add('hidden');
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
        // Sync modal with current state
        elements.settingShiftAmount.value = state.shiftAmount;
        elements.settingCtrlAmount.value = state.ctrlAmount;
        elements.settingSoundEnabled.checked = state.soundEnabled;
        elements.settingAutoArchive.checked = state.autoArchive;
        elements.modalSettings.classList.remove('hidden');
    }

    function handleSettingChange() {
        state.shiftAmount = parseInt(elements.settingShiftAmount.value) || 5;
        state.ctrlAmount = parseInt(elements.settingCtrlAmount.value) || 10;
        state.soundEnabled = elements.settingSoundEnabled.checked;
        state.autoArchive = elements.settingAutoArchive.checked;
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

        // Sound toggle state
        if (elements.toggleSound) {
            elements.toggleSound.checked = state.soundEnabled;
        }

        // Event listeners
        elements.form.addEventListener('submit', handleFormSubmit);
        elements.typeBtns.forEach(btn => btn.addEventListener('click', handleTypeToggle));
        elements.btnAddObjective.addEventListener('click', handleAddObjective);
        elements.objectivesList.addEventListener('click', handleRemoveObjective);
        elements.questContainer.addEventListener('click', handleQuestAction);
        elements.btnAddCategory.addEventListener('click', handleAddCategory);
        elements.btnSaveCategory.addEventListener('click', handleSaveCategory);
        elements.modalCategory.addEventListener('click', handleCloseModal);
        elements.toggleSound.addEventListener('change', handleSoundToggle);
        elements.fileImport.addEventListener('change', handleFileChange);
        document.addEventListener('keydown', handleKeydown);

        // Image picker listeners
        elements.btnAddImage.addEventListener('click', handleOpenImageModal);
        elements.btnImageUrl.addEventListener('click', handleImageUrlOption);
        elements.btnImageLocal.addEventListener('click', handleImageLocalOption);
        elements.imageUrlField.addEventListener('input', handleImageUrlChange);
        elements.imageFileInput.addEventListener('change', handleImageFileSelect);
        elements.btnRemoveImage.addEventListener('click', handleRemovePreviewImage);
        elements.btnSaveImage.addEventListener('click', handleSaveImage);
        elements.modalImage.addEventListener('click', handleCloseModal);

        // Settings modal listeners
        elements.btnSettings.addEventListener('click', handleOpenSettings);
        elements.modalSettings.addEventListener('click', handleCloseModal);
        elements.settingShiftAmount.addEventListener('change', handleSettingChange);
        elements.settingCtrlAmount.addEventListener('change', handleSettingChange);
        elements.settingSoundEnabled.addEventListener('change', handleSettingChange);
        elements.settingAutoArchive.addEventListener('change', handleSettingChange);
        elements.settingsBtnExport.addEventListener('click', handleExport);
        elements.settingsBtnImport.addEventListener('click', handleImportClick);
        elements.settingsBtnClear.addEventListener('click', handleClearAllData);

        // Archive panel listeners
        elements.archiveTrigger.addEventListener('click', handleArchiveToggle);
        elements.archiveContainer.addEventListener('click', handleArchiveAction);

        // Animation pause on window blur
        window.addEventListener('focus', handleWindowFocus);
        window.addEventListener('blur', handleWindowBlur);

        // Textarea auto-resize and form content state
        elements.itemName.addEventListener('input', handleTextareaInput);
        elements.itemName.addEventListener('input', updateFormContentState);

        // Render archive on load
        renderArchive();

        console.log('FETCH QUEST v2.2 initialized. Local storage active.');
    }

    // Start the app
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
