/**
 * Custom Drag and Drop Module
 * Mouse-based implementation for iOS-style visual control
 * No native HTML5 drag API - full control over ghost and animations
 */

import { state } from './state.js';
import { updateItemField } from './quests.js';
import { saveState } from './storage.js';

// State
let isDragging = false;
let draggedCard = null;
let draggedItemId = null;
let dragSourceCategory = null;
let ghostElement = null;
let placeholder = null;
let currentDropTarget = null;
let dropPosition = null;
let startX = 0;
let startY = 0;
let offsetX = 0;
let offsetY = 0;

/**
 * Initialize Custom Drag and Drop
 */
export function initDragDrop(container) {
    if (!container) return;

    // Use mousedown on cards to start drag
    container.addEventListener('mousedown', handleMouseDown);

    // Global listeners for move and release
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Cancel drag if focus is lost (e.g., alt-tab, click outside window)
    window.addEventListener('blur', handleCancel);

    // Cancel drag on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isDragging) {
            handleCancel();
        }
    });
}

function createGhost(card) {
    const rect = card.getBoundingClientRect();
    const ghost = card.cloneNode(true);

    ghost.classList.add('drag-ghost');
    ghost.style.cssText = `
        position: fixed;
        width: ${rect.width}px;
        left: ${rect.left}px;
        top: ${rect.top}px;
        z-index: 10000;
        pointer-events: none;
        will-change: transform, left, top;
    `;

    document.body.appendChild(ghost);

    // Force reflow then add lifted class for CSS transition
    void ghost.offsetHeight;
    ghost.classList.add('lifted');

    return ghost;
}

function createPlaceholder() {
    const el = document.createElement('div');
    el.className = 'quest-drop-placeholder';
    return el;
}

function handleMouseDown(e) {
    // Only start drag if clicking the drag handle
    const handle = e.target.closest('.drag-handle');
    if (!handle) return;

    const card = handle.closest('.quest-card');
    if (!card) return;

    // Ignore if clicking interactive elements
    if (e.target.closest('button, input, textarea, a, .quest-qty-controls')) return;

    // Clean up any leftover state from previous drags
    cleanupLeftovers();

    e.preventDefault();

    const rect = card.getBoundingClientRect();

    // Store drag state
    draggedCard = card;
    draggedItemId = card.dataset.id;
    startX = e.clientX;
    startY = e.clientY;
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    const item = state.items.find(i => i.id === draggedItemId);
    if (item) {
        dragSourceCategory = item.category;
    }

    // Create placeholder
    placeholder = createPlaceholder();

    // Capture positions of cards and categories for FLIP animation
    const questContainer = document.getElementById('quest-container');
    const allCards = Array.from(questContainer.querySelectorAll('.quest-card')).filter(c => c !== card);
    const allCategories = Array.from(questContainer.querySelectorAll('.category-group'));

    const positions = new Map();
    [...allCards, ...allCategories].forEach(el => {
        positions.set(el, el.getBoundingClientRect());
    });

    // Create ghost and hide original
    ghostElement = createGhost(card);
    card.classList.add('dragging');

    // Insert placeholder where card was
    card.parentNode.insertBefore(placeholder, card);

    // Animate cards with FLIP (not categories - they can snap, cards overlapping them looks worse)
    allCards.forEach(el => {
        const first = positions.get(el);
        const last = el.getBoundingClientRect();
        const deltaY = first.top - last.top;

        if (Math.abs(deltaY) > 1) {
            el.style.transform = `translateY(${deltaY}px)`;
            el.style.transition = 'none';
            el.style.zIndex = '1'; // Keep cards below category headers

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    el.style.transition = 'transform 0.45s cubic-bezier(0.25, 1.25, 0.5, 1)';
                    el.style.transform = '';
                    // Clean up z-index after animation
                    setTimeout(() => {
                        el.style.zIndex = '';
                    }, 400);
                });
            });
        }
    });

    isDragging = true;
}

