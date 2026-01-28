# Mobile-First Advisor Page Checklist
## For: https://biqc-connect.preview.emergentagent.com/advisor

---

## ✅ CRITICAL CHECKS BEFORE IMPLEMENTATION

### 1. **HEADER & NAVIGATION** (DashboardLayout.js)

**Mobile Requirements (320px - 768px):**
- [ ] Header height: 56px (3.5rem) on mobile, 64px (4rem) on tablet/desktop
- [ ] Hamburger menu button: Visible only on mobile (<768px), min 44px touch target
- [ ] Logo size: 32px on mobile, 36px on desktop
- [ ] Avatar: 32px on mobile, 36px on desktop
- [ ] Navigation icons: Hidden on small screens, visible on desktop
- [ ] Search bar: Hidden on mobile (<768px), visible on desktop
- [ ] Proper spacing: `gap-2` on mobile, `gap-4` on desktop

**Desktop Requirements (>768px):**
- [ ] Header height: 64px (no change)
- [ ] Hamburger menu: Hidden
- [ ] Sidebar: Always visible, fixed position
- [ ] All icons visible
- [ ] Search bar visible
- [ ] Current layout preserved exactly

**Sidebar Menu:**
- [ ] Opens/closes with hamburger on mobile
- [ ] Smooth transition (300ms)
- [ ] Backdrop overlay on mobile (with blur effect)
- [ ] Auto-closes when navigation item clicked
- [ ] Scrollable content with iOS momentum scrolling
- [ ] Touch targets minimum 48px height
- [ ] Fixed position on desktop (always visible)

---

### 2. **ADVISOR PAGE LAYOUT** (Advisor.js)

**Mobile Viewport Height:**
- [ ] Container height: `h-[calc(100vh-3.5rem)]` on mobile (accounts for 56px header)
- [ ] Container height: `h-[calc(100vh-4rem)]` on desktop (accounts for 64px header)
- [ ] NO use of fixed `100vh` (causes mobile browser clipping)

**Header Section:**
- [ ] Padding: `px-3 py-3` on mobile, `px-6 py-4` on desktop
- [ ] Title: `text-xl` on mobile, `text-2xl` on desktop
- [ ] Subtitle: `text-xs` on mobile, `text-sm` on desktop
- [ ] "New Session" button: Icon-only on mobile, icon+text on desktop
- [ ] Button height: `h-9` on mobile, `h-10` on desktop
- [ ] Text truncation on long titles with `truncate` class

**Chat Messages Area:**
- [ ] Flex-1 to fill available space
- [ ] Overflow-y-auto for scrolling
- [ ] iOS momentum scrolling enabled
- [ ] Proper padding: `px-3` on mobile, `px-6` on desktop
- [ ] Message bubbles: Max-width 85% on mobile
- [ ] Font size: 15-16px on mobile (prevents iOS zoom)

**Chat Input Area:**
- [ ] Sticky to bottom
- [ ] Padding: `p-3` on mobile, `p-6` on desktop
- [ ] Textarea min-height: 44px (touch-friendly)
- [ ] Textarea font-size: 16px (prevents iOS zoom on focus)
- [ ] Send button: Min 44px x 44px touch target
- [ ] Safe area padding for iPhone home indicator

**Focus Area Cards (Initial State):**
- [ ] Grid layout: 1 column on mobile, 2 columns on desktop
- [ ] Horizontal scroll on mobile (optional enhancement)
- [ ] Card width: Full width on mobile, auto on desktop
- [ ] Touch-friendly spacing: 12px gaps

---

### 3. **CSS REQUIREMENTS**

**Mobile-Specific Styles Needed:**
```css
@media (max-width: 768px) {
  /* Touch interactions */
  .touch-manipulation {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    min-width: 44px;
    min-height: 44px;
  }
  
  /* Prevent iOS zoom */
  input, textarea {
    font-size: 16px !important;
  }
  
  /* Smooth scrolling */
  .overflow-y-auto {
    -webkit-overflow-scrolling: touch;
  }
  
  /* Safe area support */
  .chat-input {
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
  }
}
```

**Desktop Preservation:**
```css
@media (min-width: 769px) {
  /* All existing desktop styles remain unchanged */
  /* No mobile CSS affects desktop */
}
```

---

### 4. **RESPONSIVE BREAKPOINTS**

**Tailwind Classes to Use:**
- `sm:` - ≥640px (small tablets)
- `md:` - ≥768px (tablets)
- `lg:` - ≥1024px (desktop)

**Example Pattern:**
```jsx
// Mobile first, then scale up
className="text-sm sm:text-base md:text-lg"
className="p-3 sm:p-4 md:p-6"
className="h-9 sm:h-10 md:h-11"
```

---

### 5. **TOUCH INTERACTION REQUIREMENTS**

**All Interactive Elements:**
- [ ] Minimum 44px x 44px (Apple/Google guidelines)
- [ ] `touch-action: manipulation` to prevent double-tap zoom
- [ ] Remove `-webkit-tap-highlight-color` for cleaner interaction
- [ ] Adequate spacing between elements (minimum 8px)

**Buttons:**
- [ ] Use `touch-manipulation` class
- [ ] Add `aria-label` for screen readers
- [ ] Visual feedback on press (active states)

**Links:**
- [ ] Minimum height 44px
- [ ] Adequate padding around text
- [ ] Clear visual distinction

---

### 6. **VIEWPORT & OVERFLOW HANDLING**

**Critical Checks:**
- [ ] NO `overflow: hidden` on body (prevents scrolling)
- [ ] NO `position: fixed` on body (causes layout shift)
- [ ] Use `100dvh` or `100svh` instead of `100vh` for mobile
- [ ] Enable `overscroll-behavior: contain` on scrollable areas
- [ ] Prevent horizontal scroll with `overflow-x: hidden` on body only

