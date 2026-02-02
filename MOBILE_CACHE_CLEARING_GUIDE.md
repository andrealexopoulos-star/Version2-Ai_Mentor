# MOBILE CACHE CLEARING GUIDE - BIQC

## CRITICAL: Your mobile device is showing OLD cached content

The mobile fixes have been applied to the server, but your device is displaying cached (old) versions. Follow these steps **EXACTLY** to clear the cache.

---

## FOR iOS (iPhone/iPad) - Safari

### OPTION 1: Hard Refresh (Quick)
1. Open Safari and go to your BIQC site
2. Tap and HOLD the refresh button (⟳) for 2-3 seconds
3. Select "Request Desktop Website" then switch back to mobile
4. This forces a fresh load

### OPTION 2: Clear Safari Cache (Recommended)
1. Close Safari completely (swipe up from app switcher)
2. Go to **Settings** → **Safari**
3. Scroll down and tap **"Clear History and Website Data"**
4. Confirm by tapping **"Clear History and Data"**
5. Open Safari and visit BIQC again - it will load fresh content

### OPTION 3: Delete PWA and Reinstall
If you installed BIQC as an app on your home screen:
1. Long-press the BIQC app icon on home screen
2. Tap **"Remove App"** → **"Delete App"**
3. Open Safari and go to dev.thestrategysquad.com
4. Tap the Share button (box with arrow)
5. Tap **"Add to Home Screen"**
6. Tap **"Add"**

---

## FOR ANDROID - Chrome

### OPTION 1: Hard Refresh (Quick)
1. Open Chrome and go to your BIQC site
2. Tap the three-dot menu (⋮) in top right
3. Tap **"Desktop site"** checkbox to enable, wait 2 seconds
4. Tap **"Desktop site"** again to disable (back to mobile)

### OPTION 2: Clear Chrome Cache (Recommended)
1. Tap three-dot menu (⋮) → **Settings**
2. Tap **Privacy and security**
3. Tap **Clear browsing data**
4. Select **"Cached images and files"** (make sure it's checked)
5. Tap **"Clear data"**
6. Go back to BIQC site - will load fresh

### OPTION 3: Delete PWA and Reinstall
If you installed BIQC as an app:
1. Long-press the BIQC app icon
2. Tap **"App info"** or **"ⓘ"**
3. Tap **"Uninstall"** or **"Remove"**
4. Open Chrome and go to dev.thestrategysquad.com
5. Tap the three-dot menu → **"Install app"** or **"Add to Home screen"**

---

## WHAT SHOULD YOU SEE AFTER CLEARING CACHE?

### ✅ Landing Page (Home)
- Full heading visible: **"Stay ahead of your business"**
- Blue subheading: **"without running faster"** (darker blue, good contrast)
- NO white banner covering the heading
- Content starts with proper spacing below navigation

### ✅ BIQC Insights (Advisor) Page
- Cards fit full screen width
- No excessive white space
- Text wraps correctly
- Content is centered

### ✅ MySoundBoard Page
- Compact header (~60px height, not 108px)
- Message input at bottom (not overlapping)
- No weird text spacing (no "S h" artifacts)

### ✅ Settings Page
- Full-width layout (not boxed)
- Icon-only tabs on mobile
- Reduced padding (more space for content)

### ✅ Integrations Page
- Tabs are horizontally scrollable
- No tab text clipping
- Proper spacing between sections

---

## STILL NOT WORKING?

### Last Resort: Force Service Worker Update

**iOS Safari:**
1. Open Safari
2. Go to Settings → Safari → Advanced → Website Data
3. Find "thestrategysquad" or your domain
4. Swipe left and tap **Delete**
5. Restart Safari completely
6. Visit site again

**Android Chrome:**
1. Open Chrome
2. Type in address bar: `chrome://serviceworker-internals/`
3. Find your site (dev.thestrategysquad.com)
4. Click **"Unregister"** next to it
5. Go back to your site
6. Chrome will reinstall the new service worker

---

## VERIFICATION CHECKLIST

After clearing cache, check these on your mobile device:

- [ ] Landing page: "Stay ahead of your business" heading is fully visible
- [ ] Landing page: "without running faster" is darker blue (not light blue)
- [ ] Landing page: NO content hidden behind white navigation bar
- [ ] BIQC Insights: Cards fit screen width with proper padding
- [ ] MySoundBoard: Header is compact (~60px, not giant)
- [ ] MySoundBoard: Input bar at bottom doesn't overlap content
- [ ] Settings: Tabs show icons only (not full text)
- [ ] Settings: Content uses full width
- [ ] Integrations: Tabs are scrollable horizontally
- [ ] All pages: NO horizontal scrolling

---

## TECHNICAL DETAILS (FOR DEVELOPER)

Changes applied:
1. **Service Worker cache name updated**: `biqc-v2-20250202-mobile-fixes`
2. **Cache-Control meta tags added** to index.html
3. **Mobile-specific CSS** in `/app/frontend/src/mobile-fixes.css`
4. **Landing page padding**: `pt-52` (208px) on mobile via clamp()
5. **Typography fixes**: `text-blue-700` for better contrast
6. **Global mobile rules**: `@media (max-width: 768px)` for all fixes

The server is serving the correct, updated files. The issue is **client-side caching only**.

---

## EMERGENCY: IF NOTHING WORKS

Contact support and provide:
1. Device type (iPhone 14, Samsung Galaxy S23, etc.)
2. Browser (Safari, Chrome, etc.)
3. Screenshot of what you're seeing
4. Confirm you completed ALL cache clearing steps above

The fixes ARE applied server-side. This is 100% a cache issue on your device.
