# BIQC FULL PLATFORM AUDIT REPORT
## Date: February 10, 2026
## Classification: Observation Only — No Fixes Applied

---

## 1. CORRECT BEHAVIOUR

### 1.1 Calibration Source Alignment
- `SupabaseAuthContext.js` bootstrap reads `user_operator_profile.persona_calibration_status` first, with backend fallback. **CORRECT.**
- `/api/calibration/status` endpoint reads `user_operator_profile.persona_calibration_status` only. **CORRECT.**
- `/api/auth/check-profile` endpoint reads `user_operator_profile.persona_calibration_status` only. **CORRECT.**
- `CalibrationAdvisor.js` on-mount check reads `user_operator_profile.persona_calibration_status` via Supabase client. **CORRECT.**
- `AuthCallbackSupabase.js` checks `user_operator_profile.persona_calibration_status` via REST API. **CORRECT.**

### 1.2 Data Authority
- `GET /api/business-profile` reads from `business_profiles` table (authoritative). **CORRECT.**
- `GET /api/business-profile/scores` calculates from `business_profiles` table. **CORRECT.**
- `POST /api/onboarding/save` writes to both `onboarding` AND `business_profiles`. **CORRECT.**
- No MongoDB reads/writes in any active code path. **CORRECT.**
- No `localStorage` business state writes. **CORRECT.**

### 1.3 Sidebar Navigation
All 11 sidebar items have corresponding routes in `App.js`. No broken links. **CORRECT.**

### 1.4 Onboarding Wizard
- Pre-loads existing data from `GET /api/business-profile/context`. **CORRECT.**
- Auto-saves with 1.5s debounce. **CORRECT.**
- Resumes from `last_completed_step` on return. **CORRECT.**
- Shows "pre-filled" badges for existing data. **CORRECT.**

---

## 2. DEFECTS

### CRITICAL

#### C1: War Room and Legacy Calibration Write to Wrong Table
**Location**: `server.py` lines 2970-2976, 2985-2988, 3149-3152
**Description**: Three backend endpoints write `calibration_status = 'complete'` to `business_profiles` table but NEVER write `persona_calibration_status = 'complete'` to `user_operator_profile`.
- `POST /api/calibration/answer` (legacy 9-step): writes `business_profiles.calibration_status = 'complete'`
- `POST /api/calibration/brain` (War Room): writes `business_profiles.calibration_status = 'complete'`
- `POST /api/calibration/defer`: writes `business_profiles.calibration_status = 'deferred'`

**Impact**: A user who completes calibration via the War Room or legacy 9-step flow will have `business_profiles.calibration_status = 'complete'` but `user_operator_profile.persona_calibration_status` will remain `null` or `in_progress`. Since the auth system now reads ONLY from `user_operator_profile`, these users will be permanently stuck in calibration.

**Affected users**: Any user who completed calibration through the War Room flow (not the Edge Function).

**Root cause**: The data-plane remediation removed `business_profiles.calibration_status` reads from the auth chain but did not update the write path of these endpoints to also write to `user_operator_profile`.

#### C2: Calibration Completion via Edge Function Only Path
**Location**: `/app/supabase/functions/calibration-psych/index.ts` line 195
**Description**: The Edge Function is the ONLY code path that writes `persona_calibration_status = 'complete'` to `user_operator_profile`. The `/calibration` page calls this Edge Function. However, the War Room (`/war-room`) and the legacy 9-step flow (`/api/calibration/answer`) do NOT call the Edge Function — they use separate backend endpoints that only write to `business_profiles`.

**Impact**: Two parallel calibration systems exist, but only one writes to the authoritative source.

#### C3: ProtectedRoute adminOnly Prop Not Handled
**Location**: `ProtectedRoute.js` — the component signature is `ProtectedRoute({ children })` but App.js passes `adminOnly` prop on line 128.
**Description**: The `adminOnly` prop is accepted by the route definition but the `ProtectedRoute` component does not destructure or check it. The admin route at `/admin` has no access control beyond basic authentication.

**Impact**: Any authenticated user can access `/admin`.

### HIGH

