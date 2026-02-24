# 🔒 MASTER PRE-BUILD ARCHITECTURE AUDIT
## BIQc Platform — Zero-Assumption Forensic Audit
## Date: 2026-02-24

---

## BLOCK A — ONBOARDING STATE MACHINE MAP

### State Orchestrator
**Single orchestrator:** `useCalibrationState.js` (hook, 326 lines)
- Controls ALL calibration states via `entry` state variable
- Manages: loading → welcome → analyzing → wow_summary → calibrating → completing
- **No Redux/reducer** — uses React useState directly
- State transitions triggered by API responses from `calibration-psych` Edge Function

### Routing Orchestrator
**`ProtectedRoute.js`** manages the gate sequence:
```
AUTH_STATE.LOADING → LoadingScreen
AUTH_STATE.NEEDS_CALIBRATION → redirect /calibration
AUTH_STATE.READY → check onboardingStatus → redirect /onboarding if incomplete
AUTH_STATE.READY + onboarding complete → render children
```

### Screen Status Map

| Screen | Active | Legacy | Conditional | Drive Type | Trigger | Controller |
|--------|--------|--------|-------------|------------|---------|------------|
| auth-loading | YES | NO | YES — only during auth bootstrap | State | `AUTH_STATE.LOADING` | SupabaseAuthContext |
| cognitive-first | YES | NO | YES — only on first visit (no cache) | State | `loading && cacheAge === null` | useSnapshot |
| cognitive-return | YES | NO | YES — only on return visit (has cache) | State | `loading && cacheAge !== null` | useSnapshot |
| welcome | YES | NO | YES — new users or `detectState` returns NEW | State | `entry === 'welcome'` | useCalibrationState |
| manual-summary | YES | NO | YES — only if user clicks "no website" | State | `onManualFallback()` | useCalibrationState |
| analyzing | YES | NO | YES — during website audit | State | `handleAuditSubmit()` | useCalibrationState |
| wow-summary | YES | NO | YES — if Edge Function returns audit data | State | API returns `wow_summary` | useCalibrationState |
| continuity | YES | NO | YES — if calibration IN_PROGRESS step > 1 | State | `detectState` finds partial | useCalibrationState |
| wizard-q1..q9 | YES | NO | YES — when Edge returns `question + options` | State | `applyResponse()` with options | useCalibrationState |
| chat | YES | NO | YES — when Edge returns `message` only | State | `applyResponse()` without options | useCalibrationState |
| reveal-progress | YES | NO | YES — during completion animation | State | `triggerComplete()` | useCalibrationState |
| reveal-complete | YES | NO | YES — final phase of reveal | State | `revealPhase >= length-1` | useCalibrationState |
| onboard-decision | YES | SEMI | YES — after calibration, before onboarding | Route | `/onboarding-decision` route | OnboardingDecision (standalone) |
| onboard-welcome | YES | NO | YES — step 0 of OnboardingWizard | State | `currentStep === 0` | OnboardingWizard |
| onboard-identity | YES | NO | YES — step 1 | State | `currentStep === 1` | OnboardingWizard |
| onboard-market | YES | NO | YES — step 3 | State | `currentStep === 3` | OnboardingWizard |
| onboard-goals | YES | NO | YES — step 6 | State | `currentStep === 6` | OnboardingWizard |

### Duplicated State Logic
- **YES — OVERLAP DETECTED:** `useCalibrationState.js` manages calibration entry states AND calls `apiClient.post('/console/state')` for auto-save. `OnboardingWizard.js` manages its own `currentStep` state independently. These are TWO separate state machines with no shared orchestrator.
- The `ProtectedRoute` acts as a meta-orchestrator but uses TWO different data sources: `authState` from context (for calibration) and `onboardingStatus` from context (for onboarding).
- **calibration-psych** Edge Function has its OWN step counter (`computeStep` from `operator_profile`) that may desync from frontend `currentStep`.

---

## BLOCK B — AI PIPELINE ARCHITECTURE MAP

### Edge Functions (Supabase — gpt-4o-mini)

