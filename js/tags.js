import { elements } from './elements.js';
import { state, selectedTags, setSelectedTags, addSelectedItem } from './state.js';
import { saveState } from './storage.js';
import { showAlert } from './popup.js';
import { escapeHtml, $$ } from './utils.js';
import { updateBulkCount } from './bulk.js';

// Local state for the module
let currentTagColor = '#4ecdb4';
let editTagsSelectedTags = [];

// --- Tag Manager (Settings) ---

export function openTagManager() {
    elements.modalSettings?.classList.add('hidden');
    elements.modalTags?.classList.remove('hidden');
    if (elements.newTagName) elements.newTagName.value = '';
    currentTagColor = '#4ecdb4';
    updateTagColorPreview();
    renderTagList();
}

export function updateTagColorPreview() {
    const preview = elements.btnTagColor?.querySelector('.tag-color-preview');
    if (preview) {
        preview.style.background = currentTagColor;
    }
}

export function renderTagList() {
    if (!elements.tagsList) return;
    const tags = state.tags || [];

    // Count how many items use each tag (across ALL spaces)
    const usageCount = {};
    (state.spaces || []).forEach(space => {
        (space.items || []).forEach(item => {
            (item.tags || []).forEach(tagId => {
                usageCount[tagId] = (usageCount[tagId] || 0) + 1;
            });
        });
    });

    if (tags.length === 0) {
        elements.tagsList.innerHTML = '<p class="settings-hint">No tags created yet. Add one above!</p>';
        return;
    }

    elements.tagsList.innerHTML = tags.map(tag => {
        const count = usageCount[tag.id] || 0;
        const isUsed = count > 0;
        return `
            <div class="tag-item" data-tag-id="${tag.id}">
                <span class="tag-color-dot" style="background: ${tag.color}"></span>
                <span class="tag-name">${escapeHtml(tag.name)}</span>
                ${isUsed ? `<span class="tag-usage">(${count})</span>` : ''}
                <button class="tag-item-delete" title="Delete">×</button>
            </div>
        `;
    }).join('');
}

export function handleAddTag() {
    const name = elements.newTagName?.value.trim();
    if (!name) {
        elements.newTagName?.focus();
        return;
    }

    const space = (state.spaces || []).find(s => s.id === state.activeSpaceId);
    if (!space) return;

    if (!state.tags) state.tags = [];

    const nameLower = name.toLowerCase();

    // Reserved names that can't be used for custom tags
    const reservedNames = ['low', 'medium', 'high', 'none', 'quest', 'item'];
    if (reservedNames.includes(nameLower)) {
        showAlert(`"${name}" is a reserved tag name. Please choose a different name.`, 'ERROR');
        return;
    }

    // Check for duplicate name with existing custom tags
    if ((state.tags || []).some(t => t.name.toLowerCase() === nameLower)) {
        showAlert('A tag with this name already exists.', 'ERROR');
        return;
    }

    const newTag = {
        id: 'tag_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4),
        name: name.toUpperCase(),
        color: currentTagColor
    };

    if (!state.tags) state.tags = [];
    state.tags.push(newTag);
    saveState();

    if (elements.newTagName) elements.newTagName.value = '';
    renderTagList();
    updateTagPickerDropdown();
}

export function handleTagListClick(e) {
    const deleteBtn = e.target.closest('.tag-item-delete');
    if (!deleteBtn) return;

    const tagItem = deleteBtn.closest('.tag-item');
    const tagId = tagItem?.dataset.tagId;
    if (!tagId) return;

    if (!state.tags) return;

    state.tags = (state.tags || []).filter(t => t.id !== tagId);
    saveState();
    renderTagList();
    updateTagPickerDropdown();
}

// --- Tag Picker (Form) ---

export function updateTagPickerDropdown() {
    if (!elements.tagDropdown) return;
    const tags = state.tags || [];
    const optionsContainer = elements.tagDropdown.querySelector('.tag-picker-options');
    if (!optionsContainer) return;

    if (tags.length === 0) {
        optionsContainer.innerHTML = '<div class="tag-picker-empty">No tags defined. Manage tags in settings.</div>';
        return;
    }

    optionsContainer.innerHTML = tags.map(tag => {
        const isSelected = selectedTags.includes(tag.id);
        return `
            <div class="tag-picker-item ${isSelected ? 'selected' : ''}" data-tag-id="${tag.id}">
                <span class="tag-color-dot" style="background: ${tag.color}"></span>
                <span class="tag-name">${escapeHtml(tag.name)}</span>
                <svg class="tag-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            </div>
        `;
    }).join('');
}

export function updateTagIndicator() {
    if (elements.tagIndicator) {
        elements.tagIndicator.textContent = selectedTags.length;
        elements.tagIndicator.classList.toggle('has-tags', selectedTags.length > 0);
    }
}

export function handleTagPickerClick(e) {
    const item = e.target.closest('.tag-picker-item');
    if (!item) return;

    const tagId = item.dataset.tagId;
    if (!tagId) return;

    // Toggle selection
    if (selectedTags.includes(tagId)) {
        setSelectedTags(selectedTags.filter(id => id !== tagId));
    } else {
        setSelectedTags([...selectedTags, tagId]);
    }

    item.classList.toggle('selected');
    updateTagIndicator();
}

// --- Edit Tags Modal (Context Menu Action) ---

export function openEditTagsModal(itemId) {
    const item = (state.items || []).find(i => i.id === itemId);
    if (!item) return;

    elements.editTagsItemId.value = itemId;
    editTagsSelectedTags = [...(item.tags || [])];
    renderEditTagsList();
    elements.modalEditTags?.classList.remove('hidden');
}