#### H1: Onboarding Gate Fires Additional API Call on Every Protected Route
**Location**: `ProtectedRoute.js` lines 60-79
**Description**: Every time `ProtectedRoute` renders with `authState === READY`, it makes a `GET /api/onboarding/status` API call. This happens on:
- Every page navigation
- Every React re-render that changes the `authState` or `user` dependency
The result is not cached in React context — each mount of `ProtectedRoute` triggers a fresh call.

**Impact**: Potentially dozens of redundant API calls per session. Users see a brief loading spinner on every navigation as the onboarding check completes.

#### H2: Onboarding Status Auto-Complete Based on Stale `company_name`
**Location**: `server.py` lines 5780-5796
**Description**: `GET /api/onboarding/status` auto-marks onboarding as `completed: True` if `current_user.get("company_name")` is truthy and no onboarding record exists. The `company_name` field comes from the `users` table (populated during registration or OAuth metadata).

**Impact**: A new user who signed up with a company name in their Google profile (e.g., `company_name: "Google"`) will have onboarding auto-completed without ever seeing the wizard. This silently bypasses the entire Business DNA collection flow.

#### H3: `fetchUserProfile` Never Reads from `users` Table
**Location**: `SupabaseAuthContext.js` lines 113-133
**Description**: The `fetchUserProfile` function only reads from `existingSession.user.user_metadata` (OAuth profile metadata). It never queries the Supabase `users` table. Fields like `subscription_tier`, `company_name`, `industry`, and `role` are always hardcoded defaults (`subscription_tier: 'free'`, `is_master_account` checked against a single hardcoded email).

**Impact**: The frontend `user` object never reflects actual database values for subscription tier, role, or company name. Even if a user is upgraded to a paid tier in Supabase, the frontend will always show `free`.

### MEDIUM

#### M1: `calibration/defer` Writes to `business_profiles` Only
**Location**: `server.py` lines 2489-2523
**Description**: `POST /api/calibration/defer` writes `calibration_status = 'deferred'` to `business_profiles` table. It does NOT write to `user_operator_profile`. Since the auth system now reads from `user_operator_profile` only, the "deferred" status is invisible to the routing system.

**Impact**: Deferring calibration has no effect on the auth gate. The user will still be routed to `/calibration` on next login.

#### M2: `calibration/init` Writes `in_progress` to `business_profiles` Only
**Location**: `server.py` lines 2598-2604
**Description**: `POST /api/calibration/init` sets `calibration_status = 'in_progress'` on `business_profiles`. This status is never read by the auth system.

**Impact**: No functional impact (cosmetic only), but creates stale state.

#### M3: Board Room and War Room Have No Back Navigation
**Location**: App.js lines 122-123, BoardRoom.js, WarRoomConsole.js
**Description**: Both `/war-room` and `/board-room` are wrapped in `<div className="h-screen bg-black">` with no `DashboardLayout`. Neither component includes the sidebar. The user must use the browser back button or manually navigate.

**Impact**: UX dead-end. Users unfamiliar with the app may feel trapped.

#### M4: `PublicRoute` Skips Onboarding Check
**Location**: App.js lines 54-72
**Description**: `PublicRoute` redirects authenticated users directly to `/advisor` (line 68) without checking onboarding status. `ProtectedRoute` does check onboarding and would redirect to `/onboarding`. The user briefly lands on `/advisor`, sees a loading spinner, then gets redirected to `/onboarding`.

**Impact**: Visual flash/bounce on redirect. Not broken, but jarring UX.

#### M5: AuthCallbackSupabase Skips Onboarding Check
**Location**: `AuthCallbackSupabase.js` line 141
**Description**: After OAuth callback, if calibration is complete, the user is routed directly to `/advisor`. The onboarding check is not performed in the callback — it's deferred to `ProtectedRoute`. This causes a redirect chain: callback → /advisor → loading → /onboarding.

**Impact**: Same as M4 — redirect bounce after OAuth login.

#### M6: Dead Routes in App.js
**Location**: App.js lines 102-108
**Description**: Multiple routes exist that are NOT in the sidebar and appear to be legacy or development artifacts:
- `/advisor-legacy` → `Advisor` component (old version)
- `/oac` → `OpsAdvisoryCentre`
- `/intel-centre` → `IntelCentre`
- `/outlook-test` → `OutlookTest`
- `/gmail-test` → `GmailTest`
- `/diagnosis` → `Diagnosis`
- `/analysis` → `Analysis`
- `/market-analysis` → `MarketAnalysis`
- `/sop-generator` → `SOPGenerator`
- `/data-center` → `DataCenter`
- `/documents`, `/documents/:id` → `Documents`, `DocumentView`
- `/email-inbox` → `EmailInbox`
- `/watchtower` → `Watchtower` (old V1)
- `/auth-debug` → `AuthDebug`

