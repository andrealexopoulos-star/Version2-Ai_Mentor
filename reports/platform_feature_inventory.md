# BIQc Platform — Complete Feature & Architecture Inventory

## Platform Overview
BIQc (Business Intelligence Quotient, continuous) is a business intelligence platform that continuously monitors connected business systems (CRM, email, accounting) and surfaces actionable insights. It uses AI to analyze patterns, detect risks, and advise business leaders.

---

## 1. AUTHENTICATION & LIFECYCLE

### 1.1 Authentication (Supabase Auth)
| Item | Detail |
|------|--------|
| **Function** | User signup, login, OAuth (Google), session management |
| **Frontend Pages** | `LoginSupabase.js`, `RegisterSupabase.js`, `AuthCallbackSupabase.js` |
| **Backend APIs** | `POST /api/auth/supabase/signup`, `POST /api/auth/supabase/login`, `GET /api/auth/supabase/oauth/{provider}`, `GET /api/auth/supabase/me`, `GET /api/auth/check-profile` |
| **Database** | Supabase Auth (built-in `auth.users` table) + `users` table (app-level profile) |
| **3rd Party** | **Supabase Auth** (handles JWT tokens, magic links, OAuth flows) |
| **Key Files** | `frontend/src/context/SupabaseAuthContext.js`, `backend/auth_supabase.py` |

### 1.2 Lifecycle State Machine
| Item | Detail |
|------|--------|
| **Function** | Controls the user journey: Login → Calibration → Onboarding → Main App. Prevents skipping steps. |
| **Frontend** | `ProtectedRoute.js` (enforces routing), `SupabaseAuthContext.js` (manages state) |
| **Backend APIs** | `GET /api/lifecycle/state`, `GET /api/calibration/status` |
| **Database** | `user_operator_profile` table (`persona_calibration_status`, `operator_profile.onboarding_state`) |

---

## 2. CALIBRATION SYSTEM

### 2.1 Agent Calibration (Persona Calibration)
| Item | Detail |
|------|--------|
| **Function** | Interactive AI conversation that learns the user's leadership style, decision-making patterns, communication preferences, and cognitive biases. Produces a calibrated "agent persona" unique to each user. |
| **Frontend Page** | `CalibrationAdvisor.js` |
| **Backend APIs** | `POST /api/calibration/init` (start session), `POST /api/calibration/answer` (process user answers), `GET /api/calibration/activation` (get calibration results), `POST /api/calibration/brain` (generate AI calibration profile), `POST /api/calibration/reset` (re-do calibration), `POST /api/calibration/defer` (skip for now) |
| **Database** | `calibration_sessions` (conversation history), `user_operator_profile` (stores `agent_persona` JSONB, `persona_calibration_status`) |
| **3rd Party** | **OpenAI GPT-4o** (via Emergent LLM Key) — generates calibration questions and analyzes answers |
| **Key Files** | `backend/server.py` (calibration routes), `backend/pressure_calibration.py` |

---

## 3. ONBOARDING

### 3.1 Onboarding Wizard
| Item | Detail |
|------|--------|
| **Function** | Multi-step form that collects core business information (name, industry, stage, goals, challenges). Runs after calibration. |
| **Frontend Pages** | `OnboardingWizard.js`, `OnboardingDecision.js` |
| **Backend APIs** | `GET /api/onboarding/status`, `POST /api/onboarding/save`, `POST /api/onboarding/complete` |
| **Database** | `business_profiles` (stores business info), `user_operator_profile` (`operator_profile.onboarding_state` JSONB tracks progress) |

### 3.2 Website Enrichment
| Item | Detail |
|------|--------|
| **Function** | Auto-extracts business metadata from a user-provided website URL to pre-fill profile fields. |
| **Backend APIs** | `POST /api/enrichment/website`, `POST /api/website/enrich` |
| **Database** | Results saved to `business_profiles` |

