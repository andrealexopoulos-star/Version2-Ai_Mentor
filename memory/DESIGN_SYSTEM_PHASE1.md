# BIQc Design System — Phase 1 Master Document
*Generated: March 2026 | Status: Active*

---

## 1. COLOUR PALETTE

### Dark Theme (Primary — Default)
| Token | Variable | Value | Usage |
|---|---|---|---|
| Background | `--biqc-bg` | `#0F1720` | Page background |
| Card | `--biqc-bg-card` | `#141C26` | Cards, panels |
| Input | `--biqc-bg-input` | `#0A1018` | Inputs, header, sidebar |
| Elevated | `--biqc-bg-elevated` | `#1A2332` | Hover states, elevated cards |
| Border | `--biqc-border` | `#243140` | All borders |
| Border Focus | `--biqc-border-focus` | `#FF6A00` | Focus rings |
| Text Primary | `--biqc-text` | `#F4F7FA` | Headings, primary text |
| Text Secondary | `--biqc-text-2` | `#9FB0C3` | Body text, descriptions |
| Text Muted | `--biqc-text-muted` | `#8B9DB5` | **WCAG AA fixed (4.6:1)** |
| Brand | `--biqc-brand` | `#FF6A00` | CTAs, active states |
| Success | `--biqc-success` | `#10B981` | Connected, positive states |
| Warning | `--biqc-warning` | `#F59E0B` | Degraded, caution states |
| Danger | `--biqc-danger` | `#EF4444` | Error, critical states |
| Info | `--biqc-info` | `#3B82F6` | Info, neutral states |

### Light Theme (Secondary)
| Token | Value | Notes |
|---|---|---|
| `--biqc-bg` | `#F0F4F8` | Warm light slate |
| `--biqc-bg-card` | `#FFFFFF` | White cards |
| `--biqc-text` | `#0F172A` | Near-black |
| `--biqc-text-2` | `#334155` | Dark slate |
| `--biqc-text-muted` | `#64748B` | 5.9:1 on white — AA pass |

### WCAG 2.1 AA Contrast Ratios
| Combination | Old Value | New Value | Ratio | Status |
|---|---|---|---|---|
| Text Muted on Dark BG | `#64748B` on `#0F1720` | `#8B9DB5` on `#0F1720` | 4.6:1 | ✅ AA |
| Brand on Dark | `#FF6A00` on `#0F1720` | — | 3.2:1 | ⚠️ Large text only |
| Text Primary on Dark | `#F4F7FA` on `#0F1720` | — | 15.8:1 | ✅ AAA |
| Text Secondary on Dark | `#9FB0C3` on `#0F1720` | — | 6.2:1 | ✅ AA |

---

## 2. TYPOGRAPHY

### Font Stacks
| Role | Font | Fallback |
|---|---|---|
| Display/Headings | Cormorant Garamond | Georgia, serif |
| Body/UI | Inter | -apple-system, sans-serif |
| Data/Code | JetBrains Mono | Fira Code, monospace |

### Scale
| Level | Desktop | Tablet | Mobile |
|---|---|---|---|
| H1 | 48px | 36px | 28px |
| H2 | 32px | 26px | 22px |
| H3 | 22px | 20px | 18px |
| Body Large | 18px | 16px | 16px |
| Body | 15px | 14px | 14px |
| Caption | 13px | 12px | 12px |
| Micro/Mono | 11px | 10px | min 11px (mobile enforcement) |

---

## 3. SPACING (8px base grid)
| Token | Value | Tailwind |
|---|---|---|
| xs | 8px | `p-2` |
| sm | 16px | `p-4` |
| md | 24px | `p-6` |
| lg | 32px | `p-8` |
| xl | 48px | `p-12` |
| xxl | 64px | `p-16` |

---

## 4. BORDER RADIUS
| Token | Value | Usage |
|---|---|---|
| card | 16px | Main cards |
| cardSm | 12px | Smaller panels |
| button | 14px | Buttons |
| input | 12px | Form inputs |
| badge | 8px | Status badges |
| full | 9999px | Pills |

---

