# BIQc — Product Online Demo Script
## Complete Walkthrough: Website → Sign-Up → Calibration → Platform → Features

**Duration:** 45–60 minutes (can be shortened to 20 minutes for executive version)
**Presenter role:** Product Lead / Solutions Architect
**Demo environment:** https://biqc.ai (production) or preview URL
**Test credentials:** andre@thestrategysquad.com.au / BIQc_Test_2026!

---

## PRE-DEMO CHECKLIST

- [ ] Confirm demo URL is live and responsive
- [ ] Clear browser localStorage (to trigger first-visit tutorials)
- [ ] Ensure screen share is on 1920x1080+ resolution
- [ ] Have a second browser tab ready with the register page
- [ ] Have a notepad ready for prospect questions

---

## SECTION 1: WEBSITE WALKTHROUGH (5 minutes)

### 1.1 Landing Page (/)

**NAVIGATE TO:** biqc.ai

**SAY:**

> "BIQc is not a dashboard. It's not a chatbot. It's not another SaaS tool.
>
> BIQc is an always-on intelligence layer for your business. Think of it as a digital COO, CFO, and compliance officer — monitoring your entire business 24 hours a day, 7 days a week.
>
> The headline says it clearly: Run Your Business Like The Big Players — Without The Cost. Enterprise-grade intelligence at a fraction of one senior hire."

**POINT OUT:**
- The "Autonomous Business Intelligence" badge
- The CTA: "Book a live demo"
- The trust signals: "Not a chatbot. Not a dashboard. Not another tool."
- Australian owned & operated badge
- Stats bar: 40% operational improvement, 50% reduced manual work, 3x faster anomaly detection

**SCROLL TO:** Architecture diagram

> "This is how BIQc works. On the left, you connect your existing tools — Xero, HubSpot, Stripe, Google Workspace, Slack. BIQc sits in the centre as the intelligence engine. On the right, you get: Executive Alerts, Revenue Warnings, Compliance Flags, Cash Flow Risks, and Auto-Generated Briefings.
>
> You don't build dashboards. You don't run reports. BIQc generates intelligence autonomously."

### 1.2 Platform Page (/site/platform)

**NAVIGATE TO:** /site/platform

**SAY:**

> "Let me show you the problem we solve.
>
> Most SMBs — businesses with 10 to 150 staff — are running enterprise-level complexity on startup-level infrastructure.
>
> Too many disconnected tools. No central oversight. Reactive decision-making. Hidden financial leaks.
>
> BIQc solves this in six layers: Connect → Unify → Monitor → Flag → Recommend → Correct."

### 1.3 Intelligence Page (/site/intelligence)

**NAVIGATE TO:** /site/intelligence

**SAY:**

> "BIQc analyses six categories of business data:
>
> Financial — cash flow, invoices, aged receivables, margin variance.
> Revenue — pipeline velocity, lead conversion, churn risk.
> Operations — staff utilisation, SOP compliance, delivery timelines.
> Risk & Compliance — missing documentation, regulatory exposure.
> Market — competitor changes, industry benchmarks.
> Communication — email response patterns, escalation triggers.
>
> Every data point is mapped, monitored, and cross-referenced. Autonomously."

### 1.4 Integrations Page (/site/integrations)

**NAVIGATE TO:** /site/integrations

**SAY:**

> "BIQc integrates with virtually any platform that has an API.
>
> Direct integrations: Xero, MYOB, QuickBooks, HubSpot, Salesforce, Stripe, Shopify, Slack, Microsoft 365, Google Workspace, Deputy, Employment Hero.
>
> Plus: Open API support, webhook ingestion, CSV import, and secure data sync.
>
> Every connection is encrypted. OAuth authenticated. Role-based access. You can disconnect any integration at any time."

### 1.5 Trust Page (/site/trust)

**NAVIGATE TO:** /site/trust

**SAY:**

