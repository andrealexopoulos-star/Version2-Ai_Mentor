# BIQc Platform — PRD
## Updated: 2026-02-24

## Architecture
- Frontend: React + Tailwind (Liquid Steel dark theme)
- Backend: FastAPI (rendering/routing only)
- Database: Supabase (PostgreSQL, Auth, Edge Functions, Realtime, pg_cron)
- AI: OpenAI gpt-4o-mini (Edge Functions only)
- Production: biqc.thestrategysquad.com

## Completed (2026-02-24 — Full Session)
- P0: Calibration questionnaire signup bug fix
- P0: Forensic Calibration backend scoring engine
- P0: Channel Intelligence status API
- P0: Market Intelligence aggregator with live HubSpot data
- P0: BIQc Action Plan (Edge Function extension with deterministic overlay)
- P0: Password reset flow (CRIT-001 from production audit)
- Mobile forensic audit (score 38→75)
- Mobile bottom navigation (5 tabs + More sheet)
- Soundboard full-screen modal with keyboard-aware viewport
- Edge Function warm strategy
- Parallelized Market page API calls
- Cognition-aware mobile landing (DRIFT→/market)
- Login page mobile padding fix
- WOW Summary button/edit indicators
- 15+ grid responsive breakpoints
- Reduced motion + safe area + touch target fixes

## Production Audit Results (post-fix)
- CRIT-001: Password reset — FIXED (ResetPassword.js + UpdatePassword.js)
- CRIT-002: Edge Function 401 — FIXED (user deployed)
- HIGH-001: /api/auth/supabase/me 520 — needs investigation
- HIGH-003: Login mobile padding — FIXED

## Deployment Required
1. Deploy warm-cognitive-engine Edge Function
2. Save to GitHub + Deploy latest code

## Pending
- P1: Investigate /api/auth/supabase/me 520 errors
- P1: Wire BIQc Insights tabs (Money, Ops, People)
- P2: Stripe paid gating
- P2: SQL migration of Python cognition engines
- P2: Real channel APIs (Google Ads, Meta, LinkedIn)
