# BIQC Strategic Advisor Platform - PRD

## Original Problem Statement
Full-stack strategic advisor platform (React + FastAPI + Supabase) providing AI-powered business advisory. "Gilded Advisor" premium theme. Calibration-driven onboarding with Edge Functions.

## Architecture
- **Frontend**: React (CRA/CRACO) + Shadcn UI + Supabase Auth
- **Backend**: FastAPI 10,218-line monolith + 2 background workers
- **Database**: Supabase PostgreSQL (44 tables), MongoDB (idle/legacy)
- **3rd Party**: Supabase, OpenAI GPT-4o, Merge.dev, Serper.dev, Azure AD, Google Cloud

## Completed Work
- Deployment fix: Root `/health` endpoint for K8s probes
- Route registration order fix (Google Drive routes accessible)
- Removed dead files (backups, corrupted `=2.45.0`)
- Updated requirements.txt (added missing lxml, python-docx)
- **Galaxy-Scale Infrastructure Audit** — Complete technical dossier at `/app/BIQC_TECHNICAL_DOSSIER.md`

## Pending Issues
- P0: Edge Function `calibration-psych` doesn't accept `website_url` (BLOCKED on user)
- P1: Missing `abn`/`years_operating` Supabase columns (BLOCKED on user)
- P2: HTML vs JSON fix verification (USER VERIFICATION PENDING)
- P3: "No intelligence events yet" display bug
- P4: Performance lag on data-heavy pages

## Security Findings (from audit)
- 5 unprotected endpoints: `/api/calibration/status`, `/api/calibration/init`, `/api/calibration/brain`, `/api/data-center/upload`, `/api/executive-mirror`
- MongoDB running but unused (resource waste)
- Zombie files in frontend bundle (IntegrationsOld.js, BusinessProfile.old.js, etc.)

## Backlog
- P0: Fix unprotected endpoints (security)
- P1: Modularize server.py (10K lines)
- P1: Refactor CalibrationAdvisor.js (829 lines, 26 state vars)
- P2: Remove zombie code (backend + frontend)
- P2: Automatic ingestion trigger (cron)
- P3: Remove unused MongoDB from supervisor
