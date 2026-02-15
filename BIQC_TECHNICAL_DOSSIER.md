# BIQC STRATEGIC TECHNICAL DOSSIER
## Galaxy-Scale Infrastructure Audit — February 2026
### Classification: INTERNAL — Supreme Systems Architect Eyes Only

---

# 1. THE EXECUTIVE TOPOLOGY

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           BIQC PLATFORM TOPOLOGY                                │
│                                                                                 │
│  ┌──────────────── LOCAL SOVEREIGNTY (K8s Pod) ────────────────────────┐        │
│  │                                                                     │        │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────┐  │        │
│  │  │   FRONTEND       │  │   BACKEND        │  │   MONGODB          │  │        │
│  │  │   React/CRA      │  │   FastAPI/Uvicorn│  │   (Legacy/Idle)    │  │        │
│  │  │   Port 3000      │  │   Port 8001      │  │   Port 27017       │  │        │
│  │  │   829 lines      │  │   10,218 lines   │  │   0 active queries │  │        │
│  │  │   (CalAdvisor)   │  │   (server.py)    │  │                    │  │        │
│  │  └────────┬─────────┘  └────────┬─────────┘  └────────────────────┘  │        │
│  │           │                      │                                    │        │
│  │  ┌────────┴──────────────────────┴────────────────────────────────┐  │        │
│  │  │              SUPERVISOR (Process Manager)                       │  │        │
│  │  │  + email_sync_worker.py    (60s polling loop)                   │  │        │
│  │  │  + intelligence_worker.py  (86400s / daily scan)                │  │        │
│  │  └────────────────────────────────────────────────────────────────┘  │        │
│  └──────────────────────────────┬──────────────────────────────────────┘        │
│                                 │                                                │
│                    ─────────────┼─────────────── THE TETHER ──────────           │
│                                 │                                                │
│  ┌──────────────── CLOUD DEPENDENCIES ─────────────────────────────────┐        │
│  │                                                                     │        │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────┐  │        │
│  │  │  SUPABASE        │  │  OPENAI          │  │  MERGE.DEV         │  │        │
│  │  │  - PostgreSQL DB │  │  - GPT-4o (Chat) │  │  - CRM Integration │  │        │
│  │  │  - Auth (OAuth)  │  │  - Realtime Voice│  │  - File Storage    │  │        │
│  │  │  - Edge Functions│  │                   │  │  - Google Drive    │  │        │
│  │  │  - Row-Level Sec │  │                   │  │                    │  │        │
│  │  └─────────────────┘  └─────────────────┘  └────────────────────┘  │        │
│  │                                                                     │        │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────┐  │        │
│  │  │  SERPER.DEV      │  │  MICROSOFT AZURE │  │  GOOGLE CLOUD      │  │        │
│  │  │  - Web Search    │  │  - Outlook OAuth  │  │  - Gmail OAuth     │  │        │
│  │  │  - Google SERP   │  │  - Calendar Sync  │  │  - Calendar Sync   │  │        │
│  │  └─────────────────┘  └─────────────────┘  └────────────────────┘  │        │
│  └─────────────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 1.1 Local Sovereignty — What Lives on the Pod

| Process | Type | What It Does | Stateful? |
|---------|------|-------------|-----------|
| `server.py` (uvicorn) | HTTP Server | 10,218-line monolith. Handles ALL API routes, auth, AI chat, calibration, integrations. | No local state. All state in Supabase. |
| `email_sync_worker.py` | Background Worker | Polls every 60s for connected email accounts, syncs emails to Supabase. | No. Pure sync loop. |
| `intelligence_worker.py` | Background Worker | Daily scan. Runs cold reads, silence detection, regeneration governance. | No. Pure scan loop. |
| `MongoDB` | Database | **IDLE ZOMBIE.** Running on port 27017 but ZERO queries from application code. Fully migrated to Supabase. | Yes (but unused). |
| **WebSocket connections** | None | **No active WebSocket handlers in server.py.** Voice chat uses OpenAI Realtime SDK. | N/A |
| **Cron jobs** | None built-in | Workers function as pseudo-crons via `asyncio.sleep()` loops. | N/A |
| **Local temp files** | None | No `tempfile`, no `/tmp/` writes, no local disk storage. All file uploads go to Supabase. | N/A |

## 1.2 External Dependencies — The Cloud

