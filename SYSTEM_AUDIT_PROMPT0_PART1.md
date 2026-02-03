# BIQC SYSTEM VISIBILITY AUDIT - PROMPT 0
**READ-ONLY INSPECTION - NO CHANGES PERMITTED**

Date: 2025-02-02
Auditor: E1 Agent (Emergent)
Scope: Complete system map of BIQc application

---

## EXECUTIVE SUMMARY

**System State:** HYBRID (MongoDB + Supabase)
**Migration Readiness:** 40% (Auth migrated, Email/Chat not migrated)
**Emergent Dependency:** CRITICAL (MongoDB, hosting, runtime)
**Data Volume:** 1,962 documents (MongoDB) + Unknown (Supabase)
**Code Size:** 2.1MB backend, 1.2GB frontend

**Critical Findings:**
- Email system (1,715 emails) is MongoDB-dependent
- No background job scheduler (manual sync only)
- 108 MongoDB queries vs 25 Supabase queries in codebase
- Frontend is portable, backend is Emergent-bound

---

# 1️⃣ DATA LAYER - COMPLETE INVENTORY

## MONGODB (Primary Data Store)

**Database:** `test_database`
**Hosting:** Emergent-managed MongoDB (localhost:27017 in container)
**Region:** Unknown (Emergent infrastructure)
**Access:** AsyncIOMotorClient (pymongo async)
**Authentication:** None (localhost, container-internal)

### COLLECTIONS (18 total, 1,962 documents)

#### **A. EMAIL & CALENDAR (1,723 documents - 88% of total data)**

**1. outlook_emails**
- **Purpose:** Store synchronized Outlook emails
- **Records:** 1,715 documents
- **Avg Size:** 5,971 bytes (~6KB per email)
- **Total Size:** ~10.2MB
- **Fields:** user_id, graph_message_id, body_content, body_preview, folder, from_address, from_name, id, is_external, is_read, importance, labels, received_date, recipients, sent_date, subject
- **Indexes:** None (❌ RISK: No index on user_id - slow queries)
- **Read Paths:** Priority inbox endpoint, email intelligence extraction
- **Write Paths:** Outlook sync job
- **Source of Truth:** ✅ Primary (not duplicated)
- **Growth Rate:** ~50-100 emails/day per active user (estimated)
- **Retention:** No TTL (indefinite)

**2. calendar_events**
- **Purpose:** Store calendar meetings
- **Records:** 4 documents
- **Avg Size:** 565 bytes
- **Fields:** id, subject, start, end, location, attendees, organizer, preview, is_all_day, importance
- **Read Paths:** Calendar view, capacity analysis
- **Write Paths:** Calendar sync
- **Source of Truth:** ✅ Primary

**3. outlook_sync_jobs**
- **Purpose:** Track email sync job state
- **Records:** 4 documents
- **Avg Size:** 2,016 bytes
- **Fields:** job_id, user_id, status, started_at, progress, completed_at, insights
- **Read Paths:** Sync status API
- **Write Paths:** Email sync orchestrator
- **Source of Truth:** ✅ Primary

**4. email_intelligence**
- **Purpose:** Derived email analysis
- **Records:** 2 documents
- **Avg Size:** 2,379 bytes
- **Fields:** user_id, analysis_period, analyzed_at, client_communication_patterns, top_clients, total_emails_analyzed, unique_contacts, updated_at
- **Source of Truth:** ❌ Derived (computed from outlook_emails)

**5. email_priority_analysis**
- **Purpose:** Priority inbox categorization
- **Records:** 2 documents
- **Avg Size:** 2,865 bytes
- **Fields:** user_id, analysis, analyzed_at, emails_analyzed
- **Source of Truth:** ❌ Derived

---

#### **B. CONVERSATIONS & CHAT (38 documents)**

