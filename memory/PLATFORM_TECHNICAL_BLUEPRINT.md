# BIQc Platform — Complete Technical Blueprint
## Every Menu Item, Every Function, Every Dependency

---

## HOW TO READ THIS DOCUMENT

Each menu item below shows:
- **What the user sees and does**
- **Edge Function** that powers it
- **Backend Route** (FastAPI) that proxies or handles logic
- **Database Tables** read/written
- **Secrets/API Keys** required
- **Scheduled Jobs** (pg_cron) if any
- **Frontend Page** file
- **Verdict**: KEEP / ABSORB / DELETE / NEW

---

## SECTION 1: USER-FACING PLATFORM (Owner + Team)

---

### INTELLIGENCE GROUP

---

#### 1. EXECUTIVE OVERVIEW
> *"One screen. Everything that matters today."*

| Layer | Component | Detail |
|---|---|---|
| **What user sees** | Health strip (Business Health %, Cash Risk, Revenue Stability, Operational Drift, Compliance), "What Needs Attention" cards with action buttons, Financial Snapshot (cash trend, receivables, margin), Intelligence Pulse (systems connected, signals monitored, alerts, issues prevented), Executive memo, Strategic alignment check |
| **Edge Function** | `biqc-insights-cognitive` (541 lines) |
| **What it calls** | OpenAI GPT-4o (cognitive analysis), Perplexity (market context), Merge.dev API (CRM deals, invoices, contacts) |
| **Backend Route** | `cognitive.py` → `/cognitive/snapshot`, `/cognitive/insights` |
| **DB Tables READ** | `users`, `business_profiles`, `strategy_profiles`, `user_operator_profile`, `integration_accounts`, `intelligence_snapshots`, `intelligence_actions`, `observation_events`, `calibration_sessions` |
| **DB Tables WRITE** | `intelligence_snapshots` (cached results), `usage_tracking` (API costs) |
| **Secrets** | `OPENAI_API_KEY`, `MERGE_API_KEY`, `PERPLEXITY_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **pg_cron** | Yes — pre-computes snapshots for all active users every 4 hours |
| **Frontend** | Currently: `AdvisorWatchtower.js` (296 lines) → New: Liquid Steel `ExecOverview.js` |
| **Verdict** | **KEEP — Repurpose UI** |

---

#### 2. REVENUE
> *"Where is my revenue risk? Which deals are stalling? Who might churn?"*

| Layer | Component | Detail |
|---|---|---|
| **What user sees** | Revenue Health Score dial, Pipeline Stability panel (total pipeline, weighted value, stalled deals), Revenue Concentration panel (entropy, deal bars), Churn Probability panel (at-risk clients, revenue at risk) |
| **Edge Function** | `biqc-insights-cognitive` (revenue section of cognitive output) + `cfo-cash-analysis` (316 lines) |
| **What it calls** | OpenAI (analysis), Merge.dev CRM API (deals, pipeline, contacts), Merge.dev Accounting API (invoices, revenue) |
| **Backend Route** | `cognitive.py` + `generation.py` → `/generate/snapshot` |
| **DB Tables READ** | `integration_accounts` (Merge tokens), `intelligence_snapshots`, `business_profiles` |
| **DB Tables WRITE** | `intelligence_actions` (revenue alerts), `usage_tracking` |
| **Secrets** | `OPENAI_API_KEY`, `MERGE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **pg_cron** | `cfo-cash-analysis` runs weekly batch for all users |
| **Frontend** | Currently: Revenue tab in `AdvisorWatchtower.js` + `Analysis.js` (296 lines) → New: `RevenueModule.js` |
| **Pages absorbed** | `Analysis.js` — **DELETE standalone page** |
| **Verdict** | **KEEP — Extract from dashboard into standalone module** |

---

#### 3. OPERATIONS
> *"SLA breaches, bottlenecks, team utilisation, and generate SOPs on demand."*