**Impact**: Users who discover these URLs can access pages that may be incomplete, broken, or inconsistent with the current platform state. 15 routes exist with no sidebar navigation.

### LOW

#### L1: Settings Page Reads from `/api/business-profile` for Preferences
**Location**: Settings.js lines 34, 46
**Description**: The Settings page reads and writes the same `business_profiles` data as the Business DNA page. Both pages show overlapping fields (e.g., advice_style, communication tools). Edits on one page are not reflected on the other until a manual refresh.

**Impact**: Users may see stale data if they edit preferences in Settings then navigate to Business DNA (or vice versa).

#### L2: `onboardingComplete` Default is `true` in ProtectedRoute
**Location**: ProtectedRoute.js line 57
**Description**: `onboardingComplete` is initialized to `true` to "avoid flash". If the API call fails, `onboardingComplete` stays `true` (line 71-72, fail-open). This means a user with incomplete onboarding who experiences a network error will bypass the onboarding gate.

**Impact**: Minor — fail-open is intentional to prevent blocking. But it means the onboarding gate can be bypassed with network issues.

#### L3: Duplicate Edge Function Directories
**Location**: `/app/supabase/functions/calibration-psych/` and `/app/supabase/functions/calibration_psych/`
**Description**: Two directories exist with hyphen vs underscore naming. Both contain `index.ts`.

**Impact**: Ambiguity about which is deployed. No runtime impact if only one is deployed to Supabase.

---

## 3. ROUTING & GATE FAILURES

### Gate Chain (Authenticated User)

```
Login/OAuth → Session Created
   ↓
SupabaseAuthContext bootstrap:
   → Reads user_operator_profile.persona_calibration_status
   → Sets authState = READY or NEEDS_CALIBRATION
   ↓
ProtectedRoute:
   NEEDS_CALIBRATION → /calibration (allowed: /calibration, /settings, /onboarding, /onboarding-decision, /profile-import)
   READY → Check /api/onboarding/status
       → If completed=false AND not exempt path → /onboarding
       → If completed=true → render children
```

### WHY a calibrated user is still routed to /calibration

**Root Cause Diagnosis:**

A calibrated user will be routed to `/calibration` if and only if `user_operator_profile.persona_calibration_status` is NOT `'complete'` for their user_id.

This happens when:

1. **The user completed calibration via the War Room** (`POST /api/calibration/brain`): This endpoint writes `calibration_status = 'complete'` to `business_profiles` but NEVER writes to `user_operator_profile`. The auth system only reads `user_operator_profile` → user appears uncalibrated. **[DEFECT C1]**

2. **The user completed calibration via the legacy 9-step flow** (`POST /api/calibration/answer`): Same issue — writes to `business_profiles` only. **[DEFECT C1]**

3. **The `user_operator_profile` row doesn't exist** for this user (e.g., they registered before the table was created). The Supabase REST query returns an empty array → calibration appears incomplete.

4. **RLS blocks the client-side query**: If Row-Level Security on `user_operator_profile` doesn't grant `SELECT` to the authenticated user for their own row, the Supabase client query in `CalibrationAdvisor.js` (line 104) returns null even for completed users.

5. **The user deferred calibration** (`POST /api/calibration/defer`): This writes `calibration_status = 'deferred'` to `business_profiles` only. The auth system doesn't see it → user is still routed to `/calibration`. **[DEFECT M1]**

---

## 4. DATA PERSISTENCE GAPS

### 4.1 Fields Collected But Not Persisted

