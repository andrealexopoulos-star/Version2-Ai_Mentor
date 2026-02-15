# BIQc Platform — Product Requirements Document

## Original Problem Statement
Full-stack AI-powered Business Intelligence platform (React + FastAPI + Supabase). Core features include persona calibration, intelligence gathering, advisory dashboards, and integrations. The platform operates as a Cognitive Infrastructure where Supabase is the brain and Emergent is the high-resolution interface.

## Architecture
- **Frontend**: React (port 3000) — Transport + Renderer only
- **Backend**: FastAPI (port 8001) — Reads cognitive outputs from Supabase
- **Database**: Supabase (PostgreSQL) — Intelligence Authority
- **AI**: Supabase Edge Functions (`calibration-psych`, `intelligence-snapshot`, `gmail_prod`, `outlook-auth`)
- **Auth**: Supabase Auth (Google, Microsoft, email/password)
- **Integrations**: Merge.dev (CRM, Financial, HRIS)

## Master Agent Operating Directive
- Frontend is Transport + Renderer only. No local AI generation.
- All intelligence derived from Supabase Edge Functions.
- The Fact Ledger (in `user_operator_profile`) is the intelligence filter.
- `executive_memo` from `intelligence_snapshots` is the Force Memo.
- Calibration triggers intelligence-snapshot via SQL webhook.

## Key Files
- `frontend/src/config/urls.js` — Uses `window.location.origin`
- `frontend/src/context/SupabaseAuthContext.js` — Auth bootstrap with dedup
- `frontend/src/pages/CalibrationAdvisor.js` — Wizard mode transport
- `frontend/src/pages/AdvisorWatchtower.js` — Executive Mirror + Watchtower
- `backend/server.py` — Includes `/api/executive-mirror` endpoint

## What's Been Implemented

### Feb 14-15, 2026
- **Executive Mirror** (`/advisor`): Reads `agent_persona`, `fact_ledger`, `executive_memo` from Supabase. Renders Strategic DNA, Confirmed Signals, Force Memo. Recalculate button triggers `intelligence-snapshot` Edge Function.
- **`/api/executive-mirror` endpoint**: Single read from `user_operator_profile` + `intelligence_snapshots`. No filtering, no generation.
- **Status Header**: OPTIMIZED / DRIFT / DECAY based on `resolution_score` from intelligence_snapshots.
- **Calibration Wizard Mode**: Pure transport for `calibration-psych` Edge Function.
- **Auth Bootstrap Fix**: Token refresh no longer unmounts components.

## UI Hierarchy (Active)
1. Status Header: OPTIMIZED / DRIFT / DECAY
2. Executive Mirror: agent_persona + fact_ledger
3. Force Memo: executive_memo from intelligence_snapshots
4. Strategic Console: Link to War Room
5. Watchtower: Emerging signals feed

## Prioritized Backlog

### P0 — Immediate
- SQL Webhook: Verify `calibration complete → intelligence-snapshot` trigger is live in Supabase
- User to complete full calibration and verify Executive Mirror with real data

### P1 — High
- Strike/Closer buttons: Call `gmail_prod` or `rapid-task` Edge Functions
- Cost of Silence: Render `risk_quantification` from executive_memo
- Modularize `server.py`

### P2 — Medium
- Merge.dev data synthesis through Fact Ledger lens
- RPC engine integration (ghosted VIPs, burnout risk)

### P3 — Low
- Automatic Ingestion Trigger
