# BIQc Platform — Complete Page-by-Page Feature Specification
## Every Screen. Every Feature. Every Data Source. Nothing Dropped.

**Date:** 22 February 2026
**Purpose:** Full mockup specification for the Liquid Steel platform rebuild. Every feature from the existing platform is accounted for — kept, relocated, or explicitly marked. This document is the single source of truth for the migration decision.

---

## READING KEY

For each page:
- **FEATURES ON THIS PAGE** — Exactly what the user sees and can do
- **DATA SOURCES** — Where each piece of data comes from (Edge Function / Backend Route / Supabase table / External API)
- **EXISTING CODE** — Current file(s) that power this feature today
- **STATUS** — EXISTING (already works) / HALF-BUILT (code exists but incomplete) / NEW (must be built)
- **TUTORIALS** — Whether tutorial content exists for this page

---

# PART A: PRE-LOGIN EXPERIENCE

---

## A1. MARKETING WEBSITE (`/site`)
**Status:** EXISTING (Liquid Steel — just built)

| Feature | Data Source | Status |
|---|---|---|
| Home page — hero, stats, architecture diagram | Static content | EXISTING |
| Platform page — problem/solution/architecture | Static content | EXISTING |
| Intelligence page — 6 analysis categories | Static content | EXISTING |
| Integrations page — logo grid, security details | Static content | EXISTING |
| Pricing page — hiring comparison | Static content | EXISTING |
| Trust page — sovereign hosting, security, legal | Static content | EXISTING |
| 5 Trust sub-pages — Terms, Privacy, DPA, Security, Trust Centre | Static content | EXISTING |

**Files:** `/app/frontend/src/pages/website/*.js`, `/app/frontend/src/components/website/WebsiteLayout.js`

---

## A2. LOGIN PAGE (`/site/platform/login` → migrates to `/login`)
**Status:** EXISTING (Liquid Steel mockup) + EXISTING (functional at `/login-supabase`)

| Feature | Data Source | Status |
|---|---|---|
| Email + password login | Supabase Auth | EXISTING |
| Google OAuth login | Supabase Auth + `GOOGLE_CLIENT_ID` | EXISTING |
| Microsoft OAuth login | Supabase Auth + `AZURE_CLIENT_ID` | EXISTING |
| Pre-filled email for returning users | localStorage | EXISTING |
| Trust panel (AES-256, real-time signals, zero leakage, sovereign hosting badge) | Static content | EXISTING (mockup) |
| "Don't have an account?" → Register | Router link | EXISTING |

