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
- Cognitive Mesh + Strategic Radar loading animations (zero spinners)
- Supabase Realtime (replaced frontend polling)
- Super Admin full access
- Alert Complete/Ignore with backend persistence
- 4 accounting API endpoints
- Knowledge Base page

## Bug Fixes (2026-02-24)
- **P0 FIXED: Calibration questionnaire appearing during signup**
  - Root cause: `/api/console/state` wrote to wrong DB fields
  - Fix: Now properly upserts `strategic_console_state` and sets `persona_calibration_status`
  - Also fixed `triggerComplete` undefined `supabase` reference
  - Testing: 8/8 backend, 3/3 frontend pass

## New Features (2026-02-24)
- **Forensic Calibration Backend Scoring Engine**
  - POST `/api/forensic/calibration` — weighted scoring with 7 dimensions (revenue 1.5x, risk 1.4x, timeline 1.3x, retention 1.2x, channel 1.2x, pricing 1.1x, cohort 1.0x)
  - GET `/api/forensic/calibration` — retrieve existing results
  - Composite score (0-100), risk profile classification, strategic signals
  - Persists to `user_operator_profile` and `business_profiles`
  - Frontend updated: calls backend instead of frontend calculation, shows dimension scores, strategic signals, recalibrate option
  - Testing: 8/8 backend, 7/7 frontend pass

- **Channel Intelligence Status API**
  - GET `/api/integrations/channels/status` — aggregates Merge.dev CRM, email, drive connection status
  - Returns 6 channels (CRM, Google Ads, Meta, LinkedIn, Analytics, Email Platform)
  - Summary with connected/total counts
  - Market page updated with live ChannelIntelligence component

- **Forensic Calibration Card on Market Page**
  - Shows existing calibration results inline (score, risk profile, strategic signals)
  - Links to full calibration page for Super Admin
  - Coming Soon badge for non-admin users

- **Market Page Loading Fix**
  - Added 6-second timeout to snapshot fetch to prevent infinite loading
  - Page always renders within ~10 seconds

## Pending / Backlog
- P1: Full E2E onboarding verification (user is testing)
- P1: 9 calibration questions as module under Settings
- P2: Stripe paid gating for premium features (Forensic Calibration, Strategic Brief)
- P2: Build "BIQc Insights" premium feature on /advisor
- P2: Recover 5 missing Edge Function source files
- P2: Build Action Layer backend (Auto-Email, Quick-SMS)
- P2: Wire real APIs for Google Ads, Meta, LinkedIn, Analytics, Email Platform channels
- P2: Wire Actions/Automations/Compliance/Reports/Audit Log to backends
- P3: Consolidate 16 legacy pages
- P3: Refactor useCalibrationState.js (400+ lines, complex state machine)

## Key API Endpoints (New)
- `POST /api/forensic/calibration` — Submit & score forensic calibration
- `GET /api/forensic/calibration` — Retrieve existing forensic results
- `GET /api/integrations/channels/status` — Channel connection status
- `POST /api/console/state` — Save calibration progress (fixed to write to correct tables)
