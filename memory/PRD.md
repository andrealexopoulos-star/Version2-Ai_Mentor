# BIQC Platform — PRD

## Lifecycle Coherence: Context & State Integrity Sprint (Feb 2026)

### Part 1 — Workspace Context Stabilization — PASS
- `workspace_id` resolved from DB via `GET /api/lifecycle/state` before console renders
- Console log: `[Console] Workspace context resolved: 12c3ac17-a156-4a7b-a861-5d76bc1fb098`
- Run Analysis calls `POST /api/intelligence/cold-read` — backend resolves workspace internally
- No frontend workspace_id guard — backend is authority

### Part 2 — Console Step Persistence — PASS
- `POST /api/console/state` persists `current_step` to `user_operator_profile.operator_profile.console_state`
- On mount: fetches console_state, resumes correct step
- Console log: `[Console] Resuming from step 8`
- Screenshot: Console shows "STEP 8/17 ACTIVE" after DB load

### Part 3 — Data-Driven Truth Handover — PASS
- AI message references stored DNA: "What are the specific products or services that TSS offers in your business advisory role?"
- "TSS" is from resolved facts (`business.name` = "TSS and we do business advisory")
- No placeholder text, no scripted data

### Part 4 — Run Analysis Handshake — PASS
- Run Analysis button enabled (no email guard)
- `POST /api/intelligence/cold-read` succeeds: `{events_created: 0, status: "no_patterns"}`
- Backend resolves workspace internally — no frontend payload required
- Zero console errors confirmed

### Files Modified
- `backend/server.py` — added `POST /api/console/state`, extended `GET /api/lifecycle/state` with workspace_id + console_state
- `frontend/src/components/WarRoomConsole.js` — workspace context resolution, step persistence, resume logic
- `frontend/src/pages/AdvisorWatchtower.js` — removed strict email/workspace guards from Run Analysis

### Endpoints
- `GET /api/lifecycle/state` — now returns workspace_id + console_state
- `POST /api/console/state` — persists console step to DB
- `POST /api/intelligence/cold-read` — backend resolves workspace (no frontend payload needed)
