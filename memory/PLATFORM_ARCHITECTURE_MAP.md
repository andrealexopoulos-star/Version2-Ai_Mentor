# BIQc Platform Architecture — Complete Feature & Function Mapping

## Document Purpose
This document maps every existing feature, Edge Function, backend route, and frontend page to the proposed new Liquid Steel menu structure. It includes what each function does, the benefit to the SMB user, what gets repurposed, what's redundant, and what's new — including Super Admin, Admin (Reseller), and Parent-Child account structures that are currently missing.

---

## PART 1: COMPLETE INVENTORY OF EXISTING ASSETS

### A. Edge Functions (Supabase — Versioned, 14 total)

| # | Function Name | Lines | What It Does | SMB User Benefit | AI Provider |
|---|---|---|---|---|---|
| 1 | `biqc-insights-cognitive` | 541 | **The brain.** Pulls all connected data (CRM deals, invoices, emails, calendar) via Merge.dev. Runs OpenAI to generate: system state, resolution queue, executive memo, runway calc, inevitabilities, priority compression. Caches results for performance. | Owner sees ONE screen with everything that matters today — cash risk, deal stalls, overdue invoices, team burnout — with recommended actions. No dashboard digging. | OpenAI + Perplexity |
| 2 | `strategic-console-ai` | 330 | Two modes: (1) BRIEF — generates a full executive briefing from all data, (2) ASK — user types a question, function searches all connected data and answers. Like having a CTO on call. | Owner can ask "Should I hire a salesperson?" and get an answer grounded in their actual revenue, pipeline, and capacity data. Not generic advice — advice based on THEIR numbers. | OpenAI |
| 3 | `boardroom-diagnosis` | 347 | Deep-dive analysis on a specific focus area (e.g. "cash flow risk", "team capacity"). Reads all user data, generates: headline, narrative, what to watch, consequences if ignored, data sources used. | When owner is worried about something specific, this function gives them a board-level diagnosis with evidence. "Your cash is fine for 3 months, BUT if Invoice #47 doesn't pay and Deal Alpha slips, you hit a wall in 8 weeks." | OpenAI |
| 4 | `cfo-cash-analysis` | 316 | CFO agent. Connects to accounting tools (Xero, QuickBooks via Merge.dev). Detects cash flow anomalies, overdue invoices, expense spikes, revenue trend changes. Generates intelligence actions automatically. Runs weekly via pg_cron. | Replaces a $120K/year CFO for cash oversight. "Your receivables aged past 45 days by $8K this month. Two invoices are at risk of becoming bad debt." Running automatically — owner doesn't have to ask. | OpenAI |
| 5 | `calibration-psych` | 232 | 9-step conversational profiling of the business owner's psychology: communication style, verbosity, bluntness, risk posture, decision style, accountability cadence, time constraints, challenge tolerance, boundaries. | Every insight BIQc delivers is calibrated to HOW this specific owner wants to hear it. Blunt founder? Short bullets. Cautious operator? Gentle framing with options. This is what makes BIQc feel personal, not robotic. | OpenAI |
| 6 | `calibration-business-dna` | 275 | Scrapes the business website via Firecrawl, then uses GPT to extract: market position, products, team structure, strategy, competitors, pricing. Populates the Business DNA profile automatically. | Owner provides their website URL. Within 60 seconds, BIQc knows their industry, their products, their competitors, and their positioning — without a single form field filled. | OpenAI + Firecrawl |
| 7 | `calibration-sync` | 182 | After calibration completes, reads the full conversation history and extracts 16+ structured business profile fields. Populates business_profiles and strategy_profiles tables in the database. | Ensures the Settings/Business DNA page is pre-filled with accurate data from the calibration conversation. Owner never has to re-type what they already told BIQc. | OpenAI |
| 8 | `checkin-manager` | 188 | Handles recalibration reminders (every 14 days) and weekly video check-in scheduling. CRUD for pending alerts, scheduling, postponing, dismissing. | Prevents "set and forget". BIQc nudges the owner to recalibrate when the business has changed — new hire, lost client, price change — so intelligence stays accurate. | None (logic only) |
| 9 | `competitor-monitor` | 270 | Weekly scheduled competitor scanning. Re-scans competitors identified during calibration. Diffs against previous results. Generates COMPETITOR ALERT actions when changes detected (new pricing page, new hires, new product). | "Your competitor just launched a new pricing page and hired 2 salespeople on LinkedIn." Owner knows what their market is doing without manually checking competitor websites every week. | OpenAI + Perplexity |
| 10 | `intelligence-bridge` | 183 | Converts Watchtower findings and Snapshot open risks/contradictions into intelligence_actions (actionable items). Bridge between detection and action. | Ensures nothing falls through the cracks. When Watchtower detects a position change or the snapshot finds a contradiction, it automatically becomes an action item the owner can see. | None (logic only) |
| 11 | `market-analysis-ai` | 264 | On-demand market analysis. User inputs product/service, region, question. Function reads all user data + performs live market research. Returns SWOT analysis + strategic recommendations. | "Is my pricing competitive in Sydney for digital marketing agencies?" Gets a researched answer using the owner's actual business data + live market intel. Not a template — a real analysis. | OpenAI + Firecrawl |
| 12 | `sop-generator` | 190 | Generates Standard Operating Procedures, checklists, and action plans using full business context. Types: SOP, checklist, action plan. | Owner says "Create a client onboarding SOP for my accounting firm" and gets a professional, business-specific procedure document in seconds. No more tribal knowledge. | OpenAI |
| 13 | `watchtower-brain` | 88 | The 17-Point Strategic Map extraction engine. Hardened conversational AI that guides the user through extracting their complete business identity: industry, stage, target market, business model, products, team, mission, vision, obstacles, goals. | Foundation for everything. Without the Strategic Map, BIQc can't deliver calibrated intelligence. This is the "first conversation" that makes BIQc understand the business. | OpenAI |
| 14 | `calibration_psych` | 274 | **DUPLICATE** of calibration-psych (underscore vs hyphen naming). Same 9-step profiling logic. | Same as #5. Should be consolidated. | OpenAI |

