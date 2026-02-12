/* BIQC Service Worker — SELF-DESTRUCT */
/* This service worker unregisters itself immediately. */
/* API caching bugs made service workers incompatible with this application. */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clear ALL caches
      caches.keys().then(names => Promise.all(names.map(n => caches.delete(n)))),
      // Take control
      self.clients.claim(),
      // Unregister self
      self.registration.unregister()
    ])
  );
});

// NEVER intercept any fetch — pass everything through to network
self.addEventListener('fetch', () => {
  // No-op — let the browser handle all fetches directly
});