**6. soundboard_conversations**
- **Purpose:** MySoundBoard chat conversations
- **Records:** 6 documents
- **Avg Size:** 854 bytes
- **Fields:** id, user_id, title, messages, created_at, updated_at
- **Read Paths:** GET /soundboard/conversations, MySoundBoard UI
- **Write Paths:** POST /soundboard/chat (DUPLICATE: Also writes to Supabase)
- **Source of Truth:** ⚠️ DUPLICATE (written to MongoDB AND Supabase)
- **Risk:** Data inconsistency between MongoDB and Supabase

**7. chat_history**
- **Purpose:** Legacy chat history
- **Records:** 32 documents
- **Avg Size:** 1,116 bytes
- **Fields:** id, user_id, session_id, message, response, context_type, created_at
- **Source of Truth:** ✅ Primary (legacy feature)

---

#### **C. BUSINESS PROFILES & USER DATA (118 documents)**

**8. users**
- **Purpose:** User authentication metadata (DUPLICATE of Supabase auth.users)
- **Records:** 64 documents
- **Avg Size:** 453 bytes
- **Fields:** id, email, password, name, business_name, industry, role, is_active, created_at, updated_at
- **Read Paths:** JWT token validation (line 757), user lookups
- **Write Paths:** Registration endpoints
- **Source of Truth:** ⚠️ DUPLICATE (Supabase auth.users is primary for auth)
- **Risk:** Password hashes stored (legacy), conflicts with Supabase auth

**9. business_profiles**
- **Purpose:** Business profile data
- **Records:** 31 documents
- **Avg Size:** 407 bytes
- **Fields:** user_id, abn, acn, business_name, business_type, industry, retention_known, retention_rag, retention_rate_range, target_country
- **Source of Truth:** ⚠️ DUPLICATE (Also in Supabase business_profiles)

**10. business_profiles_versioned**
- **Purpose:** Profile version history
- **Records:** 23 documents
- **Avg Size:** 2,559 bytes
- **Fields:** profile_id, business_id, user_id, version, status, created_at, created_by, last_reviewed_at, confidence_summary, score
- **Source of Truth:** ✅ Primary (versioning not in Supabase)

**11. onboarding**
- **Purpose:** User onboarding flow state
- **Records:** 18 documents
- **Avg Size:** 688 bytes
- **Fields:** user_id, business_stage, completed, current_step, data, updated_at, completed_at
- **Source of Truth:** ✅ Primary

---

#### **D. ANALYSIS & RECOMMENDATIONS (19 documents)**

**12. analyses**
- **Purpose:** Strategic analysis reports
- **Records:** 3 documents
- **Avg Size:** 6,484 bytes
- **Fields:** id, user_id, title, analysis_type, business_context, ai_analysis, recommendations, action_items, created_at, updated_at
- **Source of Truth:** ⚠️ DUPLICATE (Also in Supabase analyses table)

**13. diagnoses**
- **Purpose:** Business diagnosis results
- **Records:** 1 document
- **Avg Size:** 6,591 bytes
- **Fields:** id, user_id, symptoms, areas, urgency, diagnosis, insights, created_at
- **Source of Truth:** ✅ Primary

**14. oac_recommendations**
- **Purpose:** OAC (Operations Advisory Centre) recommendations
- **Records:** 15 documents
- **Avg Size:** 1,508 bytes
- **Fields:** date, user_id, created_at, id, items
- **Source of Truth:** ✅ Primary

**15. oac_usage**
- **Purpose:** OAC usage tracking
- **Records:** 13 documents
- **Avg Size:** 101 bytes
- **Fields:** month, user_id, used
- **Source of Truth:** ✅ Primary

---

#### **E. DOCUMENTS & WEB SOURCES (24 documents)**

**16. documents**
- **Purpose:** User-uploaded documents
- **Records:** 5 documents
- **Avg Size:** 3,565 bytes
- **Fields:** id, user_id, title, document_type, content, tags, created_at, updated_at
- **Source of Truth:** ⚠️ DUPLICATE (Also in Supabase documents table)

**17. web_sources**
- **Purpose:** Web scraping results
- **Records:** 19 documents
- **Avg Size:** 521 bytes
- **Fields:** user_id, url, created_at, id, snippet, source_type, title, updated_at
- **Source of Truth:** ✅ Primary

