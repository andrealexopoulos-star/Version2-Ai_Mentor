# BIQC DATA-PLANE AUDIT REPORT
## Date: February 10, 2026
## Classification: Observation Only — No Fixes Applied

---

## 1. AUTHORITATIVE STORES

### 1.1 Supabase (PostgreSQL) — Tables Actively In Use

| # | Table | Purpose | Read By (Pages/Agents) | Written By (Endpoints/Modules) |
|---|-------|---------|----------------------|-------------------------------|
| 1 | `users` | User accounts, email, name, role | Auth flow, AdvisorWatchtower, build_advisor_context() | Registration, OAuth callback, profile save |
| 2 | `business_profiles` | Business identity, industry, calibration_status, intelligence_configuration | BusinessProfile (Business DNA), OnboardingWizard, BoardRoom, Watchtower, Advisor, auth/check-profile, intelligence_baseline.py | PUT /business-profile, POST /onboarding/save, POST /calibration/defer, watchtower_engine.py |
| 3 | `user_operator_profile` | Persona calibration results (persona_calibration_status, operator_profile, agent_persona) | CalibrationAdvisor, AuthCallbackSupabase, SupabaseAuthContext, BoardRoom, GET /calibration/status | calibration-psych Edge Function ONLY |
| 4 | `onboarding` | Onboarding progress (current_step, business_stage, completed) | OnboardingWizard, ProtectedRoute, build_advisor_context(), profile scores | POST /onboarding/save, POST /onboarding/complete |
| 5 | `business_profiles_versioned` | Immutable profile version history | GET /business-profile (active lookup), GET /business-profile/scores | PUT /business-profile, POST /business-profile/request-update |
| 6 | `cognitive_profiles` | Behavioral models, delivery preferences | cognitive_core_supabase.py (via watchtower_engine.py, Advisor) | cognitive_core_supabase.py |
| 7 | `advisory_log` | Recommendation tracking, escalation state | cognitive_core_supabase.py | cognitive_core_supabase.py |
| 8 | `chat_history` | Advisor conversation history | build_advisor_context(), GET /chat/history | POST /chat |
| 9 | `intelligence_baseline` | User intelligence monitoring configuration | IntelligenceBaseline page, intelligence_baseline.py, GET /business-profile/context | POST /baseline |
| 10 | `observation_events` | Raw signals from integrations | watchtower_engine.py, merge_emission_layer.py | POST /watchtower/emit, merge_emission_layer.py |
| 11 | `watchtower_insights` | Domain positions and findings | watchtower_engine.py, OperatorDashboard, BoardRoom | watchtower_engine.py |
| 12 | `escalation_memory` | Recurring risk tracking | escalation_memory.py, BoardRoom | escalation_memory.py |
| 13 | `contradiction_memory` | Intent vs. reality misalignment | contradiction_engine.py, BoardRoom | contradiction_engine.py |
| 14 | `decision_pressure` | Response intensity calibration | pressure_calibration.py, BoardRoom | pressure_calibration.py |
| 15 | `intelligence_snapshots` | Periodic briefing summaries | snapshot_agent.py, OperatorDashboard | snapshot_agent.py |
| 16 | `evidence_freshness` | Confidence decay tracking | evidence_freshness.py, BoardRoom | evidence_freshness.py |
| 17 | `watchtower_events` | V1 watchtower events (legacy?) | watchtower_store.py, AdvisorWatchtower | watchtower_store.py |
| 18 | `data_files` | Uploaded documents | build_advisor_context(), DataCenter, profile scores | POST /data-center/upload |
| 19 | `soundboard_conversations` | MySoundBoard sessions | MySoundBoard page | POST /soundboard |
| 20 | `integration_accounts` | Merge.dev linked accounts | merge_emission_layer.py, Integrations page | Integrations OAuth flow |
| 21 | `outlook_emails` | Synced Outlook emails | build_advisor_context(), EmailInbox, merge_emission_layer.py | email_sync_worker.py |
| 22 | `outlook_oauth_tokens` | Microsoft OAuth tokens | ConnectEmail, email sync | OAuth callback |
| 23 | `gmail_connections` | Gmail OAuth connections | ConnectEmail | Gmail OAuth flow |
| 24 | `outlook_calendar_events` | Calendar events | CalendarView, merge_emission_layer.py | Calendar sync |
| 25 | `calibration_schedules` | Weekly/quarterly calibration scheduling | Not read by any page | POST /onboarding/complete |
| 26 | `calibration_sessions` | Calibration session state | Not confirmed | Not confirmed |
| 27 | `accounts` | Parent account entities | workspace_helpers.py | POST /onboarding/complete |
| 28 | `web_sources` | Web sources for analysis | build_advisor_context() | Web source management |
| 29 | `sops` | Standard operating procedures | build_advisor_context() | SOP generator |
| 30 | `documents` | Generated documents | Documents page | Document creation |
| 31 | `analyses` | Analysis results | Analysis page | Analysis creation |
| 32 | `settings` | User preferences | Settings page | Settings save |
| 33 | `dismissed_notifications` | Dismissed notification IDs | Notification system | Notification dismiss |

