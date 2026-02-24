# BIQc Platform — PRD
## Updated: 2026-02-24

## Architecture
- Frontend: React + Tailwind (Liquid Steel dark theme)
- Backend: FastAPI (rendering/routing only)
- Database: Supabase (PostgreSQL, Auth, Edge Functions, Realtime, pg_cron)
- AI: OpenAI gpt-4o-mini (Edge Functions only)
- Production: biqc.thestrategysquad.com

## Completed (2026-02-24)
- P0 Fix: Calibration questionnaire signup bug
- UI: WOW Summary button/edit indicators
- Backend: Forensic Calibration scoring, Channel Intelligence, Market Intelligence aggregator
- BIQc Action Plan: Edge Function extension with deterministic overlay (DEPLOY NEEDED)
- Mobile Audit: Score 38→75 (6 critical/high fixes)
- Mobile Hardening: 6 modules implemented (all 100% tested):
  - Module A: Cognition-aware mobile landing (DRIFT→/market)
  - Module B: Bottom navigation (5 tabs + More sheet)
  - Module C: Soundboard full-screen modal with keyboard-aware viewport
  - Module D: Edge Function warm strategy (warm-cognitive-engine)
  - Module E: Parallelized API calls (Promise.allSettled)
  - Module F: OAuth verified redirect-based (no popup on mobile)

## Deployment Required
1. SQL: compute_market_risk_weight() function
2. Edge Function: biqc-insights-cognitive (updated with action_plan)
3. Edge Function: warm-cognitive-engine (NEW)

## Pending
- P1: Deploy Edge Functions + SQL to Supabase
- P1: Wire BIQc Insights tabs (Money, Ops, People)
- P2: Stripe paid gating
- P2: SQL migration of Python cognition engines
- P2: Real channel APIs (Google Ads, Meta, LinkedIn)
- P3: Consolidate legacy pages