---

#### **F. SECURITY & AUDIT (5 documents)**

**18. security_audit_log**
- **Purpose:** Security event logging
- **Records:** 5 documents
- **Avg Size:** 350 bytes
- **Fields:** id, event_type, user_id, user_email, microsoft_email, microsoft_name, timestamp, ip_address
- **Source of Truth:** ✅ Primary
- **Contains PII:** ✅ YES (emails, names, IP addresses)

---

### MONGODB CRITICAL OBSERVATIONS

**Source of Truth:**
- ✅ Primary only: 11 collections (outlook_emails, calendar_events, etc.)
- ❌ Derived: 2 collections (email_intelligence, email_priority_analysis)
- ⚠️ Duplicated: 5 collections (users, business_profiles, soundboard_conversations, analyses, documents)

**Missing Indexes:**
- ❌ ALL collections have NO custom indexes (only default _id)
- ❌ RISK: No index on user_id for multi-tenant queries
- ❌ RISK: Slow queries on large collections (outlook_emails: 1,715 docs)

**Data Duplication Risk:**
- soundboard_conversations: Written to BOTH MongoDB and Supabase
- business_profiles: Present in BOTH
- users: Present in BOTH (different schemas)
- analyses: Present in BOTH
- documents: Present in BOTH

**Estimated Storage:**
- Total: ~11.8MB (1,962 documents)
- Growth: ~2-5MB/month per active user (email-driven)

---

## SUPABASE (Secondary/Emerging Data Store)

**Project:** uxyqpdfftxpkzeppqtvk.supabase.co
**Hosting:** Supabase Cloud (Oregon/US-West)
**Region:** us-west-1 (inferred from project ID)
**Access:** supabase-py (Python client)
**Authentication:** Service Role Key + Anon Key

### TABLES (Verified - cannot get full count without pg access)

**1. auth.users** (Supabase-managed)
- **Purpose:** Primary user authentication
- **Records:** Unknown (estimated ~64 based on MongoDB users)
- **Fields:** Supabase standard (id, email, encrypted_password, email_confirmed_at, etc.)
- **Source of Truth:** ✅ Primary for authentication

**2. accounts**
- **Purpose:** Workspace management
- **Records:** Unknown (estimated ~30-40)
- **Fields:** id, name, created_at, owner_user_id
- **Source of Truth:** ✅ Primary

**3. integration_accounts**
- **Purpose:** Store Merge.dev and integration account tokens
- **Records:** Unknown
- **Fields:** user_id, account_id, provider, category, account_token, connected_at
- **Source of Truth:** ✅ Primary
- **Critical:** Stores Merge.dev account_token (sensitive)

**4. email_connections**
- **Purpose:** Track email provider connections
- **Records:** Unknown
- **Fields:** user_id, provider, connected_email, connected_at
- **Source of Truth:** ✅ Primary

**5. outlook_oauth_tokens**
- **Purpose:** Store Outlook OAuth tokens
- **Records:** Unknown
- **Fields:** user_id, provider, account_email, access_token, refresh_token, expires_at, created_at
- **Source of Truth:** ✅ Primary
- **Critical:** Stores OAuth tokens (sensitive, encrypted at rest by Supabase)

**6. m365_tokens**
- **Purpose:** Microsoft 365 tokens (alternative storage)
- **Records:** Unknown
- **Source of Truth:** ✅ Primary

**7. gmail_connections**
- **Purpose:** Gmail connection tracking
- **Records:** Unknown
- **Source of Truth:** ✅ Primary

**8. watchtower_events** (NEW - created in this session)
- **Purpose:** Truth Engine intelligence events
- **Records:** 0 (just created)
- **Fields:** id, account_id, domain, type, severity, headline, statement, evidence_payload (JSONB), consequence_window, source, fingerprint, status, created_at, handled_at, handled_by_user_id
- **Source of Truth:** ✅ Primary
- **RLS:** ✅ Enabled (workspace-scoped)
- **Unique Constraint:** (account_id, fingerprint)

