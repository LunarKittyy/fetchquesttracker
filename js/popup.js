/**
 * Custom Popup System Module
 * Replaces browser confirm/alert/prompt dialogs
 */

import { $ } from './utils.js';

// DOM Elements (will be set on init)
let elements = {
    modalPopup: null,
    popupTitle: null,
    popupMessage: null,
    popupInput: null,
    popupFooter: null
};

let popupResolve = null;

/**
 * Initialize popup elements
 * Call this once DOM is ready
 */
export function initPopup() {
    elements = {
        modalPopup: $('#modal-popup'),
        popupTitle: $('#popup-title'),
        popupMessage: $('#popup-message'),
        popupInput: $('#popup-input'),
        popupFooter: $('#popup-footer')
    };
}

/**
 * Show a custom popup dialog
 * @param {Object} options - Popup configuration
 * @param {string} [options.type='alert'] - Type: 'alert', 'confirm', or 'prompt'
 * @param {string} [options.title='ALERT'] - Popup title
 * @param {string} [options.message=''] - Message to display
 * @param {boolean} [options.input=false] - Show input field
 * @param {string} [options.inputDefault=''] - Default input value
 * @param {string} [options.confirmText='OK'] - Confirm button text
 * @param {string} [options.cancelText='CANCEL'] - Cancel button text
 * @param {boolean} [options.danger=false] - Use danger styling
 * @returns {Promise} Resolves with user's response
 */
export function showPopup({
    type = 'alert',
    title = 'ALERT',
    message = '',
    input = false,
    inputDefault = '',
    confirmText = 'OK',
    cancelText = 'CANCEL',
    danger = false
}) {
    return new Promise((resolve) => {
        popupResolve = resolve;

        elements.popupTitle.textContent = title;
        elements.popupMessage.textContent = message;

        // Handle input field
        if (input) {
            elements.popupInput.classList.remove('hidden');
            elements.popupInput.value = inputDefault;
        } else {
            elements.popupInput.classList.add('hidden');
        }

        // Build footer buttons
        let footerHtml = '';
        if (type === 'confirm' || type === 'prompt') {
            footerHtml += `<button type="button" class="btn btn-secondary popup-cancel">${cancelText}</button>`;
        }
        footerHtml += `<button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'} popup-confirm">${confirmText}</button>`;
        elements.popupFooter.innerHTML = footerHtml;

        // Event handlers
        const confirmBtn = elements.popupFooter.querySelector('.popup-confirm');
        const cancelBtn = elements.popupFooter.querySelector('.popup-cancel');

        const handleConfirm = () => {
            closePopup();
            if (type === 'prompt') {
                resolve(elements.popupInput.value);
            } else if (type === 'confirm') {
                resolve(true);
            } else {
                resolve();
            }
        };

        const handleCancel = () => {
            closePopup();
            if (type === 'prompt') {
                resolve(null);
            } else {
                resolve(false);
            }
        };

        confirmBtn.addEventListener('click', handleConfirm);
        if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);

        // Handle backdrop click and Escape key
        const backdrop = elements.modalPopup.querySelector('.modal-backdrop');
        const handleBackdropClick = (e) => {
            if (e.target === backdrop) handleCancel();
        };
        const handleKeydown = (e) => {
            if (e.key === 'Escape') handleCancel();
            if (e.key === 'Enter' && type !== 'prompt') handleConfirm();
            if (e.key === 'Enter' && type === 'prompt' && document.activeElement === elements.popupInput) handleConfirm();
        };

        backdrop.addEventListener('click', handleBackdropClick);
        document.addEventListener('keydown', handleKeydown);

        // Store cleanup function
        elements.modalPopup._cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
            backdrop.removeEventListener('click', handleBackdropClick);
            document.removeEventListener('keydown', handleKeydown);
        };

        // Show modal
        elements.modalPopup.classList.remove('hidden');
        if (input) {
            elements.popupInput.focus();
            elements.popupInput.select();
        } else {
            confirmBtn.focus();
        }
    });
}

/**
 * Close the popup and clean up event listeners
 */
export function closePopup() {
    if (elements.modalPopup._cleanup) {
        elements.modalPopup._cleanup();
    }
    elements.modalPopup.classList.add('hidden');
}

/**
 * Show a confirmation dialog
 * @param {string} message - Message to display
 * @param {string} [title='CONFIRM'] - Dialog title
 * @param {boolean} [danger=false] - Use danger styling
 * @returns {Promise<boolean>} True if confirmed, false otherwise
 */
export function showConfirm(message, title = 'CONFIRM', danger = false) {
    return showPopup({ type: 'confirm', title, message, danger, confirmText: 'YES', cancelText: 'NO' });
}

/**
 * Show an alert dialog
 * @param {string} message - Message to display
 * @param {string} [title='ALERT'] - Dialog title
 * @returns {Promise<void>}
 */
export function showAlert(message, title = 'ALERT') {
    return showPopup({ type: 'alert', title, message });
}

/**
 * Show a prompt dialog
 * @param {string} message - Message to display
 * @param {string} [title='INPUT'] - Dialog title
 * @param {string} [defaultValue=''] - Default input value
 * @returns {Promise<string|null>} User input or null if cancelled
 */
export function showPrompt(message, title = 'INPUT', defaultValue = '') {
    return showPopup({ type: 'prompt', title, message, input: true, inputDefault: defaultValue, confirmText: 'OK', cancelText: 'CANCEL' });
}
/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {number} [duration=3000] - Duration in ms
 */
export function showToast(message, duration = 3000) {
    let toast = document.getElementById('toast-notification');

    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: rgba(30, 30, 30, 0.9);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            border: 1px solid var(--clr-accent-primary, #4ecdb4);
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            z-index: 10000;
            font-family: var(--font-action, sans-serif);
            font-size: 14px;
            pointer-events: none;
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
            opacity: 0;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        document.body.appendChild(toast);
    }

    // Reset state
    toast.style.transition = 'none';
    toast.style.transform = 'translateX(-50%) translateY(100px)';
    toast.style.opacity = '0';

    // Set content (add spinner)
    toast.innerHTML = `
        <div class="spinner-small" style="width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: var(--clr-accent-primary, #4ecdb4); border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <span>${message}</span>
    `;

    // Needed for animation restart
    void toast.offsetWidth;

    // Animate in
    requestAnimationFrame(() => {
        toast.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        toast.style.opacity = '1';
    });

    // Global spin keyframe if not exists
    if (!document.getElementById('toast-style')) {
        const style = document.createElement('style');
        style.id = 'toast-style';
        style.textContent = `
            @keyframes spin { to { transform: rotate(360deg); } }
        `;
        document.head.appendChild(style);
    }

    // Auto hide
    if (duration > 0) {
        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(100px)';
            toast.style.opacity = '0';
        }, duration);
    }
}
