# What is BIQc — Product Intelligence Brief

## What BIQc Is

BIQc (Business Intelligence Quotient Centre) is a **sovereign AI intelligence platform** purpose-built for Australian SMB owners and leadership teams running businesses between $2M and $50M+ in annual revenue.

It is **not** a dashboard. It is **not** a reporting tool. It is **not** another analytics product.

BIQc is a **cognition layer** that sits above your existing business systems — your CRM, your accounting software, your email, your HR tools — and continuously reads, interprets, and reasons about what is happening across your entire operation. It then tells you what matters, what's changing, and what to do about it, in plain language, before problems become crises.

The founding principle: **business owners shouldn't need to hire analysts, read dashboards, or interpret spreadsheets to understand their own company.** They should be able to ask a question and get an answer that's specific to their business, grounded in their real data, and actionable this week.

---

## Who It's For

BIQc is designed for:

- **Business owners** running $2M–$50M+ companies who are too busy operating to analyse
- **CEOs and Managing Directors** who need a unified view across departments they can't personally monitor every day
- **CFOs and COOs** who need cash visibility, operational capacity signals, and risk detection without waiting for month-end reports
- **Commercial leaders** who need pipeline health, customer concentration risk, and competitive positioning — not more CRM screens

These are people who make 10–50 decisions per week that affect revenue, cash, people, and operations. Most of those decisions are made with incomplete information, gut feel, or stale data. BIQc exists to change that.

---

## How It Helps Business Leaders

### The Problem It Solves

The average SMB leader uses 8–15 disconnected tools: Xero for accounting, HubSpot or Salesforce for CRM, Outlook or Gmail for communication, MYOB or QuickBooks for payroll, Monday.com or Asana for project management, plus spreadsheets. None of these tools talk to each other. None of them tell you what the combined picture means.

The result:
- You find out about cash problems when the bank calls
- You discover client churn when the invoice doesn't get paid
- You learn about team burnout when someone resigns
- You notice margin compression when it's already too late to fix
- You respond to competitive threats after they've already taken market share

### What BIQc Does Instead

BIQc connects to your systems once, then continuously monitors five domains of business health:

| Domain | What BIQc Watches | What You Get |
|--------|-------------------|--------------|
| **Revenue** | CRM pipeline, deal velocity, stalled opportunities, client concentration, win/loss rates | "Your top 3 deals have been stalled for 18 days. Concentration risk: 40% of pipeline is one client." |
| **Cash** | Invoices, receivables aging, burn rate, payment patterns, cash runway | "You have $380K in receivables over 45 days. At current burn, that's 6 weeks of operating cash trapped." |
| **Operations** | Capacity utilisation, process bottlenecks, SLA adherence, project delivery | "Team capacity is at 92%. Two more client onboards without a hire will breach delivery timelines." |
| **People** | Email response patterns, meeting load, engagement signals, key-person dependency | "Response times from your sales team have increased 40% this month. Three team members have cancelled recurring 1:1s." |
| **Market** | Competitor movements, pricing shifts, digital footprint, brand positioning | "Two new specialty roasters launched in your primary market this quarter. Your digital footprint score dropped 8 points." |

### The Intelligence Engine

Under the surface, BIQc runs a **Cognition Core** — a SQL-first intelligence engine that computes:

1. **Instability Indices**: For each domain (Revenue, Cash, Operations, People, Market), BIQc computes a real-time instability score that tells you how stable or volatile that area of your business is. These are not opinions — they're computed from your live integration data using mathematical models.

2. **Propagation Map**: BIQc understands that business domains are connected. If revenue instability increases, there's an 88% probability it will affect cash within 7 days. If cash tightens, operations get squeezed within 14 days. The propagation map shows you these chain reactions before they happen.

3. **Stability Score**: A composite number (0–100) that represents the overall health and resilience of your business at any given moment. Not a vanity metric — it's derived from the weighted combination of all five domain indices plus the propagation risk between them.

4. **Observation Events**: Every data point from your integrations (a stalled deal, an overdue invoice, a spike in meeting cancellations) is captured as a structured "observation event" with a domain tag, severity level, and timestamp. These events feed the intelligence engine and the AI advisor.

---

## The Proposed Level of Intelligence

### What the User Gets With Full Data + Integrations

When a BIQc user has their CRM (HubSpot/Salesforce), accounting (Xero/QuickBooks), and email (Outlook/Gmail) connected, the platform delivers:

#### 1. The SoundBoard — Strategic AI Advisor

A conversational AI advisor that has read all your data and speaks like a senior consultant who knows your business. Not a chatbot. Not a generic AI. A Strategic Intelligence Advisor that:

- References your actual revenue numbers, not "consider your revenue"
- Names specific deals that are stalling and quantifies the dollar impact
- Calculates your revenue-per-employee ratio and benchmarks it against your industry
- Identifies cash flow risk by computing receivables aging from your Xero data
- Flags competitive threats from your market position and digital footprint
- Tells you the ONE thing to do this week, not five generic suggestions

