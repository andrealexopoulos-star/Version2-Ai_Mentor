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

### UX Stage 1: Priority Compression (COMPLETE — Feb 2026)
- Backend `rank_domains()` in `routes/boardroom.py`
- Response includes `priority_compression` with primary/secondary/collapsed

### Deterministic Calibration Routing (COMPLETE — Feb 2026)
- Single backend authority for calibration check
- Fail-open on error, never defaults to NEEDS_CALIBRATION

### Service Worker Fix (COMPLETE — Feb 2026)
- Service Worker now skips all `/api/*` routes
- Content-type guards on all fetch calls prevent JSON parse errors on HTML responses
- Accept: application/json header on all API calls

### Email Display Bug Fix (COMPLETE — Feb 2026)
- Fixed `outlookStatus.connected_email` → `outlookStatus.email` property mismatch
- Email page now shows actual email address instead of "undefined"

### OAuth Error Redirect Fix (COMPLETE — Feb 2026)
- Fixed 11 hardcoded `/integrations` error redirects in Gmail/Outlook OAuth callbacks
- All error paths now redirect to `/connect-email` (where user started)
- Default `returnTo` changed from `/integrations` to `/connect-email` in both login endpoints

## Prioritized Backlog

### P0
- Deploy current build to production (Service Worker fix is blocking everything)

### P1
- Complete modularization of `server.py`

### P2
- Performance optimization for data-heavy pages
- War Room Fact Authority integration
