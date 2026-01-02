/**
 * Bulk Entry Module
 * Handle bulk text import and OCR for adding multiple items at once
 */

import { parseMultiLineInput, formatParsedItem } from './input-parser.js';
import { state } from './state.js';
import { addItem } from './quests.js';
import { saveState } from './storage.js';
import { $ } from './utils.js';

// DOM elements
let elements = {
    modal: null,
    btnOpen: null,
    textarea: null,
    preview: null,
    previewList: null,
    previewCount: null,
    btnImport: null,
    ocrUpload: null,
    ocrStatus: null,
    typeToggle: null,
    typeBtns: null
};

// Parsed items cache
let parsedItems = [];

// Current import mode: 'item' or 'quest'
let bulkImportMode = 'item';

// Tesseract worker reference (lazy loaded)
let tesseractWorker = null;

/**
 * Initialize bulk entry module
 */
export function initBulkEntry(callbacks = {}) {
    elements = {
        modal: $('#modal-bulk-entry'),
        btnOpen: $('#btn-bulk-add'),
        textarea: $('#bulk-text'),
        preview: $('#bulk-preview'),
        previewList: $('#bulk-preview-list'),
        previewCount: $('#bulk-preview-count'),
        btnImport: $('#btn-bulk-import'),
        ocrUpload: $('#ocr-upload'),
        ocrStatus: $('#ocr-status'),
        typeToggle: $('#bulk-type-toggle'),
        typeBtns: document.querySelectorAll('#bulk-type-toggle .type-btn')
    };

    // Store callbacks
    initBulkEntry.callbacks = callbacks;

    // Event listeners
    elements.btnOpen?.addEventListener('click', openBulkModal);
    elements.btnImport?.addEventListener('click', handleImport);
    elements.ocrUpload?.addEventListener('change', handleOcrUpload);

    // Type toggle (ITEM vs QUEST)
    elements.typeBtns?.forEach(btn => {
        btn.addEventListener('click', () => {
            bulkImportMode = btn.dataset.type;
            elements.typeBtns.forEach(b => b.classList.toggle('active', b.dataset.type === bulkImportMode));
            handlePreview(); // Re-parse with new mode
        });
    });

    // Real-time preview as user types (debounced)
    let previewTimeout;
    elements.textarea?.addEventListener('input', () => {
        clearTimeout(previewTimeout);
        previewTimeout = setTimeout(() => {
            handlePreview();
        }, 200);
    });

    // Ctrl+left-click drag to select and delete on release
    let ctrlSelecting = false;

    elements.textarea?.addEventListener('mousedown', (e) => {
        if (e.button === 0 && e.ctrlKey) { // Ctrl + left click
            ctrlSelecting = true;
        }
    });

    elements.textarea?.addEventListener('mouseup', (e) => {
        if (e.button === 0 && ctrlSelecting) {
            ctrlSelecting = false;
            // Delete the selected text
            const start = elements.textarea.selectionStart;
            const end = elements.textarea.selectionEnd;
            if (start !== end) {
                const value = elements.textarea.value;
                elements.textarea.value = value.substring(0, start) + value.substring(end);
                elements.textarea.setSelectionRange(start, start);
                handlePreview();
            }
        }
    });

    // Shift key to toggle case of selected text
    elements.textarea?.addEventListener('keydown', (e) => {
        if (e.key === 'Shift' && !e.repeat) {
            const start = elements.textarea.selectionStart;
            const end = elements.textarea.selectionEnd;
            if (start !== end) {
                e.preventDefault();
                const value = elements.textarea.value;
                const selected = value.substring(start, end);
                // Toggle case: if mostly uppercase -> lowercase, else -> uppercase
                const upperCount = (selected.match(/[A-Z]/g) || []).length;
                const lowerCount = (selected.match(/[a-z]/g) || []).length;
                const toggled = upperCount > lowerCount
                    ? selected.toLowerCase()
                    : selected.toUpperCase();
                elements.textarea.value = value.substring(0, start) + toggled + value.substring(end);
                elements.textarea.setSelectionRange(start, end);
                handlePreview();
            }
        }
    });

    // Disable context menu for entire bulk modal
    elements.modal?.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Paste support for screenshots (snipping tool, etc.)
    elements.modal?.addEventListener('paste', handlePaste);

    // Event delegation for preview remove buttons (X)
    elements.previewList?.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.bulk-preview-remove');
        if (!removeBtn) return;
        e.stopPropagation();
        const index = parseInt(removeBtn.dataset.index);
        if (!isNaN(index)) {
            // Remove from parsed items
            parsedItems.splice(index, 1);
            // Sync back to textarea
            const lines = elements.textarea.value.split('\n').filter(l => l.trim().length > 0);
            lines.splice(index, 1);
            elements.textarea.value = lines.join('\n');
            renderPreview();
        }
    });

    // Modal close handlers
    elements.modal?.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop') ||
            e.target.closest('.modal-close') ||
            e.target.closest('.modal-cancel')) {
            closeBulkModal();
        }
    });
}