function handleMouseMove(e) {
    if (!isDragging || !ghostElement) return;

    // Move ghost to follow cursor
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;

    ghostElement.style.left = `${x}px`;
    ghostElement.style.top = `${y}px`;

    // Find drop target - try element under cursor first
    ghostElement.style.display = 'none';
    const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
    ghostElement.style.display = '';

    let categoryGroup = elementBelow?.closest('.category-group');
    let targetCard = elementBelow?.closest('.quest-card:not(.dragging)');

    // If not over a category, use Y position to find the right spot in source category
    if (!categoryGroup) {
        // Fall back to the source category - find card based on Y position
        categoryGroup = document.querySelector(`.category-group[data-category="${dragSourceCategory}"]`);
        if (!categoryGroup) return;

        // Find card by Y position
        const cards = categoryGroup.querySelectorAll('.quest-card:not(.dragging)');
        for (const card of cards) {
            const rect = card.getBoundingClientRect();
            if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
                targetCard = card;
                break;
            }
            // If cursor is above this card
            if (e.clientY < rect.top) {
                targetCard = card;
                break;
            }
        }
    }

    const targetCategory = categoryGroup.dataset.category;
    const questCardsContainer = categoryGroup.querySelector('.category-items');

    if (!questCardsContainer) return;

    // If over a card, position placeholder relative to it
    if (targetCard && targetCard.dataset.id !== draggedItemId) {
        const rect = targetCard.getBoundingClientRect();
        const cardCenterY = rect.top + rect.height / 2;
        const newPosition = e.clientY < cardCenterY ? 'before' : 'after';

        if (currentDropTarget !== targetCard || dropPosition !== newPosition) {
            currentDropTarget = targetCard;
            dropPosition = newPosition;

            animateCards(questCardsContainer, () => {
                if (newPosition === 'before') {
                    targetCard.parentNode.insertBefore(placeholder, targetCard);
                } else {
                    targetCard.parentNode.insertBefore(placeholder, targetCard.nextSibling);
                }
            });
        }

        // Keep drag-over highlight if dragging to a different category
        if (targetCategory !== dragSourceCategory) {
            categoryGroup.classList.add('drag-over');
        } else {
            categoryGroup.classList.remove('drag-over');
        }
    } else if (!targetCard) {
        // Over empty space in category or below all cards
        const cards = questCardsContainer.querySelectorAll('.quest-card:not(.dragging)');
        const lastCard = cards[cards.length - 1];

        if (targetCategory !== dragSourceCategory || cards.length === 0) {
            if (!placeholder.parentNode || placeholder.parentNode !== questCardsContainer) {
                animateCards(questCardsContainer, () => {
                    questCardsContainer.appendChild(placeholder);
                });
                currentDropTarget = lastCard || null;
                dropPosition = 'after';
            }
            categoryGroup.classList.add('drag-over');
        } else if (lastCard && e.clientY > lastCard.getBoundingClientRect().bottom) {
            if (currentDropTarget !== lastCard || dropPosition !== 'after') {
                currentDropTarget = lastCard;
                dropPosition = 'after';
                animateCards(questCardsContainer, () => {
                    questCardsContainer.appendChild(placeholder);
                });
            }
        }
    }
}

function animateCards(container, doChange) {
    const questContainer = document.getElementById('quest-container');
    const allCards = Array.from(questContainer.querySelectorAll('.quest-card:not(.dragging)'));

    const firstPositions = new Map();
    allCards.forEach(el => {
        firstPositions.set(el, el.getBoundingClientRect());
    });

    doChange();

    allCards.forEach(el => {
        const first = firstPositions.get(el);
        if (!first) return;

        const last = el.getBoundingClientRect();
        const deltaY = first.top - last.top;

        if (Math.abs(deltaY) > 1) {
            el.style.transform = `translateY(${deltaY}px)`;
            el.style.transition = 'none';
            el.style.zIndex = '1'; // Keep cards below category headers

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    el.style.transition = 'transform 0.45s cubic-bezier(0.25, 1.25, 0.5, 1)';
                    el.style.transform = '';
                    setTimeout(() => {
                        el.style.zIndex = '';
                    }, 400);
                });
            });
        }
    });
}