### 3.3 Profile Import / Autofill
| Item | Detail |
|------|--------|
| **Function** | AI-powered auto-fill of business profile from raw text or LinkedIn data. |
| **Frontend Page** | `ProfileImport.js` |
| **Backend APIs** | `POST /api/business-profile/autofill`, `POST /api/business-profile/build` |
| **Database** | `business_profiles`, `business_profiles_versioned` |
| **3rd Party** | **OpenAI GPT-4o** — parses unstructured text into structured business profile |

---

## 4. INTELLIGENCE FEATURES (Core Product)

### 4.1 BIQc Insights / WOW Landing (Main Dashboard)
| Item | Detail |
|------|--------|
| **Function** | Primary dashboard after login. Shows lifecycle summary (calibration status, integrations count, intelligence status), executive memo, baseline status, and intelligence events from Watchtower. Users can trigger intelligence analysis here. |
| **Frontend Page** | `AdvisorWatchtower.js` (route: `/advisor`) |
| **Backend APIs** | `GET /api/lifecycle/state`, `GET /api/facts/resolve`, `GET /api/intelligence/baseline-snapshot`, `POST /api/intelligence/cold-read`, `GET /api/intelligence/watchtower`, `PATCH /api/intelligence/watchtower/{event_id}/handle` |
| **Database** | `user_operator_profile`, `business_profiles`, `integration_accounts`, `watchtower_insights`, `observation_events`, `intelligence_snapshots` |
| **3rd Party** | **OpenAI GPT-4o** (via cold-read for AI analysis of events) |

### 4.2 Intelligence Pipeline (Data Flow)
| Item | Detail |
|------|--------|
| **Function** | Two-stage pipeline: (1) **Emission Layer** extracts raw signals from connected integrations (CRM deals, emails, calendar). (2) **Watchtower Engine** analyzes those signals and produces actionable intelligence insights. |
| **Backend APIs** | `POST /api/intelligence/ingest` (admin-only, triggers full pipeline), `POST /api/intelligence/cold-read` (read-only, returns cached analysis) |
| **Database** | `observation_events` (raw signals with fingerprint for idempotency), `watchtower_insights` (analyzed intelligence positions), `intelligence_snapshots` (baseline state) |
| **Key Files** | `backend/merge_emission_layer.py` (signal extraction), `backend/watchtower_engine.py` (analysis engine), `backend/watchtower_store.py`, `backend/routes/intelligence.py` |
| **3rd Party** | **Merge.dev** (normalized CRM/accounting data), **OpenAI GPT-4o** (analysis) |

### 4.3 Intelligence Baseline Configuration
| Item | Detail |
|------|--------|
| **Function** | Lets users configure which business domains to monitor (finance, sales, operations, team, market) and set thresholds for alerts. |
| **Frontend Page** | `IntelligenceBaseline.js` (route: `/intelligence-baseline`) |
| **Backend APIs** | `GET /api/baseline`, `POST /api/baseline`, `GET /api/baseline/defaults`, `POST /api/snapshot/generate`, `GET /api/snapshot/latest`, `GET /api/snapshot/history` |
| **Database** | `intelligence_baseline`, `business_profiles` (`intelligence_configuration` JSONB) |

### 4.4 Board Room
| Item | Detail |
|------|--------|
| **Function** | "Priority Compression" UI. Shows a single primary critical focus, a few secondary items, and hides the rest. AI-powered conversational interface where users can interrogate intelligence findings, request actions, and manage escalations. |
| **Frontend Component** | `BoardRoom.js` (route: `/board-room`) |
| **Backend APIs** | `POST /api/boardroom/respond` (AI conversation), `POST /api/boardroom/escalation-action` (take action on escalations) |
| **Database** | `watchtower_insights` (reads positions), `observation_events` (evidence), `user_operator_profile` (agent persona for tone) |
| **3rd Party** | **OpenAI GPT-4o** — generates board room responses |
| **Key Files** | `backend/routes/boardroom.py`, `backend/boardroom_prompt.py` |

