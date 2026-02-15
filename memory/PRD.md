# BIQC Strategic Advisor Platform - PRD

## Original Problem Statement
Full-stack strategic advisor platform (React + FastAPI + Supabase) with "Gilded Advisor" premium theme.

## Architecture (Post-Deconstruction — COMPLETE)
- **Frontend**: React (CRA/CRACO) + Shadcn UI + Supabase Auth
- **Backend**: FastAPI — server.py (1,839 lines) + AI Core (1,508 lines) + 15 route modules
- **Database**: Supabase PostgreSQL (46 tables incl. system_prompts + prompt_audit_logs)
- **Prompt Registry**: 15/18 prompts DB-wired, 3 cache-lookup fallback
- **RBAC**: 3-tier (super_admin, client_admin, user)

## Prompt Lab — COMPLETE
- **Route**: `/admin/prompt-lab` (ProtectedRoute adminOnly)
- **Backend**: 5 endpoints (GET list, GET detail, PUT update, POST test, POST invalidate)
- **Features**: Searchable list, side-drawer editor, Save & Deploy (update → invalidate → audit log), Test Connection button per prompt
- **RBAC**: All endpoints gated with `Depends(get_super_admin)`
- **Audit**: Every edit logged to `prompt_audit_logs` table with old/new content preview
- **Access**: Quick-access card on AdminDashboard

## Cumulative Test Results
| Iteration | Tests | Passed | Phase |
|-----------|-------|--------|-------|
| 26 | 14 | 14 | Security P0 |
| 27 | 39 | 39 | Phase 2 Extraction |
| 28 | 51 | 51 | Final Cleanup |
| 29 | 35 | 35 | Cognitive Migration |
| 30 | 36 | 36 | Route Sync Audit |
| 31 | 9 | 9 | Prompt Lab |
| **Total** | **184** | **184** | **100%** |

## Pending Issues
- P0: Edge Function `calibration-psych` website_url (BLOCKED on user)
- P1: Missing `abn`/`years_operating` Supabase columns (BLOCKED on user)
- P3: "No intelligence events yet" display bug

## Backlog
- P2: Run `012_prompt_audit_logs.sql` migration in Supabase
- P3: Refactor CalibrationAdvisor.js (829 lines)
- P3: Extract remaining server.py routes (auth/cognitive/onboarding)
