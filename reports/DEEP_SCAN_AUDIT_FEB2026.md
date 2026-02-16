# BIQc Forensic Architecture Audit — Deep-Scan Report
## Date: February 2026

---

## 1. CALIBRATION & OAuth AUDIT ("The Handshake")

### 1.1 OAuth Scopes — Complete Registry

| Provider | Scopes Requested | Purpose |
|----------|-----------------|---------|
| **Microsoft Outlook** | `offline_access` | Persistent refresh token |
| | `User.Read` | Microsoft profile (email, name) |
| | `Mail.Read` | Full email body access |
| | `Mail.ReadBasic` | Email metadata (from, subject, date) |
| | `Calendars.Read` | Full calendar event access |
| | `Calendars.ReadBasic` | Calendar metadata |
| **Google Gmail** | `openid` | OpenID Connect auth |
| | `email` | Google email address |
| | `profile` | Google profile info |
| | `googleapis.com/auth/gmail.readonly` | Read-only Gmail access |

**Gap Identified:** Gmail does NOT request `googleapis.com/auth/calendar.readonly` — Calendar integration is **Outlook-only**.

### 1.2 Token Management — Storage Architecture

**Current State: HYBRID (Edge + Legacy SQL)**

```
┌─────────────────────────────────────────────────────────┐
│ TOKEN STORAGE SCHEMA                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  outlook_oauth_tokens (Supabase PostgreSQL + RLS)       │
│  ├── user_id UUID PK → auth.users(id)                  │
│  ├── access_token TEXT                                  │
│  ├── refresh_token TEXT                                 │
│  ├── expires_at TIMESTAMPTZ                             │
│  ├── account_email TEXT                                 │
│  ├── account_name TEXT                                  │
│  ├── provider TEXT ("microsoft")                        │
│  └── updated_at TIMESTAMPTZ                             │
│                                                         │
│  gmail_connections (Supabase PostgreSQL + RLS)          │
│  ├── id UUID PK                                        │
│  ├── user_id UUID → auth.users(id) UNIQUE              │
│  ├── email TEXT                                        │
│  ├── access_token TEXT                                 │
│  ├── refresh_token TEXT                                │
│  ├── token_expiry TIMESTAMPTZ                          │
│  ├── scopes TEXT                                       │
│  └── updated_at TIMESTAMPTZ                             │
│                                                         │
│  m365_tokens (LEGACY — Fallback Only)                  │
│  ├── user_id TEXT PK                                   │
│  ├── access_token TEXT                                 │
│  ├── refresh_token TEXT                                │
│  └── expires_at TEXT                                   │
│                                                         │
│  email_connections (CANONICAL Status Table)             │
│  ├── user_id UUID PK → auth.users(id)                  │
│  ├── provider TEXT ("outlook" | "gmail")                │
│  ├── connected BOOLEAN                                 │
│  ├── connected_email TEXT                              │
│  ├── inbox_type TEXT ("focused"|"standard"|"priority") │
│  ├── connected_at TIMESTAMPTZ                          │
│  └── last_sync_at TIMESTAMPTZ                          │
└─────────────────────────────────────────────────────────┘
```

**Risk:** Tokens stored in PostgreSQL columns, NOT in a Secret Manager/KV Store. Supabase RLS provides access control, but tokens are plaintext in the database. **No at-rest encryption beyond Supabase's disk-level encryption.**

### 1.3 OAuth Flow — Complete Sequence