### 4.5 Operator View
| Item | Detail |
|------|--------|
| **Function** | Displays the raw operator-level intelligence data: domain positions (STABLE/ELEVATED/DETERIORATING/CRITICAL), raw observation events, and explains why there is no intelligence if the pipeline hasn't run yet. |
| **Frontend Page** | `OperatorDashboard.js` (route: `/operator`) |
| **Backend APIs** | `GET /api/intelligence/watchtower`, `GET /api/intelligence/data-readiness` |
| **Database** | `watchtower_insights`, `observation_events`, `integration_accounts` |

---

## 5. AI CONVERSATIONAL FEATURES

### 5.1 Strategic Console (War Room)
| Item | Detail |
|------|--------|
| **Function** | Full AI chat interface with the calibrated advisor. Injects known facts to avoid re-asking questions. Modern light theme with ChatGPT-style smooth scrolling. Persists conversation progress. |
| **Frontend Component** | `WarRoomConsole.js` (route: `/war-room`) |
| **Backend APIs** | `POST /api/chat` (send message), `GET /api/chat/history`, `GET /api/chat/sessions`, `POST /api/console/state` (save progress), `GET /api/business-profile/context` (inject known facts) |
| **Database** | `chat_history` (messages), `user_operator_profile` (`operator_profile.console_state` JSONB) |
| **3rd Party** | **OpenAI GPT-4o** — powers the strategic advisor conversation |

### 5.2 SoundBoard (MySoundBoard)
| Item | Detail |
|------|--------|
| **Function** | Multi-conversation AI chat tool. Uses the Cognitive Core for deep user context and the Fact Resolution Engine to never re-ask known information. Supports multiple named conversations with full CRUD. |
| **Frontend Page** | `MySoundBoard.js` (route: `/soundboard`) |
| **Backend APIs** | `GET /api/soundboard/conversations` (list all), `GET /api/soundboard/conversations/{id}` (get one), `POST /api/soundboard/chat` (send message), `PATCH /api/soundboard/conversations/{id}` (rename), `DELETE /api/soundboard/conversations/{id}` (delete) |
| **Database** | `soundboard_conversations` table (stores conversations + messages as JSONB array) |
| **3rd Party** | **OpenAI GPT-4o** — generates responses |
| **Key Files** | `backend/server.py` (soundboard routes), `backend/cognitive_core_supabase.py`, `backend/fact_resolution.py` |

### 5.3 Voice Chat
| Item | Detail |
|------|--------|
| **Function** | Real-time voice conversation with the AI advisor via WebRTC. Uses OpenAI Realtime API for low-latency speech-to-speech interaction. |
| **Frontend Component** | `VoiceChat.js` |
| **Backend APIs** | `POST /api/voice/realtime/session` (get session token), `POST /api/voice/realtime/negotiate` (WebRTC signaling) |
| **Database** | None (real-time only, no persistence) |
| **3rd Party** | **OpenAI Realtime API** (via `OpenAIChatRealtime` from emergentintegrations) — real-time voice AI |

---

## 6. BUSINESS PROFILE & DATA

### 6.1 Business DNA (Business Profile)
| Item | Detail |
|------|--------|
| **Function** | Central business profile editor. All fields auto-save on change (debounced). Versioned history of changes. Shows completeness scores per domain. |
| **Frontend Page** | `BusinessProfile.js` (route: `/business-profile`) |
| **Backend APIs** | `GET /api/business-profile`, `PUT /api/business-profile` (update), `GET /api/business-profile/versioned`, `GET /api/business-profile/history`, `POST /api/business-profile/request-update`, `GET /api/business-profile/scores`, `GET /api/business-profile/context` |
| **Database** | `business_profiles` (current profile), `business_profiles_versioned` (version history with changelogs) |

### 6.2 Fact Resolution Engine
| Item | Detail |
|------|--------|
| **Function** | Global authority for user facts. Ensures data is entered only once. Resolves facts from multiple sources (profiles, integrations, user confirmations) with confidence scoring. |
| **Backend APIs** | `GET /api/facts/resolve` (resolve all known facts), `POST /api/facts/confirm` (user confirms a fact) |
| **Database** | Reads from: `business_profiles`, `users`, `user_operator_profile`, `intelligence_baseline`. Stores confirmations in `user_operator_profile` (`operator_profile.fact_ledger` JSONB) |
| **Key File** | `backend/fact_resolution.py` |

