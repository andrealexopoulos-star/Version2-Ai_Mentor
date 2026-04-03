# BIQc Comprehensive Stocktake & Unified Blueprint

Date: 2026-04-03  
Mode: Live evidence + codebase audit  
Scope baseline: current local worktree vs `origin/main`

---

## 1) Parity and Relevance Baseline (Phase 1)

### Local vs Main status
- `HEAD`: `98ad2e025f492a593b104de42d6cf113e07cb822`
- `origin/main`: `98ad2e025f492a593b104de42d6cf113e07cb822`
- Tracked diff local->main: none
- Tracked diff main->local: none

Conclusion:
- Current local and remote `main` are relevant and in sync for tracked code.
- Worktree is detached-head (operationally fine for audit, not ideal for future dev).
- Local-only drift exists in untracked temp artifacts:
  - `supabase/.temp/*` files
  - local marker file(s) such as `SERPAPI`

Risk:
- Untracked temp files do not alter deployment unless staged, but can pollute future commits.

### Environment/config drift signals
- Supabase CLI is linked to prod project `vwwandhoydemcybltoxz`.
- Azure and GitHub CLI sessions are active.
- Vendor secrets are loaded through Azure Key Vault, not committed config.

---

## 2) Complete Module and Feature Inventory (Phase 2)

Evidence anchors:
- Frontend routes: `frontend/src/App.js` (`113` route definitions, `113` unique paths)
- Backend orchestrator: `backend/server.py` (`41` route modules mounted)
- Supabase Edge Functions: `supabase/functions` (`32` deployed function directories)
- Existing detailed inventory baseline: `reports/platform_feature_inventory.md`

### Module inventory (customer-facing + partial + conceptual)

| Module | Purpose / Value | Status | Implemented | Pending / Gaps | Tier/Gating |
|---|---|---|---|---|---|
| Auth + Lifecycle | Identity, gated route progression | Live | Supabase auth, login/register/callback, lifecycle checks | MFA hardening not complete | Free; admin-only debug routes |
| Calibration Advisor | Persona calibration and onboarding transition | Live | calibration init/answer/status, reset/defer, forensic calibration page | QA route retired, preview artifacts remain | Free |
| BIQc Overview (`/advisor`) | Executive command center | Live | lifecycle summary, watchtower signals, handoff | Some module card consistency drift | Free |
| Soundboard | Flagship advisor conversation | Live + upgraded | SSE progressive endpoint, conversation CRUD, coverage window, role policy + conversion guardrails | Token-native provider streaming still partial (chunked post-response stream) | Free core, advanced modes tier-constrained |
| Boardroom | Strategic compressed briefing | Live | boardroom route, traces, orchestration and fallback paths | UX parity with Soundboard still uneven | Foundation (paid) |
| Market & Benchmark | Positioning insights | Live | market page, competitive benchmark | Deeper SEMrush/serp explainability not normalized | Free |
| Integrations Hub | Connect external systems | Live | Merge link token/exchange, connected list, disconnect, CRM/accounting fetchers | Connector depth and historical backfill transparency needs stronger UX | Free entry, breadth by plan |
| Email + Calendar | Operational communication intelligence | Live | Outlook/Gmail auth, inbox sync, calendar views | Reliability tied to token freshness and provider throttling | Free |
| Revenue/Operations/Billing | Financial and operating intelligence | Mixed Live/Beta | Revenue + Ops pages, unified billing endpoints, Stripe checkout, supplier obligations | Admin-adjustable pricing control plane not implemented | Paid routes with upgrade redirects |
| Marketing Automation + Intelligence | Campaign and market intelligence | Live/Beta | marketing intelligence + automation routes | Waitlist/premium split and lock messaging inconsistent across mobile/desktop | Foundation + waitlist |
| Risk/Compliance/Audit Log | Governance workflows | Partial / waitlist-heavy | risk/compliance routes, forensic audit surface, audit log route | still mostly waitlist-gated and unevenly surfaced | Waitlist/premium |
| Data Center + Documents + Reports | Data/knowledge operations | Partial | data center, docs, report routes and APIs | discoverability and locked-state parity need unification | Waitlist/premium |
| Admin + Observability + PromptLab | Privileged operations tooling | Live (restricted) | admin dashboard, prompt lab, support console, observability | central policy engine and immutable audit streams need strengthening | Super admin/admin only |
| Website + Platform demo surfaces | Acquisition and product narrative | Live | website pages, platform demo pages, trust/legal pages | website IA and app IA still diverge structurally | Public |
| Preview/Legacy/Conditional pages | Feature preview and deprecated fallback | Partial/deprecated | conditional imports and preview routes retained | dead path cleanup needed to reduce duplication risk | Mostly non-prod/preview |

### Hidden/deprecated/duplication flags
- Conditional/preview pages in `App.js` (`CognitiveV2Mockup`, `LoadingPreview`, `CalibrationPreview`) increase branch drift risk.
- Route aliasing and redirects exist (`/warroom`, `/boardroom`, legacy integrations query redirect) and must remain mapped during unification.
- Existing archived docs and backups under `_backups` contain legacy behavior descriptions and can confuse implementation if not classified.

