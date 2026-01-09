/**
 * Modal Handling Module
 * Centralizes logic for opening/closing and managing application modals.
 */

import { elements } from './elements.js';

/**
 * Handle closing modals via backdrop or close button
 * @param {Event} e - Click event
 */
export function handleCloseModal(e) {
    if (e.target.classList.contains('modal-backdrop') || e.target.closest('.modal-close') || e.target.closest('.modal-cancel')) {
        e.target.closest('.modal')?.classList.add('hidden');
    }
}

/**
 * Close all currently open modals
 */
export function closeAllModals() {
    document.querySelectorAll('.modal:not(.hidden)').forEach(modal => {
        modal.classList.add('hidden');
    });
}
