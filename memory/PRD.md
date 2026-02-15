# BIQC Strategic Advisor Platform - PRD

## Original Problem Statement
Full-stack strategic advisor platform (React + FastAPI + Supabase) with "Gilded Advisor" premium theme.

## Architecture
- **Frontend**: React (CRA/CRACO) + Shadcn UI + Supabase Auth
- **Backend**: FastAPI — server.py (6,788 lines) + 12 route modules (4,490 lines) + 2 background workers
- **Database**: Supabase PostgreSQL (45 tables incl. system_prompts)
- **3rd Party**: Supabase, OpenAI GPT-4o, Merge.dev, Serper.dev, Azure AD, Google Cloud

## Completed — Phase 2 Monolith Deconstruction (Feb 2026)

### Metrics
| Metric | Before | After |
|--------|--------|-------|
| server.py | 10,218 lines | **6,788 lines** (-33.6%) |
| Route modules | 5 | **12** |
| Extracted route code | 0 | **4,490 lines** |
| Zombie files | 14 in repo | 14 archived to `/_backups/` |
| Unprotected endpoints | 5 | **0** |
| MongoDB | Running | **Disabled** |
| Prompt registry | Hardcoded | **DB-backed (Supabase)** |

### Phase 2 Deliverables
- `routes/calibration.py` (1,166 lines) — 12 routes: status, defer, reset, init, answer, activation, brain, lifecycle, console, enrichment, regeneration
- `routes/email.py` (1,816 lines) — 18+ routes: Outlook/Gmail OAuth, email sync, intelligence, priority, calendar
- `routes/soundboard.py` (257 lines) — MySoundBoard CRUD + AI chat
- `routes/data_center.py` (130 lines) — File upload/download/management
- `prompt_registry.py` — Supabase-backed prompt fetcher with in-memory cache
- `/api/admin/prompts/invalidate` — Hot-swap AI personalities without restart
- `/api/admin/prompts` — List all active prompts from system_prompts table
- MongoDB disabled in supervisor (autostart=false)

### Route Module Inventory (12 modules)
| Module | Lines | Routes |
|--------|-------|--------|
| email.py | 1,816 | 18+ |
| calibration.py | 1,166 | 12 |
| research.py | 451 | 1 |
| soundboard.py | 257 | 5 |
| boardroom.py | 245 | 2 |
| admin.py | 151 | 8 |
| data_center.py | 130 | 7 |
| intelligence.py | 94 | 6 |
| watchtower.py | 71 | 4 |
| deps.py | 69 | 0 (shared) |
| facts.py | 29 | 2 |

### Prompt Registry (DB-Wired)
- `watchtower_brain_v1` → routes/calibration.py (via `get_prompt()`)
- `mysoundboard_v1` → routes/soundboard.py (via `get_prompt()`)
- 16 remaining prompts catalogued in `/app/BIQC_PROMPT_REGISTRY.json`

## Pending Issues
- P0: Edge Function `calibration-psych` website_url support (BLOCKED on user)
- P1: Missing `abn`/`years_operating` Supabase columns (BLOCKED on user)
- P3: "No intelligence events yet" display bug
- P4: Performance lag on data-heavy pages

## Backlog
- P1: Wire remaining 16 prompts to system_prompts table
- P1: Extract chat/generation routes (~500 lines)
- P1: Extract business profile routes (~500 lines)
- P1: Extract Merge.dev/Google Drive routes (~800 lines)
- P2: Build "Prompt Lab" admin UI for prompt A/B testing
- P3: Clean up remaining server.py helper functions