/**
 * Open bulk entry modal
 */
export function openBulkModal() {
    elements.modal?.classList.remove('hidden');
    elements.textarea?.focus();
}

/**
 * Close bulk entry modal
 */
export function closeBulkModal() {
    elements.modal?.classList.add('hidden');
    elements.textarea.value = '';
    elements.preview?.classList.add('hidden');
    parsedItems = [];
    // Keep last selected mode (don't reset to item)
}

/**
 * Handle preview button - parse text and render preview
 */
function handlePreview() {
    const text = elements.textarea?.value || '';
    parsedItems = parseMultiLineInput(text);
    renderPreview();
}

/**
 * Render the preview list from current parsedItems array
 * Separate from parsing so X button deletions are preserved
 */
function renderPreview() {
    if (parsedItems.length === 0) {
        elements.preview?.classList.add('hidden');
        return;
    }

    // Build preview HTML based on mode
    let html;
    if (bulkImportMode === 'quest' && parsedItems.length > 0) {
        // Quest mode: first item is title, rest are objectives
        const questName = parsedItems[0]?.name || 'Unnamed Quest';
        const objectives = parsedItems.slice(1);
        html = `
            <div class="bulk-preview-quest">
                <div class="bulk-preview-quest-title">
                    <span class="bulk-preview-label">QUEST:</span>
                    <span class="bulk-preview-name">${escapeHtml(questName)}</span>
                    <button type="button" class="bulk-preview-remove" data-index="0">×</button>
                </div>
                <div class="bulk-preview-objectives">
                    <span class="bulk-preview-label">OBJECTIVES:</span>
                    ${objectives.map((obj, i) => `
                        <div class="bulk-preview-item" data-index="${i + 1}">
                            <span class="bulk-preview-name">${escapeHtml(obj.name)}</span>
                            <span class="bulk-preview-meta">×${obj.quantity ?? 1}</span>
                            <button type="button" class="bulk-preview-remove" data-index="${i + 1}">×</button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        elements.previewCount.textContent = `1 quest, ${objectives.length} objective${objectives.length !== 1 ? 's' : ''}`;
    } else {
        // Item mode
        html = parsedItems.map((item, i) => {
            const cat = item.category || 'Misc';
            const qty = item.quantity ?? 1;
            return `
                <div class="bulk-preview-item" data-index="${i}">
                    <span class="bulk-preview-name">${escapeHtml(item.name)}</span>
                    <span class="bulk-preview-meta">×${qty} | ${escapeHtml(cat)}</span>
                    <button type="button" class="bulk-preview-remove" data-index="${i}">×</button>
                </div>
            `;
        }).join('');
        elements.previewCount.textContent = `${parsedItems.length} item${parsedItems.length !== 1 ? 's' : ''}`;
    }

    elements.previewList.innerHTML = html;
    elements.preview?.classList.remove('hidden');
}

/**
 * Handle import button - add all items
 */
