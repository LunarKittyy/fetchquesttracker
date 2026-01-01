/**
 * Input Parser Module
 * Parse quantity and category from item name strings
 */

// Quantity patterns: "Item x5", "Item × 5", "Item (5)"
const QTY_PATTERNS = [
    /\s*[x×]\s*(\d+)\s*$/i,
    /\s*\((\d+)\)\s*$/,
];

// Category pattern (bulk mode only): "Item | Category"
const CATEGORY_PATTERN = /\s*\|\s*(.+?)\s*$/;

/**
 * Parse a single item input string
 * @param {string} input - Raw input string
 * @param {boolean} supportCategory - Whether to parse category (bulk mode)
 * @returns {{ name: string, quantity: number|null, category: string|null }}
 */
export function parseItemInput(input, supportCategory = false) {
    let name = input.trim();
    let quantity = null;
    let category = null;

    if (!name) return { name: '', quantity: null, category: null };

    // Extract category first (bulk mode only)
    if (supportCategory) {
        const catMatch = name.match(CATEGORY_PATTERN);
        if (catMatch) {
            category = catMatch[1].trim();
            name = name.replace(CATEGORY_PATTERN, '').trim();
        }
    }

    // Extract quantity from end of string
    for (const pattern of QTY_PATTERNS) {
        const match = name.match(pattern);
        if (match) {
            const parsed = parseInt(match[1], 10);
            if (parsed > 0 && parsed <= 9999) {
                quantity = parsed;
                name = name.replace(pattern, '').trim();
            }
            break;
        }
    }

    return { name, quantity, category };
}

/**
 * Parse multi-line input for bulk import
 * @param {string} text - Multi-line text
 * @returns {Array<{ name: string, quantity: number|null, category: string|null }>}
 */
export function parseMultiLineInput(text) {
    return text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => parseItemInput(line, true));
}

/**
 * Format parsed item for preview display
 * @param {{ name: string, quantity: number|null, category: string|null }} item
 * @param {number} defaultQty - Default quantity if none specified
 * @returns {string}
 */
export function formatParsedItem(item, defaultQty = 4) {
    const qty = item.quantity ?? defaultQty;
    const cat = item.category ? ` [${item.category}]` : '';
    return `${item.name} ×${qty}${cat}`;
}
