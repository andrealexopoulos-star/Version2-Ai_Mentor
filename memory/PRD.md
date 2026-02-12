# BIQc Platform - Product Requirements Document

## Original Problem Statement
Comprehensive platform integrity overhaul enforcing "Full Lifecycle Coherence" for user experience. Core requirements include fixing lifecycle bugs, implementing priority compression UX, enforcing data sovereignty, improving UI/UX state coherence, building a WOW Landing page, fixing the intelligence pipeline, stabilizing critical endpoints, improving chat UX, and securing the system.

## Architecture
- **Backend**: FastAPI (server.py + routes/ directory, partially modularized)
- **Frontend**: React with Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **Integrations**: OpenAI GPT (Emergent LLM Key), Merge.dev (HubSpot, Xero), Microsoft Outlook

## Key Technical Concepts
- **Lifecycle Coherence**: Strict state machine routing (Calibration -> Onboarding -> App)
- **Read/Write Separation**: `/api/intelligence/cold-read` (fast, read-only) vs `/api/intelligence/ingest` (heavy, admin-only)
- **Idempotency**: Data fingerprinting prevents duplicate ingestion

## What's Been Implemented

### Completed (Previous Sessions)
- Priority Compression UX in Board Room
- Lifecycle routing state machine (no more redirect loops)
- Service worker bug fix (API caching prevention)
- Full Lifecycle Coherence features (Settings, Strategic Console, Business DNA, Integrations, Operator View, WOW Landing)
- Intelligence Pipeline re-architecture (cold-read/ingest separation, idempotency)
- Strategic Console chat UI rebuild
- E2E validation across all pages

### Completed (Feb 12, 2026)
- Fixed blank screen on login caused by `AdvisorWatchtower.js` crash when `/api/lifecycle/state` returns HTML instead of JSON
- Added 3-layer defense: API client HTML rejection, lifecycle data validation, optional chaining on template
- **P0: Deep Research + Inference Engine** — New `POST /api/research/analyze-website` endpoint with live scrape → LLM synthesis path and domain inference fallback. Full observability logging.

## Prioritized Backlog

### P0 (Critical)
- Prompt 02: Research Findings Card + Trust Moment UI (layer research endpoint into onboarding)

### P1 (High Priority)
- Complete modularization of `server.py` (IN PROGRESS)
- Delete "SAFE TO DELETE" Category C dead routes
- Website Enrichment UI (Requirement F)

### P2 (Medium Priority)
- Performance optimization for Business DNA/Settings pages (`/api/business-profile/context`)
- Remove dead `calibration_status` writes in `routes/calibration.py`

### P3 (Low Priority)
- Automatic ingestion trigger (cron/webhook for `/api/intelligence/ingest`)

## Key API Endpoints
- `/api/intelligence/cold-read` - Fast, read-only intelligence retrieval
- `/api/intelligence/ingest` - Admin-only heavy processing
- `/api/calibration/status` - User calibration state
- `/api/lifecycle/state` - Full lifecycle state for routing
- `/api/console/state` - Strategic Console progress
- `/api/integrations/merge/disconnect` - Disconnect integrations

## Key Files
- `/app/backend/server.py` - Main backend (needs modularization)
- `/app/frontend/src/context/SupabaseAuthContext.js` - Auth state machine
- `/app/frontend/src/pages/AdvisorWatchtower.js` - WOW Landing / main dashboard
- `/app/frontend/src/lib/api.js` - API client with interceptors
- `/app/frontend/public/service-worker.js` - SW with API exclusions

## Test Credentials
- User: `andre@thestrategysquad.com.au`
- Password: Requires magic link reset