export function renderEditTagsList() {
    if (!elements.editTagsList) return;
    const tags = state.tags || [];

    if (tags.length === 0) {
        elements.editTagsList.innerHTML = '<p class="settings-hint">No tags defined. Create tags in settings first.</p>';
        return;
    }

    elements.editTagsList.innerHTML = tags.map(tag => {
        const isSelected = editTagsSelectedTags.includes(tag.id);
        return `
            <div class="tag-picker-item ${isSelected ? 'selected' : ''}" data-tag-id="${tag.id}">
                <span class="tag-color-dot" style="background: ${tag.color}"></span>
                <span class="tag-name">${escapeHtml(tag.name)}</span>
                <svg class="tag-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            </div>
        `;
    }).join('');
}

export function handleEditTagsClick(e) {
    const item = e.target.closest('.tag-picker-item');
    if (!item) return;

    const tagId = item.dataset.tagId;
    if (!tagId) return;

    // Toggle selection
    if (editTagsSelectedTags.includes(tagId)) {
        editTagsSelectedTags = editTagsSelectedTags.filter(id => id !== tagId);
    } else {
        editTagsSelectedTags.push(tagId);
    }

    item.classList.toggle('selected');
}

export function saveItemTags() {
    const itemId = elements.editTagsItemId?.value;
    if (!itemId) return;

    const item = (state.items || []).find(i => i.id === itemId);
    if (!item) return;

    item.tags = [...editTagsSelectedTags];
    saveState();

    // Notify app to re-render
    document.dispatchEvent(new CustomEvent('render-app'));

    elements.modalEditTags?.classList.add('hidden');

}

// --- Tag Color Picker ---

export function initTagColorPicker() {
    elements.btnTagColor?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = elements.tagColorDropdown?.classList.contains('hidden');
        if (isHidden) {
            const rect = elements.btnTagColor.getBoundingClientRect();
            if (elements.tagColorDropdown) {
                elements.tagColorDropdown.style.top = (rect.bottom + 8) + 'px';
                elements.tagColorDropdown.style.left = rect.left + 'px';
                elements.tagColorDropdown.classList.remove('hidden');
            }
        } else {
            elements.tagColorDropdown?.classList.add('hidden');
        }
    });

    elements.tagColorDropdown?.addEventListener('click', (e) => {
        e.stopPropagation();
        const option = e.target.closest('.color-option');
        if (!option) return;

        elements.tagColorDropdown.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
        option.classList.add('active');

        currentTagColor = option.dataset.color || '#4ecdb4';
        updateTagColorPreview();
        elements.tagColorDropdown.classList.add('hidden');
    });
}

// --- Select by Tag (Bulk Mode) ---

export function populateSelectByTagDropdown() {
    if (!elements.selectByTagDropdown) return;
    const optionsContainer = elements.selectByTagDropdown.querySelector('.tag-picker-options');
    if (!optionsContainer) return;

    const space = (state.spaces || []).find(s => s.id === state.activeSpaceId);
    const items = state.items;

    // Collect all unique categories from items
    const categories = [...new Set(items.map(i => i.category || 'Misc'))];

    // Collect priorities that are actually used
    const priorities = [...new Set(items.map(i => i.priority).filter(p => p))];

    // Get custom tags from space
    const customTags = state.tags || [];

    let html = '';

    // Categories section
    if (categories.length > 0) {
        html += '<div class="select-tag-section">CATEGORY</div>';
        categories.forEach(cat => {
            html += `<div class="tag-picker-item" data-select-type="category" data-select-value="${escapeHtml(cat)}">
                <span class="tag-name">${escapeHtml(cat)}</span>
            </div>`;
        });
    }

    // Priorities section
    if (priorities.length > 0) {
        html += '<div class="select-tag-section">PRIORITY</div>';
        priorities.forEach(pri => {
            html += `<div class="tag-picker-item" data-select-type="priority" data-select-value="${pri}">
                <span class="tag-name">${pri.toUpperCase()}</span>
            </div>`;
        });
    }

    // Custom tags section
    if (customTags.length > 0) {
        html += '<div class="select-tag-section">TAGS</div>';
        customTags.forEach(tag => {
            html += `<div class="tag-picker-item" data-select-type="tag" data-select-value="${tag.id}">
                <span class="tag-color-dot" style="background: ${tag.color}"></span>
                <span class="tag-name">${escapeHtml(tag.name)}</span>
            </div>`;
        });
    }

    if (html === '') {
        html = '<div class="tag-picker-empty">No filter options available.</div>';
    }

    optionsContainer.innerHTML = html;
}

export function handleSelectByTagClick(e) {
    const item = e.target.closest('.tag-picker-item');
    if (!item) return;

    const selectType = item.dataset.selectType;
    const selectValue = item.dataset.selectValue;
    if (!selectType || !selectValue) return;

    // Find matching items and select them
    const cards = $$('.quest-card');
    cards.forEach(card => {
        const itemId = card.dataset.id;
        const questItem = (state.items || []).find(i => i.id === itemId);
        if (!questItem) return;

        let matches = false;
        if (selectType === 'category' && questItem.category === selectValue) matches = true;
        if (selectType === 'priority' && questItem.priority === selectValue) matches = true;
        if (selectType === 'tag' && questItem.tags?.includes(selectValue)) matches = true;

        if (matches) {
            addSelectedItem(itemId);
            card.classList.add('selected');
        }
    });

    updateBulkCount();
    elements.selectByTagDropdown?.classList.add('hidden');
}
