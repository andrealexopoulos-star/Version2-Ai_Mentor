# BIQC Strategic Advisor Platform - PRD

## Original Problem Statement
Full-stack strategic advisor platform (React + FastAPI + Supabase) providing AI-powered business advisory with "Gilded Advisor" premium theme.

## Architecture
- **Frontend**: React (CRA/CRACO) + Shadcn UI + Supabase Auth
- **Backend**: FastAPI 10,218-line monolith + 2 background workers
- **Database**: Supabase PostgreSQL (44 tables), MongoDB (idle/legacy)
- **3rd Party**: Supabase, OpenAI GPT-4o, Merge.dev, Serper.dev, Azure AD, Google Cloud

## Completed Work
- Deployment fix: Root `/health` endpoint for K8s probes
- Route registration order fix
- Removed dead files
- **Galaxy-Scale Infrastructure Audit** → `/app/BIQC_TECHNICAL_DOSSIER.md`
- **AI Prompt Extraction** → `/app/BIQC_PROMPT_REGISTRY.json` (18 prompts, structured JSON)
- **Supabase migration SQL** → `/app/backend/migrations/011_system_prompts_table.sql`

## AI Prompt Inventory (18 extracted)
| Agent | Prompts |
|-------|---------|
| ALL (Constitution) | biqc_constitution_v1, cognitive_context_fallback_v1 |
| MyAdvisor | myadvisor_general_v1, myadvisor_proactive_v1 |
| MyIntel | myintel_signal_v1 |
| ChiefOfStrategy | chief_strategy_base_v1 |
| MySoundBoard | mysoundboard_v1 |
| BoardRoom | boardroom_identity_v1 |
| BIQc-02 (Calibration) | watchtower_brain_v1 |
| EmergentAdvisor | calibration_voice_response_v1, calibration_activation_v1 |
| Email | email_priority_analysis_v1, email_reply_generator_v1 |
| Profile | profile_autofill_v1, profile_build_v1 |
| OAC/Mentor | elite_mentor_v1, oac_recommendations_v1 |
| SOP | sop_generator_v1 |

## Pending Issues
- P0: Edge Function `calibration-psych` doesn't accept `website_url` (BLOCKED)
- P1: Missing `abn`/`years_operating` Supabase columns (BLOCKED)
- P3: "No intelligence events yet" display bug
- P4: Performance lag on data-heavy pages

## Security Findings
- 5 unprotected endpoints need auth
- MongoDB running but unused

## Backlog
- P0: Fix unprotected endpoints
- P1: Modularize server.py
- P1: Refactor CalibrationAdvisor.js
- P2: Migrate prompts from JSON registry to live Supabase table
- P2: Remove zombie code
- P3: Remove MongoDB from supervisor
