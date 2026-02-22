# BIQc — Complete Feature Report & Industry Cognition Map

## Document Purpose
Two sections:
1. **PART 1:** Complete inventory of every feature built, half-built, or discussed — so nothing is lost
2. **PART 2:** Industry-specific Cognition-as-a-Platform mapping — what each industry critically needs BIQc to monitor

---

# PART 1: COMPLETE FEATURE INVENTORY
## Every Feature Built, Half-Built, or Discussed — Nothing Dropped

---

### CATEGORY A: ONBOARDING & CALIBRATION

| # | Feature | What It Does | Status | Where It Lives |
|---|---|---|---|---|
| A1 | **9-Step Psychology Profiling** | Conversational AI profiles the owner's communication style, verbosity, bluntness, risk posture, decision style, accountability cadence, time constraints, challenge tolerance, boundaries. Every future insight is calibrated to HOW this person wants to hear it. | BUILT | Edge: `calibration-psych`, Frontend: `CalibratingSession.js`, `useCalibrationState.js` |
| A2 | **Business DNA Auto-Extraction** | Owner provides website URL → Firecrawl scrapes it → GPT extracts: industry, products, competitors, team, pricing, positioning. All 17 strategic dimensions populated without a single form. | BUILT (Edge Function **not deployed**) | Edge: `calibration-business-dna`, writes to `business_profiles` |
| A3 | **Calibration Sync (Auto-Populate Settings)** | After calibration chat, reads the full conversation and extracts 16+ structured fields → writes to `business_profiles` + `strategy_profiles`. Settings page is pre-filled. | BUILT (Edge Function **not deployed**) | Edge: `calibration-sync` |
| A4 | **Strategic Map Extraction (17-Point)** | Hardened AI that extracts: Identity, Stage, Location, Website, Target Market, Business Model, Geographic Focus, Products/Services, Pricing, Team Size, Founder Context, Team Gaps, Mission, Vision, Obstacles, Goals. | BUILT | Edge: `watchtower-brain` |
| A5 | **Auto-Save Progress** | Calibration progress auto-saves to Supabase after each wizard step, chat response, audit submit, and WOW confirmation. Users can resume from where they left off. | BUILT | Backend: `calibration.py` → `/api/console/state` → `calibration_sessions` table |
| A6 | **WOW Summary / Executive Reveal** | After calibration, shows a dramatic reveal of everything BIQc learned: Profile, Market, Product, Team, Strategy — each field editable. "Assembling your Intelligence Dashboard..." animation. | BUILT | `WowSummary.js`, `ExecutiveReveal.js` |
| A7 | **Onboarding Wizard** | Step-by-step onboarding with progress tracking, integration prompts. | BUILT | `OnboardingWizard.js` (820 lines), `onboarding.py` (630 lines) |
| A8 | **Onboarding Decision Gate** | Choice screen: Start calibration now or skip/defer. Auto-routes if already calibrated. | BUILT | `OnboardingDecision.js`, `OnboardingGate.js` |
| A9 | **Recalibration System (14-day cycle)** | BIQc nudges owner every 14 days to recalibrate when business has changed (new hire, lost client, price change). Shows alert card with "Recalibrate Now" or "Schedule" options. | BUILT | Edge: `checkin-manager`, `CheckInAlerts.js`, DB: `calibration_schedules` |
| A10 | **Weekly Video Check-In** | Schedules weekly video check-in with BIQc advisor. Shows alert if 7+ days since last check-in. Date/time picker modal. | BUILT | Edge: `checkin-manager`, `CheckInAlerts.js` |
| A11 | **Onboarding 10/10 Plan** | Comprehensive 10-phase upgrade plan: Pre-account Snapshot, Privacy Handshake, Calibration Enhancements, WOW Upgrade, Integration Gate, Dashboard Handoff, Telemetry, Shareable Export. 280-480 engineering hours estimated. | PLANNED (document exists) | `/app/memory/ONBOARDING_10_10_IMPLEMENTATION_PLAN.md` |

---

### CATEGORY B: LOADING & ANIMATION

| # | Feature | What It Does | Status | Where It Lives |
|---|---|---|---|---|
| B1 | **Lottie Animated Loading Screen** | Dynamic, non-repetitive loading animation during dashboard data load. 8 first-visit packs + 5 returning-user packs. Each has unique Lottie animation, headline, sub-copy, step sequence. Randomised so users rarely see the same screen twice. | BUILT | `CognitiveLoadingScreen.js` (173 lines) |
| B2 | **First Visit vs Returning Mode** | First visit: "Launching Your Command Centre" / "Waking Up Your AI Agents" / "Brewing Your Intelligence". Returning: "Andre, we caught some things overnight" / "your agents never sleep". | BUILT | `CognitiveLoadingScreen.js` — `FIRST_PACKS` / `RETURN_PACKS` |
| B3 | **Progress Steps Animation** | Steps reveal progressively as progress increases: "Scanning your digital footprint" → "Mapping competitive landscape" → "Calibrating AI agents" etc. Each with coloured pulsing dots. | BUILT | `CognitiveLoadingScreen.js` |
| B4 | **Multi-colour Gradient Progress Bar** | Rainbow gradient progress bar (orange → blue → green → purple) at bottom of loading screen. | BUILT | `CognitiveLoadingScreen.js` |
| B5 | **Loading Preview Page** | Dev tool to preview loading animations with "First Visit" / "Returning" / "Randomise" buttons. | BUILT | `LoadingPreview.js` → `/loading-preview` |

---

### CATEGORY C: TUTORIAL SYSTEM

| # | Feature | What It Does | Status | Where It Lives |
|---|---|---|---|---|
| C1 | **Reusable Tutorial Overlay** | Modal tutorial on first visit to each page. Back/Next arrows, dot indicators, X close. | BUILT | `TutorialOverlay.js` |
| C2 | **21+ Page Tutorials** | Tutorial content written for: BIQc Insights, Strategic Console, Board Room, Operator View, SoundBoard, Diagnosis, Analysis, Market Analysis, Intel Centre, SOP Generator, Data Center, Documents, Integrations, Email Connection, Email Inbox, Calendar, Intelligence Baseline, Business DNA, Settings + 3 calibration stages. | BUILT | Hardcoded in `TutorialOverlay.js` |
| C3 | **First-Visit Auto-Show** | Automatically shows on first visit to each page (tracked via localStorage). | BUILT | `TutorialOverlay.js` |
| C4 | **"?" Help Button** | Help button in header to re-trigger tutorial on any page. | BUILT | `DashboardLayout.js` header |
| C5 | **Non-AI-Savvy Language** | All tutorial content written for non-technical users explaining purpose and how to use each function in plain language. | BUILT | `TutorialOverlay.js` |

---

### CATEGORY D: CORE INTELLIGENCE ENGINE