**Files:** `LoginSupabase.js` (281 lines — functional), `PlatformLogin.js` (mockup)
**Backend:** `auth.py` → Supabase Auth API
**Secrets:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`

---

## A3. REGISTRATION PAGE (`/register`)
**Status:** EXISTING

| Feature | Data Source | Status |
|---|---|---|
| 6-field registration (name, email, password, company, industry, team size) | Supabase Auth + `users` table | EXISTING |
| Google/Microsoft social registration | Supabase Auth | EXISTING |
| Metadata capture on signup | Writes to `users.company_name`, `users.industry` | EXISTING |

**Files:** `RegisterSupabase.js` (328 lines)

---

# PART B: ONBOARDING & CALIBRATION (Not in main nav — separate flow)

---

## B1. ONBOARDING DECISION (`/onboarding-decision`)
**Status:** EXISTING

| Feature | Data Source | Status |
|---|---|---|
| Choice: Start calibration or skip/defer | `user_operator_profile.persona_calibration_status` | EXISTING |
| Auto-route if already calibrated | `strategic_console_state.is_complete` | EXISTING |

**Files:** `OnboardingDecision.js` (130 lines)

---

## B2. CALIBRATION ADVISOR (`/calibration`)
**Status:** EXISTING — Core experience

| Feature | Data Source | Status |
|---|---|---|
| 9-step psychology profiling chat | Edge: `calibration-psych` → OpenAI GPT-4o-mini | EXISTING |
| Communication style, verbosity, bluntness, risk posture, decision style, accountability cadence, time constraints, challenge tolerance, boundaries | Writes to `user_operator_profile.agent_persona` | EXISTING |
| Auto-save progress after each step | Backend: `calibration.py` → `/api/console/state` → `calibration_sessions` | EXISTING |
| Resume from where left off | Reads `calibration_sessions` | EXISTING |
| Auto-follow-up when AI acknowledges without asking | Frontend logic in `CalibrationAdvisor.js` | EXISTING |
| Input auto-focus, auto-scroll to latest message | Frontend UX | EXISTING |
| Website URL capture → auto-extract Business DNA | Edge: `calibration-business-dna` → Firecrawl + OpenAI | EXISTING (Edge Function built, **NOT YET DEPLOYED**) |
| Business DNA auto-population to Settings | Edge: `calibration-sync` → reads chat → writes to `business_profiles` + `strategy_profiles` | EXISTING (Edge Function built, **NOT YET DEPLOYED**) |
| WOW Summary / Executive Reveal | `WowSummary.js`, `ExecutiveReveal.js` | EXISTING |
| Strategic Map extraction (17-point) | Edge: `watchtower-brain` | EXISTING |

**Files:** `CalibrationAdvisor.js` (91 lines — orchestrator), `CalibratingSession.js`, `CalibrationComponents.js`, `ContinuitySuite.js`, `WowSummary.js`, `ExecutiveReveal.js`, `useCalibrationState.js`
**Backend:** `calibration.py` (1,482 lines)
**DB Tables:** `calibration_sessions`, `user_operator_profile`, `strategic_console_state`, `business_profiles`, `strategy_profiles`, `cognitive_profiles`
**Secrets:** `OPENAI_API_KEY`, `FIRECRAWL_API_KEY`
**Tutorial:** YES — 3 calibration stage tutorials exist

---

## B3. ONBOARDING WIZARD (`/onboarding`)
**Status:** EXISTING

| Feature | Data Source | Status |
|---|---|---|
| Step-by-step onboarding with progress tracking | Backend: `onboarding.py` | EXISTING |
| Integration prompts during onboarding | Merge.dev / Google / Microsoft OAuth | EXISTING |

**Files:** `OnboardingWizard.js` (820 lines)
**Backend:** `onboarding.py` (630 lines)

---

## B4. TUTORIAL SYSTEM (Overlay on every page)
**Status:** EXISTING — 21+ pages covered

| Feature | Data Source | Status |
|---|---|---|
| Modal tutorial on first visit to each page | localStorage tracking | EXISTING |
| "?" help button in header to re-trigger | `DashboardLayout.js` header | EXISTING |
| Back/Next navigation, dot indicators, X close | `TutorialOverlay.js` | EXISTING |
| Content for 21 authenticated pages + 3 calibration stages | Hardcoded tutorial content | EXISTING |

**Files:** `TutorialOverlay.js`

---

# PART C: MAIN PLATFORM — INTELLIGENCE GROUP

---

## C1. EXECUTIVE OVERVIEW (`/advisor` → `/overview`)
**Status:** EXISTING — Primary screen

### Features on this page:

| # | Feature | Data Source | Status |
|---|---|---|---|
| 1 | Greeting with time-of-day ("Good morning, Andre") | `useSnapshot()` → `owner`, `timeOfDay` | EXISTING |
| 2 | System state badge (STABLE / DRIFT / COMPRESSION / CRITICAL) | Edge: `biqc-insights-cognitive` → `system_state` | EXISTING |
| 3 | State velocity (worsening / improving / stable) | Edge: `biqc-insights-cognitive` → `system_state.velocity` | EXISTING |
| 4 | Confidence percentage | Edge: `biqc-insights-cognitive` → `confidence_level` | EXISTING |
| 5 | Cash runway (months) | Edge: `biqc-insights-cognitive` → `cash_runway_months` | EXISTING |
| 6 | 5 Cognition Group tabs (Money, Revenue, Operations, People, Market) | Edge: `biqc-insights-cognitive` → parsed by `parseToGroups()` | EXISTING |
| 7 | Alert count per group with severity badges | Parsed from `resolution_queue` | EXISTING |
| 8 | Resolution cards per group (title, detail, severity) | Edge: `biqc-insights-cognitive` → `resolution_queue` | EXISTING |
| 9 | Action buttons per card (Auto-Email, Quick-SMS, Hand Off, Dismiss) | Frontend UI only — **execution not wired** | HALF-BUILT |
| 10 | Group insight narrative | Edge: `biqc-insights-cognitive` → per-group insight | EXISTING |
| 11 | Weekly brief (cash, hours, actions, tasks, SOP compliance) | Edge: `biqc-insights-cognitive` → `weekly_brief` | EXISTING |
| 12 | Executive memo (full strategic narrative) | Edge: `biqc-insights-cognitive` → `executive_memo` | EXISTING |
| 13 | Strategic alignment check / contradictions | Edge: `biqc-insights-cognitive` → `strategic_alignment_check` | EXISTING |
| 14 | Refresh button (force re-generate) | `useSnapshot()` → `refresh()` | EXISTING |
| 15 | Cache age indicator | `useSnapshot()` → `cacheAge` | EXISTING |
| 16 | Check-in alerts (recalibration reminders) | Edge: `checkin-manager` + `CheckInAlerts.js` | EXISTING |
| 17 | Animated loading screen (Lottie) during data load | `CognitiveLoadingScreen.js` — randomised packs | EXISTING |
| 18 | Notification bell with badge count | Backend: `profile.py` → `/notifications/alerts` | EXISTING |

**Edge Function:** `biqc-insights-cognitive` (541 lines) — calls OpenAI + Perplexity + Merge.dev
**Backend:** `cognitive.py` (273 lines) — proxy to Edge Function
**Hook:** `useSnapshot.js` — stale-while-revalidate caching strategy
**DB Tables:** `intelligence_snapshots`, `intelligence_actions`, `integration_accounts`, `business_profiles`, `user_operator_profile`
**pg_cron:** Pre-computes every 4 hours for all active users
**Tutorial:** YES
**Secrets:** `OPENAI_API_KEY`, `MERGE_API_KEY`, `PERPLEXITY_API_KEY`

---

## C2. REVENUE MODULE (`/revenue`)
**Status:** EXISTING (as tab) → Becomes standalone page

### Features on this page:

| # | Feature | Data Source | Status |
|---|---|---|---|
| 1 | Revenue Health Score dial | Edge: `biqc-insights-cognitive` → revenue section | EXISTING |
| 2 | Pipeline Stability (total pipeline, weighted, active deals, stalled) | Edge: `biqc-insights-cognitive` + Merge.dev CRM API | EXISTING |
| 3 | Revenue Concentration (entropy, top deal dependency, deal bars with close probability) | Edge: `biqc-insights-cognitive` | EXISTING |
| 4 | Churn Probability (at-risk clients, revenue at risk, engagement signals) | Edge: `biqc-insights-cognitive` + email patterns from `email_priority` | EXISTING |
| 5 | Insight + "Why it matters" + "What to do" per panel | Edge: `biqc-insights-cognitive` | EXISTING |
| 6 | Auto-follow-up toggle per panel | Frontend toggle — **execution not wired** | HALF-BUILT |
| 7 | Cash trend chart (30 day mini-line) | Edge: `cfo-cash-analysis` | EXISTING |
| 8 | Deep analysis tool (ask a revenue question) | Edge: `strategic-console-ai` (ASK mode) | EXISTING |

**Edge Functions:** `biqc-insights-cognitive` + `cfo-cash-analysis` (316 lines, weekly via pg_cron)
**Existing pages absorbed:** `Analysis.js` (296 lines — performance analysis feeds into Revenue)
**Tutorial:** YES (Analysis tutorial content available)

---

## C3. OPERATIONS MODULE (`/operations`)
**Status:** EXISTING (as tab + separate pages) → Consolidate

### Features on this page:

| # | Feature | Data Source | Status |
|---|---|---|---|
| 1 | SLA breach count | Edge: `biqc-insights-cognitive` → operations section | EXISTING |
| 2 | Task aging percentage | Edge: `biqc-insights-cognitive` | EXISTING |
| 3 | Bottleneck identification | Edge: `biqc-insights-cognitive` | EXISTING |
| 4 | SOP compliance % | Edge: `biqc-insights-cognitive` | EXISTING |
| 5 | Team load distribution (Founder/Operations/Sales capacity %) | Edge: `biqc-insights-cognitive` → people section | EXISTING |
| 6 | Operational recommendations | Edge: `biqc-insights-cognitive` | EXISTING |
| 7 | **SOP Generator tool** (embedded — generate SOP, checklist, action plan on demand) | Edge: `sop-generator` (190 lines) → OpenAI | EXISTING |
| 8 | Operator metrics view | Currently: `OperatorDashboard.js` → merge in | EXISTING |

**Edge Functions:** `biqc-insights-cognitive` + `sop-generator`
**Existing pages absorbed:** `OperatorDashboard.js` (218 lines), `SOPGenerator.js` (377 lines — embedded as tool), `OpsAdvisoryCentre.js` (182 lines)
**DB Tables:** `sops` (generated SOPs stored here)
**Tutorial:** YES (SOP Generator + Operator View tutorials)

---

## C4. RISK MODULE (`/risk`)
**Status:** EXISTING (across 3 pages) → Consolidate

### Features on this page:

| # | Feature | Data Source | Status |
|---|---|---|---|
| 1 | Risk score overview by domain | Edge: `intelligence-bridge` → `intelligence_actions` grouped | EXISTING |
| 2 | Active risks list (Financial, Operational, Compliance, Market) | DB: `intelligence_actions` table | EXISTING |
| 3 | Watchtower findings feed | Edge: `watchtower-brain` → `watchtower_insights` | EXISTING |
| 4 | Deep-dive diagnosis tool ("Diagnose this risk") | Edge: `boardroom-diagnosis` (347 lines) → generates headline, narrative, what_to_watch, if_ignored | EXISTING |
| 5 | Contradiction detection | Edge: `biqc-insights-cognitive` → `alignment.contradictions` | EXISTING |
| 6 | Intelligence actions list with Read/Action/Ignore toggles | Backend: `intelligence_actions.py` → `/intelligence/actions` | EXISTING |
| 7 | Resolve action button | Backend: `intelligence_actions.py` → `/intelligence/actions/{id}/resolve` | EXISTING |

**Edge Functions:** `watchtower-brain` + `intelligence-bridge` + `boardroom-diagnosis`
**Existing pages absorbed:** `Diagnosis.js` (513 lines — drill-down tool), `IntelCentre.js` (161 lines — actions list)
**DB Tables:** `intelligence_actions`, `watchtower_insights`, `observation_events`, `escalation_memory`, `contradiction_memory`
**Backend:** `watchtower.py` + `intelligence_actions.py` + `boardroom.py`
**Tutorial:** YES (Diagnosis + Intel Centre tutorials)

---

## C5. COMPLIANCE MODULE (`/compliance`)
**Status:** EXISTING (as signals within cognitive output) → Promote to page

### Features on this page:

| # | Feature | Data Source | Status |
|---|---|---|---|
| 1 | Compliance score % | Edge: `biqc-insights-cognitive` → compliance signals | EXISTING |
| 2 | Upcoming deadlines (BAS, workers comp, insurance renewals) | Edge: `biqc-insights-cognitive` → regulatory items | EXISTING |
| 3 | Documentation gap alerts | Edge: `biqc-insights-cognitive` | EXISTING |
| 4 | Regulatory exposure list | Edge: `biqc-insights-cognitive` | EXISTING |
| 5 | Policy drift monitoring | Edge: `intelligence-bridge` → compliance-tagged actions | EXISTING |

**Edge Function:** `biqc-insights-cognitive` (compliance data already generated, just needs dedicated UI)

---

## C6. MARKET MODULE (`/market`)
**Status:** EXISTING (across 3 features) → Consolidate

### Features on this page:

| # | Feature | Data Source | Status |
|---|---|---|---|
| 1 | Competitor activity feed (weekly auto-scanned) | Edge: `competitor-monitor` (270 lines) → weekly pg_cron | EXISTING |
| 2 | Competitor SWOT (website, LinkedIn, social, reviews scrape) | Edge: `deep-web-recon` (473 lines) → Firecrawl + OpenAI | EXISTING |
| 3 | On-demand market analysis (product/service, region, question → SWOT + recommendations) | Edge: `market-analysis-ai` (264 lines) → OpenAI + Firecrawl | EXISTING |
| 4 | Pricing position vs market | Edge: `biqc-insights-cognitive` → market section | EXISTING |
| 5 | Market sentiment indicator | Edge: `biqc-insights-cognitive` → market section | EXISTING |
| 6 | Demand shift signals | Edge: `competitor-monitor` + `deep-web-recon` | EXISTING |

**Edge Functions:** `market-analysis-ai` + `competitor-monitor` + `deep-web-recon`
**Existing page absorbed:** `MarketAnalysis.js` (218 lines — embedded as on-demand tool)
**Secrets:** `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `FIRECRAWL_API_KEY`
**Tutorial:** YES (Market Analysis tutorial)

