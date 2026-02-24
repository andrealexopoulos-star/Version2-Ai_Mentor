# BIQc — Industry Execution Blueprint
## Cognition-as-a-Platform for Sales-Led SMBs
## Feature Mapping: What Exists, What's Reused, What's New

---

## LIVE MOCKUPS

| Industry | URL |
|---|---|
| IT Services / MSP | https://market-cognitive.preview.emergentagent.com/site/platform/industry/msp |
| Commercial Contractors / HVAC | https://market-cognitive.preview.emergentagent.com/site/platform/industry/construction |
| Consulting / Professional Services | https://market-cognitive.preview.emergentagent.com/site/platform/industry/consulting |
| Marketing / Digital Agencies | https://market-cognitive.preview.emergentagent.com/site/platform/industry/agency |
| B2B SaaS | https://market-cognitive.preview.emergentagent.com/site/platform/industry/saas |

---

## INDUSTRY 1: IT SERVICES / MSP

### Industry-Specific Features

| Feature | Menu Location | Existing Edge Function | Existing Backend | Status | What's New |
|---|---|---|---|---|---|
| **Renewal Exposure Radar** | Executive Overview | `biqc-insights-cognitive` (revenue section parses contract dates) | `cognitive.py` | EXISTING data, NEW widget | Industry config to extract renewal dates from CRM contracts |
| **Revenue Concentration Monitor** | Executive Overview + Revenue | `biqc-insights-cognitive` + `cfo-cash-analysis` | `cognitive.py` | EXISTING — already calculates concentration | Just needs industry-specific thresholds (MSP: flag at 30%) |
| **SLA Drift Detection** | Operations | `biqc-insights-cognitive` (operations section) | `cognitive.py` | PARTIALLY EXISTS — operations metrics | NEW: Ticket volume trending needs PSA/ticketing integration via Merge.dev |
| **Contract Margin Monitor** | Revenue | `cfo-cash-analysis` (margin analysis per client) | `cognitive.py` | EXISTING — CFO agent analyses margins | NEW: Per-contract heat map visualisation |

### Universal Features Used

| Feature | Edge Function | Status |
|---|---|---|
| System State Engine | `biqc-insights-cognitive` → `system_state` | EXISTING |
| Active Inevitabilities | `biqc-insights-cognitive` → `inevitabilities` + `intelligence-bridge` | EXISTING |
| Decision Pressure Index | `biqc-insights-cognitive` → `priority_compression` | EXISTING (data exists, UI is NEW) |
| Executive Memo | `biqc-insights-cognitive` → `executive_memo` | EXISTING |
| Recalibration (14-day) | `checkin-manager` | EXISTING |
| Loading Animation | `CognitiveLoadingScreen.js` | EXISTING |
| Tutorials | `TutorialOverlay.js` | EXISTING (content needs industry-specific version) |
| SoundBoard | `strategic-console-ai` (ASK mode) + `soundboard.py` | EXISTING |
| SOP Generator | `sop-generator` | EXISTING (needs MSP-specific templates) |
| Business DNA | `calibration-sync` + `calibration-business-dna` | EXISTING (not deployed) |
| Account Settings | `profile.py` + `Settings.js` | EXISTING |

### What's New for MSP

| New Item | Effort | Priority |
|---|---|---|
| PSA/Ticketing integration (ConnectWise, Autotask) via Merge.dev Ticketing category | 16-24 hrs | P1 |
| Renewal date extraction from CRM contract fields | 4-8 hrs (prompt engineering) | P1 |
| SLA breach probability model (ticket volume vs team capacity) | 8-12 hrs | P2 |
| MSP-specific SOP templates (Onboarding, Incident Response, Change Management) | 2-4 hrs | P2 |
| Industry config JSON for MSP thresholds and terminology | 2 hrs | P1 |

---

## INDUSTRY 2: COMMERCIAL CONTRACTORS / HVAC

### Industry-Specific Features

| Feature | Menu Location | Existing Edge Function | Existing Backend | Status | What's New |
|---|---|---|---|---|---|
| **Project Margin Tracker** | Executive Overview | `cfo-cash-analysis` (analyses invoices + expenses per job) | `cognitive.py` | PARTIALLY EXISTS — financial analysis exists | NEW: Per-job margin tracking needs job costing data from accounting (Xero job tracking / MYOB jobs) |
| **Progress Claim Exposure** | Executive Overview | `cfo-cash-analysis` (aged receivables analysis) | `cognitive.py` | EXISTING — aged receivables already tracked | NEW: Construction-specific "progress claim" terminology and grouping |
| **Forward Work Coverage** | Revenue | `biqc-insights-cognitive` (pipeline analysis) | `cognitive.py` | EXISTING — pipeline data from CRM | NEW: Calculate months of confirmed work vs team capacity |
| **Subcontractor Cost Monitor** | Operations | `cfo-cash-analysis` (expense spike detection) | `cognitive.py` | EXISTING — expense anomaly detection | NEW: Categorise subcontractor costs specifically |