**Response contract** (enforced by system):
- **Situation**: What is happening, with specific numbers and entity names
- **Decision**: One clear recommendation
- **This-week action**: One concrete step with who/what/by-when
- **Risk if delayed**: What happens if you don't act, quantified where possible

**Guardrail system**:
- If user has < 2 profile fields → BLOCKED (explicit message: "Complete calibration first")
- If user has < 4 fields → DEGRADED (transparent about limitations)
- If user has 4+ fields → FULL intelligence mode
- Live signal freshness: observation_events count and age injected into every request

#### 2. Voice Advisor — Real-Time Conversation

A voice-based AI session (OpenAI Realtime API) where the business owner can speak naturally and get strategic advice back in real time. The AI knows the user's business name, industry, revenue range, team size, challenges, and goals — injected as session instructions before the conversation starts.

#### 3. Daily Brief — Proactive Intelligence

Every day, BIQc generates a priority brief based on overnight changes:
- Which instability indices moved
- Which integrations triggered new observation events
- What the top priority domain is
- Suggested first action for the day

This appears as a banner on login and a card on the advisor page.

#### 4. Decision Tracker — Impact Measurement

Users record strategic decisions (hiring, pricing changes, market moves) and BIQc schedules 30/60/90-day outcome checkpoints. At each checkpoint, the user records whether the decision was effective or not. Over time, this builds a decision-quality dataset that feeds back into the intelligence engine.

#### 5. Competitive Benchmark — Market Position

A Digital Footprint score (0–100) with 5-pillar breakdown:
- Website Presence
- Social Engagement
- Review Reputation
- Content Authority
- SEO Visibility

Plus industry percentile ranking showing where the business sits relative to competitors.

### Signal Types BIQc Detects (Live)

From connected integrations, BIQc's emission layer detects and classifies these signal types:

| Signal | Source | What It Means |
|--------|--------|---------------|
| `deal_stall` | HubSpot/Salesforce | A deal has been in the same stage for 14+ days with no activity |
| `pipeline_decay` | CRM | Overall pipeline value declining week-over-week |
| `invoices_overdue_cluster` | Xero/QuickBooks | Multiple invoices from the same client are past due |
| `cash_burn_acceleration` | Accounting | Monthly expenditure increasing faster than revenue |
| `margin_compression` | Accounting | Gross margin declining over 3+ months |
| `response_delay` | Email/Calendar | Average response time to clients increasing |
| `thread_silence` | Email | Key client email threads going cold (no reply 5+ days) |
| `meeting_cancellation_cluster` | Calendar | Multiple meetings cancelled in a short period |
| `meeting_overload` | Calendar | Team members in 6+ hours of meetings daily |
| `decision_gap` | Decision Tracker | Recorded decision approaching checkpoint with no outcome logged |

### What Intelligence Looks Like at Each Tier

| Tier | Price | Intelligence Level |
|------|-------|-------------------|
| **Free** | $0/mo | Market intelligence (basic), Business DNA profile, 1 forensic audit/month, 3 snapshots/month, email integration |
| **Foundation** | $750/mo | Live market metrics, revenue intelligence, workforce baseline, cash discipline visibility, 60-day forecasting |
| **Performance** | $1,950/mo | Everything in Foundation + service-line profitability, hiring trigger detection, capacity strain modelling, margin compression alerts, SoundBoard AI, 90-day projections |
| **Growth** | $3,900/mo | Everything in Performance + multi-entity consolidation, acquisition readiness scoring, board-ready reporting, scenario modelling, dedicated advisor |

### The Promise

BIQc promises SMB leaders and owners:

**"You will never be surprised by your own business again."**

With full integrations connected, BIQc delivers:
- **6 hours saved per week** on manual reporting and data gathering
- **83% faster risk detection** — problems flagged before they become crises
- **$47K average cash recovered annually** from receivables management alone
- **1 single source of truth** — every department, every tool, one intelligence layer

The platform doesn't replace the business owner's judgment. It arms it. Every response is data-bound or explicitly blocked. No generic advice. No filler. No "consider your options." Just specific, actionable intelligence grounded in your real numbers.

---

## Architecture (Sovereignty Model)

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React + Tailwind | Thin visualisation/interaction layer |
| AI Router | `core/llm_router.py` | Direct OpenAI (gpt-4o), no third-party AI dependency |
| Cognition Core | Supabase SQL functions | Instability computation, propagation mapping, stability scoring |
| Emission Layer | `merge_emission_layer.py` | Transforms integration data into structured observation events |
| Integrations | Merge API (500+ tools) | CRM, Accounting, Email, HRIS, ATS connections |
| Database | Supabase PostgreSQL | Australian-hosted, AES-256 encrypted |
| Mobile | React Native (Expo) | 5-tab thin client consuming same APIs |

**Australian sovereignty**: All data processed and stored in Australia. No offshore AI processing. No third-party analytics platforms touching business data. The intelligence engine runs on the user's own Supabase instance.
