# BIQc Strategic Advisor Platform — PRD

## Original Problem Statement
BIQc is an AI-powered Business Intelligence platform for Australian SME leaders. It couples real-time operational monitoring with executive mentoring to protect operations, optimise cashflow, and reclaim time — with 100% Australian Data Sovereignty.

## Architecture — Final State

### Backend (175 lines orchestrator)
```
/app/backend/
├── server.py                  # 175 lines — pure routing hub
├── core/
│   ├── ai_core.py             # 75 lines — thin orchestrator (imports sub-modules)
│   ├── business_context.py    # 136 lines — business context building
│   ├── cognitive_context.py   # 364 lines — cognitive context for AI prompts
│   ├── prompt_builder.py      # 314 lines — system prompt generation
│   ├── config.py              # middleware, env vars, service initialization
│   ├── helpers.py             # file parsing, search, auth utilities
│   └── models.py              # all Pydantic request/response schemas
├── routes/                    # 17 modular route files
│   ├── admin.py               # prompt CRUD + audit log endpoint
│   ├── auth.py                # Supabase signup, login, OAuth
│   ├── calibration.py         # calibration wizard + status
│   ├── health.py              # NEW: health monitoring endpoints
│   ├── profile.py             # business profile, dashboard, OAC (with caching)
│   └── [12 more route files]
├── auth_supabase.py           # Authentication + user profile management
├── supabase_client.py         # Supabase SDK client initialization
└── prompt_registry.py         # DB-driven AI prompt management with caching
```

### Frontend
```
/app/frontend/src/
├── pages/
│   ├── LandingIntelligent.js  # Titan CSS landing page
│   ├── TrustPage.js           # /trust — SEO optimized
│   ├── LoginSupabase.js       # Titan Glass themed login
│   ├── RegisterSupabase.js    # Titan Glass themed registration
│   ├── CalibrationAdvisor.js  # 80 lines — uses useCalibrationState hook
│   ├── PromptLab.js           # Admin prompt management + audit trail
│   └── [15+ additional pages]
├── hooks/
│   └── useCalibrationState.js # 255 lines — calibration state management
├── components/
│   ├── calibration/           # Sub-components for CalibrationAdvisor
│   ├── landing/               # Landing page components
│   └── ui/                    # Shadcn components
├── lib/
│   └── api.js                 # Axios client with token refresh + 401 retry
└── context/
    └── SupabaseAuthContext.js  # Auth provider with OAuth
```

## Features Implemented

### Authentication & Security
- [x] Supabase Auth with Google + Microsoft OAuth
- [x] Email/password signup and login
- [x] JWT token validation via Supabase service role
- [x] Proactive token refresh (60s before expiry)
- [x] Automatic 401 retry with fresh token
- [x] Role-Based Access Control (super_admin, client_admin, admin, user)
- [x] Duplicate signup guard + invalid login guard
- [x] ID mismatch auto-merge — 3-tier fallback
- [x] Titan Glass themed auth pages (Feb 2026)

### Health Monitoring (Feb 2026)
- [x] GET /api/health/detailed — comprehensive health check
- [x] GET /api/health/workers — background worker status
- [x] Supabase connectivity check
- [x] Worker status via supervisorctl
- [x] Integration config validation (OpenAI, Supabase, Serper)

### Performance Optimization (Feb 2026)
- [x] In-memory caching for dashboard stats (30s TTL)
- [x] In-memory caching for profile scores (30s TTL)
- [x] Dashboard stats cache invalidation on data changes

### Prompt Lab (Feb 2026)
- [x] Prompt management with search and edit
- [x] Audit Trail tab — view prompt_audit_logs history
- [x] Test prompt connection from UI
- [x] Cache invalidation controls

### SEO (Feb 2026)
- [x] Trust page meta tags (description, og:title, twitter)
- [x] Dynamic document.title on trust page
- [x] Australian Data Sovereignty keywords

### Calibration Onboarding
- [x] CalibrationAdvisor with 6 states
- [x] Smart-Retry 3-tier fallback: Edge Function → step-only → manual
- [x] WOW Summary with inline editing
- [x] Wizard mode + Chat mode
- [x] Refactored with useCalibrationState custom hook (Feb 2026)

### AI Intelligence Core
- [x] Refactored ai_core.py → 4 sub-modules (Feb 2026)
- [x] Centralized GPT-4o via emergentintegrations
- [x] Database-driven prompt management
- [x] Prompt audit trail logging
- [x] Cognitive Core — per-user intelligence profiles

### Landing Page — Titan CSS
- [x] Glean-style rotating headline
- [x] Live Sentinel Feed
- [x] Titan Glass cards with shimmer
- [x] Passive vs Active interactive slider
- [x] 15-logo integration marquee
- [x] WIIFM Outcome Matrix
- [x] 3-tier pricing

### Trust Page (/trust)
- [x] AES-256 encryption badge
- [x] Australian Data Sovereignty
- [x] Zero-Leakage Guarantee
- [x] SEO meta tags (Feb 2026)

## Backlog

### P0 — Resolved
- [x] Deployment base image switch (resolved by support)
- [x] Edge Function calibration-psych redeployed

### P1 — Completed (Feb 2026)
- [x] Login/Register pages — Titan Glass aesthetic
- [x] Health monitoring endpoints
- [x] ai_core.py refactored (1,508 → 75 lines + 3 sub-modules)
- [x] CalibrationAdvisor.js refactored (323 → 80 lines + hook)
- [x] SEO meta tags for /trust page
- [x] Prompt Lab audit trail UI
- [x] Performance caching for dashboard/profile endpoints

### P2 — Remaining
- [ ] E2E Calibration flow test with live Edge Function
- [ ] Live integrations: Outlook, Gmail, Google Drive, Xero, Stripe, HubSpot
- [ ] Deep mobile responsive test — all pages at 375px
- [ ] Decompose routes/profile.py (2,067 lines) into sub-modules

### P3 — Future
- [ ] Background worker health alerting (email/Slack)
- [ ] Prune old test iterations (39 files in /app/test_reports/)

## 3rd Party Integrations
- **Supabase**: PostgreSQL database, Auth (Google/Microsoft OAuth), Edge Functions
- **OpenAI GPT-4o**: Via emergentintegrations library (Emergent LLM key)
- **Firecrawl**: Website scraping for calibration (Edge Function)
- **Serper.dev**: Google search API for web source discovery
- **Merge.dev**: Unified API scaffold (CRM, financial, HR)

## Test Credentials
- **Test user**: e2e-rca-test@test.com / Sovereign!Test2026#
- **Primary user**: andre@thestrategysquad.com.au (Google OAuth)
