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

## Prioritized Backlog

### P1 — Important
1. **Full Phase B Cognition Integration** — Connect RevenuePage, RiskPage, OperationsPage to cognition endpoint (Advisor started)
2. **Admin/Legal Nav Restructure**
3. **Weekly Check-in Calendar**

### P2 — Future
4. **Expo App Store Deployment**
5. **A/B Testing & Marketing Automation UIs**

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