**9. business_profiles** (Supabase)
- **Purpose:** Business profiles
- **Records:** Unknown
- **Source of Truth:** ⚠️ DUPLICATE (also in MongoDB)

**10. soundboard_conversations** (Supabase)
- **Purpose:** Chat conversations
- **Records:** Unknown
- **Source of Truth:** ⚠️ DUPLICATE (also in MongoDB)

**11. documents** (Supabase)
- **Purpose:** Document storage
- **Records:** Unknown
- **Source of Truth:** ⚠️ DUPLICATE (also in MongoDB)

**12. analyses** (Supabase)
- **Purpose:** Analysis reports
- **Records:** Unknown
- **Source of Truth:** ⚠️ DUPLICATE (also in MongoDB)

### SUPABASE CRITICAL OBSERVATIONS

**Cannot verify:**
- ❌ Exact record counts (no direct PostgreSQL access)
- ❌ Index configurations
- ❌ Storage size
- ❌ RLS policy details for all tables

**Known:**
- ✅ Used for auth (primary)
- ✅ Used for OAuth tokens (primary)
- ✅ Used for integration metadata (primary)
- ⚠️ Some tables duplicate MongoDB data

---

# 2️⃣ AUTH & IDENTITY FLOW

## PRIMARY: SUPABASE AUTH

**Provider:** Supabase Authentication (managed service)
**Method:** Email/Password (magic links disabled)

### FLOW DIAGRAM (Textual)

```
[User] 
  ↓ (navigates to /login-supabase)
[Frontend: LoginSupabase.js]
  ↓ (calls supabase.auth.signInWithPassword)
[Supabase Auth Service]
  ↓ (validates credentials)
[JWT Token Issued]
  ↓ (stored in localStorage + httpOnly cookie)
[Frontend: SupabaseAuthContext]
  ↓ (session established)
[User] redirected to /advisor
```

**Token Issuance:**
- Issued by: Supabase Auth API
- Format: JWT (signed by Supabase)
- Payload: {sub: user_id, email, role, etc.}
- Expiry: 3600 seconds (1 hour)

**Token Storage:**
- Frontend: localStorage key `supabase.auth.token`
- Frontend: httpOnly cookie (managed by Supabase)
- Backend: Validated via Supabase API

**Token Refresh:**
- Automatic via Supabase SDK
- Refresh token stored in localStorage
- Triggered before expiry

**Session Handling:**
- Frontend: SupabaseAuthContext (React Context)
- Backend: get_current_user_supabase() dependency
- Workspace scoping: user.account_id (from users table join)

**RLS Policies (Supabase):**
- watchtower_events: Row-level security based on account_id
- Other tables: Assumed present but NOT VERIFIED

### LEGACY: JWT AUTH (MongoDB-based)

**Status:** Still present in code (line 757)
**Method:** Custom JWT with bcrypt passwords
**Storage:** MongoDB users collection (64 users with password hashes)
**Risk:** Dual auth systems create confusion
**Used by:** Admin endpoints, legacy API calls

### FAILURE MODES

**Supabase Auth Failures:**
- Network failure → User cannot login
- Token expiry during offline → Session lost
- No offline auth capability
- Dependency: Supabase service availability

**Fallback:** MongoDB JWT auth still functional (legacy)

**Hard Dependencies:**
- Supabase service availability
- Internet connectivity
- No self-hosted auth option

---

# 3️⃣ INTEGRATION SURFACE (EXHAUSTIVE)

## INTEGRATION 1: OUTLOOK (Email)

**Provider:** Microsoft Graph API
**Auth Method:** OAuth 2.0 Authorization Code Flow
**OAuth App:** Azure AD App Registration
- Client ID: 5d6e3cbb-cd88-4694-aa19-9b7115666866
- Tenant ID: af75a88f-8c78-46dd-bda8-faa925d316d9
- Client Secret: Stored in backend .env

