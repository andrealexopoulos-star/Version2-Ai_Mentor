# BIQc Platform — Product Requirements Document

## Original Problem Statement
BIQc is a Sovereign Strategic Partner for Australian SMEs — AI-powered business intelligence that only asks what it doesn't already know.

## Core Mandates
1. Data Harmony — Calibration data flows to all intelligence modules
2. Zero-Question Mandate — No redundant surveys for calibrated users
3. Edge-First Intelligence — Heavy AI/scraping offloaded to Edge Functions
4. Actionable Intelligence — Interactive insight briefs [Read/Action/Ignore]
5. Attention Protection — Only surface briefs when >2% delta detected
6. Zero-Redirect Protocol — No redirect loops
7. Dynamic Gap-Filling — Only ask questions where data is NULL in the DB

## Tech Stack
- Frontend: React + Tailwind + Shadcn/UI
- Backend: FastAPI (Python)
- Database: Supabase PostgreSQL
- Auth: Supabase Auth (Google/Microsoft OAuth + email/password)
- AI: OpenAI GPT-4o via emergentintegrations
- Edge Functions: Supabase Deno (calibration-psych, deep-web-recon)
- Integrations: Merge.dev (CRM, Financial, HRIS, ATS, Knowledge Base)
- Fact Resolution: 3-layer fact authority (Supabase → Integrations → Fact Ledger)

## What's Been Implemented

### Dynamic Gap-Filling Architecture
- **Strategic Audit Endpoint:** `GET /api/calibration/strategic-audit` audits 17 strategic dimensions against business_profiles
- **17-Point Strategic Map:** business_name, business_stage, industry, location, target_market, products_services, unique_value_proposition, team_size, years_operating, short_term_goals, long_term_goals, main_challenges, growth_strategy, growth_goals, risk_profile, competitive_advantages, business_model
- **WarRoomConsole:** Fetches audit on load → gap_count=0 → COMPLETE; gaps exist → auto-advance past known dimensions
- **Fact Resolution:** Pulls from business_profiles, users, user_operator_profile, intelligence_baseline, observation_events, fact_ledger

### Persistence Hooks
- **Card Persistence:** OnboardingWizard upserts to business_profiles on every card selection (16+ fields incl. growth_goals, risk_profile)
- **State Machine Sync:** POST /onboarding/complete writes strategic_console_state.is_complete=true, current_step=17
- **Settings Save:** All 3 tabs (Profile, Preferences, Tools) execute PUT /api/business-profile
- **Settings Fields:** business_stage, growth_goals, risk_profile selects added to Account tab

### Zero-Redirect Protocol
- Password Confirmation on signup, metadata seeding, strategic_console_state as routing authority

### Live Integrations
- Merge.dev: HubSpot, Salesforce, Pipedrive, Xero, QuickBooks, Stripe, Google Drive, OneDrive
- Email: Outlook + Gmail via Edge Functions

## Prioritized Backlog

### P1 (High)
- [ ] Full E2E new user test: signup → onboarding → calibration → advisor
- [ ] Performance optimization on data-heavy pages

### P2 (Medium)
- [ ] Refactor routes/profile.py (2,000+ lines → domain-specific routers)
- [ ] Deep mobile responsive test (375px viewport)

### P3 (Low)
- [ ] Health monitoring for background workers
- [ ] Executive Pulse SQL for real-time signal scores

## Key Architecture
- Routing: strategic_console_state.is_complete=true → calibrated
- Gap-Filling: /api/calibration/strategic-audit → audit 17 dimensions → auto-advance
- Fact Authority: fact_resolution.py resolves facts from 3 layers → injects into AI brain
- Card Persistence: OnboardingWizard → PUT /api/business-profile per field change
