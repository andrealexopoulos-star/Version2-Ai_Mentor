# BIQc: COGNITION-AS-A-PLATFORM — CURRENT STATE vs FULL VISION
## What Exists, What's Missing, and the Roadmap to End-to-End Delivery
### Prepared: 21 February 2026

---

## THE FIVE C-SUITE AGENTS: PROMISE vs REALITY

BIQc promises a digital leadership team — CTO, CFO, CMO, COO, CCO — deployed as AI agents. Here is exactly how each role is currently delivered, where the gaps are, and what must be built.

---

### 1. CFO — CHIEF FINANCIAL OFFICER AGENT

**What BIQc currently delivers:**

| Capability | Status | How It Works Today |
|---|---|---|
| Cash flow monitoring | PARTIAL | Xero/QuickBooks connected via Merge.dev (`/integrations/merge/link-token`). Reads deal and company data from CRM but does NOT pull live financial transactions |
| Invoice tracking | PARTIAL | Merge.dev accounting category can pull invoice metadata. No automated overdue detection |
| Cash leak detection | CLAIMED (landing page) but NOT IMPLEMENTED | No automated scan compares outgoing vs expected costs. The "8-12% cash bleed detected" claim has no backing feature |
| Budget vs actual | NOT BUILT | No budget input system. No variance calculation. No alerting |
| Tax liability monitoring | NOT BUILT | No ATO/tax integration. No GST/BAS tracking |
| Financial forecasting | NOT BUILT | No predictive models on revenue or expense trends |
| Supplier cost monitoring | NOT BUILT | The "Supplier price dropped 10%" comparison card is aspirational only |

**Gaps to close for full CFO Agent:**
1. **Financial data ingestion pipeline** — Merge.dev accounting category (Xero, QuickBooks, MYOB) must pull: invoices, bills, bank transactions, P&L, balance sheet. Currently only CRM data (contacts, deals) is actively ingested via `/intelligence/ingest`
2. **Automated cash flow analysis** — New Supabase Edge Function: `cfo-cash-analysis` that runs weekly, comparing income vs expenses, flagging anomalies, projecting cash runway
3. **Invoice overdue detection** — Cron job or Edge Function that checks unpaid invoices against terms, generates "LATE PAYMENT" alerts (currently this is hardcoded example text on the landing page)
4. **Budget tracking** — New database table `budgets` with monthly targets by category. New UI in Business DNA to set budgets. CFO Agent compares actuals vs budget weekly
5. **Supplier price comparison** — Requires either manual price input or integration with supplier portals

**Database tables that exist but are underutilised:**
- `intelligence_snapshots` — stores cognitive snapshots but no financial-specific analysis
- `intelligence_baseline` — stores baseline metrics but no financial KPIs

---

### 2. COO — CHIEF OPERATING OFFICER AGENT

**What BIQc currently delivers:**

| Capability | Status | How It Works Today |
|---|---|---|
| SOP Generation | BUILT | `/generate/sop` endpoint creates SOPs from prompts via OpenAI. UI at `/sop-generator` |
| SOP compliance monitoring | CLAIMED but NOT IMPLEMENTED | "97% SOP rate" on landing page. No actual SOP adherence tracking exists |
| Staff task monitoring | NOT BUILT | No integration with project management tools (Asana, Monday, Jira) |
| Operational drift detection | PARTIAL | `intelligence-snapshot` Edge Function generates a cognitive model with "system_state" (Stable/Drift/Compression/Critical) but this is AI-inferred from available data, not measured from operational metrics |
| Process automation | NOT BUILT | No workflow triggers. No "if X then do Y" automation engine |
| Employee hours & overtime tracking | NOT BUILT | No HR/payroll integration. No time tracking data |
| Operational efficiency metrics | PARTIAL | Dashboard shows "priority compression" and "opportunity decay" but these are AI-generated narratives, not computed from operational data |

