# BIQc Platform — Product Requirements Document

## Original Problem Statement
BIQc is a Sovereign Strategic Partner for Australian SMEs with Operational Sovereignty.

## What's Been Implemented

### Serial Bottleneck Broken (Latest)
- **Parallel Fetch:** `/api/executive-mirror` now executes 4 Supabase queries concurrently via `asyncio.gather` (operator_profile, intelligence_snapshots, business_profiles, strategic_console_state)
- **SWR Caching:** `useSWR` hook at `/app/frontend/src/hooks/useSWR.js` — in-memory cache, stale-while-revalidate, deduping, focus revalidation. AdvisorWatchtower now uses SWR.
- **Edge Offloading:** SWOT synthesis already in `deep-web-recon` Edge Function. Scoring logic extracted from profile.py (2,070 lines) to `core/scoring.py` (compute_retention_rag, calculate_business_score).
- **Skeleton Loaders:** PageSkeleton replaces spinners on Advisor, BusinessProfile, Settings
- **Mobile Titan Glass:** Blur reduced 40px→12px on mobile via `.titan-glass-blur` media query

### Performance Index (5 Layers)
1. Layer 1: 37 user_id + 3 account_id indexes across 31 tables
2. Layer 2: 7 GIN indexes for JSONB deep-search (payload, cognitive_profiles, social_handles, etc.)
3. Layer 3: 6 chronological DESC indexes for latest-first queries
4. Layer 4: 3 full-text search indexes (SOPs, documents, analyses)
5. Layer 5: 5 composite hot-path indexes

### Previous Work
- 24-Node Sidebar with visibility logic
- Dynamic Gap-Filling (17-point Strategic Audit)
- Persistence Hooks (card upserts, strategic_console_state sync)
- Zero-Redirect Protocol
- Titan Glass UI

## Architecture
- SWR Cache: Frontend in-memory, stale-while-revalidate
- Parallel Backend: asyncio.gather for multi-table reads
- Scoring Module: core/scoring.py (extracted from profile.py)
- Edge Functions: calibration-psych, deep-web-recon

## Backlog
### P1
- [ ] E2E calibration flow
- [ ] Run performance_indexes.sql in Supabase
### P2
- [ ] Continue profile.py decomposition
- [ ] Video call feature
- [ ] Mobile responsive audit
