/**
 * FETCH QUEST - Loot Tracker
 * Vanilla JavaScript with localStorage persistence
 */

(function() {
    'use strict';

    // --- Constants ---
    const STORAGE_KEY = 'fetchquest_items';

    // --- State ---
    let items = [];

    // --- DOM References ---
    const elements = {
        form: document.getElementById('add-quest-form'),
        itemName: document.getElementById('item-name'),
        itemGoal: document.getElementById('item-goal'),
        itemCategory: document.getElementById('item-category'),
        categorySection: document.getElementById('category-section'),
        categoryList: document.getElementById('category-list'),
        toggleCategory: document.getElementById('toggle-category'),
        questContainer: document.getElementById('quest-container'),
        emptyState: document.getElementById('empty-state'),
        btnExport: document.getElementById('btn-export'),
        btnImport: document.getElementById('btn-import'),
        fileImport: document.getElementById('file-import'),
        statusTotal: document.getElementById('status-total'),
        statusComplete: document.getElementById('status-complete')
    };

    // --- LocalStorage Functions ---
    function saveItems() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    }

    function loadItems() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                items = JSON.parse(stored);
                // Ensure all items have required properties
                items = items.map(item => ({
                    id: item.id || generateId(),
                    name: item.name || 'Unknown Item',
                    target: item.target || 1,
                    current: item.current || 0,
                    category: item.category || 'Misc',
                    createdAt: item.createdAt || Date.now()
                }));
            }
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
            items = [];
        }
    }

    // --- Utility Functions ---
    function generateId() {
        return 'quest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function sortItems() {
        items.sort((a, b) => {
            const aComplete = a.current >= a.target;
            const bComplete = b.current >= b.target;
            // Incomplete items first
            if (aComplete !== bComplete) {
                return aComplete ? 1 : -1;
            }
            // Then by creation date (newest first)
            return (b.createdAt || 0) - (a.createdAt || 0);
        });
    }

    function getUniqueCategories() {
        const categories = [...new Set(items.map(i => i.category || 'Misc'))];
        return categories.sort();
    }

    function groupItemsByCategory() {
        const categories = getUniqueCategories();
        const grouped = {};
        categories.forEach(cat => {
            grouped[cat] = items.filter(i => (i.category || 'Misc') === cat);
        });
        return grouped;
    }

    // --- CRUD Operations ---
    function addItem(name, target, category) {
        const newItem = {
            id: generateId(),
            name: name.trim(),
            target: Math.max(1, parseInt(target) || 1),
            current: 0,
            category: category.trim() || 'Misc',
            createdAt: Date.now()
        };
        items.push(newItem);
        sortItems();
        saveItems();
        render();
    }

    function updateItem(id, updates) {
        const index = items.findIndex(i => i.id === id);
        if (index !== -1) {
            items[index] = { ...items[index], ...updates };
            sortItems();
            saveItems();
            render();
        }
    }

    function deleteItem(id) {
        items = items.filter(i => i.id !== id);
        saveItems();
        render();
    }

    function incrementItem(id) {
        const item = items.find(i => i.id === id);
        if (item && item.current < item.target) {
            updateItem(id, { current: item.current + 1 });
        }
    }

    function decrementItem(id) {
        const item = items.find(i => i.id === id);
        if (item && item.current > 0) {
            updateItem(id, { current: item.current - 1 });
        }
    }

    // --- Import/Export ---
    function exportData() {
        if (items.length === 0) return;
        
        const exportItems = items.map(({ id, ...rest }) => rest);
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportItems, null, 2));
        const downloadLink = document.createElement('a');
        downloadLink.setAttribute('href', dataStr);
        downloadLink.setAttribute('download', 'fetch_quest_data.json');
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
    }

    function importData(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                if (Array.isArray(importedData)) {
                    importedData.forEach(item => {
                        const newItem = {
                            id: generateId(),
                            name: item.name || 'Unknown Item',
                            target: item.target || 1,
                            current: item.current || 0,
                            category: item.category || 'Misc',
                            createdAt: Date.now()
                        };
                        items.push(newItem);
                    });
                    sortItems();
                    saveItems();
                    render();
                }
            } catch (err) {
                console.error('Import failed:', err);
                alert('Failed to import data. Please ensure the file is valid JSON.');
            }
        };
        reader.readAsText(file);
    }

    // --- Rendering ---
    function createQuestCardHTML(item) {
        const isComplete = item.current >= item.target;
        const percentage = Math.min(100, Math.max(0, (item.current / item.target) * 100));
        
        // Create progress segments (max 20 visible segments)
        const segmentCount = Math.min(item.target, 20);
        let segmentsHTML = '';
        for (let i = 0; i < segmentCount; i++) {
            segmentsHTML += '<div class="progress-segment"></div>';
        }

        return `
            <article class="quest-card ${isComplete ? 'complete' : ''}" data-id="${item.id}">
                <div class="quest-header">
                    <div class="quest-info">
                        <div class="quest-tags">
                            <span class="quest-category-tag">${escapeHtml(item.category)}</span>
                            ${isComplete ? '<span class="quest-complete-tag">ACQUIRED</span>' : ''}
                        </div>
                        <h3 class="quest-name">
                            ${isComplete ? `
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
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
                    <button class="btn-delete" data-action="delete" data-id="${item.id}" title="Delete quest" aria-label="Delete ${escapeHtml(item.name)}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                    </button>
                </div>
                
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%"></div>
                        <div class="progress-segments">${segmentsHTML}</div>
                    </div>
                </div>
                
                <div class="quest-controls">
                    <button class="btn-control btn-decrement" data-action="decrement" data-id="${item.id}" ${item.current <= 0 ? 'disabled' : ''} aria-label="Decrease count">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                    </button>
                    
                    <span class="quest-count">
                        <span class="quest-count-current">${item.current}</span>
                        <span class="quest-count-divider">/</span>
                        <span class="quest-count-target">${item.target}</span>
                    </span>
                    
                    <button class="btn-control btn-increment" data-action="increment" data-id="${item.id}" ${isComplete ? 'disabled' : ''} aria-label="${isComplete ? 'Quest complete' : 'Increase count'}">
                        ${isComplete ? `
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                        ` : `
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                        `}
                    </button>
                </div>
            </article>
        `;
    }

    function createCategoryGroupHTML(category, categoryItems) {
        const itemsHTML = categoryItems.map(item => createQuestCardHTML(item)).join('');
        
        return `
            <section class="category-group">
                <div class="category-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <h2 class="category-name">${escapeHtml(category)}</h2>
                    <span class="category-count">${categoryItems.length}</span>
                </div>
                <div class="category-items">
                    ${itemsHTML}
                </div>
            </section>
        `;
    }

    function render() {
        // Update status bar
        const completeCount = items.filter(i => i.current >= i.target).length;
        elements.statusTotal.textContent = items.length;
        elements.statusComplete.textContent = completeCount;
        
        // Update export button state
        elements.btnExport.disabled = items.length === 0;
        
        // Update category datalist
        const categories = getUniqueCategories();
        elements.categoryList.innerHTML = categories.map(c => `<option value="${escapeHtml(c)}">`).join('');
        
        // Clear container (except empty state)
        const existingGroups = elements.questContainer.querySelectorAll('.category-group');
        existingGroups.forEach(g => g.remove());
        
        if (items.length === 0) {
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

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // --- Event Handlers ---
    function handleFormSubmit(e) {
        e.preventDefault();
        
        const name = elements.itemName.value.trim();
        if (!name) return;
        
        const target = elements.itemGoal.value;
        const category = elements.itemCategory.value;
        
        addItem(name, target, category);
        
        // Reset form (keep category for rapid entry)
        elements.itemName.value = '';
        elements.itemGoal.value = '4';
        elements.itemName.focus();
    }

    function handleToggleCategory() {
        const isHidden = elements.categorySection.classList.contains('hidden');
        elements.categorySection.classList.toggle('hidden');
        elements.toggleCategory.textContent = isHidden ? '- Hide Classification' : '+ Add Classification';
    }

    function handleQuestAction(e) {
        const button = e.target.closest('[data-action]');
        if (!button) return;
        
        const action = button.dataset.action;
        const id = button.dataset.id;
        
        switch (action) {
            case 'increment':
                incrementItem(id);
                break;
            case 'decrement':
                decrementItem(id);
                break;
            case 'delete':
                if (confirm('Remove this acquisition target?')) {
                    deleteItem(id);
                }
                break;
        }
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
        e.target.value = null; // Reset for same file re-import
    }

    // --- Initialization ---
    function init() {
        // Load saved data
        loadItems();
        sortItems();
        
        // Initial render
        render();
        
        // Event listeners
        elements.form.addEventListener('submit', handleFormSubmit);
        elements.toggleCategory.addEventListener('click', handleToggleCategory);
        elements.questContainer.addEventListener('click', handleQuestAction);
        elements.btnExport.addEventListener('click', handleExport);
        elements.btnImport.addEventListener('click', handleImportClick);
        elements.fileImport.addEventListener('change', handleFileChange);
        
        console.log('FETCH QUEST initialized. Local storage active.');
    }

    // Start the app when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
