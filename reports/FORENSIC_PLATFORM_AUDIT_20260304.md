# BIQc PLATFORM — COMPLETE FORENSIC AUDIT
## Every Page, Every Button, Every Data Source
Generated: 4 March 2026

---

## SECTION 1: PUBLIC WEBSITE PAGES (No Auth Required)

### 1.1 Homepage `/`
**Component:** `pages/website/HomePage.js` wrapped in `WebsiteLayout`
**What it does:** Marketing landing page — communicates platform value proposition
**Data sources:** NONE (static content)
**Interactive elements:**
| Element | data-testid | Action | Status |
|---------|------------|--------|--------|
| "Try It Free" nav button | `nav-get-started` | → `/register-supabase` | WORKING |
| "Log in" nav link | `nav-login` | → `/login-supabase` | WORKING |
| Trust dropdown | `nav-trust` | Opens 7-item dropdown | WORKING |
| Hero CTA "Try It For Free" | `hero-cta` | → `/register-supabase` | WORKING |
| Hero prev/next arrows | `hero-prev`, `hero-next` | Rotate hero text | WORKING |
| "Already have an account? Log in" | `hero-login` | → `/login-supabase` | WORKING |
| Bottom CTA | `bottom-cta` | → `/register-supabase` | WORKING |
| Mobile hamburger | `nav-mobile-toggle` | Opens mobile nav menu | WORKING |

**Sub-components:**
- `EnergyGalaxyBackground` — Canvas animation (4 threads, 50 particles, convergence glow). Hidden on mobile.
- `LiquidSteelHeroRotator` — 3 rotating hero variants, 8s auto-rotate, 1.2s fade
- `IntelligenceDiagram` — 4-tier flow: Business Signals → Watchtower → BIQc → Decision Support
- `IntegrationCarousel` — 21 SVG brand logos, 25s loop, pause on hover
- `WebsiteLayout` — Nav bar + footer wrapper

### 1.2 Platform Page `/platform`
**Component:** `pages/website/PlatformPage.js`
**Data sources:** NONE (static)
**What it does:** Describes platform capabilities
**Status:** STATIC CONTENT — no API calls

### 1.3 Intelligence Page `/intelligence`
**Component:** `pages/website/IntelligencePage.js`
**Data sources:** NONE (static)
**Status:** STATIC CONTENT

### 1.4 Integrations Page `/our-integrations`
**Component:** `pages/website/IntegrationsPage.js`
**Data sources:** NONE (static)
**Status:** STATIC CONTENT — lists supported integrations

### 1.5 Pricing Page `/pricing`
**Component:** `pages/website/PricingPage.js`
**Data sources:** NONE (static)
**What it does:** 3-tier pricing: The Pulse ($149), The Strategist ($1,950), The Sovereign ($5,500)
**Status:** STATIC CONTENT — "Get started" buttons → `/register-supabase`

### 1.6 Trust Landing `/trust`
**Component:** `pages/website/TrustLandingPage.js`
**Data sources:** NONE (static)
**Sub-pages:**
- `/trust/ai-learning-guarantee` → `AILearningGuarantee.js` — STATIC
- `/trust/terms` → Trust terms sub-page — STATIC
- `/trust/privacy` → Privacy policy — STATIC
- `/trust/dpa` → Data processing agreement — STATIC
- `/trust/security` → Security & infrastructure — STATIC
- `/trust/centre` → Trust centre — STATIC

### 1.7 Other Public Pages
- `/contact` → `ContactPage.js` — Contact form (STATIC)
- `/knowledge-base` → `KnowledgeBasePage.js` — Help articles (STATIC)
- `/blog` → `BlogPage.js` — Blog listing (STATIC, from `data/blogArticles.js`)
- `/blog/:slug` → `BlogArticlePage.js` — Individual articles (STATIC)
- `/terms` → `TermsAndConditions.js` — Legal terms (STATIC)
- `/enterprise-terms` → `EnterpriseTerms.js` — Enterprise legal (STATIC)

---

## SECTION 2: AUTHENTICATION PAGES

