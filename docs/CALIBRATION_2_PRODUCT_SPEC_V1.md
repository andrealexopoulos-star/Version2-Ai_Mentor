# Calibration 2.0 Product Spec v1

## Status

- Mode: Pre-implementation specification
- Change class: Product/system contract definition
- Behavior changes: Not applied in this document
- Regression guard: Mandatory protocol in `docs/CALIBRATION_2_ZERO_REGRESSION_PROTOCOL.md`

## 1. Objective

Deliver a conversion-grade onboarding and calibration system that:

1. Reaches first-wow value in-session.
2. Produces evidence-backed and confidence-labeled insights.
3. Persists calibration outputs into profile tabs and immutable report artifacts.
4. Completes with authoritative routing state.
5. Transitions seamlessly into Market & Insights with no visual or state drop.

## 2. Non-Negotiable Constraints

1. Zero regression.
2. Zero unapproved fallback behavior.
3. Zero silent completion bypass.
4. Single routing authority: `/api/calibration/status`.
5. Identity confirmation required before strategic narrative progression.
6. Full provenance tracking for all high-impact claims.

## 3. Canonical State Machine

### Phase 0 — Entry Gate

- Endpoint: `GET /api/calibration/status`
- If complete: route to `Market & Insights`
- Else: enter ignition

### Phase 1 — Ignition + Intent Capture

Collect:
- website URL
- optional social handles (LinkedIn, Instagram, Facebook, X, Pinterest, YouTube, TikTok)
- manual-only option

### Phase 2 — Multi-source Discovery (parallel)

Required outputs:

1. Website/business extraction
2. Identity signal extraction
3. Social footprint extraction
4. Competitor + market benchmarking
5. Customer review intelligence
6. Staff review intelligence

All produce one `scan_bundle`.

### Phase 3 — Identity Verification (blocking)

Must confirm:
- legal/trading name
- website/domain
- location
- ABN/ACN
- contact signals
- social evidence

### Phase 4 — WOW Moment (first hook)

Four mandatory cards:

1. Revenue/lead leakage proxy
2. Competitor delta
3. Hidden issue discovery
4. Immediate quick win

Card schema:
- claim
- evidence
- confidence
- action CTA

### Phase 5 — AHA Moment

- 7/30/90 strategic moves
- each move includes owner, effort, expected KPI shift, confidence, evidence

### Phase 6 — Deep CMO Report

- minimum long-form report requirement (>= 1000 words)
- includes:
  - service/location competitor context
  - customer review sentiment risk/opportunity
  - staff review risk/opportunity
  - channel recommendations
  - priority roadmap

### Phase 7 — Adaptive Operator Calibration

- dynamic branch tree (not fixed rigid 9-only path)
- starts with core dimensions:
  - communication mode
  - risk posture
  - decision style
  - challenge tolerance
- probes based on confidence threshold
- persists final persona vector and trace

### Phase 8 — Integration Choice (tier-aware)

- free: one integration
- additional attempt: pricing interstitial with return-to-calibration context

### Phase 9 — Executive Snapshot + Reveal

- personalized first snapshot
- reveal choreography
- next best action

### Phase 10 — Completion Commit

- write completion through `/api/console/state`
- sync + cache clear
- route to `Market & Insights`

## 4. Manual Input Flow Contract

### Step A — Guided Intake

Required fields:
- business name
- location
- industry
- top 3 services
- target customer
- value proposition
- known competitors (optional)
- social links (optional)
- pain points

### Step B — Smart Enrichment (non-blocking)

Attempt:
- identity lookup by ABN/name/location
- handle normalization
- category benchmark enrichment
- customer review lookup by business + location
- staff review lookup by business + location

### Step C — Confidence Ladder

When confidence is low:
- show reason chips
- ask 2-3 directed clarifiers
- allow controlled continue with disclosure

### Manual WOW

Mandatory outputs:
1. Opportunity gap snapshot
2. Positioning contrast
3. Immediate messaging fix

### Manual AHA

Reframed positioning statement and 7-day checklist.

## 5. Data Source and API Matrix

## 5.1 Core AI + extraction

- OpenAI API: synthesis, scoring normalization, report generation
- Perplexity API: web/entity intelligence
- Firecrawl API: website/key page extraction

## 5.2 Search and discovery

- Serper/Brave/Bing search APIs for source retrieval and competitor/review discovery
- Google Places API for customer review and ratings signal

## 5.3 Social source connectors