---

# PART D: MAIN PLATFORM — EXECUTION GROUP

---

## D1. ALERTS (`/alerts`)
**Status:** EXISTING (embedded in dashboard) → Extract to standalone

### Features on this page:

| # | Feature | Data Source | Status |
|---|---|---|---|
| 1 | Alert list grouped by Critical / Moderate / Informational | Edge: `biqc-insights-cognitive` → `resolution_queue` + `intelligence-bridge` → `intelligence_actions` | EXISTING |
| 2 | Each alert: title, business impact, suggested action | Edge function output | EXISTING |
| 3 | Expandable detail panel per alert | Frontend UX | EXISTING |
| 4 | Action buttons: Auto-Email, Quick-SMS, Hand Off | Frontend UI — **execution not wired** | HALF-BUILT |
| 5 | Dismiss & Learn (mark resolved + feedback) | Backend: `intelligence_actions.py` → `/intelligence/actions/{id}/resolve` | EXISTING |
| 6 | Notification bell count (smart notifications) | Backend: `profile.py` → `/notifications/alerts` (scans emails, calendar, intelligence) | EXISTING |
| 7 | Dismissed notification tracking | DB: `dismissed_notifications` table | EXISTING |
| 8 | **Email feed** — high-priority emails surfaced as alerts | Edge: `email_priority` (321 lines) → categorises Gmail/Outlook emails | EXISTING |
| 9 | **SMS feed** — incoming SMS signals | **NOT BUILT** — needs SMS provider integration (Twilio) | NEW |