### 2.1 Login `/login-supabase`
**Component:** `pages/LoginSupabase.js`
**Data sources:** `supabase.auth.signInWithPassword()` or `supabase.auth.signInWithOAuth()`
**Interactive elements:**
| Element | data-testid | Action |
|---------|------------|--------|
| Google OAuth | `login-google-btn` | Supabase Google OAuth redirect |
| Microsoft OAuth | `login-microsoft-btn` | Supabase Microsoft OAuth redirect |
| Email input | `login-email-input` | Text input |
| Password input | `login-password-input` | Password input |
| Toggle password | `login-toggle-password` | Show/hide password |
| Sign In button | `login-submit-btn` | Calls `signIn()` → auth bootstrap |
| Forgot password | `login-forgot-password` | → `/reset-password` |
| Sign up link | `login-signup-link` | → `/register-supabase` |
| Back to home | `login-back-to-home-link` | → `/` |
**Status:** WORKING — submits to Supabase Auth

### 2.2 Register `/register-supabase`
**Component:** `pages/RegisterSupabase.js`
**Data sources:** `supabase.auth.signUp()`
**Fields:** full_name, email, company_name (optional), industry (optional), password, confirm_password
**Interactive elements:**
| Element | data-testid | Action |
|---------|------------|--------|
| Google OAuth | `register-google-btn` | Supabase Google OAuth |
| Microsoft OAuth | `register-microsoft-btn` | Supabase Microsoft OAuth |
| Name input | `register-name-input` | Required |
| Email input | `register-email-input` | Required |
| Company input | `register-company-input` | Optional |
| Industry input | `register-industry-input` | Optional |
| Password input | `register-password-input` | Min 6 chars |
| Confirm password | `register-confirm-password-input` | Must match |
| Submit | `register-submit-btn` | Creates account → `/login-supabase` |
**Status:** WORKING

### 2.3 Password Reset `/reset-password`
**Component:** `pages/ResetPassword.js`
**Data sources:** `supabase.auth.resetPasswordForEmail()`
**Status:** WORKING

### 2.4 Auth Callback `/auth/callback`
**Component:** `pages/AuthCallbackSupabase.js`
**What it does:** Handles OAuth redirect from Supabase → extracts session → redirects to `/advisor`
**Status:** WORKING

---

## SECTION 3: ONBOARDING FLOW

### 3.1 Auth Bootstrap (Invisible)
**Component:** `context/SupabaseAuthContext.js`
**What happens after login:**
1. `GET /api/calibration/status` — checks `strategic_console_state.is_complete` and `user_operator_profile.persona_calibration_status`
2. If NOT complete → `authState = NEEDS_CALIBRATION` → redirect to `/calibration`
3. If complete → checks `GET /api/onboarding/status` → `{ completed: true/false }`
4. If onboarding incomplete → redirect to `/onboarding`
5. If both complete → `authState = READY` → `/advisor`

### 3.2 Calibration `/calibration`
**Component:** `pages/CalibrationAdvisor.js` + `hooks/useCalibrationState.js`
**Data sources:**
- Edge Function `calibration-business-dna` (Supabase) — Perplexity + Firecrawl + regex + GPT-4o-mini
- Edge Function `business-identity-lookup` (Supabase) — ABR registry
- `POST /api/calibration/init` — creates business_profiles shell
- `POST /api/calibration/answer` — saves each calibration answer
- `POST /api/enrichment/website` — website scan/commit
- `POST /api/calibration/brain` — AI calibration chat
- `POST /api/calibration/skip` — admin bypass

**10 Phases:**
| Phase | Entry State | Component | What Happens |
|-------|-----------|-----------|-------------|
| 1 | `ignition` | `CognitiveIgnitionScreen` | Animated loading with user's name |
| 2 | `welcome` | `WelcomeHandshake` | User enters website URL or clicks "I don't have a website" |
| 3 | `analyzing` | `AuditProgress` | Progress animation while edge function runs |
| 4 | `identity_verification` | `ForensicIdentityCard` | Shows extracted identity signals (ABN, phone, email, socials). User confirms/rejects/regenerates |
| 5 | `wow_summary` | `ChiefMarketingSummary` | Shows AI-generated business footprint. User can edit fields |
| 6 | `intelligence-first` | `ExecutiveCMOSnapshot` | Executive snapshot with system state, trajectory, blind spots, data gaps |
| 7 | `forensic` | `ForensicCalibrationUI` | Optional deeper calibration (can skip) |
| 8 | `calibrating` | `CalibratingSession` | 9-question wizard OR chat-style calibration |
| 9 | `completing` | `ExecutiveReveal` | Animated reveal of completed calibration |
| 10 | Complete | — | Writes `is_complete = true` → redirects to `/onboarding` or `/advisor` |

