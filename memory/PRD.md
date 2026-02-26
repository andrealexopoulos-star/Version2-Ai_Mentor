# BIQc Platform - PRD (Product Requirements Document)

## Original Problem Statement
Transform BIQc into a high-performance, AI-driven "Cognition-as-a-Platform" for SMBs with a premium "Liquid Steel" dark theme, Supabase-first architecture, and zero fake data discipline.

## Architecture
- **Frontend**: React (CRA) + Tailwind + Shadcn/UI + Framer Motion
- **Backend**: FastAPI (thin Supabase client only)
- **Database**: Supabase (PostgreSQL, Auth, Edge Functions, Realtime, pg_cron)
- **AI Engine**: OpenAI gpt-4o-mini via `biqc-insights-cognitive` Edge Function
- **CRM Integration**: Merge.dev (HubSpot)

## Core Principles
1. **Supabase-First**: FastAPI is only a thin client. All logic in Edge Functions / SQL.
2. **No Fake Data**: UI shows "insufficient data" states, never fabricated metrics.
3. **Trust by Default**: Identity verification before scoring. Integration truth before claims.
4. **Deterministic Integrity**: No AI narrative filler without verified signal data.
5. **Signal Provenance**: Every data point must trace to a connected source.

---

## What's Been Implemented

### Session: Feb 27, 2026 — Trust Reconstruction (7 Sections)

**Section 1 — Database Contract:**
- Created SQL migration `021_trust_reconstruction.sql` with:
  - `workspace_integrations` table (single source of truth for integration status)
  - `governance_events` table (audit log reads ONLY from this)
  - `report_exports` table (PDF audit trail)
  - `business_profiles` alterations: `source_map`, `confidence_map`, `timestamp_map` columns
  - RLS policies and indexes
- **Status**: Migration file ready, needs deployment to Supabase

**Section 2 — Frontend Hard Gating:**
- Rewrote `AuditLogPage.js` to query `governance_events` from Supabase directly. No AI-generated free-text entries. Null state if table absent or empty.
- Rewrote `ReportsPage.js` with financial snapshot gated behind `workspace_integrations.accounting`. Executive memo requires governance events. PDF export button integrated.
- Rewrote `AdvisorWatchtower.js` with integration-aware data filtering. Revenue/Money/Operations/People tabs show `IntegrationRequired` component when corresponding integration absent.
- Rewrote `OperationsPage.js` — zero hardcoded data. All bottlenecks, SOP compliance, team workload removed. Shows null state without integrations.

**Section 3 — Scrape Engine Hard Lock:**
- Created `scrape-business-profile` Edge Function with deterministic-only extraction
- Extracts: `<title>`, `meta[description]`, OpenGraph tags, JSON-LD structured data
- Competitors ONLY from explicit JSON-LD `competitor`/`competitors` fields
- No LLM enrichment, no industry guessing, no inferred competitor names
- Returns `"no_structured_competitor_data"` status when no competitors found
- **Status**: Edge Function ready, needs deployment to Supabase

**Section 4 — PDF Generation Engine:**
- Created `/api/reports/generate-pdf` backend route using fpdf2
- PDF includes: workspace ID, generated timestamp, report version, integration list, signal summary, confidence score, raw data snapshot appendix
- Created `/api/reports/download/{filename}` for serving generated PDFs
- Stores export records in `report_exports` table
- Explicit statement when no integrations connected

**Section 5 — Synthetic String Purge:**
- Removed all "Client A", "Client B" references from:
  - `InteractiveDemoExpanded.js`
  - `CognitiveV2Mockup.js`
  - `RevenueModule.js` (website demo)
  - `AlertsPage.js` (website demo)
- Replaced with generic, non-specific language
- Verified zero matches for: Client A, Client B, $280K, 24mo, stable margin, Stale Leads, Budget Overrun

