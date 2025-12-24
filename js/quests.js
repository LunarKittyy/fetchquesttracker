/**
 * Quests Module
 * Quest/item CRUD operations and DOM updates
 */

import { state, tempObjectives, setTempObjectives, tempImageData, setTempImageData, searchQuery } from './state.js';
import { $, $$, generateId, escapeHtml, isItemComplete, getItemProgress, sortItems, getCategoryProgress, normalizeItem, groupItemsByCategory, findItemAcrossSpaces } from './utils.js';
import { saveState } from './storage.js';
import { celebrate, playSound } from './particles.js';
import { showConfirm } from './popup.js';

// Callbacks
let renderArchiveCallback = null;
let updateStatusBarCallback = null;

/**
 * Initialize quests module
 */
export function initQuests(callbacks) {
    if (callbacks.renderArchive) renderArchiveCallback = callbacks.renderArchive;
    if (callbacks.updateStatusBar) updateStatusBarCallback = callbacks.updateStatusBar;
}

/**
 * Add a new item/quest
 */
export function addItem(data) {
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
    sortItems(state.items);
    saveState();

    // Surgical DOM insertion
    insertItemIntoDOM(newItem);
    return newItem;
}

/**
 * Update a field on an item
 */
export function updateItemField(id, field, value, objectiveId = null) {
    // Try current space first, then search all spaces (for cross-space search results)
    let item = state.items.find(i => i.id === id);
    if (!item) {
        const result = findItemAcrossSpaces(state, id);
        item = result.item;
    }
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
    return { wasComplete, isNowComplete };
}

/**
 * Delete an item
 */
export function deleteItem(id) {
    const item = state.items.find(i => i.id === id);
    if (!item) return;

    const category = item.category;
    const card = $(`.quest-card[data-id="${id}"]`);

    // Delete images from Firebase Storage if user is logged in and item has storage images
    if (window.FirebaseBridge?.currentUser && item.imageUrl) {
        // Check if image is stored in Firebase Storage (not a base64 or external URL)
        if (window.FirebaseBridge.isStorageUrl(item.imageUrl)) {
            // Delete asynchronously in the background - don't block the UI
            window.FirebaseBridge.deleteItemImages(state.activeSpaceId, item.id, 'items')
                .then(async result => {
                    if (result.success && result.deletedCount > 0) {
                        console.log(`🗑️ Cleaned up ${result.deletedCount} storage file(s) for deleted quest`);
                        // Refresh storage display after Cloud Functions update
                        setTimeout(async () => {
                            await window.FirebaseBridge.fetchStorageUsage();
                            const { updateStorageDisplay } = await import('./storage.js');
                            updateStorageDisplay();
                        }, 1500);
                    }
                })
                .catch(err => console.warn('Could not cleanup storage files:', err));
        }
    }

    state.items = state.items.filter(i => i.id !== id);
    saveState();

    if (card) {
        card.style.transition = 'all 0.3s ease';
        card.style.opacity = '0';
        card.style.transform = 'translateX(-20px) scale(0.95)';
        card.style.marginBottom = '0';
        card.style.paddingTop = '0';
        card.style.paddingBottom = '0';
        card.style.maxHeight = card.offsetHeight + 'px';

        setTimeout(() => { card.style.maxHeight = '0'; }, 10);

        setTimeout(() => {
            card.remove();
            cleanupEmptyCategory(category);
            if (updateStatusBarCallback) updateStatusBarCallback();
            updateCategoryDropdown();
            if (state.items.length === 0) {
                $('#empty-state')?.classList.remove('hidden');
            }
        }, 300);
    } else {
        cleanupEmptyCategory(category);
        if (updateStatusBarCallback) updateStatusBarCallback();
        updateCategoryDropdown();
        if (state.items.length === 0) {
            $('#empty-state')?.classList.remove('hidden');
        }
    }
}

/**
 * Insert a new item into the DOM
 */
