# BIQc Platform — Product Requirements Document

## CRITICAL SESSION REQUIREMENT — READ FIRST
**Every fork/session MUST update `frontend/.env` to point to `beta.thestrategysquad.com`:**
```
REACT_APP_BACKEND_URL=https://beta.thestrategysquad.com
```
Run after every fork: `sudo supervisorctl restart frontend` to apply.
Do NOT use the default emergent preview URL for this project.

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

### Phase B Cognition Integration (Complete — Mar 2026)
- **AdvisorWatchtower**: Added `StabilityScoreCard` with SVG circular gauge — shows composite stability score (the "ONE NUMBER" per audit recommendation). Score computed from cognition core when SQL deployed, or derived from snapshot state as fallback. Also shows instability indices (RVI, EDS, CDR, ADS) and confidence badge.
- **AdvisorWatchtower**: Added `PropagationMap` rendering — visualizes risk propagation chains when cognition SQL is deployed
- **RevenuePage**: Added Cognition Intelligence panel with 4 instability indices + Propagation Chains in Cross-Domain tab. Properly falls back to existing signals display when cognition not available.
- **RiskPage**: Added Instability Intelligence panel with circular gauges (r=18) + Propagation Analysis with probability display in Cross-Domain Risk tab
- **OperationsPage**: Added Operations Intelligence panel with cognition indices (ADS, EGI, SDS, BNS)
- All pages gracefully handle `MIGRATION_REQUIRED` state (SQL migrations 044+045 not yet deployed)

### Forensic Pre-Launch Test (Complete — Mar 2026)
- Created 3 test accounts: trent-test1/2/3@biqc-test.com (Campos Coffee, Koala Eco, Thankyou Group)
- Completed live calibration for Campos Coffee: ABN 57 100 123 699 verified, digital footprint 55/100
- Full forensic report: `/app/reports/forensic_test_2026/MASTER_FORENSIC_REPORT_20260304.md`
- **P0 issues found and fixed:**
  - SoundBoard was using OLD DB prompt — bypassed `get_prompt()` to always use new Strategic Advisor
  - SoundBoard welcome text updated to match new advisor persona
  - Pricing mismatch: SubscribePage now shows Foundation $750 / Performance $1,950 / Growth $3,900
- **SQL to run:** `047_grant_test_super_admin.sql` — grants super_admin to test accounts
- **Supabase action needed:** Delete `mysoundboard_v1` row from `system_prompts` table
- Comprehensive live testing of production site biqc.thestrategysquad.com documented
- Report at `/app/reports/LIVE_FORENSIC_AUDIT_20260304.md`
- Key finding: calibration gate works correctly; test1234 account redirects to calibration (not completed)
- Key finding: andre@thestrategysquad.com.au credentials not working on production

### Navigation & Access Control System (Complete — Mar 2026)
- **BIQc Legal collapsible menu**: At bottom of sidebar, collapses/expands like other sections. Items: BIQc AI Learning Guarantee, Security & Infrastructure, Trust Centre, Data Processing Agreement, Privacy Policy, Terms & Conditions
- **Knowledge Base → moved under Admin menu** (SA-only visible)
- **Tier Resolver updated**: `/revenue` and `/operations` now require `enterprise` tier. `/reports` changed to `free`. `growth` tier added as alias for enterprise (rank 3).
- **EnterpriseContactGate**: Wraps Revenue and Operations pages. Non-enterprise users see contact form (auto-filled name/email/business, calendar callback picker, problem description textarea). Submits to `/enterprise/contact-request` backend.
- **UpgradeCardsGate**: Wraps Automations, Forensic Ingestion Audit, Exposure Scan. Shows 4 pricing plan cards (Foundation $750, Performance $1,950, Growth $3,900, Enterprise Contact Sales) → clicking navigates to /subscribe.
- **SupportConsolePage enhanced**: Added "Enterprise Leads" tab showing all contact form submissions. Tier dropdown now shows friendly plan names (Foundation/Performance/Growth). Added `loadContacts()` function.
- **Backend**: `/enterprise/contact-request` + `/enterprise/contact-requests` endpoints in super_admin.py.

