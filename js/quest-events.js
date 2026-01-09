/**
 * Quest Events Module
 * Handles user interactions with quest cards (increment, decrement, archive, delete, etc.)
 */

import { elements } from './elements.js';
import { state, searchQuery, bulkMode } from './state.js';
import { findItemAcrossSpaces } from './utils.js';
import { updateItemField, updateCardProgress, updateObjectiveDisplay, deleteItem, insertItemIntoDOM, cleanupEmptyCategory } from './quests.js';
import { archiveItem } from './archive.js';
import { handleBulkCardClick } from './bulk.js';
import { showConfirm } from './popup.js';
import { openEditTagsModal } from './tags.js';


/**
 * Handle actions on quest cards (clicks on buttons)
 * @param {Event} e 
 */
export function handleQuestAction(e) {
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

    // When searching across all spaces, find item in any space
    const searchingAllSpaces = searchQuery && elements.searchAllSpaces?.checked;
    let item;
    if (searchingAllSpaces) {
        const result = findItemAcrossSpaces(state, itemId);
        item = result.item;
    } else {
        item = state.items.find(i => i.id === itemId);
    }

    switch (action) {
        case 'increment':
        case 'decrement': {
            if (!item) return;
            let delta = action === 'increment' ? 1 : -1;
            if (e.shiftKey) delta *= state.shiftAmount;
            if (e.ctrlKey) delta *= state.ctrlAmount;
            const newVal = Math.min(item.target, Math.max(0, item.current + delta));
            updateItemField(itemId, 'current', newVal);
            updateCardProgress(itemId, archiveItem);
            if (action === 'increment') {

            }
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
            const newVal = Math.min(objective.target, Math.max(0, objective.current + delta));
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
        case 'edit-current': {
            const currentEl = e.target.closest('.quest-count-current');
            if (!currentEl || !item) return;
            const currentVal = item.current || 0;
            const targetVal = item.target || 1;

            const input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.max = targetVal;
            input.className = 'quest-current-edit';
            input.value = currentVal;
            input.style.cssText = 'width: 3em; text-align: center; font-size: inherit; padding: 2px 4px; border-radius: 4px; border: 1px solid var(--clr-accent-primary, #4ecdb4); background: var(--clr-bg-tertiary, #1a1a2e); color: inherit;';

            currentEl.replaceWith(input);
            input.focus();
            input.select();

            const finishEdit = () => {
                let newVal = parseInt(input.value);
                if (isNaN(newVal)) newVal = currentVal;
                newVal = Math.min(targetVal, Math.max(0, newVal));

                updateItemField(itemId, 'current', newVal);

                const span = document.createElement('span');
                span.className = 'quest-count-current';
                span.dataset.action = 'edit-current';
                span.title = 'Click to edit';
                span.textContent = newVal;

                if (input.parentNode) input.replaceWith(span);
                updateCardProgress(itemId, archiveItem);
            };

            input.addEventListener('blur', finishEdit);
            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') {
                    input.blur();
                }
                if (ev.key === 'Escape') {
                    input.value = currentVal;
                    input.blur();
                }
            });
            break;
        }
        case 'edit-goal': {
            const targetEl = e.target.closest('.quest-count-target');
            if (!targetEl || !item) return;
            const currentTarget = item.target || 1;
            const input = document.createElement('input');
            input.type = 'number';
            input.min = '1';
            input.className = 'quest-goal-edit';
            input.value = currentTarget;
            input.style.cssText = 'width: 3em; text-align: center; font-size: inherit; padding: 2px 4px; border-radius: 4px; border: 1px solid var(--clr-accent-primary, #4ecdb4); background: var(--clr-bg-tertiary, #1a1a2e); color: inherit;';
            targetEl.replaceWith(input);
            input.focus();
            input.select();
            input.addEventListener('blur', () => {
                const newTarget = Math.max(1, parseInt(input.value) || currentTarget);
                updateItemField(itemId, 'target', newTarget);
                const span = document.createElement('span');
                span.className = 'quest-count-target';
                span.dataset.action = 'edit-goal';
                span.title = 'Click to edit goal';
                span.textContent = newTarget;
                input.replaceWith(span);
                updateCardProgress(itemId, archiveItem);
            });
            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') input.blur();
                if (ev.key === 'Escape') {
                    input.value = currentTarget;
                    input.blur();
                }
            });
            break;
        }
        case 'start-category-edit':
            startCategoryEdit(itemId);
            break;
        case 'open-edit-tags':
            openEditTagsModal(itemId);
            break;
    }
}