### 1.2 Supabase Edge Functions

| Function | Tables Touched | Direction |
|----------|---------------|-----------|
| `calibration-psych` | `user_operator_profile` | READ + WRITE (insert/update persona_calibration_status, operator_profile) |
| `calibration_psych` (duplicate directory) | Same as above | Same (appears to be a duplicate deployment artifact) |
| `watchtower-brain` | None confirmed | TBD |

---

## 2. NON-AUTHORITATIVE STORES

### 2.1 MongoDB (ACTIVE — localhost:27017, database: `test_database`)

**Status: ACTIVE but NOT read by any active server.py route.** The `motor` client is imported (line 7) and initialized (lines 153-155) but `db` variable has zero grep hits in active code paths. However, `cognitive_core.py` (the ORIGINAL, non-Supabase version) still references MongoDB via `db.cognitive_profiles` and `db.advisory_log`.

The server imports `cognitive_core_supabase.py` (line 118), NOT `cognitive_core.py`. Therefore MongoDB is **imported but orphaned** in server.py.

| Collection | Document Count | Supabase Equivalent | Status |
|-----------|---------------|---------------------|--------|
| `users` | 64 | `users` | **DUPLICATE** — stale |
| `business_profiles` | 31 | `business_profiles` | **DUPLICATE** — stale |
| `business_profiles_versioned` | 23 | `business_profiles_versioned` | **DUPLICATE** — stale |
| `chat_history` | 32 | `chat_history` | **DUPLICATE** — stale |
| `onboarding` | 18 | `onboarding` | **DUPLICATE** — stale |
| `outlook_emails` | 1,715 | `outlook_emails` | **DUPLICATE** — stale |
| `outlook_sync_jobs` | 4 | `outlook_sync_jobs` | **DUPLICATE** — stale |
| `analyses` | 3 | `analyses` | **DUPLICATE** — stale |
| `documents` | 5 | `documents` | **DUPLICATE** — stale |
| `soundboard_conversations` | 3 | `soundboard_conversations` | **DUPLICATE** — stale |
| `web_sources` | 19 | `web_sources` | **DUPLICATE** — stale |
| `email_intelligence` | 2 | `email_intelligence` | **DUPLICATE** — stale |
| `email_priority_analysis` | 2 | `email_priority_analysis` | **DUPLICATE** — stale |
| `calendar_events` | 4 | `outlook_calendar_events` | **DUPLICATE** — stale |
| `oac_recommendations` | 15 | Unknown | Possibly orphaned |
| `oac_usage` | 13 | Unknown | Possibly orphaned |
| `diagnoses` | 1 | Unknown | Possibly orphaned |
| `security_audit_log` | 5 | Unknown | Possibly orphaned |

**Risk**: MongoDB is a running process consuming resources. The `motor` import and client initialization execute on every server startup. If Supabase fails, no code falls back to MongoDB — it is purely dead weight.

### 2.2 Frontend localStorage