### B. Edge Functions (Un-versioned — deployed but not in git, 6 total)

| # | Function Name | Lines | What It Does | SMB User Benefit |
|---|---|---|---|---|
| 15 | `deep-web-recon` | 473 | Zero-presumption competitive intelligence. Scrapes website, LinkedIn, Twitter, Instagram, Facebook. Performs SWOT analysis. Writes signals with severity ratings. Enforces attention protection (if delta < 2%, suppresses noise). | "We found 4 negative Google reviews for your competitor posted this week." Deep competitive intelligence that runs automatically. Owner sees only what CHANGED, not noise. |
| 16 | `email_priority` | 321 | Analyses email inbox (Gmail/Outlook). Categorises into high/medium/low priority. Generates strategic insights from email patterns. Detects response delays, escalation triggers, client engagement decline. | "3 emails from your top client went unanswered for 48+ hours. Engagement declining." Owner knows which emails actually matter and which patterns signal problems. |
| 17 | `gmail_prod` | 277 | Gmail OAuth integration handler. Connects user's Gmail account to BIQc for email metadata analysis. Handles token refresh, message fetching, and metadata extraction. | Connects Gmail securely. BIQc can then monitor communication patterns without reading email content — just metadata patterns. |
| 18 | `gmail_test` | 363 | Gmail integration testing function. Verifies OAuth tokens, tests API connectivity, validates permissions. | Developer/admin tool for verifying Gmail integrations are healthy. |
| 19 | `integration-status` | 189 | Checks the health status of all connected integrations for a user. Returns sync status, last sync time, connection health. | "Your Xero connection is healthy. Last sync: 3 minutes ago." Owner has confidence their data is flowing correctly. |
| 20 | `outlook-auth` | 281 | Microsoft/Outlook OAuth integration handler. Connects Outlook email and calendar for metadata analysis and calendar intelligence. | Connects Outlook securely. Enables email pattern detection and calendar analysis for Microsoft users. |

### C. Backend Python Routes (FastAPI, 10,450 lines total)