```
USER CLICKS "CONNECT OUTLOOK"
│
├─1→ Frontend: window.location.assign(
│      /api/auth/outlook/login?token={JWT}&provider=outlook&returnTo=/connect-email
│    )
│
├─2→ Backend (email.py): outlook_login()
│    ├── Validates JWT (decode without verification → get user_id)
│    ├── Builds HMAC-signed state parameter
│    ├── Constructs Microsoft OAuth URL
│    └── Returns 302 Redirect → login.microsoftonline.com
│
├─3→ Microsoft OAuth: User consents
│    └── Redirects → BACKEND_URL/api/auth/outlook/callback?code=...&state=...
│
├─4→ Backend (email.py): outlook_callback()
│    ├── Validates HMAC signature on state
│    ├── Exchanges code for tokens (POST to Microsoft token endpoint)
│    ├── Fetches user info from Microsoft Graph (/v1.0/me)
│    ├── PROXIES to Edge Function: POST /functions/v1/outlook-auth
│    │   └── action: "store_tokens"
│    │       ├── Writes to outlook_oauth_tokens (Edge Function)
│    │       ├── Detects inbox_type via Graph API (/v1.0/me/mailFolders)
│    │       └── Writes to email_connections (CANONICAL)
│    ├── Writes to integration_accounts (workspace-scoped)
│    └── Returns 302 Redirect → FRONTEND_URL/connect-email?outlook_connected=true
│
├─5→ Frontend (ConnectEmail.js):
│    ├── Detects ?outlook_connected=true in URL params
│    ├── Cleans URL via replaceState
│    └── Refreshes connection status via Supabase direct query
│
└─6→ Background Worker (email_sync_worker.py):
     ├── Polls outlook_oauth_tokens every 60 seconds
     ├── Fetches emails from Microsoft Graph API
     └── Stores in outlook_emails table
```

**GMAIL FLOW: Identical pattern substituting:**
- Edge Function: `gmail_prod` instead of `outlook-auth`
- Token table: `gmail_connections` instead of `outlook_oauth_tokens`
- API: Google OAuth2 + Gmail API instead of Microsoft Graph

---

## 2. TECHNICAL SCHEMA & SCHEMA VISIBILITY

### 2.1 Intelligence Module Schemas

#### BIQc Insights (Inevitability Signals)
```sql
-- observation_events: Raw signals from integrations
CREATE TABLE observation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  domain TEXT NOT NULL CHECK (domain IN ('finance','sales','operations','team','market')),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  source TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('info','warning','critical')),
  observed_at TIMESTAMPTZ DEFAULT now()
);

-- watchtower_insights: Persisted judgements (append-only)
CREATE TABLE watchtower_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  domain TEXT CHECK (domain IN ('finance','sales','operations','team','market')),
  position TEXT CHECK (position IN ('STABLE','ELEVATED','DETERIORATING','CRITICAL')),
  previous_position TEXT,
  finding TEXT NOT NULL,
  confidence NUMERIC(4,3) DEFAULT 0.000,
  source_event_ids UUID[] DEFAULT '{}',
  detected_at TIMESTAMPTZ DEFAULT now()
);
```

#### Strategic Console (Decision Windows)
```sql
-- decision_pressure: Indexed by urgency + user
CREATE TABLE decision_pressure (
  -- Stores pressure scores per user
  -- Indexed by user_id + created_at for temporal queries
);

-- escalation_memory: Tracks ignored advice + escalation state
CREATE TABLE escalation_memory (
  -- Escalation level: 0=NORMAL, 1=ELEVATED, 2=CRITICAL
  -- times_repeated tracks how many times advice was ignored
);
```

#### Operator View (Operational Drift)
```sql
-- cognitive_profiles: Per-user intelligence model
-- Stores: decision_velocity, follow_through, avoidance patterns
-- Updated by cognitive_core_supabase.py after every interaction

-- intelligence_baseline: Deviation detection
-- Compares current signals against historical baselines
-- Drift = current_value / baseline_value deviation percentage
```

### 2.2 Edge Function Payloads

#### outlook-auth (Token Storage)
```json
// REQUEST (from backend → Edge Function)
{
  "action": "store_tokens",
  "user_id": "uuid-here",
  "access_token": "EwB...",
  "refresh_token": "M.C...",
  "expires_at": "2026-02-16T17:00:00Z",
  "account_email": "user@company.com",
  "account_name": "John Doe"
}

// RESPONSE
{
  "ok": true,
  "connected": true
}
```