**Height Calculation:**
```jsx
// WRONG - Clips content on mobile
<div className="h-screen" /> // Uses fixed 100vh

// RIGHT - Accounts for browser UI
<div className="h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)]" />
```

---

### 7. **TESTING CHECKLIST**

**Before Deployment:**
- [ ] Test on Chrome DevTools mobile emulation
- [ ] Test on actual iPhone (Safari)
- [ ] Test on actual Android (Chrome)
- [ ] Test on tablet (iPad/Android tablet)
- [ ] Test on desktop (1440px+)

**Screen Sizes to Test:**
- [ ] 320px (iPhone SE)
- [ ] 360px (Small Android)
- [ ] 375px (iPhone 12/13)
- [ ] 390px (iPhone 14)
- [ ] 428px (iPhone 14 Pro Max)
- [ ] 768px (iPad portrait)
- [ ] 1024px (iPad landscape)
- [ ] 1440px (Desktop)

**Functionality to Verify:**
- [ ] Hamburger menu opens/closes
- [ ] All navigation links work
- [ ] Chat input is accessible (not hidden)
- [ ] Text is readable without zooming
- [ ] No horizontal scrolling
- [ ] Buttons are easy to tap
- [ ] Layout doesn't shift/jump
- [ ] Desktop layout unchanged

---

### 8. **ACCESSIBILITY REQUIREMENTS**

**Mobile Accessibility:**
- [ ] All buttons have `aria-label` attributes
- [ ] Touch targets minimum 44px
- [ ] Color contrast ratio ≥4.5:1
- [ ] Focus indicators visible
- [ ] Support for screen readers
- [ ] Support for reduced motion (`prefers-reduced-motion`)
- [ ] Support for high contrast mode
- [ ] Keyboard navigation works

---

### 9. **PERFORMANCE CHECKS**

**Mobile Performance:**
- [ ] CSS file size <50KB
- [ ] No large images in header
- [ ] Smooth 60fps animations
- [ ] Fast tap response (<100ms)
- [ ] No layout shift (CLS score)

---

### 10. **BACKEND PRESERVATION CHECKLIST**

**MUST NOT CHANGE:**
- [ ] Any API endpoints
- [ ] Any route handlers
- [ ] Any authentication logic
- [ ] Any Supabase queries
- [ ] Any database operations
- [ ] Any state management
- [ ] Any event handlers (onClick, onChange, etc.)
- [ ] Any variable names
- [ ] Any function names
- [ ] Any IDs or data attributes

**ONLY CHANGE:**
- [ ] Tailwind CSS classes
- [ ] Inline styles
- [ ] CSS files
- [ ] HTML structure for responsive layout
- [ ] Aria labels (for accessibility)

---

## 🎯 IMPLEMENTATION STEPS

### Step 1: Backup Current Code
```bash
git add .
git commit -m "Backup before mobile-first implementation"
```

### Step 2: Update DashboardLayout.js
- Add responsive header classes
- Add responsive sidebar positioning
- Add responsive main content padding
- Import new mobile CSS file

### Step 3: Update Advisor.js
- Add responsive container height
- Add responsive header padding
- Add responsive typography
- Add responsive button sizing

### Step 4: Create Mobile CSS File
- Create `/app/frontend/src/mobile-header-fixes.css`
- Add touch interaction styles
- Add safe area support
- Add iOS-specific fixes

### Step 5: Test Each Breakpoint
- Test 320px, 375px, 390px, 428px
- Test 768px, 1024px, 1440px
- Verify no regressions

### Step 6: Verify Compilation
```bash
# Check for errors
yarn build

# Check browser console
# Should have no errors
```

---

## ⚠️ COMMON PITFALLS TO AVOID

1. **Using `100vh`**
   - ❌ Wrong: `height: 100vh`
   - ✅ Right: `height: calc(100vh - 3.5rem)` on mobile

2. **Fixed positioning everywhere**
   - ❌ Wrong: `position: fixed` on body
   - ✅ Right: Only on header and sidebar

3. **Overflow hidden on wrong elements**
   - ❌ Wrong: `overflow: hidden` on body
   - ✅ Right: Only on modal backdrops

4. **Forgetting safe area insets**
   - ❌ Wrong: Fixed bottom padding
   - ✅ Right: `padding-bottom: env(safe-area-inset-bottom)`

5. **Touch targets too small**
   - ❌ Wrong: 24px buttons
   - ✅ Right: 44px+ minimum

6. **Breaking desktop layout**
   - ❌ Wrong: Mobile-first without desktop preservation
   - ✅ Right: Mobile styles only apply <768px

---

## ✅ DEFINITION OF DONE

- [ ] All items in this checklist verified
- [ ] No console errors
- [ ] Successful compilation
- [ ] Mobile: Header compact, menu works, chat accessible
- [ ] Desktop: Layout unchanged, all features work
- [ ] Tested on 8+ screen sizes
- [ ] Touch interactions smooth
- [ ] No horizontal scroll
- [ ] Backend logic untouched
- [ ] Documentation created

---

## 📊 SUCCESS METRICS

**Mobile:**
- Header height: 56px ✅
- Touch targets: 44px+ ✅
- Chat input visible ✅
- No layout shift ✅
- Smooth scrolling ✅

**Desktop:**
- Header height: 64px ✅
- Sidebar visible ✅
- Layout identical ✅
- All features work ✅
- No regressions ✅

---

**When all checkboxes are complete, the Advisor page will be mobile-first without affecting desktop.**
