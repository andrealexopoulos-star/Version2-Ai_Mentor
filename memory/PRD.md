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

---

## What's Been Implemented

### Session: Feb 26, 2026 — P0 Forensic Trust Overhaul

**F1-F7 Defect Fixes (from FORENSIC MASTER PROMPT):**

1. **Flow Reorder (F1/F2 fix)** - Canonical onboarding flow enforced:
   - Domain Entry -> Domain Scan (extraction only) -> Identity Verification Gate -> Footprint Report (CMS) -> Executive Snapshot -> Dashboard
   - Identity verification now happens BEFORE footprint scoring, preventing wrong-business audits.

2. **Forensic Identity Verification Card (F3 fix)** - New `ForensicIdentityCard.js`:
   - Shows 7 signal blocks: Domain, Business Name, Location, ABN/ACN, Contact Signals, Social Links, Identity Confidence
   - 4 mandatory buttons: Yes (confirm), Edit details, Regenerate scan, Not my business
   - Identity confidence scoring (High/Medium/Low) based on available signals
   - Edit mode with editable fields + forced regenerate
   - "Not my business" requires at least one identifier (ABN/suburb/legal name)
   - Footprint report BLOCKED until identity confirmed

3. **Snapshot CTA Gating (F4 fix)** - `ExecutiveCMOSnapshot`:
   - CTA button hidden during ANALYZING state
   - Loading animation shown instead
   - CTA appears only after READY state + 3s delay with fade-in animation
   - Users cannot bypass to dashboard during analysis

4. **Integration Truth Suppression (F5 fix)** - No-CRM-No-Claims layer:
   - CRM-dependent terms (pipeline, churn, leads, etc.) suppressed in both Market page and Executive Snapshot
   - Shared `integrationTruth.js` constant used across components
   - "Connect CRM to unlock" notices shown when integration missing

5. **Chat Integration Onboarding (F6 fix)** - `FloatingSoundboard`:
   - Auto-sends integration status message on first Market page open
   - Shows live connection status for CRM, Email, Google Ads, Meta, Analytics, Calendar
   - Directs users to Systems menu for integration

6. **Market Page Scroll Fix (F7 fix)**:
   - Removed `overflow-y-auto` from DashboardLayout main element
   - Set `overflow-y: visible` to let HTML be sole scroll container
   - Consistent with `scroll-fix-critical.css` strategy

7. **Confidence Capping** - `ChiefMarketingSummary`:
   - Report confidence capped based on identity confidence level
   - Medium identity confidence caps report confidence at Medium (never High)

8. **Enhanced Domain Scan** - `calibration-business-dna` Edge Function v2:
   - Added deterministic identity signal extraction (no AI needed): ABN/ACN regex, phone patterns, email extraction, social URL detection, address patterns, geographic signals
   - Now scrapes `/contact` page in addition to `/about`, `/team`, `/services`
   - Merges deterministic signals with AI extraction (deterministic wins for identity fields)
   - Accepts user hints (`business_name_hint`, `location_hint`, `abn_hint`) for re-scans
   - Returns `identity_signals` object alongside `extracted_data`

9. **ABN Registry Lookup** - `business-identity-lookup` Edge Function (NEW):
   - Uses free ABR (Australian Business Register) JSON API
   - Supports: direct ABN lookup, name-based search
   - Returns: legal_name, trading_name, ABN, address, match_confidence, match_reason
   - Includes suggestion list for ambiguous matches
   - Requires `ABR_GUID` secret (free registration at abr.business.gov.au)
   - Frontend: "Search ABR" button appears on ForensicIdentityCard when confidence is Low/Medium

### Previous Sessions (inherited):
- Liquid Steel dark theme applied globally
- Mobile forensic audit + bottom navigation
- SQL migration (Phase 1): contradiction_engine, pressure_calibration, etc.
- Performance optimization: <5s load time for Insights page
- Auth/session hardening, password reset flow
- AI Learning Guarantee page
- Trust navigation menus updated

---

## Files Modified (This Session)
- `NEW: /app/frontend/src/components/calibration/ForensicIdentityCard.js`
- `NEW: /app/frontend/src/constants/integrationTruth.js`
- `NEW: /app/supabase/functions/business-identity-lookup/index.ts` (ABN lookup)
- `ENHANCED: /app/supabase/functions/calibration-business-dna/index.ts` (identity signals v2)
- `MODIFIED: /app/frontend/src/hooks/useCalibrationState.js` - Flow reorder + identity handlers + ABN lookup
- `MODIFIED: /app/frontend/src/pages/CalibrationAdvisor.js` - Wired ForensicIdentityCard + ABN lookup
- `MODIFIED: /app/frontend/src/components/calibration/IntelligencePhases.js` - CTA gating + suppression
- `MODIFIED: /app/frontend/src/components/calibration/ChiefMarketingSummary.js` - Confidence capping
- `MODIFIED: /app/frontend/src/pages/MarketPage.js` - Scroll fix + integration suppression
- `MODIFIED: /app/frontend/src/components/FloatingSoundboard.js` - Integration onboarding
- `MODIFIED: /app/frontend/src/components/DashboardLayout.js` - Scroll fix
- `NEW: /app/memory/ROADMAP.md` - Full sprint plan + tech debt + enhancement ideas

---

## Prioritized Backlog

### P0 (Critical)
- [x] Forensic Trust Overhaul (F1-F7) - COMPLETED

### P1 (High Priority)
- [ ] Stripe Paid Gating: Feature-gate Forensic Calibration + Executive Strategic Brief behind Stripe paywall
- [ ] Soundboard Integrated Queries: Edge Function `query-integrations-data` for real-data answers
- [ ] Soundboard BNA Updates: Allow Soundboard to update Business DNA via chat
- [ ] Google Ads Integration: Wire up data feed into Soundboard and cognitive engine

### P2 (Medium Priority)
- [ ] Complete SQL Migration: Remaining Python modules (merge_emission_layer, watchtower_engine, silence_detection)
- [ ] SQL Triggers: Auto-refresh cognitive snapshots on integration connect / calibration complete
- [ ] Real Channel APIs: Wire up Meta Ads, LinkedIn, GA4 via Merge.dev or direct APIs
- [ ] Supabase Security Audit: RLS policies, Edge Function review

### P3 (Low Priority / Tech Debt)
- [ ] CSS Consolidation: 13 files -> 2 (index.css + mobile.css)
- [ ] Legacy Page Cleanup: Remove 8+ superseded pages
- [ ] Recover Missing Edge Functions: intelligence-snapshot, social-enrichment source code
- [ ] Duplicate Supabase Secrets cleanup
- [ ] Missing Merge.dev webhook handler

---

## Edge Function / SQL Advisory (for this session's changes)

### Recommended Edge Function Enhancement:
The `calibration-business-dna` Edge Function should be enhanced to extract more identity signals from website scanning:
- Contact emails (from contact page)
- Phone numbers
- Physical address / headquarters
- ABN/ACN patterns (Australian Business Number regex)
- Social media profile URLs (LinkedIn, Facebook, Instagram, Twitter/X)
- Services keywords (top 20 terms)
- Industry keywords (top 20 terms)
- Geographic signals (city/state/country mentions)
- About/Contact/Services page existence detection
- Case studies/testimonials detection
- Brand logo alt text

### Optional New Edge Function:
`business-identity-lookup` - Only needed if domain scan consistently fails to find ABN/address and confidence stays Low after user hints. Would use registry API keys from Supabase secrets.

### No SQL Changes Required:
The identity verification is purely UI-level gating. No schema changes needed.
