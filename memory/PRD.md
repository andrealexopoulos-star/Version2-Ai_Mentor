# BIQc Platform - Product Requirements Document

## Original Problem Statement
Transform the BIQc platform into a high-performance, AI-driven strategic business intelligence tool for Australian SMEs. React frontend + FastAPI backend + Supabase (PostgreSQL).

## Core Requirements
1. **Best-in-Class UX** - Modern, fast, interactive on desktop AND mobile
2. **Instantaneous Performance** - All pages load instantly
3. **Production Stability** - Deployable and stable in production

## What's Been Implemented

### Current Session (Feb 20, 2026)

#### P0 SCROLL BUG FIX (RESOLVED)
- **Root cause**: `body` had `overflow-y:scroll` + `overscroll-behavior:contain` creating a scroll container that trapped wheel events
- **Fix**: body `overflow-y:visible`, `overscroll-behavior:auto`. HTML is ONLY scroll container
- **Testing**: 100% pass (iteration_48.json) - mouse wheel, keyboard, mobile touch all work

#### HTML Structure Fix (RESOLVED)
- Fixed `index.html` with duplicate `</head>` tag causing meta tags outside `<head>`

#### Mobile Responsiveness Overhaul (RESOLVED)
- **Nav**: "Get started" button scaled down on mobile (text-xs, px-3)
- **Stats grid**: Fixed from single-column to 2x2 on mobile (removed aggressive `.grid-cols-2 { grid-template-columns: 1fr }` CSS overrides)
- **Sovereign badge**: Fixed full-viewport-width bug (excluded fixed elements from `* { max-width: 100% }` CSS rules across 3 CSS files)
- **Cards**: Feature/outcome/pricing cards properly stack on mobile (grid-cols-1 sm:grid-cols-2 md:grid-cols-3)
- **Typography**: Section headings reduced for mobile (text-xl sm:text-3xl)
- **Spacing**: Reduced padding on mobile cards (p-4 sm:p-6)
- **Testing**: 100% pass (iteration_50.json) on Android (360x800) and iPhone (390x844)

### Calibration Auto-Save (Feb 20, 2026)
- Auto-saves progress to Supabase (`/api/console/state`) after each wizard step, chat response, audit submit, and wow confirmation
- Users can resume calibration from where they left off if disconnected or inactive

### Tutorial/Onboarding System (Feb 20, 2026)
- Reusable `TutorialOverlay` component with modal, X close, back/next arrows, dot indicators
- Shows automatically on first visit to each page (tracked via localStorage)
- "?" help button in header to re-trigger tutorials
- Covers 21 authenticated pages + 3 calibration stages
- Content written for non-AI-savvy users explaining purpose and how to use each function

### Sprint A: Enable Dormant Systems (Feb 21, 2026)
- **Notifications system ENABLED** — was feature-flagged off (`ENABLE_NOTIFICATIONS_POLLING = false`). Now active. Bell icon visible on mobile + desktop. Backend `/notifications/alerts` scans emails for complaints, calendar for upcoming meetings, email intelligence for declining client engagement. Full dropdown UI with severity badges and navigation.
- **Intelligence Bridge BUILT** — New `intelligence_bridge.py` connects Watchtower findings + Snapshots → Intelligence Actions automatically. When a snapshot detects open risks or contradictions, they auto-create actionable items in `intelligence_actions` table with domain, severity, title, description, and suggested action.
- **Watchtower wired to Snapshot** — `/snapshot/generate` now triggers `watchtower.run_analysis()` on every refresh, keeping position monitoring in sync with cognitive snapshots.
- **Watchtower → Actions pipeline** — When Watchtower persists a position change finding, it auto-bridges to an intelligence action via `bridge_watchtower_to_actions()`.

### Calibration Psych Fixes (Feb 20, 2026)
- **Scroll Fix:** Changed CalibrationAdvisor container from `min-h-screen` to `h-screen overflow-hidden` so chat messages scroll within viewport and input stays visible
- **Auto-scroll:** Added useEffect to auto-scroll to bottom when new messages arrive
- **Auto-follow-up:** When AI returns acknowledgment without a question (no `?`), automatically requests next step from edge function
- **Input focus:** Auto-focuses input field after each message send

## Prioritized Backlog

### P0 (Critical)
- [x] Scroll fix on landing page (RESOLVED)
- [x] Mobile responsiveness overhaul (RESOLVED)
- [x] Production deployment verification — Removed MongoDB env vars (MONGO_URL, DB_NAME) and fixed hardcoded URLs in email.py

### P1 (High Priority)
- [ ] Complete "Fix Web" track (mobile responsiveness on authenticated pages)
- [ ] Calibration Forensic Intelligence Upgrade (rebuild Edge Functions)
- [ ] Deploy 6 updated Edge Functions to Supabase
- [ ] Admin Console: Verify Suspend/Unsuspend feature
- [ ] Snapshot Architecture: Verify WarRoomConsole & BoardRoom caching
- [ ] Recover un-versioned Edge Functions from Supabase to git repo

### P2 (Medium Priority)
- [ ] Mobile hamburger menu on authenticated pages (DashboardLayout.js)
- [ ] Consolidate duplicate Supabase secrets
- [ ] Implement Merge.dev webhook handler
- [ ] Cost tracking per user

### P3 (Low Priority / Tech Debt)
- [ ] Refactor routes/profile.py (1,917 lines)
- [ ] Refactor routes/email.py (1,855 lines)
- [x] MongoDB env vars removed from .env (deployment blocker resolved)
- [ ] Eliminate MongoDB code references (truth_engine.py) — migrate to Supabase
- [ ] React Native App (Track 2)

## Key Files Modified
- `frontend/public/index.html` - HTML structure fix
- `frontend/src/scroll-fix-critical.css` - Body overflow-y:visible
- `frontend/src/index.css` - Scroll fix + grid fix + badge fix
- `frontend/src/mobile-fixes.css` - Scroll + badge wildcard fix
- `frontend/src/mobile-ux-overhaul.css` - Grid override fix
- `frontend/src/mobile-enhancements.css` - Badge wildcard fix
- `frontend/src/landing-mobile-ux.css` - Grid override fix
- `frontend/src/pages/LandingIntelligent.js` - Full mobile responsive overhaul
- `frontend/src/index.js` + `frontend/src/App.js` - Scroll unlock JS

## Test Credentials
- Superadmin: andre@thestrategysquad.com.au
- Test User: e2e.test.feb17@emergentagent.com / TestPassword123!