| Function | Purpose | Temperature | Max Tokens | Deterministic | Shared Prompts | Caching | Logging |
|----------|---------|-------------|------------|---------------|----------------|---------|---------|
| biqc-insights-cognitive | Main cognitive engine | 0.5 | 3000 | NO | NO — unique prompt | YES (intelligence_snapshots) | YES (usage_tracking) |
| calibration-psych | 9-step persona profiling | DEFAULT | DEFAULT | NO | NO — SYSTEM_PROMPT in file | NO | YES (usage_tracking) |
| calibration-sync | Sync calibration → profile | 0.1 | DEFAULT | SEMI | NO | NO | NO |
| calibration-business-dna | Website → business audit | 0.3 | 500 | NO | NO | NO | NO |
| boardroom-diagnosis | Board room analysis | 0.7 | 800 | NO | NO | NO | NO |
| strategic-console-ai | Strategic responses | 0.7 | 400 | NO | NO | NO | NO |
| cfo-cash-analysis | Financial analysis | 0.2 | DEFAULT | SEMI | NO | YES (intelligence_snapshots) | NO |
| competitor-monitor | Competitor scanning | 0.2 | 1500 | NO | NO | YES (intelligence_snapshots) | NO |
| market-analysis-ai | Market analysis | 0.6 | 500 | NO | NO | NO | NO |
| sop-generator | SOP generation | 0.4 | 3000 | NO | NO | NO | NO |
| watchtower-brain | Background analysis | DEFAULT | DEFAULT | NO | NO | NO | NO |

### Backend Routes (FastAPI — gpt-4o via emergentintegrations)

| Route | Purpose | Model | Shared Prompt Registry | Caching |
|-------|---------|-------|----------------------|---------|
| /soundboard/chat | Conversations | gpt-4o | YES (prompt_registry) | NO |
| /calibration/answer | Calibration | gpt-4o | YES (prompt_registry) | NO |
| /boardroom/respond | Boardroom AI | gpt-4o | NO (inline) | NO |
| /email/analyze-priority | Email analysis | gpt-4o | YES (prompt_registry) | NO |
| /email/suggest-reply | Reply generation | gpt-4o | YES (prompt_registry) | NO |
| /research/analyze-website | Website research | gpt-4o | NO (inline) | NO |
| /generate/sop | SOP generation | gpt-4o | NO (inline) | NO |

### Executive CMO Snapshot Generation
- Generated by: **biqc-insights-cognitive** Edge Function (primary)
- Fallback: **intelligence-snapshot** Edge Function (if cognitive fails)
- NOT generated by manual-summary or wow-summary pipelines
- wow-summary is generated by calibration-business-dna Edge Function (separate pipeline)

### Centralization Status
- **Temperature/tokens:** NOT centralized — each function has its own config
- **Prompt structure:** PARTIALLY centralized — backend uses `prompt_registry` table, Edge Functions use inline prompts
- **Logging:** INCONSISTENT — only some functions log to `usage_tracking`
- **Caching:** INCONSISTENT — only cognitive and competitor functions cache to `intelligence_snapshots`

---

## BLOCK C — SCHEMA IMPACT RISK ASSESSMENT

### Onboarding Data Tables

| Table | Used By Onboarding | Calibration Writes | Wizard Populates | RLS |
|-------|-------------------|-------------------|-----------------|-----|
| user_operator_profile | YES | YES (persona_calibration_status, operator_profile, agent_persona, agent_instructions) | NO | INSUFFICIENT DATA |
| business_profiles | YES | YES (last_calibration_step) | YES (via OnboardingWizard) | INSUFFICIENT DATA |
| strategic_console_state | YES | YES (is_complete, status) | NO | INSUFFICIENT DATA |
| onboarding | YES | NO | YES (via /onboarding/save) | INSUFFICIENT DATA |
| calibration_sessions | YES | YES (session data) | NO | INSUFFICIENT DATA |
| cognitive_profiles | NO | NO | NO | INSUFFICIENT DATA |
| accounts | YES | NO | YES (workspace creation) | INSUFFICIENT DATA |

### Write Permission Conflicts
- **business_profiles** is written by BOTH calibration (defer/reset) AND onboarding wizard → potential conflict
- **user_operator_profile** is written by calibration-psych Edge Function AND backend /calibration/skip AND backend /calibration/defer → triple-write risk
- **strategic_console_state** is written by calibration-psych (on complete) AND /calibration/skip → dual-write

