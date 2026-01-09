/**
 * Mobile Navigation Module
 * Handles mobile-specific navigation and view switching
 */

// Mobile view state
let currentMobileView = "quests";
let longPressTimer = null;
const LONG_PRESS_DURATION = 500; // ms

/**
 * Initialize mobile navigation
 */
export function initMobileNav() {
  // Detect mobile: FirebaseBridge, user agent, or small screen
  const isMobileDevice = window.FirebaseBridge?.isMobile ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768;

  if (!isMobileDevice) {
    return;
  }

  // Add mobile class to body
  document.body.classList.add("is-mobile");

  // Load mobile CSS dynamically
  loadMobileCSS();

  // Setup navigation handlers
  setupMobileNavHandlers();

  // Setup long-press for context menus
  setupLongPressHandlers();

  // Setup mobile menu
  setupMobileMenu();

  // Setup add form dismissal (backdrop click)
  setupAddFormDismissal();

  // Setup swipe navigation between tabs
  setupSwipeNavigation();

  console.log("📱 Mobile navigation initialized");
}

/**
 * Load mobile CSS file
 */
function loadMobileCSS() {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "css/mobile.css";
  link.id = "mobile-styles";
  document.head.appendChild(link);
}

/**
 * Setup mobile bottom nav handlers
 */