#### email_priority (Live Intelligence)
```json
// RESPONSE (processed email intelligence)
{
  "ok": true,
  "provider": "outlook",
  "high_priority": [
    {
      "email_index": 0,
      "from": "client@example.com",
      "subject": "Urgent: Contract Review",
      "snippet": "Need response by EOD...",
      "reason": "Client escalation with deadline",
      "suggested_action": "Review and respond within 2 hours",
      "received_date": "2026-02-16T10:00:00Z"
    }
  ],
  "medium_priority": [],
  "low_priority": [],
  "strategic_insights": "Client communication frequency has increased 40% this week...",
  "total_analyzed": 50
}
```

---

## 3. THE "BROKEN" INTEGRATION AUDIT

### 3.1 Edge Function Inventory vs Backend Calls

| Edge Function | Deployed | Called From Backend | Status |
|---|---|---|---|
| `outlook-auth` | YES | `routes/email.py:617` | **ACTIVE** — Token storage after OAuth |
| `gmail_prod` | YES | `routes/email.py:420` | **ACTIVE** — Token storage after OAuth |
| `email_priority` | YES | NOT called from backend | **ORPHANED** — Only called from frontend directly |
| `integration-status` | YES | NOT called from backend | **ORPHANED** — Only called from frontend directly |
| `gmail_test` | YES | NOT called | **DEAD CODE** — Superseded by gmail_prod |
| `calibration-psych` | YES (Supabase) | NOT called from backend | **FRONTEND-ONLY** — Called via fetch() in CalibrationAdvisor |
| `intelligence-snapshot` | NOT in repo | `core/cognitive_context.py:26` | **MISSING** — Backend calls it but returns fallback |
| `watchtower-brain` | In repo | NOT called | **UNUSED** — Script exists but never invoked |

### 3.2 State Conflict — Email Edge Function Write-Back

**Critical Finding:** The Edge Functions (`outlook-auth`, `gmail_prod`) use `SUPABASE_SERVICE_ROLE_KEY` which **bypasses RLS**. They CAN write to any table. No state conflict exists at the Edge layer.

**WHERE THE "SILENCE" OCCURS:**

```
Email Sync Worker (email_sync_worker.py)
  └── Reads from: outlook_oauth_tokens
  └── Writes to: outlook_emails
  └── DOES NOT trigger: Watchtower observation_events
  └── DOES NOT call: email_priority Edge Function
  └── DOES NOT update: email_intelligence table

Intelligence Worker (intelligence_automation_worker.py)
  └── Reads from: outlook_emails (if they exist)
  └── Runs: truth_engine → cold_read → watchtower signals
  └── BUT: Only runs every 86,400 seconds (24 HOURS!)
```

**ROOT CAUSE OF SILENCE:** The Intelligence Worker runs on a **24-hour cycle**. Email signals ingested by the Sync Worker sit dormant for up to 24 hours before being processed into Watchtower insights. There is NO real-time event pipeline between email ingestion and intelligence generation.

### 3.3 Functionality Gaps — Menu Items Without Edge Functions

| Menu Item | Route | Backend Endpoint | Edge Function | GAP |
|---|---|---|---|---|
| **BIQc Insights** | /advisor | routes/soundboard.py + ai_core.py | None | **Legacy-only** — All AI runs on FastAPI, not Edge |
| **Strategic Console** | /war-room | routes/watchtower.py | None | **Legacy-only** |
| **Board Room** | /board-room | routes/boardroom.py | None | **Legacy-only** |
| **Operator View** | /operator | routes/profile.py (dashboard) | None | **Legacy-only** |
| **SoundBoard** | /soundboard | routes/soundboard.py | None | **Legacy-only** |
| **Intelligence Baseline** | /intelligence-baseline | routes/intelligence.py | None | **Legacy-only** |
| **Business DNA** | /business-profile | routes/profile.py | None | **Legacy-only** |
| **Integrations** | /integrations | routes/integrations.py | `integration-status` | **PARTIAL** — Status check is Edge, CRUD is Legacy |
| **Email** | /connect-email | routes/email.py | `outlook-auth`, `gmail_prod` | **PARTIAL** — OAuth is Edge, sync is Legacy worker |
| **Calendar** | /calendar | routes/email.py | None | **Legacy-only** — Calendar data from Outlook sync only |

