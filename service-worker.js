// InvoiceKit Service Worker
// Place this file at the ROOT of your project (same level as index.html)

const CACHE_NAME = 'invoicekit-v1';
const OFFLINE_URL = '/index.html';

// Core files to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  // External CDN files (cached on first fetch)
];

// ─── Install: pre-cache core assets ───────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching core assets');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Activate new SW immediately without waiting
  self.skipWaiting();
});

// ─── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// ─── Fetch: Network-first with cache fallback ──────────────────────────────────
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and browser extensions
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // For navigation requests (page loads), serve from cache if offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache fresh page responses
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Offline: serve cached index.html
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // For all other requests: Cache-first (fast), then update cache in background
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached version immediately if available
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // Only cache valid responses from our origin or trusted CDNs
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === 'basic' || networkResponse.type === 'cors')
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse); // Network failed, return whatever we have

      return cachedResponse || fetchPromise;
    })
  );
});