**Gaps to close for full COO Agent:**
1. **Project management integration** — Merge.dev supports Asana, Monday, Jira via its Ticketing category. Connect these to track task completion rates, overdue items, workload distribution
2. **SOP compliance engine** — After generating SOPs, BIQc needs to monitor whether they're being followed. Requires: defining SOP steps as checkable items, tracking completion via integrations or manual check-ins
3. **HR/Payroll integration** — Merge.dev supports HR category (BambooHR, Gusto, etc). Pull employee data, hours, absence patterns
4. **Workflow automation engine** — New system: define triggers ("invoice unpaid > 30 days") → actions ("send reminder email", "escalate to manager"). Currently BIQc detects but cannot act
5. **Operational KPI dashboard** — Currently the Operator Dashboard (`/operator`) exists as a page but depends on `intelligence-snapshot` AI narratives rather than hard operational metrics

**What exists and works well:**
- SOP Generator (`/generate/sop`, `/generate/checklist`, `/generate/action-plan`)
- Diagnosis system (`/diagnose`, `/diagnoses`)
- Strategic Console (`/strategic-console/briefing`, `/strategic-console/synthesize`)
- Operator Dashboard page (UI exists, needs data feeds)

---

### 3. CMO — CHIEF MARKETING OFFICER AGENT

**What BIQc currently delivers:**

| Capability | Status | How It Works Today |
|---|---|---|
| Competitor monitoring | PARTIAL | `deep-web-recon` Edge Function scans social handles + public signals. Perplexity API used for competitive intelligence in calibration |
| Market analysis | BUILT | Market Analysis page (`/market-analysis`) with AI-generated analysis via `/analyses` endpoint |
| Website audit | BUILT | `/research/analyze-website` and `/enrichment/website` endpoints crawl and analyse websites |
| Social media monitoring | PARTIAL | Social handles stored (`/intelligence/social-handles`) and scanned by `deep-web-recon`, but no continuous monitoring or sentiment tracking |
| Lead tracking | PARTIAL | CRM integration via Merge.dev pulls contacts/deals/companies. But no lead scoring, no funnel analysis |
| Content performance | NOT BUILT | No blog/content analytics integration |
| Brand sentiment | NOT BUILT | No social listening beyond basic handle scanning |
| Ad spend monitoring | NOT BUILT | No Google Ads / Meta Ads / LinkedIn Ads integration |
| Customer acquisition cost | CLAIMED but NOT COMPUTED | "High CAC" detection mentioned in value props but no actual CAC calculation from marketing spend vs new customers |

**Gaps to close for full CMO Agent:**
1. **Continuous competitor monitoring** — The `deep-web-recon` function runs on-demand. Needs a scheduled cron (weekly) to re-scan and diff against previous results, generating "COMPETITOR ALERT" events
2. **Lead scoring** — Combine CRM deal data with engagement signals to score leads. New table `lead_scores` with computed values
3. **Marketing analytics integration** — Google Analytics, Google Ads, Meta Business. New Merge.dev marketing category or direct API integrations
4. **Customer acquisition cost calculator** — Requires: marketing spend data (from integrations) + new customer count (from CRM). Compute CAC = spend / new customers per period
5. **Social sentiment analysis** — Extend `deep-web-recon` to analyse tone of mentions, reviews, social posts. Currently it just counts signals

**What exists and works well:**
- Intel Centre (`/intel-centre`) — aggregates intelligence signals
- Market Analysis page with AI-driven analysis
- Website research endpoint
- Social handles capture and recon

---

### 4. CTO — CHIEF TECHNOLOGY OFFICER AGENT

**What BIQc currently delivers:**

| Capability | Status | How It Works Today |
|---|---|---|
| Tech stack detection | PARTIAL | Website scan in calibration detects some tech indicators |
| Integration management | BUILT | Full Merge.dev integration framework with connect/disconnect/status. Google Drive, Outlook, Gmail integrations |
| Data pipeline monitoring | NOT BUILT | No monitoring of integration health, sync failures, data freshness |
| Security posture | NOT BUILT | No vulnerability scanning, no compliance checking |
| System uptime monitoring | NOT BUILT | No integration with monitoring tools (Datadog, Pingdom, etc) |
| API usage tracking | NOT BUILT | No tracking of BIQc's own API consumption or costs |
| Tech debt identification | NOT BUILT | No code or system analysis |

**Gaps to close for full CTO Agent:**
1. **Integration health dashboard** — Monitor connected integrations for sync failures, stale data, auth expiry. New endpoint: `/integrations/health`
2. **Data freshness tracking** — For each connected source, track last sync time. Alert if data is stale > 24 hours
3. **Cost tracking per user** — Track OpenAI/Perplexity API costs per workspace. Already identified as a future task in previous sessions
4. **Uptime/performance monitoring** — Out of scope for MVP. Could integrate with Pingdom/UptimeRobot APIs later