| # | Feature | What It Does | Status | Where It Lives |
|---|---|---|---|---|
| D1 | **Cognitive Snapshot (The Brain)** | Pulls ALL connected data (CRM deals, invoices, emails, calendar) via Merge.dev. Runs OpenAI to generate: system state, resolution queue, executive memo, runway calc, inevitabilities, priority compression. | BUILT | Edge: `biqc-insights-cognitive` (541 lines) |
| D2 | **5 Cognition Groups** | Dashboard organised into Money, Revenue, Operations, People, Market tabs. Alerts sorted by severity per group. | BUILT | `AdvisorWatchtower.js` → `parseToGroups()` |
| D3 | **Resolution Queue** | AI generates actionable items per group with severity (high/medium/low), title, detail, and recommended actions. | BUILT | Edge output → `resolution_queue` |
| D4 | **Executive Memo** | Full strategic narrative written by AI about the business's current state, risks, and recommended priorities. | BUILT | Edge output → `executive_memo` |
| D5 | **Strategic Alignment Check** | Detects contradictions between stated goals and actual behaviour (e.g., "Revenue target 20% vs 0 outbound in 14 days"). | BUILT | Edge output → `strategic_alignment_check` |
| D6 | **Cash Runway Calculator** | Calculates months of cash remaining based on current burn rate and revenue. | BUILT | Edge output → `cash_runway_months` |
| D7 | **System State Detection** | Classifies business as STABLE / DRIFT / COMPRESSION / CRITICAL with velocity (worsening/improving/stable) and confidence %. | BUILT | Edge output → `system_state` |
| D8 | **Cache-First Architecture** | Uses localStorage + server-side DB cache. Stale-while-revalidate strategy. Returns cached data instantly, refreshes in background. | BUILT | `useSnapshot.js` hook |
| D9 | **Pre-Computation (pg_cron)** | Snapshots pre-computed every 4 hours for all active users. Edge Functions kept warm every 4 minutes. | BUILT | pg_cron jobs in Supabase |
| D10 | **Weekly Brief** | Summarised weekly metrics: cash position, hours worked, actions taken, tasks completed, SOP compliance, fixes applied, leads generated. | BUILT | Edge output → `weekly_brief` |

---

### CATEGORY E: STRATEGIC TOOLS

| # | Feature | What It Does | Status | Where It Lives |
|---|---|---|---|---|
| E1 | **SOP Generator** | Generate Standard Operating Procedures, checklists, and action plans. Uses full business context (industry, team, products). Types: SOP, Checklist, Action Plan. | BUILT | Edge: `sop-generator` (190 lines), Frontend: `SOPGenerator.js` (377 lines), Backend: `generation.py` |
| E2 | **SoundBoard (Strategic Sounding Board)** | Chat-based idea testing. Owner types a business idea/challenge/scenario → gets strategic feedback grounded in their business data. Conversation history saved. | BUILT | Frontend: `MySoundBoard.js` (465 lines), Backend: `soundboard.py` (257 lines), DB: `soundboard_conversations` |
| E3 | **Strategic Console (War Room)** | Two modes: BRIEF (full executive briefing from all data) and ASK (user types question, searches all connected data + answers). Like having a CTO on call. | BUILT | Edge: `strategic-console-ai` (330 lines), Frontend: `WarRoomConsole.js`, Backend: `strategic_console.py` |
| E4 | **Board Room Diagnosis** | Deep-dive analysis on specific focus area. Generates: headline, narrative, what to watch, consequences if ignored, data sources used. Board-level quality. | BUILT | Edge: `boardroom-diagnosis` (347 lines), Frontend: `BoardRoom.js`, Backend: `boardroom.py` |
| E5 | **Business Diagnosis** | Comprehensive health check across business categories (Strategy, Finance, Operations, Team, Market, Compliance). Generates severity ratings and recommendations. | BUILT | Frontend: `Diagnosis.js` (513 lines) |
| E6 | **Market Analysis (On-Demand SWOT)** | User inputs product/service, region, question → AI performs live market research → returns SWOT analysis + strategic recommendations. | BUILT | Edge: `market-analysis-ai` (264 lines), Frontend: `MarketAnalysis.js` (218 lines) |
| E7 | **Competitor Monitoring (Weekly Auto-Scan)** | Weekly scheduled scanning of competitors identified during calibration. Diffs against previous scan. Generates alerts when changes detected (new pricing, new hires, new products). | BUILT | Edge: `competitor-monitor` (270 lines), pg_cron weekly |
| E8 | **Deep Web Reconnaissance** | Scrapes competitor websites, LinkedIn, Twitter, Instagram, Facebook. SWOT analysis. Severity-rated signals. Attention protection (suppresses noise if delta < 2%). | BUILT | Edge: `deep-web-recon` (473 lines) |
| E9 | **CFO Cash Analysis** | Weekly financial analysis. Detects cash flow anomalies, overdue invoices, expense spikes, revenue trend changes. Auto-generates intelligence actions. | BUILT | Edge: `cfo-cash-analysis` (316 lines), pg_cron weekly |
| E10 | **Mission/Vision/Goals Auto-Generation** | AI refines raw user input into polished mission statement, vision statement, goals, and growth strategy. Stored in `strategy_profiles`. | BUILT | Backend: `profile.py` → strategy profile endpoints, DB: `strategy_profiles` |
| E11 | **Target Customer Identification** | Extracted during calibration and stored in `business_profiles.target_market`. Used by cognitive engine for revenue analysis. | BUILT | Edge: `calibration-sync` → `business_profiles.target_market` |
| E12 | **Voice Chat** | Video/voice call UI with AI advisor. Mic toggle, speaker toggle, video toggle, call duration timer. | HALF-BUILT (UI exists, voice AI provider not connected) | `VoiceChat.js` |

---

### CATEGORY F: NOTIFICATION & ALERT SYSTEM

| # | Feature | What It Does | Status | Where It Lives |
|---|---|---|---|---|
| F1 | **Smart Notification Bell** | Bell icon in header with badge count. Scans emails for complaints, calendar for upcoming meetings, email intelligence for declining client engagement. | BUILT | `DashboardLayout.js` → Backend: `profile.py` → `/notifications/alerts` |
| F2 | **Notification Dropdown** | Full dropdown UI with severity badges (high/medium/low) and navigation to relevant page. | BUILT | `DashboardLayout.js` |
| F3 | **Notification Polling** | Refreshes every 5 minutes automatically. Feature-flagged (`ENABLE_NOTIFICATIONS_POLLING = true`). | BUILT | `DashboardLayout.js` |
| F4 | **Dismissed Notification Tracking** | Tracks which notifications user has dismissed so they don't reappear. | BUILT | DB: `dismissed_notifications` |
| F5 | **Intelligence Bridge** | Automatically converts Watchtower findings + Snapshot risks/contradictions into intelligence_actions (actionable items). Ensures nothing falls through cracks. | BUILT | `intelligence_bridge.py`, Edge: `intelligence-bridge` (183 lines) |
| F6 | **Resolution Actions (Read/Action/Ignore)** | Each intelligence action can be marked as read, actioned, or ignored with feedback. | BUILT | Backend: `intelligence_actions.py` |