export function insertItemIntoDOM(item) {
    const category = item.category;
    const questContainer = $('#quest-container');
    const emptyState = $('#empty-state');
    let categoryGroup = $(`.category-group[data-category="${escapeHtml(category)}"]`);

    if (emptyState) emptyState.classList.add('hidden');

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

        questContainer.insertAdjacentHTML('beforeend', groupHTML);
        categoryGroup = $(`.category-group[data-category="${escapeHtml(category)}"]`);
    }

    const itemsContainer = categoryGroup.querySelector('.category-items');
    const cardHTML = createQuestCardHTML(item);

    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = cardHTML;
    const newCard = tempContainer.firstElementChild;

    newCard.style.opacity = '0';
    newCard.style.transform = 'translateY(-40px) scale(0.95)';

    const isComplete = isItemComplete(item);
    const cards = itemsContainer.querySelectorAll('.quest-card');
    let insertBeforeCard = null;

    for (const existingCard of cards) {
        const existingId = existingCard.dataset.id;
        const existingItem = state.items.find(i => i.id === existingId);
        if (existingItem) {
            const existingComplete = isItemComplete(existingItem);
            if (!isComplete && existingComplete) {
                insertBeforeCard = existingCard;
                break;
            }
            if (isComplete === existingComplete && item.createdAt > (existingItem.createdAt || 0)) {
                insertBeforeCard = existingCard;
                break;
            }
        }
    }

    // Get all cards that will need to move down (cards after the insertion point)
    const cardsToAnimate = [];
    if (insertBeforeCard) {
        let sibling = insertBeforeCard;
        while (sibling) {
            cardsToAnimate.push(sibling);
            sibling = sibling.nextElementSibling;
        }
    }

    // Measure the height the new card will take (including gap)
    // We'll estimate based on typical card height, or measure after insertion
    const estimatedNewCardHeight = 180; // Approximate height including gap

    // Pre-position cards that need to move down
    cardsToAnimate.forEach(card => {
        // Remove any existing transition to set initial position instantly
        card.style.transition = 'none';
        card.style.transform = `translateY(-${estimatedNewCardHeight}px)`;
    });

    // Insert the new card
    if (insertBeforeCard) {
        itemsContainer.insertBefore(newCard, insertBeforeCard);
    } else {
        itemsContainer.appendChild(newCard);
    }

    // Force reflow to ensure the initial positions are applied
    void newCard.offsetHeight;

    // Now animate everything smoothly
    requestAnimationFrame(() => {
        // Animate existing cards sliding down to their natural positions
        cardsToAnimate.forEach(card => {
            card.style.transition = 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)';
            card.style.transform = 'translateY(0)';
        });

        // Animate the new card flying in
        newCard.style.transition = 'opacity 0.4s ease-out, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        newCard.style.opacity = '1';
        newCard.style.transform = 'translateY(0) scale(1)';
    });

    // Clean up inline styles after animation completes
    setTimeout(() => {
        cardsToAnimate.forEach(card => {
            card.style.transition = '';
            card.style.transform = '';
        });
    }, 450);

    updateCategoryCount(category);
    updateCategoryProgress(category);
    if (updateStatusBarCallback) updateStatusBarCallback();
    updateCategoryDropdown();
}

/**
 * Render custom tags for a quest item
 * @param {Object} item - The quest item
 * @returns {string} HTML string of tag spans
 */
function renderCustomTags(item) {
    if (!item.tags || item.tags.length === 0) return '';
    if (!state.tags || state.tags.length === 0) return '';
    
    return item.tags.map(tagId => {
        const tag = state.tags.find(t => t.id === tagId);
        if (!tag) return '';
        return `<span class="quest-custom-tag" style="color: ${tag.color}; background: ${tag.color}22; border: 1px solid ${tag.color}55;">${escapeHtml(tag.name)}</span>`;
    }).join('');
}

/**
 * Create HTML for a quest card
 */