**What exists and works well:**
- Merge.dev integration framework (CRM, Accounting)
- Google Drive integration (connect, sync, files)
- Email integration (Outlook + Gmail, with OAuth, sync, calendar)
- Data Center file uploads and management

---

### 5. CCO — CHIEF COMPLIANCE OFFICER AGENT

**What BIQc currently delivers:**

| Capability | Status | How It Works Today |
|---|---|---|
| SOP breach detection | CLAIMED but NOT IMPLEMENTED | Landing page shows "SOP BREACH: 3 leads not called in 24hrs" but no actual SOP monitoring system exists |
| Regulatory compliance tracking | NOT BUILT | No ATO, ASIC, APRA, or industry-specific compliance monitoring |
| Audit trail | PARTIAL | `prompt_audit_logs` table tracks AI prompt usage. `advisory_log` tracks advisory interactions. But no compliance-specific audit trail |
| Risk assessment | PARTIAL | `intelligence-snapshot` generates a `system_state` with risk indicators. `boardroom-diagnosis` runs multi-agent risk assessment |
| Data governance | PARTIAL | Trust page exists. Privacy claims documented. But no automated data retention/deletion policies |
| Policy enforcement | NOT BUILT | No mechanism to define business rules and automatically enforce them |
| Compliance calendar | NOT BUILT | No tracking of filing deadlines (BAS, tax, insurance renewals, licence renewals) |

**Gaps to close for full CCO Agent:**
1. **Business rules engine** — Define rules ("All leads must be contacted within 24 hours", "Invoices must be sent within 48 hours of work completion"). Monitor via CRM/accounting integrations. Generate breach alerts
2. **Compliance calendar** — New table `compliance_events` with recurring deadlines. New UI to manage. Automated reminders
3. **Regulatory monitoring** — New Edge Function that monitors relevant government/regulatory feeds for changes affecting the user's industry
4. **Automated audit reports** — Generate monthly compliance reports showing: SOP adherence, regulatory status, risk incidents

---

## CROSS-CUTTING PLATFORM CAPABILITIES

### What Currently Works End-to-End

| Capability | Components | Status |
|---|---|---|
| **Calibration/Onboarding** | `calibration-psych` Edge Function → 9 questions → WowSummary → Business DNA | WORKING |
| **Cognitive Snapshot** | `intelligence-snapshot` Edge Function → system_state, inevitabilities, priority compression, opportunity decay | WORKING |
| **BIQc Insights (Advisor)** | AdvisorWatchtower page → displays cognitive snapshot → refresh | WORKING |
| **Strategic Console (War Room)** | `strategic-console-ai` Edge Function → AI briefing + synthesis | WORKING |
| **Board Room** | `boardroom-diagnosis` Edge Function → multi-agent debate (Finance, Ops, Sales, Risk, Compliance) | WORKING |
| **SoundBoard** | `/soundboard/chat` → contextual AI conversation with business context | WORKING |
| **SOP Generation** | `/generate/sop`, `/generate/checklist`, `/generate/action-plan` | WORKING |
| **Diagnosis** | `/diagnose` → AI diagnosis with strategic analysis | WORKING |
| **Email Integration** | Outlook + Gmail OAuth → sync → calendar → priority inbox | WORKING |
| **CRM Integration** | Merge.dev → contacts, companies, deals, owners | WORKING |
| **Document Management** | Upload, view, delete via Data Center | WORKING |
| **Google Drive** | Connect, sync, browse files | WORKING |
| **Business Profile** | Full CRUD with versioning, autofill, AI build | WORKING |
| **Admin Console** | User management, stats, backfill | WORKING |
| **Fact Resolution** | `/facts/resolve`, `/facts/confirm` — verify/dispute AI claims | WORKING |

### What's Broken or Incomplete

