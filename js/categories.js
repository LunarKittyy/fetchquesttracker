/**
 * Category Management Module
 * Handles creating, deleting, and reordering categories.
 */

import { elements } from './elements.js';
import { state } from './state.js';
import { saveState } from './storage.js';
import { escapeHtml, $$ } from './utils.js';
import { showAlert, showConfirm } from './popup.js';

let draggedCategory = null;

/**
 * Open Category Manager Modal
 */
export function openCategoryManager() {
    elements.modalSettings?.classList.add('hidden');
    elements.modalCategories?.classList.remove('hidden');
    if (elements.newCategoryName) elements.newCategoryName.value = '';
    renderCategoryList();
}

/**
 * Render list of categories with drag handles
 */
export function renderCategoryList() {
    if (!elements.categoriesList) return;

    // Use state.categories for order
    const categories = state.categories || [];

    // Count usage just for info
    const usageCount = {};
    (state.items || []).forEach(item => {
        const cat = item.category || 'Misc';
        usageCount[cat] = (usageCount[cat] || 0) + 1;
    });

    if (categories.length === 0) {
        elements.categoriesList.innerHTML = '<p class="settings-hint">No custom categories. Add one above!</p>';
        return;
    }

    elements.categoriesList.innerHTML = categories.map(cat => {
        const count = usageCount[cat] || 0;
        return `
            <div class="category-manager-item" draggable="true" data-category="${escapeHtml(cat)}">
                <div class="drag-handle" title="Drag to reorder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="8" y1="6" x2="16" y2="6"/>
                        <line x1="8" y1="12" x2="16" y2="12"/>
                        <line x1="8" y1="18" x2="16" y2="18"/>
                    </svg>
                </div>
                <span class="category-name">${escapeHtml(cat)}</span>
                <span class="category-usage">(${count})</span>
                <button class="category-delete" title="Delete">×</button>
            </div>
        `;
    }).join('');

    // Re-attach drag listeners to new items
    initCategoryDragListeners();
}

/**
 * Add a new category
 */
export function handleAddCategory() {
    const nameInput = elements.newCategoryName;
    if (!nameInput) return;

    const name = nameInput.value.trim();
    if (!name) {
        nameInput.focus();
        return;
    }

    // Check duplicates
    if ((state.categories || []).includes(name)) {
        showAlert('Category already exists.', 'ERROR');
        return;
    }

    if (!state.categories) state.categories = [];
    state.categories.push(name);
    saveState();

    nameInput.value = '';
    renderCategoryList();

    // Refresh main app
    document.dispatchEvent(new CustomEvent('render-app'));
}

/**
 * Handle clicks on category list (Delete)
 */
export function handleCategoryListClick(e) {
    if (e.target.closest('.category-delete')) {
        const item = e.target.closest('.category-manager-item');
        const category = item.dataset.category;

        // Confirm before delete
        showConfirm(`Delete category "${category}"? Items will be moved to "Misc".`, 'DELETE CATEGORY', true)
            .then(confirmed => {
                if (confirmed) {
                    deleteCategory(category);
                }
            });
    }
}

/**
 * Delete a category and move items to Misc
 */
function deleteCategory(category) {
    // Remove from state.categories
    state.categories = (state.categories || []).filter(c => c !== category);

    // Update items to 'Misc'
    let itemsUpdated = false;
    (state.items || []).forEach(item => {
        if (item.category === category) {
            item.category = 'Misc';
            itemsUpdated = true;
        }
    });

    saveState();
    renderCategoryList();
    document.dispatchEvent(new CustomEvent('render-app'));
}

/**
 * Initialize drag listeners for category reordering
 */
function initCategoryDragListeners() {
    const list = elements.categoriesList;
    if (!list) return;

    const items = list.querySelectorAll('.category-manager-item');
    items.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
    });
}

function handleDragStart(e) {
    draggedCategory = this; // 'this' is the element
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    if (this === draggedCategory) return;

    const rect = this.getBoundingClientRect();
    // Insert before or after based on mouse position
    const midY = rect.top + rect.height / 2;

    if (e.clientY < midY) {
        this.parentNode.insertBefore(draggedCategory, this);
    } else {
        this.parentNode.insertBefore(draggedCategory, this.nextSibling);
    }
}

function handleDrop(e) {
    e.stopPropagation();
    saveNewOrder();
    // Dispatch render app to update main view order immediately
    document.dispatchEvent(new CustomEvent('render-app'));
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    draggedCategory = null;
}

/**
 * Save the new order from DOM to state
 */
function saveNewOrder() {
    if (!elements.categoriesList) return;

    const newOrder = [];
    elements.categoriesList.querySelectorAll('.category-manager-item').forEach(el => {
        newOrder.push(el.dataset.category);
    });

    // Detect if order actually changed
    if (JSON.stringify(newOrder) !== JSON.stringify(state.categories)) {
        state.categories = newOrder;
        saveState();
    }
}
