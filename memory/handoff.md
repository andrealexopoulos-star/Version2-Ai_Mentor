# BIQc Platform — Complete Handoff Document
## Feb 26, 2026 | For Next Agent Fork

---

## CRITICAL: Fork to `biqc.ai`

The next agent MUST fork to the production domain to ensure they work against the latest deployment.

---

## WHAT WAS COMPLETED THIS SESSION

### Sprint 1: Trust Foundation (ALL DONE)
- Forensic Identity Verification Card (7 signal blocks, 4 buttons, confidence scoring)
- Flow reorder: Domain → Identity Verification → Footprint Report → Snapshot → Dashboard
- Snapshot CTA gating (hidden during ANALYZING, 3s delay after READY)
- Integration truth suppression layer (no CRM = no pipeline/churn/lead claims)
- Market page scroll fix
- Soundboard integration onboarding auto-message
- CTAs changed to "Try It For Free" across all public pages

### Sprint 2: Intelligence Depth (ALL DONE)
- `query-integrations-data` Edge Function (Soundboard real data queries via Merge.dev)
- Enhanced FloatingSoundboard → full SoundboardPanel (ChatGPT-style right panel)
- Soundboard BNA Updates (detect intent, confirmation card, write + refresh)
- Business Verification Score badge in dashboard header
- Snapshot v2 UI (7 sections: State, Trajectory, Moves, Blindside, Lever, Gaps, Confidence)

### Level 3 Cognition Instrumentation (DONE)
- `insight_outcomes` SQL migration for prediction tracking
- Enhanced `biqc-insights-cognitive` (drift_velocity, trajectory_projection, data_gaps, snapshot_confidence)
- Predictions auto-stored after each snapshot (no automated evaluation — Phase 1)

### Pricing Page (DONE)
- Full executive positioning: "Multiply the Capability of Your Entire Team"
- Free tier as landscape bar: "Market Intelligence Brief (Complimentary)"
- 4 paid tiers: Foundation ($750) → Performance ($1,950 "Most Adopted") → Growth ($3,900) → Enterprise (Contact Sales)
- Add-on modules section, ROI justification, closing statement
- No SaaS tone. No hype. Executive-grade.

### Bug Fixes (DONE)
- Revenue page black screen fixed (null.toLocaleString crash)
- DataHealthPage demo fallback removed (fake Xero/HubSpot/Outlook)
- FloatingSoundboard imports removed from all 8 pages (replaced by DashboardLayout panel)
- Fake testimonials removed from pricing

### Edge Functions (Code written, AWAITING DEPLOYMENT)
- `calibration-business-dna` v2 — Perplexity-first 5-query scan (replaces Firecrawl as primary)
- `business-identity-lookup` — ABR free API for ABN lookup (placeholder, needs GUID)
- `query-integrations-data` — Soundboard real data queries
- `biqc-insights-cognitive` v2 — Snapshot v2 output + prediction storage

### SQL Migration (AWAITING DEPLOYMENT)
- `020_insight_outcomes.sql` — prediction tracking table + snapshot_confidence column

---

## DEPLOYMENT QUEUE (User must deploy to Supabase)

```bash
# 1. SQL Migration (run in Supabase SQL Editor)
# File: /app/supabase/migrations/020_insight_outcomes.sql

# 2. Edge Functions
supabase functions deploy calibration-business-dna
supabase functions deploy business-identity-lookup
supabase functions deploy query-integrations-data
supabase functions deploy biqc-insights-cognitive

# 3. Optional secret (ABN Lookup — backlogged)
supabase secrets set ABR_GUID=<guid-from-abr.business.gov.au>
```

---

## REMAINING TASKS — PRIORITY ORDER

### P0: Critical Bugs / Issues
1. **BIQc Insights fake data** — User reports seeing fake data on BIQc Insights page. Investigation shows AdvisorWatchtower has NO hardcoded fake data — all values come from cognitive snapshot (AI-generated). Root cause: the `biqc-insights-cognitive` Edge Function generates assumptions without integrations. Fix: deploy the updated Edge Function with integration truth suppression in the GPT prompt. The frontend suppression layer is already built.
2. **SoundboardPanel rendering verification** — The new ChatGPT-style right panel was built but couldn't be visually verified due to Supabase auth not working in preview. Needs visual testing after deployment.

### P1: Intelligence Modules (NOT BUILT)
3. **Workforce/People intelligence module** — Add to Risk page. Should include: baseline workforce metrics, capacity strain detection, hiring trigger signals, role productivity benchmarking, overtime risk modelling. Read from cognitive snapshot workforce data.
4. **Growth/Scenario planning engine** — Add to Revenue page. Should include: revenue expansion simulation, hiring vs outsource comparison, margin impact modelling, cashflow interaction modelling. Read from cognitive snapshot + CRM data.
5. **Weighted scoring formula** — Replace binary field-existence scoring in ChiefMarketingSummary with weighted component scoring. Each of 13 layers should have a weight based on importance. Confidence should be quality-weighted, not just count-based.
6. **Deep modelling in Market page** — Saturation density scoring, demand capture gap logic, funnel friction detection, category positioning map, cross-channel consistency scan. These require enhanced AI prompt in the cognitive engine.