### Schema Notes
- No `market_context_profile` table exists — INSUFFICIENT DATA
- No `marketing_audit` table exists — INSUFFICIENT DATA
- No `channel_metrics` table exists — INSUFFICIENT DATA
- No `provider_tokens` table exists — tokens stored in `m365_tokens`, `outlook_oauth_tokens`, `gmail_connections`

---

## BLOCK D — MARKET STATE LOGIC DIAGRAM

### State Determination: AI-INFERRED
- System state is determined by the **biqc-insights-cognitive** Edge Function
- The AI outputs: `{ status: "STABLE|DRIFT|COMPRESSION|CRITICAL", confidence: 0-100, interpretation: "...", velocity: "improving|stable|worsening" }`
- **NOT hardcoded, NOT rule-based, NOT weighted scoring** — purely AI-inferred from data context

### State Flow
```
Data Sources → biqc-insights-cognitive (OpenAI) → system_state JSON → Frontend renders
```

### Scoring
- **No single scoring function** — the AI determines state holistically
- **Server-side only** — frontend only reads and displays
- Confidence is a 0-100 value outputted by the AI

### Recalibration
- EXISTS: CheckInAlerts offers recalibration
- EXISTS: Settings page has "Recalibrate" button
- EXISTS: Super admin user menu has "Recalibrate"

### Drift States
- IMPLEMENTED: STABLE, DRIFT, COMPRESSION, CRITICAL with velocity (improving/stable/worsening)
- Frontend renders each with distinct colors and indicators

### Shared Signal Scoring Utility
- **DOES NOT EXIST** — no shared scoring utility across components

---

## BLOCK E — INTEGRATION ARCHITECTURE SUMMARY

### OAuth Framework: YES
- **Google OAuth:** via Supabase Auth (social login)
- **Microsoft OAuth:** via Supabase Auth (social login) + direct M365 tokens for email/calendar
- **Outlook email:** Direct OAuth flow → tokens in `outlook_oauth_tokens` and legacy `m365_tokens`
- **Gmail:** Direct OAuth flow → tokens in `gmail_connections`
- **Google Drive:** Direct OAuth flow → tokens in `google_drive_files`

### Token Storage
| Table | Provider | Status |
|-------|----------|--------|
| m365_tokens | Microsoft (legacy) | ACTIVE |
| outlook_oauth_tokens | Microsoft (Edge Function) | ACTIVE |
| gmail_connections | Google | ACTIVE |
| integration_accounts | Merge.dev (all providers) | ACTIVE |
| merge_integrations | Merge.dev linked accounts | ACTIVE |

### No `provider_tokens` consolidated table — tokens scattered across 5 tables
### No `integration_status` flags table — status inferred from presence of records
### No `channel_health` metrics table — DOES NOT EXIST

### Channel Performance Analysis: NOT IMPLEMENTED
### Rate Limiting: NOT IMPLEMENTED
### Integration Gated by Subscription: NOT IMPLEMENTED (all users can connect all integrations)

---

## BLOCK F — MONETISATION ENFORCEMENT MAP

### Forensic Calibration Gating: NOT IMPLEMENTED
- No feature flags
- No tier control
- No paid gate

### Stripe: NOT INTEGRATED
- Only test file references exist — no Stripe routes, no payment processing, no webhook handlers

### Gating: CLIENT-SIDE ONLY
- `BusinessProfile.js` checks `user?.subscription_tier` and `user?.is_master_account`
- `isPaidUser` and `isEnterprise` computed client-side
- **No server-side enforcement** — all features accessible to all roles

### Plan Tiers
- Stored in `users.subscription_tier` column
- Default: "free"
- Values: free, trial, pro, enterprise
- `is_master_account` flag overrides all tiers

### Entitlement Middleware: DOES NOT EXIST
- No middleware checks entitlements before route access
- Only role-based gates (admin/superadmin) exist

---

## BLOCK G — PERFORMANCE CONSTRAINTS REPORT

| Metric | Value |
|--------|-------|
| SSR | NOT USED (CRA — client-side only) |
| Bundle Size (gzip) | ~495KB JS |
| Bundle Size (raw) | 1.68MB JS |
| Loading Skeleton System | PARTIAL (PageSkeleton in 2 pages) |
| AI Calls | ASYNC (non-blocking) |
| Background Job Queue | MINIMAL (regeneration_governance only) |
| First Paint | INSUFFICIENT DATA — no profiling configured |
| AI Response Latency | INSUFFICIENT DATA — no tracking dashboard |
| Max Onboarding Animation | 12s (first visit), 8s (return) in CognitiveLoadingScreen |
| pg_cron Jobs | YES (watchtower-brain, competitor-monitor, cfo-cash-analysis) |

