# BIQc Platform — Product Requirements Document

## Original Problem Statement
BIQc is a Sovereign Strategic Partner for Australian SMEs. AI-powered intelligence with Operational Sovereignty.

## Core Mandates
1. Data Harmony — Calibration data flows to all intelligence modules
2. Zero-Question Mandate — No redundant surveys
3. Edge-First Intelligence — Heavy AI offloaded to Edge Functions
4. Actionable Intelligence — [Read/Action/Ignore] briefs
5. Zero-Redirect Protocol — No redirect loops
6. Dynamic Gap-Filling — Only ask questions where data is NULL
7. Operational Sovereignty — 24-node sidebar, 53-table schema, indexed

## What's Been Implemented

### Performance Purge (Latest)
- **Index Migration:** SQL script with 43 indexes across 31 user_id-queried tables + 3 account_id indexes + 3 composite indexes at `/app/supabase_migrations/performance_indexes.sql`
- **Skeleton Loaders:** Reusable `PageSkeleton` component replaces spinners on Advisor, BusinessProfile, Settings pages
- **Mobile Titan Glass Fix:** `@media(max-width:1023px)` reduces backdrop-filter blur from 40px→12px on mobile
- **Sidebar Visibility Logic:** Calibration-locked nodes hidden until `authState === READY`

### Architecture Summary
- 24-Node Sidebar: 5 sections (INTELLIGENCE, ANALYSIS, TOOLS, CONFIGURATION, SETTINGS)
- 53 Supabase Tables: Full schema reference at /app/memory/SCHEMA_REFERENCE.md
- Dynamic Gap-Filling: /api/calibration/strategic-audit audits 17 dimensions
- Persistence Hooks: Upserts on card selections, onboarding completion, settings save
- Fact Resolution: 3-layer authority (Supabase → Integrations → Fact Ledger)

## User Action Required
- Run `/app/supabase_migrations/performance_indexes.sql` in Supabase SQL Editor

## Backlog
### P1
- [ ] E2E calibration flow
- [ ] Extract compute_retention_rag + calculate_business_score from profile.py to shared module
### P2
- [ ] Refactor routes/profile.py (2,070 lines)
- [ ] Video call feature
- [ ] Full mobile responsive audit