---

## 4. SECRET MANAGEMENT & ENVIRONMENT

### 4.1 Secrets Directory

| Secret | Location | Purpose | Risk |
|---|---|---|---|
| `SUPABASE_URL` | Backend .env + Edge | Database endpoint | Low |
| `SUPABASE_ANON_KEY` | Backend .env + Frontend .env + Edge | Public API key | Low (public by design) |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend .env + Edge | **FULL DB ACCESS — bypasses RLS** | **HIGH** |
| `OPENAI_API_KEY` | Backend .env | GPT-4o API calls | Medium |
| `EMERGENT_LLM_KEY` | Backend .env | Emergent universal LLM key | Medium |
| `JWT_SECRET_KEY` | Backend .env | HMAC signing for OAuth state | Medium |
| `AZURE_CLIENT_ID` | Backend .env + Edge | `5d6e3cbb-cd88-4694-aa19-9b7115666866` | Medium |
| `AZURE_CLIENT_SECRET` | Backend .env + Edge | Microsoft OAuth secret | **HIGH** |
| `GOOGLE_CLIENT_ID` | Backend .env + Frontend .env + Edge | Google OAuth | Medium |
| `GOOGLE_CLIENT_SECRET` | Backend .env + Edge | Google OAuth secret | **HIGH** |
| `MERGE_API_KEY` | Backend .env | Merge.dev unified API | Medium |
| `SERPER_API_KEY` | Backend .env | Web search API | Low |

### 4.2 Encryption Logic

**At Rest:**
- Supabase PostgreSQL: Disk-level encryption (AES-256 via cloud provider)
- OAuth tokens: **Plaintext in PostgreSQL columns** — No application-level encryption
- Business DNA signals: Stored as JSONB in `business_profiles` — same disk encryption
- No field-level encryption on any sensitive column

**In Transit:**
- All API calls: TLS 1.3 (HTTPS enforced)
- SoundBoard cognitive sessions: HTTPS to FastAPI → HTTPS to OpenAI API
- Edge Function calls: HTTPS to Supabase Edge Runtime
- WebSocket (Voice Chat): WSS (encrypted WebSocket) via OpenAI Realtime API

**Gap:** No application-level encryption for tokens or Business DNA. If the `SUPABASE_SERVICE_ROLE_KEY` is compromised, ALL tokens and business data are readable in plaintext.

---

## 5. LOGICAL FLOWCHART

