/* BIQC Service Worker - PWA Offline Support */
/* API routes (/api/*) are EXCLUDED — they must never be cached or intercepted */

const CACHE_NAME = 'biqc-v5-20260211-api-fix';
const urlsToCache = [
  '/',
  '/manifest.json'
];

// Install - cache critical assets only
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate - clean ALL old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch - NEVER intercept API calls
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls go directly to network — no caching, no interception
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/api')) {
    return;
  }

  // Only cache same-origin navigation/asset requests
  if (url.origin !== location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200 && event.request.method === 'GET') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