export function createQuestCardHTML(item) {
    const isComplete = isItemComplete(item);
    const progress = getItemProgress(item);
    const percent = Math.min(100, (progress.current / progress.total) * 100);

    const segmentCount = Math.min(progress.total, 20);
    let segmentsHTML = '';
    for (let i = 0; i < segmentCount; i++) {
        segmentsHTML += '<div class="progress-segment"></div>';
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
                                ${item._searchSpaceName ? `<span class="quest-space-tag">${escapeHtml(item._searchSpaceName)}</span>` : ''}
                                ${item.type === 'quest' ? '<span class="quest-type-tag">QUEST</span>' : ''}
                                ${item.priority ? `<span class="quest-priority-tag priority-${item.priority}">${item.priority.toUpperCase()}</span>` : ''}
                                <span class="quest-category-tag">${escapeHtml(item.category)}</span>
                                ${renderCustomTags(item)}
                                ${isComplete ? '<span class="quest-complete-tag">ACQUIRED</span>' : ''}
                            </div>
                            <h3 class="quest-name">
                                ${isComplete ? `<svg class="trophy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>` : ''}
                                <span class="quest-name-text" data-action="edit-name">${escapeHtml(item.name)}</span>
                            </h3>
                        </div>
                        <div class="quest-actions">
                            <button class="btn-archive" data-action="archive" title="Archive">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                            </button>
                            <button class="btn-delete" data-action="delete" title="Delete">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </button>
                            <span class="quest-count">
                                <span class="quest-count-current">${progress.current}</span>
                                <span class="quest-count-divider">/</span>
                                <span class="quest-count-target">${progress.total}</span>
                            </span>
                            <button class="btn-control btn-increment" data-action="increment" ${isComplete ? 'disabled' : ''}>
                                ${isComplete ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`}
                            </button>
                        </div>
                    ` : objectivesHTML}
                    <div class="quest-notes-section">
                        <button class="btn-notes-toggle ${item.notes ? 'has-notes' : ''}" data-action="toggle-notes" title="Notes">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        </button>
                        <div class="quest-notes hidden">
                            <textarea class="notes-textarea" data-action="update-notes" placeholder="Add notes...">${escapeHtml(item.notes || '')}</textarea>
                        </div>
                    </div>
                </div>
                ${item.imageUrl ? `<div class="quest-image-wrapper"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" class="quest-image" loading="lazy" onerror="this.style.display='none'"></div>` : ''}
            </div>
        </article>
    `;
}

/**
 * Cleanup empty category groups
 */
export function cleanupEmptyCategory(category) {
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

/**
 * Update category item count
 */
export function updateCategoryCount(category) {
    const groupEl = $(`.category-group[data-category="${escapeHtml(category)}"]`);
    if (!groupEl) return;

    const categoryItems = state.items.filter(i => i.category === category);
    const countEl = groupEl.querySelector('.category-count');
    if (countEl) countEl.textContent = categoryItems.length;
}

/**
 * Update category progress bar
 */
export function updateCategoryProgress(category) {
    const groupEl = $(`.category-group[data-category="${escapeHtml(category)}"]`);
    if (!groupEl) return;

    const categoryItems = state.items.filter(i => i.category === category);
    const progress = getCategoryProgress(categoryItems);

    const fillEl = groupEl.querySelector('.category-progress-fill');
    const textEl = groupEl.querySelector('.category-progress-text');

    if (fillEl) fillEl.style.width = `${progress.percent}%`;
    if (textEl) textEl.textContent = `${progress.current}/${progress.total}`;
}

/**
 * Update category dropdown
 */
export function updateCategoryDropdown() {
    const itemCategory = $('#item-category');
    if (!itemCategory) return;

    const fromItems = state.items.map(i => i.category || 'Misc');
    const all = [...new Set([...state.categories, ...fromItems])].sort();
    const currentValue = itemCategory.value;

    itemCategory.innerHTML = all.map(cat =>
        `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`
    ).join('');

    if (all.includes(currentValue)) {
        itemCategory.value = currentValue;
    }
}

/**
 * Update card progress display
 */
export function updateCardProgress(id, archiveItemCallback) {
    // Try current space first, then search all spaces (for cross-space search results)
    let item = state.items.find(i => i.id === id);
    if (!item) {
        const result = findItemAcrossSpaces(state, id);
        item = result.item;
    }
    if (!item) return;

    const card = $(`.quest-card[data-id="${id}"]`);
    if (!card) return;

    const isComplete = isItemComplete(item);
    const progress = getItemProgress(item);
    const percent = Math.min(100, (progress.current / progress.total) * 100);

    const progressFill = card.querySelector('.progress-fill');
    if (progressFill) {
        progressFill.style.width = `${percent}%`;
        progressFill.classList.add('updating');
        setTimeout(() => progressFill.classList.remove('updating'), 500);
    }

    const countCurrent = card.querySelector('.quest-count-current');
    const countTarget = card.querySelector('.quest-count-target');
    if (countCurrent) {
        countCurrent.textContent = progress.current;
        if (!document.body.classList.contains('sync-update')) {
            countCurrent.classList.add('bumping');
            setTimeout(() => countCurrent.classList.remove('bumping'), 250);
        }
    }
    if (countTarget) countTarget.textContent = progress.total;

    // Update button disabled states for item type cards
    const decrementBtn = card.querySelector('.btn-decrement');
    const incrementBtn = card.querySelector('.btn-increment');
    if (decrementBtn) decrementBtn.disabled = item.current <= 0;
    if (incrementBtn) incrementBtn.disabled = isComplete;

    if (isComplete && !card.classList.contains('complete')) {
        card.classList.add('complete');
        celebrate(card, item.type);

        if (state.autoArchive && archiveItemCallback) {
            card.classList.add('pending-archive');
            const handleArchiveTrigger = () => {
                if (card.classList.contains('pending-archive')) {
                    setTimeout(() => {
                        const stillItem = state.items.find(i => i.id === item.id);
                        if (stillItem && isItemComplete(stillItem)) {
                            archiveItemCallback(item.id);
                        }
                    }, 800);
                }
            };
            
            // On mobile, use touchend since mouseleave doesn't fire properly
            if (window.FirebaseBridge?.isMobile) {
                // Use a short delay to let touch sequence complete
                setTimeout(handleArchiveTrigger, 100);
            } else {
                card.addEventListener('mouseleave', handleArchiveTrigger, { once: true });
            }
        }
    } else if (!isComplete && card.classList.contains('complete')) {
        card.classList.remove('complete', 'pending-archive');
    }

    updateCategoryProgress(item.category);
    if (updateStatusBarCallback) updateStatusBarCallback();
}

/**
 * Update objective display
 */
export function updateObjectiveDisplay(itemId, objectiveId, archiveItemCallback) {
    // Try current space first, then search all spaces (for cross-space search results)
    let item = state.items.find(i => i.id === itemId);
    if (!item) {
        const result = findItemAcrossSpaces(state, itemId);
        item = result.item;
    }
    if (!item) return;

    const objective = item.objectives.find(o => o.id === objectiveId);
    if (!objective) return;

    const objEl = $(`.objective-item[data-objective-id="${objectiveId}"]`);
    if (!objEl) return;

    const isObjComplete = objective.current >= objective.target;

    const checkbox = objEl.querySelector('.objective-checkbox');
    if (checkbox) {
        checkbox.classList.toggle('checked', isObjComplete);
    }

    const countEl = objEl.querySelector('.objective-count');
    if (countEl) countEl.textContent = `${objective.current}/${objective.target}`;

    // Update button disabled states
    const decrementBtn = objEl.querySelector('.objective-btn.decrement');
    const incrementBtn = objEl.querySelector('.objective-btn.increment');
    if (decrementBtn) decrementBtn.disabled = objective.current <= 0;
    if (incrementBtn) incrementBtn.disabled = isObjComplete;

    objEl.classList.toggle('complete', isObjComplete);
    if (isObjComplete) playSound('tick');

    updateCardProgress(itemId, archiveItemCallback);
}
