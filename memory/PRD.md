# BIQc Platform — PRD
## Updated: 2026-02-24

## Problem Statement
Transform BIQc into a high-performance, AI-driven "Cognition-as-a-Platform" for SMBs with a "Liquid Steel" dark theme, intelligence-first onboarding, and comprehensive Super Admin portal.

## Architecture
- Frontend: React + Tailwind (Liquid Steel dark theme)
- Backend: FastAPI (120+ endpoints) — rendering/routing only, NO cognition
- Database: Supabase (PostgreSQL, Auth, Edge Functions, Realtime, pg_cron)
- AI: OpenAI gpt-4o-mini (Edge Functions) — ALL cognition is Supabase-first
- Integrations: Merge.dev (CRM/HubSpot), Outlook, Gmail, Google Drive
- Production URL: biqc.thestrategysquad.com

## Completed (This Session - 2026-02-24)

### Bug Fixes
- P0: Calibration questionnaire appearing during signup — fixed `console/state` DB writes
- WOW Summary button invisible — changed to orange (#FF6A00)
- WOW Summary edit indicators — pencil icon, hover hints, gold border on editing
- Nested button HTML warning in InsufficientDataAlert
- Market page stuck on loading — removed phased ignition animation
- Market Intelligence not showing data — parsed `summary` JSON string into `cognitive` object

### New Features
- Forensic Calibration Backend Scoring Engine (POST/GET /api/forensic/calibration)
- Channel Intelligence Status API (GET /api/integrations/channels/status)
- Market Intelligence Aggregator (GET /api/market-intelligence)
- Market page data flow — HubSpot CRM data (86 deals, $13,685 pipeline) now visible

### BIQc Action Plan (Cognition-as-a-Platform Flagship) — READY FOR DEPLOYMENT
- **Extended `biqc-insights-cognitive` Edge Function** with:
  - Deterministic overlay (runs BEFORE LLM) — misalignment boost, urgency, risk amplification, compression probability
  - `compute_market_risk_weight()` SQL RPC call for database-side risk anchoring
  - `action_plan` block in response: top_3_marketing_moves, primary_blindside_risk, hidden_growth_lever, marketing_waste_alert, 90_day_market_projection, decision_window_pressure, probability_shift_if_executed/ignored
- **SQL function `compute_market_risk_weight()`** — deterministic risk scoring in PostgreSQL
- **ActionPlanSection component on Market page** — renders all action_plan fields with consequence modelling
- **No new backend endpoints** — all cognition stays in Supabase Edge Functions
- **No schema mutations** — uses existing tables (intelligence_snapshots, user_operator_profile, business_profiles)

### Deployment Required
To activate the Action Plan:
1. Deploy SQL: `supabase db push` or run `015_compute_market_risk_weight.sql` manually
2. Deploy Edge Function: `supabase functions deploy biqc-insights-cognitive`
3. Force refresh: call Edge Function with `{"force": true}` to regenerate snapshot with action_plan

## Architecture Rules (ENFORCED)
- ALL cognition lives in Supabase Edge Functions — NO FastAPI AI pipelines
- Frontend renders structured JSON ONLY — no probability calculations, no risk computation
- Deterministic overlay runs BEFORE LLM synthesis in every Edge Function call
- SQL function provides database-side risk anchoring to prevent pure-AI drift
- No static caching beyond 30min TTL; invalidate on profile/integration/calibration changes

## Pending / Backlog
- P1: Full E2E onboarding verification (user testing)
- P1: Deploy Edge Function + SQL function to Supabase production
- P1: Wire BIQc Insights tabs (Money, Ops, People) — Market tab is nucleus, others follow
- P2: Stripe paid gating for premium features
- P2: Recover 5 missing Edge Function source files
- P2: Build Action Layer backend (Auto-Email, Quick-SMS)
- P2: Wire real APIs for Google Ads, Meta, LinkedIn, Analytics
- P3: Consolidate 16 legacy pages