---

## 3) Architecture Mapping (Phase 3)

### Frontend / UX stack
- React 19 + CRA/CRACO (`frontend/package.json`)
- Routing: `react-router-dom`
- UI primitives: Radix + custom design tokens
- Design system: `frontend/src/design-system/tokens.js`
- CSS token layer + dual dark/light variables: `frontend/src/index.css`
- Divergence points:
  - Desktop nav (`DashboardLayout`) uses route lock logic and lock redirects
  - Mobile nav (`MobileNav`) collapses/hides foundation items for free users instead of full lock-state parity
  - Public website and app shells use different IA conventions

### Backend / API / data stack
- FastAPI monolith orchestrator with modular routers (`backend/server.py`)
- 41 mounted backend route modules
- Supabase Postgres + Supabase Auth
- Route/API tier enforcement:
  - frontend: `frontend/src/config/routeAccessConfig.js`, `tierResolver.js`
  - backend: `backend/tier_resolver.py`, `backend/middleware/tier_guard.py`
- Integration layer:
  - Merge unified API client (`backend/merge_client.py`)
  - Stripe billing routes (`backend/routes/stripe_payments.py`)
  - Unified billing aggregation (`backend/routes/billing.py`)

### Cloud/serverless topology
- Supabase edge function directories: 32 active folders under `supabase/functions`
- Azure runtime:
  - Web apps detected (prod+dev+worker surfaces) in `biqc-production`
  - App Service plans:
    - `biqc-plan` `PremiumV2` (`P3v2`)
    - `ASP-biqcbetawebgroup-bbc2` `Premium0V3` (`P0v3`)
  - FunctionApp list returned empty in active subscription (workloads are app service web apps, linux container kind)

### Dataflow summary
- User auth/session -> Supabase auth/user profile
- Integrations (Merge / email/calendar) -> ingestion/emission routes -> observation events/snapshots
- Intelligence modules -> watchtower/cognition/boardroom/soundboard surfaces
- Billing:
  - Stripe transactions -> `payment_transactions`
  - Accounting via Merge/Xero path -> invoice/supplier summaries

---

## 4) Live Supplier Tier/Quota/Pricing Analysis (Phase 4)

## 4.1 Live access check
- GitHub CLI: authenticated (`repo`, `read:org`, `gist`)
- Supabase CLI: authenticated, org and project inventory retrieved
- Azure CLI: authenticated (`andre@thestrategysquad.com.au`, subscription enabled)
- Azure Key Vault: `biqckvcore01` accessible, required secrets enabled

## 4.2 Supplier matrix (current observed)

| Supplier | Live Status | Current Tier/Plan Visibility | Key Risk |
|---|---|---|---|
| GitHub Actions | PASS | recent main runs all success (latest 5) | need continuous gate-proof linkage in release packs |
| Supabase | PASS | 4 active projects visible; prod linked project healthy | plan/quota consumption granularity not exposed via CLI alone |
| Azure App Service | PASS | PremiumV2/Premium0V3 plans active | cost floor and overprovision drift if autoscale not tuned |
| Stripe | PASS probe (200) | API key valid, checkout + webhook paths live | pricing config hardcoded in route map |
| Merge | key present | requires account-token scoped probes per linked account | per-tenant connector health visibility gap |
| OpenAI | PASS probe (200) | active secret available | usage cost spikes need spend caps |
| Anthropic | PASS probe (200) | active secret available | model routing governance needed |
| Perplexity | PASS probe (200) | active secret available | citation freshness guardrails needed |
| Firecrawl | key present, probe 404 on credits endpoint | secret available | endpoint contract drift risk (health endpoint mismatch) |
| SEMrush | PASS probe (200) | dev key path currently used | prod/dev secret mapping must be explicit |
| Serper/SERP | PASS probe (200) | mapped into SERP variable | naming consistency (`SERPER` vs `SERPAPI`) |
| BrowseAI | key present | no stable health endpoint configured in repo | runtime contract not externally verified |
| Xero | intentionally deferred in this run | not validated live in this pass | billing completeness gap until mapped |

### Supplier quota and pricing constraints (actionable)
- Supabase:
  - CLI confirms project health and APIs, but not full quota spend telemetry.
  - Must pull dashboard billing/usage snapshots into evidence for egress/storage/MAU/edge invocation tracking.
- Azure:
  - Premium app service plans reduce cold-start sensitivity.
  - Must monitor compute/memory utilization and idle premium cost floor.
- AI vendors:
  - All core keys present and majority probes healthy.
  - Need central spend and latency envelope policy to prevent silent overages.

---

## 5) UX/UI Unification + Gating Blueprint (Phase 5)

### Unified information architecture contract
- Standardize navigation semantics across desktop/mobile/public surfaces:
  - `Core Free`
  - `Foundation Paid`
  - `Waitlist / Preview`
  - `Admin`
