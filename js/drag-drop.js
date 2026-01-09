/**
 * Drag and Drop Module
 * Handles dragging quests between categories
 */

import { state } from './state.js';
import { updateItemField } from './quests.js';

let draggedItemId = null;
let dragSourceCategory = null;

/**
 * Initialize Drag and Drop listeners
 * @param {HTMLElement} container - The main container for quests
 */
export function initDragDrop(container) {
    if (!container) return;

    container.addEventListener('dragstart', handleDragStart);
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('dragleave', handleDragLeave);
    container.addEventListener('drop', handleDrop);
    container.addEventListener('dragend', handleDragEnd);
}

function handleDragStart(e) {
    const card = e.target.closest('.quest-card');
    if (!card) return;

    draggedItemId = card.dataset.id;
    const item = state.items.find(i => i.id === draggedItemId);
    if (item) {
        dragSourceCategory = item.category;
    }

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedItemId);

    // Add dragging class for visuals
    setTimeout(() => card.classList.add('dragging'), 0);
}

function handleDragOver(e) {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';

    const categoryGroup = e.target.closest('.category-group');
    if (categoryGroup) {
        const targetCategory = categoryGroup.dataset.category;
        // Don't highlight if dropping in same category
        if (targetCategory !== dragSourceCategory) {
            categoryGroup.classList.add('drag-over');
        }
    }
}

function handleDragLeave(e) {
    const categoryGroup = e.target.closest('.category-group');
    if (categoryGroup) {
        categoryGroup.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();

    const categoryGroup = e.target.closest('.category-group');
    if (!categoryGroup || !draggedItemId) return;

    const targetCategory = categoryGroup.dataset.category;

    // Only update if category changed
    if (targetCategory && targetCategory !== dragSourceCategory) {
        updateItemField(draggedItemId, 'category', targetCategory);
        document.dispatchEvent(new CustomEvent('render-app'));
    }

    cleanupDragClasses();
}

function handleDragEnd(e) {
    cleanupDragClasses();
    draggedItemId = null;
    dragSourceCategory = null;
}

function cleanupDragClasses() {
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}
