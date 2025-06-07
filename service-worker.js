// PWA/service-worker.js

self.addEventListener('install', event => {
  console.log('ServiceWorker: Install event - no caching, just skipWaiting');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  console.log('ServiceWorker: Activate event - claiming clients and cleaning old Fangkalender caches');
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.filter(cacheName => {
            // Be specific to avoid deleting caches from other apps/PWAs
            return cacheName.startsWith('fangkalender-');
          }).map(cacheName => {
            console.log('ServiceWorker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
    ])
  );
});

// No fetch event listener, so all requests go directly to the network.
// No message event listener as it was for cache management.

console.log('ServiceWorker: Minimal worker for installability, no offline caching.');
