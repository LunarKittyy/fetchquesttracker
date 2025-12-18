# Quest Tracker Tasks

## Bugs (Priority)

- [x] Fix space modal X/Cancel buttons
- [x] Make space progress bar live-update
- [x] Fix quest image aspect ratio (move to right side)
- [x] Fix X button in settings and edit space modals

## Features

- [x] Color tagging for individual quests
- [x] Priority labels (High/Medium/Low)
- [x] Progress hotkeys (Shift+click, Ctrl+click - already exists)
- [x] Refine color/priority UI (popup selectors)
- [x] Priority-based sorting (High > Medium > None > Low)
- [x] Quest search & filter (with all-spaces option)
- [x] Quest notes/memos (click-to-edit name, notes toggle)
- [x] Count archived items in progress/stats
- [x] Manual archive button on quest cards
- [x] Bulk operations mode
- [x] Firebase account system (optional cloud saves)
  - [x] Firebase config template
  - [x] Auth module (email, Google, password reset)
  - [x] Cloud sync module (Firestore save/load)
  - [x] Auth modal HTML + CSS
  - [x] User menu dropdown HTML + CSS
  - [x] Data migration modal HTML + CSS
  - [x] App.js integration (connect UI to modules)
  - [x] Firebase Console setup (auth providers, Firestore, authorized domain)
  - [x] Auto sync with relative timestamps (e.g., "synced 4s ago")
  - [x] Account deletion with double confirmation
  - [x] GDPR compliance (consent, data export)
  - [x] Firebase Storage for images (instead of base64)
    - [x] Add Storage imports and initialization
    - [x] Image upload helper functions
    - [x] Modify saveToCloud to upload images
    - [x] Enable Storage in Firebase Console
    - [x] Image compression (max 800px, quality 0.7)
    - [x] 50MB per-user storage limit
    - [x] Storage usage display in user dropdown
    - [x] Test image upload flow
  - [x] Real-time sync across devices (onSnapshot listeners)
  - [x] Storage file manager (click storage bar to manage files)
- [x] Remove sound option from settings
- [x] Optimized real-time sync (no animation flicker, hover protection, race condition fix)
- [ ] Undo/redo system
- [ ] Statistics dashboard
- [ ] Quest templates
- [ ] Daily/weekly reset timers
- [ ] Share progress as image
- [ ] Dark/light theme toggle
- [ ] Source grouping
- [ ] Multi-column layout
- [ ] Remove categories option
- [ ] Custom right-click context menus (spaces, categories, quests)

## Deferred

- [ ] File split refactor

## Future Considerations

- [ ] Collaborative Spaces (multi-user)
  - [ ] Invite system
    - [ ] Generate invite links/codes
    - [ ] Accept/decline invitations
    - [ ] Revoke access
  - [ ] Sharing management
    - [ ] Owner vs collaborator roles
    - [ ] Storage counts toward owner's limit
    - [ ] Shared spaces section in sidebar (below own spaces)
  - [ ] Collaboration modes (per space/quest configurable by owner)
    - [ ] Full edit mode (collaborators can edit everything)
    - [ ] Helper mode with direct contributions
    - [ ] Helper mode with "propose change" (owner approval required)
  - [ ] Contribution tracking
    - [ ] Helper can mark items they have
    - [ ] Owner can accept/reject proposed contributions
    - [ ] Visual indicator for pending proposals
  - [ ] Sync conflict handling
    - [ ] Version checking
    - [ ] Conflict detection
    - [ ] Merge strategy (last-write-wins vs manual resolve)
  - [ ] Real-time updates
    - [ ] Firebase realtime listeners for shared spaces
    - [ ] Live presence (show who's viewing/editing)

## Active Issues

### Resolved

- [x] Real-time sync rendering - fixed syncActiveSpace binding
- [x] Animation flicker on sync - removed fadeInUp animation
- [x] Hover interruption on sync - sync waits for mouseleave
- [x] State reversion race - pendingLocalChange flag blocks stale syncs

### Adblocker Interference

- `ERR_BLOCKED_BY_CLIENT` errors when adblocker is enabled
- Disable adblocker or whitelist the site for full functionality
- May also be DNS-level blocking (Pi-hole, router settings)

## Session Notes

### Firebase Configuration

- Project: fetchquesttracker
- Auth: Email/Password + Google enabled
- Firestore: Test mode (need security rules for production)
- Storage: Enabled, test mode

### Key Files

- `js/firebase-bridge.js` - All Firebase logic (auth, sync, storage)
- `app.js` - Main app, lines 2304+ for auth UI, 2354+ for realtime handler
- `index.html` - User dropdown at lines ~117-170
- `style.css` - Storage bar styles at ~3210