### 6.3 Cognitive Core
| Item | Detail |
|------|--------|
| **Function** | Per-user cognitive profile engine. Observes all user interactions across agents, builds evolving understanding of user behavior, feeds context to AI agents. Tracks advisory outcomes and escalations. |
| **Backend APIs** | `GET /api/cognitive/profile`, `POST /api/cognitive/sync-business-profile`, `GET /api/cognitive/escalation`, `POST /api/cognitive/observe` |
| **Database** | `user_operator_profile` (`cognitive_profile` JSONB — 4 layers: interaction patterns, decision history, behavioral observations, escalation memory) |
| **Key File** | `backend/cognitive_core_supabase.py` |

---

## 7. INTEGRATIONS

### 7.1 Merge.dev (CRM + Accounting)
| Item | Detail |
|------|--------|
| **Function** | Connects HubSpot (CRM) and Xero (Accounting) via Merge.dev's unified API. Provides normalized access to contacts, companies, deals, and financial data. Users can disconnect integrations. |
| **Frontend Page** | `Integrations.js` (route: `/integrations`) |
| **Backend APIs** | `POST /api/integrations/merge/link-token` (get Merge Link UI token), `POST /api/integrations/merge/exchange-account-token` (finalize connection), `GET /api/integrations/merge/connected` (list connected), `POST /api/merge/disconnect`, `GET /api/integrations/crm/contacts`, `GET /api/integrations/crm/companies`, `GET /api/integrations/crm/deals`, `GET /api/integrations/crm/owners` |
| **Database** | `integration_accounts` (stores provider, category, account_token, linked_account_id) |
| **3rd Party** | **Merge.dev API** (`MERGE_API_KEY`) — unified integration platform |
| **Key File** | `backend/merge_client.py` |

### 7.2 Microsoft Outlook (Email + Calendar)
| Item | Detail |
|------|--------|
| **Function** | OAuth connection to Microsoft 365. Syncs emails (priority inbox analysis, AI-suggested replies) and calendar events. Background worker continuously syncs new emails. |
| **Frontend Pages** | `ConnectEmail.js` (route: `/connect-email`), `EmailInbox.js` (route: `/email-inbox`), `CalendarView.js` (route: `/calendar`), `OutlookTest.js` |
| **Backend APIs** | `GET /api/auth/outlook/login` (OAuth start), `GET /api/auth/outlook/callback` (OAuth complete), `GET /api/outlook/status` (connection status), `POST /api/outlook/disconnect`, `GET /api/outlook/emails/sync` (trigger sync), `POST /api/outlook/comprehensive-sync`, `GET /api/outlook/sync-status/{job_id}`, `GET /api/outlook/intelligence`, `GET /api/outlook/calendar/events`, `POST /api/outlook/calendar/sync`, `GET /api/outlook/debug-tokens` |
| **Database** | `outlook_oauth_tokens` / `m365_tokens` (OAuth tokens), `outlook_emails` (synced emails) |
| **3rd Party** | **Microsoft Graph API** (`AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`) |
| **Background Worker** | `email_sync_worker.py` — runs every 60s, syncs emails for all connected accounts |

### 7.3 Gmail
| Item | Detail |
|------|--------|
| **Function** | OAuth connection to Google Gmail for email sync. |
| **Frontend Page** | `GmailTest.js` (route: `/gmail-test`) |
| **Backend APIs** | `GET /api/auth/gmail/login`, `GET /api/auth/gmail/callback`, `GET /api/gmail/status`, `POST /api/gmail/disconnect` |
| **Database** | `gmail_connections` (OAuth tokens) |
| **3rd Party** | **Google OAuth** (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) |

