# BIQC Platform — Product Requirements Document

## Original Problem Statement
BIQC is a deterministic lifecycle intelligence engine: Calibration → Onboarding → Integrations → Orientation → BIQc Insights.

## Architecture
- Backend: FastAPI + Supabase (PostgreSQL)
- Frontend: React with Supabase Auth
- AI: OpenAI GPT-4o via Emergent LLM Key

## Lifecycle Coherence Sprint (Feb 2026)

### A) Calibration Consistency — IMPLEMENTED
- Settings reads `persona_calibration_status` from backend `/api/calibration/status` ONLY
- Green dot + "Calibration complete" when complete, "Recalibrate Agent" button
- No red warning for calibrated users
- No "Complete Calibration" shown for completed users

### B) Strategic Console No Redundant Questions — IMPLEMENTED
- `resolve_facts()` + `build_known_facts_prompt()` injected into `/api/calibration/brain` prompt BEFORE AI call
- Known facts (business name, industry, website, etc.) injected as context with "DO NOT ask for these again"
- Strategic Console now skips 7 known steps (verified: jumps from Step 1 to Step 8)

### E) Recalibration Flow — IMPLEMENTED
- `POST /api/calibration/reset` endpoint: archives persona, sets status to 'recalibrating'
- Settings "Recalibrate Agent" calls reset then routes to /calibration via full page reload
- Bootstrap detects 'recalibrating' status → NEEDS_CALIBRATION → renders calibration page

### F) Website Enrichment — IMPLEMENTED (Guard 2)
- `POST /api/enrichment/website` with action="scan" returns DRAFT (not persisted)
- action="commit" persists to business_profiles
- Server-side fetch + sanitize (strips non-printable chars, normalizes whitespace)
- Verified: scan of thestrategysquad.com returns clean title + description as draft

### G) Operator View Intelligence State — IMPLEMENTED
- Shows "Intelligence State Diagnosis" with DB-sourced reasons:
  - Integration count + provider names
  - Domains enabled list
  - "No observation events received yet" with action guidance
- When intelligence exists, shows positions, escalations, contradictions, pressure

### Service Worker Fix — IMPLEMENTED
- Excludes all /api/* routes from SW interception
- Content-type guards on calibration/auth fetch calls
- Fixed 11 hardcoded /integrations error redirects → /connect-email

### Backend Endpoints Added
- `POST /api/calibration/reset` — recalibration flow
- `GET /api/lifecycle/state` — full lifecycle state for routing + operator view
- `POST /api/enrichment/website` — Draft → Review → Commit enrichment

## Remaining Items
- C) Business DNA auto-save (partially done via context endpoint, needs debounced field-level save)
- D) Integrations disconnect buttons on cards
- H) WOW Landing after lifecycle completion
- Guard 3 strict state machine (partially implemented in ProtectedRoute)