function handleMouseUp(e) {
    if (!isDragging) return;

    isDragging = false;

    // Get placeholder position for animation
    const placeholderRect = placeholder ? placeholder.getBoundingClientRect() : null;

    // Determine drop target
    let didReorder = false;
    const categoryGroup = placeholder?.closest('.category-group');
    const targetCategory = categoryGroup?.dataset.category;

    if (placeholder && placeholder.parentNode && targetCategory) {
        let prevCard = placeholder.previousElementSibling;
        let nextCard = placeholder.nextElementSibling;

        while (prevCard && prevCard.classList.contains('dragging')) {
            prevCard = prevCard.previousElementSibling;
        }
        while (nextCard && nextCard.classList.contains('dragging')) {
            nextCard = nextCard.nextElementSibling;
        }

        let targetId = null;
        let position = null;

        if (nextCard && nextCard.classList.contains('quest-card')) {
            targetId = nextCard.dataset.id;
            position = 'before';
        } else if (prevCard && prevCard.classList.contains('quest-card')) {
            targetId = prevCard.dataset.id;
            position = 'after';
        }

        if (targetId && targetId !== draggedItemId) {
            // reorderItemSilent call moved to after DOM swap
            didReorder = true;
        } else if (targetCategory !== dragSourceCategory) {
            updateItemField(draggedItemId, 'category', targetCategory);
            const item = state.items.find(i => i.id === draggedItemId);
            if (item) delete item.sortIndex;
            didReorder = true;
        }
    }

    // Store references before we null them
    const theGhost = ghostElement;
    const theCard = draggedCard;
    const thePlaceholder = placeholder;

    // Get where the card will go (placeholder position) BEFORE any DOM changes
    const targetRect = placeholderRect;

    // Get container for FLIP animation
    const questContainer = document.getElementById('quest-container');

    // Capture positions BEFORE DOM change (cards only - categories can snap)
    const allCards = questContainer ? Array.from(questContainer.querySelectorAll('.quest-card:not(.dragging)')) : [];

    const flipPositions = new Map();
    allCards.forEach(el => {
        flipPositions.set(el, el.getBoundingClientRect());
    });

    // Replace placeholder with card - move first while still display:none
    if (thePlaceholder && thePlaceholder.parentNode && theCard) {
        // Move card to placeholder position (still display:none, no flash)
        thePlaceholder.parentNode.insertBefore(theCard, thePlaceholder);
        thePlaceholder.parentNode.removeChild(thePlaceholder);

        // Atomically swap dragging -> drop-animating (opacity:0 takes over)
        theCard.classList.replace('dragging', 'drop-animating');

        // NOW call reorder - DOM is correct (card is in new position)
        if (didReorder && targetCategory) {
            // We don't need targetId/position anymore since we read from DOM
            reorderItemSilent(draggedItemId, null, null, targetCategory);
        }
    }

    // Save state if reordered (don't re-render - card is already positioned in DOM)
    if (didReorder) {
        saveState();
    }

    // FLIP: animate cards pushing down IMMEDIATELY
    allCards.forEach(el => {
        const first = flipPositions.get(el);
        if (!first) return;

        const last = el.getBoundingClientRect();
        const deltaY = first.top - last.top;

        if (Math.abs(deltaY) > 1) {
            el.style.transform = `translateY(${deltaY}px)`;
            el.style.transition = 'none';
            el.style.zIndex = '1'; // Keep cards below category headers

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    el.style.transition = 'transform 0.45s cubic-bezier(0.25, 1.25, 0.5, 1)';
                    el.style.transform = '';

                    // Clean up inline styles after animation
                    setTimeout(() => {
                        el.style.transition = '';
                        el.style.zIndex = '';
                    }, 400);
                });
            });
        }
    });

    // Animate ghost to where placeholder was (card has display:none so can't get its rect)
    if (theGhost && targetRect && theCard) {
        theGhost.style.transition = 'left 0.35s cubic-bezier(0.25, 1.25, 0.5, 1), top 0.35s cubic-bezier(0.25, 1.25, 0.5, 1), transform 0.3s cubic-bezier(0.25, 1.25, 0.5, 1), box-shadow 0.3s ease';
        theGhost.style.left = `${targetRect.left}px`;
        theGhost.style.top = `${targetRect.top}px`;
        theGhost.style.transform = 'scale(1)';
        theGhost.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';

        // After ghost animation completes: reveal card UNDER ghost, then remove ghost
        setTimeout(() => {
            if (theCard) {
                // First: reveal the card (it appears under the ghost which is still there)
                theCard.classList.remove('drop-animating');
                // Clean up any inline styles from FLIP
                theCard.style.transform = '';
                theCard.style.transition = '';
            }
            // Next frame: remove the ghost (card is already visible underneath)
            requestAnimationFrame(() => {
                if (theGhost && theGhost.parentNode) {
                    theGhost.parentNode.removeChild(theGhost);
                }
            });
        }, 300);
    } else {
        // Immediate cleanup - no ghost animation
        if (theGhost && theGhost.parentNode) {
            theGhost.parentNode.removeChild(theGhost);
        }
        if (thePlaceholder && thePlaceholder.parentNode && theCard) {
            thePlaceholder.parentNode.insertBefore(theCard, thePlaceholder);
            thePlaceholder.parentNode.removeChild(thePlaceholder);
            theCard.classList.remove('dragging');
        } else if (theCard) {
            theCard.classList.remove('dragging');
        }
    }

    // Save state if reordered (don't re-render - card is already positioned in DOM)
    if (didReorder) {
        saveState();
    }

    // Clear drag-over highlights
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));

    // Reset state
    isDragging = false;
    ghostElement = null;
    draggedCard = null;
    draggedItemId = null;
    dragSourceCategory = null;
    placeholder = null;
    currentDropTarget = null;
    dropPosition = null;
}

/**
 * Cancel drag and restore card to original position
 */