---

### CATEGORY G: INTEGRATIONS & EMAIL

| # | Feature | What It Does | Status | Where It Lives |
|---|---|---|---|---|
| G1 | **Merge.dev CRM Integration** | Connect HubSpot, Salesforce, Pipedrive. Pulls deals, contacts, companies, pipeline data. | BUILT | Backend: `integrations.py`, DB: `integration_accounts` |
| G2 | **Merge.dev Accounting Integration** | Connect Xero, MYOB, QuickBooks. Pulls invoices, transactions, aged receivables. | BUILT | Backend: `integrations.py` |
| G3 | **Gmail Connection** | OAuth flow → metadata analysis → email patterns, response times. | BUILT | Edge: `gmail_prod`, Backend: `email.py`, DB: `gmail_connections` |
| G4 | **Outlook/M365 Connection** | OAuth flow → email + calendar metadata analysis. | BUILT | Edge: `outlook-auth`, Backend: `email.py`, DB: `m365_tokens` |
| G5 | **Google Drive Connection** | Connect Google Drive → sync file metadata. | BUILT | Backend: `integrations.py`, DB: `google_drive_files` |
| G6 | **Email Priority Analysis** | AI categorises emails into high/medium/low priority. Strategic insights from email patterns. Detects response delays, escalation triggers. | BUILT | Edge: `email_priority` (321 lines) |
| G7 | **Email Inbox View** | Prioritised email inbox with AI-enhanced context. Highlights important items, flags attention-needed. | BUILT | `EmailInbox.js` (756 lines) |
| G8 | **Calendar View** | Connected calendar events display with meeting load analysis. | BUILT | `CalendarView.js` (301 lines) |
| G9 | **Email Sync Worker** | Background worker continuously syncing all email accounts (Gmail + Outlook). Runs every 60 seconds. | BUILT | `email_sync_worker.py` (runs via supervisor) |
| G10 | **Integration Status Health** | Checks health of all connected integrations. Returns sync status, last sync time. | BUILT | Edge: `integration-status` (189 lines) |
| G11 | **Integration Disconnect** | Backend logic to disconnect integrations. | BUILT (but **frontend disconnect buttons missing for CRM/Accounting** — only email has them) | Backend: `integrations.py` → `/integrations/disconnect` |

---

### CATEGORY H: BUSINESS DNA & SETTINGS

| # | Feature | What It Does | Status | Where It Lives |
|---|---|---|---|---|
| H1 | **Business DNA (17 Strategic Dimensions)** | Full business profile: name, stage, industry, location, target market, products, value proposition, team size, years operating, goals (short + long term), challenges, growth strategy, risk profile, competitive advantages, business model. | BUILT | `BusinessProfile.js` (495 lines), DB: `business_profiles` |
| H2 | **Auto-Population from Calibration** | After calibration, Business DNA is auto-filled from the conversation. Owner never re-types what they told BIQc. | BUILT (pending Edge Function deployment) | Edge: `calibration-sync` |
| H3 | **Auto-Population from Website** | Owner provides URL → Business DNA auto-extracted from website content. | BUILT (pending Edge Function deployment) | Edge: `calibration-business-dna` |
| H4 | **Strategy Profiles (AI-Refined)** | Raw user input refined by AI into polished mission, vision, goals, challenges, growth strategy. | BUILT | DB: `strategy_profiles`, Backend: `profile.py` |
| H5 | **Operator Profile** | Persona calibration status, agent persona configuration, custom AI instructions. | BUILT | DB: `user_operator_profile` |
| H6 | **Account Settings** | Name, email, company, industry, role. | BUILT | `Settings.js` (657 lines) |
| H7 | **Intelligence Baseline Config** | Configure what domains BIQc monitors, signal priorities, monitoring intensity. | BUILT | `IntelligenceBaseline.js` (304 lines), DB: `intelligence_baseline`, `intelligence_priorities` |
| H8 | **Working Schedule** | Configure business hours, working days for time-aware alerts. | BUILT | DB: `working_schedules` |

---

### CATEGORY I: ACTION BUTTONS (Resolution Centre)

| # | Feature | What It Does | Status | Where It Lives |
|---|---|---|---|---|
| I1 | **Auto-Email Button** | UI button on every alert card. Intended to draft + send email to relevant contact. | HALF-BUILT (UI exists, **no email provider connected**) | `AdvisorWatchtower.js` ActionBar component |
| I2 | **Quick-SMS Button** | UI button for urgent signals. Intended to send text to contact. | HALF-BUILT (UI exists, **no SMS provider connected**) | `AdvisorWatchtower.js` ActionBar component |
| I3 | **Hand Off Button** | UI button to delegate. Intended to create task in project management tool. | HALF-BUILT (UI exists, **no task API connected**) | `AdvisorWatchtower.js` ActionBar component |
| I4 | **Dismiss & Learn** | UI button to dismiss alert with feedback so BIQc learns what's important. | HALF-BUILT | Frontend UI only |

---

### CATEGORY J: ADMIN & GOVERNANCE

| # | Feature | What It Does | Status | Where It Lives |
|---|---|---|---|---|
| J1 | **Super Admin Dashboard** | Platform stats: total users, active, calibrated. User list with search. | BUILT | `AdminDashboard.js` (492 lines), Backend: `admin.py` |
| J2 | **User Management** | List, update, suspend, unsuspend, delete users. | BUILT | Backend: `admin.py` |
| J3 | **User Impersonation** | "View as user" — see platform exactly as a specific user sees it. | BUILT | Backend: `admin.py` → `/admin/users/{id}/impersonate` |
| J4 | **Prompt Lab** | View and edit all 15+ AI system prompts. Invalidate prompt cache. Audit log. | BUILT | `PromptLab.js` (490 lines), Backend: `admin.py` → `/admin/prompts` |
| J5 | **API Cost Tracking** | Per-function, per-user API cost logging (tokens, provider, model, cost estimate). | BUILT (DB table exists, **no frontend dashboard**) | DB: `usage_tracking` |
| J6 | **Prompt Audit Log** | Tracks all prompt changes with timestamps. | BUILT | DB: `prompt_audit_logs` |

---

### CATEGORY K: BACKGROUND WORKERS & SCHEDULED JOBS

