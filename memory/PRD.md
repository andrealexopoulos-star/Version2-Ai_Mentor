# BIQC Strategic Advisor Platform - PRD

## Original Problem Statement
Full-stack strategic advisor platform (React + FastAPI + Supabase) providing AI-powered business advisory with "Gilded Advisor" premium theme.

## Architecture
- **Frontend**: React (CRA/CRACO) + Shadcn UI + Supabase Auth
- **Backend**: FastAPI (server.py 9,648 lines, down from 10,218) + 10 route modules + 2 background workers
- **Database**: Supabase PostgreSQL (44 tables + system_prompts), MongoDB (idle/legacy)
- **3rd Party**: Supabase, OpenAI GPT-4o, Merge.dev, Serper.dev, Azure AD, Google Cloud

## Completed Work (Feb 2026)

### Phase 1A: Security P0 (VERIFIED - 14/14 tests passed)
- `/api/calibration/status` — Locked with `Depends(get_current_user)`
- `/api/calibration/init` — Locked with `Depends(get_current_user)`
- `/api/calibration/brain` — Locked with `Depends(get_current_user)`
- `/api/executive-mirror` — Locked with `Depends(get_current_user)`
- `/api/data-center/upload` — Already had auth (confirmed)

### Phase 1B: Zombie Purge (14 files archived)
- 8 backend files → `/_backups/zombie_purge_Feb2026/backend/`
- 6 frontend files → `/_backups/zombie_purge_Feb2026/frontend/`
- `motor`, `pymongo` removed from requirements.txt

### Phase 1C: Modularization (server.py reduced by 570 lines)
- `routes/soundboard.py` (257 lines) — MySoundBoard routes extracted, wired to system_prompts DB
- `routes/data_center.py` (130 lines) — Data center file management extracted
- `prompt_registry.py` — Supabase-backed prompt fetcher with in-memory cache
- Existing modules: admin.py, boardroom.py, facts.py, intelligence.py, research.py, watchtower.py

### Prior Work
- Deployment fix: Root `/health` endpoint for K8s probes
- AI Prompt Extraction: 18 prompts catalogued in `/app/BIQC_PROMPT_REGISTRY.json`
- SQL migration: `011_system_prompts_table.sql` executed

## Route Module Inventory (10 modules)
| Module | Lines | Routes |
|--------|-------|--------|
| research.py | 451 | 1 |
| soundboard.py | 257 | 5 (NEW) |
| boardroom.py | 245 | 2 |
| data_center.py | 130 | 7 (NEW) |
| admin.py | 109 | 5 |
| intelligence.py | 94 | 6 |
| watchtower.py | 71 | 4 |
| deps.py | 69 | 0 (shared) |
| facts.py | 29 | 2 |

## Pending Issues
- P0: Edge Function `calibration-psych` doesn't accept `website_url` (BLOCKED on user)
- P1: Missing `abn`/`years_operating` Supabase columns (BLOCKED on user)
- P3: "No intelligence events yet" display bug
- P4: Performance lag on data-heavy pages

## Backlog (Continuing Modularization)
- P1: Extract calibration routes (~900 lines) to routes/calibration.py
- P1: Extract email/outlook/gmail routes (~2000 lines) to routes/email.py
- P1: Extract chat/generation routes (~500 lines) to routes/generation.py
- P1: Extract business profile routes (~500 lines) to routes/profile.py
- P1: Extract Merge.dev/Google Drive routes (~800 lines) to routes/integrations.py
- P2: Wire remaining prompts (MyAdvisor, BoardRoom, etc.) to system_prompts table
- P3: Remove MongoDB from supervisor config