**Admin controls:**
- `admin-skip-btn` — Skip calibration entirely (admin only: `andre@thestrategysquad.com.au`)
- `admin-back-btn` — Go back to welcome phase
- `sign-out-btn` — Sign out

### 3.3 Onboarding Decision `/onboarding-decision`
**Component:** `pages/OnboardingDecision.js`
**What it does:** Shows "Complete Setup Now" or "I'll Do This Later"
**Data sources:** NONE (routing only)

### 3.4 Onboarding Wizard `/onboarding`
**Component:** `pages/OnboardingWizard.js`
**Data sources:**
- `GET /api/onboarding/status` — resume from last step
- `POST /api/onboarding/save` — persist progress
- `POST /api/onboarding/complete` — mark complete
- `PUT /api/business-profile` — save profile data
- `POST /api/website/enrich` — website auto-fill

**8 Steps:**
1. Welcome
2. Business Identity (name, stage, industry, location)
3. Website (URL + auto-enrich)
4. Market & Customers (target market, segments)
5. Products & Services (offerings, UVP)
6. Team (size, roles)
7. Goals & Strategy (short/long term, challenges, growth)
8. Preferences (AI style, focus areas)

**On completion:** Redirects to `/integrations` (FIXED — was `/advisor`)

---

## SECTION 4: MAIN PLATFORM PAGES (Auth Required)

### 4.1 BIQc Overview / Advisor `/advisor`
**Component:** `pages/AdvisorWatchtower.js`
**Data sources:**
- `useSnapshot()` hook → `GET /api/snapshot/latest` — cognitive snapshot with system_state, executive_memo, resolution_queue, etc.
- `GET /api/integrations/merge/connected` — which integrations are active
- `GET /api/cognition/overview` — cognition core data (Phase B, with fallback)

**Interactive elements:**
| Element | data-testid | Action | Data Source |
|---------|------------|--------|-------------|
| Refresh button | `refresh-btn` | Re-fetches snapshot | `/snapshot/latest` |
| 5 Cognition Tabs (Money, Revenue, Ops, People, Market) | `tab-money`, `tab-revenue`, etc. | Switch active view | Parsed from snapshot |
| Connect CRM/Accounting/Email buttons | `connect-revenue`, etc. | → `/integrations` | Shows when integration missing |
| Action buttons (Auto-Email, Quick-SMS, Hand Off, Complete, Ignore) | `action-auto-email`, etc. | Resolution actions | From resolution_queue |
| Welcome Banner | `welcome-banner` | Shows when 0 integrations | Static |
| Daily Summary | `daily-summary` | "What changed in 24h" | From resolution_queue timestamps |

**Tab data mapping:**
| Tab | Requires Integration | Data Fields |
|-----|---------------------|-------------|
| Money | Accounting (Xero/QB) | `c.capital` → runway, margin, spend, alert |
| Revenue | CRM (HubSpot/SF) | `c.revenue` → pipeline, weighted, churn, entropy |
| Operations | CRM/PM | `c.execution` → sla_breaches, bottleneck, task_aging |
| People | Email/Calendar | `c.founder_vitals` → capacity_index, fatigue, decisions |
| Market | None (calibration) | `c.market`, `c.market_intelligence` → positioning, misalignment, goal_prob |

**Score calculation:** `score = (severity_weight × alert_count) + (metrics × 5) + (details ? 10 : 0) + (insight ? 5 : 0)`

