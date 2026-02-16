# BIQC Strategic Advisor Platform - PRD

## Architecture
- **server.py**: 171 lines (pure orchestrator)
- **core/**: models.py, helpers.py, config.py, ai_core.py
- **Routes**: 16 modular files
- **Frontend**: Glass House + WIIFM Sovereign Sentinel design

## Critical Fix Applied (Feb 2026)
- **auth_supabase.py**: Changed `from supabase_client import supabase_admin` to `from supabase_client import init_supabase; supabase_admin = init_supabase()`
- **api.js**: Added proactive token refresh (60s before expiry) + 401 retry with refresh

## Test Results: 300/300 (100%)
| Iteration | Tests | Phase |
|-----------|-------|-------|
| 26-33 | 224 | Monolith deconstruction |
| 34 | 16 | Clean Sweep Refactoring |
| 35 | 29 | Deployment Readiness |
| 36 | 17 | Brand Overhaul |
| 37 | 14 | Auth Crisis Fix + E2E |

## Deployment
- Code: 100% functional, auth working end-to-end
- Blocker: Platform base image (support ticket submitted)

## Backlog
- P0: Resolve deployment base image
- P1: Login/register visual alignment to Sovereign theme
- P1: Implement live integrations (Outlook, Google Drive, Xero, Stripe, HubSpot)
- P2: Mobile responsive testing (detailed)
- P3: Performance optimization
