# Strategic Advisor Platform (BIQC) - PRD

## Original Problem Statement
A full-stack strategic advisor platform (React + FastAPI + Supabase) with a "Gilded Advisor" premium theme. The application provides AI-powered business advisory services with calibration, intelligence feeds, and business DNA analysis.

## Architecture
- **Frontend**: React (CRA with CRACO), Shadcn UI, Supabase Auth
- **Backend**: FastAPI (Python), Supabase PostgreSQL, Edge Functions
- **3rd Party**: Supabase, OpenAI GPT-4o, Merge.dev, Google/Microsoft OAuth

## What's Been Implemented
- Calibration loop bug fixed
- "Gilded Advisor" UI overhaul (cream background, serif fonts)
- 3-state Executive Entry Protocol (Welcome Room, Continuity Suite, Welcome Back Lounge)
- Intelligence Handshake (website URL audit)
- Resilient CalibrationAdvisor component
- Authentication flow hardened with identity bar
- Admin field restructuring (Business DNA → Settings)
- Root-level `/health` endpoint for K8s deployment probes

## Deployment Fixes (Feb 2026)
1. Added root `/health` endpoint on `app` object (K8s probes check `/health`, not `/api/health`)
2. Moved `include_router()` after all route definitions (Google Drive routes were inaccessible)
3. Removed corrupted `=2.45.0` file
4. Removed stale backup files (server.py.backup, etc.)
5. Updated requirements.txt with accurate pip freeze

## Pending Issues
- P0: Edge Function compatibility for website audit (BLOCKED on user)
- P1: Missing `abn`/`years_operating` columns in Supabase (BLOCKED on user)
- P2: HTML vs JSON bug fix verification (USER VERIFICATION PENDING)
- P3: "No intelligence events yet" display bug
- P4: Performance lag on data-heavy pages

## Backlog
- P1: Modularize server.py (10K+ lines)
- P1: Refactor CalibrationAdvisor.js into sub-components
- P2: Automatic ingestion trigger (cron job)