| Route File | Lines | Key Endpoints | What It Does |
|---|---|---|---|
| `admin.py` | 309 | `/admin/users`, `/admin/stats`, `/admin/users/{id}/suspend`, `/admin/users/{id}/impersonate`, `/admin/prompts` | Super admin: list users, update roles, suspend/unsuspend, impersonate, manage AI prompts |
| `auth.py` | 112 | `/auth/login`, `/auth/register` | Supabase authentication handling |
| `boardroom.py` | 245 | `/boardroom/diagnosis`, `/boardroom/cache` | Proxies to boardroom-diagnosis Edge Function |
| `calibration.py` | 1,482 | `/console/state`, `/console/chat`, `/calibrate/*` | Full calibration flow: psych profiling + business DNA extraction + state management + auto-save |
| `cognitive.py` | 273 | `/cognitive/snapshot`, `/cognitive/insights` | Proxies to biqc-insights-cognitive Edge Function |
| `data_center.py` | 130 | `/data-center/stats`, `/data-center/recent` | Data ingestion statistics and recent data view |
| `email.py` | 1,855 | `/email/connect/*`, `/email/sync`, `/email/inbox`, `/email/intelligence` | Full email system: Gmail/Outlook OAuth, email sync, inbox display, email intelligence analysis |
| `generation.py` | 564 | `/generate/snapshot`, `/generate/advice` | AI content generation: snapshot generation, strategic advice |
| `health.py` | 110 | `/health`, `/health/supabase`, `/health/integrations` | System health checks |
| `integrations.py` | 1,185 | `/integrations/connect/*`, `/integrations/status`, `/integrations/disconnect` | Full integration management: Merge.dev (CRM, Accounting), Google Drive, email connections |
| `intelligence.py` | 103 | `/intelligence/overview` | Intelligence overview data |
| `intelligence_actions.py` | 247 | `/intelligence/actions`, `/intelligence/actions/{id}/resolve` | CRUD for intelligence actions (the actionable items from AI analysis) |
| `onboarding.py` | 630 | `/onboarding/*`, `/notifications/*` | Onboarding wizard flow + notification system (scans emails, calendar, intelligence for alerts) |
| `profile.py` | 1,917 | `/profile/*`, `/business-profile/*`, `/operator-profile/*` | Business profile management, strategy profiles, operator profiles, user settings |
| `research.py` | 451 | `/research/market`, `/research/competitor` | Market research and competitor analysis |
| `soundboard.py` | 257 | `/soundboard/sessions`, `/soundboard/chat` | Strategic sounding board: conversational AI for testing ideas, scenarios, and decisions |
| `strategic_console.py` | 355 | `/strategic-console/*` | Proxies to strategic-console-ai Edge Function |
| `watchtower.py` | 71 | `/watchtower/run` | Triggers watchtower analysis |

### D. Frontend Pages (Current, 35+ pages)

| Page | Route | What It Shows | Status |
|---|---|---|---|
| AdvisorWatchtower | `/advisor` | Main dashboard — 5 cognition tabs (Money, Revenue, Operations, People, Market) with resolution cards and action buttons | **ACTIVE — Primary screen** |
| WarRoomConsole | `/war-room` | Strategic Console — executive briefing + ask-me-anything chat | Active |
| BoardRoom | `/board-room` | Deep-dive diagnosis on specific focus areas | Active |
| OperatorDashboard | `/operator` | Operational overview — simplified view | Active |
| MySoundBoard | `/soundboard` | Strategic sounding board — test ideas via AI chat | Active |
| Diagnosis | `/diagnosis` | Business diagnosis — risk assessment tool | Active |
| Analysis | `/analysis` | Performance analysis views | Active |
| MarketAnalysis | `/market-analysis` | On-demand market analysis with SWOT | Active |
| IntelCentre | `/intel-centre` | Intelligence actions centre — view/resolve actions | Active |
| SOPGenerator | `/sop-generator` | Generate SOPs, checklists, action plans | Active |
| DataCenter | `/data-center` | View ingested data statistics | Active |
| Documents | `/documents` | Document storage and viewing | Active |
| Integrations | `/integrations` | Connect/disconnect business platforms | Active |
| ConnectEmail | `/connect-email` | Gmail/Outlook email connection flow | Active |
| EmailInbox | `/email-inbox` | Prioritised email inbox view | Active |
| CalendarView | `/calendar` | Calendar integration view | Active |
| Settings | `/settings` | Account settings | Active |
| BusinessProfile | `/business-profile` | Business DNA — company profile data | Active |
| IntelligenceBaseline | `/intelligence-baseline` | View intelligence baseline configuration | Active |
| CalibrationAdvisor | `/calibration` | Initial calibration flow (psych + DNA) | Active — Onboarding |
| AdminDashboard | `/admin` | Super admin: user management, stats, suspend/impersonate | Active — Admin only |
| PromptLab | `/admin/prompt-lab` | Super admin: view/edit AI prompts | Active — Admin only |
| LoginSupabase | `/login-supabase` | Login page | Active |
| LandingIntelligent | `/` | Marketing landing page | Active |

