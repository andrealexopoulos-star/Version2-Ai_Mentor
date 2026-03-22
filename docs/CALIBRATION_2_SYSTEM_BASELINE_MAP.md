# Calibration 2.0 System Baseline Map

## A. Journey System Map (Signup -> Calibration -> Market)

### Auth and Entry

- `frontend/src/pages/RegisterSupabase.js`
- `frontend/src/pages/LoginSupabase.js`
- `frontend/src/pages/AuthCallbackSupabase.js`
- `frontend/src/context/SupabaseAuthContext.js`
- `frontend/src/components/ProtectedRoute.js`

### Calibration Orchestration

- `frontend/src/pages/CalibrationAdvisor.js`
- `frontend/src/hooks/useCalibrationState.js`
- `frontend/src/components/calibration/CalibrationComponents.js`
- `frontend/src/components/calibration/ForensicIdentityCard.js`
- `frontend/src/components/calibration/ChiefMarketingSummary.js`
- `frontend/src/components/calibration/AgentCalibrationChat.js`
- `frontend/src/components/calibration/PostCMOIntegrationOverlay.js`
- `frontend/src/components/calibration/IntelligencePhases.js`
- `frontend/src/components/calibration/ExecutiveReveal.js`
- `frontend/src/components/CognitiveLoadingScreen.js`
- `frontend/src/components/calibration/WowSummary.js`
- `frontend/src/components/calibration/ContinuitySuite.js`
- `frontend/src/components/calibration/CalibratingSession.js`

### Market Destination

- `frontend/src/pages/MarketPage.js`
- `frontend/src/components/DashboardLayout.js`

## B. Completion and State Authority Baseline

### Backend authority

- `backend/routes/calibration.py`
  - `GET /api/calibration/status`
  - `POST /api/console/state`

### Profile write path

- `backend/routes/profile.py`
  - `PUT /api/business-profile`
  - model: `BusinessProfileUpdate`

### Current authority model

1. `strategic_console_state.is_complete`
2. fallback `user_operator_profile.persona_calibration_status`
3. otherwise calibration required

## C. Edge Function Baseline (Calibration Critical Path)

Critical path candidates:

- `supabase/functions/calibration-business-dna`
- `supabase/functions/scrape-business-profile`
- `supabase/functions/business-identity-lookup`
- `supabase/functions/calibration-psych`
- `supabase/functions/competitor-monitor`
- `supabase/functions/market-signal-scorer`
- `supabase/functions/market-analysis-ai`
- `supabase/functions/biqc-insights-cognitive`
- `supabase/functions/calibration-sync`

Known duplicate/drift risks:

- duplicate folders between `supabase/functions` and `supabase_edge_functions`
- slug drift (`calibration-psych` vs `calibration_psych`, `outlook_auth` vs `outlook-auth`)

## D. Priority Inbox Baseline

### Frontend

- `frontend/src/pages/EmailInbox.js`

### Backend / data access

- `backend/routes/email.py`
- `backend/supabase_intelligence_helpers.py`
- `backend/supabase_email_helpers.py`

### Edge / schema

- `supabase/functions/email_priority`
- `supabase/migrations/051_priority_inbox.sql`
- `supabase/migrations/052_email_cron_jobs.sql`

### Baseline risk summary

- split source-of-truth paths
- provider parity gaps
- limited explainability surface
- weak action rail

## E. Calendar Baseline

### Frontend

- `frontend/src/pages/CalendarView.js`
- `frontend/src/pages/AdvisorWatchtower.js` (draft event handoff)

### Backend

- `backend/routes/email.py`
  - `GET /api/outlook/calendar/events`
  - `POST /api/outlook/calendar/create`
  - `POST /api/outlook/calendar/sync`

### Token refresh and scopes

- `supabase/functions/refresh_tokens/index.ts`

### Baseline capability

- Read and create exist
- full update/delete lifecycle not fully surfaced end-to-end
- date-window and label semantics not aligned with "upcoming only" expectation

## F. Reports and Artifact Baseline

### Frontend page

- `frontend/src/pages/ReportsPage.js`

### Current requirement delta

- Add "Generate Deep CMO Report" and "Forensic Market Exposure"
- Add plan quotas and 30-day windows
- Add downloadable PDF artifact under reports storage path
- Keep page gated with tab-level experience for free users

## G. Animation Baseline and Dead/Underused Signals

Potential dead or underused assets/components:

- `frontend/src/components/InitiatingBIQC.js` (appears unreferenced)
- imported-but-unused motion modules in market and calibration pages
- duplicated keyframe definitions across route/component files

Hard transition break:

- calibration completion currently exits via hard navigation (`window.location.href`), not continuous route transition choreography.

