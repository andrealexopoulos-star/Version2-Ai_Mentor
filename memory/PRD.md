# BIQC Platform — Product Requirements Document

## Original Problem Statement
The BIQC platform is a strategic business intelligence system backed by Supabase. It provides AI-driven intelligence through a Board Room interface, Watchtower continuous monitoring, escalation memory, contradiction detection, and pressure calibration.

## Core Architecture
- **Backend**: FastAPI with modularized routes in `routes/` directory
- **Frontend**: React with Supabase Auth context
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4o via Emergent LLM Key

## What's Been Implemented

### Data Plane & Auth (COMPLETE)
- Supabase as single source of truth (MongoDB decommissioned)
- `user_operator_profile` as sole authority for calibration/onboarding state
- Admin route enforcement, SDK guardrails

### Global Fact Authority (COMPLETE)
- `fact_resolution.py` prevents redundant questioning across all AI interfaces
- Integrated into Board Room, Chat, and Onboarding flows

### Codebase Modularization (IN PROGRESS)
- 7 route groups extracted: admin, boardroom, calibration, facts, intelligence, onboarding, watchtower
- `server.py` still ~9000+ lines — remaining routes need extraction

### UX Stage 1: Priority Compression (COMPLETE — Feb 2026)
- Backend: `rank_domains()` in `routes/boardroom.py` scores domains by severity, pressure, contradiction, persistence, window compression
- Response includes `priority_compression` with `primary`, `secondary` (max 3), `collapsed`
- Frontend: BoardRoom.js renders Primary Focus card, Secondary items, collapsible evidence

### Deterministic Calibration Routing (COMPLETE — Feb 2026)
- **Root cause eliminated**: Removed all direct Supabase REST calls to `user_operator_profile` from frontend (RLS-fragile)
- **Single authority**: Frontend uses ONLY backend `/api/calibration/status` (service_role key, bypasses RLS)
- **Fail-open**: On ANY error (network, 500), frontend defaults to READY, never NEEDS_CALIBRATION
- **Deterministic gates**: ProtectedRoute redirects calibrated users from /calibration to /advisor
- **Order enforced**: Calibration check → Onboarding check (never reversed)
- **Backend fix**: Catch-all error now returns 500 (not 200 with NEEDS_CALIBRATION)
- Files modified: `SupabaseAuthContext.js`, `ProtectedRoute.js`, `AuthCallbackSupabase.js`, `server.py`

## Prioritized Backlog

### P0
- Delete "SAFE TO DELETE" Category C routes per forensic audit

### P1
- Complete modularization of `server.py` (chat, business profile, settings, legacy integrations)

### P2
- Performance optimization for data-heavy pages (Business DNA, Settings)
- Remove dead `calibration_status` writes from `routes/calibration.py`
- War Room Fact Authority integration

### P3
- E2E authenticated testing of Board Room Priority Compression view
- E2E authenticated testing of calibration routing flows
