# BIQc Platform — Product Requirements Document

## Original Problem Statement
Transform BIQc into a high-performance, AI-driven "Cognition-as-a-Platform" for SMBs with executive-grade positioning and AI-driven intelligence surfaces.

## Core Architecture
- **Frontend:** React (CRA) + Tailwind + Shadcn/UI
- **Backend:** FastAPI → thin pass-through to SQL engine
- **Database:** Supabase (PostgreSQL) with SQL-first intelligence engine
- **Mobile:** React Native (Expo) — 5-tab native app
- **Deployment:** Azure (production), Emergent preview (development)

## What's Been Implemented

### Backend Cognition Core (Complete)
- SQL intelligence engine: `ic_generate_cognition_contract` (~25ms)
- API: `/api/cognition/{tab}`, `/api/cognition/decisions`, `/api/cognition/integration-health`

### Scrape & Edge Function Architecture (Complete — Confirmed)
1. **calibration-business-dna** — Perplexity 5-query deep search + Firecrawl scrape + regex identity extraction + GPT-4o-mini structured extraction → writes to `business_profiles`
2. **business-identity-lookup** — ABR registry direct ABN lookup + name search
3. **fetch_website_text** — httpx scraper for profile autofill/build
4. **business-profile/build** — Serper.dev search + multi-URL scrape + AI profile extraction

### Homepage Visual System (Complete)
- Canvas energy galaxy (4 threads, 50 particles, 8s glow, center dead zone)
- Hero rotator (3 variants, 8s, 1.2s fade), integration carousel (21 SVG logos, 25s), intelligence diagram (4-tier, 6s core glow)

### Mobile CSS (Complete)
- Single `mobile.css` (~300 lines) covering homepage, login/register, advisor, calibration, platform, footer

### Expo React Native App (Complete)
- Auth-gated 5-tab app: Overview, Chat, Market, Alerts, Settings
- Connected to production API with SecureStore auth

### User Onboarding Journey (Fixed — Mar 2026)
- **Onboarding completion** → redirects to `/integrations` (was empty `/advisor`)
- **Welcome Banner** on Advisor page when zero integrations connected — guides to CRM, Accounting, Email
- **Daily Summary** component — "What changed in 24h" with signal count + executive memo
- **Dashboard route restored** — `/dashboard` now shows setup checklist (was redirected to `/advisor`)
- **Cognition Integration** — Advisor page fetches from `/cognition/overview` with fallback

### Phase B Cognition Integration (Completed — Mar 2026)
- **AdvisorWatchtower**: Added `StabilityScoreCard` with circular score gauge (computed from snapshot state + cognition override). Shows composite stability score prominently as the "ONE NUMBER" per audit recommendation
- **AdvisorWatchtower**: Added `PropagationMap` rendering when cognition SQL is deployed
- **RevenuePage**: Added Cognition Intelligence panel (instability indices: RVI, CDR, EDS, ADS) + Propagation Chains in Cross-Domain tab
- **RiskPage**: Added Instability Intelligence panel with circular gauges + Propagation Analysis in Cross-Domain Risk tab  
- **OperationsPage**: Added Operations Intelligence panel with cognition indices (ADS, EGI, SDS, BNS)
- All pages gracefully fall back to snapshot data when cognition SQL not yet deployed (MIGRATION_REQUIRED)

## Prioritized Backlog

### P0 — Blocking
1. **SQL Migrations 044+045** — Must be deployed in Supabase for cognition core to activate. Run in Supabase SQL Editor.

### P1 — Important
2. **Admin/Legal Nav Restructure** — Verify matches user specification
3. **Weekly Check-in Calendar** — Wire CalendarView into sidebar
4. **Andre Account Fix** — Production credentials `andre@thestrategysquad.com.au` not working

### P2 — Future
5. **Expo App Store Deployment**
6. **A/B Testing & Marketing Automation UIs**

## Key Files
- `frontend/src/mobile.css`, `frontend/src/pages/website/HomePage.js`
- `frontend/src/pages/AdvisorWatchtower.js` — Welcome banner + daily summary + cognition fetch
- `frontend/src/pages/OnboardingWizard.js` — Redirects to integrations after completion
- `mobile/App.tsx` — Expo entry with auth flow
- `supabase/functions/calibration-business-dna/index.ts` — Primary scrape edge function
- `supabase/functions/business-identity-lookup/index.ts` — ABN registry lookup

## Test Credentials
- Email: `andre@thestrategysquad.com.au`
- Password: `BIQc_Test_2026!`
