# BIQc Platform — Product Requirements Document

## Original Problem Statement
The BIQc (Business Intelligence Quotient) platform is a sovereign AI-powered strategic intelligence system for Australian SMEs. It uses Supabase for Auth, PostgreSQL, and Edge Functions, with a React frontend and FastAPI backend.

## Core Mandates
1. **Data Harmony** — Calibration data flows seamlessly to all intelligence modules
2. **Zero-Question Mandate** — No redundant surveys for calibrated users
3. **Edge-First Intelligence** — Heavy AI/scraping offloaded to Supabase Edge Functions
4. **Actionable Intelligence** — Interactive insight briefs with [Read/Action/Ignore]
5. **Attention Protection** — Only surface briefs when >2% delta detected
6. **Zero-Redirect Protocol** — Eliminate all redirect loops between calibration and dashboard

## Tech Stack
- **Frontend:** React + Tailwind + Shadcn/UI
- **Backend:** FastAPI (Python)
- **Database:** Supabase PostgreSQL
- **Auth:** Supabase Auth (Google/Microsoft OAuth + email/password)
- **AI:** OpenAI GPT-4o via emergentintegrations
- **Edge Functions:** Supabase Deno (calibration-psych, deep-web-recon)

## What's Been Implemented

### Completed (Feb 2026)
- **Zero-Redirect Protocol:**
  - Password Confirmation field on signup
  - Metadata seeding (company_name, industry) to auth.users on signup
  - `strategic_console_state` write on calibration Q9 + brain COMPLETE
  - Three routing endpoints prioritize `strategic_console_state` as authoritative source
  - ProtectedRoute blocks /calibration for calibrated users

- **Strategic Signal Chain Repair:**
  - Schema alignment: `growth_goals` and `risk_profile` added to business_profiles (user SQL) + BusinessProfileUpdate model
  - Card Persistence: OnboardingWizard upserts to `business_profiles` on every card selection
  - Console Context: WarRoomConsole fetches `business_profiles` — skips Step 2/17 if `business_stage` is not null
  - UI Styling: Register + Login right panels reset to Titan Glass theme (#1E293B)

- **Previous work:**
  - Auth pages with Titan Glass theme
  - Redirect loop fixes (new users + andre.alexopoulos@gmail.com)
  - Deep-Web Recon Edge Function
  - Strategic Console UI with [Read/Action/Ignore] toggles
  - ai_core.py modularized, CalibrationAdvisor refactored
  - In-memory caching layer, background workers
  - Fixed timedelta import, handleSave bug, OAuth flow

### Known Blockers
- **RLS Policy on `business_profiles`** — User must update in Supabase SQL Editor
- **Edge Functions not deployed** — `calibration-psych` and `deep-web-recon` need deployment

## Prioritized Backlog

### P0 (Critical — User Action)
- [ ] Fix RLS policy on `business_profiles` table
- [ ] Deploy Edge Functions to Supabase

### P1 (High)
- [ ] E2E new user calibration test (signup → calibration → advisor)
- [ ] Wire up live integrations (Google Drive, Xero, Stripe, HubSpot)
- [ ] Performance optimization on data-heavy pages

### P2 (Medium)
- [ ] Refactor `routes/profile.py` (2,000+ lines → domain-specific routers)
- [ ] Deep mobile responsive test (375px viewport)

### P3 (Low)
- [ ] Health monitoring for background workers

## Key Architecture
- **Routing Authority:** `strategic_console_state.is_complete = true` → calibrated
- **Fallback:** `user_operator_profile.persona_calibration_status = 'complete'`
- **Card Persistence:** OnboardingWizard → PUT /api/business-profile on every field change
- **Console Skip:** WarRoomConsole → GET /api/business-profile → skip Step 2 if business_stage exists

## Test Accounts
- `andre@thestrategysquad.com.au` (master account)
- `andre.alexopoulos@gmail.com` (redirect loop test)
