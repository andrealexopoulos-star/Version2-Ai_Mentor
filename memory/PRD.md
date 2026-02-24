# BIQc Platform — PRD
## Updated: 2026-02-24

## Problem Statement
Transform BIQc into a high-performance, AI-driven "Cognition-as-a-Platform" for SMBs.

## Architecture
- Frontend: React + Tailwind (Liquid Steel dark theme)
- Backend: FastAPI (rendering/routing only)
- Database: Supabase (PostgreSQL, Auth, Edge Functions, Realtime, pg_cron)
- AI: OpenAI gpt-4o-mini (Edge Functions) — ALL cognition Supabase-first
- Production URL: biqc.thestrategysquad.com

## Completed (2026-02-24)

### P0 Bug Fix
- Calibration questionnaire appearing during signup — fixed console/state DB writes

### UI Fixes
- WOW Summary button: near-white → orange (#FF6A00)
- WOW Summary edit indicators: pencil icon, hover hints, gold border
- Nested button HTML warning: InsufficientDataAlert fixed
- Market page loading: removed phased ignition, content shows immediately

### New Features
- Forensic Calibration Backend Scoring (POST/GET /api/forensic/calibration)
- Channel Intelligence Status API (GET /api/integrations/channels/status)
- Market Intelligence Aggregator (GET /api/market-intelligence)
- HubSpot CRM data flowing (86 deals, $13,685 pipeline)

### BIQc Action Plan (Cognition-as-a-Platform)
- Extended biqc-insights-cognitive Edge Function with deterministic overlay + action_plan
- SQL function compute_market_risk_weight()
- ActionPlanSection component on Market page
- DEPLOYMENT REQUIRED: Edge Function + SQL to Supabase

### Mobile UX Fixes (Forensic Audit Score: 38→65)
- overflow-x:hidden on root containers (prevents horizontal scroll)
- Responsive grid breakpoints on 15+ grids (grid-cols-1 sm:grid-cols-2 md:grid-cols-4)
- 44px touch targets on all action buttons (@media max-width:639px)
- Cognition tabs scroll indicator with gradient fade (sm:hidden)
- Reduced motion support (@media prefers-reduced-motion)
- Safe area handling (env(safe-area-inset-bottom))
- Scrollbar-hide utility for tab bars
- Parallelized Market page API calls (Promise.allSettled)
- Testing: 100% desktop regression pass (no breakage)

## Pending / Backlog
- P1: Deploy Edge Function + SQL to Supabase production
- P1: Wire BIQc Insights tabs (Money, Ops, People)
- P1: Bottom navigation bar for mobile
- P2: Stripe paid gating
- P2: Recover 5 missing Edge Functions
- P2: Action Layer backend (Auto-Email, Quick-SMS)
- P2: Wire Google Ads, Meta, LinkedIn APIs
- P2: Soundboard keyboard fix on mobile
- P3: Consolidate legacy pages
- P3: Color contrast improvement (#64748B → #8494A7)