| Layer | Component | Detail |
|---|---|---|
| **What user sees** | SLA breach count, task aging %, bottleneck identification, SOP compliance %, team load distribution, SOP generator tool |
| **Edge Functions** | `biqc-insights-cognitive` (operations section) + `sop-generator` (190 lines) |
| **What it calls** | OpenAI (SOP generation + operational analysis), Merge.dev (project/task data if connected) |
| **Backend Route** | `cognitive.py` + `generation.py` → SOP generation endpoints |
| **DB Tables READ** | `business_profiles`, `intelligence_snapshots`, `user_operator_profile` |
| **DB Tables WRITE** | `documents` (generated SOPs), `usage_tracking` |
| **Secrets** | `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Frontend** | Currently: Operations tab in `AdvisorWatchtower.js` + `SOPGenerator.js` (377 lines) + `OperatorDashboard.js` (218 lines) |
| **Pages absorbed** | `SOPGenerator.js` (tool within module), `OperatorDashboard.js` (**DELETE** — simplified duplicate), `OpsAdvisoryCentre.js` (182 lines, **DELETE** — generic advisory) |
| **Verdict** | **KEEP — Merge 3 pages into 1 module** |

---

#### 4. RISK
> *"Every risk ranked by severity. Drill into any one for a board-level diagnosis."*

| Layer | Component | Detail |
|---|---|---|
| **What user sees** | Risk score overview, active risks by domain (Financial, Operational, Compliance, Market), drill-down diagnosis with narrative + evidence + consequences, intelligence actions list |
| **Edge Functions** | `watchtower-brain` (88 lines) + `intelligence-bridge` (183 lines) + `boardroom-diagnosis` (347 lines) |
| **What it calls** | OpenAI (diagnosis generation, risk narrative), user's connected data via Merge.dev |
| **Backend Routes** | `watchtower.py` → `/watchtower/run`, `intelligence_actions.py` → `/intelligence/actions`, `boardroom.py` → `/boardroom/diagnosis` |
| **DB Tables READ** | `intelligence_actions`, `watchtower_insights`, `intelligence_snapshots`, `observation_events`, `business_profiles` |
| **DB Tables WRITE** | `intelligence_actions` (new actions from findings), `watchtower_insights`, `usage_tracking` |
| **Secrets** | `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Frontend** | Currently: `Diagnosis.js` (513 lines) + `IntelCentre.js` (161 lines) + `Watchtower` component |
| **Pages absorbed** | `Diagnosis.js` (**DELETE** — becomes drill-down tool), `IntelCentre.js` (**DELETE** — action list moves to Alerts) |
| **Verdict** | **KEEP — Merge 3 features into 1 module** |

---

#### 5. COMPLIANCE
> *"Never miss a BAS deadline, insurance renewal, or regulatory requirement."*