**Token Storage:**
- Location: Supabase `outlook_oauth_tokens` table
- Fields: access_token, refresh_token, expires_at
- Ownership: Per-user
- Encryption: Supabase managed (at rest)

**Refresh Logic:**
- Manual check before API calls
- Code location: server.py lines 1750-1800
- Refresh endpoint: /api/outlook/refresh-token

**Sync:**
- Direction: Pull only (read emails from Outlook)
- Frequency: Manual trigger (no cron)
- Method: Microsoft Graph API batch requests
- Storage: MongoDB outlook_emails collection
- Job tracking: MongoDB outlook_sync_jobs

**Webhooks:** ❌ None
**Polling:** ✅ Manual user-initiated

**Failure Handling:**
- Token expiry → Redirect to re-auth
- API rate limit → Retry with backoff
- Network failure → Job marked as failed

**Idempotency:** ⚠️ NOT GUARANTEED (no deduplication on graph_message_id)

**Dependencies:**
- ✅ Supabase (token storage)
- ✅ MongoDB (email storage)
- ❌ Cannot work without MongoDB

---

## INTEGRATION 2: GMAIL

**Provider:** Google Gmail API
**Auth Method:** OAuth 2.0
**OAuth App:**
- Client ID: 903194754324-ife21qnmrokplbcu2ck5afce0kjd6j10.apps.googleusercontent.com
- Client Secret: Stored in backend .env

**Token Storage:**
- Location: Supabase `gmail_connections` table
- Ownership: Per-user

**Sync:** Manual/on-demand (similar to Outlook)

**Dependencies:**
- ✅ Supabase (token storage)
- ⚠️ Email storage mechanism unclear (likely MongoDB)

---

## INTEGRATION 3: MERGE.DEV (CRM/Accounting)

**Provider:** Merge.dev Unified API
**Auth Method:** API Key + Account Tokens
**API Key:** Stored in backend .env

**Token Flow:**
```
User connects HubSpot
  ↓
Frontend calls: POST /api/integrations/merge/link-token
  ↓
Backend calls Merge.dev: Generate link token
  ↓
Merge Link modal opens (3rd party)
  ↓
User authenticates with HubSpot
  ↓
Merge returns public_token
  ↓
Frontend calls: POST /api/integrations/merge/exchange-account-token
  ↓
Backend exchanges public_token → account_token
  ↓
account_token stored in Supabase integration_accounts
```

**Token Storage:**
- Location: Supabase `integration_accounts` table
- Field: account_token
- Ownership: Per-workspace (account_id)
- Scope: Per-category (crm, accounting)