> "Trust is non-negotiable. BIQc is built for businesses that take data seriously.
>
> All data is hosted exclusively in Australian data centres — Sydney and Melbourne. No offshore processing. No international data transfers.
>
> AES-256 encryption at rest. TLS 1.3 in transit. Full audit trail. SOC 2 Type II in progress.
>
> Our legal framework is transparent: Terms & Conditions, Privacy Policy, Data Processing Agreement, Security & Infrastructure documentation — all accessible, all current."

---

## SECTION 2: SECURITY & DATA SOVEREIGNTY (5 minutes)

### 2.1 Security Architecture

**SAY:**

> "Let me address security directly, because this is often the first question from procurement.

> **Data Residency:** 100% Australian. Sydney and Melbourne data centres only. Supabase PostgreSQL with Australian hosting. No data leaves the country. Ever.

> **Encryption:** AES-256 at rest, TLS 1.3 in transit. Database-level encryption. No plain-text data storage.

> **Authentication:** Supabase Auth with OAuth 2.0. Google and Microsoft single sign-on. Session management with automatic timeout.

> **Access Control:** Row-Level Security (RLS) enforced at the database level. Each tenant's data is completely isolated. Cross-tenant queries are physically prevented.

> **AI Architecture — this is critical:** BIQc runs siloed AI instances per client. Your data never trains shared models. Your prompts never leak. Your business intelligence is never used to improve another client's experience. This is not how most AI platforms work — most use shared models. We don't."

### 2.2 Machine Learning Policy — No External Model Training

**SAY:**

> "Our ML policy is explicit and contractual:
>
> 1. **No external model training.** Your business data is never used to train, fine-tune, or improve any external AI model — not OpenAI's, not anyone's.
>
> 2. **No data sharing with AI providers.** We use OpenAI's API in a zero-retention configuration. Data sent for analysis is processed and discarded. It is not stored by OpenAI. It is not used for model improvement.
>
> 3. **No cross-tenant learning.** Intelligence generated for your business stays within your business. There is no 'federated learning' or 'aggregate insights' that leak information between clients.
>
> 4. **Supplier agreements enforce this.** Our data processing agreements with all AI providers — OpenAI, Perplexity, Firecrawl — explicitly prohibit data retention, model training, and third-party sharing. These are auditable.
>
> 5. **Australian Privacy Act compliance.** We operate under the Privacy Act 1988 and adhere to the Australian Privacy Principles. Your data is subject to Australian law, not US or EU jurisdictions.
>
> If your procurement team needs to see our DPA, sub-processor list, or security documentation — it's all accessible under the Trust tab. We don't hide our infrastructure."

---

## SECTION 3: SIGN-UP & REGISTRATION (3 minutes)

### 3.1 Registration Page

**NAVIGATE TO:** /register-supabase

**SAY:**

> "Let me show you what your team's first experience looks like.
>
> Registration is simple: name, email, password, company, industry. Or single sign-on with Google or Microsoft — one click.
>
> Notice the trust panel on the right: AES-256 encryption, real-time signals, zero leakage, Australian sovereign data. We reinforce trust from the first interaction."

**POINT OUT:**
- Dark Liquid Steel theme — premium, not template-y
- Google + Microsoft OAuth buttons
- "100% Australian data sovereignty guaranteed" badge
- 6 form fields: Full Name, Email, Company, Industry, Password, Confirm Password

### 3.2 What Happens After Registration

> "After registration, BIQc immediately routes the user to calibration. This is not a form. It's a conversation."

---

## SECTION 4: CALIBRATION EXPERIENCE (7 minutes)

### 4.1 Psychology Profiling (9 Steps)

**NAVIGATE TO:** /calibration (or describe if demo user is already calibrated)

**SAY:**

> "Calibration is what makes BIQc different from every other platform.
>
> Most intelligence tools give everyone the same output. BIQc doesn't.
>
> The first thing BIQc does is learn HOW you want to receive information. It's a 9-step conversational profiling:
>
> 1. Communication style — Do you prefer formal reports or casual updates?
> 2. Verbosity — Short bullets or detailed analysis?
> 3. Bluntness — Direct and confrontational, or diplomatic and gentle?
> 4. Risk posture — Conservative or aggressive?
> 5. Decision style — Data-driven or instinct-driven?
> 6. Accountability cadence — Daily check-ins or weekly summaries?
> 7. Time constraints — How much time do you have for this?
> 8. Challenge tolerance — Do you want BIQc to push back on your decisions?
> 9. Boundaries — What topics are off-limits?
>
> After this, every insight BIQc delivers is calibrated to YOUR psychology. A blunt founder gets short bullets. A cautious operator gets gentle framing with options."