| Key | Written By | Read By | Content | Risk |
|-----|-----------|---------|---------|------|
| `biqc_context_v1` | AuthCallbackSupabase.js | NOT READ ANYWHERE | `{user_id, account_id, business_profile_id, onboarding_status, calibration_status, cached_at}` | **Shadow state** — written but never consumed. Stale after write. |
| `biqc_intelligence_state` | Advisor.js (legacy) | MySoundBoard.js | `{focusAreas, keyInsights, confidence, conversationId}` | **Cross-page shadow state** — duplicates Supabase chat_history. Not cleared on logout. |
| `biqc_focus_history` | Advisor.js (legacy) | Advisor.js (legacy) | Array of focus area objects with timestamps | **Local-only state** — not in Supabase. Lost on clear. |
| `biqc_show_tutorial` | Unknown origin | AdvisorWatchtower.js | Boolean flag | **Transient UI flag** — low risk |
| `sidebar-collapsed` | DashboardLayout.js | DashboardLayout.js | Boolean | **UI preference** — appropriate use |
| `theme` | DashboardLayout.js | DashboardLayout.js | 'dark' or 'light' | **UI preference** — appropriate use |
| `installPromptDismissed` | InstallPrompt.js | InstallPrompt.js | Timestamp | **UI preference** — appropriate use |
| `token` | Legacy auth (MongoDB era) | api.js, VoiceChat.js, Integrations.js, ConnectEmail.js | JWT string | **LEGACY** — fallback auth token. Supabase session is primary. Never written by current auth flow. |
| `biqc-auth` | Supabase SDK (auto) | Supabase SDK (auto) | Supabase session | **Appropriate** — managed by Supabase SDK |

### 2.3 Frontend sessionStorage

| Key | Written By | Read By | Content | Risk |
|-----|-----------|---------|---------|------|
| `onboarding_deferred` | OnboardingDecision.js | OnboardingDecision.js | Boolean flag | **Transient** — cleared on tab close. Low risk. |

### 2.4 Frontend In-Memory State (React Context)

| State Variable | Location | Populated? | Risk |
|---------------|----------|-----------|------|
| `businessContext` | SupabaseAuthContext.js | **NEVER** (initialized null, never set) | **Dead state** — exposed in context but never populated. Consumers would always receive null. |
| `contextLoading` | SupabaseAuthContext.js | **NEVER** (initialized true, never updated) | **Dead state** — always reports loading. |
| `contextError` | SupabaseAuthContext.js | **NEVER** (initialized null, never set) | **Dead state** |
| `contextSource` | SupabaseAuthContext.js | **NEVER** (initialized null, never set) | **Dead state** |
| `onboardingState` | SupabaseAuthContext.js | **NEVER** (initialized null, only cleared on logout) | **Dead state** — exposed but never populated. OnboardingWizard.js does NOT use this; it fetches from API directly. |
| `calibrationMode` | SupabaseAuthContext.js | **NEVER** (set to null in bootstrap, never updated to a value) | **Dead state** |

---

## 3. SHADOW / DUPLICATE DATA

### 3.1 Calibration Status — THREE Sources

| Source | Location | Value | Authoritative? |
|--------|----------|-------|---------------|
| `user_operator_profile.persona_calibration_status` | Supabase | 'complete' / 'in_progress' | **YES** (written by calibration-psych Edge Function) |
| `business_profiles.calibration_status` | Supabase | 'complete' / 'deferred' / null | **LEGACY FALLBACK** (written by /calibration/defer, War Room completion) |
| `/api/auth/check-profile` response | Backend | Derived from `business_profiles.calibration_status` ONLY | **INCONSISTENT** — does NOT check `user_operator_profile` |

**Conflict**: The `/api/auth/check-profile` endpoint (used by AuthCallbackSupabase.js line 145) reads calibration status from `business_profiles.calibration_status` only. It does NOT check `user_operator_profile.persona_calibration_status`. This means the OAuth callback flow uses a different truth source than the SupabaseAuthContext bootstrap flow.

### 3.2 Business Profile Data — TWO Tables

| Table | Purpose | Relationship |
|-------|---------|-------------|
| `business_profiles` | Mutable current state (upsert on user_id) | **PRIMARY** — written by onboarding, direct edits |
| `business_profiles_versioned` | Immutable version history | **DERIVED** — created on each profile update |

The `GET /business-profile` endpoint checks `business_profiles_versioned` FIRST, falls back to `business_profiles`. This means the versioned table can override the mutable table if present.

