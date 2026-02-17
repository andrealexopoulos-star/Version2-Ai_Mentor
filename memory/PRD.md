# BIQc Platform — Product Requirements Document

## Original Problem Statement
The BIQc (Business Intelligence Quotient) platform is a sovereign AI-powered strategic intelligence system for Australian SMEs. Uses Supabase for Auth, PostgreSQL, Edge Functions; React frontend; FastAPI backend.

## Core Mandates
1. Data Harmony — Calibration data flows to all intelligence modules
2. Zero-Question Mandate — No redundant surveys for calibrated users
3. Edge-First Intelligence — Heavy AI/scraping offloaded to Edge Functions
4. Actionable Intelligence — Interactive insight briefs [Read/Action/Ignore]
5. Attention Protection — Only surface briefs when >2% delta detected
6. Zero-Redirect Protocol — No redirect loops between calibration and dashboard

## Tech Stack
- Frontend: React + Tailwind + Shadcn/UI
- Backend: FastAPI (Python)
- Database: Supabase PostgreSQL
- Auth: Supabase Auth (Google/Microsoft OAuth + email/password)
- AI: OpenAI GPT-4o via emergentintegrations
- Edge Functions: Supabase Deno (calibration-psych, deep-web-recon)
- Integrations: Merge.dev (CRM, Financial, HRIS, ATS, Knowledge Base)

## What's Been Implemented

### Completed (Feb 2026)

**Zero-Redirect Protocol:**
- Password Confirmation field on signup
- Metadata seeding (company_name, industry) to auth.users
- strategic_console_state write on calibration Q9 + brain COMPLETE + onboarding complete
- Three routing endpoints prioritize strategic_console_state as authoritative
- ProtectedRoute blocks /calibration for calibrated users

**Persistence Hooks (Onboarding → Console):**
- Card Persistence: OnboardingWizard upserts to business_profiles on every card selection (16+ fields)
- Goals step: growth_goals select field (revenue_growth, market_expansion, etc.)
- State Machine Sync: /onboarding/complete writes strategic_console_state.is_complete=true, current_step=17
- Console Skip: WarRoomConsole fetches business_stage — if found, skips ENTIRE 17-point survey → Intelligence Dashboard

**Titan Glass UI:**
- Register + Login right panels: gradient blue (#1a2744→#243b5c) with 40px glass blur + luminous radials

**Live Integrations (P1):**
- Merge.dev wired for: HubSpot, Salesforce, Pipedrive (CRM), Xero, QuickBooks, Stripe (Financial), Google Drive, OneDrive (Knowledge)
- Stripe upgraded from tier:pro to tier:free with viaMerge:true
- Email via Edge Functions (Outlook, Gmail)

**Previous work:**
- Redirect loop fixes (new users + andre.alexopoulos@gmail.com)
- Deep-Web Recon Edge Function, Strategic Console UI
- ai_core.py modularized, in-memory caching, background workers
- timedelta import fix, handleSave bug fix, OAuth flow fix

## Prioritized Backlog

### P1 (High)
- [ ] Full E2E new user test: signup → calibration → advisor
- [ ] Performance optimization on data-heavy pages

### P2 (Medium)
- [ ] Refactor routes/profile.py (2,000+ lines → domain-specific routers)
- [ ] Deep mobile responsive test (375px viewport)

### P3 (Low)
- [ ] Health monitoring for background workers

## Key Architecture
- Routing Authority: strategic_console_state.is_complete=true → calibrated
- Card Persistence: OnboardingWizard → PUT /api/business-profile on field change
- Console Skip: WarRoomConsole → GET /api/business-profile → if business_stage exists, status=COMPLETE, skip survey
- State Sync: POST /api/onboarding/complete → upsert strategic_console_state

## Key DB Tables
- strategic_console_state — Authoritative calibration completion flag
- user_operator_profile — Legacy calibration + onboarding state
- business_profiles — Company data (growth_goals, risk_profile columns added)
- biqc_insights — AI-generated intelligence
- intelligence_actions — User interactions with insights

## Test Accounts
- andre@thestrategysquad.com.au (master)
- andre.alexopoulos@gmail.com (redirect loop test)