---

## BLOCK H — DUPLICATION RISK MATRIX

| Proposed Upgrade | Exists? | Duplication Risk | Collides With |
|-----------------|---------|-----------------|---------------|
| Cinematic ignition screen | YES — CognitiveLoadingScreen + InitiatingBIQC | **HIGH** — would duplicate existing 2 loading components | CognitiveLoadingScreen, InitiatingBIQC |
| Adaptive context engine | NO | **LOW** — no existing duplicate answer detection | calibration-psych Edge Function prompt would need modification |
| Drift snapshot layer | PARTIAL — DRIFT state exists in cognitive engine | **MEDIUM** — dedicated snapshot layer would overlap with biqc-insights-cognitive state output | system_state.status in cognitive engine |
| Recalculation animation | PARTIAL — CheckInAlerts has recalibration prompt | **MEDIUM** — new animation could conflict with existing recalibration flow | CheckInAlerts, /calibration route |
| Paid forensic calibration | NO | **LOW** — no gating exists, but must not duplicate calibration-psych pipeline | calibration-psych Edge Function |
| Misalignment engine | PARTIAL — alignment section exists in AdvisorWatchtower + contradiction_memory table | **HIGH** — would duplicate existing alignment/contradiction detection | strategic_alignment_check, contradiction_memory table, alignment section in dashboard |

---

## BLOCK I — CONSTRAINT CONFIRMATION

| Constraint | Status |
|------------|--------|
| No new tables unless critical | ✅ CONFIRMED |
| No schema migration without approval | ✅ CONFIRMED |
| No replacement of Market tab logic | ✅ CONFIRMED — MarketPage.js is standalone |
| No duplication of AI advisory pipeline | ⚠️ RISK — biqc-insights-cognitive + soundboard + calibration-psych are 3 separate pipelines with no shared prompt infrastructure |
| No duplicate scoring engines | ✅ CONFIRMED — no scoring engine exists to duplicate |
| No global state mutation | ✅ CONFIRMED — no Redux/global store |
| No new global reducers | ✅ CONFIRMED — no reducer pattern used |
| No UI refactor outside onboarding | ✅ CONFIRMED |
| No performance regression >400ms | ⚠️ RISK — no performance monitoring baseline exists to measure against |
| No routing modification beyond onboarding | ✅ CONFIRMED |

---

## SAFE MODIFICATION ZONES

1. `useCalibrationState.js` — calibration state management (self-contained hook)
2. `CalibrationAdvisor.js` — calibration page container (renders based on entry state)
3. `CalibratingSession.js` — wizard/chat UI (pure presentation)
4. `CalibrationComponents.js` — welcome, manual summary, analyzing (pure presentation)
5. `WowSummary.js` — audit summary display (pure presentation)
6. `ExecutiveReveal.js` — completion animation (pure presentation)
7. `ContinuitySuite.js` — resume session UI (pure presentation)
8. `CognitiveLoadingScreen.js` — loading animation (pure presentation)
9. `OnboardingWizard.js` — onboarding form steps (self-contained)
10. `calibration-psych` Edge Function — AI calibration logic (isolated)

## RESTRICTED ZONES

1. **ProtectedRoute.js** — routing gate logic. Any change risks auth loops.
2. **SupabaseAuthContext.js** — auth state bootstrap. Critical path — mutation causes cascading failures.
3. **biqc-insights-cognitive** Edge Function — main cognitive engine. Shared by dashboard, watchtower, all intelligence.
4. **user_operator_profile** table — written by 3 different systems. Schema changes cascade.
5. **strategic_console_state** table — calibration completion flag. Incorrect writes cause infinite redirect loops.
6. **business_profiles** table — shared by onboarding AND calibration. Write conflicts possible.
7. **AdvisorWatchtower.js** — main dashboard. Any modification affects primary user experience.
8. **DashboardLayout.js** — sidebar + top bar. Affects all authenticated pages.

---

## END OF FORENSIC AUDIT