### 3.3 MongoDB vs Supabase — Full Overlap

All 14 overlapping collections listed in Section 2.1 are stale duplicates. No active code path reads from MongoDB. The `motor` client import and initialization is dead code.

### 3.4 Cognitive Profile — TWO Implementations

| File | Database | Active? |
|------|----------|---------|
| `cognitive_core.py` | MongoDB (`db.cognitive_profiles`, `db.advisory_log`) | **NO** — not imported by server.py |
| `cognitive_core_supabase.py` | Supabase (`cognitive_profiles`, `advisory_log`) | **YES** — imported on line 118 |
| `cognitive_core_mongodb_backup.py` | MongoDB | **NO** — backup file |

---

## 4. AGENT READ PATHS

### 4.1 Onboarding Wizard (`/onboarding`)
| Operation | Store | Table/Endpoint |
|-----------|-------|----------------|
| READ | Supabase (via API) | `GET /business-profile/context` → `business_profiles`, `onboarding`, `intelligence_baseline`, `user_operator_profile` |
| WRITE | Supabase (via API) | `POST /onboarding/save` → `onboarding` + `business_profiles` |
| WRITE | Supabase (via API) | `PUT /business-profile` → `business_profiles` + `business_profiles_versioned` |
| WRITE | Supabase (via API) | `POST /onboarding/complete` → `onboarding`, `calibration_schedules`, `accounts` |

### 4.2 BIQc Insights / Advisor (`/advisor`)
| Operation | Store | Table/Endpoint |
|-----------|-------|----------------|
| READ | Supabase (via API) | `build_advisor_context()` → `users`, `business_profiles`, `onboarding`, `chat_history`, `data_files`, `web_sources`, `sops`, `outlook_emails`, `email_intelligence`, `calendar_intelligence`, `outlook_calendar_events`, `email_priority_analysis` |
| READ | Supabase (via API) | `cognitive_core_supabase` → `cognitive_profiles`, `advisory_log` |
| READ | localStorage | `biqc_show_tutorial` (UI flag only) |
| WRITE | Supabase (via API) | `POST /chat` → `chat_history` |
| WRITE | Supabase | `cognitive_core_supabase` → `cognitive_profiles`, `advisory_log` |

### 4.3 Board Room (`/board-room`)
| Operation | Store | Table/Endpoint |
|-----------|-------|----------------|
| READ | Supabase | `watchtower_insights` (via watchtower_engine.py) |
| READ | Supabase | `observation_events` (via watchtower_engine.py) |
| READ | Supabase | `business_profiles.intelligence_configuration` |
| READ | Supabase | `user_operator_profile` (operator_profile, agent_persona, agent_instructions) |
| READ | Supabase | `escalation_memory` (via escalation_memory.py) |
| READ | Supabase | `contradiction_memory` (via contradiction_engine.py) |
| READ | Supabase | `decision_pressure` (via pressure_calibration.py) |
| READ | Supabase | `evidence_freshness` (via evidence_freshness.py) |
| WRITE | None | Board Room is read-only (no writes) |

### 4.4 Operator Dashboard (`/operator`)
| Operation | Store | Table/Endpoint |
|-----------|-------|----------------|
| READ | Supabase (via API) | `GET /watchtower/positions` → `watchtower_insights` |
| READ | Supabase (via API) | `GET /watchtower/findings` → `watchtower_insights` |
| READ | Supabase (via API) | `GET /snapshot/latest` → `intelligence_snapshots` |
| READ | Supabase (via API) | `POST /boardroom/respond` → (all Board Room reads above) |
| WRITE | None | Operator Dashboard is read-only |

### 4.5 Business DNA (`/business-profile`)
| Operation | Store | Table/Endpoint |
|-----------|-------|----------------|
| READ | Supabase (via API) | `GET /business-profile` → `business_profiles_versioned` (primary), `business_profiles` (fallback) |
| READ | Supabase (via API) | `GET /business-profile/scores` → `business_profiles_versioned`, `business_profiles`, `onboarding`, `data_files` |
| WRITE | Supabase (via API) | `PUT /business-profile` → `business_profiles` + `business_profiles_versioned` |

