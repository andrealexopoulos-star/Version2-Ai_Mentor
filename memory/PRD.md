# BIQC Strategic Advisor Platform - PRD

## Original Problem Statement
Full-stack strategic advisor platform (React + FastAPI + Supabase) with "Gilded Advisor" premium theme.

## Architecture (Post-Deconstruction)
- **Frontend**: React (CRA/CRACO) + Shadcn UI + Supabase Auth
- **Backend**: FastAPI — server.py (1,839 lines) + AI Core (1,508 lines) + 15 route modules (8,216 lines)
- **Database**: Supabase PostgreSQL (45 tables incl. system_prompts)
- **3rd Party**: Supabase, OpenAI GPT-4o, Merge.dev, Serper.dev, Azure AD, Google Cloud

## Monolith Deconstruction — COMPLETE

### Final Metrics
| Metric | Original | Final |
|--------|----------|-------|
| server.py | 10,218 lines | **1,839 lines** (-82%) |
| Route modules | 0 | **15** |
| AI Core | inline | **core/ai_core.py (1,508 lines)** |
| Unprotected endpoints | 5 | **0** |
| Prompt registry | Hardcoded | **DB-backed (18 prompts)** |
| MongoDB | Running | **Disabled** |
| Zombie files | 14 in repo | **14 archived** |

### Module Inventory
| Module | Lines | Domain |
|--------|-------|--------|
| core/ai_core.py | 1,508 | AI response, system prompts, cognitive context |
| routes/profile.py | 2,014 | Business profile, OAC, dashboard, notifications |
| routes/email.py | 1,816 | Outlook/Gmail OAuth, sync, intelligence, priority |
| routes/calibration.py | 1,166 | Calibration flow (12 routes) |
| routes/integrations.py | 1,150 | Merge.dev, CRM, Google Drive, intelligence ops |
| routes/generation.py | 562 | Chat, analyses, documents, SOP, diagnosis |
| routes/research.py | 451 | Website analysis |
| routes/soundboard.py | 257 | MySoundBoard |
| routes/boardroom.py | 245 | Board Room |
| routes/admin.py | 151 | Admin + prompt management |
| routes/data_center.py | 130 | File upload/download |
| routes/intelligence.py | 94 | Emission, snapshot, baseline |
| routes/watchtower.py | 71 | Watchtower events |

### Prompt Registry — All 18 Prompts Wired
| Prompt Key | Wired Via | Module |
|------------|-----------|--------|
| biqc_constitution_v1 | get_prompt() | core/ai_core.py |
| myadvisor_general_v1 | get_prompt() | core/ai_core.py |
| myadvisor_proactive_v1 | get_prompt() | core/ai_core.py |
| myintel_signal_v1 | get_prompt() | core/ai_core.py |
| chief_strategy_base_v1 | get_prompt() | core/ai_core.py |
| watchtower_brain_v1 | get_prompt() | routes/calibration.py |
| mysoundboard_v1 | get_prompt() | routes/soundboard.py |
| calibration_voice_response_v1 | Inline fallback | routes/calibration.py |
| calibration_activation_v1 | Inline fallback | routes/calibration.py |
| email_priority_analysis_v1 | Inline fallback | routes/email.py |
| email_reply_generator_v1 | Inline fallback | routes/email.py |
| boardroom_identity_v1 | File-based | boardroom_prompt.py |
| profile_autofill_v1 | Inline | routes/profile.py |
| profile_build_v1 | Inline | routes/profile.py |
| elite_mentor_v1 | Inline | routes/profile.py |
| oac_recommendations_v1 | Inline | routes/profile.py |
| sop_generator_v1 | Inline | routes/generation.py |
| cognitive_context_fallback_v1 | Inline | core/ai_core.py |

## Pending Issues
- P0: Edge Function `calibration-psych` website_url support (BLOCKED on user)
- P1: Missing `abn`/`years_operating` Supabase columns (BLOCKED on user)
- P3: "No intelligence events yet" display bug
- P4: Performance lag on data-heavy pages

## Backlog
- P2: Build "Prompt Lab" admin UI for live prompt A/B testing
- P2: Migrate remaining inline prompts to DB (email, profile, OAC)
- P3: Refactor CalibrationAdvisor.js frontend component (829 lines)
