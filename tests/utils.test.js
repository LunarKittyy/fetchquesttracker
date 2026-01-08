/**
 * Unit Tests for js/utils.js
 * Run with: node --test tests/utils.test.js
 * Requires Node.js 20+ for native test runner
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import functions to test
import {
    generateId,
    escapeHtml,
    isItemComplete,
    getItemProgress,
    sortItems,
    groupItemsByCategory,
    getCategoryProgress,
    validateColor,
    validatePriority,
    normalizeItem
} from '../js/utils.js';

describe('generateId', () => {
    it('should return a unique string starting with q_', () => {
        const id1 = generateId();
        const id2 = generateId();
        assert.ok(id1.startsWith('q_'), 'ID should start with q_');
        assert.notEqual(id1, id2, 'IDs should be unique');
    });
});

describe('escapeHtml', { skip: 'Requires browser DOM (document.createElement)' }, () => {
    it('should escape HTML special characters', () => {
        assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
        assert.equal(escapeHtml('"test" & \'value\''), '"test" &amp; \'value\'');
    });

    it('should return empty string for empty input', () => {
        assert.equal(escapeHtml(''), '');
    });
});

describe('validateColor', () => {
    it('should return valid colors', () => {
        assert.equal(validateColor('#4ecdb4'), '#4ecdb4');
        assert.equal(validateColor('#E8B84A'), '#e8b84a'); // case insensitive
    });

    it('should return null for invalid colors', () => {
        assert.equal(validateColor('#123456'), null);
        assert.equal(validateColor('red'), null);
        assert.equal(validateColor(null), null);
    });
});

describe('validatePriority', () => {
    it('should return valid priorities', () => {
        assert.equal(validatePriority('high'), 'high');
        assert.equal(validatePriority('HIGH'), 'high'); // case insensitive
        assert.equal(validatePriority('medium'), 'medium');
        assert.equal(validatePriority('low'), 'low');
    });

    it('should return null for invalid priorities', () => {
        assert.equal(validatePriority('urgent'), null);
        assert.equal(validatePriority(null), null);
    });
});

describe('isItemComplete', () => {
    it('should return true for item with current >= target', () => {
        const item = { type: 'item', current: 5, target: 5 };
        assert.equal(isItemComplete(item), true);
    });

    it('should return false for incomplete item', () => {
        const item = { type: 'item', current: 3, target: 5 };
        assert.equal(isItemComplete(item), false);
    });

    it('should check all objectives for quest type', () => {
        const completeQuest = {
            type: 'quest',
            objectives: [
                { current: 2, target: 2 },
                { current: 3, target: 3 }
            ]
        };
        assert.equal(isItemComplete(completeQuest), true);

        const incompleteQuest = {
            type: 'quest',
            objectives: [
                { current: 2, target: 2 },
                { current: 1, target: 3 }
            ]
        };
        assert.equal(isItemComplete(incompleteQuest), false);
    });
});

describe('getItemProgress', () => {
    it('should return current/total for item type', () => {
        const item = { type: 'item', current: 3, target: 10 };
        const progress = getItemProgress(item);
        assert.deepEqual(progress, { current: 3, total: 10 });
    });

    it('should sum objectives for quest type', () => {
        const quest = {
            type: 'quest',
            objectives: [
                { current: 2, target: 5 },
                { current: 3, target: 5 }
            ]
        };
        const progress = getItemProgress(quest);
        assert.deepEqual(progress, { current: 5, total: 10 });
    });
});

describe('sortItems', () => {
    it('should sort by priority (high > medium > low)', () => {
        const items = [
            { id: '1', priority: 'low', current: 0, target: 1 },
            { id: '2', priority: 'high', current: 0, target: 1 },
            { id: '3', priority: 'medium', current: 0, target: 1 }
        ];
        sortItems(items);
        assert.equal(items[0].priority, 'high');
        assert.equal(items[1].priority, 'medium');
        assert.equal(items[2].priority, 'low');
    });

    it('should move complete items to bottom', () => {
        const items = [
            { id: '1', current: 5, target: 5 }, // complete
            { id: '2', current: 0, target: 5 }  // incomplete
        ];
        sortItems(items);
        assert.equal(items[0].id, '2'); // incomplete first
        assert.equal(items[1].id, '1'); // complete last
    });
});

describe('groupItemsByCategory', () => {
    it('should group items by category', () => {
        const items = [
            { id: '1', category: 'Food' },
            { id: '2', category: 'Weapons' },
            { id: '3', category: 'Food' }
        ];
        const grouped = groupItemsByCategory(items);
        assert.equal(grouped.Food.length, 2);
        assert.equal(grouped.Weapons.length, 1);
    });

    it('should default to Misc for missing category', () => {
        const items = [{ id: '1' }];
        const grouped = groupItemsByCategory(items);
        assert.ok('Misc' in grouped);
    });
});

describe('getCategoryProgress', () => {
    it('should calculate combined progress of items', () => {
        const items = [
            { current: 3, target: 5 },
            { current: 2, target: 5 }
        ];
        const progress = getCategoryProgress(items);
        assert.equal(progress.current, 5);
        assert.equal(progress.total, 10);
        assert.equal(progress.percent, 50);
    });
});

describe('normalizeItem', () => {
    it('should fill in missing properties with defaults', () => {
        const partial = { name: 'Test' };
        const normalized = normalizeItem(partial);
        assert.equal(normalized.name, 'Test');
        assert.equal(normalized.type, 'item');
        assert.equal(normalized.category, 'Misc');
        assert.equal(normalized.current, 0);
        assert.equal(normalized.target, 1);
        assert.ok(normalized.id.startsWith('q_'));
    });

    it('should sanitize color and priority', () => {
        const item = { name: 'Test', color: 'invalid', priority: 'super' };
        const normalized = normalizeItem(item);
        assert.equal(normalized.color, null);
        assert.equal(normalized.priority, null);
    });
});
