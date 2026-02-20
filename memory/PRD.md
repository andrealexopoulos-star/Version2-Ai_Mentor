# BIQc Platform - Product Requirements Document

## Original Problem Statement
Transform the BIQc platform into a high-performance, AI-driven strategic business intelligence tool for Australian SMEs. The platform uses React frontend, FastAPI backend, and Supabase (PostgreSQL) database.

## Core Requirements
1. **Best-in-Class UX** - Modern, fast, interactive experience on desktop and mobile
2. **Instantaneous Performance** - All pages load instantly
3. **Production Stability** - Deployable and stable in production

## Architecture
- **Frontend:** React (CRA with Craco), Tailwind CSS, Shadcn UI
- **Backend:** FastAPI (Python), Supabase client
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth with Google/Microsoft OAuth
- **AI:** OpenAI, Perplexity, Firecrawl integrations
- **Integrations:** Merge.dev (CRM/Accounting), Outlook/Gmail email

## What's Been Implemented

### Session 1-N (Previous Sessions)
- Full platform build with 20+ pages/features
- Supabase auth integration with Google/Microsoft OAuth
- AI-powered business intelligence features
- Edge Functions for calibration and intelligence
- Admin dashboard with user management
- Email/calendar integration
- Mobile responsive design

### Current Session (Feb 20, 2026)
- **P0 SCROLL BUG FIX (RESOLVED)**
  - Root cause: `body` had `overflow-y:scroll` + `overscroll-behavior:contain` creating a scroll container that trapped wheel events
  - Fix: Changed body to `overflow-y:visible` and `overscroll-behavior:auto`, making html the ONLY scroll container
  - 3-layer fix: CSS (scroll-fix-critical.css) + JS IIFE (index.js) + React useEffect (App.js)
  - Verified: Mouse wheel, keyboard, and touch scroll all working on desktop and mobile
  - Testing: 100% pass rate on all scroll tests (iteration_48.json)

- **HTML Structure Fix**
  - Fixed broken `index.html` with duplicate `</head>` tag
  - All meta tags (OG, Twitter, structured data) now correctly inside `<head>`

- **Deployment Readiness**
  - All deployment checks pass (no hardcoded URLs, env vars correct, build compiles)
  - Frontend uses `window.location.origin` for API calls (fork-safe)

## Prioritized Backlog

### P0 (Critical)
- [x] ~~Scroll fix on landing page~~ (RESOLVED Feb 20, 2026)
- [ ] Production deployment verification (user must deploy and verify)

### P1 (High Priority)
- [ ] Complete "Fix Web" track (mobile responsiveness audit on authenticated pages)
- [ ] Calibration Forensic Intelligence Upgrade (rebuild Edge Functions)
- [ ] Deploy 6 updated Edge Functions to Supabase
- [ ] Admin Console: Verify Suspend/Unsuspend feature
- [ ] Snapshot Architecture: Verify WarRoomConsole & BoardRoom caching
- [ ] Recover un-versioned Edge Functions from Supabase to git repo

### P2 (Medium Priority)
- [ ] Mobile hamburger menu on authenticated pages (DashboardLayout.js)
- [ ] Consolidate duplicate Supabase secrets (6 Microsoft/Azure)
- [ ] Implement Merge.dev webhook handler
- [ ] Cost tracking per user

### P3 (Low Priority / Tech Debt)
- [ ] Refactor routes/profile.py (1,917 lines)
- [ ] Refactor routes/email.py (1,855 lines)
- [ ] Eliminate MongoDB (migrate truth_engine.py to Supabase)
- [ ] React Native App (Track 2)

## Key Files Modified This Session
- `frontend/public/index.html` - Fixed HTML structure
- `frontend/src/scroll-fix-critical.css` - Critical scroll CSS fix
- `frontend/src/index.css` - Body overflow/overscroll changes
- `frontend/src/mobile-fixes.css` - Mobile overflow/overscroll changes
- `frontend/src/index.js` - Pre-React scroll unlock JS
- `frontend/src/App.js` - React useEffect scroll unlock

## Test Credentials
- Superadmin: andre@thestrategysquad.com.au
- Test User: e2e.test.feb17@emergentagent.com / TestPassword123!
