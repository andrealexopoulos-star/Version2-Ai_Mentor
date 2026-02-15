# BIQC Strategic Advisor Platform - PRD

## Original Problem Statement
Full-stack strategic advisor platform (React + FastAPI + Supabase) with "Gilded Advisor" premium theme.

## Architecture (Post-Deconstruction — COMPLETE)
- **Frontend**: React (CRA/CRACO) + Shadcn UI + Supabase Auth
- **Backend**: FastAPI — server.py (1,839 lines) + AI Core (1,508 lines) + 15 route modules (8,216 lines)
- **Database**: Supabase PostgreSQL (45 tables incl. system_prompts)
- **Prompt Registry**: 15/18 prompts DB-wired, 3 cache-lookup fallback
- **RBAC**: 3-tier (super_admin, client_admin, user)

## Route Synchronization Audit — VERIFIED

### Frontend → Backend Route Map (52/52 verified)
| Frontend Page | API Paths | Backend Module |
|--------------|-----------|----------------|
| AdvisorWatchtower | /executive-mirror | integrations.py |
| CalibrationAdvisor | /calibration/status, /calibration/init | calibration.py |
| MySoundBoard | /soundboard/conversations, /soundboard/chat | soundboard.py |
| DataCenter | /data-center/files, /data-center/upload | data_center.py |
| Integrations | /integrations/merge/*, /outlook/*, /gmail/* | email.py, integrations.py |
| BusinessProfile | /business-profile, /business-profile/scores | profile.py |
| Dashboard | /dashboard/stats, /dashboard/focus | profile.py |
| SOPGenerator | /generate/sop, /generate/checklist | generation.py |
| AdminDashboard | /admin/stats, /admin/users, /admin/prompts | admin.py |
| OperatorDashboard | /watchtower/positions, /snapshot/latest | watchtower.py, intelligence.py |
| OpsAdvisoryCentre | /oac/recommendations | profile.py |

### RBAC Visibility
- Admin menu: visible only for `admin` or `superadmin` roles
- ProtectedRoute adminOnly: gated by `ADMIN_ROLES = ['admin', 'superadmin']`
- Backend admin routes: `Depends(get_super_admin)` — strictly superadmin only
- All standard routes: `Depends(get_current_user)` — any authenticated user

### Zombie Status
- Zero zombie file references in frontend code
- 14 files archived in `/_backups/zombie_purge_Feb2026/`
- MongoDB disabled in supervisor

## Cumulative Test Results
| Iteration | Tests | Passed | Phase |
|-----------|-------|--------|-------|
| 26 | 14 | 14 | Security P0 |
| 27 | 39 | 39 | Phase 2 Extraction |
| 28 | 51 | 51 | Final Cleanup |
| 29 | 35 | 35 | Cognitive Migration |
| 30 | 36 | 36 | Route Sync Audit |
| **Total** | **175** | **175** | **100%** |

## Pending Issues
- P0: Edge Function `calibration-psych` website_url (BLOCKED on user)
- P1: Missing `abn`/`years_operating` Supabase columns (BLOCKED on user)
- P3: "No intelligence events yet" display bug

## Backlog
- P2: Build "Prompt Lab" admin UI
- P3: Refactor CalibrationAdvisor.js (829 lines)
- P3: Extract remaining server.py routes (auth/cognitive/onboarding) to ~500 lines