### 4.2 Revenue `/revenue`
**Component:** `pages/RevenuePage.js`
**Data sources:**
- `GET /api/integrations/crm/deals` — CRM deal data (requires HubSpot/Salesforce via Merge)
- `GET /api/integrations/accounting/summary` — Accounting summary (requires Xero/QB via Merge)
- `GET /api/intelligence/scenarios` — SQL-backed scenario analysis
- `GET /api/unified/revenue` — Unified revenue intelligence
- `GET /api/cognition/revenue` — Cognition core (Phase B, with fallback)
- `useSnapshot()` — cognitive snapshot

**What shows:** Pipeline total, active deals, stalled deals (>7 days), deal table with stall days/value/probability
**If no CRM connected:** Shows "Connect CRM" empty state

### 4.3 Risk `/risk`
**Component:** `pages/RiskPage.js`
**Data sources:**
- `GET /api/integrations/merge/connected` — integration status
- `GET /api/intelligence/workforce` — SQL workforce health
- `GET /api/intelligence/scores` — weighted insight scores
- `GET /api/unified/risk` — unified risk intelligence
- `GET /api/cognition/risk` — Cognition core (Phase B)
- `useSnapshot()` — risk data from cognitive snapshot

**What shows:** Risk meters (revenue volatility, engagement decay, cash deviation, anomaly density), composite risk score, governance tab with contradictions
**If no integrations:** Shows "Connect" buttons per domain

### 4.4 Operations `/operations`
**Component:** `pages/OperationsPage.js`
**Data sources:**
- `GET /api/snapshot/latest` — execution data
- `GET /api/integrations/merge/connected` — integration check
- `GET /api/unified/operations` — unified ops intelligence
- `GET /api/cognition/operations` — Cognition core (Phase B)

**What shows:** SLA breaches, bottleneck identification, task aging %, recommendations
**If no integrations:** "Connect integrations to assess operations"

### 4.5 Market & Positioning `/market`
**Component:** `pages/MarketPage.js`
**Data sources:**
- `GET /api/snapshot/latest` — market data from snapshot
- `GET /api/intelligence/watchtower` — watchtower positions
- `GET /api/intelligence/pressure` — demand pressure by domain
- `GET /api/intelligence/freshness` — data freshness scores
- `GET /api/integrations/channels/status` — channel health
- Edge Function `biqc-insights-cognitive` — cognitive insights

**What shows:** Market positioning verdict, competitor landscape, demand pressure by domain, freshness radar

### 4.6 Compliance `/compliance`
**Component:** `pages/CompliancePage.js`
**Data sources:** `useSnapshot()` — compliance data from cognitive snapshot
**What shows:** Compliance status, regulatory signals

### 4.7 Dashboard `/dashboard`
**Component:** `pages/Dashboard.js`
**Data sources:**
- `GET /api/onboarding/status` — onboarding completion
- `GET /api/dashboard/stats` — dashboard statistics
- `GET /api/dashboard/focus` — focus areas
- `GET /api/outlook/status` — email connection status

**What shows:** Setup checklist, integration status, quick stats
**Status:** Route restored (was redirecting to `/advisor`)

---

## SECTION 5: SOUNDBOARD SYSTEM

### 5.1 SoundBoard Panel
**Component:** `components/SoundboardPanel.js` (embedded in DashboardLayout)
**Data sources:**
- `GET /api/soundboard/conversations` — conversation history list
- `GET /api/soundboard/conversations/{id}` — specific conversation messages
- `POST /api/soundboard/chat` — send message, get AI response
- Edge Function `query-integrations-data` — live data queries from integrations

**Interactive elements:**
| Element | data-testid | What It Does |
|---------|------------|-------------|
| Message input textarea | `sb-input` | Type message to BIQc |
| Send button | `sb-send` | Sends message via `/soundboard/chat` |
| Paperclip (attach file) | `sb-upload` | Opens file picker (accepts .pdf, .doc, .docx, .txt, .csv, .xlsx, .png, .jpg) |
| History toggle | `sb-history-btn` | Shows/hides conversation sidebar |
| New conversation (+) | `sb-new-chat` | Creates new conversation |
| Delete conversation | `sb-delete-{id}` | Deletes conversation |
| Conversation list items | — | Click to load conversation messages |

