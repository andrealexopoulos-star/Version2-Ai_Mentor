# BIQc Platform — Product Requirements Document

## Original Problem Statement
The user initiated a "Galaxy-Scale" overhaul of the BIQc (Business Intelligence Quotient) platform — a sovereign AI-powered strategic intelligence system for Australian SMEs. The platform uses Supabase for Auth, PostgreSQL, and Edge Functions, with a React frontend and FastAPI backend.

Core mandates:
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
- Auth pages with Titan Glass theme (Login + Register)
- **Zero-Redirect Protocol** (Feb 2026):
  - Password Confirmation field on signup
  - Register + Login right panels unified with dark (#0A0A0A) platform theme
  - Metadata seeding (company_name, industry) to auth.users on signup
  - `strategic_console_state` write on calibration Q9 completion AND brain COMPLETE
  - Three routing endpoints prioritize `strategic_console_state` as authoritative source
  - ProtectedRoute blocks /calibration access for calibrated users
- Redirect loop fixes for new users and `andre.alexopoulos@gmail.com`
- Deep-Web Recon Edge Function created
- Strategic Console UI with [Read/Action/Ignore] toggles
- ai_core.py modularized into core/ modules
- CalibrationAdvisor refactored with custom hook
- In-memory caching layer on key endpoints
- Background workers for email sync and intelligence automation
- Missing `timedelta` import fix in calibration.py

### Known Blockers
- **RLS Policy on `business_profiles`** — Backend cannot INSERT user profile data. User must update RLS policy in Supabase SQL Editor.
- **Edge Functions not deployed** — `calibration-psych` and `deep-web-recon` must be deployed to Supabase project.

## Prioritized Backlog

### P0 (Critical)
- [ ] User: Fix RLS policy on `business_profiles` table
- [ ] User: Deploy Edge Functions to Supabase

### P1 (High)
- [ ] E2E new user calibration test (full signup → calibration → advisor flow)
- [ ] Wire up live integrations (Google Drive, Xero, Stripe, HubSpot)
- [ ] Performance optimization on data-heavy pages

### P2 (Medium)
- [ ] Refactor `routes/profile.py` (2,000+ lines → domain-specific routers)
- [ ] Deep mobile responsive test (375px viewport)

### P3 (Low)
- [ ] Health monitoring for background workers
- [ ] Add Health Monitoring for email_sync_worker and intelligence_automation_worker

## Key Architecture
- **Routing Authority:** `strategic_console_state.is_complete = true` → user is calibrated
- **Fallback:** `user_operator_profile.persona_calibration_status = 'complete'`
- **Frontend Gate:** SupabaseAuthContext bootstrap → /api/calibration/status → AUTH_STATE decision
- **Route Guard:** ProtectedRoute reads authState (LOADING/NEEDS_CALIBRATION/READY)

## Key DB Tables
- `strategic_console_state` — Authoritative calibration completion flag
- `user_operator_profile` — Legacy calibration + onboarding state
- `business_profiles` — Company data (RLS blocked)
- `biqc_insights` — AI-generated intelligence
- `intelligence_actions` — User interactions with insights

## Test Accounts
- `andre@thestrategysquad.com.au` (master account)
- `andre.alexopoulos@gmail.com` (redirect loop test)