### P2: Architecture Surface Clarity (C1-C5 from Forensic Report)
7. **C1: Signal Provenance Layer** — Every insight shows WHERE it came from (website scan, Perplexity, HubSpot CRM, etc.) + data age + limiting factors
8. **C2: State Justification** — Expandable "Why this state?" below System State banner showing trigger signals and severity weighting
9. **C3: Change-Centric Surface** — "Since your last visit" diff showing what changed between sessions
10. **C4: Tension Framing** — Consequence language on blindside/moves ("If this persists...")
11. **C5: Chat Determinism** — Chat references snapshot signals, refuses unsupported requests, includes source attribution

### P3: Revenue/Monetisation
12. **Stripe integration** — Payment flow, webhook handler, subscription management
13. **Feature gating** — Forensic Calibration + Executive Strategic Brief behind paywall
14. **Tier enforcement** — Free tier limits (10 Soundboard messages/month), Foundation/Performance/Growth feature differentiation

### P4: Integrations
15. **Google Ads** — Full OAuth + data feed into cognitive engine
16. **Meta Ads** via Merge.dev
17. **LinkedIn** via direct API
18. **GA4** via direct API

### P5: Cognition Maturity (Level 4)
19. **Manual `evaluate-predictions` admin Edge Function** — Phase 2, after 30-60 days of data
20. **Automated pg_cron evaluation** — Phase 3, after 60-90 days
21. **Insight Performance Index** — Accuracy rate display (UI shell exists, needs data)

### P6: Backend Migration
22. **Migrate `merge_emission_layer.py`** → SQL function
23. **Migrate `watchtower_engine.py`** → SQL function
24. **Migrate `silence_detection.py`** → SQL function
25. **SQL Triggers** — Auto-refresh snapshots on integration connect / calibration complete

### P7: Security
26. **Supabase RLS policies audit** — All tables
27. **Edge Function auth pattern review**

### P8: Tech Debt
28. **CSS consolidation** — 13 files → 2 (index.css + mobile.css)
29. **Legacy page cleanup** — Remove 8+ superseded pages
30. **Recover missing Edge Functions** — `intelligence-snapshot`, `social-enrichment` source code
31. **Consolidate duplicate Supabase secrets**
32. **Add missing Merge.dev webhook handler**

---

## EARLIER ISSUES NOT FIXED
- `intelligence-snapshot` Edge Function deployed on Supabase but source not in git
- `social-enrichment` Edge Function deployed on Supabase but source not in git
- Merge.dev webhook secret exists without corresponding API route
- Duplicate Supabase secrets needing consolidation
- Industry demo pages (SaaSView, AgencyView, ConsultingView) have hardcoded demo data — acceptable as marketing demos if labeled

---

## KEY FILES OF REFERENCE

### Frontend (Modified this session)
- `/app/frontend/src/components/SoundboardPanel.js` — NEW: ChatGPT-style right panel
- `/app/frontend/src/components/calibration/ForensicIdentityCard.js` — NEW: Identity verification
- `/app/frontend/src/constants/integrationTruth.js` — NEW: Shared CRM suppression constants
- `/app/frontend/src/hooks/useCalibrationState.js` — MODIFIED: Flow reorder + identity + ABN
- `/app/frontend/src/pages/CalibrationAdvisor.js` — MODIFIED: Wired ForensicIdentityCard
- `/app/frontend/src/components/calibration/IntelligencePhases.js` — MODIFIED: Snapshot v2 7-section
- `/app/frontend/src/components/calibration/ChiefMarketingSummary.js` — MODIFIED: Confidence capping
- `/app/frontend/src/pages/MarketPage.js` — MODIFIED: Tabs + action buttons + scroll fix
- `/app/frontend/src/components/DashboardLayout.js` — MODIFIED: Right panel + VerificationBadge
- `/app/frontend/src/pages/RevenuePage.js` — MODIFIED: Fixed null crash
- `/app/frontend/src/pages/DataHealthPage.js` — MODIFIED: Removed demo fallback
- `/app/frontend/src/pages/website/PricingPage.js` — REWRITTEN: Executive 5-tier pricing
- `/app/frontend/src/pages/Pricing.js` — REWRITTEN: Standalone pricing

### Edge Functions (Source code, awaiting deployment)
- `/app/supabase/functions/calibration-business-dna/index.ts` — Perplexity-first domain scan
- `/app/supabase/functions/business-identity-lookup/index.ts` — ABR ABN lookup
- `/app/supabase/functions/query-integrations-data/index.ts` — Soundboard data queries
- `/app/supabase/functions/biqc-insights-cognitive/index.ts` — Snapshot v2 + prediction storage

### SQL
- `/app/supabase/migrations/020_insight_outcomes.sql` — Prediction tracking table

### Documentation
- `/app/memory/PRD.md` — Product requirements
- `/app/memory/BACKLOG.md` — Complete backlog with status
- `/app/memory/ROADMAP.md` — Sprint plan
- `/app/reports/FORENSIC_PLATFORM_AUDIT_20260226.md` — Full platform audit

---

## CREDENTIALS
- **User:** `andre@thestrategysquad.com.au`
- **Password:** `BIQc_Test_2026!`
- **Purge script:** `/app/memory/purge.sql`

---

## HARD CONSTRAINTS FOR NEXT AGENT
1. **Supabase-First** — No new FastAPI endpoints. All logic in Edge Functions or SQL.
2. **No Fake Data** — Never add hardcoded, demo, or placeholder data.
3. **Trust the Handoff** — This document is the source of truth.
4. **Onboarding Flow is Sacred** — Domain → Identity Verification → Footprint → Snapshot → Dashboard.
5. **Integration Truth** — No CRM claims without CRM connected. Period.
6. **Fork to `biqc.ai`** — Work against production.