### 4.2 Business DNA Auto-Extraction

**SAY:**

> "Next, BIQc asks for your website URL.
>
> Within 60 seconds, it scrapes your website and extracts your entire Business DNA — industry, products, competitors, team structure, pricing, market positioning — without you filling a single form field.
>
> This populates 17 strategic dimensions automatically. The owner just confirms and edits anything that's off."

### 4.3 WOW Moment / Executive Reveal

**SAY:**

> "After calibration, the user sees the Executive Reveal — a dramatic presentation of everything BIQc has learned about their business, organised into Profile, Market, Product, Team, and Strategy.
>
> This is the moment they think: 'This thing actually knows my business.'
>
> Every field is editable. The owner refines what BIQc got wrong. Then they're in."

---

## SECTION 5: THE PLATFORM — FIRST LOGIN (10 minutes)

### 5.1 Loading Animation

**LOGIN AS:** andre@thestrategysquad.com.au

**SAY:**

> "Watch what happens on first login."

**POINT OUT:**
- Lottie animation: "Assembling Your War Room" / "Brewing Your Intelligence" / "Waking Up Your AI Agents"
- Animated progress steps: "Reading your business DNA → Detecting market signals → Calibrating AI agents"
- Randomised content — users never see the same loading screen twice
- Progress bar with multi-colour gradient

> "This isn't a spinner. BIQc is actually doing work — pulling data from all connected systems, running AI analysis, generating your intelligence briefing. The animation communicates that something meaningful is happening."

### 5.2 Tutorial System

**SAY:**

> "On first visit to any page, a tutorial modal appears explaining what the page does and how to use it. Written for non-technical users.
>
> There are tutorials on 20+ pages. Each shows automatically on first visit and can be re-triggered with the help button in the header.
>
> The user never feels lost. Every page explains itself."

**CLOSE the tutorial to reveal the dashboard.**

### 5.3 BIQc Insights Dashboard (/advisor)

**SAY:**

> "This is the command centre. One screen. Everything that matters today.
>
> At the top: System State. STABLE, DRIFT, COMPRESSION, or CRITICAL. With confidence percentage and velocity — is it getting better or worse?
>
> The greeting is personalised: 'Good afternoon, Andre.'
>
> Below that: Five Cognition Groups — Money, Revenue, Operations, People, Market. Each tab shows alerts sorted by severity. The tab with the most critical alerts is shown first.
>
> Each alert has a title, explanation, and one-click action buttons: Auto-Email, Quick-SMS, Hand Off."

**CLICK through each Cognition Tab:**

> "Money: Cash flow risks, overdue invoices, margin compression.
> Revenue: Pipeline stalls, churn signals, deal concentration risk.
> Operations: SLA breaches, bottlenecks, SOP compliance.
> People: Founder capacity, team burnout, decision fatigue.
> Market: Competitor movements, pricing position, regulatory changes."

**SCROLL TO:** Weekly Brief

> "The Weekly Brief summarises: cash recovered, hours saved, actions taken, SOP compliance. All generated automatically."

**SCROLL TO:** Executive Memo

> "The Executive Memo is a plain-English strategic briefing. Board-ready language. Updated every time the dashboard refreshes."

### 5.4 Recalibration System

**SAY:**

> "BIQc doesn't let you 'set and forget.' Every 14 days, it prompts the owner to recalibrate — because businesses change. New hire? Lost client? Price increase? BIQc needs to know.
>
> There's also a weekly video check-in option — a scheduled call with BIQc to review progress and priorities.
>
> After 23 hours of no activity, the returning-user loading screen activates: 'Andre, we caught some things overnight.' Different message every time."

