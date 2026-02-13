/* ═══ OPERATION CACHE KILL — SELF-DESTRUCT SERVICE WORKER ═══ */
/* This file exists ONLY to kill itself and destroy all caches. */
/* It MUST NOT cache anything. It MUST NOT intercept any requests. */

self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    Promise.all([
      caches.keys().then(function(names) {
        return Promise.all(names.map(function(n) { return caches.delete(n); }));
      }),
      self.clients.claim(),
      self.registration.unregister()
    ])
  );
});

// CRITICAL: Never intercept fetches. Pass everything to network.
self.addEventListener('fetch', function() {
  // No-op — network only
});