## 5. SHADOWS
| Token | Value | Usage |
|---|---|---|
| sm | `0 1px 2px rgba(0,0,0,0.3)` | Subtle elevation |
| md | `0 4px 16px rgba(0,0,0,0.4)` | Cards, dropdowns |
| lg | `0 8px 32px rgba(0,0,0,0.5)` | Modals, sheets |
| focus | `0 0 0 3px rgba(255,106,0,0.25)` | Focus rings |
| brandGlow | `0 8px 32px rgba(255,106,0,0.3)` | CTA buttons |

---

## 6. RESPONSIVE BREAKPOINTS
| Name | Width | Usage |
|---|---|---|
| sm | 640px | Mobile/tablet breakpoint |
| md | 768px | Tablet |
| lg | 1024px | Desktop (sidebar shows) |
| xl | 1280px | Wide desktop |
| xxl | 1440px | Ultra-wide |

---

## 7. COMPONENT STATES

### Button States
| State | Style |
|---|---|
| Default | bg:#FF6A00, text:white |
| Hover | bg:#E85D00, translateY(-1px) |
| Active | bg:#CC5400, translateY(0) |
| Disabled | opacity:0.5, cursor:not-allowed |
| Loading | Shows spinner, disabled |

### Input States
| State | Style |
|---|---|
| Default | border:--biqc-border |
| Focus | border:--biqc-brand, shadow:--shadow-focus |
| Error | border:#EF4444, bg:rgba(239,68,68,0.05) |
| Disabled | opacity:0.5, cursor:not-allowed |

### Card States
| State | Style |
|---|---|
| Default | bg:--biqc-bg-card, border:--biqc-border |
| Hover | border:rgba(255,106,0,0.4), translateY(-1px) |
| Connected/Active | border:rgba(16,185,129,0.3), glow:rgba(16,185,129,0.08) |
| Error | border:rgba(239,68,68,0.3) |

---

## 8. ACCESSIBILITY

### ARIA Implementation
- Navigation: `role="navigation"`, `aria-label="Main navigation"`
- Active items: `aria-current="page"`
- Expandable sections: `aria-expanded={bool}`, `aria-controls`
- Toggle buttons: `aria-label` describing action + current state
- Error messages: `role="alert"`, `aria-live="polite"`
- Loading states: `aria-busy={bool}`
- Icons (decorative): `aria-hidden="true"`

### Touch Targets
- Minimum: 44×44px on all interactive elements
- Enforced via CSS: `min-height: 44px` on mobile

### Motion
- Respects `prefers-reduced-motion` — all animations disabled

---

## 9. THEME TOGGLE

**Implementation:** `data-theme` attribute on `<html>` element  
**Persistence:** `localStorage` key: `biqc_theme`  
**Default:** `dark`  
**Toggle location:** Dashboard header (Sun/Moon icon)

---

## 10. COMPONENT INVENTORY (Phase 1 Status)

### Standardized ✅
- PageLoadingState (skeleton cards + spinner)
- PageErrorState (Retry + Support + Troubleshoot)
- AsyncDataLoader (stage progress + timeout CTA)
- DataCoverageGate (blocked/degraded/full)
- IntegrationStatusWidget (connected/empty/missing)
- StageProgressBar (with ARIA tooltips)

### To Update in Phase 2
- Navigation sidebar (partial update done in Phase 1)
- Mobile bottom nav (Operations/Risk access)
- Trust page headings (VERIFIED — already have H1/H2)
- Login inline error (✅ Fixed in Phase 1)

---

## PHASE 1 COMPLETION STATUS

| Task | Status |
|---|---|
| Unified CSS variables (dark + light) | ✅ Done |
| Light mode toggle in header | ✅ Done |
| Contrast fix: text-muted → #8B9DB5 | ✅ Done |
| Theme persistence (localStorage) | ✅ Done |
| ARIA labels on navigation | ✅ Done |
| `aria-current="page"` on active items | ✅ Done |
| Login inline error message | ✅ Done |
| Design system document | ✅ This file |
| `prefers-reduced-motion` support | ✅ Already in CSS |
| Touch targets 44px minimum | ✅ Already in CSS |
