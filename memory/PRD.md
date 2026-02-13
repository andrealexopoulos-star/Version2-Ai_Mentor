# BIQC Platform — Product Requirements Document

## Original Problem Statement
Build and maintain a Business Intelligence & Cognitive platform (BIQC) that provides:
- Real-time business intelligence through connected integrations (CRM, Email, Financial)
- Watchtower analysis engine for domain-level position tracking
- Board Room cognitive delivery with human-grade strategic reasoning
- SoundBoard thinking partner for Socratic decision support
- Deep Research + Inference Engine for website analysis

## Architecture
- **Frontend**: React + Shadcn/UI, Supabase Auth
- **Backend**: FastAPI + Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4o via Emergent LLM Key
- **Integrations**: Supabase Auth, Merge.dev (CRM/Financial), Microsoft Outlook, Google (OAuth/Drive)

## What's Been Implemented

### Platform Stability — 3-Layer Service Worker Defense ✅ (Fixed 2026-02-13)
**Root Cause**: Server-side proxy/CDN caching HTML responses for API routes. Stale service workers on production browsers compound the issue.
**Fix**: 4-layer defense:
- **Layer 1** (`index.js`): Force-unregister ALL service workers + clear ALL caches on every page load
- **Layer 2** (`lib/api.js`): Cache-busting `?_t=timestamp` query param on EVERY request + `Cache-Control: no-cache` headers + `X-API-Server` header detection
- **Layer 3** (all files with raw `fetch()`): Cache-busting timestamp + headers on ALL raw fetch calls
- **Layer 4** (backend `server.py`): `NoCacheAPIMiddleware` adds `X-API-Server: biqc-backend`, `Cache-Control: no-cache, no-store`, `X-Content-Type-Options: nosniff` to ALL API responses
**Verified**: All endpoints return JSON with correct headers on preview

### Core Intelligence Pipeline ✅
- Observation events ingestion from multiple sources (CRM, email, manual)
- Watchtower engine with domain position tracking (CRITICAL/DETERIORATING/ELEVATED/STABLE)
- Escalation memory with persistence tracking
- Contradiction detection engine
- Decision pressure calibration
- Evidence freshness governance

### Board Room Cognitive Delivery ✅ (Enhanced 2026-02-12)
- Human-grade strategic reasoning with causal analysis
- Follow-up protocol for multi-turn depth (why-critical, consequences, resolution pathways)
- Raw signal telemetry injection for richer LLM context
- Priority compression with ranked domain presentation
- Escalation action handling (acknowledge/defer)

### SoundBoard ✅ (Bug fixed 2026-02-12)
- Fixed argument mismatch bug in conversation storage (server.py:5630)
- Socratic thinking partner with session persistence
- Voice call capability

### Deep Research Engine ✅
- POST /api/research/analyze-website endpoint
- Scraping + LLM synthesis with domain inference fallback

### Platform Stability ✅
- Service worker decommissioned
- Cache-busting headers on all API calls
- Defensive UI rendering with optional chaining
- Auto-retry mechanism for HTML-instead-of-JSON errors

## Section 4 Certification Results (2026-02-12)
- All 12 API tests PASSED (100%)
- All frontend pages verified (100%)
- Board Room cognitive depth certified
- Real-time intelligence update pipeline confirmed

## Pending Issues
1. **P1**: Complete modularization of server.py into route modules
2. **P1**: Delete "SAFE TO DELETE" Category C dead routes
3. **P2**: Performance optimization for data-heavy pages
4. **P2**: Remove dead calibration_status writes

## Upcoming Tasks
1. **P0**: Research Findings Card + Trust Moment UI (Prompt 02)
2. **P1**: Website Enrichment UI (Requirement F)
3. **P3**: Automatic Ingestion Trigger (cron job)

## Key API Endpoints
- POST /api/boardroom/respond — Board Room cognitive delivery
- POST /api/boardroom/escalation-action — Escalation handling
- GET /api/watchtower/positions — Domain position state
- GET /api/watchtower/findings — Analysis findings
- POST /api/watchtower/emit — Ingest observation events
- POST /api/watchtower/analyse — Trigger analysis
- GET /api/cognitive/escalation — Escalation state
- POST /api/soundboard/chat — SoundBoard conversation
- POST /api/research/analyze-website — Deep Research Engine