### 7.4 Google Drive
| Item | Detail |
|------|--------|
| **Function** | Connect Google Drive to import and sync business documents. |
| **Backend APIs** | `POST /api/integrations/google-drive/connect`, `POST /api/integrations/google-drive/callback`, `GET /api/integrations/google-drive/files`, `POST /api/integrations/google-drive/sync`, `GET /api/integrations/google-drive/status` |
| **Database** | `integration_accounts` (connection record), `data_files` (synced file metadata) |
| **3rd Party** | **Google Drive API** (via `GOOGLE_CLIENT_ID`) |

---

## 8. EMAIL INTELLIGENCE

### 8.1 Email Priority Analysis
| Item | Detail |
|------|--------|
| **Function** | AI analyzes emails to determine priority (critical, high, medium, low), extract action items, and suggest responses. |
| **Frontend Page** | `EmailInbox.js` (route: `/email-inbox`) |
| **Backend APIs** | `POST /api/email/analyze-priority` (AI priority analysis), `POST /api/email/suggest-reply/{email_id}` (AI-generated reply suggestion), `GET /api/email/priority-inbox` (get prioritized email list) |
| **Database** | `outlook_emails` (emails with AI analysis cached) |
| **3rd Party** | **OpenAI GPT-4o** — analyzes email content for priority and generates reply suggestions |

---

## 9. ANALYSIS & DOCUMENT TOOLS

### 9.1 Business Diagnosis
| Item | Detail |
|------|--------|
| **Function** | AI-powered business diagnostic tool. Users answer questions about their business challenges; AI produces a structured diagnosis. |
| **Frontend Page** | `Diagnosis.js` (route: `/diagnosis`) |
| **Backend APIs** | `POST /api/diagnose`, `GET /api/diagnoses` |
| **Database** | `analyses` table (stores diagnosis results) |
| **3rd Party** | **OpenAI GPT-4o** |

### 9.2 Analysis (Market & Strategic)
| Item | Detail |
|------|--------|
| **Function** | Create, view, and manage strategic analyses with AI assistance. |
| **Frontend Pages** | `Analysis.js` (route: `/analysis`), `MarketAnalysis.js` (route: `/market-analysis`) |
| **Backend APIs** | `POST /api/analyses`, `GET /api/analyses`, `GET /api/analyses/{id}`, `DELETE /api/analyses/{id}` |
| **Database** | `analyses` table |
| **3rd Party** | **OpenAI GPT-4o** |

### 9.3 SOP Generator
| Item | Detail |
|------|--------|
| **Function** | AI generates Standard Operating Procedures, checklists, and action plans from business context. |
| **Frontend Page** | `SOPGenerator.js` (route: `/sop-generator`) |
| **Backend APIs** | `POST /api/generate/sop`, `POST /api/generate/checklist`, `POST /api/generate/action-plan` |
| **Database** | None (generated on-the-fly) |
| **3rd Party** | **OpenAI GPT-4o** |

### 9.4 Documents (CRUD)
| Item | Detail |
|------|--------|
| **Function** | Create, read, update, delete business documents. |
| **Frontend Pages** | `Documents.js` (route: `/documents`), `DocumentView.js` (route: `/documents/:id`) |
| **Backend APIs** | `POST /api/documents`, `GET /api/documents`, `GET /api/documents/{id}`, `PUT /api/documents/{id}`, `DELETE /api/documents/{id}` |
| **Database** | `documents` table |

### 9.5 Data Center (File Storage)
| Item | Detail |
|------|--------|
| **Function** | Upload, manage, and organize business files with categories and stats. |
| **Frontend Page** | `DataCenter.js` (route: `/data-center`) |
| **Backend APIs** | `POST /api/data-center/upload`, `GET /api/data-center/files`, `GET /api/data-center/files/{id}`, `GET /api/data-center/files/{id}/download`, `DELETE /api/data-center/files/{id}`, `GET /api/data-center/categories`, `GET /api/data-center/stats` |
| **Database** | `data_files` table |

---

## 10. ADVISORY SYSTEM

