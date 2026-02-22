# BIQc Platform - Product Requirements Document

## Original Problem Statement
Transform the BIQc platform into a high-performance, AI-driven strategic business intelligence tool for Australian SMEs. React frontend + FastAPI backend + Supabase (PostgreSQL).

## Core Requirements
1. **Best-in-Class UX** - Modern, fast, interactive on desktop AND mobile
2. **Instantaneous Performance** - All pages load instantly
3. **Production Stability** - Deployable and stable in production
4. **Cognition-as-a-Platform** - Full executive cognition replacing CTO/CFO/CMO/COO/CCO

## What's Been Implemented

### Liquid Steel Website (Feb 22, 2026) - NEW
Complete marketing website built under `/site/*` test routes with "Liquid Steel" design system:
- **Design System**: Dark steel backgrounds (#0F1720, #141C26), orange accent (#FF6A00), JetBrains Mono metrics, glassmorphism panels
- **Pages Built (12 total)**:
  - `/site` - Home page (hero, stats, cognition cards, architecture diagram, CTA)
  - `/site/platform` - Platform page (problem, solution, architecture)
  - `/site/intelligence` - Intelligence page (6-category analysis grid, pipeline steps)
  - `/site/integrations` - Integrations page (6 category grid, custom APIs, security, data control)
  - `/site/pricing` - Pricing page (hiring comparison vs BIQc subscription)
  - `/site/trust` - Trust landing (sovereign hosting, security, legal links)
  - `/site/trust/terms` - Terms & Conditions
  - `/site/trust/privacy` - Privacy Policy
  - `/site/trust/dpa` - Data Processing Agreement
  - `/site/trust/security` - Security & Infrastructure
  - `/site/trust/centre` - Trust Centre
- **Shared Components**: WebsiteLayout with nav (Platform, Intelligence, Integrations, Pricing, Trust dropdown) + footer
- **Testing**: 100% pass (iteration_53.json) - all pages, nav, mobile, CTAs verified

### Bug Fix: cacheAge Reference Error (Feb 22, 2026)
- Fixed `ReferenceError: cacheAge is not defined` in AdvisorWatchtower.js
- Added `cacheAge` to useSnapshot() destructuring

### Previous Work (Feb 20-21, 2026)
- Dashboard v2 with 5 Cognition Groups (Money, Revenue, Operations, People, Market)
- Edge Function architecture (8 functions migrated)
- Cache-first performance strategy + pg_cron
- API cost tracking
- Recalibration/check-in system
- Collapsible sidebar redesign
- Animated loading screen (CognitiveLoadingScreen with Lottie)
- Landing page overhaul + mobile responsiveness
- Tutorial/onboarding system (21 pages)
- Notifications system + Intelligence Bridge
- Calibration auto-save

## Action Layer Backlog (Integration Required)
- **P1: Email Provider for Auto-Email actions** — Evaluate: SendGrid / Resend / Existing OAuth
- **P1: SMS Provider for Quick-SMS actions** — Evaluate: Twilio / MessageMedia
- **P2: Project Management for Hand Off** — Merge.dev Ticketing

## Prioritized Backlog

### P0 (Critical)
- [x] Scroll fix on landing page (RESOLVED)
- [x] Mobile responsiveness overhaul (RESOLVED)
- [x] Production deployment verification (RESOLVED)
- [x] cacheAge bug fix (RESOLVED)
- [x] Liquid Steel website mockup (COMPLETE)

### P1 (High Priority)
- [ ] Action Layer backend (Auto-Email, Quick-SMS, Hand Off)
- [ ] Deploy calibration-sync Edge Function
- [ ] Recover un-versioned Edge Functions
- [ ] Mobile responsiveness on authenticated pages

### P2 (Medium Priority)
- [ ] Complete Settings page population
- [ ] Consolidate duplicate Supabase secrets
- [ ] Implement Merge.dev webhook handler
- [ ] Cost tracking per user dashboard

### P3 (Low Priority / Tech Debt)
- [ ] Refactor routes/profile.py (1,917 lines)
- [ ] Refactor routes/email.py (1,855 lines)
- [ ] Eliminate MongoDB code references
- [ ] React Native App

## Key Files
- `/app/frontend/src/components/website/WebsiteLayout.js` - Liquid Steel shared layout
- `/app/frontend/src/pages/website/` - All 7 website page files
- `/app/frontend/src/pages/AdvisorWatchtower.js` - Main dashboard
- `/app/frontend/src/components/CognitiveLoadingScreen.js` - Loading animation

## Test Credentials
- Superadmin: andre@thestrategysquad.com.au / BIQc_Test_2026!
- Test User: e2e.test.feb17@emergentagent.com / TestPassword123!