| Layer | Component | Detail |
|---|---|---|
| **What user sees** | Compliance score %, upcoming deadlines (BAS, workers comp, insurance), documentation gaps, regulatory exposure list, policy drift alerts |
| **Edge Function** | `biqc-insights-cognitive` (compliance section of cognitive output) |
| **What it calls** | OpenAI (compliance extraction from connected data) |
| **Backend Route** | `cognitive.py` |
| **DB Tables READ** | `intelligence_snapshots` (compliance signals), `business_profiles` |
| **DB Tables WRITE** | `intelligence_actions` (compliance alerts) |
| **Secrets** | `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Frontend** | Currently: Compliance indicators within `AdvisorWatchtower.js` → New: standalone Compliance module |
| **Verdict** | **KEEP — Promote from tab to full module** |

---

#### 6. MARKET
> *"What competitors did this week. SWOT analysis on demand. Pricing position."*

| Layer | Component | Detail |
|---|---|---|
| **What user sees** | Competitor activity feed (weekly auto-scan), on-demand SWOT analysis tool, pricing position vs market, demand shift signals, regulatory change alerts |
| **Edge Functions** | `market-analysis-ai` (264 lines) + `competitor-monitor` (270 lines) + `deep-web-recon` (473 lines) |
| **What it calls** | OpenAI (analysis), Perplexity (live web research), Firecrawl (website scraping) |
| **Backend Route** | `research.py` → `/research/market`, `/research/competitor` |
| **DB Tables READ** | `business_profiles` (competitors from calibration), `intelligence_actions`, `observation_events` |
| **DB Tables WRITE** | `observation_events` (competitor signals), `intelligence_actions` (market alerts), `usage_tracking` |
| **Secrets** | `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `FIRECRAWL_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **pg_cron** | `competitor-monitor` runs weekly batch scan for all users |
| **Frontend** | Currently: `MarketAnalysis.js` (218 lines) → New: Market module |
| **Pages absorbed** | `MarketAnalysis.js` (**DELETE** — becomes tool within module) |
| **Verdict** | **KEEP — Merge 3 Edge Functions into 1 module** |

---

### EXECUTION GROUP

---

#### 7. ALERTS
> *"Every alert ranked. Business impact explained. One-click action."*

| Layer | Component | Detail |
|---|---|---|
| **What user sees** | Prioritised alert list grouped by Critical / Moderate / Informational. Each shows: issue title, business impact, suggested action, execute buttons (Auto-Email, Quick-SMS, Hand Off) |
| **Edge Functions** | `biqc-insights-cognitive` (resolution_queue output) + `intelligence-bridge` (converts findings to actions) |
| **Backend Route** | `intelligence_actions.py` → `/intelligence/actions`, `/intelligence/actions/{id}/resolve` + `onboarding.py` (notification scanning endpoints) |
| **DB Tables READ** | `intelligence_actions`, `intelligence_snapshots` (resolution_queue), `observation_events` |
| **DB Tables WRITE** | `intelligence_actions` (mark resolved), `dismissed_notifications` |
| **Secrets** | (Uses data already generated by other functions) |
| **Frontend** | Currently: Resolution cards within `AdvisorWatchtower.js` + notification bell → New: standalone Alerts page |
| **Verdict** | **KEEP — Extract into standalone module** |

---

#### 8. ACTIONS
> *"Execute: send emails, SMS, delegate tasks. Test ideas with your AI sounding board."*

| Layer | Component | Detail |
|---|---|---|
| **What user sees** | Action execution panel (Auto-Email composer, Quick-SMS sender, Hand Off task creator), Strategic Sounding Board (chat-based idea testing) |
| **Edge Function** | `strategic-console-ai` (ASK mode — 330 lines) |
| **Backend Route** | `soundboard.py` → `/soundboard/sessions`, `/soundboard/chat` + `strategic_console.py` |
| **DB Tables READ** | `soundboard_conversations`, `business_profiles`, `intelligence_snapshots` |
| **DB Tables WRITE** | `soundboard_conversations`, `chat_history`, `usage_tracking` |
| **Secrets** | `OPENAI_API_KEY`, `MERGE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Frontend** | Currently: `MySoundBoard.js` (465 lines) → New: Actions module |
| **Pages absorbed** | `MySoundBoard.js` (**DELETE** — becomes sounding board within Actions) |
| **What's NEW** | Auto-Email execution needs **email provider** (Resend or SendGrid). Quick-SMS needs **Twilio**. Hand Off needs task creation API. **None of these exist yet.** |
| **Verdict** | **PARTIALLY EXISTS — Sounding board keeps, execution layer is NEW** |

---

#### 9. AUTOMATIONS
> *"Set rules. BIQc handles the rest. Invoice chasing, lead follow-up, overtime alerts."*

| Layer | Component | Detail |
|---|---|---|
| **What user sees** | IF/THEN rule builder. Toggle on/off. Run history. Audit trail link. |
| **Edge Function** | **NONE — ENTIRELY NEW** |
| **Backend Route** | **NONE — ENTIRELY NEW** |
| **DB Tables** | **NEW TABLE needed:** `automations` (id, user_id, name, condition, action, active, runs, last_run, created_at) |
| **Secrets** | Will need email/SMS provider keys |
| **Frontend** | **NEW** — `AutomationsPage.js` mockup exists |
| **What's needed** | New Edge Function: `automation-engine`. New scheduler. New execution pipeline. |
| **Verdict** | **ENTIRELY NEW — Must be built** |