### What's New for Construction

| New Item | Effort | Priority |
|---|---|---|
| Job costing extraction from Xero/MYOB job tracking | 8-12 hrs (Merge.dev accounting API) | P1 |
| Progress claim categorisation in receivables | 4-8 hrs (prompt engineering) | P1 |
| Variation tracking (approved vs pending vs rejected) | 8-12 hrs | P2 |
| WHS compliance monitoring integration | 4-8 hrs | P2 |
| Construction-specific SOP templates (Site Induction, Safety, Defect Rectification) | 2-4 hrs | P2 |

---

## INDUSTRY 3: CONSULTING / PROFESSIONAL SERVICES

### Industry-Specific Features

| Feature | Menu Location | Existing Edge Function | Existing Backend | Status | What's New |
|---|---|---|---|---|---|
| **Utilisation Snapshot** | Executive Overview | `biqc-insights-cognitive` (people/capacity section) | `cognitive.py` | PARTIALLY EXISTS — capacity analysis exists | NEW: Billable hours tracking needs timesheet data (Deputy/HR integration) |
| **Scope Creep Monitor** | Operations | `cfo-cash-analysis` (quoted vs actual cost analysis) | `cognitive.py` | PARTIALLY EXISTS — expense vs revenue per client | NEW: Hours-based scope tracking (quoted hrs vs actual hrs) |
| **Proposal Stall Detector** | Revenue | `biqc-insights-cognitive` (pipeline stall detection) | `cognitive.py` | EXISTING — deal stall detection already built | Just needs consulting-specific thresholds (stall > 45 days vs normal 32-day cycle) |
| **WIP Ageing Monitor** | Revenue | `cfo-cash-analysis` (aged receivables) | `cognitive.py` | EXISTING — aged receivables analysis | NEW: Categorise as WIP specifically (unbilled work vs invoiced) |

### What's New for Consulting

| New Item | Effort | Priority |
|---|---|---|
| Timesheet/billable hours integration (Deputy, Employment Hero) | 12-16 hrs | P1 |
| Utilisation rate calculation engine (billable vs available) | 8-12 hrs | P1 |
| Scope creep detection (quoted vs actual hours per project) | 8-12 hrs | P1 |
| CPD compliance tracking | 4-8 hrs | P2 |
| Professional Services SOP templates (Client Onboarding, Engagement Letter, File Review) | 2-4 hrs | P2 |

---

## INDUSTRY 4: MARKETING / DIGITAL AGENCIES

### Industry-Specific Features

| Feature | Menu Location | Existing Edge Function | Existing Backend | Status | What's New |
|---|---|---|---|---|---|
| **Retainer Stability Monitor** | Executive Overview | `biqc-insights-cognitive` (revenue + churn signals) + `email_priority` (engagement patterns) | `cognitive.py` | PARTIALLY EXISTS — churn detection exists | NEW: Retainer-specific tracking (monthly value, renewal date, engagement score) |
| **Revenue Concentration** | Revenue | `biqc-insights-cognitive` + `cfo-cash-analysis` | `cognitive.py` | EXISTING | Already built — just needs agency-specific thresholds |
| **Scope Creep Monitor** | Operations | Same as Consulting | Same as Consulting | Same as Consulting | Same approach |
| **Client Engagement Decay** | Alerts | `email_priority` (response time monitoring) + `biqc-insights-cognitive` | `cognitive.py` + `email.py` | EXISTING — email engagement analysis already built | NEW: Agency-specific engagement scoring (meeting attendance, feedback speed, content approval time) |

### What's New for Agency

| New Item | Effort | Priority |
|---|---|---|
| Retainer value + renewal tracking from CRM/Accounting | 4-8 hrs | P1 |
| Client engagement composite score (email + meetings + content feedback) | 8-12 hrs | P1 |
| Agency SOP templates (Campaign Brief, Content Approval, Client Reporting) | 2-4 hrs | P2 |
| Campaign ROI tracking (future — needs marketing attribution integration) | 20-30 hrs | P3 |

---

## INDUSTRY 5: B2B SAAS

### Industry-Specific Features

