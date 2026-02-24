# BIQc Platform — PRD
## Updated: 2026-02-24

## Problem Statement
Transform BIQc into a high-performance, AI-driven "Cognition-as-a-Platform" for SMBs with a "Liquid Steel" dark theme, intelligence-first onboarding, and comprehensive Super Admin portal.

## Architecture
- Frontend: React + Tailwind (Liquid Steel dark theme)
- Backend: FastAPI (120+ endpoints)
- Database: Supabase (PostgreSQL, Auth, Edge Functions, Realtime, pg_cron)
- AI: OpenAI gpt-4o-mini (Edge Functions) + gpt-4o (backend)
- Integrations: Merge.dev, Outlook, Gmail, Google Drive
- Production URL: biqc.thestrategysquad.com

## Completed Features
- Liquid Steel theme on all routes
- 11 sidebar pages with live data + demo fallback
- Cognitive Ignition onboarding sequence
- Website entry with social handles
- CMO Executive Snapshot on Market page
- 9-phase Market Intelligence engine
- Forensic Calibration questionnaire (/market/calibration)
- Cognitive Mesh + Strategic Radar loading animations (zero spinners)
- Supabase Realtime (replaced frontend polling)
- Super Admin full access
- Alert Complete/Ignore with backend persistence
- 4 accounting API endpoints
- Knowledge Base page

## Bug Fixes (2026-02-24)
- **P0 FIXED: Calibration questionnaire appearing during signup**
  - Root cause: `/api/console/state` wrote to wrong DB fields (`operator_profile.console_state`) while `/calibration/status` reads from `strategic_console_state.is_complete` and `user_operator_profile.persona_calibration_status`
  - Fix: `/api/console/state` now properly upserts `strategic_console_state` and sets `persona_calibration_status` when status=COMPLETE
  - Also fixed: `triggerComplete` in `useCalibrationState.js` referenced undefined `supabase` variable, now uses `session` from hook
  - Testing: 8/8 backend tests pass, 3/3 frontend tests pass

## Pending / Backlog
- P1: Full E2E onboarding verification (signup → Market page)
- P1: Wire Forensic Calibration backend to `compute_forensic_score` SQL function
- P1: Wire Live Integration Data (Google Ads, Meta, LinkedIn API shells)
- P1: 9 calibration questions as module under Settings
- P2: Stripe paid gating for premium features
- P2: Build "BIQc Insights" premium feature on /advisor
- P2: Recover 5 missing Edge Function source files
- P2: Build Action Layer backend (Auto-Email, Quick-SMS)
- P2: Wire Actions/Automations/Compliance/Reports/Audit Log to backends
- P3: Consolidate 16 legacy pages
- P3: Refactor useCalibrationState.js (400+ lines, complex state machine)
