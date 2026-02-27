# BIQc Platform - PRD

## Architecture
- Frontend: React + Tailwind + Shadcn/UI
- Backend: FastAPI → Supabase SQL Functions (17 endpoints)
- Database: Supabase PostgreSQL + 10 SQL Functions + 3 Triggers + 4 pg_cron Jobs
- Forensic Engine: 3-layer deterministic audit (Extraction → Cleaning → Synthesis)

## Completed

### Forensic Ingestion Engine (NEW)
- 3-layer audit: Extraction (HTTP/DOM/noise), Cleaning (boilerplate/weighting), Synthesis (hallucination/lost signal)
- Failure type codes: A1-A5 (extraction), B1-B4 (cleaning), C1-C5 (synthesis), D1-D3 (metadata)
- Noise ratio calculation, unique sentence ratio, core content weighting
- Hallucination detection: numeric invention, industry assumption, competitor guesswork, AI narrative fill
- Lost signal detection: ABN, phone, email, location mentions missed by snapshot
- Root cause verdict matrix with confidence scoring and remediation recommendations
- SQL table: ingestion_audits (stores full audit trail)
- API: POST /api/forensic/ingestion-audit, GET /api/forensic/ingestion-history
- Tested against thestrategysquad.com.au — all layers functional

### Deep Market Modeling (MarketPage — 5 tabs)
### Deep Intelligence Modules (SQL-Backed — 10 functions)
### Trust Reconstruction (7 sections)
### Integrity Lockdown (7 phases)

## Deploy Queue
| File | Action |
|------|--------|
| `024_sql_hotfix.sql` | Supabase SQL Editor |
| `026_ingestion_audits.sql` | Supabase SQL Editor |

## Backlog
### P1: Stripe Paid Gating
### P2: Signal Provenance, "Since Last Visit"
### P3: CSS Consolidation, Legacy Cleanup
