# Changelog & Version History

This file documents the major milestones and development phases of the FetchQuest Tracker.

## [v5.0.x] - 2026-01-09 (Current)
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
