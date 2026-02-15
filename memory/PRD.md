# BIQc Platform — Product Requirements Document

## Original Problem Statement
Full-stack AI-powered Business Intelligence platform. Cognitive Infrastructure where Supabase is the brain and Emergent is the high-resolution interface. The UI is Integration-Agnostic — it only cares about Signal Classes (Revenue, Capital, Human Velocity), not data sources.

## Architecture
- **Frontend**: React — Transport + Renderer of Cognitive Outputs
- **Backend**: FastAPI — Reads from Supabase, no local AI
- **Database**: Supabase (PostgreSQL) — Intelligence Authority
- **AI**: Supabase Edge Functions (calibration-psych, intelligence-snapshot, gmail_prod, outlook-auth)
- **Integrations**: Merge.dev (mapped to Standardized Signal Schema)

## Master Agent Directive (ACTIVE)
- Primary objective: Visualization of Strategic Contradiction (Drift Detection)
- UI renders delta between Fact Ledger (Psychology/Goals) and Force Signals (Business Reality)
- Integration-Agnostic: Data source irrelevant. Only Signal Classes matter.
- Zero-Noise Policy: OPTIMIZED (>0.9) minimizes feed. Only drift amplified.
- Response Template: STATUS → SIGNAL → COST OF SILENCE → FORESIGHT

## UI Architecture
1. **Status Header**: OPTIMIZED / DRIFT / DECAY (from resolution_score)
2. **Executive Mirror**: Master Agent declaration + agent_persona + fact_ledger
3. **Intelligence Feed**: executive_memo rendered as Signal Schema
4. **Signal Classes**: Revenue / Capital / Human Velocity
5. **Valuation Decay**: risk_quantification as primary metric

## Key Endpoints
- `GET /api/executive-mirror` — Returns agent_persona, fact_ledger, executive_memo, resolution_score
- `POST /functions/v1/calibration-psych` — Wizard-mode calibration (Edge Function)
- `POST /functions/v1/intelligence-snapshot` — Generates Force Memo (Edge Function)
- SQL Webhook: calibration complete → auto-triggers intelligence-snapshot

## What's Been Implemented (Feb 2026)
- Calibration wizard mode (transport for Edge Function)
- Auth bootstrap loop-back fix
- Executive Mirror rendering (agent_persona + fact_ledger)
- Intelligence Feed with Signal Schema template
- Zero-Noise Policy
- `/api/executive-mirror` backend endpoint

## Prioritized Backlog
- P0: Verify SQL webhook triggers intelligence-snapshot on calibration complete
- P1: Valuation Decay formula in signal-evaluator Edge Function
- P1: Server.py modularization
- P2: Merge.dev → Standardized Signal Schema mapping
- P2: RPC engine (ghosted VIPs, burnout risk) into intelligence_snapshots
