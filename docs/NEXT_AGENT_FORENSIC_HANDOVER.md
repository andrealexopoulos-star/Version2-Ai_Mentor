# BIQc Dev - Forensic Military-Grade Handover

## Mission

Stand up BIQc dev end-to-end on Mac with zero regression, then continue controlled development on branch `dDev`.

## Canonical Workspace

- Repo root: `C:\Users\andre\.cursor\worktrees\tpn\fbn`
- Active branch: `dDev`
- Do not use prod runtime targets during dev validation.

## Current Runtime Targets (Dev)

- Frontend app: `biqc-web-dev`
- Backend app: `biqc-api-dev`
- Latest deployed frontend image: `biqcregistry.azurecr.io/biqc-frontend:dev-askbiqc-20260401-080547`
- Latest deployed backend image: `biqcregistry.azurecr.io/biqc-api:dev-askbiqc-20260401-081027`

## Mandatory Constraints

1. No new secrets committed to git.
2. No DB schema migration unless explicitly approved.
3. JWT contract mode remains secure (`200/400/401` behavior expected by endpoint).
4. Route/access regressions are release blockers.
5. All changes must stay on `dDev` until promoted.

## Critical Completed Work (Must Preserve)

1. Ask BIQc primary route + legacy safety:
   - `/ask-biqc` is canonical
   - `/soundboard` backward path preserved via redirect
2. Nav/IA changes to Ask BIQc naming and entry.
3. Chat surface consolidation:
   - Embedded panel now launcher path to canonical chat surface.
4. Composer quick-create rail:
   - SOP / Code / Image / Video quick actions.
5. Market Insights calibration CTA added.
6. Backend forensic cooldown:
   - Free tier enforced at `1 per 30 days`.
   - Usage recorded in `user_feature_usage`.
7. Forensic calibration UI gate removed from admin-only lock; cooldown errors now surfaced.

## Remaining Risk Watchpoints

1. Homepage visual parity in dev was flagged once in evidence matrix.
2. Confirm calibration UX displays backend cooldown detail cleanly for free users on second attempt.
3. Verify no route loops around `/ask-biqc`, auth callback, and onboarding gates.

## Mac Stand-Up Procedure (No Guesswork)

1. Clone branch `dDev`.
2. Create env files:
   - `backend/.env` from `backend/.env.example`
   - `frontend/.env` from `frontend/.env.example`
3. Use dev Supabase project keys only (not prod).
4. Run bootstrap:
   - `bash scripts/migration/bootstrap_mac_dev.sh`
5. Start services:
   - Backend: `cd backend && source .venv/bin/activate && uvicorn server:app --reload --port 8001`
   - Frontend: `cd frontend && yarn start`
6. Health checks:
   - `curl http://localhost:8001/api/health`
   - Browser: `http://localhost:3000`

## Dev Azure Rollout (If deploying from Mac)

Use:

- `scripts/migration/azure_dev_rollout.sh`

Required envs:

- `RG`, `WEB_APP`, `API_APP`, `ACR`, `FRONTEND_TAG`, `BACKEND_TAG`

## Regression Test Gate (Execute Before Any Promote)

1. Auth routing:
   - unauth protected route -> login
   - post-auth -> Ask BIQc path
2. Legacy route compatibility:
   - `/soundboard` safely resolves into current auth flow
3. Calibration:
   - first forensic submit success (authenticated)
   - second submit inside window blocked for free tier
4. API contracts:
   - expected `401` unauth on protected routes
   - expected `200` on health endpoints
5. Market page:
   - calibration CTA visible and stateful

## Transcript Migration

If transcript portability is required, run:

- `powershell -ExecutionPolicy Bypass -File scripts/migration/export_cursor_transcripts.ps1`

Output target:

- `transcripts/cursor-agent-transcripts`

## Branching and Agent Scope Clarification

Yes, Cursor can operate with multiple repos/folders, but each agent execution reads and writes the currently opened workspace context. If cross-repo work is needed, explicitly open/switch to that repo and rerun agent tasks there.