### 10.1 Advisory Confidence & Logging
| Item | Detail |
|------|--------|
| **Function** | Tracks AI advisory confidence levels, logs advisory interactions, records outcomes, and manages escalations for ignored advice. |
| **Backend APIs** | `GET /api/advisory/confidence`, `POST /api/advisory/log`, `POST /api/advisory/outcome`, `GET /api/advisory/history`, `GET /api/advisory/escalations` |
| **Database** | `advisory_log` table, `user_operator_profile` (escalation memory) |
| **Key Files** | `backend/escalation_memory.py` |

### 10.2 OAC (Ops Advisory Centre)
| Item | Detail |
|------|--------|
| **Function** | Provides operational recommendations based on business profile and intelligence data. |
| **Frontend Page** | `OpsAdvisoryCentre.js` (route: `/oac`) |
| **Backend APIs** | `GET /api/oac/recommendations` |
| **Database** | Reads from `business_profiles`, `watchtower_insights` |

---

## 11. NOTIFICATIONS & DASHBOARD

### 11.1 Notifications
| Item | Detail |
|------|--------|
| **Function** | Alert system for intelligence events, integration status changes, and system notifications. |
| **Backend APIs** | `GET /api/notifications/alerts`, `POST /api/notifications/dismiss/{id}` |
| **Database** | `dismissed_notifications` table, aggregates from `watchtower_insights`, `observation_events` |

### 11.2 Dashboard Stats
| Item | Detail |
|------|--------|
| **Function** | Aggregated statistics and focus area recommendations. |
| **Frontend Page** | `Dashboard.js` |
| **Backend APIs** | `GET /api/dashboard/stats`, `GET /api/dashboard/focus` |
| **Database** | Aggregates from multiple tables |

---

## 12. ADMIN

### 12.1 Admin Dashboard
| Item | Detail |
|------|--------|
| **Function** | User management, platform stats, subscription management, calibration backfill. |
| **Frontend Page** | `AdminDashboard.js` |
| **Backend APIs** | `GET /api/admin/users`, `GET /api/admin/stats`, `PUT /api/admin/users/{id}`, `DELETE /api/admin/users/{id}`, `PUT /api/admin/users/{id}/subscription`, `POST /api/admin/backfill-calibration` |
| **Database** | `users`, `user_operator_profile`, `business_profiles` |
| **Key File** | `backend/routes/admin.py` |

---

## 13. SETTINGS

### 13.1 User Settings
| Item | Detail |
|------|--------|
| **Function** | Manage user profile, view calibration status with "Recalibrate Agent" button, subscription info. |
| **Frontend Page** | `Settings.js` (route: `/settings`) |
| **Backend APIs** | `GET /api/auth/supabase/me`, `GET /api/calibration/status`, `POST /api/calibration/reset` |
| **Database** | `users`, `user_operator_profile` |

---

## 14. ACCOUNT & TEAM

### 14.1 User Invitation System
| Item | Detail |
|------|--------|
| **Function** | Invite team members to join the workspace. |
| **Backend APIs** | `POST /api/account/users/invite`, `POST /api/account/users/accept` |
| **Database** | `users` table (invited users) |

---

## 15. PUBLIC PAGES

### 15.1 Landing Page
| Item | Detail |
|------|--------|
| **Function** | Public marketing page with interactive demo, feature highlights, and CTA. |
| **Frontend Pages** | `LandingIntelligent.js` (current, route: `/`), `Landing.js` (original) |

### 15.2 Pricing
| Item | Detail |
|------|--------|
| **Function** | Pricing tiers display. |
| **Frontend Page** | `Pricing.js` (route: `/pricing`) |

### 15.3 Terms & Conditions
| Item | Detail |
|------|--------|
| **Function** | Legal terms page. |
| **Frontend Page** | `TermsAndConditions.js` (route: `/terms`) |

---

## 16. BACKGROUND WORKERS

| Worker | Function | Runs |
|--------|----------|------|
| `email_sync_worker.py` | Syncs emails for all connected accounts (Outlook, Gmail) every 60 seconds | Supervisor-managed, continuous |
| `intelligence_automation_worker.py` | Automates intelligence pipeline execution | Supervisor-managed, continuous |

---

## DATABASE TABLES (Supabase PostgreSQL)

