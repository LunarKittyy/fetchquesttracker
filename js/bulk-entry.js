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
    ocrStatus: null
};

// Parsed items cache
let parsedItems = [];

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
        ocrStatus: $('#ocr-status')
    };

    // Store callbacks
    initBulkEntry.callbacks = callbacks;

    // Event listeners
    elements.btnOpen?.addEventListener('click', openBulkModal);
    elements.btnImport?.addEventListener('click', handleImport);
    elements.ocrUpload?.addEventListener('change', handleOcrUpload);

    // Real-time preview as user types (debounced)
    let previewTimeout;
    elements.textarea?.addEventListener('input', () => {
        clearTimeout(previewTimeout);
        previewTimeout = setTimeout(() => {
            handlePreview();
        }, 200);
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
            parsedItems.splice(index, 1);
            renderPreview(); // Re-render without re-parsing
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

    // Build preview HTML
    const html = parsedItems.map((item, i) => {
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

    elements.previewList.innerHTML = html;
    elements.previewCount.textContent = `${parsedItems.length} item${parsedItems.length !== 1 ? 's' : ''}`;
    elements.preview?.classList.remove('hidden');
}

/**
 * Handle import button - add all items
 */
function handleImport() {
    if (parsedItems.length === 0) {
        // Parse first if not previewed
        const text = elements.textarea?.value || '';
        parsedItems = parseMultiLineInput(text);
    }

    if (parsedItems.length === 0) return;

    // Add each item
    parsedItems.forEach(item => {
        // Check if category exists, add if not
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

    saveState();
    closeBulkModal();

    // Callback to re-render
    if (initBulkEntry.callbacks?.render) {
        initBulkEntry.callbacks.render();
    }
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
            // Keep only letters, numbers, spaces, and basic punctuation
            return line.replace(/[^a-zA-Z0-9\s.,;:?!'"()-]/g, '').trim();
        })
        .filter(line => {
            // Filter out empty/short lines
            if (line.length < 2) return false;
            // Filter out common UI elements
            if (/^(CLAIM|REWARDS|BACK|MENU|CANCEL|OK|CLOSE)$/i.test(line)) return false;
            return true;
        })
        .map(line => {
            // Remove checkbox-like prefixes that might have survived
            return line
                .replace(/^\[\s*[x\s]?\s*\]\s*/i, '')
                .trim();
        })
        .filter(line => line.length > 0);
}

/**
 * Escape HTML entities
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