function handleCancel() {
    if (!isDragging) return;

    isDragging = false;

    // FLIP animation: capture positions before cleanup (cards only)
    const questContainer = document.getElementById('quest-container');
    const allCards = questContainer ? Array.from(questContainer.querySelectorAll('.quest-card:not(.dragging)')) : [];

    const positions = new Map();
    allCards.forEach(el => {
        positions.set(el, el.getBoundingClientRect());
    });

    // Remove placeholder
    if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
    }

    // Show the card again
    if (draggedCard) {
        draggedCard.classList.remove('dragging');
    }

    // Animate ghost back to card position then remove
    if (ghostElement && draggedCard) {
        const cardRect = draggedCard.getBoundingClientRect();

        ghostElement.style.transition = 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)';
        ghostElement.style.left = `${cardRect.left}px`;
        ghostElement.style.top = `${cardRect.top}px`;
        ghostElement.style.transform = 'scale(1)';
        ghostElement.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';

        setTimeout(() => {
            if (ghostElement && ghostElement.parentNode) {
                ghostElement.parentNode.removeChild(ghostElement);
            }
        }, 300);
    } else if (ghostElement && ghostElement.parentNode) {
        ghostElement.parentNode.removeChild(ghostElement);
    }

    // Animate cards back with FLIP
    allCards.forEach(el => {
        const first = positions.get(el);
        if (!first) return;

        const last = el.getBoundingClientRect();
        const deltaY = first.top - last.top;

        if (Math.abs(deltaY) > 1) {
            el.style.transform = `translateY(${deltaY}px)`;
            el.style.transition = 'none';
            el.style.zIndex = '1';

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    el.style.transition = 'transform 0.45s cubic-bezier(0.25, 1.25, 0.5, 1)';
                    el.style.transform = '';
                    setTimeout(() => {
                        el.style.zIndex = '';
                    }, 400);
                });
            });
        }
    });

    // Clear drag-over highlights
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));

    // Reset state
    ghostElement = null;
    draggedCard = null;
    draggedItemId = null;
    dragSourceCategory = null;
    placeholder = null;
    currentDropTarget = null;
    dropPosition = null;
}

function reorderItemSilent(draggedId, targetId, position, targetCategory) {
    const draggedItem = state.items.find(i => i.id === draggedId);

    if (!draggedItem) return;

    // Update dragged item's category if changed
    if (draggedItem.category !== targetCategory) {
        draggedItem.category = targetCategory;
    }

    // Recalculate sort indices for ALL items in the affected category based on DOM order
    const categoryGroup = document.querySelector(`.category-group[data-category="${targetCategory}"]`);
    if (categoryGroup) {
        const cardIds = Array.from(categoryGroup.querySelectorAll('.quest-card'))
            .map(el => el.dataset.id);

        // Update sort index for each item in this category
        cardIds.forEach((id, index) => {
            const item = state.items.find(i => i.id === id);
            if (item) {
                // Use large gaps to allow inserting between without reindexing everything next time
                item.sortIndex = index * 1000;
            }
        });
    }

    // Also handle source category if different (reindex to fill gaps)
    if (draggedItem.category !== targetCategory) {
        // We can't easily get the source category DOM if we just dragged out of it
        // But we can re-sort the data items that remain in that category
        const sourceCategoryItems = state.items
            .filter(i => (i.category || 'Misc') === dragSourceCategory && i.id !== draggedId)
            .sort((a, b) => (a.sortIndex || 0) - (b.sortIndex || 0));

        sourceCategoryItems.forEach((item, index) => {
            item.sortIndex = index * 1000;
        });
    }
}

/**
 * Clean up any leftover elements from previous drags
 * Called at start of new drag to ensure clean state
 */
function cleanupLeftovers() {
    // Remove any existing ghost elements
    document.querySelectorAll('.drag-ghost').forEach(el => {
        el.remove();
    });

    // Remove any existing placeholders
    document.querySelectorAll('.quest-drop-placeholder').forEach(el => {
        el.remove();
    });

    // Remove dragging class from any cards
    document.querySelectorAll('.quest-card.dragging').forEach(el => {
        el.classList.remove('dragging');
    });

    // Remove drop-animating class and clean inline styles
    document.querySelectorAll('.quest-card.drop-animating').forEach(el => {
        el.classList.remove('drop-animating');
        el.style.opacity = '';
        el.style.transform = '';
        el.style.transition = '';
    });

    // Clear drag-over highlights
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });

    // Reset state
    isDragging = false;
    ghostElement = null;
    draggedCard = null;
    draggedItemId = null;
    dragSourceCategory = null;
    placeholder = null;
    currentDropTarget = null;
    dropPosition = null;
}