**Edge Functions:** `biqc-insights-cognitive` + `intelligence-bridge` + `email_priority`
**Backend:** `intelligence_actions.py` + `profile.py` (notification endpoints)
**DB Tables:** `intelligence_actions`, `dismissed_notifications`, `outlook_emails`

---

## D2. ACTIONS (`/actions`)
**Status:** PARTIALLY EXISTS → Needs execution backend

### Features on this page:

| # | Feature | Data Source | Status |
|---|---|---|---|
| 1 | **SoundBoard** — strategic sounding board chat (test ideas, scenarios, decisions) | Edge: `strategic-console-ai` (ASK mode — 330 lines) + Backend: `soundboard.py` (257 lines) | EXISTING |
| 2 | SoundBoard conversation history | DB: `soundboard_conversations` | EXISTING |
| 3 | **Strategic Console** — full executive briefing + ask-anything | Edge: `strategic-console-ai` (BRIEF mode) | EXISTING |
| 4 | Auto-Email composer (draft + send email to client/contact) | **NOT BUILT** — needs email provider (Resend/SendGrid) | NEW |
| 5 | Quick-SMS sender (send text to contact) | **NOT BUILT** — needs SMS provider (Twilio) | NEW |
| 6 | Hand Off task creator (create task in project management tool) | **NOT BUILT** — needs Merge.dev Ticketing or direct API | NEW |
| 7 | Voice Chat (video/voice call with AI advisor) | `VoiceChat.js` component exists | HALF-BUILT |
| 8 | Action history / audit trail | **NOT BUILT** — needs logging | NEW |