---

## PART 2: PROPOSED NEW MENU STRUCTURE WITH FULL MAPPING

### USER ROLE HIERARCHY (NEW)

| Role | Access | Description |
|---|---|---|
| **Super Admin** | Full platform | BIQc internal team. Full system access, all clients, billing, support, sales tools, prompt management, impersonation |
| **Admin (Reseller/Partner)** | Their clients only | Can add their own clients, manage billing for their clients, white-label options. Parent account that owns child accounts |
| **Owner** | Their business | SMB founder/operator. Full access to their business intelligence. Can add team members |
| **Team Member** | Limited view | Added by Owner. Sees relevant modules only (e.g. Operations staff sees Operations, not Revenue) |
| **Suspended** | None | Account suspended by Admin or Super Admin |

### ACCOUNT STRUCTURE (NEW — Parent/Child)

```
Super Admin (BIQc Internal)
├── Admin Account A (Reseller/Partner — e.g. "Strategy Squad")
│   ├── Client Account 1 (Owner: Andre)
│   │   ├── Team Member: Sarah (Operations)
│   │   └── Team Member: James (Sales)
│   ├── Client Account 2 (Owner: Lisa)
│   └── Client Account 3 (Owner: Mark)
├── Admin Account B (Another Partner)
│   ├── Client Account 4
│   └── Client Account 5
└── Direct Client Account 6 (No reseller — direct BIQc customer)
```

---

## PART 3: NEW MENU — ITEM BY ITEM

---

### INTELLIGENCE GROUP
*For: Owner, Team Members (filtered by role)*

#### 1. Executive Overview
- **Old name:** BIQc Insights (`/advisor`)
- **Edge Function:** `biqc-insights-cognitive`
- **Backend route:** `cognitive.py`
- **What changes:** Same engine. New Liquid Steel UI. Health strip, attention cards, financial snapshot, intelligence pulse.
- **User benefit:** "One screen tells me everything critical about my business right now. I don't need to open 5 apps."
- **KEEP — Repurpose UI only**

#### 2. Revenue
- **Old names:** Revenue tab from BIQc Insights + Analysis page
- **Edge Functions:** `biqc-insights-cognitive` (revenue data from cognitive output) + `cfo-cash-analysis` (financial trends)
- **Backend routes:** `cognitive.py` + parts of `generation.py`
- **What changes:** Extracted from the combined dashboard into its own dedicated module. Pipeline stability, revenue concentration, churn probability as dedicated panels.
- **User benefit:** "I can see exactly where my revenue risk is — which deals are stalled, which clients might leave, how concentrated my pipeline is."
- **KEEP — Extract into standalone module**

#### 3. Operations
- **Old names:** Operations tab from BIQc Insights + SOP Generator + Operator View
- **Edge Functions:** `biqc-insights-cognitive` (operations data) + `sop-generator`
- **Backend routes:** `cognitive.py` + parts of `generation.py`
- **Frontend pages absorbed:** OperatorDashboard, SOPGenerator
- **What changes:** Operations tab becomes a full module. SOP Generator becomes a tool within it. Operator View simplified metrics fold in.
- **User benefit:** "All my operational health in one place — SLA breaches, bottlenecks, team utilisation, and I can generate SOPs directly from here."
- **KEEP — Merge 3 features into 1**

#### 4. Risk
- **Old names:** Watchtower + Diagnosis page + Intel Centre (intelligence actions)
- **Edge Functions:** `watchtower-brain` + `intelligence-bridge` + `boardroom-diagnosis`
- **Backend routes:** `watchtower.py` + `intelligence_actions.py` + `boardroom.py`
- **Frontend pages absorbed:** Diagnosis, IntelCentre, Watchtower
- **What changes:** All risk detection, diagnosis, and intelligence actions consolidated into one Risk module. Watchtower monitors continuously. Diagnosis provides deep-dives. Intel Centre shows actionable items.
- **User benefit:** "I see every risk in my business — financial, operational, compliance — ranked by severity. I can drill into any one for a board-level diagnosis."
- **KEEP — Merge 3 features into 1**