**Section 6 — Test Matrix:**
- Test 1 (Fresh Workspace): All null states render correctly
- Test 2 (Synthetic Purge): Zero synthetic strings in non-blog files
- Test 3-4 (PDF): Endpoints exist and functional
- Test 5-7 (Dashboard): All tabs show integration-required states
- Test 8 (SQL): Migration file verified
- Test 9 (Scrape): Deterministic extraction confirmed
- Test 10 (Public): Blog + KB accessible

### Previous Session: Full-Spectrum Integrity Lockdown (7 Phases)
- Phase 1: Placeholder eradication across all dashboard pages
- Phase 3: Blog engine with 16 verified-citation articles
- Phase 4: Knowledge Base public access
- Phase 5: Try for Free routing
- Phase 6: Signup error handling
- Phase 7: Password dot visibility

### Earlier Sessions (inherited):
- Liquid Steel dark theme
- Forensic Identity Card for onboarding
- Snapshot v2 with drift_velocity, trajectory, data_gaps
- High-ticket pricing page (5 tiers)
- Soundboard panel (ChatGPT-style right panel)
- Mobile forensic audit + bottom navigation
- Auth/session hardening, password reset flow

---

## Files Modified (This Session — Trust Reconstruction)
- `REWRITTEN: /app/frontend/src/pages/AuditLogPage.js` — Queries governance_events, null states
- `REWRITTEN: /app/frontend/src/pages/ReportsPage.js` — Hard gated, PDF export
- `MODIFIED: /app/frontend/src/components/InteractiveDemoExpanded.js` — Synthetic strings removed
- `MODIFIED: /app/frontend/src/pages/CognitiveV2Mockup.js` — Synthetic strings removed
- `MODIFIED: /app/frontend/src/pages/website/platform/RevenueModule.js` — Client B removed
- `MODIFIED: /app/frontend/src/pages/website/platform/AlertsPage.js` — Client B removed
- `MODIFIED: /app/backend/server.py` — Reports router registered
- `NEW: /app/backend/routes/reports.py` — PDF generation + download
- `NEW: /app/supabase/migrations/021_trust_reconstruction.sql` — Trust tables
- `NEW: /app/supabase/functions/scrape-business-profile/index.ts` — Deterministic scrape

---

## Deployment Queue (User Action Required)

| Item | Type | File | Action |
|------|------|------|--------|
| Trust tables | SQL Migration | `021_trust_reconstruction.sql` | Run in Supabase SQL Editor |
| Scrape engine | Edge Function | `scrape-business-profile/index.ts` | `supabase functions deploy` |
| `calibration-business-dna` v2 | Edge Function UPDATE | Already in codebase | `supabase functions deploy` |
| `biqc-insights-cognitive` v2 | Edge Function UPDATE | Already in codebase | `supabase functions deploy` |
| `query-integrations-data` | Edge Function NEW | Already in codebase | `supabase functions deploy` |
| `insight_outcomes` table | SQL Migration | `020_insight_outcomes.sql` | Run in Supabase SQL Editor |

---

## Prioritized Backlog

### P0 (Critical)
- [x] Full-Spectrum Integrity Lockdown — COMPLETED
- [x] Trust Reconstruction (7 Sections) — COMPLETED

### P1 (High Priority)
- [ ] Deep Intelligence Modules: Workforce, Growth, Deep Market
- [ ] Stripe Paid Gating: Feature-gate behind Stripe paywall
- [ ] Google Ads Integration
- [ ] Populate governance_events from integration syncs

### P2 (Medium Priority)
- [ ] Signal Provenance Layer (C1)
- [ ] State Justification Formalisation (C2)
- [ ] "Since Your Last Visit" feature (C3)
- [ ] Tension Framing (C4)
- [ ] Chat Determinism completion (C5)
- [ ] Complete SQL Migration
- [ ] Supabase Security Audit

### P3 (Low Priority / Tech Debt)
- [ ] CSS Consolidation: 13 files -> 2
- [ ] Legacy Page Cleanup: Remove 8+ superseded pages
- [ ] Recover Missing Edge Functions
