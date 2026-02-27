# BIQc Mobile Rendering Forensic Audit
## Date: 27 February 2026
## Devices Tested: iPhone SE (375px), iPhone 14 Pro (390px), Small Android (320px)
## Pages: Homepage, Blog, Pricing, Knowledge Base, Login, Register

---

## SECTION 1 — Executive Verdict

**Mobile Experience Grade: C**
- Critical Risk Count: **4**
- High Risk Count: **6**
- Medium Risk Count: **5**

### Top 3 Structural Issues:
1. **CRITICAL: Homepage hero heading invisible/clipped** — "Run Your Business Like The" text is nearly invisible against dark background at mobile sizes. Only "Big Players" (orange) is readable. Main value proposition lost.
2. **CRITICAL: Pricing page has massive empty space** — First fold is 60%+ blank space before any content appears. Heading invisible. User sees nothing actionable above fold.
3. **HIGH: Login/Register logo layout broken** — Orange logo block is oversized (full-width bar) with text "BIQc powered by The Strategy Squad" wrapping awkwardly beside it instead of stacking properly.

---

## SECTION 2 — Typography Report

### Findings

| Issue | Page | Severity | Detail |
|-------|------|----------|--------|
| Hero heading invisible | Homepage | CRITICAL | "Run Your Business Like The" renders in very low contrast gray on dark bg. Not readable at 375px. Only orange "Big Players" visible |
| Knowledge Base title missing | KB | HIGH | "Knowledge Base" heading not visible in first fold — starts with subtitle only |
| Pricing heading invisible | Pricing | CRITICAL | Page heading not visible above fold. 60% empty space before text appears |
| Blog heading hierarchy correct | Blog | LOW | "INTELLIGENCE BLOG" + subtitle readable. Good spacing |
| Login heading low contrast | Login | MEDIUM | "Sign in to your sovereign..." readable but mono font at small size (12px effective) strains readability |
| Body text line-height adequate | All | PASS | Body text at ~1.5 line-height. Readable |
| Character count per line | All | PASS | Under 45 characters at 375px. Good for mobile |

### Readability Score: 55/100
### Typography Risk: HIGH

### CSS Fixes Required:
```css
/* Fix 1: Homepage hero heading visibility */
@media (max-width: 640px) {
  .hero-heading { color: #F4F7FA !important; font-size: 28px; }
}

/* Fix 2: Pricing page heading */
@media (max-width: 640px) {
  .pricing-hero { padding-top: 24px; min-height: auto; }
  .pricing-heading { font-size: 24px; color: #F4F7FA; }
}

/* Fix 3: Login branding layout */
@media (max-width: 640px) {
  .login-logo { width: 56px; height: 56px; border-radius: 16px; }
  .login-brand-text { text-align: center; }
}
```

---

## SECTION 3 — Alignment & Grid Report

### Findings

| Issue | Page | Severity |
|-------|------|----------|
| Blog category buttons stack vertically instead of horizontal scroll | Blog | MEDIUM — functional but wastes vertical space |
| Knowledge Base quick nav grid 2-col works at 375px | KB | PASS |
| Stats bar 5-col overflows at 320px | Homepage | HIGH — stats row wraps poorly below 360px |
| Login logo oversized orange bar (full width) | Login/Register | HIGH — should be 56x56 icon, not 150px wide bar |
| Consistent left padding (16px) | All pages | PASS |
| No horizontal scroll detected | All pages | PASS |

### Alignment Integrity Score: 65/100
### Layout Drift: MEDIUM

### Grid Fix:
```css
/* Stats bar: change to 2-col + scroll at mobile */
@media (max-width: 640px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; }
}

/* Blog categories: horizontal scroll */
.blog-categories { display: flex; overflow-x: auto; flex-wrap: nowrap; }
.blog-categories button { flex-shrink: 0; }
```

---

## SECTION 4 — Layer Collision Map