---

### SYSTEMS GROUP

---

#### 10. INTEGRATIONS
> *"Connect Xero, HubSpot, Gmail. See exactly what BIQc accesses. Disconnect anytime."*

| Layer | Component | Detail |
|---|---|---|
| **What user sees** | Connected systems grid with sync status, available platforms to connect, click-to-open detail panel (data types ingested, sync frequency, permission scope, disconnect button) |
| **Edge Functions** | `integration-status` (189 lines) + `gmail_prod` (277 lines) + `outlook-auth` (281 lines) |
| **What it calls** | Google OAuth API, Microsoft Graph API, Merge.dev API (CRM + Accounting connection) |
| **Backend Route** | `integrations.py` (1,185 lines) → `/integrations/connect/*`, `/integrations/status`, `/integrations/disconnect` + `email.py` (1,855 lines) → `/email/connect/*` |
| **DB Tables READ** | `integration_accounts`, `gmail_connections`, `m365_tokens`, `outlook_oauth_tokens` |
| **DB Tables WRITE** | `integration_accounts`, `gmail_connections`, `m365_tokens` |
| **Secrets** | `MERGE_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` |
| **Frontend** | Currently: `Integrations.js` (1,349 lines) + `ConnectEmail.js` (480 lines) + `CalendarView.js` (301 lines) |
| **Pages absorbed** | `ConnectEmail.js` (**DELETE**), `CalendarView.js` (**DELETE**), `EmailInbox.js` (756 lines — **ABSORB** email intelligence into Alerts) |
| **Verdict** | **KEEP — Merge 4 pages into 1 module** |

---

#### 11. DATA HEALTH
> *"Is your data flowing? How much of your business does BIQc actually see?"*

| Layer | Component | Detail |
|---|---|---|
| **What user sees** | Data quality score, sync health per integration, signal coverage map, recent data ingestion activity |
| **Edge Function** | `integration-status` (shared with Integrations) |
| **Backend Route** | `data_center.py` (130 lines) → `/data-center/stats`, `/data-center/recent` |
| **DB Tables READ** | `integration_accounts`, `observation_events`, `data_files` |
| **Frontend** | Currently: `DataCenter.js` (607 lines) → Renamed to Data Health |
| **Verdict** | **KEEP — Rename + enhance UI** |

---

### GOVERNANCE GROUP

---

#### 12. REPORTS
> *"Board-ready reports in 30 seconds. All documents stored and searchable."*

