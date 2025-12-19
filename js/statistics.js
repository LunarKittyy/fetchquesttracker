/**
 * Statistics Dashboard Module
 * Calculates and displays progress statistics
 */

import { state } from './state.js';
import { $, escapeHtml, isItemComplete } from './utils.js';

// DOM elements
let elements = {
    modalStatistics: null,
    modalSettings: null,
    statTotal: null,
    statCompleted: null,
    statActive: null,
    statRate: null,
    statsCategories: null,
    statsSpaces: null
};

/**
 * Initialize statistics module
 */
export function initStatistics(domElements) {
    elements = { ...elements, ...domElements };
}

/**
 * Open statistics modal
 */
export function openStatistics() {
    if (!elements.modalStatistics) return;

    // Close all other modals first
    document.querySelectorAll('.modal:not(.hidden)').forEach(modal => {
        modal.classList.add('hidden');
    });

    // Calculate and render statistics
    renderStatistics();
    elements.modalStatistics.classList.remove('hidden');
}

/**
 * Calculate statistics across all spaces
 * @returns {Object} Statistics data
 */
export function calculateStatistics() {
    const stats = {
        total: 0,
        completed: 0,
        active: 0,
        byCategory: {},
        bySpace: []
    };

    // Calculate across all spaces
    state.spaces.forEach(space => {
        const items = space.items || [];
        const archived = space.archivedItems || [];
        const allItems = [...items, ...archived];

        const spaceTotal = allItems.length;
        const spaceCompleted = archived.length + items.filter(i => isItemComplete(i)).length;

        stats.total += spaceTotal;
        stats.completed += spaceCompleted;

        // Space stats
        stats.bySpace.push({
            name: space.name,
            color: space.color,
            total: spaceTotal,
            completed: spaceCompleted,
            percent: spaceTotal > 0 ? (spaceCompleted / spaceTotal) * 100 : 0
        });

        // Category stats (from active space items only)
        if (space.id === state.activeSpaceId) {
            allItems.forEach(item => {
                const cat = item.category || 'Misc';
                if (!stats.byCategory[cat]) {
                    stats.byCategory[cat] = { total: 0, completed: 0 };
                }
                stats.byCategory[cat].total++;
                if (archived.includes(item) || isItemComplete(item)) {
                    stats.byCategory[cat].completed++;
                }
            });
        }
    });

    stats.active = stats.total - stats.completed;
    stats.rate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

    return stats;
}

/**
 * Render statistics in the modal
 */
export function renderStatistics() {
    const stats = calculateStatistics();

    // Update overview cards
    if (elements.statTotal) elements.statTotal.textContent = stats.total;
    if (elements.statCompleted) elements.statCompleted.textContent = stats.completed;
    if (elements.statActive) elements.statActive.textContent = stats.active;
    if (elements.statRate) elements.statRate.textContent = stats.rate + '%';

    // Render category breakdown
    if (elements.statsCategories) {
        const categories = Object.entries(stats.byCategory);
        if (categories.length === 0) {
            elements.statsCategories.innerHTML = '<div class="stats-empty">No items in current space</div>';
        } else {
            elements.statsCategories.innerHTML = categories.map(([name, data]) => {
                const percent = data.total > 0 ? (data.completed / data.total) * 100 : 0;
                return `
                    <div class="stats-bar-item">
                        <div class="stats-bar-header">
                            <span class="stats-bar-name">${escapeHtml(name)}</span>
                            <span class="stats-bar-value">${data.completed}/${data.total}</span>
                        </div>
                        <div class="stats-bar-track">
                            <div class="stats-bar-fill" style="width: ${percent}%"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Render space breakdown
    if (elements.statsSpaces) {
        if (stats.bySpace.length === 0) {
            elements.statsSpaces.innerHTML = '<div class="stats-empty">No spaces</div>';
        } else {
            elements.statsSpaces.innerHTML = stats.bySpace.map(space => `
                <div class="stats-bar-item">
                    <div class="stats-bar-header">
                        <span class="stats-bar-name">${escapeHtml(space.name)}</span>
                        <span class="stats-bar-value">${space.completed}/${space.total}</span>
                    </div>
                    <div class="stats-bar-track">
                        <div class="stats-bar-fill primary" style="width: ${space.percent}%"></div>
                    </div>
                </div>
            `).join('');
        }
    }
}
