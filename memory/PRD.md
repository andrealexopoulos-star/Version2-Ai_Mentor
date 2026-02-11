# BIQC Platform — Product Requirements Document

## Original Problem Statement
BIQC is a deterministic lifecycle intelligence engine: Calibration → Onboarding → Integrations → BIQc Insights.

## Architecture
- Backend: FastAPI + Supabase (PostgreSQL)
- Frontend: React with Supabase Auth
- AI: OpenAI GPT-4o via Emergent LLM Key

## Lifecycle Coherence Sprint — Complete (Feb 2026)

### A) Calibration Consistency — PASS
- Settings reads `persona_calibration_status` from `/api/calibration/status` (DB authority only)
- Green dot + "Recalibrate Agent" when complete
- Screenshot verified

### B) Strategic Console No Redundant Questions — PASS  
- `resolve_facts()` + `build_known_facts_prompt()` injected into `/api/calibration/brain` BEFORE AI call
- Console skips known steps (verified: jumped to Step 8)

### C) Business DNA Auto-Save — PASS
- Debounced auto-save (1.5s) on every field change
- "Save Profile" button removed, replaced with "Auto-saves as you type" indicator
- DB confirmation: write "Melbourne, VIC (auto-saved)" → read back confirmed

### D) Integration Disconnect — PASS
- Disconnect buttons on all Merge-connected integration cards
- `POST /api/merge/disconnect` endpoint removes from `integration_accounts`
- Session preserved (no redirect)

### E) Recalibration Flow — PASS
- `POST /api/calibration/reset` archives persona, sets status to 'recalibrating'
- Settings "Recalibrate Agent" calls reset then routes to /calibration

### F) Website Enrichment — PASS (Guard 2)
- `POST /api/enrichment/website` with action="scan" returns DRAFT (not persisted)
- action="commit" persists to business_profiles
- No auto-write before explicit commit

### G) Operator View Intelligence State — PASS
- Shows "Intelligence State Diagnosis" with DB-sourced reasons
- Lists integrations, domains, and explicit "No observation events" message
- Screenshot verified with real data

### H) WOW Landing — PASS
- BIQc Intelligence Summary panel on /advisor with 4 columns:
  - Calibration: "Agent Calibrated" + business name from DB
  - Business DNA: "17 facts confirmed" + industry + website from DB
  - Integrations: "3 Connected" + "HubSpot, Xero, outlook" from DB
  - Intelligence: "Pre-analysis" + enabled domains from DB
- No placeholder text, no mock state

### Guard 3 — Iron Curtain — PASS
- Onboarding incomplete → /war-room attempt → redirected to /onboarding
- URL manipulation blocked
- Screenshot verified

## Backend Endpoints Added
- `POST /api/calibration/reset` — recalibration flow
- `GET /api/lifecycle/state` — full lifecycle state
- `POST /api/enrichment/website` — Draft → Commit enrichment
- `POST /api/merge/disconnect` — disconnect Merge integrations

## Files Modified
- `backend/server.py` (4 endpoints + fact injection in calibration/brain)
- `frontend/src/pages/Settings.js` (calibration DB read, Recalibrate Agent)
- `frontend/src/pages/OperatorDashboard.js` (intelligence state diagnosis)
- `frontend/src/pages/AdvisorWatchtower.js` (WOW Landing summary)
- `frontend/src/pages/BusinessProfile.js` (debounced auto-save)
- `frontend/src/pages/Integrations.js` (disconnect buttons)
- `frontend/src/pages/ConnectEmail.js` (email display fix)
- `frontend/src/pages/AuthCallbackSupabase.js` (OAuth redirect fix)
- `frontend/src/context/SupabaseAuthContext.js` (single backend calibration check)
- `frontend/src/components/ProtectedRoute.js` (state machine routing)
- `frontend/src/components/BoardRoom.js` (priority compression)
- `frontend/public/service-worker.js` (API route exclusion)
- `backend/routes/boardroom.py` (rank_domains)