| Layer | Component | Detail |
|---|---|---|
| **What user sees** | Generate on-demand reports (focus area diagnosis), executive briefing generator, document library, report history |
| **Edge Functions** | `boardroom-diagnosis` (347 lines) + `strategic-console-ai` (BRIEF mode — 330 lines) |
| **What it calls** | OpenAI (report generation), Merge.dev (data context) |
| **Backend Routes** | `boardroom.py` → `/boardroom/diagnosis` + `strategic_console.py` → `/strategic-console/brief` |
| **DB Tables READ** | `intelligence_snapshots`, `business_profiles`, `documents`, `strategic_console_state` |
| **DB Tables WRITE** | `documents`, `strategic_console_state`, `usage_tracking` |
| **Secrets** | `OPENAI_API_KEY`, `MERGE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Frontend** | Currently: `BoardRoom` component + `Documents.js` (226 lines) + `DocumentView.js` (181 lines) + `WarRoomConsole` component (BRIEF mode) |
| **Pages absorbed** | `Documents.js` (**DELETE**), `DocumentView.js` (**DELETE**) — merge into Reports |
| **Verdict** | **KEEP — Merge 4 features into 1 module** |

---

#### 13. AUDIT LOG
> *"Full transparency. Every AI call, every action, every cost."*

| Layer | Component | Detail |
|---|---|---|
| **What user sees** | Timeline of all AI API calls with cost, user actions, data access events, system events |
| **Edge Function** | None needed — reads directly from database |
| **Backend Route** | **NEW endpoint needed** — simple query on `usage_tracking` |
| **DB Tables READ** | `usage_tracking` (exists — logs function_name, api_provider, model, tokens_in, tokens_out, cost_estimate per call), `prompt_audit_logs` |
| **Frontend** | **NEW** — needs to be built |
| **Verdict** | **PARTIALLY EXISTS — DB table exists, needs frontend + API endpoint** |

---

#### 14. SETTINGS
> *"Account, Business DNA, intelligence preferences, recalibration scheduling."*

| Layer | Component | Detail |
|---|---|---|
| **What user sees** | Account settings (name, email, password), Business DNA profile (auto-populated from calibration), intelligence preferences, notification preferences, recalibration schedule, subscription management |
| **Edge Functions** | `calibration-sync` (182 lines) + `checkin-manager` (188 lines) |
| **Backend Routes** | `profile.py` (1,917 lines) → business profile CRUD + `calibration.py` (state management) |
| **DB Tables READ/WRITE** | `users`, `business_profiles`, `strategy_profiles`, `user_operator_profile`, `intelligence_baseline`, `intelligence_priorities`, `calibration_schedules`, `working_schedules` |
| **Secrets** | `OPENAI_API_KEY` (for calibration-sync), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Frontend** | Currently: `Settings.js` (657 lines) + `BusinessProfile.js` (495 lines) + `IntelligenceBaseline.js` (304 lines) |
| **Pages absorbed** | `BusinessProfile.js` (**DELETE**), `IntelligenceBaseline.js` (**DELETE**) — merge into Settings |
| **Verdict** | **KEEP — Merge 3 pages into 1 module** |

---

## SECTION 2: ONBOARDING (Stays as separate flow — not in main nav)

| Component | Detail |
|---|---|
| **What user sees** | Conversational calibration wizard: 9-step psychology profiling → website URL → auto-extract Business DNA → Strategic Map |
| **Edge Functions** | `calibration-psych` (232 lines) + `calibration-business-dna` (275 lines) + `watchtower-brain` (88 lines) + `calibration-sync` (182 lines) |
| **Backend Route** | `calibration.py` (1,482 lines) + `onboarding.py` (630 lines) |
| **DB Tables** | `calibration_sessions`, `user_operator_profile`, `business_profiles`, `strategy_profiles` |
| **Frontend** | `CalibrationAdvisor.js` + `OnboardingWizard.js` + `OnboardingDecision.js` |
| **Verdict** | **KEEP — Remains as onboarding flow, not in main nav** |

---

## SECTION 3: SUPER ADMIN PORTAL
*Role: `superadmin` — BIQc internal team only*

| Module | Exists? | Backend Route | DB Tables | What's Needed |
|---|---|---|---|---|
| **Platform Dashboard** | Partial | `admin.py` → `/admin/stats` | `users` (count, roles, tiers) | Enhance with MRR, churn, usage charts |
| **Client Management** | Partial | `admin.py` → `/admin/users`, `/admin/users/{id}` | `users`, `business_profiles`, `integration_accounts`, `calibration_sessions` | Already lists users, can suspend/unsuspend/update. Add search/filter/detail view. |
| **Impersonation** | Yes | `admin.py` → `/admin/users/{id}/impersonate` | `users` | Works. View any client's platform as them. |
| **Prompt Lab** | Yes | `admin.py` → `/admin/prompts` | `system_prompts`, `prompt_audit_logs` | View/edit all AI prompts. Already functional. |
| **Sales Pipeline** | **NO** | **NEW** | **NEW TABLE:** `sales_pipeline` | Track leads, demos, trials, conversions. |
| **Support Console** | **NO** | **NEW** | `users`, `intelligence_snapshots`, `integration_accounts` | Client health aggregation. Proactive alerts. |
| **Billing** | **NO** | **NEW** | **NEW TABLE:** `subscriptions`, `invoices` | **Needs Stripe integration.** Subscription management, payment tracking, revenue recognition. |
| **Partner Management** | **NO** | **NEW** | **NEW TABLE:** `partner_accounts` | Manage reseller accounts, commissions, billing splits. |
| **Usage & Costs** | Partial (DB exists) | **NEW endpoint** | `usage_tracking` | Per-client API cost dashboard. Budget alerts. |
| **System Health** | Yes | `health.py` → `/health/*` | — | Edge Function health, DB health, integration sync status. |

---

## SECTION 4: ADMIN / RESELLER PORTAL
*Role: `admin` — Partner manages their own clients*

| Module | Exists? | What's Needed |
|---|---|---|
| **My Clients** | **NO** | List all clients under this partner. Health scores, last login, integration status. |
| **Add Client** | **NO** | Create child account. Pre-fill from template. Send invitation. Set subscription tier. |
| **Client Billing** | **NO** | Per-client billing. Invoice generation. Payment status. Commission tracking. **Needs Stripe.** |
| **Client Health** | **NO** | Aggregated view: which clients are healthy, struggling, or need attention. |
| **White Label** | **NO** | Custom branding per partner. Logo, colors, domain. |
| **Onboarding Tracker** | **NO** | Which clients completed calibration, connected integrations, activated features. |

**DB Schema needed for Parent-Child:**
```
accounts (id, name, parent_id, type [direct|partner|child], created_at)
users.account_id → accounts.id
accounts.parent_id → accounts.id (NULL for top-level)
```

---

## SECTION 5: WHAT TO DELETE

### Frontend Pages — DELETE (Dead code / Orphaned / Superseded)

| File | Lines | Why Delete |
|---|---|---|
| `Advisor.js` | 576 | Dead code. Replaced by AdvisorWatchtower. No route uses it. |
| `Dashboard.js` | 306 | Dead code. Route just redirects to `/advisor`. |
| `Landing.js` | 459 | Dead code. Replaced by LandingIntelligent. No route uses it. |
| `CognitiveV2Mockup.js` | 362 | Dev preview. Superseded by live dashboard + Liquid Steel mockup. |
| `LoadingPreview.js` | 26 | Dev preview. Test harness for loading animation. |
| `GmailTest.js` | 264 | Dev testing. Not user-facing. |
| `OutlookTest.js` | 109 | Dev testing. Not user-facing. |
| `AuthDebug.js` | 176 | Dev debugging. Token inspector. |
| `ProfileImport.js` | 808 | Superseded by `calibration-business-dna` auto-extraction. |
| `OpsAdvisoryCentre.js` | 182 | Generic advisory. No unique function. Absorbed into Operations. |

**Total: 10 files, 3,268 lines**

### Edge Functions — DELETE

| Function | Lines | Why Delete |
|---|---|---|
| `calibration_psych` (underscore) | 274 | Exact duplicate of `calibration-psych` (hyphen). |
| `gmail_test` | 363 | Dev testing. Not production. `gmail_prod` handles everything. |

**Total: 2 functions, 637 lines**

### Backend Routes — DELETE

| File | Lines | Why Delete |
|---|---|---|
| `facts.py` | 29 | Vestigial placeholder. No meaningful endpoints. |

**Total: 1 file, 29 lines**

---

## SECTION 6: COMPLETE SECRETS REGISTRY

| Secret | Used By | Provider |
|---|---|---|
| `OPENAI_API_KEY` | 10 Edge Functions + backend | OpenAI |
| `SUPABASE_URL` | All Edge Functions + backend | Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | All Edge Functions + backend | Supabase |
| `SUPABASE_ANON_KEY` | Frontend + some Edge Functions | Supabase |
| `MERGE_API_KEY` | biqc-insights-cognitive, cfo-cash-analysis, market-analysis-ai, strategic-console-ai, integrations.py | Merge.dev |
| `PERPLEXITY_API_KEY` / `Perplexity_API` | biqc-insights-cognitive, competitor-monitor | Perplexity AI |
| `FIRECRAWL_API_KEY` | calibration-business-dna, deep-web-recon, market-analysis-ai | Firecrawl |
| `GOOGLE_CLIENT_ID` | gmail_prod, integrations.py, frontend | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | gmail_prod, integrations.py | Google OAuth |
| `AZURE_CLIENT_ID` | outlook-auth, email.py | Microsoft OAuth |
| `AZURE_CLIENT_SECRET` | outlook-auth, email.py | Microsoft OAuth |
| `SERPER_API_KEY` | research.py (backend only) | Serper (Google Search) |
| `Calibration-Psych` | calibration-psych (custom key name) | OpenAI (duplicate — should use OPENAI_API_KEY) |

**Consolidation needed:** `Perplexity_API` → `PERPLEXITY_API_KEY` (2 names for same key), `Calibration-Psych` → use shared `OPENAI_API_KEY`

---

## SECTION 7: COMPETITOR LANDSCAPE

### Direct Competitors (Autonomous Business Intelligence for SMBs)

| Competitor | What They Do | How BIQc Differs |
|---|---|---|
| **Mosaic** | FP&A platform. Real-time dashboards, 150+ metrics, Arc AI chatbot for financial questions. 800+ integrations. Best for SaaS/FinTech. | Mosaic is finance-only. BIQc monitors finance + revenue + operations + people + market + compliance. Full business, not just numbers. |
| **Datarails** | Excel-native FP&A. AI error detection, conversational assistant. Consolidates spreadsheets. | Datarails requires spreadsheets. BIQc connects live systems (Xero, HubSpot) and monitors autonomously. No manual data prep. |
| **Fathom** | Reporting & forecasting for accountants. Dashboards from accounting data. | Fathom is backward-looking reports. BIQc is forward-looking intelligence — it predicts and prevents, not just reports. |
| **Digits** | Autonomous AI bookkeeping. Automated categorisation, insights from banking data. | Digits is bookkeeping automation. BIQc is an executive operating system — it doesn't do your books, it tells you what to DO about them. |
| **Domo** | Enterprise BI platform with 1,000+ connectors. AI-driven dashboards. | Domo is enterprise-grade and enterprise-priced. Too complex for SMBs with 10-150 staff. BIQc is purpose-built for that segment. |
| **Vena Solutions** | Excel-native FP&A with Copilot. Pre-built templates, workflows. | Vena requires months of implementation and Excel expertise. BIQc is live in 10 minutes after calibration. |
| **Power BI** | Microsoft's BI tool. Build-your-own dashboards and reports. | Power BI requires someone to BUILD the dashboards. BIQc generates intelligence autonomously — no analyst needed. |

### Adjacent Competitors (Overlap in specific areas)

| Competitor | Overlap Area | How BIQc Differs |
|---|---|---|
| **Ramp / Brex / Mercury** | Spend management, expense controls, financial visibility | These are banking/card products with AI insights bolted on. BIQc monitors the entire business, not just spend. |
| **Pilot** | Outsourced bookkeeping + some AI insights | Pilot does your books for you. BIQc reads your books and tells you what they mean strategically. |
| **Journey AI** | AI meeting productivity + task automation for SMBs | Journey automates meetings/tasks. BIQc monitors the entire business and recommends what tasks SHOULD exist. |
| **Cognosys** | Raw data → reports, no-code analytics | Cognosys is a tool. BIQc is an always-on system. You don't ask it questions — it tells you what you need to know. |
| **Qlik** | Augmented analytics, data integration | Enterprise BI. SMBs don't have data teams to configure Qlik. BIQc configures itself from a conversation. |
| **Zoho Analytics** | SMB-friendly BI dashboarding | Zoho requires manual dashboard setup. BIQc is autonomous — calibrate once, intelligence flows automatically. |

### BIQc's Unique Position (No Direct Equivalent Exists)

**No competitor does ALL of this:**
1. Conversational calibration (learns the business in 10 minutes)
2. Psychology-calibrated delivery (matches owner's communication style)
3. Cross-domain monitoring (finance + revenue + operations + people + market + compliance)
4. Autonomous detection (runs 24/7 via pg_cron, no manual checking)
5. One-click execution (Auto-Email, Quick-SMS, Hand Off directly from alerts)
6. Australian sovereign data hosting
7. Reseller/partner channel with parent-child billing

The closest description: **"What if a COO, CFO, and compliance officer worked 24/7 for $X/month and already knew your business?"**