| # | Feature | What It Does | Status |
|---|---|---|---|
| K1 | **Email Sync Worker** | Continuously syncs all connected email accounts (Gmail + Outlook). 60-second interval. | RUNNING (supervisor) |
| K2 | **Intelligence Automation Worker** | Automatic intelligence generation. Daily scans, silence detection, regeneration governance. | RUNNING (supervisor) |
| K3 | **Cognitive Pre-Computation** | Pre-computes snapshots for all active users every 4 hours. | RUNNING (pg_cron) |
| K4 | **CFO Cash Analysis Batch** | Weekly financial analysis for all users with accounting connected. | RUNNING (pg_cron) |
| K5 | **Competitor Monitor Batch** | Weekly competitor scanning for all users. | RUNNING (pg_cron) |
| K6 | **Edge Function Warmup** | Pings all Edge Functions every 4 minutes to prevent cold starts. | RUNNING (pg_cron) |

---

### CATEGORY L: UI/UX FEATURES

| # | Feature | What It Does | Status |
|---|---|---|---|
| L1 | **Collapsible Sidebar** | Left sidebar with expand/collapse toggle. Grouped navigation sections. | BUILT |
| L2 | **Dark Mode Toggle** | Sun/moon icon toggle in header. | BUILT |
| L3 | **Mobile Hamburger Menu** | Mobile-responsive navigation drawer. | BUILT |
| L4 | **Install Prompt (PWA)** | "Install BIQc App" prompt for mobile home screen. | BUILT |
| L5 | **Scroll Fix** | Nuclear scroll unlock ensuring scrolling works on every page. | BUILT |
| L6 | **Mobile Responsiveness** | Landing page fully responsive. Stats grid, cards, typography scaled for mobile. | BUILT |

---

### CATEGORY M: HALF-BUILT / DISCUSSED BUT NOT COMPLETE — DETAILED BREAKDOWN

---

#### M1. AUTO-EMAIL EXECUTION
**What exists today:**
- UI: Orange "Auto-Email" button with Mail icon appears on every resolution card in `AdvisorWatchtower.js` (line 22). Also in Liquid Steel mockup pages (`ExecOverview.js`, `AlertsPage.js`).
- Backend: `email.py` (1,855 lines) has full Gmail/Outlook connection, sync, and inbox reading. It can READ emails but cannot SEND emails on the user's behalf.
- No email composition/send endpoint exists.
- No email provider (Resend, SendGrid) is integrated.