| Page | Field | Expected Destination | Actually Written? |
|------|-------|---------------------|-------------------|
| OnboardingWizard | `current_tools` (checkboxes) | `business_profiles` | NO — not in `field_mapping` in `/api/onboarding/save`. Written to `onboarding.onboarding_data` only. |
| OnboardingWizard | `advice_style` | `business_profiles` | NO — not in `field_mapping`. Written to `onboarding.onboarding_data` only. |
| OnboardingWizard | `competitive_advantages` | `business_profiles` | NO — not in `field_mapping`. Only pre-loaded from profile, never written back. |
| OnboardingWizard | `long_term_goals` | `business_profiles` | NO — not in `field_mapping`. Only pre-loaded. |

### 4.2 Fields Read But Never Written

| Page | Field Read | Source | Written By |
|------|-----------|--------|------------|
| DashboardLayout | `user.name` | `SupabaseAuthContext.fetchUserProfile` | Never — `name` key doesn't exist. Uses `full_name` from metadata. Should be `user?.full_name`. |

### 4.3 Calibration Write Path Summary

| Endpoint | Writes to `business_profiles.calibration_status` | Writes to `user_operator_profile.persona_calibration_status` |
|----------|--------------------------------------------------|-------------------------------------------------------------|
| Edge Function `calibration-psych` | NO | YES ('complete') |
| `POST /api/calibration/brain` (War Room) | YES ('complete') | NO |
| `POST /api/calibration/answer` (Legacy 9-step) | YES ('complete') | NO |
| `POST /api/calibration/defer` | YES ('deferred') | NO |
| `POST /api/calibration/init` | YES ('in_progress') | NO |

---

## 5. UX FRICTION POINTS

### F1: Triple Loading Spinner on OAuth Login
OAuth callback → 1.5s artificial wait → calibration check → navigate to `/advisor` → ProtectedRoute loading spinner → onboarding check → navigate to `/onboarding` (if needed). User sees 3 loading states.

### F2: No Way to Skip Onboarding
The `OnboardingWizard` has a "Save and continue later" button (line ~530 of OnboardingWizard.js) that navigates to `/advisor`. But `ProtectedRoute` will redirect them back to `/onboarding` because onboarding is still incomplete. The escape hatch doesn't work.

### F3: Board Room / War Room Missing Navigation
No sidebar, no breadcrumb, no back button. Users must use browser navigation.

### F4: DashboardLayout `user.name` Undefined
`DashboardLayout.js` line 329 references `user?.name` but the user object from `SupabaseAuthContext` has `full_name`, not `name`. The avatar shows "U" and the greeting shows "User" for all users.

---

## 6. DATA FLOW TRACE

### Supabase Tables → Pages → Agents

| Table | Read By (Frontend Pages) | Read By (Backend Agents/Modules) | Written By |
|-------|-------------------------|----------------------------------|------------|
| `user_operator_profile` | CalibrationAdvisor, SupabaseAuthContext, AuthCallbackSupabase | BoardRoom endpoint, `/api/calibration/status`, `/api/auth/check-profile`, `/api/business-profile/context` | Edge Function `calibration-psych` ONLY |
| `business_profiles` | BusinessProfile (Business DNA), Settings, OnboardingWizard | build_advisor_context, watchtower_engine, BoardRoom, intelligence_baseline, all chat agents | `/api/business-profile PUT`, `/api/onboarding/save`, `/api/calibration/answer`, `/api/calibration/brain`, `/api/calibration/defer`, `/api/calibration/init` |
| `onboarding` | OnboardingWizard (via context endpoint), ProtectedRoute (via status endpoint) | build_advisor_context, profile scores | `/api/onboarding/save`, `/api/onboarding/complete` |
| `intelligence_baseline` | IntelligenceBaseline page | intelligence_baseline.py, `/api/business-profile/context` | `POST /api/baseline` |
| `cognitive_profiles` | (none directly) | cognitive_core_supabase.py (via watchtower, advisor chat) | cognitive_core_supabase.py |
| `advisory_log` | (none directly) | cognitive_core_supabase.py | cognitive_core_supabase.py |
| `chat_history` | (none directly — fetched via API) | build_advisor_context | `POST /api/chat` |
| `observation_events` | (none directly) | watchtower_engine.py, merge_emission_layer.py | `POST /api/watchtower/emit`, merge_emission_layer.py |
| `watchtower_insights` | OperatorDashboard (via API) | watchtower_engine.py, BoardRoom | watchtower_engine.py |
| `escalation_memory` | (none directly) | escalation_memory.py, BoardRoom | escalation_memory.py |
| `contradiction_memory` | (none directly) | contradiction_engine.py, BoardRoom | contradiction_engine.py |
| `decision_pressure` | (none directly) | pressure_calibration.py, BoardRoom | pressure_calibration.py |
| `evidence_freshness` | (none directly) | evidence_freshness.py, BoardRoom | evidence_freshness.py |
| `intelligence_snapshots` | OperatorDashboard (via API) | snapshot_agent.py | snapshot_agent.py |
| `soundboard_conversations` | MySoundBoard | build_advisor_context | `POST /api/soundboard/chat` |
| `users` | (indirectly via auth) | verify_supabase_token, build_advisor_context | Registration, OAuth account merge |
| `business_profiles_versioned` | (not read by pages since remediation) | `GET /api/business-profile/versioned`, `GET /api/business-profile/history` | `PUT /api/business-profile` |