**How the Paperclip works:**
- Opens native file picker via hidden `<input type="file">`
- Accepts: `.pdf, .doc, .docx, .txt, .csv, .xlsx, .png, .jpg`
- Currently: Adds "[Attached: filename]" message + "File analysis will be available when document processing is connected" response
- Does NOT upload the file to backend — **PLACEHOLDER functionality**

**How chat works:**
1. User types message → `POST /api/soundboard/chat` with `{ message, conversation_id }`
2. Backend builds context: business profile, conversation history (last 20 messages), marketing benchmarks
3. Backend calls AI (via `get_ai_response`) with BIQc persona prompt
4. Returns `{ reply, conversation_id, conversation_title }`
5. If message contains DATA_KEYWORDS (e.g., "how much", "pipeline", "invoices"), also calls `query-integrations-data` edge function for live data

**Data keywords that trigger integration queries:**
`how much, how many, what was, what is, show me, total, pipeline, deals, contacts, invoices, revenue, spend, google ads, leads, clients, outstanding, overdue`

### 5.2 Floating Soundboard
**Component:** `components/FloatingSoundboard.js`
**What it does:** Compact chat overlay accessible from any page
**Same API calls as SoundboardPanel but without file upload or conversation history**
**Additional feature:** Can detect business profile update requests and call `PUT /api/business-profile`

---

## SECTION 6: EXECUTION PAGES (TierGate Required)

### 6.1 Alerts `/alerts`
**Component:** `pages/AlertsPageAuth.js`
**Data sources:** `GET /api/alerts/check` — watchtower alerts
**What shows:** Alert list with severity, type, timestamp

### 6.2 Priority Inbox `/email-inbox`
**Component:** `pages/EmailInbox.js`
**Data sources:**
- `GET /api/email/priority-inbox` — prioritized emails
- `POST /api/email/analyze-priority` — AI priority analysis
- `POST /api/email/suggest-reply/{id}` — AI reply suggestions

### 6.3 Actions `/actions`
**Component:** `pages/ActionsPage.js`
**Data sources:** `GET /api/intelligence/actions` — action items from intelligence engine

### 6.4 Automations `/automations`
**Component:** `pages/AutomationsPageAuth.js`
**Data sources:** `GET /api/automation/history` — automation execution history

---

## SECTION 7: SYSTEMS PAGES

### 7.1 Integrations `/integrations`
**Component:** `pages/Integrations.js`
**Data sources:**
- `GET /api/integrations/merge/connected` — current connection status
- `POST /api/integrations/merge/link-token` — Merge.dev link token for OAuth
- `POST /api/integrations/merge/exchange-account-token` — complete Merge connection
- `GET /api/outlook/status` — Outlook connection
- `GET /api/gmail/status` — Gmail connection
- Edge Function `connect-outlook` — Outlook OAuth flow
- `POST /api/outlook/disconnect`, `POST /api/gmail/disconnect`

**Supported integrations (via Merge.dev):**
- CRM: HubSpot, Salesforce, Pipedrive
- Accounting: Xero, QuickBooks, MYOB
- Email: Outlook, Gmail (direct OAuth)
- Google Drive (file sync)

### 7.2 Data Health `/data-health`
**Component:** `pages/DataHealthPage.js`
**Data sources:** Various intelligence endpoints for data quality metrics

### 7.3 Ingestion Audit `/forensic-audit`
**Component:** `pages/ForensicAuditPage.js`
**Data sources:** `GET /api/forensic/ingestion-history`, `POST /api/forensic/ingestion-audit`

### 7.4 Exposure Scan `/exposure-scan`
**Component:** `pages/DSEEPage.js`
**Data sources:** `POST /api/dsee/scan` — Digital Surface Exposure Engine

---

## SECTION 8: MARKETING PAGES

### 8.1 Marketing Intel `/marketing-intelligence`
**Component:** `pages/MarketingIntelPage.js`
**Data sources:** `POST /api/marketing/benchmark` — competitive benchmarking

### 8.2 Marketing Automation `/marketing-automation`
**Component:** `pages/MarketingAutomationPage.js`
**Data sources:** A/B testing + automation APIs

### 8.3 A/B Testing `/ab-testing`
**Component:** `pages/ABTestingPage.js`
**Data sources:** `POST /api/experiments/create`, `GET /api/experiments/list`

