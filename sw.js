/**
 * FetchQuest Tracker Service Worker
 * Caches static assets for offline access
 */

const CACHE_NAME = 'fetchquest-v4.3';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/css/mobile.css',
    '/app.js',
    '/favicon.svg',
    '/manifest.json',
    '/js/state.js',
    '/js/utils.js',
    '/js/popup.js',
    '/js/particles.js',
    '/js/storage.js',
    '/js/spaces.js',
    '/js/archive.js',
    '/js/bulk.js',
    '/js/context-menu.js',
    '/js/statistics.js',
    '/js/file-manager.js',
    '/js/quests.js',
    '/js/auth-ui.js',
    '/js/auth.js',
    '/js/cloud-sync.js',
    '/js/firebase-bridge.js',
    '/js/firebase-config.js',
    '/js/input-parser.js',
    '/js/bulk-entry.js',
    '/js/mobile-nav.js'
];

// Install: cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch: stale-while-revalidate for static assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests and external requests
    if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }

    // Skip Firebase/API requests (let them go to network)
    if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) {
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    // Update cache with fresh response
                    if (networkResponse.ok) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    // Network failed, return cached if available
                    return cachedResponse;
                });

                // Return cached immediately, update in background
                return cachedResponse || fetchPromise;
            });
        })
    );
});