| Capability | Issue |
|---|---|
| **Recalibration cycle** | No 2-week recalibration system (designed but not yet built) |
| **Integration gate in onboarding** | Integrations are buried in nav, not prompted during onboarding |
| **Notification system** | `ENABLE_NOTIFICATIONS_POLLING = false` — feature-flagged off |
| **Watchtower events** | `/watchtower/emit` and `/watchtower/analyse` exist but no automated event generation pipeline |
| **Intelligence Actions** | `/intelligence/actions` table exists but actions aren't auto-generated from insights |
| **Email intelligence** | Emails sync but `/outlook/intelligence` analysis is basic — no continuous threat/opportunity extraction |
| **Calendar intelligence** | Calendar syncs but no AI analysis of meeting patterns, time allocation, scheduling conflicts |

---

## THE GAP MAP: CURRENT STATE → FULL COGNITION PLATFORM

### TIER 1: FOUNDATION GAPS (Must fix to deliver the current promise)

| # | Gap | Impact | Effort | Priority |
|---|---|---|---|---|
| 1 | **No automated financial analysis** | CFO Agent is empty. Cash leak claims are unsubstantiated | 80-120 hrs | P0 |
| 2 | **No SOP compliance monitoring** | CCO Agent is empty. SOP breach alerts are fake | 60-80 hrs | P0 |
| 3 | **No workflow automation/actions** | BIQc detects but cannot act. "Send Auto-Reminder" buttons don't work | 100-150 hrs | P0 |
| 4 | **No integration gate in onboarding** | Users never connect tools → BIQc has no data → insights are generic | 50-90 hrs | P0 |
| 5 | **Notifications disabled** | Users don't receive alerts → they forget BIQc exists → churn | 20-30 hrs | P0 |

### TIER 2: INTELLIGENCE GAPS (Required for "Cognition" differentiation)

| # | Gap | Impact | Effort | Priority |
|---|---|---|---|---|
| 6 | **No continuous competitor monitoring** | CMO Agent runs once, not continuously | 40-60 hrs | P1 |
| 7 | **No lead scoring** | CRM data ingested but not scored or prioritised | 40-60 hrs | P1 |
| 8 | **No budget vs actual tracking** | CFO Agent can't flag overspend without budget data | 30-50 hrs | P1 |
| 9 | **No recalibration system** | Business DNA goes stale → insights drift | 30-40 hrs | P1 |
| 10 | **No email intelligence pipeline** | Emails sync but aren't mined for business signals | 50-70 hrs | P1 |

### TIER 3: PLATFORM GAPS (Required for enterprise-grade "Platform")

| # | Gap | Impact | Effort | Priority |
|---|---|---|---|---|
| 11 | **No business rules engine** | Can't define and enforce custom business policies | 80-120 hrs | P2 |
| 12 | **No compliance calendar** | No deadline tracking for tax, insurance, licences | 30-40 hrs | P2 |
| 13 | **No marketing analytics integration** | No Google Ads, Meta, LinkedIn data → CAC uncalculated | 40-60 hrs | P2 |
| 14 | **No HR/payroll integration** | No employee hours, overtime, absence data | 30-40 hrs | P2 |
| 15 | **No project management integration** | No Asana/Monday/Jira task tracking | 30-40 hrs | P2 |
| 16 | **No cost tracking per workspace** | Can't show ROI or control API costs | 20-30 hrs | P2 |
| 17 | **No multi-user collaboration** | Single-user only. No team roles, permissions, shared views | 60-80 hrs | P2 |

---

## THE END-TO-END VISION: HOW BIQc BECOMES A FULL COGNITION PLATFORM

### Current Architecture (What Exists)

```
DATA IN                        COGNITION LAYER                    INSIGHTS OUT
─────────                      ────────────────                   ────────────
Website crawl ──────┐
Calibration Q&A ────┤          ┌─────────────────┐
CRM (Merge.dev) ────┤          │  intelligence-   │               ┌──────────────┐
Email (Outlook) ────┤────────► │  snapshot         │──────────────►│ Advisor      │
Email (Gmail) ──────┤          │  (Edge Function)  │               │ Dashboard    │
Google Drive ───────┤          └─────────────────┘               │ War Room     │
Documents ──────────┘                                             │ Board Room   │
                                                                  │ SoundBoard   │
                                                                  └──────────────┘
```

### Target Architecture (Full Cognition Platform)

