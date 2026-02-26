# BIQc COMPLETE BACKLOG — Feb 26, 2026
## Everything Discussed, Current Status, What Remains

---

## SECTION A: DEPLOYMENT QUEUE (Code Written, Not Yet Deployed to Supabase)

| # | Item | Type | File Location | Status |
|---|------|------|---------------|--------|
| D1 | `calibration-business-dna` v2 — identity signals, /contact scrape, user hints | Edge Function UPDATE | `/app/supabase/functions/calibration-business-dna/index.ts` | AWAITING DEPLOY |
| D2 | `business-identity-lookup` — ABR free API (placeholder, needs GUID) | Edge Function NEW | `/app/supabase/functions/business-identity-lookup/index.ts` | BACKLOG (needs ABR_GUID) |
| D3 | `query-integrations-data` — Soundboard real data queries | Edge Function NEW | `/app/supabase/functions/query-integrations-data/index.ts` | AWAITING DEPLOY |
| D4 | `biqc-insights-cognitive` v2 — Snapshot v2, drift_velocity, trajectory, prediction storage | Edge Function UPDATE | `/app/supabase/functions/biqc-insights-cognitive/index.ts` | AWAITING DEPLOY |
| D5 | `insight_outcomes` table + `snapshot_confidence` column | SQL Migration | `/app/supabase/migrations/020_insight_outcomes.sql` | AWAITING RUN |

---

## SECTION B: FRONTEND DONE (Live in Codebase, Deploys with App)

| # | Item | Status |
|---|------|--------|
| F1 | ForensicIdentityCard — 7 signal blocks, 4 buttons, confidence scoring, ABN lookup button | DONE |
| F2 | Flow reorder — Identity Verification BEFORE footprint report | DONE |
| F3 | Snapshot CTA gating — hidden during ANALYZING, 3s delay after READY | DONE |
| F4 | Integration truth suppression — no CRM = no pipeline/churn/lead claims | DONE |
| F5 | Market page scroll fix | DONE |
| F6 | Soundboard integration onboarding auto-message on Market page | DONE |
| F7 | Soundboard data query routing — detects data queries, routes to Edge Function | DONE |
| F8 | Soundboard BNA updates — detect intent, confirmation card, write + refresh | DONE |
| F9 | Business Verification Score badge in dashboard header | DONE |
| F10 | Snapshot v2 UI — 7 sections (State, Trajectory, Moves, Blindside, Lever, Gaps, Confidence) | DONE |
| F11 | Confidence capping — report confidence limited by identity confidence | DONE |
| F12 | CTAs changed to "Try It For Free" across all public pages | DONE |
| F13 | Shared integrationTruth.js constants | DONE |

---

## SECTION C: LAUNCH READINESS GAPS (From Architecture Report — NOT ACTIONED)

These are the 5 structural clarity gaps identified. None require new modules. All are surfacing/presentation discipline.

### C1. Signal Provenance Layer (NOT STARTED)
**Gap:** Insights exist but don't visibly show WHERE each piece came from.
**Required:** Every major insight must display: Signal Source Type, Confidence, Data Age, Limiting Factors.
**Scope:**
- Add source badges to Market page insights (e.g. "website scan", "Perplexity market intel", "HubSpot CRM")
- Add data age indicator to each section
- Show limiting factors ("2 of 6 channels connected")
- Apply to: Market page, BIQc Overview, Snapshot, Soundboard responses

### C2. State Justification Formalisation (NOT STARTED)
**Gap:** System State (Stable/Drift/Compression/Critical) appears without explaining WHY.
**Required:** Show trigger signals, severity weighting, why this state outranked others.
**Scope:**
- Add expandable "Why this state?" section below System State banner
- Show the weighted signals that determined the state
- Show threshold that was crossed
- Reference specific data points (deal names, amounts, signal types)

### C3. Change-Centric Surface — "Since Your Last Visit" (NOT STARTED)
**Gap:** No visible evolution between visits. Platform feels static.
**Required:** Explicitly surface what changed since last session.
**Scope:**
- Track last_visit timestamp per user
- Compare current snapshot vs previous
- Show diff: "Since your last visit: System state moved from Stable → Drift"
- Show: new signals detected, competitor changes, confidence changes
- If nothing changed: "No material changes detected. Signals holding."

### C4. Tension Framing Without Forecasting (NOT STARTED)
**Gap:** Insights feel advisory instead of consequential.
**Required:** Frame consequences qualitatively without fabricating forecasts.
**Scope:**
- Each blindside risk and strategic move should include consequence language
- "If this persists, [qualitative consequence]" not "revenue will drop 18%"
- Use deterministic risk overlay data already computed
- Make insights feel inevitable, not optional

### C5. Chat Determinism (PARTIALLY DONE)
**Gap:** Chat must reference real data, refuse unsupported requests, surface gaps.
**What's done:** Soundboard now routes data queries to Edge Function, sends integration status on first open.
**What remains:**
- Chat must reference snapshot signals in responses (not just general GPT)
- Chat must explicitly refuse answering questions it can't support with data
- Chat must surface specific data gaps when asked about unavailable areas
- Chat responses must include source attribution

---

## SECTION D: INTEGRATIONS (NOT STARTED)