| Service | Auth Method | Protocol | Used By |
|---------|------------|----------|---------|
| **Supabase PostgreSQL** | `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) | REST API (`supabase-py` SDK) | Everything. 44 tables. |
| **Supabase Auth** | `SUPABASE_ANON_KEY` + OAuth providers | REST API | Frontend (Google/Azure login) |
| **Supabase Edge Functions** | `SUPABASE_ANON_KEY` / `Bearer` token | HTTPS POST | 4 functions (see below) |
| **OpenAI GPT-4o** | `OPENAI_API_KEY` via `emergentintegrations` | REST API (SDK wrapper) | Chat, SOP gen, diagnosis, email analysis, boardroom |
| **OpenAI Realtime** | `OPENAI_API_KEY` via `OpenAIChatRealtime` | WebSocket (server-to-OpenAI) | Voice chat feature |
| **Serper.dev** | `SERPER_API_KEY` (header) | HTTPS POST | Web search for business autofill |
| **Merge.dev** | `MERGE_API_KEY` (header) | HTTPS POST | CRM (HubSpot, etc.), Google Drive, file storage |
| **Microsoft Azure AD** | `AZURE_CLIENT_ID` + `AZURE_CLIENT_SECRET` | OAuth2 Code Flow | Outlook email + calendar sync |
| **Google Cloud** | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | OAuth2 Code Flow | Gmail + Google Calendar sync |

### Supabase Edge Functions Called

| Function | Called From | Purpose |
|----------|-----------|---------|
| `calibration-psych` | Frontend (CalibrationAdvisor.js) | AI-driven calibration interview |
| `intelligence-snapshot` | Backend (server.py L2291) + Frontend (AdvisorWatchtower.js) | Generate executive intelligence memo |
| `gmail_prod` | Backend (server.py L3921) + Frontend (Integrations.js) | Gmail OAuth token exchange |
| `outlook-auth` | Backend (server.py L4118) | Outlook OAuth token processing |
| `email_priority` | Frontend (EmailInbox.js) | Email prioritization analysis |

## 1.3 The Tether — How Local Talks to Cloud

| Connection Type | Source → Target | Details |
|----------------|----------------|---------|
| **REST API (supabase-py)** | Backend → Supabase | ALL database reads/writes. Uses `supabase_admin` client with Service Role Key. No raw SQL — all via SDK query builder. |
| **HTTPS POST** | Backend → OpenAI | Via `emergentintegrations` LlmChat wrapper. Model: `gpt-4o`. |
| **HTTPS POST** | Backend → Serper.dev | For Google web search (business enrichment). |
| **HTTPS POST** | Backend → Merge.dev | For CRM and file storage integrations. |
| **OAuth2 Redirect Flow** | Browser → Azure/Google → Backend → Supabase | Multi-hop auth for Outlook/Gmail. Backend acts as relay. |
| **Direct HTTPS** | Frontend → Supabase Edge Functions | CalibrationAdvisor.js calls `calibration-psych` directly (bypasses backend). |
| **Direct HTTPS** | Frontend → Supabase Auth | Login/signup/OAuth via `@supabase/supabase-js` SDK. |

---

# 2. THE MONOLITH INVENTORY — `server.py` Deep Scan

## 2.1 Vital Statistics

| Metric | Value |
|--------|-------|
| Total Lines | **10,218** |
| Total Route Handlers | **~95** (server.py) + **~18** (route modules) = **~113** |
| Total Helper Functions | **191** |
| Total Pydantic Models | **~25** |
| Hardcoded AI Prompts | **12+** (see Section 2.3) |
| Module-Level Init Calls | **9** (executed at import time) |
| File Size | **416 KB** |

## 2.2 Route Logic Map — Grouped by Function

### AUTH & SESSION (7 routes)
| Line | Method | Endpoint | Auth? | Notes |
|------|--------|----------|-------|-------|
| 2416 | POST | `/api/auth/supabase/signup` | No | Supabase auth proxy |
| 2423 | POST | `/api/auth/supabase/login` | No | Supabase auth proxy |
| 2430 | GET | `/api/auth/supabase/oauth/{provider}` | No | OAuth redirect |
| 2437 | GET | `/api/auth/supabase/me` | Yes | Get current user |
| 2447 | GET | `/api/auth/check-profile` | Yes | Profile existence check |
| 3649 | GET | `/api/auth/outlook/login` | No | Outlook OAuth init |
| 3727 | GET | `/api/auth/gmail/login` | No | Gmail OAuth init |

### CALIBRATION LOGIC (7 routes)
| Line | Method | Endpoint | Auth? | Notes |
|------|--------|----------|-------|-------|
| 2499 | GET | `/api/calibration/status` | **NO** | **UNPROTECTED** — returns user calibration state |
| 2559 | POST | `/api/calibration/defer` | Yes | Skip calibration |
| 2615 | POST | `/api/calibration/reset` | Yes | Reset calibration progress |
| 2887 | POST | `/api/calibration/init` | **NO** | **UNPROTECTED** — initializes session |
| 2922 | POST | `/api/calibration/answer` | Yes | Submit calibration answer |
| 3388 | GET | `/api/calibration/activation` | Yes | Check activation state |
| 3439 | POST | `/api/calibration/brain` | **NO** | **UNPROTECTED** — sends messages to AI brain |

### EMAIL & CALENDAR (14 routes)
| Line | Method | Endpoint | Auth? | Notes |
|------|--------|----------|-------|-------|
| 3809 | GET | `/api/auth/gmail/callback` | No | OAuth callback (expected) |
| 3957 | GET | `/api/gmail/status` | Yes | Gmail connection status |
| 3988 | POST | `/api/gmail/disconnect` | Yes | Disconnect Gmail |
| 4006 | GET | `/api/auth/outlook/callback` | No | OAuth callback (expected) |
| 4193 | GET | `/api/outlook/emails/sync` | Yes | Trigger email sync |
| 4319 | POST | `/api/outlook/comprehensive-sync` | Yes | Full email + calendar sync |
| 4630 | GET | `/api/outlook/sync-status/{job_id}` | Yes | Sync job status |
| 4641 | GET | `/api/outlook/intelligence` | Yes | Email intelligence data |
| 4722 | GET | `/api/outlook/status` | Yes | Outlook connection status |
| 4811 | GET | `/api/outlook/debug-tokens` | Yes | Debug only |
| 4861 | POST | `/api/outlook/disconnect` | Yes | Disconnect Outlook |
| 4906 | GET | `/api/outlook/calendar/events` | Yes | Get calendar events |
| 4989 | POST | `/api/outlook/calendar/sync` | Yes | Sync calendar |
| 5029 | POST | `/api/email/analyze-priority` | Yes | AI email prioritization |

### INTELLIGENCE / AI (12 routes)
| Line | Method | Endpoint | Auth? | Notes |
|------|--------|----------|-------|-------|
| 5150 | POST | `/api/email/suggest-reply/{email_id}` | Yes | AI-generated email reply |
| 5314 | GET | `/api/email/priority-inbox` | Yes | Prioritized email view |
| 5491 | POST | `/api/soundboard/chat` | Yes | AI thinking partner |
| 5760 | GET | `/api/cognitive/profile` | Yes | User's cognitive profile |
| 5770 | POST | `/api/cognitive/sync-business-profile` | Yes | Sync business profile to cognitive |
| 5824 | GET | `/api/cognitive/escalation` | Yes | Escalation state |
| 5844 | POST | `/api/cognitive/observe` | Yes | Log observation event |
| 5882 | GET | `/api/advisory/confidence` | Yes | Advisory confidence score |
| 6542 | POST | `/api/chat` | Yes | Main AI chat |
| 9602 | POST | `/api/intelligence/cold-read` | Yes | Watchtower cold read |
| 9680 | POST | `/api/intelligence/ingest` | Yes | Intelligence ingestion pipeline |
| 9733 | GET | `/api/executive-mirror` | **NO** | **UNPROTECTED** — executive dashboard data |

### BUSINESS PROFILE & CONTEXT (10 routes)
| Line | Method | Endpoint | Auth? | Notes |
|------|--------|----------|-------|-------|
| 6487 | GET | `/api/business-profile/context` | Yes | Full business context |
| 7004 | GET | `/api/business-profile` | Yes | Get profile |
| 7017 | GET | `/api/business-profile/versioned` | Yes | Versioned profile |
| 7028 | GET | `/api/business-profile/history` | Yes | Profile history |
| 7044 | POST | `/api/business-profile/request-update` | Yes | Request AI update |
| 7104 | POST | `/api/business-profile/autofill` | Yes | AI autofill from URL |
| 7208 | POST | `/api/business-profile/build` | Yes | AI profile builder |
| 7368 | PUT | `/api/business-profile` | Yes | Update profile |
| 8714 | GET | `/api/business-profile/scores` | Yes | Profile strength scores |
| 6440 | POST | `/api/website/enrich` | Yes | Website enrichment |

### DATA MANAGEMENT (7 routes)
| Line | Method | Endpoint | Auth? | Notes |
|------|--------|----------|-------|-------|
| 7425 | POST | `/api/data-center/upload` | **NO** | **UNPROTECTED** — file upload! |
| 7474 | GET | `/api/data-center/files` | Yes | List files |
| 7487 | GET | `/api/data-center/files/{file_id}` | Yes | Get file |
| 7498 | GET | `/api/data-center/files/{file_id}/download` | Yes | Download file |
| 7514 | DELETE | `/api/data-center/files/{file_id}` | Yes | Delete file |
| 7522 | GET | `/api/data-center/categories` | Yes | File categories |
| 7536 | GET | `/api/data-center/stats` | Yes | Data center stats |

### INTEGRATIONS (Merge.dev / Google Drive) (10 routes)
| Line | Method | Endpoint | Auth? | Notes |
|------|--------|----------|-------|-------|
| 9070 | POST | `/api/integrations/merge/link-token` | Yes | Create Merge link |
| 9146 | POST | `/api/integrations/merge/exchange-account-token` | Yes | Exchange token |
| 9280 | POST | `/api/merge/disconnect` | Yes | Disconnect integration |
| 9299 | GET | `/api/integrations/merge/connected` | Yes | List connected integrations |
| 9359 | GET | `/api/integrations/crm/contacts` | Yes | CRM contacts |
| 9419 | GET | `/api/integrations/crm/companies` | Yes | CRM companies |
| 9471 | GET | `/api/integrations/crm/deals` | Yes | CRM deals |
| 9523 | GET | `/api/integrations/crm/owners` | Yes | CRM owners |
| 9915 | POST | `/api/integrations/google-drive/connect` | Yes | Connect Drive |
| 10173 | GET | `/api/integrations/google-drive/status` | Yes | Drive connection status |

### GENERATION TOOLS (4 routes)
| Line | Method | Endpoint | Auth? | Notes |
|------|--------|----------|-------|-------|
| 6807 | POST | `/api/generate/sop` | Yes | AI SOP generation |
| 6878 | POST | `/api/generate/checklist` | Yes | AI checklist generation |
| 6905 | POST | `/api/generate/action-plan` | Yes | AI action plan |
| 6935 | POST | `/api/diagnose` | Yes | Business diagnosis |

### Extracted Route Modules (in `/routes/`)

| File | Lines | Routes | Purpose |
|------|-------|--------|---------|
| `admin.py` | 96 | 5 | Admin backfill, user management |
| `boardroom.py` | 229 | 2 | AI Board Room responses, escalation actions |
| `facts.py` | 25 | 2 | Fact resolution and confirmation |
| `intelligence.py` | 89 | 6 | Emission, snapshot, baseline management |
| `research.py` | 364 | 1 | Website analysis (live scrape + LLM synthesis) |
| `watchtower.py` | 62 | 4 | Watchtower emit, analyse, positions, findings |

## 2.3 The Brain — Hardcoded AI Prompts

| Prompt ID | Location | Lines | Identity | Purpose |
|-----------|----------|-------|----------|---------|
| `WATCHTOWER_BRAIN_PROMPT` | server.py L366-404 | 38 | "BIQc-02, Senior Strategic Architect" | 17-Point Strategic Map extraction during calibration |
| `SOUNDBOARD_SYSTEM_PROMPT` | server.py L5332-5453 | 121 | "MySoundBoard" | Listening-first intelligence, thinking partner |
| `get_system_prompt()` | server.py L1136-1584 | 448 | "MyAdvisor" / "MyIntel" / "Chief of Strategy" | Main chat, proactive advisory, analysis context |
| `BOARDROOM_IDENTITY` | boardroom_prompt.py | 400 | "BIQC BOARD ROOM" | Strategic authority interface |
| `BIQC_CONSTITUTION_PROMPT` | biqc_constitution_prompt.py | 137 | "BIQC" | Core AI identity and behavioral constitution |
| Email Priority Prompt | server.py L5059 | ~40 | "Strategic business advisor" | Email analysis and prioritization |
| Email Reply Prompt | server.py L5215 | ~50 | "BIQC, trusted strategic advisor" | Email reply generation |
| Calibration Fail-Safe | server.py L3410 | ~20 | "Emergent Advisor" (fail-safe mode) | Backup when Edge Function fails |
| Profile Autofill | server.py L7127 | ~30 | "Business analyst" | Autofill business profile from website |
| Profile Build | server.py L7275 | ~30 | "Profile builder" | Structured profile construction |
| OAC Prompt | server.py L8244 | ~30 | "Ops Advisory Centre" | Operational recommendations |
| Elite Mentor | server.py L8027 | ~30 | "ELITE AI Business Mentor" | Deep business mentoring |

## 2.4 Dead Weight — Zombie Code

### Backend: Zombie Files (loaded into memory but never used)

| File | Lines | Problem |
|------|-------|---------|
| `cognitive_core.py` | 1,163 | **MongoDB version.** Fully superseded by `cognitive_core_supabase.py` (413 lines). Still imports `motor`. |
| `cognitive_core_mongodb_backup.py` | 1,163 | Identical backup of the MongoDB version. Pure dead weight. |
| `mongodb_removal_patch.py` | — | Migration utility. No longer needed. |
| `check_mongodb_data.py` | — | Diagnostic script. No longer needed. |
| `cleanup_mongodb.py` | — | Cleanup script. No longer needed. |
| `migrate_emails_to_supabase.py` | — | One-time migration. No longer needed. |
| `check_supabase_user.py` | — | Diagnostic script. No longer needed. |
| `list_users.py` | — | Standalone script using MongoDB directly. |

### Frontend: Zombie Files

| File | Lines | Problem |
|------|-------|---------|
| `IntegrationsOld.js` | 1,386 | Complete copy of old Integrations page. Still in bundle. |
| `BusinessProfile.old.js` | 1,097 | Complete copy of old BusinessProfile. Still in bundle. |
| `Analysis.backup.js` | — | Backup file. Still in bundle. |
| `MarketAnalysis.backup.js` | — | Backup file. Still in bundle. |
| `Landing_WORLDCLASS_BACKUP.js` | — | Backup file. Still in bundle. |
| `Landing.js.backup` | — | Backup file (not .js extension, likely NOT in bundle). |

### MongoDB: Running but IDLE

The MongoDB process consumes system resources on every pod but **zero application code queries it**. The entire data layer was migrated to Supabase. `motor==3.3.1` and `pymongo==4.5.0` remain in `requirements.txt` because `emergentintegrations` or other deps might reference them, but no BIQc code uses them.

## 2.5 Module-Level Initialization Chain (Startup Bottleneck)

These execute **sequentially at import time** before any request can be served:

```
1. init_supabase()             → Supabase client + SDK integrity check (network call)
2. init_cognitive_core()       → CognitiveCore class instantiation
3. init_watchtower_store()     → WatchtowerStore class instantiation
4. init_watchtower_engine()    → WatchtowerEngine class instantiation
5. init_emission_layer()       → Merge client + EmissionLayer (try/except, non-fatal)
6. init_escalation_memory()    → EscalationMemory class instantiation
7. init_contradiction_engine() → ContradictionEngine class instantiation
8. init_snapshot_agent()       → SnapshotAgent class instantiation
9. init_pressure_calibration() → PressureCalibration class instantiation
10. init_intelligence_baseline()→ IntelligenceBaseline class instantiation
11. init_evidence_freshness()  → EvidenceFreshness class instantiation
12. init_route_deps()          → Makes supabase_admin available to route modules
```

---

# 3. THE FRONTEND SPRAWL

## 3.1 CalibrationAdvisor.js — State Dependency Audit

**File size:** 829 lines | **State variables:** 26 `useState` + 3 `useRef`

| Variable | Type | Purpose | Business Logic in Browser? |
|----------|------|---------|---------------------------|
| `entry` | string | 3-state router: `"loading"`, `"welcome"`, `"continuity"`, `"ready"` | **YES** — routing logic based on `calStep` |
| `calStep` | int | Current calibration step (0-9) | **YES** — step progression logic |
| `calMode` | string | `"wizard"` or `"chat"` | **YES** — UI mode decision |
| `currentStep` | int | Redundant with `calStep` | Potential conflict |
| `analyzePhase` | int | 0-5 animation phases for URL analysis | No (UI animation) |
| `wowSummary` | object | Parsed audit summary for inline editing | Data display |
| `question`, `options`, `allowText`, `insight`, `isProbe` | mixed | Wizard-mode question rendering | **YES** — parses Edge Function response |
| `editedFields`, `editingKey`, `editValue` | mixed | Inline editing state | No (UI state) |
| `completing`, `revealPhase`, `transitioning` | bool/int | Animation states | No (UI animation) |
| `messages`, `inputValue` | array/string | Chat-mode conversation | Data display |
| `isSubmitting`, `error` | bool/string | Loading/error states | No (UX state) |

**Verdict:** The component contains significant **routing and progression logic** (`entry` state machine, step counting, response parsing) that should be server-authoritative. The Edge Function should dictate the next step, not the browser.

## 3.2 API Call Map — Frontend to Backend

### Calls to **server.py** (Local Backend via `/api`)

| Page | Endpoint | Method | Purpose |
|------|----------|--------|---------|
| SupabaseAuthContext.js | `/api/auth/supabase/me` | GET | Verify session |
| SupabaseAuthContext.js | `/api/calibration/status` | GET | Check calibration state |
| SupabaseAuthContext.js | `/api/onboarding/status` | GET | Check onboarding state |
| Advisor.js | `/api/chat` | POST | Main AI chat |
| BusinessProfile.js | `/api/business-profile` | GET/PUT | Read/update profile |
| Settings.js | `/api/business-profile` | GET/PUT | Read/update profile |
| Integrations.js | `/api/integrations/merge/*` | POST/GET | Merge.dev integration |
| ConnectEmail.js | `/api/auth/outlook/login` | GET | Outlook OAuth |
| EmailInbox.js | `/api/outlook/emails/sync` | GET | Email sync |
| DataCenter.js | `/api/data-center/*` | Various | File management |

### Calls **DIRECTLY to Supabase** (Bypass Backend)

| Page | Target | Purpose |
|------|--------|---------|
| **CalibrationAdvisor.js** | `functions/v1/calibration-psych` | Calibration AI (Edge Function) |
| **AdvisorWatchtower.js** | `functions/v1/intelligence-snapshot` | Intelligence memo generation |
| **EmailInbox.js** | `functions/v1/email_priority` | Email prioritization |
| **Integrations.js** | `functions/v1/gmail_prod` | Gmail token exchange |
| **GmailTest.js** | `functions/v1/gmail_prod` | Gmail test |
| **SupabaseAuthContext.js** | `supabase.auth.*` | All auth operations |

**Critical Observation:** The frontend has a **dual communication path** — some calls go through the backend proxy, others go directly to Supabase. This creates **two authentication surfaces** and makes it impossible to audit all traffic through a single gateway.

## 3.3 Frontend Page Inventory — Active vs Dead

| Page | Lines | Routed? | Status |
|------|-------|---------|--------|
| CalibrationAdvisor.js | 829 | Yes (`/calibration`) | **Active — NEEDS DECOMPOSITION** |
| IntegrationsOld.js | 1,386 | **No** | **DEAD — Delete** |
| Integrations.js | 1,346 | Yes (`/integrations`) | Active |
| BusinessProfile.old.js | 1,097 | **No** | **DEAD — Delete** |
| CalendarView.js | — | Yes (`/calendar`) | Active |
| ProfileImport.js | 808 | Yes (`/profile-import`) | Active |
| OnboardingWizard.js | 783 | Yes (`/onboarding`) | Active |
| EmailInbox.js | 756 | Yes (`/email-inbox`) | Active |
| DataCenter.js | 607 | Yes (`/data-center`) | Active |
| Settings.js | 579 | Yes (`/settings`) | Active |
| Advisor.js | 576 | Yes (`/advisor-legacy`) | **LEGACY — Legacy route** |
| LandingIntelligent.js | 568 | Yes (`/`) | Active |
| Diagnosis.js | 513 | Yes (`/diagnosis`) | Active |
| BusinessProfile.js | 479 | Yes (`/business-profile`) | Active |
| MySoundBoard.js | 465 | Yes (`/soundboard`) | Active |
| AdvisorWatchtower.js | — | Yes (`/advisor`) | **Active — Primary dashboard** |
| AuthDebug.js | — | Yes (`/auth-debug`) | **DEBUG ONLY — Should be removed in prod** |
| GmailTest.js | — | Yes (`/gmail-test`) | **TEST ONLY — Should be removed in prod** |
| OutlookTest.js | — | Yes (`/outlook-test`) | **TEST ONLY — Should be removed in prod** |

---

# 4. SECURITY POSTURE

## 4.1 Unprotected Endpoints (No `get_current_user` Dependency)

| Endpoint | Risk Level | Assessment |
|----------|-----------|------------|
| `/api/auth/supabase/signup` | Low | Expected — public registration |
| `/api/auth/supabase/login` | Low | Expected — public login |
| `/api/auth/supabase/oauth/{provider}` | Low | Expected — OAuth redirect |
| `/api/auth/outlook/login` | Low | Expected — OAuth init |
| `/api/auth/gmail/login` | Low | Expected — OAuth init |
| `/api/auth/gmail/callback` | Low | Expected — OAuth callback |
| `/api/auth/outlook/callback` | Low | Expected — OAuth callback |
| `/api/account/users/accept` | Medium | Invite acceptance — uses token validation instead |
| `/api/calibration/status` | **HIGH** | Returns user calibration state without auth |
| `/api/calibration/init` | **HIGH** | Initializes calibration session without auth |
| `/api/calibration/brain` | **CRITICAL** | Sends messages to AI without auth — potential abuse vector |
| `/api/data-center/upload` | **CRITICAL** | File upload without auth — storage abuse risk |
| `/api/executive-mirror` | **HIGH** | Returns business intelligence data without auth |
| `/api/` | Low | Root info endpoint |
| `/api/health` | Low | Health check |

## 4.2 Secret Management

| Secret | Source | Hard-fail if Missing? |
|--------|--------|----------------------|
| `JWT_SECRET_KEY` | `os.environ['JWT_SECRET_KEY']` | **YES — crashes server** |
| `SUPABASE_URL` | `os.environ.get(...)` | YES — init_supabase returns None |
| `SUPABASE_SERVICE_ROLE_KEY` | `os.environ.get(...)` | YES — init_supabase returns None |
| `OPENAI_API_KEY` | `os.environ.get(...)` | No — AI features degrade gracefully |
| `SERPER_API_KEY` | `os.environ.get(...)` | No — search returns empty |
| `MERGE_API_KEY` | `os.environ.get(...)` | No — integrations disabled |
| `GOOGLE_CLIENT_ID/SECRET` | `os.environ.get(...)` | No — Google OAuth unavailable |
| `AZURE_CLIENT_ID/SECRET` | `os.environ.get(...)` | No — Azure OAuth unavailable |
| `BACKEND_URL` | `os.environ.get(...)` w/ default | No — falls back to localhost |
| `FRONTEND_URL` | `os.environ.get(...)` w/ default | No — falls back to localhost |

**Risk:** `JWT_SECRET_KEY` is the only hard-fail. If missing at startup, the entire server crashes at line 208 (`os.environ['JWT_SECRET_KEY']`) AND line 263 (SessionMiddleware).

## 4.3 Dependency Supply Chain

### Python (149 packages, `requirements.txt`)

| Category | Packages | Risk |
|----------|----------|------|
| **Core Framework** | fastapi, uvicorn, starlette, pydantic | Low |
| **Supabase SDK** | supabase, postgrest, supabase-auth, supabase-functions, realtime, storage3 | Low |
| **AI/LLM** | openai, emergentintegrations, litellm, tiktoken, google-genai | Medium (heavy, version-sensitive) |
| **Auth** | Authlib, PyJWT, bcrypt, python-jose, msal, cryptography | Low |
| **ML/Data (UNUSED)** | numpy, pandas, huggingface_hub, hf-xet, pyiceberg, tokenizers | **HIGH — bloat** |
| **MongoDB (UNUSED)** | motor, pymongo | **Medium — dead dependency** |
| **Document Parsing** | PyPDF2, python-docx, openpyxl, beautifulsoup4, lxml | Low |

**Bloat Assessment:** `numpy`, `pandas`, `huggingface_hub`, `hf-xet`, `pyiceberg`, `tokenizers`, `pillow`, `motor`, `pymongo` are **NOT directly imported by any BIQc application code**. They are transitive dependencies of `emergentintegrations` and `litellm`. Combined, they add ~200MB+ to the container image.

### Node.js (55 production + 12 dev packages)

| Category | Packages | Risk |
|----------|----------|------|
| **React Core** | react, react-dom, react-router-dom, react-scripts | Low |
| **UI** | 20+ @radix-ui packages, lucide-react, tailwindcss, class-variance-authority | Low |
| **Supabase** | @supabase/supabase-js | Low |
| **Merge.dev** | @mergeapi/react-merge-link | Low |
| **Charts** | recharts | Low |
| **Unused?** | next-themes (no Next.js), @react-oauth/google (using Supabase OAuth instead) | **Medium — potential dead deps** |

## 4.4 Raw SQL / Injection Risk

**No raw SQL detected.** All database queries use the Supabase Python SDK query builder (`supabase_admin.table("x").select("y").eq("z", val).execute()`). This provides parameterized queries by default.

**However:** The `research.py` route uses `httpx` with `verify=False` (line 229), which disables SSL certificate verification for website scraping. This is a known security trade-off for scraping but should be noted.

---

# 5. THE MIGRATION RISK LOG

## What Breaks If You Turn Off `server.py` Tomorrow?

### IMMEDIATE FAILURES (Red)

| Feature | Why It Breaks | Data Lost? |
|---------|---------------|------------|
| **All AI Chat** | GPT-4o calls go through server.py | No (history in Supabase) |
| **Email OAuth** | Outlook/Gmail OAuth callbacks hit server.py | No |
| **Email Sync** | `email_sync_worker.py` dies with the pod | No (can restart) |
| **Intelligence Generation** | `intelligence_worker.py` dies with the pod | No (can restart) |
| **Calibration Answer Processing** | `/api/calibration/answer` writes to Supabase | No |
| **Business Profile CRUD** | All profile reads/writes go through server.py | No |
| **File Upload/Download** | Data center uses server.py | No |
| **SOP/Checklist/Action Plan Generation** | AI generation endpoints | No |
| **Board Room** | Strategic analysis via routes/boardroom.py | No |
| **CRM Integration** | Merge.dev proxy calls | No |

### UNAFFECTED (Green)

| Feature | Why It Survives | Notes |
|---------|----------------|-------|
| **Calibration AI Interview** | Frontend calls Supabase Edge Function `calibration-psych` directly | Already decoupled |
| **Intelligence Snapshot Generation** | Frontend calls Edge Function `intelligence-snapshot` directly | Already decoupled |
| **Email Priority Analysis** | Frontend calls Edge Function `email_priority` directly | Already decoupled |
| **User Authentication** | Frontend uses `@supabase/supabase-js` directly | Already decoupled |
| **All Stored Data** | Lives in Supabase PostgreSQL | Survives any local outage |

### MIGRATION CANDIDATES — Functions That Can Move to Edge Functions

| Current Location | Candidate for Edge Function | Complexity |
|-----------------|---------------------------|------------|
| `/api/chat` (server.py L6542) | `chat-advisor` Edge Function | Medium (needs context gathering) |
| `/api/soundboard/chat` (server.py L5491) | `soundboard` Edge Function | Low (self-contained) |
| `/api/calibration/answer` (server.py L2922) | Extend `calibration-psych` | Medium |
| `/api/business-profile/autofill` (server.py L7104) | `profile-autofill` Edge Function | Low |
| `/api/generate/sop` (server.py L6807) | `generate-sop` Edge Function | Low |
| `/api/diagnose` (server.py L6935) | `diagnose` Edge Function | Low |
| `/api/intelligence/cold-read` (server.py L9602) | `cold-read` Edge Function | High (many dependencies) |

### FUNCTIONS THAT MUST STAY SERVER-SIDE

| Function | Why |
|----------|-----|
| **OAuth Callback Handlers** | Require server-side secret handling and redirect flow |
| **Email Sync Worker** | Long-running background process, not request-response |
| **Intelligence Worker** | Long-running background process |
| **Merge.dev Integration** | Requires server-side API key and webhook handling |
| **File Upload Processing** | May need server-side document parsing (PyPDF2, docx) |

---

## APPENDIX A: Supabase Table Inventory (44 Tables)

```
accounts                    intelligence_baseline      outlook_sync_jobs
advisory_log                intelligence_priorities     progress_cadence
analyses                    intelligence_snapshots      settings
business_profiles           invites                     sops
business_profiles_versioned m365_tokens                 soundboard_conversations
calendar_intelligence       merge_integrations          strategy_profiles
calibration_schedules       oac_recommendations         user_operator_profile
calibration_sessions        oac_usage                   users
chat_history                observation_events          watchtower_events
cognitive_profiles          onboarding                  watchtower_insights
data_files                  outlook_calendar_events     web_sources
diagnoses                   outlook_emails              working_schedules
dismissed_notifications     outlook_oauth_tokens
documents                   gmail_connections
email_intelligence          google_drive_files
email_priority_analysis     integration_accounts
```

## APPENDIX B: Environment Variables Master List (28 Secrets)

```
SUPABASE_URL                 GOOGLE_CLIENT_ID          MERGE_API_KEY
SUPABASE_SERVICE_ROLE_KEY    GOOGLE_CLIENT_SECRET      MERGE_REDIRECT_URI
SUPABASE_ANON_KEY            AZURE_CLIENT_ID           MERGE_WEBHOOK_SECRET
REACT_APP_SUPABASE_URL       AZURE_CLIENT_SECRET       CORS_ORIGINS
REACT_APP_SUPABASE_ANON_KEY  AZURE_TENANT_ID           WDS_SOCKET_PORT
REACT_APP_BACKEND_URL        AZURE_TENANT_URL          ENABLE_HEALTH_CHECK
REACT_APP_GOOGLE_CLIENT_ID   SERPER_API_KEY            DB_NAME
JWT_SECRET_KEY               SERPAPI_API_KEY            MONGO_URL
OPENAI_API_KEY               BACKEND_URL
EMERGENT_LLM_KEY             FRONTEND_URL
```

## APPENDIX C: File Size Heatmap (Backend)

```
416 KB  server.py                    ██████████████████████████████ (THE MONOLITH)
 56 KB  cognitive_core.py            ████ (ZOMBIE — MongoDB version)
 56 KB  cognitive_core_mongodb_backup ████ (ZOMBIE — Backup of zombie)
 32 KB  merge_emission_layer.py      ███
 28 KB  truth_engine_rpc.py          ██
 24 KB  watchtower_engine.py         ██
 24 KB  truth_engine.py              ██
 20 KB  cognitive_core_supabase.py   █ (ACTIVE replacement)
 20 KB  boardroom_prompt.py          █
 20 KB  auth_supabase.py             █
```

---

*Dossier compiled: February 2026*
*Classification: INTERNAL — Strategic Architecture Planning*
*Status: Ready for Decoupling Phase 1*