#### 5. Compliance
- **Old name:** Part of BIQc Insights (compliance signals)
- **Edge Function:** `biqc-insights-cognitive` (compliance data from cognitive output)
- **What changes:** Currently just a tab. Becomes its own module showing: BAS deadlines, workers comp, regulatory exposure, documentation gaps, policy drift.
- **User benefit:** "I never miss a compliance deadline again. BIQc tracks BAS, workers comp, insurance renewals, and tells me 30 days before anything is due."
- **KEEP — Promote from tab to module**

#### 6. Market
- **Old names:** Market Analysis page + Market tab from BIQc Insights
- **Edge Functions:** `market-analysis-ai` + `competitor-monitor` + `deep-web-recon`
- **Backend routes:** `research.py`
- **Frontend pages absorbed:** MarketAnalysis
- **What changes:** All market intelligence in one module. Competitor monitoring (weekly automated), on-demand market analysis (SWOT), pricing position, demand shifts.
- **User benefit:** "I know what my competitors did this week without checking their websites. I can run a SWOT analysis on any market question using my real business data."
- **KEEP — Merge 3 features into 1**

---

### EXECUTION GROUP
*For: Owner, Team Members*

#### 7. Alerts
- **Old name:** Resolution queue from BIQc Insights + Watchtower findings + Notification system
- **Edge Functions:** `biqc-insights-cognitive` (resolution_queue) + `intelligence-bridge` (action generation)
- **Backend routes:** `intelligence_actions.py` + `onboarding.py` (notifications endpoints)
- **What changes:** Extracted from the dashboard into a dedicated Alerts screen. Grouped by severity (Critical, Moderate, Info). Each alert shows business impact, suggested action, and execution buttons.
- **User benefit:** "Every alert has a suggested action I can execute with one click. Auto-Email a late-paying client. Quick-SMS my team. Hand off a task. No more 'I saw it but forgot to act.'"
- **KEEP — Extract + enhance**

#### 8. Actions
- **Old name:** SoundBoard (partially) + Action buttons (Auto-Email, Quick-SMS, Hand Off)
- **Edge Functions:** None currently — **NEEDS NEW BACKEND**
- **Backend routes:** `soundboard.py` (the conversational part)
- **Frontend pages absorbed:** MySoundBoard
- **What changes:** SoundBoard becomes the "strategic conversation" tool within Actions. The Auto-Email, Quick-SMS, and Hand Off buttons get real backend execution. Actions = "things you can DO from BIQc."
- **User benefit:** "I can test a strategic idea with my AI sounding board, then execute actions directly — send an email, text a client, create a task — all without leaving the platform."
- **PARTIALLY EXISTS — Needs email/SMS provider integration (Resend, Twilio)**

#### 9. Automations
- **Old name:** None — **ENTIRELY NEW**
- **Edge Functions:** None — **NEEDS NEW ENGINE**
- **What it is:** IF/THEN automation builder. "IF invoice overdue > 7 days, THEN send payment reminder." "IF new lead not contacted in 4 hours, THEN send intro email."
- **User benefit:** "I set up a rule once, and BIQc handles it forever. Overdue invoices get chased automatically. New leads get instant responses. I don't need Zapier."
- **NEW — Needs automation engine + scheduler**

---

### SYSTEMS GROUP
*For: Owner, Admin*

#### 10. Integrations
- **Old name:** Integrations page + Email Connect + Calendar
- **Edge Functions:** `integration-status` + `gmail_prod` + `outlook-auth`
- **Backend routes:** `integrations.py` + `email.py`
- **Frontend pages absorbed:** Integrations, ConnectEmail, CalendarView
- **What changes:** All connection management in one place. Connect accounting, CRM, email, calendar, payroll. Each integration shows sync status, data types ingested, permissions. Disconnect option.
- **User benefit:** "I connect Xero, HubSpot, and Gmail in one screen. I can see exactly what BIQc accesses, when it last synced, and disconnect anything with one click."
- **KEEP — Merge 3 pages into 1**

#### 11. Data Health
- **Old name:** Data Center
- **Edge Functions:** `integration-status`
- **Backend routes:** `data_center.py`
- **Frontend pages absorbed:** DataCenter
- **What changes:** Renamed. Shows data quality, sync health, signal coverage. "How much of your business is BIQc actually seeing?"
- **User benefit:** "I know if my data is flowing correctly. If Xero sync fails, I see it here immediately — not after I get a wrong insight."
- **KEEP — Rename + enhance**

---

