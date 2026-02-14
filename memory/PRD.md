# BIQc Platform — Product Requirements Document

## Original Problem Statement
Full-stack AI-powered Business Intelligence platform (React + FastAPI + Supabase). Core features include persona calibration, intelligence gathering, advisory dashboards, and integrations.

## Architecture
- **Frontend**: React (port 3000)
- **Backend**: FastAPI (port 8001)
- **Database**: Supabase (PostgreSQL)
- **AI**: Supabase Edge Functions (`calibration-psych`, `intelligence-snapshot`), OpenAI via emergentintegrations
- **Auth**: Supabase Auth (Google, Microsoft, email/password)

## Key Files
- `frontend/src/config/urls.js` — Uses `window.location.origin` (NOT `process.env.REACT_APP_BACKEND_URL`)
- `frontend/src/context/SupabaseAuthContext.js` — Auth bootstrap with dedup via `lastBootstrapUserId` ref
- `frontend/src/pages/CalibrationAdvisor.js` — Pure transport mode: sends to Edge Function, renders response, redirects on COMPLETE
- `backend/server.py` — Monolithic FastAPI app (needs modularization)

## What's Been Implemented

### Feb 2026
- **HTML vs JSON bug fix**: Forced all API calls to use `window.location.origin`
- **Calibration loop-back bug fix**: Prevented auth bootstrap re-trigger on Supabase token refresh by tracking `lastBootstrapUserId`
- **Calibration transport mode**: Rebuilt CalibrationAdvisor as pure transport/renderer/redirect handler — no generated questions, no step counters, no progress bars, no narrative overlays. Edge Function is sole conversational authority.
- **Executive Memo**: Driven by `intelligence-snapshot` Edge Function
- **Disconnect button**: Added to all connected integration cards
- **Zero-state flow**: Verified signup-to-calibration works on empty DB
- **CORS fix**: Removed Cache-Control headers from Edge Function calls
- **Platform audits**: Cognitive Intelligence Certification, architectural audit

## Prioritized Backlog

### P0 — Critical
- Verify HTML/JSON fix on production deployment (user confirmation pending)

### P1 — High
- Modularize `server.py` into route files under `/app/backend/routes/`
- Fix "No intelligence events yet" display bug on AdvisorWatchtower.js

### P2 — Medium
- Research Findings Card + Trust Moment UI (POST /api/research/analyze-website)
- Website Enrichment UI
- Performance optimization for data-heavy pages

### P3 — Low
- Automatic Ingestion Trigger (cron for /api/intelligence/ingest)

## Calibration Directive (ACTIVE)
CalibrationAdvisor operates in TRANSPORT MODE:
- Sends empty payload to Edge Function on init
- Sends exact user messages without alteration
- Renders Edge Function response as-is (message + status)
- Redirects to /advisor on status === "COMPLETE"
- Error display: "Calibration engine temporarily unavailable."
- No step framing, no progress indicators, no narrative overlays