---

## SECTION 9: GOVERNANCE & LEGAL PAGES

### 9.1 Compliance `/compliance`
**Component:** `pages/CompliancePage.js`
**Data sources:** Cognitive snapshot compliance data

### 9.2 Reports `/reports`
**Component:** `pages/ReportsPage.js`
**Data sources:** `POST /api/reports/generate-pdf`

### 9.3 Audit Log `/audit-log`
**Component:** `pages/AuditLogPage.js`
**Data sources:** System audit trail

### 9.4 Business DNA `/business-profile`
**Component:** `pages/BusinessProfile.js`
**Data sources:**
- `GET /api/business-profile` — current profile
- `GET /api/business-profile/versioned` — version history
- `PUT /api/business-profile` — update profile
- `POST /api/business-profile/autofill` — AI autofill from website + docs
- `POST /api/business-profile/build` — full profile build (Serper + scrape + AI)

### 9.5 Settings `/settings`
**Component:** `pages/Settings.js`
**Data sources:** User preferences, notification settings

---

## SECTION 10: ADMIN PAGES (Super Admin Only)

### 10.1 Admin Dashboard `/admin`
**Component:** `pages/AdminDashboard.js`
**Data sources:** `GET /api/admin/stats`, `GET /api/admin/users`
**Access:** `andre@thestrategysquad.com.au` or role `superadmin`

### 10.2 Prompt Lab `/admin/prompt-lab`
**Component:** `pages/PromptLab.js`
**Data sources:** `GET /api/admin/prompts`, `PUT /api/admin/prompts/{key}`

### 10.3 Support Console `/support-admin`
**Component:** `pages/SupportConsolePage.js`
**Data sources:** `POST /api/support/impersonate`, `POST /api/support/reset-password`

---

## SECTION 11: SPECIAL PAGES

### 11.1 SoundBoard Full Page `/soundboard`
**Component:** `pages/MySoundBoard.js` — Full-screen soundboard (TierGate)

### 11.2 War Room `/war-room`
**Component:** `components/WarRoomConsole.js` — Real-time intelligence console (TierGate)

### 11.3 Board Room `/board-room`
**Component:** `components/BoardRoom.js` — Multi-agent debate interface (TierGate)
**Data sources:** `POST /api/boardroom/respond`, `POST /api/boardroom/escalation-action`

### 11.4 SOP Generator `/sop-generator`
**Component:** `pages/SOPGenerator.js` — AI Standard Operating Procedure generator
**Data sources:** `POST /api/generate/sop`

### 11.5 Calendar `/calendar`
**Component:** `pages/CalendarView.js` — Calendar with check-in scheduling
**Data sources:** `GET /api/checkins/pending`, `POST /api/checkins/schedule`

---

## SECTION 12: NAVIGATION STRUCTURE

### Sidebar Nav (DashboardLayout)
5 sections, restructured:
1. **Intelligence:** BIQc Overview, Revenue, Operations, Risk, Market & Positioning
2. **Execution:** Alerts, Priority Inbox, Actions, Automations
3. **Systems:** Integrations, Data Health, Ingestion Audit, Exposure Scan
4. **Marketing:** Marketing Intel, Marketing Auto, A/B Testing
5. **Governance & Legal:** Compliance, Reports, Audit Log, Business DNA, Settings
6. **Admin** (super admin only): Support Console, Observability, Admin Dashboard

---

## SECTION 13: DATA SOURCE CLASSIFICATION

### Integration-Dependent Data (requires Merge.dev connection)
- CRM deals, contacts, companies, owners (`/integrations/crm/*`)
- Accounting invoices, payments, transactions, summary (`/integrations/accounting/*`)
- Email content, calendar events (Outlook/Gmail direct OAuth)
- Google Drive files (`/integrations/google-drive/*`)

### Cognition Core Data (SQL-first, from `ic_generate_cognition_contract`)
- `/cognition/{tab}` — master intelligence contract
- `/cognition/decisions` — decision tracking
- `/cognition/integration-health` — integration health monitoring
- `/cognition/drift` — drift detection
- **REQUIRES:** SQL migrations 044 + 045 deployed to Supabase

