# FetchQuest Tracker

A stylish quest/item tracker web application with Firebase cloud sync support.
### [Try it here!](https://lumikitten.github.io/fetchquesttracker/)
## Features

### Core Functionality

- **Spaces** - Organize quests into separate spaces with custom colors
- **Quest Types** - Track items (count-based) or objectives (checkbox-based)
- **Categories** - Group quests within spaces, with category manager to remove unused ones
- **Progress Tracking** - Visual progress bars, bulk increment with Shift/Ctrl+click
- **Archive System** - Completed quests auto-archive, can be restored
- **Search** - Search quests across all spaces
- **Statistics Dashboard** - View overall progress and completion stats

### Cloud Features (Firebase)

- **User Authentication** - Email/password and Google sign-in
- **Cloud Sync** - Automatic sync with 2-second debounce
- **Real-time Updates** - Changes sync live across devices
- **Image Storage** - Images compressed and stored in Firebase Storage
- **10MB Per-user Limit** - Storage usage tracking, file manager UI
- **Privacy in Mind** - Data export and account deletion
- **Security First** - reCAPTCHA v3 protection for API security

### UI/UX

- **Priority Labels** - High/Medium/Low with color coding and sorting
- **Color Tagging** - Color-code individual quests
- **Bulk Operations** - Select multiple quests for batch actions
- **Custom Context Menus** - Right-click menus for spaces, categories, and quests
- **Custom Popups** - Styled confirmation dialogs (no browser alerts)
- **Dark Theme** - Post-apocalyptic aesthetic with subtle animations
- **Responsive** - Works on desktop and mobile
- **Smooth Animations** - Quest creation fly-in, progress updates

## Tech Stack

- Vanilla HTML/CSS/JavaScript (modular architecture)
- Firebase (Auth, Firestore, Storage, App Check)
- No build step required

## File Structure

```
├── index.html              # Main HTML structure
├── style.css               # All styles (74KB)
├── app.js                  # Main application logic & initialization
└── js/
    ├── firebase-bridge.js  # Firebase SDK initialization & App Check
    ├── firebase-config.js  # Firebase configuration (legacy)
    ├── auth.js             # Authentication logic
    ├── auth-ui.js          # Auth modal & user menu UI
    ├── cloud-sync.js       # Firestore sync logic
    ├── storage.js          # Firebase Storage for images
    ├── file-manager.js     # Storage file manager UI
    ├── state.js            # Application state management
    ├── spaces.js           # Spaces functionality
    ├── quests.js           # Quest CRUD operations
    ├── archive.js          # Archive system
    ├── bulk.js             # Bulk operations mode
    ├── context-menu.js     # Custom right-click context menus
    ├── popup.js            # Custom popup/alert system
    ├── statistics.js       # Statistics dashboard
    ├── particles.js        # Background particle effects
    └── utils.js            # Utility functions
```

## Current Status

See [TASKS.md](TASKS.md) for detailed progress tracking.

### Recently Completed

- Custom right-click context menus for spaces, categories, quests
- Statistics dashboard
- Category manager (delete unused categories)
- Custom popup system (replaces browser alerts)
- File split refactor (modular architecture)
- Firebase App Check integration
- Optimized real-time sync (no flicker, hover protection)
- New quest creation animations
- Custom scrollbar styling

### Known Issues

- Adblockers may block some Firebase requests (ERR_BLOCKED_BY_CLIENT).
- Multi-column layout is partially implemented

### Planned Features

- Collaborative spaces (multi-user with invite system)
- Helper mode for collaborators
- Contribution tracking

### Keyboard Shortcuts

- `Shift + Click` on +/- buttons: Add/subtract 5 (configurable)
- `Ctrl + Click` on +/- buttons: Add/subtract 10 (configurable)
- `Right-click` on spaces/quests: Context menu with quick actions


v4.1