**Edge Functions:** `strategic-console-ai`
**Existing pages absorbed:** `MySoundBoard.js` (465 lines — embedded), `WarRoomConsole` component (BRIEF mode → Report generation)
**Backend:** `soundboard.py` (257 lines), `strategic_console.py` (355 lines)
**DB Tables:** `soundboard_conversations`, `chat_history`, `strategic_console_state`
**Tutorial:** YES (SoundBoard + Strategic Console tutorials)

---

## D3. AUTOMATIONS (`/automations`)
**Status:** NEW — Mockup built, no backend

### Features on this page:

| # | Feature | Data Source | Status |
|---|---|---|---|
| 1 | IF/THEN rule builder (visual condition → action) | **NOT BUILT** | NEW |
| 2 | Active/Paused toggle per automation | **NOT BUILT** | NEW |
| 3 | Run counter and last run timestamp | **NOT BUILT** | NEW |
| 4 | Edit, Pause, Delete controls | **NOT BUILT** | NEW |
| 5 | Audit log link per automation | **NOT BUILT** | NEW |
| 6 | Pre-built templates (overdue invoice follow-up, new lead auto-response, churn alert, overtime alert) | **NOT BUILT** | NEW |

**Needs:** New Edge Function `automation-engine`, new DB table `automations`, new scheduler
**Mockup:** `AutomationsPage.js` exists with static data

---

# PART E: MAIN PLATFORM — SYSTEMS GROUP

---

## E1. INTEGRATIONS (`/integrations`)
**Status:** EXISTING — Major page (1,349 lines)

### Features on this page:

| # | Feature | Data Source | Status |
|---|---|---|---|
| 1 | Connected systems grid with sync status | Edge: `integration-status` + Backend: `integrations.py` | EXISTING |
| 2 | Connect CRM (HubSpot, Salesforce, Pipedrive) via Merge.dev | Merge.dev OAuth → `integration_accounts` | EXISTING |
| 3 | Connect Accounting (Xero, MYOB, QuickBooks) via Merge.dev | Merge.dev OAuth → `integration_accounts` | EXISTING |
| 4 | Connect Gmail | Edge: `gmail_prod` → Google OAuth → `gmail_connections` | EXISTING |
| 5 | Connect Outlook/M365 | Edge: `outlook-auth` → Microsoft OAuth → `m365_tokens` | EXISTING |
| 6 | Connect Google Drive | Backend: `integrations.py` → Google Drive API → `google_drive_files` | EXISTING |
| 7 | Disconnect integration | Backend: `integrations.py` → `/integrations/disconnect` | EXISTING (but **frontend buttons missing for CRM/Accounting** — only email has disconnect) |
| 8 | Last sync timestamp per integration | DB: `integration_accounts.connected_at` | EXISTING |
| 9 | Slide-out detail panel (data types, sync frequency, permissions, disconnect) | **NOT BUILT** for current page (built in mockup) | HALF-BUILT |
| 10 | Cold-read indicator (data ingestion without live API) | Backend: `integrations.py` → cold-read logic | EXISTING |
| 11 | **Email inbox view** (prioritised emails with AI context) | Edge: `email_priority` → `EmailInbox.js` (756 lines) | EXISTING |
| 12 | **Calendar view** (connected calendar events) | `CalendarView.js` (301 lines) | EXISTING |

