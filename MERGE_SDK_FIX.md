# Merge Link SDK Loading Fix

## Issue Identified
The Merge Link SDK was not loading correctly using the npm CDN URL.

## What Was Changed

### 1. Updated SDK Script URL
**File:** `/app/frontend/public/index.html`

**Old (not working):**
```html
<script src="https://cdn.jsdelivr.net/npm/@mergeapi/merge-link@2/dist/merge-link.min.js"></script>
```

**New (official Merge CDN):**
```html
<script src="https://production-cdn.merge.dev/initialize.js"></script>
```

### 2. Updated SDK Initialization
**File:** `/app/frontend/src/pages/Integrations.js`

**Old API (not working):**
```javascript
window.MergeLink.openLink(link_token, callbacks)
```

**New API (correct):**
```javascript
const mergeLink = window.Merge.link({
  linkToken: link_token,
  onSuccess: (public_token) => { ... },
  onExit: () => { ... },
  onError: (error) => { ... }
});

mergeLink.openLink();
```

## Why This Fixes It

1. **Official CDN:** Using Merge.dev's production CDN ensures the SDK loads correctly
2. **Correct API:** The official API uses `window.Merge.link()` not `window.MergeLink.openLink()`
3. **Proper Initialization:** Creates an instance first, then calls `openLink()`

## Testing Instructions

1. Log in to the app
2. Go to /integrations page
3. Open browser console (F12)
4. Click "Connect via Merge"
5. You should now see:
   ```
   ✅ Initializing Merge Link...
   ✅ Merge Link modal opened
   ```
6. The Merge Link modal should appear

## Expected Console Output (Fixed)

```
🔗 Opening Merge Link...
✅ Session validated, requesting link token...
✅ Link token received: lt_xxxxx
✅ Initializing Merge Link...
✅ Merge Link modal opened
[User completes flow]
✅ Merge Link Success!
📦 Public Token: [token]
```

No more "MergeLink SDK not loaded" error!

## Verification

To verify the SDK is loaded, in browser console type:
```javascript
console.log(window.Merge)
```

Should return an object with the Merge SDK methods.