```
DATA IN                        COGNITION LAYER                    ACTION OUT
─────────                      ────────────────                   ──────────
Website crawl ──────┐          ┌─────────────────┐               ┌──────────────┐
Calibration Q&A ────┤          │  CFO Agent       │───────────────│ Alerts       │
CRM (HubSpot etc) ──┤          │  - Cash analysis │               │ Force Memos  │
Accounting (Xero) ──┤          │  - Invoice alerts│               │ Auto-Actions │
Email (Outlook) ────┤          │  - Budget vs act │               │  - Send email│
Email (Gmail) ──────┤          ├─────────────────┤               │  - Create    │
Google Drive ───────┤────────► │  COO Agent       │───────────────│    task      │
HR (BambooHR) ──────┤          │  - SOP monitor   │               │  - Flag      │
Project (Asana) ────┤          │  - Task tracking │               │    invoice   │
Marketing (GA) ─────┤          │  - Process auto  │               │  - Schedule  │
Calendar ───────────┤          ├─────────────────┤               │    meeting   │
Social handles ─────┤          │  CMO Agent       │               │ Reports      │
Competitors ────────┤          │  - Lead scoring  │               │  - Weekly    │
Regulatory feeds ───┤          │  - Market intel  │               │    briefing  │
                    │          │  - CAC tracking  │               │  - Monthly   │
                    │          ├─────────────────┤               │    audit     │
                    │          │  CTO Agent       │               │  - Board     │
                    │          │  - Integration   │               │    pack      │
                    │          │    health        │               │ Dashboards   │
                    │          │  - Data freshness│               │  - CFO view  │
                    │          ├─────────────────┤               │  - COO view  │
                    │          │  CCO Agent       │               │  - CMO view  │
                    │          │  - Rules engine  │               │ Notifications│
                    │          │  - Compliance    │               │  - Push      │
                    │          │    calendar      │               │  - Email     │
                    │          │  - Audit trail   │               │  - In-app    │
                    │          └─────────────────┘               └──────────────┘
```

### What Changes

| Layer | Current | Target |
|---|---|---|
| **Data In** | 6 sources (website, calibration, CRM, email, drive, documents) | 12+ sources (add accounting, HR, project mgmt, marketing, social, regulatory) |
| **Cognition** | 1 unified snapshot (intelligence-snapshot) | 5 specialised agents each with their own analysis loop + a Chief Agent that coordinates |
| **Action Out** | Display only (dashboards, force memos) | Detect + Act (send emails, create tasks, flag invoices, schedule meetings, generate reports) |
| **Feedback Loop** | None | User confirms/rejects actions → agents learn preferences → fewer false positives over time |

---

## IMPLEMENTATION ROADMAP

### Phase 1: Fix the Foundation (Weeks 1-4)
- Enable notifications system
- Build integration gate in onboarding
- Build recalibration system (2-week cycle)
- Activate Watchtower automated event pipeline

### Phase 2: CFO + COO Agents (Weeks 5-10)
- Accounting data ingestion (Xero, QuickBooks via Merge.dev)
- Automated cash flow analysis Edge Function
- Invoice overdue detection + alerting
- SOP compliance monitoring engine
- Budget vs actual tracking

### Phase 3: CMO + CCO Agents (Weeks 11-16)
- Continuous competitor monitoring (scheduled deep-web-recon)
- Lead scoring from CRM data
- Business rules engine
- Compliance calendar
- Email intelligence pipeline

### Phase 4: Action Layer (Weeks 17-22)
- Workflow automation engine (trigger → action)
- Auto-email sending (via Outlook/Gmail)
- Auto-task creation (via Asana/Monday integration)
- Report generation (weekly briefing, monthly audit, board pack)

### Phase 5: Platform Maturity (Weeks 23-30)
- Multi-user collaboration with roles and permissions
- Marketing analytics integration
- HR/payroll integration
- Cost tracking per workspace
- Mobile app (React Native)

---

**Total estimated effort to full Cognition Platform:** 800-1,200 engineering hours over 30 weeks

**Current state delivers approximately 25-30% of the full vision.** The cognitive layer (AI analysis) is strong. The data layer (integrations) is partial. The action layer (automated responses) is zero.

The single most important architectural decision: **Build the Action Layer.** Without it, BIQc detects but cannot respond — which makes it a dashboard, not a cognitive platform.