| Feature | Menu Location | Existing Edge Function | Existing Backend | Status | What's New |
|---|---|---|---|---|---|
| **Churn Cohort Risk Snapshot** | Executive Overview | `biqc-insights-cognitive` (churn signals from CRM) + `email_priority` (engagement decline) | `cognitive.py` | PARTIALLY EXISTS — churn prediction signals exist | NEW: Usage-based churn scoring needs product usage data (custom API or webhook) |
| **Pipeline Velocity Monitor** | Revenue | `biqc-insights-cognitive` (pipeline analysis) | `cognitive.py` | EXISTING — pipeline velocity, deal stalls, win rate already calculated | SaaS-specific thresholds (demo→trial, trial→close conversion rates) |
| **Cash Runway & ARR Projection** | Revenue | `cfo-cash-analysis` (cash analysis) + `biqc-insights-cognitive` (runway) | `cognitive.py` | EXISTING — cash runway already calculated | NEW: ARR/MRR projections, scenario modelling (best/base/worst) |
| **CAC / LTV Tracking** | Revenue | `cfo-cash-analysis` | `cognitive.py` | PARTIALLY EXISTS — revenue per client exists | NEW: CAC calculation needs marketing spend + acquisition source data |

### What's New for SaaS

| New Item | Effort | Priority |
|---|---|---|
| Product usage data ingestion (custom API/webhook) | 12-20 hrs | P1 |
| Usage-based churn scoring model | 8-12 hrs | P1 |
| ARR/MRR projection engine with scenario modelling | 8-12 hrs | P1 |
| CAC calculation from marketing spend data | 8-12 hrs | P2 |
| SaaS SOP templates (Customer Onboarding, Feature Release, Churn Intervention) | 2-4 hrs | P2 |

---

## UNIVERSAL FEATURES — ACROSS ALL INDUSTRIES

| Feature | Edge Function | Backend | Frontend | Status |
|---|---|---|---|---|
| System State Engine (STABLE/DRIFT/COMPRESSION/CRITICAL) | `biqc-insights-cognitive` | `cognitive.py` | `AdvisorWatchtower.js` | EXISTING |
| Active Inevitabilities (max 3 risks) | `biqc-insights-cognitive` + `intelligence-bridge` | `cognitive.py` + `intelligence_actions.py` | `AdvisorWatchtower.js` | EXISTING |
| Decision Pressure Index (1-10) | `biqc-insights-cognitive` → `priority_compression` | `cognitive.py` | NEW widget needed | DATA EXISTS, UI NEW |
| Executive Memo (plain English briefing) | `biqc-insights-cognitive` → `executive_memo` | `cognitive.py` | `AdvisorWatchtower.js` | EXISTING |
| Weekly Brief | `biqc-insights-cognitive` → `weekly_brief` | `cognitive.py` | `AdvisorWatchtower.js` | EXISTING |
| Cash Runway | `biqc-insights-cognitive` → `cash_runway_months` | `cognitive.py` | `AdvisorWatchtower.js` | EXISTING |
| Strategic Alignment Check | `biqc-insights-cognitive` → `strategic_alignment_check` | `cognitive.py` | `AdvisorWatchtower.js` | EXISTING |
| Notification Bell + Smart Alerts | `email_priority` + `intelligence-bridge` | `profile.py` `/notifications/alerts` | `DashboardLayout.js` | EXISTING |
| SoundBoard (Strategic Chat) | `strategic-console-ai` (ASK mode) | `soundboard.py` | `MySoundBoard.js` | EXISTING |
| SOP Generator | `sop-generator` | `generation.py` | `SOPGenerator.js` | EXISTING |
| Board Room Diagnosis | `boardroom-diagnosis` | `boardroom.py` | `BoardRoom.js` | EXISTING |
| Market Analysis (SWOT) | `market-analysis-ai` | `research.py` | `MarketAnalysis.js` | EXISTING |
| Competitor Monitor (Weekly) | `competitor-monitor` | — | — | EXISTING (pg_cron) |
| Deep Web Recon | `deep-web-recon` | — | — | EXISTING |
| CFO Cash Analysis | `cfo-cash-analysis` | — | — | EXISTING (pg_cron) |
| Recalibration (14-day) | `checkin-manager` | — | `CheckInAlerts.js` | EXISTING |
| Weekly Video Check-In | `checkin-manager` | — | `CheckInAlerts.js` | EXISTING |
| Lottie Loading Animation | — | — | `CognitiveLoadingScreen.js` | EXISTING |
| Tutorial System (21+ pages) | — | — | `TutorialOverlay.js` | EXISTING |
| Business DNA (auto-populated) | `calibration-sync` + `calibration-business-dna` | `profile.py` | `BusinessProfile.js` + `Settings.js` | EXISTING (not deployed) |
| Account Settings | — | `profile.py` | `Settings.js` | EXISTING |
| Integrations | `integration-status` + `gmail_prod` + `outlook-auth` | `integrations.py` + `email.py` | `Integrations.js` | EXISTING |
| Email Inbox (Priority View) | `email_priority` | `email.py` | `EmailInbox.js` | EXISTING |
| Calendar View | — | `email.py` | `CalendarView.js` | EXISTING |
| Advisory System (Outcome Learning) | — | `cognitive.py` `/advisory/*` (5 endpoints) | NO FRONTEND | HALF-BUILT |
| Auto-Email Execution | — | — | UI buttons exist | HALF-BUILT |
| Quick-SMS Execution | — | — | UI buttons exist | HALF-BUILT |
| Hand Off Execution | — | — | UI button exists | HALF-BUILT |
| Voice Chat | — | `server.py` voice routes | `VoiceChat.js` | HALF-BUILT |
| Data Export | — | — | — | NOT BUILT |
| Automations (IF/THEN) | — | — | Mockup only | NOT BUILT |
| Stripe Billing | — | — | Settings tab exists | NOT BUILT |

