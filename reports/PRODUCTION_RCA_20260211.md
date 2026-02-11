# ROOT CAUSE ANALYSIS: Production API Failure
## Date: 2026-02-11
## Site: beta.thestrategysquad.com

---

## SYMPTOM
All API calls from the browser return HTML (`<!doctype html>`) instead of JSON.
- Calibration check → HTML → fail-open to READY
- Watchtower positions → HTML → "No intelligence events"
- Board Room respond → HTML → "Intelligence link disrupted"
- Strategic Console → HTML → "SIGNAL DISRUPTION"

## PROOF: Backend is healthy
```
curl beta.thestrategysquad.com/api/health            → 200 JSON ✅
curl beta.thestrategysquad.com/api/calibration/status → 401 JSON ✅
curl beta.thestrategysquad.com/api/watchtower/positions → 403 JSON ✅
```
Backend returns correct JSON for ALL routes. The issue is browser-only.

## ROOT CAUSE: Service Worker Intercepting API Calls

### The old service-worker.js (deployed on production):
```javascript
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // PROBLEM: Caches ALL responses, including API calls
        cache.put(event.request, responseToCache);
        return response;
      })
      .catch(() => {
        // PROBLEM: Returns cached HTML for API URLs when network fails
        return caches.match(event.request);
      })
  );
});
```

### What happens:
1. Service Worker (SW) intercepts ALL fetch requests — including `/api/*` calls
2. If SW's own `fetch()` fails (timing, network issue during page transition), 
   it falls back to `caches.match()` which returns cached SPA HTML (`index.html`)
3. The browser receives `200 OK` with `text/html` content type
4. JavaScript tries `response.json()` → SyntaxError: `<!doctype` is not JSON
5. ALL features break: Watchtower, Board Room, Calibration, Integrations

### Why curl works but browser doesn't:
- curl → direct HTTP request → hits the backend → JSON response ✅
- browser → Service Worker intercept → stale cache or failed re-fetch → HTML ❌

### Why clearing cache doesn't fix it:
- Clearing browser cache does NOT unregister Service Workers
- The SW persists until explicitly unregistered or replaced
- The App.js code unregisters + re-registers on load, but the OLD SW 
  controls the page during that first load cycle

## FIX APPLIED (in preview environment)

### 1. service-worker.js — API routes excluded
```javascript
self.addEventListener('fetch', (event) => {
  // API calls go directly to network — NEVER intercepted
  if (url.pathname.startsWith('/api/')) {
    return;  // Browser handles it normally
  }
  // Only cache static assets...
});
```

### 2. Content-Type guards on all fetch calls
Before calling `response.json()`, now checks:
```javascript
const contentType = res.headers.get('content-type') || '';
if (res.ok && contentType.includes('application/json')) {
  const data = await res.json(); // Safe
} else {
  // Fail-open, never crash
}
```

### 3. Accept header on all API calls
```javascript
headers: { 'Accept': 'application/json' }
```

## DEPLOYMENT STATUS

| Change | Preview Environment | Production |
|--------|-------------------|------------|
| Service Worker fix (exclude /api/*) | ✅ Applied | ❌ NOT YET DEPLOYED |
| Content-Type guards | ✅ Applied | ❌ NOT YET DEPLOYED |
| Calibration routing fix | ✅ Applied | ✅ DEPLOYED (logs visible) |
| Priority Compression UX | ✅ Applied | ✅ DEPLOYED (layout visible) |

## IMMEDIATE ACTION REQUIRED

1. **Deploy the latest build** (includes service worker fix)
2. After deploy, hard refresh the site (Ctrl+Shift+R)
3. If still broken: DevTools → Application → Service Workers → Unregister → Refresh

## WHY INTEGRATIONS DATA ISN'T SHOWING

The Watchtower shows "No intelligence events yet" and "Connect your email" because:
1. ALL API calls fail (SW serves HTML) — so even if data exists, it can't be fetched
2. Once the SW fix is deployed and API calls work, integration data should flow through
3. The Watchtower needs to run analysis first: click "Run Analysis" after API calls are working