### Non-Supabase State (Remaining)

| Store | Key | Read By | Written By | Content |
|-------|-----|---------|------------|---------|
| localStorage | `biqc-auth` | Supabase SDK | Supabase SDK | Session token (managed by SDK) |
| localStorage | `sidebar-collapsed` | DashboardLayout | DashboardLayout | Boolean |
| localStorage | `theme` | DashboardLayout | DashboardLayout | 'dark'/'light' |
| localStorage | `installPromptDismissed` | InstallPrompt | InstallPrompt | Timestamp |
| localStorage | `biqc_show_tutorial` | AdvisorWatchtower | Unknown origin | Boolean flag |
| sessionStorage | `onboarding_deferred` | OnboardingDecision | OnboardingDecision | Boolean flag |

---

## 7. REQUIRED FIXES (Ordered by Priority)

### Priority 1: Critical
1. **C1/C2 FIX**: Update `POST /api/calibration/brain` and `POST /api/calibration/answer` to also write `persona_calibration_status = 'complete'` to `user_operator_profile` when calibration completes. This is the ONLY way to unblock users who completed calibration via War Room.

2. **C3 FIX**: Add `adminOnly` prop handling to `ProtectedRoute` — check `user.role === 'admin'` when prop is passed.

### Priority 2: High
3. **H1 FIX**: Cache onboarding status in React context (or a ref) after the first successful check, avoiding redundant API calls on every navigation.

4. **H2 FIX**: Remove the `company_name` auto-complete logic in `GET /api/onboarding/status`. A user without an onboarding record should always be treated as incomplete, regardless of `company_name`.

5. **H3 FIX**: Update `fetchUserProfile` in `SupabaseAuthContext` to query the `users` table via Supabase REST API to get actual `subscription_tier`, `role`, `company_name`, and `is_master_account` values.

### Priority 3: Medium
6. **M1 FIX**: Update `POST /api/calibration/defer` to also write to `user_operator_profile` (e.g., `persona_calibration_status = 'deferred'`). Then update the auth gate to recognize 'deferred' as a valid state that allows passage.

7. **M3 FIX**: Add minimal back-navigation to Board Room and War Room (e.g., a back arrow or "Return to Dashboard" link).

8. **M4/M5 FIX**: Have `PublicRoute` and `AuthCallbackSupabase` route to `/advisor` and let `ProtectedRoute` handle the onboarding redirect. (Already happens — just accept the bounce or add onboarding check to callback.)

9. **M6 FIX**: Remove or gate the 15 dead routes that have no sidebar navigation.

### Priority 4: Low
10. **L1 FIX**: Deduplicate overlapping fields between Settings and Business DNA pages, or add cross-page cache invalidation.

11. **F4 FIX**: Change `user?.name` to `user?.full_name` in `DashboardLayout.js` (lines 329, 327).

12. **F2 FIX**: Make the "Save and continue later" button in OnboardingWizard mark a flag that prevents immediate re-redirect (e.g., add `/advisor` to `ONBOARDING_EXEMPT_PATHS` or set a session flag).

13. **4.1 FIX**: Add `current_tools`, `advice_style`, `competitive_advantages`, `long_term_goals` to the `field_mapping` in `POST /api/onboarding/save` so they persist to `business_profiles`.

---

## END OF AUDIT

This report is observation-only. No code was modified. No data was migrated. No schemas were added.

Awaiting next instruction.