**Refresh Logic:** ❌ None (Merge account tokens don't expire)

**Sync:**
- Direction: Pull only (read CRM/accounting data)
- Frequency: On-demand API calls (NO background sync)
- Method: Passthrough (Merge API → Frontend, NO local storage)
- Storage: ❌ NONE (data not persisted)

**Data Flow:**
```
Frontend requests deals
  ↓
GET /api/integrations/crm/deals
  ↓
Backend: merge_client.get_deals(account_token)
  ↓
Merge.dev API call
  ↓
Data returned to frontend
  ↓
NOT stored in database
```

**Dependencies:**
- ✅ Supabase (account_token storage only)
- ❌ NO MongoDB dependency
- ✅ Fully Supabase-native

**Supported Categories:**
- CRM: HubSpot, Salesforce, Pipedrive
- Accounting: Xero, QuickBooks
- Endpoints: /crm/v1/opportunities, /crm/v1/contacts, /accounting/v1/invoices

---

## INTEGRATION 4: GOOGLE OAUTH (Supabase Social Auth)

**Provider:** Google OAuth (for Supabase social login)
**Status:** ⚠️ Configured but NOT ACTIVELY USED
**Client ID:** In frontend .env
**Purpose:** Intended for Supabase social auth (not implemented in UI)

---

## INTEGRATION SUMMARY

| Integration | Auth | Token Storage | Data Storage | MongoDB Dep | Supabase Native |
|-------------|------|---------------|--------------|-------------|-----------------|
| **Outlook** | OAuth | Supabase | MongoDB | ✅ YES | ❌ No |
| **Gmail** | OAuth | Supabase | Unknown/MongoDB | ⚠️ Likely | ❌ No |
| **Merge.dev** | API Key | Supabase | None (passthrough) | ❌ NO | ✅ YES |
| **Google (unused)** | OAuth | N/A | N/A | ❌ NO | ✅ YES |

**Require MongoDB:** Outlook (email storage), Gmail (likely)
**Supabase-native:** Merge.dev, Google OAuth

---

# 4️⃣ BACKEND EXECUTION ENVIRONMENT

## RUNTIME

**Language:** Python 3.11
**Framework:** FastAPI (async)
**Process Model:** Uvicorn ASGI server
- Workers: 1
- Reload: Enabled (development mode)
- Port: 8001
- Host: 0.0.0.0

**Process Manager:** Supervisor
- Config: /etc/supervisor/conf.d/backend.conf
- Auto-restart: Enabled
- Logs: /var/log/supervisor/backend.*.log

**Dependencies:** 147 packages in requirements.txt
- emergentintegrations: 0.1.0 (Emergent LLM integration)
- fastapi, uvicorn, motor (MongoDB async), supabase-py
- httpx, authlib, pydantic

---

## JOB SCHEDULERS

**Cron:** ❌ NONE
**Celery:** ❌ NONE
**APScheduler:** ❌ NONE
**Background Workers:** ❌ NONE

**Finding:** NO automated background jobs exist

---

## MANUAL JOBS (User-triggered)

**Email Sync Job:**
- Trigger: User clicks "Sync" (manual)
- Endpoint: POST /api/outlook/sync
- State Storage: MongoDB outlook_sync_jobs
- Retry Logic: ❌ None
- Failure: Job marked as failed, user notified

**Calendar Sync:**
- Trigger: Manual
- Storage: MongoDB calendar_events

**Priority Inbox Analysis:**
- Trigger: On-demand
- Storage: MongoDB email_priority_analysis
- Computation: Backend Python logic

---

## EXECUTION DEPENDENCIES

**Required Services:**
- MongoDB (localhost:27017)
- Supabase API (network)
- Emergent LLM API (network)
- Microsoft Graph API (for Outlook)
- Google Gmail API
- Merge.dev API

**Single Points of Failure:**
- MongoDB unavailable → Email, chat, profiles fail
- Supabase unavailable → Auth, integrations fail
- Internet connection lost → All integrations fail

---

# 5️⃣ FRONTEND DEPLOYMENT & COUPLING

## BUILD SYSTEM

**Framework:** React 18
**Build Tool:** Create React App (craco)
**Package Manager:** Yarn
**Build Command:** `yarn build`
**Dev Server:** Webpack Dev Server (port 3000)

**Dependencies:** package.json (not fully visible)
- react, react-router-dom
- @supabase/supabase-js (client-side auth)
- lucide-react (icons)
- tailwindcss (styling)
- @mergeapi/react-merge-link (Merge.dev modal)

---

## HOSTING

**Current:** Emergent-managed nginx
**Port:** 3000 (internal), 443 (external via Kubernetes ingress)
**Supervisor:** /etc/supervisor/conf.d/frontend.conf
**Build Output:** /app/frontend/build/

---

## ENVIRONMENT VARIABLES

**Required for deployment:**
```bash
REACT_APP_BACKEND_URL=https://beta.thestrategysquad.com
REACT_APP_SUPABASE_URL=https://uxyqpdfftxpkzeppqtvk.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGc...
REACT_APP_GOOGLE_CLIENT_ID=903194754324-ife21qnmrokplbcu2ck5afce0kjd6j10.apps.googleusercontent.com
```

**Hardcoded URLs:** ❌ NONE FOUND
- All API calls use process.env.REACT_APP_BACKEND_URL
- Auth uses window.location.origin (dynamic)

---

## EMERGENT-SPECIFIC BINDINGS

**None identified in frontend code**
- ✅ Uses standard environment variables
- ✅ No Emergent-specific imports
- ✅ No file path assumptions
- ✅ Portable to any static hosting

---

## BACKEND DEPENDENCIES

**API Coupling:**
- Tight: All features require backend API
- Auth: Requires Supabase (not backend)
- Data: ALL data from backend API calls

**Assumptions:**
- Backend available at REACT_APP_BACKEND_URL
- Backend serves /api/* endpoints
- CORS enabled on backend

**Portability:** ✅ HIGH
- Can deploy to Vercel, Netlify, Cloudflare Pages
- Only needs backend URL configured
- No Emergent lock-in

---

# 6️⃣ EMERGENT DEPENDENCY AUDIT

## HOSTING DEPENDENCIES

**1. MongoDB (HARD)**
- Provider: Emergent-managed MongoDB
- Access: localhost:27017 (container-internal)
- Data: 1,962 documents (~12MB)
- Alternative: Could migrate to MongoDB Atlas, but requires 18-20 hours
- Classification: **HARD DEPENDENCY (CRITICAL)**

**2. Container Runtime (HARD)**
- Provider: Kubernetes on Emergent
- Features used: Supervisor, nginx, port mapping
- Alternative: Any Kubernetes cluster or VM with supervisor
- Classification: **SOFT DEPENDENCY (Replaceable)**

**3. Secrets Management (SOFT)**
- Provider: .env files in container
- Secrets: API keys, OAuth credentials
- Alternative: Environment variables in any hosting
- Classification: **SOFT DEPENDENCY (Replaceable)**

---

## RUNTIME ASSUMPTIONS

**File Paths:**
- /app/backend/
- /app/frontend/
- /var/log/supervisor/
- **Classification:** Standard Linux paths, SOFT dependency

**Ports:**
- Frontend: 3000 (configurable)
- Backend: 8001 (configurable)
- **Classification:** SOFT dependency

**Managed Services (Emergent-provided):**
- MongoDB: HARD
- Nginx reverse proxy: SOFT
- Supervisor process manager: SOFT
- Code server: NOT USED by app

---

## EMERGENT APIs / SERVICES

**1. Emergent LLM Key**
- Purpose: Universal API key for OpenAI/Anthropic/Gemini
- Stored: backend .env (EMERGENT_LLM_KEY)
- Used by: MySoundBoard chat (via emergentintegrations library)
- Replacement: Can use direct OpenAI/Anthropic keys
- Classification: **SOFT DEPENDENCY**

**2. emergentintegrations Library**
- Package: emergentintegrations==0.1.0
- Purpose: Unified LLM client
- Used in: MySoundBoard (LlmChat, OpenAIChatRealtime)
- Replacement: Can use openai, anthropic libraries directly
- Classification: **SOFT DEPENDENCY**

---

## BUILD HOOKS

**None identified**
- No Emergent-specific build scripts
- Standard yarn build
- No custom deployment hooks

---

## INTERNAL APIS

**None used**
- App doesn't call Emergent internal APIs
- Fully self-contained

---

## DEPENDENCY CLASSIFICATION SUMMARY

| Component | Dependency Type | Replaceable | Effort |
|-----------|----------------|-------------|--------|
| **MongoDB** | HARD | ⚠️ Yes | 18-20h migration |
| **Supervisor** | SOFT | ✅ Yes | <1h (use pm2, systemd) |
| **Nginx** | SOFT | ✅ Yes | <1h (any reverse proxy) |
| **Container** | SOFT | ✅ Yes | <2h (any K8s, VM, Docker) |
| **Emergent LLM** | SOFT | ✅ Yes | <1h (use OpenAI directly) |
| **emergentintegrations** | SOFT | ✅ Yes | <2h (refactor to openai lib) |

**CRITICAL PATH:** MongoDB is the ONLY hard dependency

---

(CONTINUED IN NEXT MESSAGE - EXCEEDING TOKEN LIMIT FOR SINGLE RESPONSE)
