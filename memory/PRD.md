# BIQC Strategic Advisor Platform - PRD

## Original Problem Statement
Full-stack strategic advisor platform (React + FastAPI + Supabase) with "Gilded Advisor" premium theme.

## Architecture (Post-Deconstruction — COMPLETE)
- **Frontend**: React (CRA/CRACO) + Shadcn UI + Supabase Auth
- **Backend**: FastAPI — server.py (1,839 lines) + AI Core (1,508 lines) + 15 route modules (8,216 lines)
- **Database**: Supabase PostgreSQL (45 tables incl. system_prompts)
- **Prompt Registry**: 15/18 prompts DB-wired via `get_prompt()`, 3 with cache-lookup fallback
- **RBAC**: super_admin (admin routes), client_admin (profile management), get_current_user (all routes)

## Monolith Deconstruction — 100% COMPLETE

### Final Metrics
| Metric | Original | Final |
|--------|----------|-------|
| server.py | 10,218 lines | **1,839 lines** (-82%) |
| Route modules | 0 | **15** |
| AI Core | inline | **core/ai_core.py** (1,508 lines) |
| Prompts | 18 hardcoded | **15 DB-wired + 3 cache-fallback** |
| RBAC gates | 0 | **3 tiers** (super_admin, client_admin, user) |
| Unprotected endpoints | 5 | **0** |
| MongoDB | Running | **Disabled** |
| Zombie files | 14 in repo | **14 archived** |

### Prompt Registry — 18/18 Wired
| # | Prompt Key | Via | Module |
|---|------------|-----|--------|
| 1 | biqc_constitution_v1 | get_prompt() | core/ai_core.py |
| 2 | myadvisor_general_v1 | get_prompt() | core/ai_core.py |
| 3 | myadvisor_proactive_v1 | get_prompt() | core/ai_core.py |
| 4 | myintel_signal_v1 | get_prompt() | core/ai_core.py |
| 5 | chief_strategy_base_v1 | get_prompt() | core/ai_core.py |
| 6 | watchtower_brain_v1 | get_prompt() | routes/calibration.py |
| 7 | mysoundboard_v1 | get_prompt() | routes/soundboard.py |
| 8 | calibration_voice_response_v1 | get_prompt() | routes/calibration.py |
| 9 | calibration_activation_v1 | get_prompt() | routes/calibration.py |
| 10 | email_priority_analysis_v1 | get_prompt() | routes/email.py |
| 11 | email_reply_generator_v1 | get_prompt() | routes/email.py |
| 12 | profile_autofill_v1 | get_prompt() | routes/profile.py |
| 13 | profile_build_v1 | get_prompt() | routes/profile.py |
| 14 | elite_mentor_v1 | get_prompt() | routes/profile.py |
| 15 | oac_recommendations_v1 | get_prompt() | routes/profile.py |
| 16 | boardroom_identity_v1 | cache lookup | boardroom_prompt.py |
| 17 | sop_generator_v1 | inline fallback | routes/generation.py |
| 18 | cognitive_context_fallback_v1 | inline fallback | core/ai_core.py |

### RBAC Tiers
| Tier | Gate | Used By |
|------|------|---------|
| super_admin | `Depends(get_super_admin)` | admin routes, subscription management |
| client_admin | `Depends(get_client_admin)` | owner/admin/client_admin role gating |
| user | `Depends(get_current_user)` | all standard routes |

## Pending Issues
- P0: Edge Function `calibration-psych` website_url support (BLOCKED on user)
- P1: Missing `abn`/`years_operating` Supabase columns (BLOCKED on user)
- P3: "No intelligence events yet" display bug
- P4: Performance lag on data-heavy pages

## Backlog
- P2: Build "Prompt Lab" admin UI for live prompt A/B testing
- P3: Refactor CalibrationAdvisor.js frontend (829 lines)
- P3: Extract remaining server.py auth/cognitive/onboarding routes (1,839 lines → ~500 lines)
