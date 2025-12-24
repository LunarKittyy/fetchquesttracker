/**
 * Utility Functions Module
 * Pure utility functions with no side effects
 */

// --- DOM Selectors ---
export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

// --- Valid field values for security validation ---
const VALID_COLORS = [
    '',           // none
    '#e8b84a',    // amber
    '#4ecdb4',    // teal
    '#d45454',    // red
    '#5cb572',    // green
    '#6366f1',    // indigo
    '#a855f7',    // purple
    '#ec4899',    // pink
    '#f97316'     // orange
];

const VALID_PRIORITIES = ['', 'low', 'medium', 'high'];

/**
 * Validate and sanitize color value
 * @param {string} color - Color value to validate
 * @returns {string|null} Valid color or null
 */
export function validateColor(color) {
    if (!color || typeof color !== 'string') return null;
    const normalized = color.toLowerCase().trim();
    return VALID_COLORS.includes(normalized) ? normalized : null;
}

/**
 * Validate and sanitize priority value
 * @param {string} priority - Priority value to validate
 * @returns {string|null} Valid priority or null
 */
export function validatePriority(priority) {
    if (!priority || typeof priority !== 'string') return null;
    const normalized = priority.toLowerCase().trim();
    return VALID_PRIORITIES.includes(normalized) ? normalized : null;
}

/**
 * Generate a unique ID
 * @returns {string} Unique identifier
 */
export function generateId() {
    return 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
}

/**
 * Escape HTML entities to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Get relative time string from timestamp
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Human-readable time ago string
 */
export function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

/**
 * Check if an item is complete
 * @param {Object} item - The item to check
 * @returns {boolean} True if item is complete
 */
export function isItemComplete(item) {
    if (item.type === 'quest' && item.objectives.length > 0) {
        return item.objectives.every(obj => obj.current >= obj.target);
    }
    return item.current >= item.target;
}

/**
 * Get progress values for an item
 * @param {Object} item - The item to get progress for
 * @returns {{current: number, total: number}} Progress object
 */
export function getItemProgress(item) {
    if (item.type === 'quest' && item.objectives.length > 0) {
        const total = item.objectives.reduce((sum, obj) => sum + obj.target, 0);
        const current = item.objectives.reduce((sum, obj) => sum + Math.min(obj.current, obj.target), 0);
        return { current, total };
    }
    return { current: item.current, total: item.target };
}

/**
 * Sort items by completion status, priority, then creation time
 * @param {Array} items - Array of items to sort
 * @returns {Array} Sorted items array (mutates original)
 */
export function sortItems(items) {
    // Priority order: high=0, medium=1, none=2, low=3
    const priorityOrder = { high: 0, medium: 1, low: 2, '': 3, null: 3 };

    items.sort((a, b) => {
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

    return items;
}

/**
 * Get unique categories from items and state categories
 * @param {Object} state - State object with categories and items
 * @returns {Array<string>} Sorted array of unique categories
 */
export function getUniqueCategories(state) {
    const fromItems = state.items.map(i => i.category || 'Misc');
    const all = [...new Set([...state.categories, ...fromItems])];
    return all.sort();
}

/**
 * Group items by category
 * @param {Array} items - Items to group
 * @returns {Object} Object with category names as keys and item arrays as values
 */
export function groupItemsByCategory(items) {
    const categories = [...new Set(items.map(i => i.category || 'Misc'))];
    const grouped = {};
    categories.forEach(cat => {
        const catItems = items.filter(i => (i.category || 'Misc') === cat);
        if (catItems.length > 0) {
            grouped[cat] = catItems;
        }
    });
    return grouped;
}

/**
 * Get progress for a category
 * @param {Array} categoryItems - Items in the category
 * @returns {{current: number, total: number, percent: number}} Progress object
 */
export function getCategoryProgress(categoryItems) {
    let current = 0;
    let total = 0;
    categoryItems.forEach(item => {
        const prog = getItemProgress(item);
        current += prog.current;
        total += prog.total;
    });
    return { current, total, percent: total > 0 ? (current / total) * 100 : 0 };
}

/**
 * Normalize an item to ensure all required properties exist
 * @param {Object} item - The item to normalize
 * @param {Function} [idGenerator=generateId] - Function to generate IDs
 * @returns {Object} Normalized item
 */
export function normalizeItem(item, idGenerator = generateId) {
    return {
        id: item.id || idGenerator(),
        type: item.type || 'item',
        name: item.name || 'Unknown',
        imageUrl: item.imageUrl || null,
        category: item.category || 'Misc',
        current: item.current || 0,
        target: item.target || 1,
        objectives: (item.objectives || []).map(obj => ({
            id: obj.id || idGenerator(),
            name: obj.name || 'Objective',
            imageUrl: obj.imageUrl || null,
            current: obj.current || 0,
            target: obj.target || 1,
            complete: obj.complete || false
        })),
        createdAt: item.createdAt || Date.now(),
        completedAt: item.completedAt || null,
        color: validateColor(item.color),
        priority: validatePriority(item.priority),
        notes: item.notes || ''
    };
}

/**
 * Debounce a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Find an item by ID across all spaces
 * @param {Object} state - State object with spaces array
 * @param {string} itemId - The item ID to find
 * @returns {{item: Object|null, space: Object|null}} Item and its containing space, or nulls if not found
 */
export function findItemAcrossSpaces(state, itemId) {
    for (const space of state.spaces) {
        const item = space.items.find(i => i.id === itemId);
        if (item) {
            return { item, space };
        }
    }
    return { item: null, space: null };
}