### GOVERNANCE GROUP
*For: Owner, Admin*

#### 12. Reports
- **Old names:** Board Room + Documents + Strategic Console (BRIEF mode)
- **Edge Functions:** `boardroom-diagnosis` + `strategic-console-ai`
- **Backend routes:** `boardroom.py` + `strategic_console.py`
- **Frontend pages absorbed:** BoardRoom, Documents, WarRoomConsole (brief mode)
- **What changes:** All generated reports, board-level diagnoses, executive briefings, and stored documents in one Reports module. Can generate on-demand reports for specific focus areas.
- **User benefit:** "I can generate a board-ready report on my cash position in 30 seconds. All my previous reports and documents are stored and searchable."
- **KEEP — Merge 3 features into 1**

#### 13. Audit Log
- **Old name:** None — **PARTIALLY NEW**
- **Data source:** `usage_tracking` table (exists) + system events
- **What it is:** Complete audit trail of: all AI API calls (with cost), user actions, data access, system events. Transparency into what BIQc does.
- **User benefit:** "I can see exactly what BIQc has done — every AI call, every action taken, every insight generated. Full transparency. No black box."
- **PARTIALLY EXISTS — usage_tracking table exists, needs frontend**

#### 14. Settings
- **Old names:** Settings + Business DNA
- **Edge Functions:** `calibration-sync` + `checkin-manager`
- **Backend routes:** `profile.py` + `calibration.py`
- **Frontend pages absorbed:** Settings, BusinessProfile, IntelligenceBaseline
- **What changes:** Account settings, Business DNA profile, intelligence baseline configuration, recalibration scheduling — all under one Settings module.
- **User benefit:** "All my account and business profile settings in one place. I can update my business DNA, change notification preferences, and manage my subscription."
- **KEEP — Merge 3 pages into 1**

---

### SUPER ADMIN PORTAL (NEW)
*For: BIQc internal team only (role: superadmin)*

| Module | Exists? | Edge Function | Backend Route | Purpose | Benefit |
|---|---|---|---|---|---|
| **Dashboard** | Partial (`/admin`) | — | `admin.py` | Platform-wide stats: total users, active users, MRR, churn, usage metrics, system health | BIQc team sees platform health at a glance |
| **Client Management** | Partial (user list) | — | `admin.py` | Search/filter all clients. View client detail: integrations, calibration status, usage, last login. Suspend/unsuspend | Manage the entire client base |
| **Impersonation** | Yes | — | `admin.py` `/impersonate` | View any client's platform exactly as they see it | Support and debugging |
| **Sales Pipeline** | **NO — NEW** | — | **NEW** | Track leads, demos booked, trials started, conversions, revenue per client | BIQc sales team manages their funnel |
| **Support Console** | **NO — NEW** | — | **NEW** | View client health scores, recent alerts, integration issues. Proactive outreach triggers | Support team sees who needs help before they ask |
| **Billing & Subscriptions** | **NO — NEW** | — | **NEW** (Stripe integration) | Manage subscription tiers, invoicing, payment status, revenue recognition. Per-client billing history | Centralised billing management |
| **Partner Management** | **NO — NEW** | — | **NEW** | Manage Admin/Reseller accounts. Set commission rates, billing splits. View partner performance | Manage the reseller/partner channel |
| **Prompt Lab** | Yes (`/admin/prompt-lab`) | — | `admin.py` `/prompts` | View and edit all AI agent prompts used across the platform | Fine-tune AI behaviour without code deployment |
| **Usage & Cost Tracking** | Partial (DB table exists) | — | `usage_tracking` table | Per-user, per-function API cost tracking. Budget alerts. Usage trends | Ensure profitability per client |
| **System Health** | Yes | — | `health.py` | Monitor all Edge Functions, database health, integration sync status | Keep the platform running |

---

### ADMIN PORTAL (Reseller/Partner — NEW)
*For: role: admin — Manages their own clients*