### Feature Tier Gates (Complete — Mar 2026)
- **Marketing Benchmark 30-day timer**: Free tier gets 1 scan/30 days. Timer stored in localStorage. Shows countdown "Next free scan in X days" + upgrade prompt when throttled.
- **SoundBoard welcome message**: First-time visit shows contextual welcome message. "Complete Calibration" and "Run Exposure Scan" buttons pinned at top of SoundBoard. Exposure scan button shows 30-day cooldown timer.
- **Market page**: Executive Brief moved to top of Intelligence tab. ForensicCalibration + EngagementScan blocks removed → replaced with "Governance Reports" panel linking to /reports.
- **Reports page**: `ForensicReportCard` added — shows Forensic Calibration Report and Market Exposure Scan Report with download buttons, "next available on X date" per 30-day cycle for free tier.
- **SoundboardPanel.js** (the actual SoundBoard widget used on all dashboard pages): Fixed `handleFileSelect` stub to use FileReader — reads text files (.txt, .csv, .md, .json, .py, etc.) and includes content in chat message. Attachment preview strip shows before sending. File download card renders when backend generates a file.
- **MySoundBoard.js** (full-page `/soundboard`): Same fix — Paperclip button, FileReader, attachment preview, file download display.
- **FloatingSoundboard.js**: Same implementation added (component exists, currently not mounted on any page).

### Critical Onboarding Bug Fixed — Mar 2026
- **Root cause**: `complete_onboarding` endpoint wrote to `strategic_console_state.is_complete` but NOT to `user_operator_profile.persona_calibration_status`. The `auth/check-profile` endpoint checks ONLY `persona_calibration_status` → user was stuck in calibration redirect loop forever after completing the 7-step wizard.
- **Fix**: `complete_onboarding` now also updates `user_operator_profile.persona_calibration_status = 'complete'`.

### SQL Migrations Generated — Mar 2026
- `/app/supabase/migrations/044_cognition_core.sql` — 9 tables: integration_health, evidence_packs, cognition_decisions, outcome_checkpoints, propagation_rules (14 rules seeded), automation_actions (10 actions seeded), automation_executions, instability_snapshots, confidence_recalibrations. Full RLS policies.
- `/app/supabase/migrations/045_cognition_core_functions.sql` — 9 functions: fn_assemble_evidence_pack, fn_compute_propagation_map, fn_evaluate_pending_checkpoints, fn_recalibrate_confidence, fn_check_integration_health, fn_snapshot_daily_instability, fn_detect_drift, ic_generate_cognition_contract (master function), ic_calculate_risk_baseline. SECURITY DEFINER + GRANT EXECUTE.

### Forensic Audit — Live Tested Mar 2026
- Documented full calibration flow live: scanning animations, identity verification (ABN: 26 665 322 127 detected), Digital Footprint scores, Executive Intelligence Snapshot
- Documented full onboarding wizard: all 7 steps (Business Identity, Website, Market, Products, Team, Goals, BIQc Preferences)
- Discovered and fixed critical onboarding redirect loop bug
- Report: `/app/reports/LIVE_FORENSIC_AUDIT_20260304.md`
- **AdvisorWatchtower**: Added `StabilityScoreCard` with circular score gauge (computed from snapshot state + cognition override). Shows composite stability score prominently as the "ONE NUMBER" per audit recommendation
- **AdvisorWatchtower**: Added `PropagationMap` rendering when cognition SQL is deployed
- **RevenuePage**: Added Cognition Intelligence panel (instability indices: RVI, CDR, EDS, ADS) + Propagation Chains in Cross-Domain tab
- **RiskPage**: Added Instability Intelligence panel with circular gauges + Propagation Analysis in Cross-Domain Risk tab  
- **OperationsPage**: Added Operations Intelligence panel with cognition indices (ADS, EGI, SDS, BNS)
- All pages gracefully fall back to snapshot data when cognition SQL not yet deployed (MIGRATION_REQUIRED)

## Prioritized Backlog

### P0 — Must Do Before Next Session
1. **Run SQL Migrations in Supabase**: Paste 044 then 045 into Supabase SQL Editor → Cognition Core activates immediately
2. **Verify Onboarding Fix on Production**: Complete the onboarding wizard with test1234 account all 7 steps → should land on /integrations now (critical fix deployed)

### P1 — Important
3. **Admin/Legal Nav Restructure** — Verify matches user specification
4. **Weekly Check-in Calendar** — Wire CalendarView into sidebar
5. **Fix andre@thestrategysquad.com.au** — Production credentials not working

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