---

## SECTION 6: PLATFORM FEATURES DEEP DIVE (15 minutes)

### 6.1 Intelligence Group

**NAVIGATE TO:** Each page via sidebar

| Feature | What to Show | Key Talking Point |
|---|---|---|
| **BIQc Insights** | The main dashboard | "One screen replaces 5 apps" |
| **Strategic Console** | Ask any business question | "Like having a CTO on call. Ask 'Should I hire a salesperson?' and get an answer grounded in YOUR data." |
| **Board Room** | Deep-dive diagnosis | "Pick a focus area — cash flow, team capacity, competitive position. Get a board-level diagnosis with evidence." |
| **SoundBoard** | Test ideas via chat | "Bounce a business idea off BIQc. 'I'm thinking of raising prices 15%.' It responds with data-backed analysis." |

### 6.2 Analysis Group

| Feature | What to Show | Key Talking Point |
|---|---|---|
| **Diagnosis** | Business health check | "Comprehensive health check across Strategy, Finance, Operations, Team, Market, Compliance." |
| **Analysis** | Performance analysis | "Deep analysis on any performance dimension." |
| **Market Analysis** | On-demand SWOT | "Enter your product, region, and question. Get a researched SWOT with live market data." |
| **Intel Centre** | Intelligence actions | "Every insight BIQc generates becomes an actionable item you can Read, Action, or Ignore." |

### 6.3 Tools Group

| Feature | What to Show | Key Talking Point |
|---|---|---|
| **SOP Generator** | Generate SOPs | "Say 'Create a client onboarding SOP for an accounting firm.' Professional procedure document in seconds." |
| **Data Center** | Data health | "See what data is flowing, signal coverage, recent ingestion activity." |
| **Documents** | Document library | "All generated reports, SOPs, and uploads stored and searchable." |

### 6.4 Configuration Group

| Feature | What to Show | Key Talking Point |
|---|---|---|
| **Intelligence Baseline** | Monitoring config | "Configure which domains BIQc monitors, signal priorities, monitoring intensity." |
| **Integrations** | Connect platforms | "Connect Xero, HubSpot, Gmail, Outlook, Google Drive. Each shows sync status, data types, permissions." |
| **Email** | Email connection | "Connect Gmail or Outlook. BIQc analyses email metadata patterns — response times, engagement decline." |
| **Email Inbox** | Prioritised inbox | "AI categorises your emails: High, Medium, Low priority. Surfaces strategic insights from email patterns." |
| **Calendar** | Calendar view | "Connected calendar events with meeting load analysis." |

### 6.5 Settings Group

| Feature | What to Show | Key Talking Point |
|---|---|---|
| **Account** | Account settings | "Name, email, password, subscription management." |
| **Business DNA** | 17 strategic dimensions | "Auto-populated from calibration. Editable. This is how BIQc understands your business." |

---

## SECTION 7: SUPER ADMIN (For internal/partner demos only — 5 minutes)

**NAVIGATE TO:** /admin (accessible from user dropdown → Admin)

**SAY:**

> "For platform operators — the Super Admin is not a settings page. It's a control tower."

### Show each of the 8 tabs:

| Tab | What to Show | Key Point |
|---|---|---|
| **Command Centre** | Platform health map, strategic inevitabilities | "Real-time visibility into every system — backend, database, Edge Functions, workers, cron jobs." |
| **User Admin** | User list, search, detail panel | "Full user management: search, view detail, impersonate (view as user), suspend, unsuspend." |
| **Governance** | Role hierarchy, data sovereignty | "5-tier role system: Super Admin → Admin (Partner) → Owner → Team Member → Suspended. Full audit trail." |
| **Security** | Hardening status, procurement readiness | "10 security controls tracked. 10 procurement readiness items with status. Links to Trust documentation." |
| **AI Governance** | Agent registry, token tracking | "12 AI agents listed with providers and deployment counts. Per-function cost tracking. Prompt audit logs." |
| **Commercial** | Revenue intelligence, sales pipeline | "MRR, ARR, churn tracking. Sales pipeline with lead stages. Subscription tier management." |
| **Operations** | Kill switches, automation rules | "Emergency controls: platform read-only, feature disable, API freeze, AI halt. Tenant suspension with data preservation." |
| **Growth** | Growth infrastructure, trust signals | "White-label provisioning (planned), activation tracking, configuration intelligence." |