| # | Item | Priority | Status | Notes |
|---|------|----------|--------|-------|
| I1 | Google Ads — Full OAuth + data feed | P1 | NOT STARTED | Needs OAuth credentials from user |
| I2 | Meta Ads via Merge.dev | P2 | NOT STARTED | |
| I3 | LinkedIn via direct API | P2 | NOT STARTED | |
| I4 | GA4 via direct API | P2 | NOT STARTED | |
| I5 | ABN Lookup (ABR GUID registration) | BACKLOG | PLACEHOLDER | Edge Function ready, needs GUID |

---

## SECTION E: REVENUE / MONETISATION (NOT STARTED)

| # | Item | Priority | Status | Notes |
|---|------|----------|--------|-------|
| R1 | Stripe integration — checkout + webhooks | P1 | NOT STARTED | Test key available in pod |
| R2 | Feature gate — Forensic Calibration behind paywall | P1 | NOT STARTED | Depends on R1 |
| R3 | Feature gate — Executive Strategic Brief behind paywall | P1 | NOT STARTED | Depends on R1 |
| R4 | Subscription management (cancel/upgrade/downgrade) | P1 | NOT STARTED | Depends on R1 |

---

## SECTION F: COGNITION MATURITY UPGRADES (PARTIALLY DONE)

| # | Item | Priority | Status | Notes |
|---|------|----------|--------|-------|
| M1 | insight_outcomes table | Level 3 | CODE DONE, AWAITING SQL DEPLOY | |
| M2 | Prediction storage in biqc-insights-cognitive | Level 3 | CODE DONE, AWAITING DEPLOY | |
| M3 | Snapshot v2 output schema (drift_velocity, trajectory, data_gaps) | Level 3 | CODE DONE, AWAITING DEPLOY | |
| M4 | Manual `evaluate-predictions` admin Edge Function | Level 4 | NOT STARTED | Phase 2: after 30-60 days of data |
| M5 | Automated pg_cron evaluation | Level 4 | NOT STARTED | Phase 3: after 60-90 days |
| M6 | Insight Performance Index (accuracy rate display) | Level 4 | UI SHELL DONE | Needs M4 data to populate |
| M7 | Adaptive confidence weighting | Level 5 | NOT STARTED | Future |
| M8 | Behaviour-based leadership modelling | Level 5 | NOT STARTED | Future |

---

## SECTION G: BACKEND MIGRATION (NOT STARTED)

| # | Item | Priority | Status |
|---|------|----------|--------|
| B1 | Migrate `merge_emission_layer.py` → SQL function | P2 | NOT STARTED |
| B2 | Migrate `watchtower_engine.py` → SQL function | P2 | NOT STARTED |
| B3 | Migrate `silence_detection.py` → SQL function | P2 | NOT STARTED |
| B4 | SQL Triggers: auto-refresh on integration connect | P2 | NOT STARTED |
| B5 | SQL Triggers: auto-refresh on calibration complete | P2 | NOT STARTED |

---

## SECTION H: SECURITY (NOT STARTED)

| # | Item | Priority | Status |
|---|------|----------|--------|
| S1 | Supabase RLS policies audit — all tables | P2 | NOT STARTED |
| S2 | Edge Function auth pattern review | P2 | NOT STARTED |
| S3 | Review missing policies on new tables | P2 | NOT STARTED |

---

## SECTION I: TECH DEBT (NOT STARTED)

| # | Item | Priority | Status |
|---|------|----------|--------|
| T1 | CSS consolidation: 13 files → 2 | P3 | NOT STARTED |
| T2 | Legacy page cleanup: remove 8+ superseded pages | P3 | NOT STARTED |
| T3 | Recover missing Edge Functions: `intelligence-snapshot`, `social-enrichment` | P3 | NOT STARTED |
| T4 | Consolidate duplicate Supabase secrets | P3 | NOT STARTED |
| T5 | Add missing Merge.dev webhook handler | P3 | NOT STARTED |
| T6 | Un-versioned Edge Functions in git | P3 | NOT STARTED |

---

## SECTION J: EARLIER ISSUES (From Previous Sessions, Not Fixed)

| # | Item | Status |
|---|------|--------|
| E1 | `intelligence-snapshot` Edge Function deployed on Supabase but source not in git | NOT FIXED |
| E2 | `social-enrichment` Edge Function deployed on Supabase but source not in git | NOT FIXED |
| E3 | Merge.dev webhook secret exists without corresponding API route | NOT FIXED |
| E4 | Duplicate Supabase secrets needing consolidation | NOT FIXED |

---

## SECTION K: ENHANCEMENT IDEAS (Discussed, Not Prioritised)

- Cross-reference ABN with ASIC
- Domain age & WHOIS lookup
- Google Business Profile verification
- SSL certificate check
- Multi-source contradiction detection
- Predictive decay modelling
- Competitor monitoring webhooks
- Seasonal trend detection
- Smart onboarding prompts
- Weekly intelligence digest email
- Custom alert thresholds
- Mobile push notifications (PWA)
- Shareable intelligence reports (PDF export)
- Multi-workspace / agency mode
- White-label options
- API access for Pro users
- Webhook integrations (Slack, Zapier)
- "Verified by ABR" badge throughout dashboard

---

## RECOMMENDED PRIORITY FOR NEXT SESSION

**Launch Readiness (Architecture Report Gaps):**
1. C1 — Signal Provenance Layer
2. C2 — State Justification
3. C3 — Change-Centric Surface ("Since your last visit")
4. C4 — Tension Framing
5. C5 — Chat Determinism (remaining pieces)

These 5 items are the gap between 6.5/10 and 9/10 surface clarity.
They require NO new modules. Only disciplined surfacing of data you already compute.
