# BIQC Strategic Advisor Platform - PRD

## Original Problem Statement
Full-stack strategic advisor platform (React + FastAPI + Supabase) with "Gilded Advisor" premium theme.

## Architecture — BETA LAUNCH READY
- **Frontend**: React (CRA/CRACO) + Shadcn UI + Supabase Auth
- **Backend**: FastAPI — server.py (1,839 lines) + AI Core (1,508 lines) + 15 route modules
- **Database**: Supabase PostgreSQL (46 tables)
- **Prompt Registry**: 18/18 prompts LIVE from DB via prompt_registry.py
- **RBAC**: 3-tier (super_admin, client_admin, user)
- **Admin**: Prompt Lab UI at /admin/prompt-lab

## Beta Launch Clearance — ALL CLEAR

### Data Ingestion
- 18/18 AI prompts populated in `system_prompts` table
- All prompts confirmed loading from DB (not fallback)
- ChiefOfStrategy explicitly verified: LIVE FROM DB

### Dependency Resolution
- `abn` column: EXISTS in business_profiles
- `years_operating` column: EXISTS in business_profiles
- Edge Function fallback: 3-tier retry (website_url → step-only → message)

### Registry Verification
- 18/18 prompts loaded from Supabase `system_prompts` table
- In-memory cache active after first fetch
- Hot-swap via `/api/admin/prompts/invalidate` operational

### First-Impression Check
- AdvisorWatchtower: Shows "Your advisory brief is being prepared" (not "No events")
- OperatorDashboard: Shows diagnostic reasons for empty state
- Landing page: BIQC branding with "Start monitoring" CTA

## Cumulative Test Results
| Iteration | Tests | Passed | Phase |
|-----------|-------|--------|-------|
| 26 | 14 | 14 | Security P0 |
| 27 | 39 | 39 | Phase 2 Extraction |
| 28 | 51 | 51 | Final Cleanup |
| 29 | 35 | 35 | Cognitive Migration |
| 30 | 36 | 36 | Route Sync Audit |
| 31 | 9 | 9 | Prompt Lab |
| 32 | 9 | 9 | Beta Launch Clearance |
| **Total** | **193** | **193** | **100%** |

## Backlog
- P3: Refactor CalibrationAdvisor.js (829 lines)
- P3: Extract remaining server.py routes (auth/cognitive/onboarding)