- Avoid hidden paid capability where discoverability is strategic; use visible locked cards/rows with explicit rationale.

### Module card standard (single pattern)
- Required fields:
  - `Module name`
  - `Value statement` (1-line measurable promise)
  - `Status tag` (`Active`, `Beta`, `Coming Soon`, `Locked`)
  - `Tier gate` + usage meter if applicable
  - `Data freshness` + confidence
  - `CTA` (`Open`, `Upgrade`, `Join waitlist`, `Connect source`)

### Centralized gate architecture
- Implement unified `FeatureGate` policy runtime:
  - single source config for routes + API + module cards
  - policy attributes: `min_tier`, `launch_type`, `usage_limit`, `role_override`, `supplier_dependency`
  - telemetry hooks for gate hit, deny reason, conversion intent eligibility
- Preserve existing role policy and conversion guardrails from soundboard logic.

### Admin-adjustable pricing control plane (required)
- Introduce admin pricing control domain:
  - `pricing_plans` table (versioned, effective dates)
  - `pricing_features` table (feature-to-tier entitlement)
  - `pricing_overrides` table (account/user scoped overrides)
  - immutable `pricing_audit_log`
- APIs:
  - `GET/PUT /api/admin/pricing/plans`
  - `GET/PUT /api/admin/pricing/entitlements`
  - `POST /api/admin/pricing/publish`
  - `POST /api/admin/pricing/rollback`
- UI:
  - Admin pricing console with draft/publish workflow
  - Two-person approval for finance-impacting changes
  - one-click rollback and diff preview

---

## 6) Risk, Regression, and Reliability Strategy (Phase 6)

### P0 risks
1. Fragmented tier policy sources (frontend route map vs backend route map) can drift.
2. Mobile/desktop gating behavior not fully symmetric (hidden vs locked states).
3. Hardcoded plan values in Stripe route (`PLANS`) block true admin pricing agility.
4. Vendor endpoint contract uncertainty (e.g., Firecrawl probe mismatch) can silently break data flows.

### P1 risks
1. Preview/deprecated route clutter increases merge and UX confusion risk.
2. Lack of consolidated supplier spend/quota dashboard in release gate evidence.
3. Detached local worktree operation can confuse branch hygiene for future merges.

### P2 risks
1. Naming inconsistencies (`serper` vs `serpapi`) in env conventions.
2. Legacy docs/backups can mislead implementation if not classified.

### Fallback and anti-regression controls
- Add explicit service fallback contracts:
  - timeout budget + retry policy + cache fallback + user-facing degraded mode copy.
- Extend release gates:
  - policy-drift check (`routeAccessConfig` vs `tier_resolver`)
  - menu parity check (desktop vs mobile gate state)
  - supplier health contract check with non-secret result artifacts
- Preserve CFO/ZD-ZR-ZA invariants and existing strict closure scripts.

---

## 7) Recommendations and Roadmap (Phase 7)

## Immediate (0-2 weeks)
1. Create parity guard checks between frontend and backend tier maps.
2. Implement pricing control-plane schema and admin APIs (read-only first, then publish workflow).
3. Normalize mobile gate behavior to match desktop lock-state UX.
4. Build supplier health probe artifact generator with status-only outputs.

## Near term (2-6 weeks)
1. Migrate hardcoded Stripe plan config to data-driven pricing tables.
2. Unify module-card components across all major pages.
3. Classify and retire deprecated preview routes or move behind explicit feature flags.
4. Add spend/quota dashboards for Supabase + Azure + model providers.

## Mid term (6-12 weeks)
1. Full FeatureGate runtime unification with policy registry.
2. Role-aware entitlement studio and permissions layering for teams.
3. Advanced release guard automation:
  - contract drift tests
  - gating parity tests
  - supplier quota breach simulations

---

## Deliverable Summary
- This document: full stocktake + architecture + live supplier posture + blueprint + risk strategy.
- Feature-to-tier matrix: `reports/BIQC_FEATURE_TIER_MATRIX_2026-04-03.csv`
- Prioritized implementation roadmap: `reports/BIQC_IMPLEMENTATION_ROADMAP_2026-04-03.md`
- Supplier live matrix artifact: `reports/BIQC_SUPPLIER_LIVE_MATRIX_2026-04-03.json`

---

## Appendix A — Live Evidence Snapshot (sanitized)
- GitHub main workflow runs (latest 5): all `success`.
- Supabase org and projects visible; prod project linked and healthy.
- Azure subscription enabled and app service plans in premium tiers.
- Key Vault secret inventory for required vendors enabled.
- Vendor probe status:
  - Stripe 200
  - OpenAI 200
  - Anthropic 200
  - Perplexity 200
  - Serper 200
  - SEMrush 200
  - Firecrawl 404 on tested endpoint (key present)
  - Merge/BrowseAI key-present, endpoint validation constrained by account-token or no stable health endpoint.