| Module | Exists? | Purpose | Benefit to Admin/Partner |
|---|---|---|---|
| **My Clients** | **NO — NEW** | View all clients under this admin's account. Add new clients. Set up client billing. View client health scores | Partner manages their client portfolio from one screen |
| **Add Client** | **NO — NEW** | Create new client account (child account). Pre-fill business details. Send invitation email. Set subscription tier | Partners can onboard their own clients without BIQc involvement |
| **Client Billing** | **NO — NEW** | Set billing for each client. View payment status. Invoice history. Commission tracking | Partner handles billing for their clients directly |
| **Client Health** | Partial (via impersonation) | Dashboard showing all clients' health scores, recent alerts, integration status, usage | "At a glance I see which of my 15 clients need attention" |
| **White Label** | **NO — NEW** | Custom branding (logo, colors, domain) for the partner's instance | Partner can offer BIQc under their own brand |
| **Onboarding Tracker** | **NO — NEW** | Track which clients completed calibration, connected integrations, activated features | Partner ensures client adoption |

---

## PART 4: WHAT BECOMES REDUNDANT

| Current Page/Feature | Why Redundant | Absorbed Into |
|---|---|---|
| OperatorDashboard (`/operator`) | Simplified version of Executive Overview — same data, less detail | Executive Overview + Operations |
| IntelCentre (`/intel-centre`) | Displays intelligence_actions — now shown in Risk + Alerts | Risk module + Alerts |
| Diagnosis (`/diagnosis`) | Deep-dive analysis — now a tool within Risk | Risk module |
| Analysis (`/analysis`) | Performance analysis — now within Revenue + Operations | Revenue + Operations |
| DataCenter (`/data-center`) | Renamed to Data Health with same core function | Data Health |
| MySoundBoard (`/soundboard`) | Strategic conversation — now within Actions | Actions module |
| CalendarView (`/calendar`) | Calendar view — absorbed into Integrations data | Integrations + Executive Overview |
| ConnectEmail (`/connect-email`) | Email connection flow — absorbed into Integrations | Integrations |
| IntelligenceBaseline (`/intelligence-baseline`) | Baseline config — absorbed into Settings | Settings |
| BusinessProfile (`/business-profile`) | Business DNA — absorbed into Settings | Settings |
| Documents (`/documents`) | File storage — absorbed into Reports | Reports |
| `calibration_psych` (Edge Function) | Duplicate of `calibration-psych` | Delete — use hyphenated version |

---

## PART 5: WHAT'S ENTIRELY NEW (Must Be Built)

| Feature | Priority | Complexity | Dependencies |
|---|---|---|---|
| **Automations Engine** | P1 | High | Needs scheduler, rule engine, execution pipeline |
| **Actions Execution** (Auto-Email, SMS, Hand Off) | P1 | Medium | Needs Resend/SendGrid + Twilio + task creation API |
| **Super Admin: Sales Pipeline** | P2 | Medium | CRM-like pipeline tracking for BIQc's own sales |
| **Super Admin: Support Console** | P2 | Medium | Client health aggregation + proactive alert triggers |
| **Super Admin: Billing** | P1 | High | Stripe integration for subscription management |
| **Super Admin: Partner Management** | P2 | Medium | Parent-child account model + commission tracking |
| **Admin Portal: My Clients** | P1 | Medium | Parent-child account creation + billing delegation |
| **Admin Portal: Client Billing** | P1 | High | Per-client billing + invoice generation |
| **Admin Portal: White Label** | P3 | High | Theming system + custom domain support |
| **Audit Log Frontend** | P2 | Low | Read from existing `usage_tracking` table |
| **Parent-Child Account Model** | P0 | Medium | Database schema: accounts table with parent_id, billing delegation |

---

## PART 6: RECOMMENDED BUILD ORDER

### Phase 1 — Foundation (Now)
1. Parent-Child account database schema
2. Role-based access control (superadmin, admin, owner, team_member)
3. Migrate current dashboard to Liquid Steel UI
4. Super Admin billing (Stripe)

### Phase 2 — Core Platform
5. Executive Overview (repurpose AdvisorWatchtower)
6. Revenue Module (extract from cognitive)
7. Operations Module (merge operator + SOP)
8. Risk Module (merge watchtower + diagnosis + intel centre)
9. Market Module (merge market analysis + competitor monitor)
10. Alerts (extract from resolution queue)

### Phase 3 — Execution Layer
11. Actions with email/SMS provider integration
12. Automations engine
13. Reports (merge boardroom + documents + strategic console)

### Phase 4 — Admin & Partner
14. Admin Portal: My Clients + Add Client
15. Admin Portal: Client Billing
16. Super Admin: Sales Pipeline + Support Console
17. Super Admin: Partner Management

### Phase 5 — Polish
18. Audit Log frontend
19. White Label system
20. Mobile-optimised views