---

## WHAT'S COMPLETELY NEW (Must Be Built for Industry Execution)

| Item | Industries That Need It | Effort | Priority |
|---|---|---|---|
| **Industry config layer** (`industry_config.json`) | ALL | 8-12 hrs | P0 |
| **Super Admin industry dropdown** ("View as Industry") | ALL | 4-8 hrs | P1 |
| **PSA/Ticketing integration** (ConnectWise, Autotask via Merge.dev) | MSP | 16-24 hrs | P1 |
| **Timesheet/HR integration** (Deputy, Employment Hero) | Consulting, Agency | 12-16 hrs | P1 |
| **Product usage webhook ingestion** | SaaS | 12-20 hrs | P1 |
| **Job costing extraction** from Xero/MYOB | Construction | 8-12 hrs | P1 |
| **Decision Pressure Index UI widget** | ALL | 4-8 hrs | P1 |
| **Utilisation rate calculation engine** | Consulting, Agency | 8-12 hrs | P1 |
| **ARR/MRR projection with scenarios** | SaaS | 8-12 hrs | P2 |
| **Industry-specific SOP template packs** | ALL (5 packs) | 10-20 hrs | P2 |
| **Industry-specific tutorial content** | ALL (5 versions) | 8-16 hrs | P2 |
| **Automation engine** | ALL | 40-60 hrs | P2 |
| **Email/SMS execution** (Resend + Twilio) | ALL | 32-48 hrs | P1 |

---

## WHAT'S CURRENTLY UNUTILISED (Built but not connected to any industry view)

| Feature | Where It Lives | Why Unutilised | How to Use It |
|---|---|---|---|
| Advisory system (5 backend endpoints) | `cognitive.py` `/advisory/*` | No frontend | Build outcome learning UI — improves recommendations over time for ALL industries |
| 20+ orphaned API endpoints | `profile.py`, `generation.py` | No frontend caller | Audit and wire to relevant pages or delete |
| Full-text search (GIN indexes) | Supabase DB | No search UI | Add global search bar — valuable for finding past SOPs, reports, insights |
| Team invitation system | `profile.py` endpoint | No frontend UI | Enable team members per industry (Ops staff sees Operations, Sales sees Revenue) |
| Email sync worker intelligence | `intelligence_automation_worker.py` | Running but outputs not surfaced | Connect to Alerts feed — surface email-derived intelligence as alerts |
| Silence detection | `silence_detection.py` | Running in background | Surface "no activity detected" alerts when owner disengages |
| Evidence freshness tracking | `evidence_freshness.py` | Running in background | Show data staleness in Data Health — "Your Xero data is 3 days old" |
| Contradiction engine | `contradiction_engine.py` | Running in background | Surface contradictions in Risk module — "You say growth but haven't done outbound in 14 days" |
| Decision pressure tracking | `decision_pressure` DB table | Data collected, not displayed | The Decision Pressure Index UI widget uses this data |
| Escalation memory | `escalation_memory.py` + DB table | Tracking escalations | Surface in Alerts — "This issue was flagged 3 times and ignored" |

---

## TOTAL BUILD EFFORT SUMMARY

| Category | Hours |
|---|---|
| Industry config layer + Super Admin dropdown | 12-20 |
| Industry-specific integrations (PSA, HR, Usage, Job Costing) | 48-72 |
| New UI widgets (Decision Pressure, Utilisation, ARR Projections) | 20-32 |
| Industry SOP template packs (5 industries) | 10-20 |
| Industry tutorial content (5 versions) | 8-16 |
| Email/SMS execution (half-built → complete) | 32-48 |
| Automation engine | 40-60 |
| Wire unutilised features | 16-24 |
| **TOTAL** | **186-292 hours** |

All 5 industry mockup pages use the same sidebar, topbar, and Edge Functions. The differentiation is in the **widgets shown**, **thresholds applied**, **language used**, and **SOP templates offered**. This is configuration, not separate codebases.
