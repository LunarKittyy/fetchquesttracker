# FetchQuest Tracker

A stylish quest/item tracker web application with Firebase cloud sync support.

### [Try it here!](https://lumikitten.github.io/fetchquesttracker/)

## Features

### Core Functionality

- **Spaces** - Organize quests into separate spaces with custom colors
- **Quest Types** - Track items (count-based) or objectives (checkbox-based)
- **Categories** - Group quests within spaces, with category manager to remove unused ones
- **Custom Tags** - Create colored tags for flexible organization. Assign multiple tags per quest.
- **Progress Tracking** - Visual progress bars, bulk increment with Shift/Ctrl+click
- **Archive System** - Completed quests auto-archive, can be restored
- **Search** - Search quests by name, or use `tag:` prefix to filter by tag/priority/category
- **Bulk Actions** - Select by tag, archive, or delete multiple quests at once
- **Statistics Dashboard** - View overall progress and completion stats

### Cloud Features (Firebase)

- **User Authentication** - Email/password and Google sign-in
- **Cloud Sync** - Automatic sync with 2-second debounce
- **Real-time Updates** - Changes sync live across devices
- **Image Storage** - Images compressed and stored in Firebase Storage
- **10MB Per-user Limit** - SERVER-SIDE enforcement via Cloud Functions
- **Privacy in Mind** - Data export and account deletion
- **Security First** - reCAPTCHA v3 and backend validation

### UI/UX

- **Priority Labels** - High/Medium/Low with color coding and sorting
- **Color Tagging** - Color-code individual quests
- **Bulk Operations** - Select multiple quests for batch actions
- **Custom Context Menus** - Right-click menus for spaces, categories, and quests
- **Custom Popups** - Styled confirmation dialogs (no browser alerts)
- **Dark Theme** - Post-apocalyptic aesthetic with subtle animations
- **Responsive** - Works on desktop and mobile
- **Smooth Animations** - Quest creation fly-in, progress updates

### Storage Quotas

Instead of relying on client-side checks (which can be bypassed), we enforce storage limits on the backend:

1.  **Cloud Functions (`onFileUpload`, `onFileDelete`)**: Automatically track total storage usage in a secure Firestore document (`userStorage/{userId}`).
2.  **Storage Rules**: Reject any upload that would exceed the 10MB quota based on the backend counter.
3.  **Firestore Rules**: The `userStorage` collection is read-only for users; only the trusted Cloud Functions can update the counters.

### Authentication & Authorization

- **Firebase Auth**: handles identity verification.
- **Firestore Rules**: Strict owner-only access. Users can only read/write their own documents.

## Installation & Setup

### Prerequisites

- Node.js (v20 recommended)
- Firebase CLI (`npm install -g firebase-tools`)

### Setup

1.  **Clone the repository**
    ```bash
    git clone https://github.com/lumikitten/fetchquesttracker.git
    cd fetchquesttracker
    ```
2.  **Initialize Firebase**
    ```bash
    firebase init
    # Select: Firestore, Functions, Storage
    # Use existing project: fetchquesttracker
    ```
3.  **Install Function Dependencies**
    ```bash
    cd functions
    npm install
    cd ..
    ```

## Deployment

### Backend (Firebase)

Deploy the security rules and cloud functions:

```bash
firebase deploy --only functions,storage,firestore
```

_Note: This project uses Firebase Functions v1 (Node 20) for simplified IAM permission management._

### Frontend

The frontend is a static site (HTML/JS/CSS).

- **GitHub Pages**: Pushing to the `main` branch will auto-deploy (if configured).
- **Manual**: Upload the root directory to any static host.

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript (modular architecture)
- **Backend**: Firebase (Auth, Firestore, Storage, App Check)
- **Compute**: Firebase Cloud Functions (Node.js 20)
- **No build step required** for the frontend

## File Structure

```
├── index.html              # Main HTML structure
├── style.css               # All styles
├── app.js                  # Main application logic & initialization
├── storage.rules           # Firebase Storage security rules
├── functions/              # Cloud Functions (Backend logic)
│   ├── index.js            # Storage trigger implementations
│   └── package.json        # Function dependencies
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

- **Custom Tagging System**: Create & assign colored tags to quests, search via `tag:` prefix, bulk select by tag
- **Server-side Storage Enforcement**: Implemented Cloud Functions and Storage Rules to strictly enforce 10MB limit.
- **Security Hardening**: Mitigated CWE-602 vulnerability.
- Custom right-click context menus
- Statistics dashboard
- Category manager
- Custom popup system

### Known Issues

- Adblockers may block some Firebase requests.
- Multi-column layout is partially implemented.
- Login doesn't work on Firefox mobile due to it not being able to handle pop-up logins properly.