| Issue | Page | Severity |
|-------|------|----------|
| Background grid/mesh pattern renders over hero text | Homepage | HIGH — reduces text readability. Grid lines visible through heading |
| No z-index conflicts in card stacking | All | PASS |
| Hamburger menu positioned correctly | All | PASS |
| No floating button occlusion | All | PASS |
| No toast/notification collisions | All | PASS |

### Collision Count: 1
### Fix: Add `position: relative; z-index: 1;` to hero text container to render above background mesh.

---

## SECTION 5 — Scroll & Behaviour

| Issue | Page | Severity |
|-------|------|----------|
| Pricing page requires excessive scroll before content | Pricing | HIGH — first fold is nearly empty |
| Blog page scroll smooth | Blog | PASS |
| KB page scroll stable | KB | PASS |
| Homepage scroll smooth | Homepage | PASS |
| No scroll jump detected | All | PASS |
| No nested scroll conflicts | All | PASS |

### Scroll Stability Score: 80/100
### Fix: Reduce pricing hero min-height on mobile to `auto`

---

## SECTION 6 — Touch & Accessibility

| Issue | Page | Severity |
|-------|------|----------|
| "Try It For Free" CTA: 48px height, full width | Homepage | PASS — excellent tap target |
| Blog search input: 48px height | Blog | PASS |
| Blog category buttons: adequate size | Blog | PASS |
| Hamburger menu: 44px tap zone | All | PASS |
| Login inputs: 48px height | Login | PASS |
| KB quick nav icons: ~80px tap zones | KB | PASS |
| Stats numbers (40%, 50%, etc) are not tappable — correct | Homepage | PASS |

### Touch Compliance Score: 90/100
### Mis-Tap Risk: LOW

---

## SECTION 7 — Cognitive Load Analysis

| Issue | Page | Severity |
|-------|------|----------|
| Homepage: invisible heading = no focal point above fold | Homepage | CRITICAL — user has no idea what the product is |
| Blog: clear hierarchy, search visible, categories stacked | Blog | LOW |
| Pricing: blank space creates confusion | Pricing | HIGH — user thinks page is broken |
| KB: quick nav visible but title missing | KB | MEDIUM |
| Login: branding layout distracts from auth form | Login | MEDIUM |
| Register: same logo issue as login | Register | MEDIUM |

### Cognitive Load Score: 50/100
### Visual Clarity Index: LOW (homepage + pricing drag score down)

---

## SECTION 8 — Performance Impact Summary

| Metric | Estimated |
|--------|-----------|
| First Contentful Paint | ~1.8s (background mesh loads first) |
| Largest Contentful Paint | ~2.5s (hero text renders late) |
| CLS (Layout Shift) | Low — no major shifts detected |
| Background mesh rendering | Adds ~200KB of SVG/gradient computation |

### Mobile Performance Score: 70/100
### Layout Stability: GOOD

---

## SECTION 9 — Required Remediation Sprint

### Priority Order:

**1. CRITICAL: Fix homepage hero heading visibility (mobile)**
- Make "Run Your Business Like The" visible (#F4F7FA)
- Reduce hero section padding on mobile
- Ensure heading renders above mesh grid
- Effort: LOW (CSS only)

**2. CRITICAL: Fix pricing page empty space**
- Reduce hero min-height on mobile
- Move heading + subtitle into first fold
- Effort: LOW (CSS only)

**3. HIGH: Fix login/register logo layout**
- Change orange logo from full-width bar to 56x56 centered icon
- Stack "BIQc" + "powered by The Strategy Squad" below icon, centered
- Effort: LOW (CSS only)

**4. HIGH: Fix homepage stats grid at 320px**
- Switch from 5-col to 2-col grid below 640px
- Or use horizontal scroll with snap points
- Effort: LOW (CSS only)

**5. HIGH: Fix mesh/grid background bleeding through text**
- Add z-index layering or reduce mesh opacity on mobile
- Effort: LOW (CSS only)

### Estimated Engineering Effort: LOW
All 5 fixes are CSS-only. No structural changes required.
No component rewrites needed.
No backend changes.