/**
 * Handle blur event on notes textarea
 * @param {Event} e 
 */
export function handleNotesBlur(e) {
    if (e.target.classList.contains('notes-textarea')) {
        const card = e.target.closest('.quest-card');
        if (card) {
            updateItemField(card.dataset.id, 'notes', e.target.value);
        }
    }
}

/**
 * Start editing category for an item (inline)
 * @param {string} itemId 
 */
export function startCategoryEdit(itemId) {
    const card = document.querySelector(`.quest-card[data-id="${itemId}"]`);
    if (!card) return;

    const categoryTag = card.querySelector('.quest-category-tag');
    if (!categoryTag) return;

    const item = state.items.find(i => i.id === itemId);
    if (!item) return;

    const currentCategory = item.category;

    // Create select element
    const select = document.createElement('select');
    select.className = 'category-edit-select';

    // Populate with categories
    state.categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        if (cat === currentCategory) option.selected = true;
        select.appendChild(option);
    });

    // Style the select to look like the tag
    select.style.cssText = `
        font-size: 0.65rem;
        padding: 0 4px;
        border-radius: 4px;
        background: var(--clr-bg-elevated);
        border: 1px solid var(--clr-accent-primary);
        color: var(--clr-text-primary);
        margin-right: 0.5rem;
        cursor: pointer;
    `;

    // Replace tag with select
    categoryTag.replaceWith(select);
    select.focus();

    // Auto-open the dropdown
    try {
        if (select.showPicker) {
            select.showPicker();
        }
    } catch (err) {
        console.log('Auto-open dropdown failed:', err);
    }

    // Handle change/blur
    const finishEdit = () => {
        const newCategory = select.value;
        if (newCategory && newCategory !== currentCategory) {
            updateItemField(itemId, 'category', newCategory);

            // Move item in DOM immediately
            const oldCategory = currentCategory;

            // 1. Remove from current position
            card.remove();

            // 2. Clean up old category if empty
            cleanupEmptyCategory(oldCategory);

            // 3. Re-insert into new location
            // The item object in state has already been updated by updateItemField
            // We need to fetch the updated item to ensure we have the latest data
            const updatedItem = state.items.find(i => i.id === itemId);
            if (updatedItem) {
                insertItemIntoDOM(updatedItem);
            }
        } else {
            // Restore original tag if no change - with all attributes!
            const span = document.createElement('span');
            span.className = 'quest-category-tag clickable'; // Added clickable class
            span.dataset.action = 'start-category-edit'; // Added action
            span.title = 'Change category'; // Added title
            span.textContent = currentCategory;
            select.replaceWith(span);
        }
    };

    select.addEventListener('change', () => {
        finishEdit();
        select.blur();
    });

    select.addEventListener('blur', () => {
        // If still in DOM (not replaced by change event), revert
        if (select.parentNode) {
            finishEdit();
        }
    });

    select.addEventListener('click', (e) => e.stopPropagation());
    select.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') select.blur();
        if (e.key === 'Escape') {
            const span = document.createElement('span');
            span.className = 'quest-category-tag clickable'; // Added clickable class
            span.dataset.action = 'start-category-edit'; // Added action
            span.title = 'Change category'; // Added title
            span.textContent = currentCategory;
            select.replaceWith(span);
        }
    });
}