- Meta Graph API (Instagram/Facebook business pages)
- YouTube Data API
- X API (approved availability only)
- Pinterest API (approved availability only)
- LinkedIn: compliant public-signal extraction + search evidence unless enterprise API access approved

## 5.4 Staff reviews

- Indeed (API/partner or compliant indexed signals)
- Glassdoor (licensed partner preferred)
- SEEK and regional alternatives where available
- fallback to search-indexed snippets only if approved, with confidence downgrade label

## 5.5 Optional trust sources

- Reddit/forum sentiment extraction
- G2/Capterra/Trustpilot where relevant

## 6. Storage Contract (Two-place persistence)

## Store A — Structured operational profile state

Primary table: `business_profiles`

Write as much as possible into first-class columns plus structured maps:
- `source_map`
- `confidence_map`
- `timestamp_map`
- `dna_trace`

Required `dna_trace` sections:
- `input_mode`: website/manual/hybrid
- `source_index`
- `identity_signals`
- `social_signals`
- `competitor_entities`
- `customer_review_summary`
- `staff_review_summary`
- `wow_cards`
- `aha_moves`
- `report_refs`

Related write:
- `user_operator_profile.operator_profile.calibration_journey`
- `strategic_console_state` and completion metadata

## Store B — Immutable report artifacts

### New table: `deep_cmo_reports`

Columns:
- `id` uuid
- `user_id` uuid
- `plan_tier` text
- `status` text
- `input_snapshot_ref` text/json
- `report_json` jsonb
- `pdf_storage_path` text
- `created_at` timestamptz
- `window_start_at` timestamptz
- `window_end_at` timestamptz

### Optional table: `forensic_market_exposure_reports`

Parallel structure with forensic-specific payload metadata.

### File storage path

- `reports/deep-cmo/{user_id}/{yyyy-mm-dd}/{report_id}.pdf`

## 7. Field-to-Tab Population Contract

Calibration writes must populate tabs:

### Business DNA
- business identity, website, ABN/ACN, social handles, confidence and source maps

### Market
- target market, ICP, competitor entities, market position, customer review sentiment, market signal score

### Product
- services, UVP, pricing model, offer clarity and weaknesses

### Team
- team indicators, hiring posture, staff review themes and risk profile

### Strategy
- growth strategy, challenges, priority actions, SWOT and competitor SWOT

## 8. Reports Page Contract

Page remains gated. Add tabbed experience:

1. `My Reports`
2. `Deep CMO Report`
3. `Forensic Market Exposure`

Buttons:
- `Generate Deep CMO Report`
- `Forensic Market Exposure`

### Quotas

- Free: 1 deep CMO report per rolling 30 days
- `$349` tier: 3 deep CMO reports per rolling 30 days

Backend must enforce quotas before generation starts.

## 9. Event and KPI Contract

### Mandatory events

- `calibration_started`
- `scan_started`
- `scan_first_result_ms`
- `identity_confirmed`
- `wow_card_viewed_{type}`
- `wow_card_action_clicked_{type}`
- `aha_plan_generated`
- `aha_plan_accepted`
- `cmo_report_confirmed`
- `psych_started`
- `psych_completed`
- `integration_step_entered`
- `integration_connected_1st`
- `upgrade_prompt_viewed`
- `calibration_completed`
- `time_to_activation_ms`

### KPI set

- D0 and D1 activation rate
- median time-to-wow
- median time-to-aha
- completion rate by input path
- conversion lift from quick-win acceptance
- paid conversion lift with competitor benchmark exposure

## 10. Motion System Contract

### Required journey continuity

- Auth -> Calibration -> Market must feel like one brand system.
- Replace hard completion jump with orchestrated route transition.

### Choreography timing budget

- ignition: <= 4s
- wow card stagger: 150-250ms
- completion reveal skippable after 2s
- total animation overhead in first-value path: <= 6s

### Accessibility

- reduced-motion compliance on all high-motion surfaces
- no critical information dependent on animation only

## 11. Edge Function Canonicalization Contract

Before behavior changes:

1. Canonicalize function tree and slug ownership.
2. Resolve duplicates and drift slugs.
3. Enforce structured logs:
   - `trace_id`
   - `phase`
   - `duration_ms`
   - `sources_used`
   - `confidence_summary`
   - `status`

## 12. Implementation Milestones

1. Phase A: baseline, contracts, tests, registry
2. Phase B: calendar reliability
3. Phase C: priority inbox redesign
4. Phase D: motion continuity system
5. Phase E: calibration 2.0 orchestration and report generation

Each phase requires gate approval and regression pass.

