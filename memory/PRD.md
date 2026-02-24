# BIQc Platform — PRD
## Updated: 2026-02-24

## Architecture
- Frontend: React + Tailwind (Liquid Steel dark theme)
- Backend: FastAPI (rendering/routing only)
- Database: Supabase (PostgreSQL, Auth, Edge Functions, Realtime, pg_cron)
- AI: OpenAI gpt-4o-mini (Edge Functions only)
- Production: biqc.thestrategysquad.com

## Completed (2026-02-24)
- P0: Calibration questionnaire signup bug fix
- P0: Password reset flow (ResetPassword + UpdatePassword pages)
- P0: Forensic Calibration backend scoring engine
- P0: Channel Intelligence + Market Intelligence APIs
- P0: BIQc Action Plan (Edge Function + deterministic overlay)
- P0: Auth resilience (/api/auth/supabase/me fail-open pattern)
- BIQc Insights 5-tab enrichment (Money, Revenue, Operations, People, Market) — metrics, deals, scenarios, competitors, recommendations rendered from unified cognitive snapshot
- Mobile: Bottom nav, soundboard modal, responsive grids, touch targets, reduced motion, safe areas, parallelized APIs, cognitive-aware landing
- SQL: compute_market_risk_weight() deployed, detect_contradictions() ready

## Deployment Required
1. Run SQL: `016_detect_contradictions.sql` in Supabase SQL Editor
2. Save to GitHub + Deploy latest code

## Pending
- P1: SQL migration phase 2 (pressure_calibration → SQL)
- P1: SQL migration phase 3 (evidence_freshness → SQL)
- P1: SQL migration phase 4 (escalation_memory → SQL)
- P2: Stripe paid gating
- P2: Real channel APIs (Google Ads, Meta, LinkedIn)
- P3: Consolidate legacy pages
