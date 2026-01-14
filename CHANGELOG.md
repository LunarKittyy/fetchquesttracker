## [v5.5.0] - 2026-01-14
### Added
- **Robust Sync Engine**: Implemented a read-before-write merge strategy for shared spaces in `js/sync-manager.js`. It now merges local and server state to prevent data loss from concurrent edits.
- **Firefox Mobile Fallback**: Added `signInWithRedirect` support for browsers that block authentication popups (like Firefox on Android).
- **Form Grace Period**: Added a 2.5-second grace period after dropdown selections in the quest form to prevent accidental collapse.
- **Form Tag Modal**: Replaced the inline tag picker with a proper modal, matching the quest editing experience for better stability.

### Changed
- **Massive Robustness Pass**: Systematic audit and fix of 50+ potential crash points. Added null/undefined guards across 14 modules to ensure the app handles empty or corrupted state gracefully.
- **Standardized Elements**: Centralized more DOM references in `js/elements.js` for better maintainability.

### Fixed
- **Tag Creation Bug**: Fixed issue where tags were not being saved during initial quest creation in `addItem`.
- **CSP Compliance**: Moved inline service worker registration to an external file (`js/sw-register.js`).
- **Service Worker**: Updated cache list to remove legacy/missing files and force a clean refresh.

---

## [v5.1.0] - 2026-01-09
### Changed
- **Modular Architecture Refactor**: Completely reorganized the application logic. Split the monolithic `app.js` into functional modules:
  - `js/elements.js`: Centralized DOM references.
  - `js/form-logic.js`: Multi-step quest form & image handling.
  - `js/tags.js`: Dedicated tag management & color systems.
  - `js/quest-events.js`: Interaction events for quest cards.
  - `js/modals.js`: Standardized modal controls.
- **Audio Removal**: Completely purged all audio assets and sounds from the application for a faster, leaner experience.
- **File Structure**: Relocated core CSS files to `/css` and organized scripts into categorized modules.

### Added
- **Smart Input Parser**: Extracted quest parsing logic into a dedicated module (`js/input-parser.js`) for better testing and accuracy.

---

## [v5.0.x] - 2026-01-09
### Added
- **Collaborative Spaces**: Share spaces via invite links with Viewer/Editor roles.
- **Real-time Sync**: Enhanced Firestore integration for live collaboration.
- **Unified Debugging**: Logger framework and debug overlay.
- **Profile Editing**: Users can now edit their profiles and usernames.
- **Revoke Invites**: List active invite links and revoke access.
- **Toast Notifications**: Modern animations for sync and permission actions.

### Fixed
- Invite link logic ("unbroke invites").
- Firestore auth timing and initialization.
- Real-time sync desync issues.
- Mobile UI rendering and Firefox Mobile auth.

---

## [v4.0.x] - 2025-12-24
### Added
- **Tagging System**: Colored tags for flexible organization.
- **Batch Editing**: Edit multiple quests simultaneously.
- **Cross-Space Search**: Search across all spaces with `tag:` prefix support.
- **Tag Manager**: Dedicated menu for managing global tags.

### Fixed
- Quest modifier issues across different spaces.
- Selection and search UI bugs.

---

## [v3.0.x] - 2025-12-19
### Added
- **Full Mobile UI**: Dedicated bottom navigation and touch gestures.
- **PWA Support**: Basic manifest and service worker.
- **Statistics Dashboard**: Visual progress tracking and completion stats.
- **Custom Context Menus**: Right-click support for desktop, long-press for mobile.

### Fixed
- Space deletion logic and storage state persistence.
- Quest input and modal logic specifically for mobile devices.

---

## [v2.0.x] - 2025-12-18
### Added
- **Firebase Migration**: Moved from local storage to Firebase (Auth, Firestore, Storage).
- **Image Storage**: Cloud storage for quest images.
- **Storage Quotas**: Server-side enforcement of 10MB limits.
- **Auto-Sync**: Debounced cloud saving.

### Fixed
- Rendering refresh improvements.
- Multi-device update synchronization.

---

## [v1.0.0] - 2025-12-17
### Added
- **Initial Release**: Core quest/item tracking functionality.
- **Foundation**: Basic space management and quest CRUD.