function handleImport() {
    if (parsedItems.length === 0) {
        const text = elements.textarea?.value || '';
        parsedItems = parseMultiLineInput(text);
    }

    if (parsedItems.length === 0) return;

    if (bulkImportMode === 'quest') {
        // Quest mode: first line is quest name, rest are objectives
        const questName = parsedItems[0]?.name || 'Unnamed Quest';
        const objectives = parsedItems.slice(1).map(item => ({
            id: generateId(),
            name: item.name,
            current: 0,
            target: item.quantity ?? 1
        }));

        addItem({
            type: 'quest',
            name: questName,
            category: 'Misc',
            target: 1,
            color: null,
            priority: null,
            objectives: objectives,
            tags: []
        });
    } else {
        // Item mode: add each as separate item
        parsedItems.forEach(item => {
            const category = item.category || 'Misc';
            if (category && !state.categories.includes(category)) {
                state.categories.push(category);
            }

            addItem({
                type: 'item',
                name: item.name || 'Unnamed Item',
                category: category,
                target: item.quantity ?? 1,
                color: null,
                priority: null,
                objectives: [],
                tags: []
            });
        });
    }

    saveState();
    closeBulkModal();

    if (initBulkEntry.callbacks?.render) {
        initBulkEntry.callbacks.render();
    }
}

// Generate unique ID for objectives
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Handle OCR upload - extract text from screenshot
 */
async function handleOcrUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processOcrImage(file);
    // Reset file input
    e.target.value = '';
}

/**
 * Handle paste event - support pasting screenshots from clipboard (snipping tool)
 */
async function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;

    // Look for image in clipboard
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            e.preventDefault();
            const blob = item.getAsFile();
            if (blob) {
                await processOcrImage(blob);
            }
            return;
        }
    }
}

/**
 * Process an image blob through OCR
 */
async function processOcrImage(imageBlob) {
    elements.ocrStatus?.classList.remove('hidden');
    elements.ocrStatus.textContent = 'Loading OCR engine...';

    try {
        // Lazy load Tesseract.js from CDN
        if (!tesseractWorker) {
            const TesseractModule = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');
            const Tesseract = TesseractModule.default;
            tesseractWorker = await Tesseract.createWorker('eng');
        }

        elements.ocrStatus.textContent = 'Scanning image...';

        const result = await tesseractWorker.recognize(imageBlob);
        const rawText = result.data.text;

        // Clean up OCR text
        const cleanedLines = cleanOcrText(rawText);

        // Append to textarea
        const currentText = elements.textarea?.value || '';
        const newText = currentText
            ? currentText + '\n' + cleanedLines.join('\n')
            : cleanedLines.join('\n');

        elements.textarea.value = newText;
        elements.ocrStatus?.classList.add('hidden');

        // Auto-preview
        handlePreview();

    } catch (error) {
        console.error('OCR failed:', error);
        elements.ocrStatus.textContent = 'OCR failed. Try a clearer image.';
        setTimeout(() => {
            elements.ocrStatus?.classList.add('hidden');
        }, 3000);
    }
}

/**
 * Clean up OCR text - remove UI noise and filter to basic characters only
 */
function cleanOcrText(rawText) {
    return rawText
        .split('\n')
        .map(line => {
            // Replace pipe with I (common OCR confusion)
            line = line.replace(/\|/g, 'I');
            // Keep only letters, numbers, spaces, and basic punctuation
            return line.replace(/[^a-zA-Z0-9\s.,;:?!'"()\/\-]/g, '').trim();
        })
        .filter(line => {
            if (line.length < 3) return false;
            // Filter out common UI buttons
            if (/^(CLAIM|REWARDS|BACK|MENU|CANCEL|OK|CLOSE)$/i.test(line)) return false;
            // Filter lines that are just numbers/currency
            if (/^[\d,.\s]+$/.test(line)) return false;
            // Filter very short nonsense
            if (line.length < 3) return false;
            return true;
        })
        .map(line => {
            // Strip leading special chars (UI garbage)
            line = line.replace(/^[^a-zA-Z]+/, '').trim();

            // Detect N/M progress pattern (e.g., "CANDLE HOLDER 0/3" -> "CANDLE HOLDER x3")
            const progressMatch = line.match(/^(.+?)\s+(\d+)\s*\/\s*(\d+)$/);
            if (progressMatch) {
                const [, name, current, target] = progressMatch;
                return `${name.trim()} x${target}`;
            }

            // Clean title patterns like "DECORATIONS (2/5)" -> "DECORATIONS"
            line = line.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();

            return line;
        })
        .filter(line => line.length > 1);
}

/**
 * Escape HTML entities
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