| Table | Used By | Purpose |
|-------|---------|---------|
| `users` | Auth, Settings, Admin | User accounts and profiles |
| `user_operator_profile` | Calibration, Cognitive Core, Facts, Lifecycle | Agent persona, cognitive profile, fact ledger, console state, onboarding state |
| `business_profiles` | Business DNA, Onboarding, Intelligence | Core business information |
| `business_profiles_versioned` | Business DNA | Version history with changelogs |
| `calibration_sessions` | Calibration | Calibration conversation history |
| `calibration_schedules` | Calibration | Scheduled calibration sessions |
| `chat_history` | Strategic Console, Chat | Conversation messages |
| `soundboard_conversations` | SoundBoard | Multi-conversation chat storage (messages as JSONB) |
| `integration_accounts` | Integrations, Intelligence | Connected integration records (Merge, Google Drive) |
| `outlook_oauth_tokens` | Outlook | Microsoft OAuth tokens |
| `m365_tokens` | Outlook | Microsoft 365 tokens |
| `gmail_connections` | Gmail | Google OAuth tokens |
| `outlook_emails` | Email Intelligence | Synced email data |
| `observation_events` | Intelligence Pipeline | Raw signals from integrations (with fingerprint for idempotency) |
| `watchtower_insights` | Intelligence, Board Room, Operator View | Analyzed intelligence positions |
| `intelligence_snapshots` | Intelligence | Baseline initialization state |
| `intelligence_baseline` | Intelligence Baseline | User-configured monitoring thresholds |
| `intelligence_priorities` | Intelligence | Prioritized intelligence items |
| `analyses` | Analysis, Diagnosis | Stored analyses and diagnoses |
| `documents` | Documents | User documents |
| `data_files` | Data Center, Google Drive | Uploaded/synced files |
| `advisory_log` | Advisory System | Advisory interaction history |
| `strategy_profiles` | Strategy | AI-generated strategy profiles |
| `progress_cadence` | Advisory | Progress tracking cadence |
| `working_schedules` | Calendar | User work schedules |
| `dismissed_notifications` | Notifications | Dismissed alert records |

---

## 3RD PARTY SERVICES SUMMARY

| Service | Used For | Auth Method | Key Env Vars |
|---------|----------|-------------|--------------|
| **Supabase** | Database (PostgreSQL), Authentication, Real-time | Service Role Key | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **OpenAI GPT-4o** | All AI features (chat, analysis, calibration, email analysis, SOP generation, board room) | API Key via Emergent | `OPENAI_API_KEY`, `EMERGENT_LLM_KEY` |
| **OpenAI Realtime** | Voice Chat (WebRTC speech-to-speech) | API Key | `OPENAI_API_KEY` |
| **Merge.dev** | Unified CRM (HubSpot) + Accounting (Xero) integration | API Key | `MERGE_API_KEY`, `MERGE_WEBHOOK_SECRET` |
| **Microsoft Graph** | Outlook email sync, Calendar | OAuth 2.0 | `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID` |
| **Google OAuth** | Gmail, Google Drive | OAuth 2.0 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| **SerpAPI / Serper** | Web search for market analysis | API Key | `SERPAPI_API_KEY`, `SERPER_API_KEY` |

---

## NAVIGATION STRUCTURE (Sidebar)

```
INTELLIGENCE
├── BIQc Insights        → /advisor           (AdvisorWatchtower.js)
├── Strategic Console    → /war-room          (WarRoomConsole.js)
├── Board Room           → /board-room        (BoardRoom.js)
├── Operator View        → /operator          (OperatorDashboard.js)
└── SoundBoard           → /soundboard        (MySoundBoard.js)

CONFIGURATION
├── Intelligence Baseline → /intelligence-baseline  (IntelligenceBaseline.js)
├── Business DNA          → /business-profile       (BusinessProfile.js)
├── Integrations          → /integrations           (Integrations.js)
├── Email                 → /connect-email          (ConnectEmail.js)
└── Calendar              → /calendar               (CalendarView.js)

SETTINGS
└── Settings              → /settings               (Settings.js)
```