**Edge Functions:** `integration-status` + `gmail_prod` + `outlook-auth`
**Backend:** `integrations.py` (1,185 lines) + `email.py` (1,855 lines)
**Background worker:** `email_sync_worker.py` (runs continuously, syncs all email accounts)
**DB Tables:** `integration_accounts`, `gmail_connections`, `m365_tokens`, `outlook_oauth_tokens`, `outlook_emails`, `google_drive_files`
**Secrets:** `MERGE_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
**Existing pages to embed/relocate:**
- `ConnectEmail.js` (480 lines) → embed email connection within Integrations
- `EmailInbox.js` (756 lines) → keep as sub-view OR move to Alerts as email feed
- `CalendarView.js` (301 lines) → keep as sub-view within Integrations
**Tutorial:** YES (Integrations + Email Connection + Email Inbox + Calendar tutorials)

---

## E2. DATA HEALTH (`/data-health`)
**Status:** EXISTING → Rename

### Features on this page:

| # | Feature | Data Source | Status |
|---|---|---|---|
| 1 | Data quality score | Backend: `data_center.py` → aggregated stats | EXISTING |
| 2 | Recent data ingestion activity | Backend: `data_center.py` → `/data-center/recent` | EXISTING |
| 3 | Signal coverage map (what % of business is BIQc seeing) | DB: `observation_events` count + `integration_accounts` | EXISTING |
| 4 | Sync health per integration | Edge: `integration-status` | EXISTING |
| 5 | File upload / document storage | DB: `data_files`, `documents` | EXISTING |

**Backend:** `data_center.py` (130 lines)
**Existing page:** `DataCenter.js` (607 lines) → rename to Data Health
**Tutorial:** YES

---

# PART F: MAIN PLATFORM — GOVERNANCE GROUP

---

## F1. REPORTS (`/reports`)
**Status:** EXISTING (across 3 features) → Consolidate

### Features on this page:

| # | Feature | Data Source | Status |
|---|---|---|---|
| 1 | Board Room deep-dive diagnosis (generate report on focus area) | Edge: `boardroom-diagnosis` → OpenAI | EXISTING |
| 2 | Executive briefing generator (full company intelligence brief) | Edge: `strategic-console-ai` (BRIEF mode) | EXISTING |
| 3 | Document library (stored reports, SOPs, uploads) | DB: `documents`, `sops`, `analyses`, `diagnoses` | EXISTING |
| 4 | Document viewer | `DocumentView.js` | EXISTING |
| 5 | Report history | DB: `intelligence_snapshots` ordered by date | EXISTING |

**Edge Functions:** `boardroom-diagnosis` + `strategic-console-ai`
**Existing pages absorbed:** `Documents.js` (226 lines), `DocumentView.js` (181 lines), `BoardRoom` component
**Backend:** `boardroom.py` (245 lines) + `strategic_console.py` (355 lines)
**Tutorial:** YES (Board Room + Documents tutorials)

---

## F2. AUDIT LOG (`/audit`)
**Status:** PARTIALLY EXISTS (DB table) → Needs frontend

### Features on this page:

| # | Feature | Data Source | Status |
|---|---|---|---|
| 1 | AI API call log (function, provider, model, tokens, cost) | DB: `usage_tracking` (EXISTS — written by all Edge Functions) | DB EXISTS, **no frontend** |
| 2 | Prompt change log | DB: `prompt_audit_logs` (EXISTS) | DB EXISTS, **no frontend** |
| 3 | User action log | **NOT BUILT** | NEW |
| 4 | Cost summary per period | Aggregation on `usage_tracking` | DB EXISTS, **no frontend** |
| 5 | Data export | **NOT BUILT** — GDPR/Privacy Act requirement | NEW |

**DB Tables:** `usage_tracking`, `prompt_audit_logs`

---

## F3. SETTINGS (`/settings`)
**Status:** EXISTING — Consolidate sub-pages

### Features on this page:

| # | Feature | Data Source | Status |
|---|---|---|---|
| 1 | Account information (name, email, company, industry) | DB: `users` table | EXISTING |
| 2 | **Business DNA** (17 strategic dimensions — auto-populated from calibration) | DB: `business_profiles` (auto-filled by `calibration-sync`) | EXISTING |
| 3 | Strategy profiles (mission, vision, goals, challenges — AI-refined) | DB: `strategy_profiles` | EXISTING |
| 4 | Intelligence baseline configuration | DB: `intelligence_baseline`, `intelligence_priorities` | EXISTING |
| 5 | Operator profile (persona calibration status, agent persona, custom instructions) | DB: `user_operator_profile` | EXISTING |
| 6 | Recalibration scheduling | Edge: `checkin-manager` → `calibration_schedules` | EXISTING |
| 7 | Working schedule configuration | DB: `working_schedules` | EXISTING |
| 8 | Notification preferences | Currently hardcoded — needs preference system | HALF-BUILT |
| 9 | Subscription / billing management | **NOT BUILT** — needs Stripe integration | NEW |
| 10 | Data export ("Download my data") | **NOT BUILT** — privacy requirement | NEW |
| 11 | "Sync Profile" button (re-run calibration-sync) | Edge: `calibration-sync` | EXISTING (button exists, function **not deployed**) |

**Edge Functions:** `calibration-sync` + `checkin-manager`
**Existing pages absorbed:** `BusinessProfile.js` (495 lines — Business DNA tabs), `IntelligenceBaseline.js` (304 lines)
**Backend:** `profile.py` (1,917 lines — needs refactoring into smaller files)
**DB Tables:** `users`, `business_profiles`, `strategy_profiles`, `user_operator_profile`, `intelligence_baseline`, `intelligence_priorities`, `calibration_schedules`, `working_schedules`, `cognitive_profiles`
**Tutorial:** YES (Settings + Business DNA + Intelligence Baseline tutorials)

---

# PART G: SUPER ADMIN PORTAL

---

## G1. ADMIN DASHBOARD (`/admin`)
**Status:** EXISTING

| Feature | Data Source | Status |
|---|---|---|
| Platform stats (total users, active, calibrated) | Backend: `admin.py` → `/admin/stats` → `users` table | EXISTING |
| User list with search/filter | Backend: `admin.py` → `/admin/users` | EXISTING |
| User detail view (integrations, calibration, snapshots, signals) | Direct Supabase queries in `AdminDashboard.js` | EXISTING |
| Suspend / Unsuspend user | Backend: `admin.py` → `/admin/users/{id}/suspend` + `/unsuspend` | EXISTING |
| Update user (name, role, tier, master account flag) | Backend: `admin.py` → PUT `/admin/users/{id}` | EXISTING |
| Delete user | Backend: `admin.py` → DELETE `/admin/users/{id}` | EXISTING |
| Impersonate user ("View as") | Backend: `admin.py` → `/admin/users/{id}/impersonate` | EXISTING |
| Backfill calibration status | Backend: `admin.py` → `/admin/backfill-calibration` | EXISTING |

**Files:** `AdminDashboard.js` (492 lines), `admin.py` (309 lines)

---

## G2. PROMPT LAB (`/admin/prompt-lab`)
**Status:** EXISTING

| Feature | Data Source | Status |
|---|---|---|
| List all AI system prompts (15+ agents) | Backend: `admin.py` → `/admin/prompts` → `system_prompts` table | EXISTING |
| View prompt detail with full text | Backend: `admin.py` → `/admin/prompts/{key}` | EXISTING |
| Invalidate prompt cache | Backend: `admin.py` → `/admin/prompts/invalidate` | EXISTING |
| Prompt audit log | DB: `prompt_audit_logs` | EXISTING |

**Files:** `PromptLab.js` (490 lines)

---

## G3–G8. NEW SUPER ADMIN MODULES (Not yet built)

| Module | Purpose | Status |
|---|---|---|
| **Sales Pipeline** | Track leads, demos, trials, conversions | NEW |
| **Support Console** | Client health scores, proactive outreach, integration issues | NEW |
| **Billing & Subscriptions** | Stripe integration, subscription management, invoicing | NEW |
| **Partner Management** | Reseller accounts, commissions, billing splits | NEW |
| **Usage & Cost Dashboard** | Per-client API costs (reads `usage_tracking`) | DB EXISTS, needs frontend |
| **System Health** | Edge Function monitoring, DB health, sync status | Backend: `health.py` EXISTS, needs enhanced frontend |

---

# PART H: ADMIN / RESELLER PORTAL (NEW)

All modules in this section are **NEW — not yet built**.

| Module | Purpose | DB Schema Needed |
|---|---|---|
| **My Clients** | List clients under partner, health scores, last login | `accounts` with `parent_id` |
| **Add Client** | Create child account, send invite, set tier | `accounts`, `users` |
| **Client Billing** | Per-client billing, invoices, commissions | New billing tables + Stripe |
| **Client Health** | Aggregated health of all clients | Reads from `intelligence_snapshots` |
| **White Label** | Custom branding per partner | New `partner_branding` table |
| **Onboarding Tracker** | Client calibration + integration status | Reads existing tables |

---

# PART I: BACKGROUND WORKERS & SCHEDULED JOBS

| Worker/Job | Status | What It Does |
|---|---|---|
| `email_sync_worker.py` | EXISTING — runs via supervisor | Continuously syncs emails for all connected accounts (Gmail + Outlook). Interval: 60 seconds. |
| `intelligence_automation_worker.py` | EXISTING — runs via supervisor | Automatic intelligence generation. Daily scans, silence detection, regeneration governance. |
| pg_cron: `biqc-insights-cognitive` pre-compute | EXISTING | Pre-computes cognitive snapshots for all active users every 4 hours |
| pg_cron: `cfo-cash-analysis` weekly | EXISTING | Weekly financial analysis batch for all users |
| pg_cron: `competitor-monitor` weekly | EXISTING | Weekly competitor scanning batch for all users |
| pg_cron: Edge Function warmup | EXISTING | Pings Edge Functions every 4 minutes to prevent cold starts |

---

# PART J: COMPLETE BACKLOG & TECH DEBT

## Half-Built Features (Code exists, not complete)

| Feature | Current State | What's Missing |
|---|---|---|
| Auto-Email execution | UI buttons exist on alert cards | No email provider connected (Resend/SendGrid). No send logic. |
| Quick-SMS execution | UI buttons exist | No SMS provider (Twilio). No send logic. |
| Hand Off execution | UI button exists | No task creation API. No Merge.dev Ticketing wired. |
| Voice Chat | `VoiceChat.js` component exists with full UI | Needs voice AI provider (Jitsi/Daily.co/Twilio Voice). Not wired. |
| Integration disconnect buttons | Backend logic exists | Frontend only shows disconnect for email. CRM/Accounting missing. |
| calibration-business-dna | Edge Function fully built (275 lines) | **Not deployed to Supabase** |
| calibration-sync | Edge Function fully built (182 lines) | **Not deployed to Supabase** |
| Notification preferences | Bell icon + notification scanning works | No user preference settings (which notifications to receive) |
| Subscription billing | Pricing page shows tiers | No Stripe integration. No payment flow. |
| Data export | — | Not built. GDPR/Privacy Act requirement. |
| Full-text search | GIN indexes exist in DB | No search UI exists. |
| Integration slide-out detail panel | Mockup built in Liquid Steel | Not in production Integrations page |

## Orphaned Backend Endpoints (No frontend caller)

| Endpoint | File | What It Does |
|---|---|---|
| `/advisory/*` | profile.py | Full advisory system | 
| `/account/users/invite` | profile.py | Team invitation system |
| `/analyses`, `/analyses/{id}` | generation.py | Analysis CRUD |
| Multiple profile CRUD endpoints | profile.py | Various profile management |

## Files Needing Refactoring (Too large)

| File | Lines | Should Split Into |
|---|---|---|
| `profile.py` | 1,917 | profile_crud.py, strategy_profiles.py, operator_profiles.py, notifications.py |
| `email.py` | 1,855 | email_connect.py, email_sync.py, email_intelligence.py |
| `calibration.py` | 1,482 | calibration_flow.py, calibration_state.py |
| `integrations.py` | 1,185 | integrations_merge.py, integrations_email.py, integrations_drive.py |

## Secrets Needing Consolidation

| Current | Should Be | Issue |
|---|---|---|
| `Perplexity_API` | `PERPLEXITY_API_KEY` | Two names for same key |
| `Calibration-Psych` | `OPENAI_API_KEY` | Custom name, should use shared key |
| `calibration_psych` (Edge Function) | `calibration-psych` | Duplicate function, delete underscore version |

---

# PART K: COMPETITOR LANDSCAPE

## Direct Competitors

| Competitor | What They Do | Pricing | BIQc Advantage |
|---|---|---|---|
| **Mosaic** | Real-time FP&A. 150+ metrics, Arc AI chatbot, 800+ integrations. SaaS/FinTech focused. | $$$ per seat | Finance only. BIQc covers finance + operations + people + market + compliance. |
| **Datarails** | Excel-native FP&A. AI error detection, data consolidation. | Contact sales | Requires spreadsheets. BIQc connects live systems. |
| **Fathom** | Reporting & forecasting for accountants. | $$ | Backward-looking. BIQc predicts and prevents. |
| **Digits** | AI bookkeeping. Automated categorisation. | $$ | Bookkeeping only. BIQc is strategic intelligence. |
| **Domo** | Enterprise BI. 1,000+ connectors. AI dashboards. | $$$$$ | Enterprise-priced. Too complex for 10-150 staff SMBs. |
| **Vena Solutions** | Excel-native FP&A with Copilot. | $$$$$ | Months to implement. BIQc is live in 10 minutes. |
| **Power BI** | Build-your-own BI dashboards. | $$ | Requires an analyst to BUILD dashboards. BIQc generates autonomously. |
| **Zoho Analytics** | SMB-friendly BI dashboarding. | $ | Manual dashboard setup. BIQc auto-calibrates from conversation. |
| **Qlik** | Augmented analytics, data integration. | $$$$ | Needs data team. BIQc configures itself. |

## Adjacent / Partial Overlap

| Competitor | Overlap | BIQc Advantage |
|---|---|---|
| **Ramp / Brex / Mercury** | Spend management, expense AI | Banking products with insights bolted on. BIQc monitors entire business. |
| **Pilot** | AI bookkeeping | Does books. BIQc tells you what books MEAN strategically. |
| **Journey AI** | AI task automation for SMBs | Automates tasks. BIQc monitors business and recommends WHAT tasks should exist. |
| **Cognosys** | No-code data→reports | A tool. BIQc is an always-on system. You don't ask — it tells you. |
| **Microsoft 365 Copilot** | AI in Office apps | Embedded in Office tools. BIQc crosses ALL business systems, not just Microsoft. |

## BIQc's Moat (No competitor does ALL of these)

1. **Conversational calibration** — learns the business in 10 minutes via chat
2. **Psychology-calibrated delivery** — matches each owner's communication style
3. **Cross-domain monitoring** — finance + revenue + ops + people + market + compliance in ONE system
4. **Autonomous 24/7 operation** — pg_cron runs analysis without user interaction
5. **One-click execution** — alerts come with drafted actions ready to execute
6. **Australian sovereign hosting** — all data stays in AU
7. **Reseller/partner channel** — parent-child billing model
8. **SMB-specific** — not dumbed-down enterprise, but purpose-built for 10-150 staff

---

# SUMMARY: NOTHING IS DROPPED

| Category | Total Features | Kept | Relocated/Merged | New |
|---|---|---|---|---|
| Intelligence (6 modules) | 48+ features | 45 | 3 pages merge in | 0 |
| Execution (3 modules) | 18+ features | 8 | 2 merge in | 8 new |
| Systems (2 modules) | 12+ features | 10 | 4 pages merge in | 2 enhancements |
| Governance (3 modules) | 15+ features | 8 | 3 merge in | 4 new |
| Onboarding/Calibration | 15+ features | 15 | 0 | 0 |
| Super Admin | 10+ features | 8 | 0 | 5 new modules |
| Admin/Reseller | 0 | 0 | 0 | 6 new modules |
| Background workers | 6 jobs | 6 | 0 | 0 |
| Tutorials | 21+ pages | 21+ | 0 | New pages get tutorials |
| Edge Functions | 20 | 18 | 0 | Delete 2 duplicates |

**Every existing feature is accounted for. Nothing is dropped. Features are consolidated, not eliminated.**
