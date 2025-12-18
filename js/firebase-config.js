/**
 * Firebase Configuration
 * 
 * INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com/
 * 2. Select your project (or create one)
 * 3. Go to Project Settings → General → Your apps → Web
 * 4. Copy your config values below
 * 5. Enable Authentication (Email/Password + Google)
 * 6. Enable Firestore Database
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Firebase Configuration - FetchQuest Project
const firebaseConfig = {
    apiKey: "AIzaSyCkMgwo6oujPMhqUrAnIQMwbzV582MFglA",
    authDomain: "fetchquesttracker.firebaseapp.com",
    projectId: "fetchquesttracker",
    storageBucket: "fetchquesttracker.firebasestorage.app",
    messagingSenderId: "46789887406",
    appId: "1:46789887406:web:134954eadbe63c4187743f",
    measurementId: "G-W1LXRR26NG"
};

// Check if Firebase is configured
export const isFirebaseConfigured = () => {
    return firebaseConfig.apiKey !== "YOUR_API_KEY" && 
           firebaseConfig.projectId !== "YOUR_PROJECT_ID";
};

// Initialize Firebase (only if configured)
let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured()) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log('Firebase initialized successfully');
    } catch (error) {
        console.error('Firebase initialization failed:', error);
    }
} else {
    console.log('Firebase not configured - using localStorage only');
}

export { app, auth, db };
