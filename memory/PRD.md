# BIQc Platform — Product Requirements Document

## Original Problem Statement
BIQc is a Sovereign Strategic Partner for Australian SMEs. AI-powered business intelligence that only asks what it doesn't already know.

## Core Mandates
1. Data Harmony — Calibration data flows to all intelligence modules
2. Zero-Question Mandate — No redundant surveys
3. Edge-First Intelligence — Heavy AI offloaded to Edge Functions
4. Actionable Intelligence — [Read/Action/Ignore] briefs
5. Attention Protection — >2% delta threshold
6. Zero-Redirect Protocol — No redirect loops
7. Dynamic Gap-Filling — Only ask questions where data is NULL

## What's Been Implemented

### Neural Re-Link Protocol (Latest)
- **Sidebar Restoration:** All 9 orphaned pages added to sidebar in 4 sections (INTELLIGENCE, ANALYSIS, TOOLS, CONFIGURATION)
- **Home Button:** Added "← Dashboard" button to WarRoomConsole header (covers /war-room and /watchtower)
- **Schema Reference:** Full table/column/usage document at /app/memory/SCHEMA_REFERENCE.md
- **Titan Glass:** Login + Register right panels confirmed working

### Dynamic Gap-Filling Architecture
- `GET /api/calibration/strategic-audit` audits 17 dimensions against business_profiles
- WarRoomConsole: gap_count=0 → COMPLETE; gaps → auto-advance past known dimensions
- fact_resolution.py: 3-layer authority (Supabase → Integrations → Fact Ledger)

### Persistence Hooks
- OnboardingWizard upserts to business_profiles on card selection
- POST /onboarding/complete writes strategic_console_state
- Settings Save buttons execute PUT /api/business-profile
- business_stage, growth_goals, risk_profile in Settings Account tab

### Live Integrations
- Merge.dev: HubSpot, Salesforce, Pipedrive, Xero, QuickBooks, Stripe, Google Drive, OneDrive
- Email: Outlook + Gmail via Edge Functions

## Sidebar Navigation (24 items, 5 sections)
- INTELLIGENCE: BIQc Insights, Strategic Console, Board Room, Operator View, SoundBoard
- ANALYSIS: Diagnosis, Analysis, Market Analysis, Intel Centre
- TOOLS: SOP Generator, Data Center, Documents
- CONFIGURATION: Intelligence Baseline, Business DNA, Integrations, Email, Email Inbox, Calendar
- SETTINGS: Settings

## Prioritized Backlog
### P1
- [ ] E2E calibration flow test with real data
- [ ] Performance optimization

### P2
- [ ] Refactor routes/profile.py
- [ ] Mobile responsive test
- [ ] Video call feature (not yet built)

## 53 Supabase Tables Referenced
See /app/memory/SCHEMA_REFERENCE.md for full table/column/usage mapping.
