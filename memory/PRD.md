# BIQc Platform — Product Requirements Document

## CRITICAL SESSION REQUIREMENT — READ FIRST
**Every fork/session MUST update `frontend/.env` to point to `beta.thestrategysquad.com`:**
```
REACT_APP_BACKEND_URL=https://beta.thestrategysquad.com
```
Run after every fork: `sudo supervisorctl restart frontend` to apply.
Do NOT use the default emergent preview URL for this project.

**NOTE:** The custom domain `beta.thestrategysquad.com` caches production builds via CDN. For development/testing of CSS/JS changes, use the preview URL `https://strategy-platform-1.preview.emergentagent.com` to see live dev server changes. Changes will appear on `beta.thestrategysquad.com` only after a production deployment or CDN cache purge.

## Original Problem Statement
Transform BIQc into a high-performance, AI-driven "Cognition-as-a-Platform" for SMBs with executive-grade positioning and AI-driven intelligence surfaces. Complete desktop + mobile responsiveness and mobile app readiness.

## Core Architecture
- **Frontend:** React (CRA) + Tailwind + Shadcn/UI
- **Backend:** FastAPI → thin pass-through to SQL engine
- **Database:** Supabase (PostgreSQL) with SQL-first intelligence engine
- **Mobile:** React Native (Expo) — 5-tab native app (skeleton)
- **Deployment:** Azure (production), Emergent preview (development)

## What's Been Implemented

### Mobile Responsiveness Overhaul (Complete — Mar 2026)
- **Homepage fonts fixed:** All text elements bumped from 10px → 12px minimum via inline styles
  - StatBlock labels, Australian Owned badge, Industry Benchmarks, No credit card text
  - IntelligenceDiagram: FlowLabel, system cards, tool names all set to 12px
  - IntegrationCarousel: tool names set to 11px, 500+ Integrations badge to 12px
- **CSS !important overrides in mobile.css:** Fallback rules for all homepage sections targeting data-testid selectors
- **DashboardLayout sidebar:** Nav items set to min-h-[44px] for touch target compliance
- **MobileNav bottom bar:** Nav labels bumped from 10px → 11px, More sheet items from 11px → 12px
- **Footer:** h4 bumped from 9px → 11px, paragraphs from 11px → 13px
- **Advisor page:** Greeting section stacks vertically on mobile, sticky status bar text bumped to 12-13px, all buttons enforced to min-height 44px
- **MarketPage:** Loading timeout reduced from 8s → 4s
- **Settings page:** Added 5s loading timeout safety net
- **Touch targets:** All interactive elements enforce 44px min-height on mobile

### Pre-Launch Validation Protocol (Complete — Mar 2026)
- **Layer 1:** All sections PASS (Homepage, Registration, Onboarding, Multi-Tenant Isolation, Responsiveness)
- **Layer 2:** AI Quality 8.85/10, Hallucination 0.0%, Cognitive Drift measured
- **Layer 3:** k6, OpenTelemetry, Chaos, Datadog configs prepared
- **Platform Score: 8.57/10 (PASS)**

### All Previous Features (Complete)
- Backend Cognition Core, Scrape & Edge Functions, Homepage Visual System
- User Onboarding Journey, Phase B Cognition Integration
- Navigation & Access Control, Feature Tier Gates, SoundBoard Strategic Advisor
- CMO Summary, Post-CMO Integration Overlay, Enterprise Contact Gate
- Calendar View, Canonical pricing config, Session caching

## Test Credentials
- **Test Account 1:** trent-test1@biqc-test.com / BIQcTest!2026A (Campos Coffee, super_admin) — WORKING
- **Test Account 2:** trent-test2@biqc-test.com / BIQcTest!2026B — CREDENTIALS INVALID
- **Test Account 3:** trent-test3@biqc-test.com / BIQcTest!2026C (Thankyou Group, super_admin) — WORKING

## Prioritized Backlog

### P0 — Must Do Before Launch
1. **Run SQL Migration 049** in Supabase SQL Editor → Fix Cognition Core endpoint
2. **CDN Cache Purge** for `beta.thestrategysquad.com` → Apply CSS/JS fixes to production
3. **Reset Test Account 2 password** in Supabase Auth dashboard

### P1 — Important
4. **Reset andre@thestrategysquad.com.au** password
5. **API Performance Optimization** — Profile endpoint 1.6s, target < 500ms
6. **Admin Panel Billing Adjustments** — Wire tier management to backend

### P2 — Future
7. **Expo Mobile App** — Full build-out
8. **Decision Tracking UI** — For Cognition Core learning loop
9. **Proactive SoundBoard / Daily Brief** — Overnight summary
10. **Live Competitive Benchmark** — Weekly Digital Footprint percentile
11. **UX Analytics integration** (Mixpanel/Amplitude)
12. **OpenTelemetry + Datadog** production deployment

## Key Files
- `/app/frontend/src/mobile.css` — All mobile responsive overrides
- `/app/frontend/src/pages/website/HomePage.js` — Homepage with inline fontSize fixes
- `/app/frontend/src/components/website/IntelligenceDiagram.js` — Intelligence section with inline fontSize
- `/app/frontend/src/components/website/IntegrationCarousel.js` — Carousel with inline fontSize
- `/app/frontend/src/components/MobileNav.js` — Bottom navigation bar
- `/app/reports/BIQC_LAUNCH_READINESS_REPORT.md` — Complete pre-launch validation report
- `/app/infrastructure/` — k6, OpenTelemetry, Chaos, Datadog configs
- `/app/supabase/migrations/049_fix_propagation_map_columns.sql` — Critical SQL fix
