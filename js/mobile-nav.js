/**
 * Mobile Navigation Module
 * Handles mobile-specific navigation and view switching
 */

// Mobile view state
let currentMobileView = 'quests';
let longPressTimer = null;
const LONG_PRESS_DURATION = 500; // ms

/**
 * Initialize mobile navigation
 */
export function initMobileNav() {
    // Only initialize on mobile devices
    if (!window.FirebaseBridge?.isMobile) {
        return;
    }

    // Add mobile class to body
    document.body.classList.add('is-mobile');

    // Load mobile CSS dynamically
    loadMobileCSS();

    // Setup navigation handlers
    setupMobileNavHandlers();

    // Setup long-press for context menus
    setupLongPressHandlers();

    // Setup mobile menu
    setupMobileMenu();

    console.log('📱 Mobile navigation initialized');
}

/**
 * Load mobile CSS file
 */
function loadMobileCSS() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'mobile.css';
    link.id = 'mobile-styles';
    document.head.appendChild(link);
}

/**
 * Setup mobile bottom nav handlers
 */
function setupMobileNavHandlers() {
    const mobileNav = document.getElementById('mobile-nav');
    if (!mobileNav) return;

    mobileNav.addEventListener('click', (e) => {
        const btn = e.target.closest('.mobile-nav-btn');
        if (!btn) return;

        const view = btn.dataset.view;
        if (!view) return;

        // Handle menu separately
        if (view === 'menu') {
            openMobileMenu();
            return;
        }

        // Handle add separately (opens the add form)
        if (view === 'add') {
            openMobileAddForm();
            return;
        }

        switchMobileView(view);
    });
}

/**
 * Switch between mobile views (spaces, quests, archive)
 */
export function switchMobileView(view) {
    currentMobileView = view;

    // Update nav button states
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Toggle view visibility
    const body = document.body;
    body.classList.remove('mobile-view-spaces', 'mobile-view-quests', 'mobile-view-archive');
    body.classList.add(`mobile-view-${view}`);

    // Close any open overlays when switching views
    closeMobileMenu();
    closeMobileAddForm();
}

/**
 * Open mobile add form (bottom sheet style)
 */
function openMobileAddForm() {
    const addForm = document.getElementById('add-quest-form');
    if (addForm) {
        addForm.classList.add('mobile-add-open');
        document.body.classList.add('mobile-add-active');
    }
}

/**
 * Close mobile add form
 */
export function closeMobileAddForm() {
    const addForm = document.getElementById('add-quest-form');
    if (addForm) {
        addForm.classList.remove('mobile-add-open');
        document.body.classList.remove('mobile-add-active');
    }
}

/**
 * Open mobile menu overlay
 */
function openMobileMenu() {
    const overlay = document.getElementById('mobile-menu-overlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        updateMobileMenuAuth();
    }
}

/**
 * Close mobile menu overlay
 */
function closeMobileMenu() {
    const overlay = document.getElementById('mobile-menu-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

/**
 * Update mobile menu auth section based on login state
 */
function updateMobileMenuAuth() {
    const authSection = document.getElementById('mobile-menu-auth');
    if (!authSection) return;

    const user = window.FirebaseBridge?.currentUser;

    if (user) {
        authSection.innerHTML = `
            <div class="mobile-menu-user">
                <span class="mobile-menu-user-email">${user.email || user.displayName || 'User'}</span>
                <button id="mobile-menu-logout" class="mobile-menu-item mobile-menu-item-danger">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    <span>Sign Out</span>
                </button>
            </div>
        `;
    } else {
        authSection.innerHTML = `
            <button id="mobile-menu-login" class="mobile-menu-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                    <polyline points="10 17 15 12 10 7"/>
                    <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                <span>Sign In</span>
            </button>
        `;
    }
}

/**
 * Setup mobile menu handlers
 */
function setupMobileMenu() {
    // Close button
    document.getElementById('mobile-menu-close')?.addEventListener('click', closeMobileMenu);

    // Backdrop click
    document.getElementById('mobile-menu-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'mobile-menu-overlay') {
            closeMobileMenu();
        }
    });

    // Menu item clicks (delegated)
    document.getElementById('mobile-menu-overlay')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.mobile-menu-item');
        if (!btn) return;

        const id = btn.id;
        closeMobileMenu();

        switch (id) {
            case 'mobile-menu-settings':
                document.getElementById('modal-settings')?.classList.remove('hidden');
                break;
            case 'mobile-menu-bulk':
                document.getElementById('btn-bulk-mode')?.click();
                break;
            case 'mobile-menu-stats':
                document.getElementById('btn-statistics')?.click();
                break;
            case 'mobile-menu-login':
                document.getElementById('btn-login')?.click();
                break;
            case 'mobile-menu-logout':
                document.getElementById('btn-logout')?.click();
                break;
        }
    });
}

/**
 * Setup long-press handlers for context menus on mobile
 */
function setupLongPressHandlers() {
    // Spaces long-press
    const spacesList = document.getElementById('spaces-list');
    if (spacesList) {
        setupLongPress(spacesList, '.space-tab', (target, e) => {
            // Simulate right-click for context menu
            const contextEvent = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                clientX: e.touches?.[0]?.clientX || e.clientX,
                clientY: e.touches?.[0]?.clientY || e.clientY
            });
            target.dispatchEvent(contextEvent);
        });
    }

    // Quest cards long-press
    const questContainer = document.getElementById('quest-container');
    if (questContainer) {
        setupLongPress(questContainer, '.quest-card', (target, e) => {
            const contextEvent = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                clientX: e.touches?.[0]?.clientX || e.clientX,
                clientY: e.touches?.[0]?.clientY || e.clientY
            });
            target.dispatchEvent(contextEvent);
        });
    }
}

/**
 * Generic long-press setup for a container
 */
function setupLongPress(container, selector, callback) {
    let touchStartTarget = null;
    let touchStartPos = { x: 0, y: 0 };

    container.addEventListener('touchstart', (e) => {
        const target = e.target.closest(selector);
        if (!target) return;

        touchStartTarget = target;
        touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };

        longPressTimer = setTimeout(() => {
            // Vibrate if supported
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
            callback(target, e);
            touchStartTarget = null;
        }, LONG_PRESS_DURATION);
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (!touchStartTarget) return;
        // Cancel if moved more than 10px
        const dx = Math.abs(e.touches[0].clientX - touchStartPos.x);
        const dy = Math.abs(e.touches[0].clientY - touchStartPos.y);
        if (dx > 10 || dy > 10) {
            clearTimeout(longPressTimer);
            touchStartTarget = null;
        }
    }, { passive: true });

    container.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
        touchStartTarget = null;
    }, { passive: true });

    container.addEventListener('touchcancel', () => {
        clearTimeout(longPressTimer);
        touchStartTarget = null;
    }, { passive: true });
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
} else {
    // Small delay to ensure FirebaseBridge is initialized
    setTimeout(initMobileNav, 100);
}

// Export for use by other modules
export { currentMobileView };