---

## 5. RISK AREAS

### RISK 1: Calibration Status Split (HIGH)
**Three places** determine if calibration is complete, and they disagree:
- `SupabaseAuthContext.js` bootstrap: checks `user_operator_profile` first, then `/api/calibration/status`
- `/api/calibration/status`: checks `user_operator_profile` first, then `business_profiles`
- `/api/auth/check-profile` (OAuth callback): checks `business_profiles.calibration_status` ONLY

**Impact**: A user who completed calibration via Edge Function (writing to `user_operator_profile`) but has no `business_profiles.calibration_status = 'complete'` will:
- Pass the SupabaseAuthContext check ✅
- Pass the `/api/calibration/status` check ✅
- FAIL the OAuth callback check and be routed to `/calibration` again ❌

### RISK 2: MongoDB Still Running (MEDIUM)
MongoDB is imported, initialized, and running. 18 collections contain data. No active code reads from it, but:
- `cognitive_core.py` (non-Supabase version) still exists and uses MongoDB
- If someone accidentally imports `cognitive_core` instead of `cognitive_core_supabase`, it would silently read/write stale MongoDB data
- The motor client is initialized on every server startup

### RISK 3: localStorage Shadow State (MEDIUM)
- `biqc_context_v1`: Written on every OAuth login but never read. Contains `calibration_status` and `onboarding_status` — stale after first write.
- `biqc_intelligence_state`: Written by `Advisor.js` (legacy), read by `MySoundBoard.js`. Creates a cross-page data dependency that bypasses Supabase. Not cleared on logout.
- `token` (legacy MongoDB JWT): Still checked by `api.js` interceptor, `VoiceChat.js`, `Integrations.js`, `ConnectEmail.js` as a fallback auth mechanism.

### RISK 4: Dead In-Memory State (LOW)
Five state variables in `SupabaseAuthContext.js` are declared, exposed in context, but never populated: `businessContext`, `contextLoading`, `contextError`, `contextSource`, `onboardingState`. Any component that reads these will get `null` or initial values forever.

### RISK 5: business_profiles_versioned vs business_profiles Read Priority (LOW)
`GET /business-profile` reads from `business_profiles_versioned` first. If a versioned profile exists, it flattens domain data and returns it. The mutable `business_profiles` row may contain different values. Writes go to BOTH tables. This means:
- A manual Supabase edit to `business_profiles` would be invisible if a versioned profile exists
- Version history creates divergence risk if the versioning system has bugs

### RISK 6: Duplicate Edge Function Directories (LOW)
Two directories exist: `/app/supabase/functions/calibration-psych/` and `/app/supabase/functions/calibration_psych/` (hyphen vs underscore). Both contain `index.ts`. Unclear which is deployed.

---

## 6. RECOMMENDED SINGLE SOURCE OF TRUTH

| Data Domain | Recommended Source | Current State |
|------------|-------------------|---------------|
| User identity | `users` (Supabase) | ✅ Consistent |
| Business identity, industry, stage | `business_profiles` (Supabase) | ⚠️ Also in `business_profiles_versioned` with read priority |
| Calibration completion | `user_operator_profile.persona_calibration_status` | ❌ `/api/auth/check-profile` still reads from `business_profiles` |
| Onboarding progress | `onboarding` (Supabase) | ✅ Consistent |
| Intelligence preferences | `intelligence_baseline` (Supabase) | ✅ Consistent |
| Intelligence state (positions) | `watchtower_insights` (Supabase) | ✅ Consistent |
| Raw signals | `observation_events` (Supabase) | ✅ Consistent |
| Escalation tracking | `escalation_memory` (Supabase) | ✅ Consistent |
| Behavioral model | `cognitive_profiles` (Supabase) | ✅ Consistent (via cognitive_core_supabase.py) |
| Auth token | Supabase session (`biqc-auth` localStorage key) | ⚠️ Legacy `token` key still checked as fallback |
| Focus area history | NOT in Supabase | ❌ Only in localStorage (`biqc_focus_history`) |

---

## END OF AUDIT

This report is observation-only. No code was modified. No data was migrated. No schemas were added.

Awaiting next instruction.