```
┌──────────────────────────────────────────────────────────────────────┐
│                    BIQc INTELLIGENCE PIPELINE                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  USER AUTH                                                           │
│  ├── Supabase Auth (email/password + Google + Microsoft OAuth)       │
│  ├── JWT issued → stored in frontend SupabaseAuthContext             │
│  └── Token refresh: proactive (60s before expiry) + reactive (401)   │
│                                                                      │
│  EDGE INGESTION (What runs at the Edge)                             │
│  ├── outlook-auth: Token storage after OAuth ✅                     │
│  ├── gmail_prod: Token storage after OAuth ✅                       │
│  ├── email_priority: Email triage + AI classification ✅            │
│  ├── integration-status: Connection health check ✅                 │
│  ├── calibration-psych: 9-step persona profiling ✅                 │
│  └── intelligence-snapshot: ❌ MISSING (referenced but not deployed)│
│                                                                      │
│  LEGACY WORKERS (What runs on FastAPI server)                       │
│  ├── email_sync_worker: Polls Graph/Gmail API every 60s             │
│  │   └── Writes to: outlook_emails                                  │
│  └── intelligence_automation_worker: Runs every 24 HOURS            │
│      └── Reads: outlook_emails → Generates: watchtower signals      │
│                                                                      │
│  INTELLIGENCE UI                                                     │
│  ├── BIQc Insights: ai_core.py → GPT-4o → cognitive context        │
│  ├── Strategic Console: watchtower_events → real-time display       │
│  ├── Operator View: dashboard stats + focus insights                │
│  ├── SoundBoard: GPT-4o conversational AI                           │
│  └── Board Room: Boardroom intelligence signals                     │
│                                                                      │
│  ⚠️  24-HOUR GAP: Email → Intelligence                             │
│  Email syncs every 60s BUT intelligence only processes every 24h    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. RISK MATRIX — Legacy Lag Choking Edge Intelligence

| Risk | Severity | Component | Impact | Fix |
|---|---|---|---|---|
| **24-hour intelligence cycle** | 🔴 CRITICAL | `intelligence_automation_worker.py` | Email signals sit dormant up to 24h before generating insights | Reduce to 1-hour cycle OR trigger on email_sync completion |
| **Missing intelligence-snapshot Edge Function** | 🔴 CRITICAL | `cognitive_context.py:26` | Backend calls it, gets fallback — cognitive context is degraded | Deploy the Edge Function OR move logic to backend |
| **No Gmail Calendar scope** | 🟡 HIGH | `routes/email.py:266` | Calendar integration is Outlook-only. Gmail users get no calendar signals | Add `googleapis.com/auth/calendar.readonly` scope |
| **Plaintext token storage** | 🟡 HIGH | `outlook_oauth_tokens`, `gmail_connections` | Tokens readable if service role key leaks | Add `pgcrypto` column-level encryption |
| **gmail_test Edge Function still deployed** | 🟢 LOW | `supabase_edge_functions/gmail_test/` | Dead code consuming Edge Function quota | Delete from Supabase dashboard |
| **watchtower-brain Edge Function unused** | 🟢 LOW | `supabase/functions/watchtower-brain/` | Script exists but never called | Either wire it in or delete |
| **email_priority Edge Function orphaned** | 🟡 HIGH | `email_priority/index.ts` | Deployed but not called from backend — frontend calls directly, bypassing auth layer | Route through backend OR add auth in Edge Function |
| **AZURE_CLIENT_ID resets on fork** | 🟡 HIGH | `backend/.env` | Was `watchtower-ai` placeholder — breaks Outlook OAuth | ✅ FIXED to `5d6e3cbb-cd88-4694-aa19-9b7115666866` |

---

## 7. CRITICAL CODE — Email Edge Function Fetch Logic

### outlook-auth: The Token Store (Most Critical Path)
```typescript
// This is the EXACT code path when a user connects Outlook
// Edge Function: outlook-auth/index.ts — action: "store_tokens"

const { data: tokenData, error: tokenError } = await supabaseService
  .from("outlook_oauth_tokens")
  .upsert(
    {
      user_id,
      access_token,
      refresh_token,
      expires_at,
      account_email,
      account_name,
      provider: "microsoft",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  )
  .select();

// Then writes canonical connection state
const { data: connData, error: connError } = await supabaseService
  .from("email_connections")
  .upsert(
    {
      user_id,
      provider: "outlook",
      connected: true,
      connected_email: account_email,
      inbox_type: inboxType, // Detected via Graph API folder check
      connected_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  )
  .select();
```

### email_sync_worker.py: The Poller (Where Latency Lives)
```python
# This runs every 60 seconds on the FastAPI server (NOT Edge)
# It fetches emails but DOES NOT trigger intelligence

async def sync_user_emails(account):
    emails = await fetch_outlook_emails(
        account["access_token"],
        folder="inbox",
        lookback_days=7
    )
    for email in emails:
        await store_email_supabase(supabase_admin, email)
    # ⚠️ NO CALL to intelligence engine
    # ⚠️ NO CALL to email_priority Edge Function
    # ⚠️ Emails just sit in the table until the 24h worker runs
```

---

**END OF AUDIT**
