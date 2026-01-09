/**
 * Form Logic Module
 * Handles the "Add Quest" form, including validation, objectives, and image inputs.
 */

import { elements } from './elements.js';
import {
    state, currentType, setCurrentType,
    tempObjectives, setTempObjectives,
    tempImageData, setTempImageData,
    selectedTags, clearSelectedTags
} from './state.js';
import { generateId, escapeHtml } from './utils.js';
import { parseItemInput } from './input-parser.js';
import { addItem } from './quests.js';
import { closeAllModals } from './modals.js';


// We need to import these update functions from somewhere. 
// Looking at app.js, `updateTagIndicator` and `updateTagPickerDropdown` are likely defined there too.
// I will need to check if they exist or if I need to move them too. 
// For now, I will comment them out or rely on them being passed/imported if they exist in `utils.js` or elsewhere.
// Wait, `updateTagIndicator` is NOT in the imports of app.js. It must be defined in app.js.
// I need to be careful here. 

/**
 * Handle form submission
 * @param {Event} e 
 */
export function handleFormSubmit(e) {
    e.preventDefault();

    const rawName = elements.itemName.value.trim();
    const hasImage = tempImageData || elements.itemImage.value;

    if (!rawName && !hasImage) return;

    // Parse quantity from name (e.g., "Film Reels x5")
    const parsed = parseItemInput(rawName);
    const manualQty = parseInt(elements.itemGoal.value);
    // Use parsed qty if found, otherwise use manual input
    const target = parsed.quantity ?? (manualQty || 4);

    addItem({
        type: currentType,
        name: parsed.name || 'Unnamed Item',
        imageUrl: tempImageData || elements.itemImage.value || null,
        category: elements.itemCategory.value,
        color: elements.itemColor.value || null,
        priority: elements.itemPriority.value || null,
        target,
        objectives: currentType === 'quest' ? [...tempObjectives] : [],
        tags: [...selectedTags]
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

    // Reset tags
    clearSelectedTags();

    // Dispatch custom event so app.js or tags.js can update UI
    document.dispatchEvent(new CustomEvent('form-reset'));

    elements.itemName.focus();
    updateFormContentState();
}

/**
 * Toggle between ITEM and QUEST modes
 * @param {Event} e 
 */
export function handleTypeToggle(e) {
    const btn = e.target.closest('.type-btn');
    if (!btn) return;

    const newType = btn.dataset.type;
    setCurrentType(newType);
    elements.typeBtns.forEach(b => b.classList.toggle('active', b.dataset.type === newType));
    elements.addQuestForm?.classList.toggle('quest-mode', newType === 'quest');

    // Toggle visibility of item fields vs quest fields
    if (newType === 'item') {
        elements.itemFields?.classList.remove('hidden');
        elements.questFields?.classList.add('hidden');
    } else {
        elements.itemFields?.classList.add('hidden');
        elements.questFields?.classList.remove('hidden');
    }
}

/**
 * Update form's has-content class based on input state
 */
export function updateFormContentState() {
    const hasText = elements.itemName?.value.trim().length > 0;
    const hasImage = tempImageData !== null || elements.btnAddImage?.classList.contains('has-image');
    const hasObjectives = tempObjectives.length > 0;

    if (hasText || hasImage || hasObjectives) {
        elements.form?.classList.add('has-content');
    } else {
        elements.form?.classList.remove('has-content');
    }
}

/**
 * Add a new objective input to the form
 */
export function handleAddObjective() {
    const id = generateId();
    const newObj = { id, name: '', current: 0, target: 1 };
    setTempObjectives([...tempObjectives, newObj]);
    renderObjectives();
    updateFormContentState();
}

/**
 * Remove an objective from the form
 * @param {Event} e 
 */
export function handleRemoveObjective(e) {
    const btn = e.target.closest('.btn-remove-objective');
    if (!btn) return;
    const id = btn.dataset.id;
    setTempObjectives(tempObjectives.filter(o => o.id !== id));
    renderObjectives();
    updateFormContentState();
}

/**
 * Render the list of objectives in the form
 */
export function renderObjectives() {
    if (!elements.objectivesList) return;
    elements.objectivesList.innerHTML = tempObjectives.map(obj => `
        <div class="objective-row" data-id="${obj.id}">
            <input type="text" class="input-field objective-name-input" placeholder="Objective name" value="${escapeHtml(obj.name)}" data-field="name">
            <input type="number" class="input-field input-number objective-target-input" min="1" value="${obj.target}" data-field="target">
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

// --- Image Handling Logic ---

export function handleOpenImageModal() {
    closeAllModals();
    elements.modalImage?.classList.remove('hidden');
    elements.imageUrlInput?.classList.add('hidden');
    elements.imageModalPreview?.classList.add('hidden');
    elements.btnImageUrl?.classList.remove('active');
    elements.btnImageLocal?.classList.remove('active');
    if (elements.imageUrlField) elements.imageUrlField.value = '';
}

export function handleImageUrlOption() {
    elements.btnImageUrl?.classList.add('active');
    elements.btnImageLocal?.classList.remove('active');
    elements.imageUrlInput?.classList.remove('hidden');
    elements.imageUrlField?.focus();
}

export function handleImageLocalOption() {
    elements.btnImageUrl?.classList.remove('active');
    elements.btnImageLocal?.classList.add('active');
    elements.imageFileInput?.click();
}

export function handleImageUrlChange() {
    const url = elements.imageUrlField?.value.trim();
    if (url && elements.imageModalPreviewImg) {
        elements.imageModalPreviewImg.src = url;
        elements.imageModalPreview?.classList.remove('hidden');
    } else {
        elements.imageModalPreview?.classList.add('hidden');
    }
}

export function handleImageFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        if (elements.imageModalPreviewImg) {
            elements.imageModalPreviewImg.src = e.target.result;
            elements.imageModalPreview?.classList.remove('hidden');
        }
    };
    reader.readAsDataURL(file);
}

export function handleSaveImage() {
    if (elements.imageModalPreviewImg && elements.imageModalPreviewImg.src) {
        const src = elements.imageModalPreviewImg.src;
        setTempImageData(src);

        // Show preview in form
        elements.btnAddImage?.classList.add('has-image');
        if (elements.imagePreview) {
            elements.imagePreview.innerHTML = `<img src="${src}" alt="Preview"><button type="button" id="btn-clear-image" class="btn-clear-image">×</button>`;
            elements.imagePreview.classList.remove('hidden');

            // Add handler for clear button
            document.getElementById('btn-clear-image')?.addEventListener('click', () => {
                setTempImageData(null);
                elements.btnAddImage?.classList.remove('has-image');
                elements.imagePreview?.classList.add('hidden');
                updateFormContentState();
            });
        }
    }
    closeAllModals();
    updateFormContentState();
}

export function handleRemoveImage() {
    setTempImageData(null);
    if (elements.imageModalPreviewImg) elements.imageModalPreviewImg.src = '';
    elements.imageModalPreview?.classList.add('hidden');
    elements.imageFileInput.value = ''; // Reset file input
}