**What the button should do:**
1. User clicks "Auto-Email" on an alert card (e.g., "Invoice #1847 overdue 12 days")
2. BIQc generates a draft email using AI (using business context + alert data + owner's communication style from calibration)
3. User previews the draft, can edit
4. Clicks "Send" → email goes out via connected Gmail/Outlook OR via Resend/SendGrid
5. Action logged to `advisory_log` table

**What's missing:**
- Email composition API endpoint (draft generation)
- Email send endpoint (either via existing Gmail/Outlook OAuth tokens OR via Resend/SendGrid)
- Draft preview UI (modal with editable email body, subject, recipient)
- Send confirmation + audit logging
- **Integration needed:** Resend OR SendGrid (for users without Gmail/Outlook connected) OR use existing OAuth tokens to send via Gmail API / Microsoft Graph API

**Effort estimate:** 16-24 hours
**Priority:** P1 — This is the #1 feature that makes BIQc "agentic" not just "advisory"

---

#### M2. QUICK-SMS EXECUTION
**What exists today:**
- UI: Green "Quick-SMS" button with MessageSquare icon on resolution cards in `AdvisorWatchtower.js` (line 23). Also in Liquid Steel mockup pages.
- No SMS backend exists anywhere in the codebase.
- No Twilio or any SMS provider is integrated.
- No phone number storage exists for contacts.

**What the button should do:**
1. User clicks "Quick-SMS" on an urgent alert
2. BIQc generates a short text message using AI (calibrated to owner's style)
3. User previews, selects recipient phone number (from CRM contacts if available)
4. Clicks "Send" → SMS goes out via Twilio
5. Action logged

**What's missing:**
- Twilio integration (account, API key, phone number)
- SMS composition endpoint
- Phone number lookup from CRM contacts (Merge.dev)
- SMS send endpoint
- Preview UI (modal with editable message, recipient phone)
- Audit logging
- **Integration needed:** Twilio (for Australian SMS — need AU phone number)

**Effort estimate:** 16-24 hours
**Priority:** P1

---

#### M3. HAND OFF EXECUTION
**What exists today:**
- UI: Orange "Hand Off" button with Users icon on resolution cards in `AdvisorWatchtower.js` (line 24). Also in mockup pages.
- Merge.dev is already integrated for CRM (HubSpot, Salesforce) and Accounting (Xero, MYOB).
- Merge.dev also supports a **Ticketing** category (Asana, Monday, Jira, Trello) but this is NOT connected.
- No task creation logic exists.

**What the button should do:**
1. User clicks "Hand Off" on an alert
2. BIQc generates a task description from the alert (title, context, suggested assignee)
3. User selects which team member to assign to (from CRM contacts or Settings team list)
4. Clicks "Create Task" → task created in connected project management tool (via Merge.dev Ticketing) OR stored internally
5. Action logged

**What's missing:**
- Merge.dev Ticketing category connection (Asana, Monday, Jira) — connection flow in `integrations.py`
- Task creation API endpoint
- Assignee selection UI (dropdown of team members)
- Internal task storage (if no PM tool connected) — new `tasks` table
- Task status tracking
- **Integration needed:** Merge.dev Ticketing category activation (API already exists, just need to add the category to the connection flow)

**Effort estimate:** 20-30 hours
**Priority:** P2

---

#### M4. VOICE CHAT (AI VOICE ADVISOR)
**What exists today:**
- UI: Full 595-line `VoiceChat.js` component with:
  - Mic toggle, speaker toggle, video toggle
  - Call duration timer
  - AI speaking/user speaking indicators
  - Audio visualisation (waveform)
  - WebRTC peer connection setup
  - Connect/disconnect flow
- Backend: `server.py` imports `OpenAIChatRealtime` and registers voice routes at `/api/voice`
  - Session creation endpoint: `/api/voice/realtime/session`
  - WebRTC negotiation endpoint: `/api/voice/realtime/negotiate`
- The WebRTC connection targets **OpenAI's Realtime API** (GPT-4o voice mode)

**What works:**
- The UI renders. Buttons respond. Audio context initialises.
- WebRTC peer connection attempts to establish.

**What's missing:**
- OpenAI Realtime API requires specific model access (`gpt-4o-realtime-preview`) — may not be available on all API keys
- Voice chat needs the AI to have the user's business context (currently no context injection into voice session)
- Error handling when WebRTC fails to connect
- Mobile audio handling (iOS Safari has specific AudioContext requirements)
- Call recording / transcript saving to `chat_history` table
- **No integration needed** — uses existing OpenAI API key, but needs the Realtime API model enabled

**Effort estimate:** 8-16 hours (mostly debugging + context injection)
**Priority:** P3

---

#### M5. SUBSCRIPTION BILLING (Stripe)
**What exists today:**
- Frontend: `Settings.js` has a "Billing & Subscription" tab (line 609) showing:
  - "Current Plan: Free Tier" (hardcoded)
  - "Upgrade Plan" button (does nothing)
  - "Payment Method: No payment method on file" (hardcoded)
- Frontend: `Pricing.js` (391 lines) shows 3 tiers with pricing cards
- Backend: `profile.py` has `subscription_tier` field (free/professional/enterprise) — read/write works
- DB: `users.subscription_tier` column exists
- No Stripe SDK installed. No Stripe API key configured. No checkout flow. No webhook handler.

**What should work:**
1. User clicks "Upgrade Plan" → Stripe Checkout session opens
2. User enters card → payment processed
3. Webhook fires → `users.subscription_tier` updated to "professional" or "enterprise"
4. Features unlock based on tier
5. Monthly/annual billing cycle
6. Cancel/downgrade flow
7. Invoice history visible in Settings

**What's missing:**
- Stripe SDK installation (`pip install stripe`)
- Stripe API keys (publishable + secret)
- Checkout session creation endpoint
- Webhook handler endpoint (`/api/stripe/webhook`)
- Subscription management endpoints (cancel, upgrade, downgrade)
- Invoice history endpoint
- Feature gating logic (what features are available per tier)
- Stripe Customer creation on signup
- **Integration needed:** Stripe (test key already available in pod environment)

**Effort estimate:** 24-40 hours
**Priority:** P1 (required for revenue)

---

#### M6. DATA EXPORT ("Download My Data")
**What exists today:**
- Backend: `data_center.py` line 87 has a `download_data_file` endpoint — but this downloads individual uploaded files, NOT a full data export.
- No "Export all my data" functionality exists.
- No GDPR/Privacy Act compliance export feature.

**What should work:**
1. User goes to Settings → "Download My Data" button
2. System compiles: business profile, strategy profiles, intelligence snapshots, SOPs, documents, chat history, advisory log, observation events
3. Generates a ZIP file with JSON + PDF exports
4. Download link sent to email or available immediately

**What's missing:**
- Export compilation endpoint (aggregate all user data across tables)
- ZIP file generation
- JSON serialisation of all user records
- PDF generation for reports/SOPs
- Download delivery mechanism (presigned URL or direct download)
- **No external integration needed** — all data is in Supabase

**Effort estimate:** 8-16 hours
**Priority:** P2 (legal requirement under Privacy Act 1988)

---

#### M7. FULL-TEXT SEARCH
**What exists today:**
- DB: GIN indexes exist on multiple tables:
  - `observation_events.payload` (JSONB GIN index)
  - `cognitive_profiles.immutable_reality` (JSONB GIN index)
  - `cognitive_profiles.behavioural_truth` (JSONB GIN index)
- These indexes enable fast full-text and JSONB queries
- No search UI exists anywhere in the frontend
- No search API endpoint exists

**What should work:**
1. Global search bar in the top navigation bar
2. User types a query → searches across: intelligence snapshots, SOPs, documents, business profiles, chat history, advisory log
3. Results grouped by type (Intelligence, Documents, SOPs, Conversations)
4. Click result → navigates to relevant page

**What's missing:**
- Search API endpoint (query across multiple tables with relevance ranking)
- Frontend search bar component in `DashboardLayout.js` header
- Search results dropdown/page
- Relevance ranking logic
- **No external integration needed** — Supabase supports full-text search natively

**Effort estimate:** 12-20 hours
**Priority:** P2

---

#### M8. NOTIFICATION PREFERENCES
**What exists today:**
- Frontend: `Settings.js` has "Preferences" tab (line 200) with:
  - Communication Style selector (Concise / Conversational / Detailed) — works
  - Advice style stored in `user_operator_profile`
- Backend: Notification scanning works (`/notifications/alerts` in `profile.py`) — scans emails for complaints, calendar for meetings, intelligence for signals
- Notification bell with count and dropdown — works
- Polling every 5 minutes — works
- BUT: No way for user to choose WHICH notification types they receive

**What should work:**
1. Settings → Notification Preferences section showing toggles:
   - Email intelligence alerts (on/off)
   - Calendar conflict alerts (on/off)
   - Financial risk alerts (on/off)
   - Competitor activity alerts (on/off)
   - Compliance deadline alerts (on/off)
   - Recalibration reminders (on/off)
2. Notification severity threshold (Critical only / Critical + Moderate / All)
3. Delivery method (In-app only / In-app + Email digest / In-app + SMS for critical)

**What's missing:**
- `notification_preferences` table or JSONB column in `users`
- Preferences UI in Settings page
- Backend filtering logic in `/notifications/alerts` to respect preferences
- Email digest system (daily/weekly summary email)
- **No external integration needed** for in-app; needs email provider for digests

**Effort estimate:** 8-12 hours
**Priority:** P2

---

#### M9. INTEGRATION DISCONNECT BUTTONS (CRM/Accounting)
**What exists today:**
- Backend: Full disconnect logic exists:
  - `/merge/disconnect` (line 252 in `integrations.py`) — handles CRM + Accounting disconnection via Merge.dev
  - `/integrations/google-drive/disconnect` (line 1164) — Google Drive
  - `/outlook/disconnect` — Outlook
  - `/gmail/disconnect` — Gmail
- Frontend: Disconnect buttons EXIST for:
  - Gmail ✅ (line 590 in `Integrations.js`)
  - Outlook ✅ (line 548)
  - Google Drive ✅
  - **Merge.dev (CRM/Accounting)** ✅ — Actually EXISTS! (line 915-921, uses `/merge/disconnect`)
- The disconnect button on CRM/Accounting cards IS implemented but only shows when `isConnected` is true and `connectionState.source === 'merge'`

**What's actually missing:**
- The disconnect button exists but may be **visually hidden or hard to find** due to card layout
- Need to verify the button is visible and functional for all Merge.dev integrations
- Need to add confirmation modal + success toast

**Effort estimate:** 2-4 hours (UI visibility fix + testing)
**Priority:** P3 (mostly done, just needs verification)

---

#### M10. CALIBRATION-BUSINESS-DNA DEPLOYMENT
**What exists today:**
- Edge Function: `calibration-business-dna/index.ts` — 275 lines, fully built
  - Takes website URL
  - Scrapes via Firecrawl API
  - Sends to GPT-4o for extraction
  - Writes ALL Business DNA fields to `business_profiles` table (Market, Product, Team, Strategy tabs)
  - Also uses Perplexity for supplementary market research
- Referenced in Admin Dashboard (line 378) as a known Edge Function
- NOT called from the calibration flow currently — calibration uses `watchtower-brain` instead for the Strategic Map

**What's missing:**
- **Deployment to Supabase** — user must run: `supabase functions deploy calibration-business-dna`
- Secrets must be set: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FIRECRAWL_API_KEY`
- Frontend integration in calibration flow — after user provides website URL, call this function to auto-fill Business DNA
- Chain: URL input → `calibration-business-dna` → `calibration-psych` → done

**Effort estimate:** 2 hours (deployment + wiring) — code is complete
**Priority:** P0 (massive UX improvement — user gets full profile without filling forms)

---

#### M11. CALIBRATION-SYNC DEPLOYMENT
**What exists today:**
- Edge Function: `calibration-sync/index.ts` — 182 lines, fully built
  - Reads full calibration conversation history
  - Uses GPT to extract 16+ structured fields
  - Writes to `business_profiles` + `strategy_profiles`
  - Fields: business_name, industry, business_stage, location, target_market, products, value_proposition, team_size, years_operating, goals, challenges, growth_strategy, competitive_advantages, mission_statement, business_model
- **Already called from frontend:**
  - `useCalibrationState.js` line 110 — calls after calibration completes
  - `Settings.js` line 41 — "Sync Profile" button calls it manually
- But the function is NOT deployed, so these calls fail silently

**What's missing:**
- **Deployment to Supabase** — user must run: `supabase functions deploy calibration-sync`
- Secrets: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- That's it. Frontend integration already exists. Deploy = instant value.

**Effort estimate:** 30 minutes (deployment only — everything else is done)
**Priority:** P0 (Settings page is blank without this)

---

#### M12. PRE-ACCOUNT SNAPSHOT (Onboarding 10/10 Plan — Phase 2)
**What exists today:**
- Detailed specification in `/app/memory/ONBOARDING_10_10_IMPLEMENTATION_PLAN.md` (Phase 2, lines 124-196)
- Architecture designed:
  - New Edge Function: `public-snapshot` (no auth required)
  - User enters website URL on landing page (before signup)
  - Function scrapes website → runs GPT analysis → returns instant business snapshot
  - Stored in `public_snapshots` table
  - After signup, snapshot linked to user account via `converted_to_user_id`
- No code has been written

**What it should do:**
1. Visitor lands on BIQc website
2. Enters their website URL in a hero input field
3. Within 20 seconds, sees a mini-intelligence snapshot: industry detected, competitors found, risks identified, opportunities spotted
4. Visitor thinks "wow, this actually knows my business" → signs up
5. Snapshot carries over to their account after registration

**What's missing:**
- `public-snapshot` Edge Function (must be written)
- `public_snapshots` DB table (schema designed but not created)
- Landing page UI: URL input field + results display
- Conversion tracking (which snapshots led to signups)
- **All code needs to be written from scratch**

**Effort estimate:** 40-60 hours
**Priority:** P1 (single biggest conversion lever — show value before commitment)

---

#### M13. SHAREABLE SNAPSHOT EXPORT (Onboarding 10/10 Plan — Phase 10)
**What exists today:**
- Specification in ONBOARDING_10_10_IMPLEMENTATION_PLAN.md (Phase 10, lines 642-678)
- Two approaches evaluated:
  - Option A: React-PDF (`@react-pdf/renderer`) — generate PDF in frontend
  - Option B: Puppeteer/Playwright — render React component to PDF server-side
- "Share with team" link concept: unique URL for read-only access

**What it should do:**
1. User clicks "Export" on any intelligence snapshot or report
2. Generates a branded PDF with BIQc header, executive summary, key metrics, recommendations
3. "Share with team" generates a unique link — colleague can view read-only, optionally create account
4. PDF can be downloaded, emailed, or shared via link

**What's missing:**
- PDF generation library installation
- PDF template component
- Share link generation + storage (`shared_snapshots` table)
- Read-only public view page
- Expiry/access control for shared links
- **All code needs to be written**

**Effort estimate:** 24-40 hours
**Priority:** P2

---

#### M14. TEAM INVITATION SYSTEM
**What exists today:**
- Backend: `profile.py` has team-related fields:
  - `users.account_id` — links user to account/workspace
  - `users.is_master_account` — owner flag
  - `workspace_helpers.py` — get/create workspace for user
  - Account concept exists: `accounts` table with id, name
- Backend `deps.py` has role gates: `get_client_admin()` accepts owner, admin, client_admin, user_admin roles
- No invitation endpoint found in search (the `/account/users/invite` may have been removed or never built)
- No invitation UI exists

**What it should do:**
1. Owner goes to Settings → Team tab
2. Clicks "Invite Team Member"
3. Enters: email, name, role (Viewer / Editor / Admin)
4. Invitee receives email with signup link
5. On signup, invitee is automatically linked to owner's account (`account_id`)
6. Invitee sees platform filtered to their role permissions

**What's missing:**
- Invitation API endpoint (create invite, send email)
- `team_invitations` table (email, role, token, status, expires_at)
- Invitation email template
- Role-based UI filtering (which pages/features each role can access)
- Team management UI in Settings (list members, change roles, remove)
- **Integration needed:** Email provider for sending invite emails (Resend/SendGrid — same as M1)

**Effort estimate:** 20-30 hours
**Priority:** P2 (important for multi-user businesses)

---

#### M15. ADVISORY SYSTEM (Confidence Tracking + Outcome Learning)
**What exists today:**
- Backend: Full advisory system in `cognitive.py` with 5 endpoints:
  1. `GET /advisory/confidence` (line 138) — Returns current confidence level for the user's intelligence
  2. `POST /advisory/log` (line 153) — Logs an AI recommendation with: type, recommendation, confidence, context, data_sources
  3. `POST /advisory/outcome` (line 199) — Records whether a recommendation was followed and what happened (outcome_type: followed/ignored/modified, result: positive/negative/neutral, notes)
  4. `GET /advisory/history` (line 228) — Returns full advisory log with optional filtering by type, outcome, and date range
  5. `GET /advisory/escalations` (line 261) — Returns recommendations that were escalated (high severity or ignored)
- DB: `advisory_log` table exists and is queryable
- No frontend UI exists for any of these endpoints

**What it should do:**
1. Every time BIQc recommends an action, it's logged to `advisory_log` with confidence score
2. User can mark outcomes: "I followed this advice and it worked" / "I ignored this and here's what happened"
3. Over time, BIQc learns which types of advice this user follows → adjusts confidence and recommendations
4. Advisory history page shows: all past recommendations, their outcomes, and BIQc's learning
5. Escalation view shows: critical advice that was ignored or hasn't been acted on

**What's missing:**
- Frontend page/panel showing advisory history with outcome logging
- Outcome recording UI (after an alert is resolved, prompt user: "How did this go?")
- Confidence display in Executive Overview (show BIQc's confidence in its own recommendations)
- Learning loop: feed outcomes back into the cognitive engine prompt
- **No external integration needed** — all backend exists

**Effort estimate:** 12-20 hours
**Priority:** P2 (makes BIQc smarter over time — significant differentiation)

---

# PART 2: INDUSTRY COGNITION MAP
## What Each Industry Critically Needs BIQc to Monitor

The platform adapts based on industry selected during onboarding. Each industry gets:
- **Priority cognition areas** (what's on the dashboard first)
- **Industry-specific compliance monitoring**
- **Tailored alert language and thresholds**
- **Pre-built SOP templates**
- **Relevant report formats**
- **Add-on modules** available in Settings

---

### TECHNOLOGY / SOFTWARE

| Cognition Area | What BIQc Monitors | Why It's Critical | Data Source |
|---|---|---|---|
| **Revenue Concentration** | % of revenue from top 3 clients, MRR vs ARR trends, churn signals | One client leaving can kill a tech company | CRM (Merge.dev) + Accounting |
| **Cash Runway** | Monthly burn rate, revenue vs expenses, months remaining | Tech companies die from cash, not competition | Accounting (Xero/MYOB) |
| **Pipeline Velocity** | Days in each deal stage, conversion rates, stall detection | Slow pipeline = revenue gap in 90 days | CRM (Merge.dev) |
| **Team Capacity** | Developer utilisation, overtime, hiring gap analysis | Tech talent is the bottleneck | HR/payroll integration |
| **Competitor Tech Moves** | Product launches, pricing changes, hiring patterns | Fast-moving market requires constant vigilance | `competitor-monitor` + `deep-web-recon` |
| **Compliance** | Data privacy (Privacy Act), software licensing, SaaS terms | One breach = reputation + legal risk | `biqc-insights-cognitive` |

**Pre-built SOPs:** Sprint planning, Incident response, Client onboarding, Code review, Release checklist
**Alert example:** "MRR declined 4% this month. 2 clients showing disengagement signals."

---

### PROFESSIONAL SERVICES (Accounting, Legal, Consulting)

| Cognition Area | What BIQc Monitors | Why It's Critical | Data Source |
|---|---|---|---|
| **Utilisation Rate** | Billable hours vs capacity, staff utilisation % | Below 70% = burning money. Above 90% = burnout. | HR/Payroll + Calendar |
| **WIP (Work in Progress)** | Unbilled work, aged WIP, write-off risk | WIP over 30 days = cash flow leak | Accounting (Xero/MYOB) |
| **Client Engagement Decay** | Response time changes, email frequency drops | Silent clients churn. Period. | `email_priority` + CRM |
| **Proposal Conversion** | Win rate, average proposal age, pricing objections | Low conversion = pricing or positioning problem | CRM (Merge.dev) |
| **Compliance** | CPD requirements, professional indemnity, AML/CTF (legal), Tax agent registration | Licence loss = business closure | `biqc-insights-cognitive` |
| **Scope Creep** | Actual hours vs quoted hours per engagement | Scope creep is the #1 margin killer in services | Accounting + project data |

**Pre-built SOPs:** Client onboarding, Engagement letter, File review, CPD tracking, Conflict check
**Alert example:** "3 engagements have exceeded quoted hours by 20%+. Scope creep risk: $12K unbilled."

---

### RETAIL & E-COMMERCE

| Cognition Area | What BIQc Monitors | Why It's Critical | Data Source |
|---|---|---|---|
| **Revenue per Channel** | Online vs in-store, marketplace vs direct | Channel dependency = fragility | Shopify/WooCommerce + Accounting |
| **Inventory Turnover** | Stock aging, dead stock, reorder points | Dead stock = trapped cash | Shopify/WooCommerce |
| **Customer Acquisition Cost** | CAC vs LTV, return rate, repeat purchase rate | If CAC > LTV, you're buying losses | CRM + Accounting |
| **Seasonal Demand Shifts** | Year-over-year comparison, trend detection | Miss a seasonal shift = lost quarter | `market-analysis-ai` + historical data |
| **Cash Flow Timing** | Supplier payment terms vs revenue collection | Retail runs on timing, not margin | Accounting (Xero/MYOB) |
| **Compliance** | Consumer guarantees (ACL), product safety, GST | ACL breach = ACCC action | `biqc-insights-cognitive` |

**Pre-built SOPs:** Stock take, Returns handling, Seasonal prep, Supplier onboarding, Dispatch process
**Alert example:** "Inventory turnover declined 15%. 4 SKUs below reorder point. $8K in dead stock over 90 days."

---

### FOOD & HOSPITALITY

| Cognition Area | What BIQc Monitors | Why It's Critical | Data Source |
|---|---|---|---|
| **Labour Cost %** | Labour as % of revenue, overtime, roster efficiency | Target: 25-35%. Above = unsustainable. | HR/Payroll (Deputy) |
| **COGS %** | Food/beverage cost vs revenue, waste tracking | Target: 28-35%. Above = menu pricing issue. | Accounting |
| **Staff Turnover** | Resignation rate, time-to-fill, training cost | Hospitality turnover is 73% annually. Every departure costs $3-5K. | HR/Payroll |
| **Peak Period Analysis** | Revenue by hour/day, staffing vs demand matching | Understaffed peak = lost revenue. Overstaffed quiet = wasted cost. | POS + Payroll |
| **Compliance** | Food safety (FSANZ), liquor licensing, health inspections, RSA | One failed inspection = forced closure | `biqc-insights-cognitive` |
| **Review Sentiment** | Google/Yelp review monitoring, complaint detection | 1-star reviews compound. Response time matters. | `deep-web-recon` |

**Pre-built SOPs:** Opening/closing checklist, Food safety daily, Allergen management, RSA compliance, Staff induction
**Alert example:** "Labour cost hit 38% this week (target: 32%). Tuesday and Wednesday overstaffed by 2 FTE."

---

### HEALTHCARE

| Cognition Area | What BIQc Monitors | Why It's Critical | Data Source |
|---|---|---|---|
| **Patient Throughput** | Appointments per day, no-show rate, waitlist length | Throughput = revenue. No-shows = 10-15% revenue loss. | Calendar + CRM |
| **Credential Expiry** | AHPRA registration, professional indemnity, CPD | Expired credential = cannot practice = zero revenue | Calendar alerts + manual entry |
| **Billing Compliance** | Medicare billing accuracy, gap fee monitoring | Incorrect billing = audit + recovery | Accounting |
| **Staff Rostering** | Practitioner availability vs demand, leave coverage | Uncovered shifts = lost appointments | HR/Payroll (Deputy) |
| **Compliance** | AHPRA, Privacy Act (health records), infection control, mandatory reporting | Healthcare has the strictest compliance environment | `biqc-insights-cognitive` |
| **Patient Retention** | Rebooking rate, recall compliance, engagement signals | 80% of revenue comes from repeat patients | CRM + Calendar |

**Pre-built SOPs:** Patient intake, Infection control, Incident reporting, Record keeping, Recall process
**Alert example:** "Dr. Smith's AHPRA registration expires in 45 days. 3 practitioners have CPD shortfall."

---

### MANUFACTURING

| Cognition Area | What BIQc Monitors | Why It's Critical | Data Source |
|---|---|---|---|
| **Production Output** | Units produced vs target, yield rate | Below target = order backlog builds | Manual entry / integration |
| **Supply Chain Risk** | Supplier lead times, single-source dependencies | One supplier failure = production halt | Accounting + CRM |
| **Quality / Defect Rate** | Defects per batch, rework cost, customer returns | Defects compound: cost + reputation + warranty | Manual entry |
| **Machine Utilisation** | Downtime tracking, maintenance scheduling | 1 hour downtime = $X in lost production | Manual entry |
| **Cash Conversion Cycle** | Days to convert raw materials to cash | Long cycle = cash trapped in production | Accounting |
| **Compliance** | WHS, environmental, quality certifications (ISO), product liability | Workplace injury = shutdown risk + prosecution | `biqc-insights-cognitive` |

**Pre-built SOPs:** Production run checklist, Quality inspection, Maintenance schedule, Safety induction, Supplier assessment
**Alert example:** "Supplier A lead time increased from 14 to 28 days. Single-source dependency — no backup."

---

### CONSTRUCTION

| Cognition Area | What BIQc Monitors | Why It's Critical | Data Source |
|---|---|---|---|
| **Project Margins** | Actual vs quoted cost per job, variation tracking | Margin erosion is invisible until the job finishes | Accounting (Xero/MYOB) |
| **Subcontractor Costs** | Sub cost as % of project, rate changes, payment terms | Sub cost spikes compress margins across all jobs | Accounting |
| **Cash Flow Timing** | Progress claims vs payments, retention releases | Construction cash flow is lumpy and unpredictable | Accounting |
| **Defect Liability** | Defect reports, rectification costs, warranty claims | Defect liability period = ongoing financial exposure | Manual entry |
| **Compliance** | WHS, building codes, licencing, insurance (PI, PL, WC) | Non-compliance = stop work order + personal liability | `biqc-insights-cognitive` |
| **Pipeline** | Tenders submitted, win rate, forward work | No pipeline = workforce layoffs in 3 months | CRM |

**Pre-built SOPs:** Site induction, Safety checklist, Defect rectification, Progress claim process, Variation management
**Alert example:** "Job #142 actual cost $48K vs quoted $42K. Margin compressed to 8% (target 15%)."

---

### FINANCE (Financial Services, Accounting Firms)

| Cognition Area | What BIQc Monitors | Why It's Critical | Data Source |
|---|---|---|---|
| **Client Portfolio Risk** | Revenue concentration, engagement health, fee sensitivity | Losing 1 client at $50K fee = immediate crisis | CRM + Accounting |
| **Fee Recovery** | WIP to billed ratio, aged WIP, write-offs | Unbilled WIP over 60 days = likely write-off | Accounting |
| **Regulatory Compliance** | AFS licence conditions, APRA requirements, AML/CTF, trust account reconciliation | Compliance breach = licence loss = business closure | `biqc-insights-cognitive` |
| **Staff Capacity (Tax Season)** | Seasonal utilisation spikes, overtime, deadline tracking | BAS/tax deadlines are immovable. Miss = penalty. | HR/Payroll + Calendar |
| **Trust Account Monitoring** | Trust account balances, reconciliation status | Trust account breaches = criminal liability | Accounting |

**Pre-built SOPs:** Client engagement, AML verification, Trust reconciliation, BAS preparation, Audit file review
**Alert example:** "Trust account reconciliation overdue by 3 days. 2 AML verifications pending beyond 14-day window."

---

### EDUCATION

| Cognition Area | What BIQc Monitors | Why It's Critical | Data Source |
|---|---|---|---|
| **Enrolment Pipeline** | Applications, conversions, seasonal intake planning | Enrolment = revenue. Pipeline gaps show 6 months early. | CRM |
| **Student Retention** | Completion rates, dropout signals, engagement | Dropout = lost revenue + reputation impact | CRM + Calendar |
| **Staff-Student Ratio** | Compliance ratios, trainer availability | Ratio breaches = compliance failure | HR/Payroll |
| **Compliance** | ASQA registration, CRICOS (international), child safety (if applicable) | Registration at risk = cannot operate | `biqc-insights-cognitive` |
| **Revenue Diversification** | Domestic vs international, course mix, funding sources | Over-reliance on one stream = vulnerability | Accounting |

**Pre-built SOPs:** Student induction, Assessment validation, Complaint handling, Course development, Trainer induction
**Alert example:** "Semester 2 enrolments tracking 22% below target. Marketing response rate declining."

---

## ADD-ON MODULES (Available in Settings)

Users can toggle ON modules from other industries:

| Add-On Module | From Industry | What It Adds | Integration Required |
|---|---|---|---|
| Client Engagement Tracking | Professional Services | Response time monitoring, engagement decay alerts | Email connected |
| Inventory Monitoring | Retail | Stock levels, reorder alerts, dead stock detection | Shopify/WooCommerce |
| Project Margin Tracking | Construction | Job costing, actual vs quoted, variation tracking | Accounting |
| Labour Cost Analysis | Food & Hospitality | Labour %, roster efficiency, overtime alerts | HR/Payroll (Deputy) |
| Patient/Client Throughput | Healthcare | Appointment utilisation, no-show rate, waitlist | Calendar + CRM |
| Competitor Deep Scan | Technology | Extended social media + job posting monitoring | Auto (Perplexity + Firecrawl) |
| Trust Account Monitoring | Finance | Balance tracking, reconciliation alerts | Accounting |
| Compliance Calendar | All | Custom compliance deadline tracking + reminders | Manual entry |

---

## SUPER ADMIN: INDUSTRY VIEW DROPDOWN

In the Super Admin top bar:
- **Dropdown:** "View as: [All Industries ▼]"
- Select any industry → entire platform transforms to show that industry's default config
- Shows: industry-specific widgets, compliance items, SOP templates, alert language, thresholds
- Combines with existing **Impersonation** feature: select industry + impersonate specific client
- Use case: demos, sales calls, support, testing, partner onboarding

---

## SUMMARY

| Category | Features Counted |
|---|---|
| Onboarding & Calibration | 11 features |
| Loading & Animation | 5 features |
| Tutorial System | 5 features |
| Core Intelligence Engine | 10 features |
| Strategic Tools | 12 features |
| Notification & Alert System | 6 features |
| Integrations & Email | 11 features |
| Business DNA & Settings | 8 features |
| Action Buttons (Resolution Centre) | 4 features |
| Admin & Governance | 6 features |
| Background Workers | 6 jobs |
| UI/UX Features | 6 features |
| Half-Built / Discussed | 15 features |
| **TOTAL** | **105 features** |
| Industry Cognition Configs | 10 industries × 6 cognition areas each |
| Add-On Modules | 8 cross-industry modules |
