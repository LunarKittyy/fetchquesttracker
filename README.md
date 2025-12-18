# FETCH QUEST v2.2

A stylish quest/item tracker web application with Firebase cloud sync support. Built with a NASA-punk/Cassette Punk aesthetic inspired by Arc Raiders.

## Features

### Core Functionality

- **Spaces** - Organize quests into separate spaces with custom colors
- **Quest Types** - Track items (count-based) or objectives (checkbox-based)
- **Categories** - Group quests within spaces
- **Progress Tracking** - Visual progress bars, bulk increment with Shift/Ctrl+click
- **Archive System** - Completed quests auto-archive, can be restored
- **Search** - Search quests across all spaces

### Cloud Features (Firebase)

- **User Authentication** - Email/password and Google sign-in
- **Cloud Sync** - Automatic sync with 2-second debounce
- **Real-time Updates** - Changes sync live across devices
- **Image Storage** - Images compressed and stored in Firebase Storage
- **50MB Per-user Limit** - Storage usage tracking and display
- **GDPR Compliance** - Data export and account deletion

### UI/UX

- **Priority Labels** - High/Medium/Low with color coding
- **Color Tagging** - Color-code individual quests
- **Bulk Operations** - Select multiple quests for batch actions
- **Dark Theme** - Post-apocalyptic aesthetic with subtle animations
- **Responsive** - Works on desktop and mobile

## Tech Stack

- Vanilla HTML/CSS/JavaScript
- Firebase (Auth, Firestore, Storage)
- No build step required

## Setup

### Local Development

1. Clone the repo
2. Open `index.html` in a browser (or use a local server)
3. Works offline with localStorage

### Firebase Cloud Sync

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication (Email/Password + Google)
3. Enable Cloud Firestore (start in test mode)
4. Enable Cloud Storage (start in test mode)
5. Add your domain to authorized domains
6. Update credentials in `js/firebase-bridge.js` (lines 32-40)

## File Structure

```
├── index.html          # Main HTML structure
├── style.css           # All styles
├── app.js              # Main application logic
└── js/
    ├── firebase-bridge.js   # Firebase integration module
    └── firebase-config.js   # Firebase configuration (legacy)
```

## Current Status

See [TASKS.md](TASKS.md) for detailed progress tracking.

### Recently Completed

- Firebase Authentication (email, Google, password reset)
- Cloud sync with Firestore
- Firebase Storage for images (with compression)
- Auto-sync with relative timestamps
- Real-time sync across devices
- Account deletion with double confirmation
- GDPR data export

### Known Issues

- Adblockers may block Firebase requests (ERR_BLOCKED_BY_CLIENT)
- Real-time sync for quest items needs debugging

### Planned Features

- Undo/redo system
- Statistics dashboard
- Quest templates
- Collaborative spaces (multi-user)

## Usage Notes

### Keyboard Shortcuts

- `Shift + Click` on +/- buttons: Add/subtract 5 (configurable)
- `Ctrl + Click` on +/- buttons: Add/subtract 10 (configurable)

### Storage Limits

- Each user has 50MB of cloud storage
- Images are automatically compressed (max 800px, 70% quality)
- Local storage is unlimited (in localStorage)

## License

MIT