---

## SECTION 8: INDUSTRY-SPECIFIC VIEWS (5 minutes)

**NAVIGATE TO:** /site/platform/industry/msp (or relevant industry)

**SAY:**

> "BIQc adapts to your industry. The dashboard you see, the alerts you receive, the compliance items tracked, the SOP templates available — all change based on your industry.
>
> Let me show you what an MSP owner sees versus a construction contractor."

**Show each industry briefly:**

| Industry | Key Feature to Highlight |
|---|---|
| **IT Services / MSP** | Renewal Exposure Radar — "$276K at risk in next 90 days" |
| **Construction / HVAC** | Project Margin Tracker — "Job #142 margin collapsed from 15% to 8%" |
| **Consulting** | Utilisation Snapshot — "68% utilisation, $18K revenue leakage this month" |
| **Marketing Agency** | Retainer Stability Monitor — "2 retainers at risk, engagement declining" |
| **B2B SaaS** | Churn Cohort Risk — "4.2% monthly churn, $8.2K MRR at risk" |

---

## SECTION 9: PRICING & CLOSE (3 minutes)

**NAVIGATE TO:** /site/pricing

**SAY:**

> "The comparison is simple. Hiring a COO, analyst, and compliance officer costs $470,000+ per year — plus super, benefits, recruitment, and ramp time.
>
> BIQc provides the intelligence of an entire leadership team at a fraction of that.
>
> No lock-in. 14-day free trial. Australian support. Onboarding included.
>
> Would you like to start a trial today?"

---

## SECTION 10: Q&A PREPARATION

### Common Questions and Answers

**Q: How long does setup take?**
> "10 minutes for calibration. Under 2 minutes per integration. Most clients are seeing intelligence within their first session."

**Q: Can my team access it?**
> "Yes. Owners can add team members with role-based access. Operations staff see Operations. Sales staff see Revenue. Everyone sees what's relevant."

**Q: What if I don't have all the integrations?**
> "BIQc works with whatever you connect. More integrations = richer intelligence. But even with just accounting + email connected, you'll see meaningful insights on day one."

**Q: Is my data safe?**
> "All data is hosted in Australia. AES-256 encryption. Your data never trains AI models. Our DPA and security documentation are publicly accessible. We welcome procurement review."

**Q: What happens if I cancel?**
> "No lock-in. Cancel anytime. Your data can be exported. After termination, all data is permanently deleted within 30 days."

**Q: How is this different from Power BI / Domo / Qlik?**
> "Those tools require someone to BUILD dashboards. BIQc generates intelligence autonomously. You don't need a data analyst. You don't need to know what questions to ask. BIQc tells you what matters — calibrated to how you think."

---

## DEMO FLOW TIMING GUIDE

| Section | Duration | Priority |
|---|---|---|
| Website Walkthrough | 5 min | Must |
| Security & Data Sovereignty | 5 min | Must |
| Sign-Up & Registration | 3 min | Must |
| Calibration Experience | 7 min | Must |
| Platform First Login | 10 min | Must |
| Features Deep Dive | 15 min | Can shorten |
| Super Admin | 5 min | Internal only |
| Industry Views | 5 min | If relevant |
| Pricing & Close | 3 min | Must |
| Q&A | 5-10 min | Must |

**20-minute executive version:** Sections 1 (3 min) → 2 (2 min) → 5 (8 min) → 8 (2 min) → 9 (3 min) → Q&A (2 min)

---

## POST-DEMO ACTIONS

- [ ] Send follow-up email with trial link
- [ ] Include link to Trust Centre (/site/trust/centre)
- [ ] Include link to relevant industry view
- [ ] Schedule calibration session if trial started
- [ ] Log prospect in sales pipeline (Admin → Commercial → Sales Pipeline)
