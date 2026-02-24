# BIQc Platform — PRD
## Updated: 2026-02-24

## Problem Statement
Transform BIQc into a high-performance, AI-driven "Cognition-as-a-Platform" for SMBs with a "Liquid Steel" dark theme, intelligence-first onboarding, and comprehensive Super Admin portal.

## Architecture
- Frontend: React + Tailwind (Liquid Steel dark theme)
- Backend: FastAPI (120+ endpoints)
- Database: Supabase (PostgreSQL, Auth, Edge Functions, Realtime, pg_cron)
- AI: OpenAI gpt-4o-mini (Edge Functions) + gpt-4o (backend)
- Integrations: Merge.dev (CRM/HubSpot), Outlook, Gmail, Google Drive
- Production URL: biqc.thestrategysquad.com

## Completed (This Session - 2026-02-24)

### Bug Fixes
- **P0: Calibration questionnaire appearing during signup** — `/api/console/state` now writes to both `strategic_console_state` and `persona_calibration_status`
- **WOW Summary button invisible** — Changed from near-white (#F4F7FA) to orange (#FF6A00) 
- **WOW Summary edit indicators** — Added pencil icons, hover "Click to edit" text, gold border on editing
- **Nested button HTML warning** — Fixed InsufficientDataAlert button-in-button to div-in-div
- **Market page stuck on loading** — Removed phased ignition animation, content shows immediately
- **Market Intelligence not showing data** — Backend now parses `summary` JSON string into `cognitive` object

### New Features
- **Forensic Calibration Backend Scoring Engine** — POST/GET `/api/forensic/calibration` with weighted 7-dimension scoring (composite 0-100, risk profiles, strategic signals)
- **Channel Intelligence Status API** — GET `/api/integrations/channels/status` aggregating Merge.dev CRM, email, drive connections
- **Market Intelligence Aggregator** — GET `/api/market-intelligence` pulls live CRM data (HubSpot: 86 deals, $13,685 pipeline), forensic calibration, business profile
- **Market Page Data Flow** — Now shows real DRIFT status (70% confidence), signal scores, drift analysis gaps, misalignment index, AI recommendations
- **ForensicCalibrationCard on Market Page** — Shows existing calibration results inline with signals

## Pending / Backlog
- P1: Full E2E onboarding verification (user testing)
- P1: 9 calibration questions as Settings module
- P2: Stripe paid gating for premium features
- P2: Build "BIQc Insights" premium feature (/advisor)
- P2: Recover 5 missing Edge Function source files
- P2: Build Action Layer backend (Auto-Email, Quick-SMS)
- P2: Wire real APIs for Google Ads, Meta, LinkedIn, Analytics, Email Platform
- P3: Consolidate 16 legacy pages
- P3: Refactor useCalibrationState.js

## Key API Endpoints
- `POST /api/forensic/calibration` — Submit & score forensic calibration
- `GET /api/forensic/calibration` — Retrieve existing forensic results
- `GET /api/integrations/channels/status` — Channel connection status
- `GET /api/market-intelligence` — Live market intelligence aggregation
- `GET /api/snapshot/latest` — Parsed cognitive snapshot
- `POST /api/console/state` — Save calibration progress