### Snapshot Data (cached AI analysis)
- `/snapshot/latest` — last generated cognitive snapshot
- `/snapshot/generate` — trigger new snapshot generation
- Contains: system_state, executive_memo, resolution_queue, capital, revenue, execution, founder_vitals, market_intelligence

### Calibration Data (from website scrape + AI)
- Edge Function `calibration-business-dna` — PRIMARY
- Edge Function `business-identity-lookup` — ABN registry
- Stored in `business_profiles` table

### Intelligence Engine Data (SQL-backed analysis)
- `/intelligence/scenarios` — scenario modeling
- `/intelligence/workforce` — workforce health
- `/intelligence/scores` — weighted insight scores
- `/intelligence/pressure` — demand pressure
- `/intelligence/freshness` — data freshness

---

## SECTION 14: KNOWN ISSUES & INCOMPLETE FEATURES

| # | Item | Status | Details |
|---|------|--------|---------|
| 1 | SoundBoard file upload (Paperclip) | PLACEHOLDER | Shows message but doesn't upload file to backend |
| 2 | SoundBoard camera/video button | NOT FUNCTIONAL | Video icon exists in imports but button not rendered |
| 3 | Cognition Core SQL | REQUIRES DEPLOYMENT | Migrations 044+045 must be run in Supabase. `/cognition/{tab}` returns `MIGRATION_REQUIRED` until deployed |
| 4 | Weekly Check-in Calendar | PAGE EXISTS | `/calendar` route exists with `CalendarView.js` but not in sidebar nav |
| 5 | Email Inbox | REQUIRES OUTLOOK/GMAIL | Empty without email integration connected |
| 6 | Marketing Automation | UI ONLY | Frontend exists but limited backend implementation |
| 7 | A/B Testing | UI ONLY | Frontend experiment framework exists, limited backend |
| 8 | War Room | REQUIRES DATA | Needs snapshot + integrations to populate |
| 9 | Board Room | REQUIRES DATA | Multi-agent debate needs cognitive data |
| 10 | Expo Mobile App | CODE ONLY | Built but not deployed to App Store/Play Store |
| 11 | Stripe Payments | CONFIGURED | `/webhook/stripe`, `/payments/checkout` exist but checkout flow may need testing |
| 12 | Google Drive integration | PARTIAL | Connect/sync endpoints exist, file browsing UI exists |
| 13 | Reports PDF generation | BACKEND EXISTS | `POST /reports/generate-pdf` — needs testing |

---

## SECTION 15: BACKEND API ENDPOINT COUNT

| Route File | Endpoints | Category |
|-----------|----------|----------|
| integrations.py | 27 | Integration management |
| calibration.py | 20 | Calibration flow |
| generation.py | 17 | AI content generation |
| email.py | 18 | Email intelligence |
| intelligence_modules.py | 15 | Intelligence modules |
| admin.py | 14 | Admin operations |
| profile.py | 14 | Business profile |
| spine_api.py | 13 | Intelligence spine |
| cognition_contract.py | 10 | Cognition core |
| cognitive.py | 9 | Cognitive engine |
| intelligence.py | 8 | Intelligence queries |
| platform_services.py | 8 | Platform services |
| advanced_intelligence.py | 7 | Advanced analytics |
| intelligence_actions.py | 7 | Action management |
| data_center.py | 7 | File/data management |
| onboarding.py | 7 | Onboarding flow |
| super_admin.py | 7 | Super admin tools |
| unified_intelligence.py | 6 | Unified intelligence |
| soundboard.py | 5 | SoundBoard chat |
| auth.py | 5 | Authentication |
| rag_service.py | 5 | RAG/embedding |
| memory_agent.py | 4 | Memory management |
| file_service.py | 4 | File upload/download |
| watchtower.py | 4 | Watchtower events |
| health.py | 3 | Health checks |
| marketing_automation.py | 3 | Marketing automation |
| stripe_payments.py | 3 | Payments |
| **TOTAL** | **~270** | |

---

*Report generated from codebase forensic analysis. All data sources verified against actual `apiClient` and `fetch` calls in component source code.*
