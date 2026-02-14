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
- `frontend/src/pages/CalibrationAdvisor.js` — Wizard mode: transport + renderer for Edge Function
- `backend/server.py` — Monolithic FastAPI app (needs modularization)

## What's Been Implemented

### Feb 14, 2026
- **Calibration Wizard Mode**: Rebuilt CalibrationAdvisor as pure transport/renderer. Sends `{ step: 1 }` on init, `{ step, selected, text, probe }` on user actions. Renders Edge Function `{ question, options, allow_text, insight, probe, status }` exactly. No step counters, progress bars, narrative overlays, or generated copy. Error: "Calibration engine temporarily unavailable."
- **Auth Bootstrap Loop-Back Fix**: Token refresh no longer re-triggers bootstrap (tracked via `lastBootstrapUserId` ref). Prevents CalibrationAdvisor unmount/remount during Edge Function calls.
- **HTML vs JSON bug fix**: Forced all API calls to use `window.location.origin`
- **Executive Memo**: Driven by `intelligence-snapshot` Edge Function
- **Disconnect button**: Added to all connected integration cards
- **Zero-state flow**: Verified signup-to-calibration works on empty DB
- **CORS fix**: Removed Cache-Control headers from Edge Function calls
- **Platform audits**: Cognitive Intelligence Certification, architectural audit

## Calibration Directive (ACTIVE)
CalibrationAdvisor operates in WIZARD MODE:
- On mount: sends `{ step: 1 }` to Edge Function
- Renders Edge response fields: `question`, `options[]`, `allow_text`, `insight`, `probe`, `status`
- On user selection: sends `{ step, selected, text?, probe? }`
- On `probe: true`: re-renders same step with insight, allows clarification
- On `status === "COMPLETE"`: immediate redirect to `/advisor`
- Error: "Calibration engine temporarily unavailable."
- No step framing, no progress indicators, no narrative overlays, no generated copy

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

## Test Credentials
- **Test User**: `calibration_test@test.com` / `Test123456!` (created via admin API, email confirmed)
- **Primary User**: `andre@thestrategysquad.com.au` (password unknown in current env)