function setupMobileNavHandlers() {
  const mobileNav = document.getElementById("mobile-nav");
  if (!mobileNav) return;

  mobileNav.addEventListener("click", (e) => {
    const btn = e.target.closest(".mobile-nav-btn");
    if (!btn) return;

    const view = btn.dataset.view;
    if (!view) return;

    // Handle menu separately
    if (view === "menu") {
      openMobileMenu();
      return;
    }

    // Handle add separately (toggle the add form)
    if (view === "add") {
      toggleMobileAddForm();
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
  document.querySelectorAll(".mobile-nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });

  // Toggle view visibility
  const body = document.body;
  body.classList.remove(
    "mobile-view-spaces",
    "mobile-view-quests",
    "mobile-view-archive"
  );
  body.classList.add(`mobile-view-${view}`);

  // Close any open overlays when switching views
  closeMobileMenu();
  closeMobileAddForm();
}

/**
 * Toggle mobile add form (bottom sheet style)
 */
function toggleMobileAddForm() {
  const addForm = document.getElementById("add-quest-form");
  if (addForm) {
    const isOpen = addForm.classList.contains("mobile-add-open");
    if (isOpen) {
      closeMobileAddForm();
    } else {
      addForm.classList.add("mobile-add-open");
      document.body.classList.add("mobile-add-active");
    }
  }
}

/**
 * Open mobile add form (bottom sheet style)
 */
function openMobileAddForm() {
  const addForm = document.getElementById("add-quest-form");
  if (addForm) {
    addForm.classList.add("mobile-add-open");
    document.body.classList.add("mobile-add-active");
  }
}

/**
 * Close mobile add form
 */
export function closeMobileAddForm() {
  const addForm = document.getElementById("add-quest-form");
  if (addForm) {
    addForm.classList.remove("mobile-add-open");
    document.body.classList.remove("mobile-add-active");
  }
}

/**
 * Open mobile menu overlay
 */
function openMobileMenu() {
  const overlay = document.getElementById("mobile-menu-overlay");
  if (overlay) {
    overlay.classList.remove("hidden");
    updateMobileMenuAuth();
  }
}

/**
 * Close mobile menu overlay
 */
function closeMobileMenu() {
  const overlay = document.getElementById("mobile-menu-overlay");
  if (overlay) {
    overlay.classList.add("hidden");
  }
}

/**
 * Update mobile menu auth section based on login state
 */
function updateMobileMenuAuth() {
  const authSection = document.getElementById("mobile-menu-auth");
  if (!authSection) return;

  const user = window.FirebaseBridge?.currentUser;

  if (user) {
    // Get sync and storage info
    const syncTime =
      window.FirebaseBridge?.getRelativeSyncTime?.() || "Not synced";
    const storageInfo = window.FirebaseBridge?.getStorageInfo?.() || {
      usedMB: "0",
      limitMB: "50",
      percent: 0,
    };

    authSection.innerHTML = `
            <div class="mobile-menu-user">
                <span class="mobile-menu-user-email">${user.email || user.displayName || "User"
      }</span>
                <div class="mobile-menu-sync-status">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <polyline points="23 4 23 10 17 10"/>
                        <polyline points="1 20 1 14 7 14"/>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                    <span id="mobile-sync-time">${syncTime}</span>
                </div>
                <button id="mobile-menu-storage" class="mobile-menu-storage" title="Manage Storage Files">
                    <div class="mobile-storage-bar">
                        <div class="mobile-storage-fill ${storageInfo.percent >= 90
        ? "danger"
        : storageInfo.percent >= 70
          ? "warning"
          : ""
      }" style="width: ${storageInfo.percent}%"></div>
                    </div>
                    <span class="mobile-storage-text">${storageInfo.usedMB} / ${storageInfo.limitMB
      } MB</span>
                </button>
                <button id="mobile-menu-export" class="mobile-menu-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    <span>Export My Data</span>
                </button>
                <button id="mobile-menu-delete-account" class="mobile-menu-item mobile-menu-item-danger">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    <span>Delete Account</span>
                </button>
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
  // Backdrop click closes menu
  document
    .getElementById("mobile-menu-overlay")
    ?.addEventListener("click", (e) => {
      if (e.target.id === "mobile-menu-overlay") {
        closeMobileMenu();
      }
    });

  // Menu item clicks (delegated)
  document
    .getElementById("mobile-menu-overlay")
    ?.addEventListener("click", (e) => {
      // Check for menu item or storage button
      const btn = e.target.closest(".mobile-menu-item, .mobile-menu-storage");
      if (!btn) return;

      const id = btn.id;
      closeMobileMenu();

      switch (id) {
        case "mobile-menu-settings":
          document.getElementById("modal-settings")?.classList.remove("hidden");
          break;
        case "mobile-menu-bulk":
          document.getElementById("btn-bulk-mode")?.click();
          break;
        case "mobile-menu-stats":
          document.getElementById("btn-statistics")?.click();
          break;
        case "mobile-menu-login":
          document.getElementById("btn-login")?.click();
          break;
        case "mobile-menu-logout":
          document.getElementById("btn-logout")?.click();
          break;
        case "mobile-menu-export":
          document.getElementById("btn-export-data")?.click();
          break;
        case "mobile-menu-delete-account":
          document.getElementById("btn-delete-account")?.click();
          break;
        case "mobile-menu-storage":
          // Open the storage file manager modal directly
          document.getElementById("modal-files")?.classList.remove("hidden");
          // Trigger file loading if FirebaseBridge has the method
          if (window.FirebaseBridge?.currentUser) {
            // The modal has a refresh button that triggers loadStorageFiles
            document.getElementById("btn-refresh-files")?.click();
          }
          break;
      }
    });
}

/**
 * Setup add form dismissal (click outside to close)
 */
function setupAddFormDismissal() {
  // Listen for clicks on the backdrop created by mobile-add-active::before
  document.addEventListener("click", (e) => {
    // Only when add form is open
    if (!document.body.classList.contains("mobile-add-active")) return;

    // Don't close if any modal is open (like image picker)
    const openModal = document.querySelector('.modal:not(.hidden)');
    if (openModal) return;

    // Don't close if clicking on a modal backdrop or content
    if (e.target.closest('.modal')) return;

    const addForm = document.getElementById("add-quest-form");
    const mobileNav = document.getElementById("mobile-nav");

    // Check if click is outside the form and nav
    if (
      addForm &&
      !addForm.contains(e.target) &&
      !mobileNav?.contains(e.target)
    ) {
      closeMobileAddForm();
    }
  });
}

/**
 * Setup swipe navigation between tabs
 */
function setupSwipeNavigation() {
  const views = ["spaces", "quests", "archive"];
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;
  const SWIPE_THRESHOLD = 50; // Minimum distance for a swipe
  const VERTICAL_THRESHOLD = 100; // Max vertical movement to still count as horizontal swipe

  document.addEventListener(
    "touchstart",
    (e) => {
      // Don't capture swipes on modals or the add form
      if (
        e.target.closest(".modal:not(.hidden)") ||
        e.target.closest(".add-form.mobile-add-open") ||
        e.target.closest(".mobile-menu-overlay:not(.hidden)")
      ) {
        return;
      }
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchend",
    (e) => {
      // Don't process if a modal is open
      if (
        document.body.classList.contains("mobile-add-active") ||
        document.querySelector(".modal:not(.hidden)") ||
        !document.querySelector(".mobile-menu-overlay.hidden")
      ) {
        return;
      }

      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;

      const deltaX = touchEndX - touchStartX;
      const deltaY = Math.abs(touchEndY - touchStartY);

      // Check if it's a valid horizontal swipe
      if (Math.abs(deltaX) > SWIPE_THRESHOLD && deltaY < VERTICAL_THRESHOLD) {
        const currentIndex = views.indexOf(currentMobileView);
        if (currentIndex === -1) return;

        if (deltaX < 0) {
          // Swipe left - go to next view
          const nextIndex = Math.min(currentIndex + 1, views.length - 1);
          if (nextIndex !== currentIndex) {
            switchMobileView(views[nextIndex]);
          }
        } else {
          // Swipe right - go to previous view
          const prevIndex = Math.max(currentIndex - 1, 0);
          if (prevIndex !== currentIndex) {
            switchMobileView(views[prevIndex]);
          }
        }
      }
    },
    { passive: true }
  );
}

/**
 * Setup long-press handlers for context menus on mobile
 */
function setupLongPressHandlers() {
  // Spaces long-press
  const spacesList = document.getElementById("spaces-list");
  if (spacesList) {
    setupLongPress(spacesList, ".space-tab", (target, e) => {
      // Simulate right-click for context menu
      const contextEvent = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: e.touches?.[0]?.clientX || e.clientX,
        clientY: e.touches?.[0]?.clientY || e.clientY,
      });
      target.dispatchEvent(contextEvent);
    });
  }

  // Quest cards long-press
  const questContainer = document.getElementById("quest-container");
  if (questContainer) {
    setupLongPress(questContainer, ".quest-card", (target, e) => {
      const contextEvent = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: e.touches?.[0]?.clientX || e.clientX,
        clientY: e.touches?.[0]?.clientY || e.clientY,
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

  container.addEventListener(
    "touchstart",
    (e) => {
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
    },
    { passive: true }
  );

  container.addEventListener(
    "touchmove",
    (e) => {
      if (!touchStartTarget) return;
      // Cancel if moved more than 10px
      const dx = Math.abs(e.touches[0].clientX - touchStartPos.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPos.y);
      if (dx > 10 || dy > 10) {
        clearTimeout(longPressTimer);
        touchStartTarget = null;
      }
    },
    { passive: true }
  );

  container.addEventListener(
    "touchend",
    () => {
      clearTimeout(longPressTimer);
      touchStartTarget = null;
    },
    { passive: true }
  );

  container.addEventListener(
    "touchcancel",
    () => {
      clearTimeout(longPressTimer);
      touchStartTarget = null;
    },
    { passive: true }
  );
}

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMobileNav);
} else {
  // Small delay to ensure FirebaseBridge is initialized
  setTimeout(initMobileNav, 100);
}

// Export for use by other modules
export { currentMobileView };
