# BIQc Implementation Roadmap (Telemetry + UX Validation Extension)

Date: 2026-04-01  
Goal: execute post-review follow-up tasks without regression

## Execution Order (Hard Dependency)

1. Branch synchronization and drift controls
2. Gating parity enforcement (frontend/backend)
3. Supplier telemetry ingestion (Supabase + Azure + key vendors)
4. UX validation loop and pricing comprehension checks
5. Deferred integrations (Xero and postponed connectors)

---

## Wave A (Week 0-1): Branch Synchronization and Drift Closure

### A1. Detached-head normalization
- Create a named branch from `origin/main` and attach worktree.
- Add local ignore policy for `supabase/.temp/*` and local marker files.
- Add CI guard that fails if ephemeral temp files are staged.
- Implemented guard chain extension:
  - script `scripts/ephemeral_artifact_guard.py`
  - release refresh step `ephemeral_artifact_guard` in `scripts/run_release_evidence_refresh.py`
  - release gate `EPHEMERAL-ARTIFACT-GUARD-01` in `scripts/release_evidence_index_builder.py`

### A2. Merge reconciliation checklist
- Verify `git rev-parse HEAD == git rev-parse origin/main` for tracked code.
- Produce drift report splitting:
  - tracked divergence
  - untracked local artifacts
  - environment/session-only drift

Success metric:
- `tracked_divergence_count = 0` on release branch before deploy.

---

## Wave B (Week 1-3): Supplier Telemetry and Monitoring Dashboards

### B1. Supabase telemetry integration
- Build telemetry collector job to ingest:
  - MAU (monthly)
  - storage object bytes
  - DB size bytes
  - egress GB (billing API/export ingestion)
- Store snapshots in `supplier_usage_snapshots` table with `env`, `captured_at`, `source`.
- Implemented baseline collector: `scripts/prod_supplier_telemetry_snapshot.py` writing machine-readable artifacts in `test_reports/`.
- Gate contract: `SUPPLIER-TELEMETRY-PROD-01` must pass in release evidence index.
- Evidence freshness runner: `scripts/run_release_evidence_refresh.py` regenerates core artifacts and rebuilds release index in one command.
- CI wiring added in `.github/workflows/deploy.yml` as blocking job `release-evidence-refresh` before image build/deploy.

### B2. Azure telemetry integration
- Capture:
  - App Service CPU/memory utilization
  - request latency percentiles
  - error rates
  - plan SKU/worker count
- Explicitly mark FunctionApp cold-start metrics as N/A unless FunctionApps are introduced.

### B3. Monitoring dashboard build
- Create dashboard panels:
  - supplier quota burn-down
  - monthly cost trend
  - latency and error budget compliance
  - gate-deny reason volumes

Success metrics:
- 100% of release packs include a telemetry snapshot no older than 24h.
- P95 API latency reduced by 20% for calibration and soundboard endpoints.
- Error budget breach alerts delivered within 5 minutes.

---

## Wave C (Week 2-5): UX Validation and Pricing Comprehension Loop

### C1. Structured user research loop
- Implement recurring cycle:
  1) define hypothesis
  2) run moderated usability sessions
  3) run in-product survey checkpoints
  4) ship iteration
  5) validate against metrics
- Implemented backend scaffolding:
  - migration `supabase/migrations/074_ux_feedback_loop.sql`
  - user event endpoint `POST /api/ux-feedback/events`
  - admin analytics endpoints:
    - `GET /api/admin/ux-feedback/summary`
    - `GET/PUT /api/admin/ux-feedback/checkpoints`
- Implemented admin UI:
  - page `frontend/src/pages/AdminUxFeedbackPage.js`
  - route `/admin/ux-feedback`
  - admin navigation item "UX Feedback"
- Implemented in-app capture:
  - feedback quick-action in `frontend/src/components/DashboardLayout.js`
  - posts route-scoped feedback events into `/api/ux-feedback/events`

### C2. Pricing comprehension checkpoints
- Add instrumented events:
  - lock-card viewed
  - upgrade CTA opened
  - reason-for-upgrade shown
  - user confusion/abandon signals
- Run comprehension test every release train on free and starter personas.

### C3. Soundboard quality milestones
- Track:
  - regenerate/edit success rate
  - streaming reliability
  - citation click-through rate
  - continuity restore success after refresh

Success metrics:
- Calibration error rate reduced by 30%.
- Soundboard streaming success rate >= 99%.
- Citation click-through rate >= 40% on grounded answers.
- Pricing misunderstanding incidents reduced by 25%.

---

## Wave D (Week 5-8): Feature-to-Tier Hardening and Overage Governance

### D1. Entitlements cross-validation gate
- Auto-compare:
  - `frontend/src/config/routeAccessConfig.js`
  - `backend/tier_resolver.py`
  - feature-to-tier matrix artifact
- Fail CI on mismatched tier or launch type.
- Implemented parity gate script: `scripts/feature_tier_parity_gate.py`
- Added release gate: `TIER-PARITY-PROD-01`
- Drift fixed during implementation: `/decisions` now explicitly mapped in backend route policy.
- Added matrix consistency gate script: `scripts/feature_tier_matrix_consistency_gate.py`
- Added release gate: `FEATURE-TIER-MATRIX-CONSISTENCY-01`
- Drift fixed during implementation: `/billing` now explicitly mapped in frontend and backend route policy maps.

### D3. Pricing control-plane scaffolding
- Implemented migration baseline: `supabase/migrations/073_pricing_control_plane.sql`
- Implemented admin API skeleton:
  - `GET/PUT /api/admin/pricing/plans`
  - `GET/PUT /api/admin/pricing/entitlements`
  - `GET/PUT /api/admin/pricing/overrides` (custom pricing adjustments per user/account)
  - `POST /api/admin/pricing/publish` (dual-approval check)
  - `POST /api/admin/pricing/rollback` (dual-approval check)
- Router wired in `backend/server.py` via `routes/pricing_admin.py`.
- Admin UI implemented:
  - page `frontend/src/pages/AdminPricingPage.js`
  - route `/admin/pricing` in `frontend/src/App.js`
  - navigation item "Pricing Control" in `frontend/src/components/DashboardLayout.js`

### D2. Overage governance policy
- Define per supplier:
  - warning threshold
  - hard threshold
  - degrade policy
  - user-facing messaging
- Trigger upgrade guidance only when a direct blocker is detected.
- Current prod telemetry defaults:
  - Supabase MAU warn `40,000`, hard `50,000`
  - Supabase storage warn `8 GiB`, hard `10 GiB`
  - Supabase DB size warn `1 GiB`, hard `2 GiB`

Success metrics:
- Tier-policy mismatch incidents = 0 in main.
- Over-quota incidents with no warning = 0.

---

## Wave E (Week 8+): Deferred Integrations

### E1. Xero integration rollout (post-core stability)
- Complete auth + ingestion + billing impact controls (see deferred integration plan).

### E2. Other deferred services
- Normalize BrowseAI and Firecrawl endpoint contracts.
- Promote from placeholder to gated feature only after telemetry and cost controls are active.

Implementation scaffolding now live:
- migration `supabase/migrations/075_deferred_integrations_tracker.sql`
- admin API:
  - `GET/PUT /api/admin/deferred-integrations`
- admin visibility:
  - Deferred Integrations Tracker section in `frontend/src/pages/AdminUxFeedbackPage.js`

Success metrics:
- Deferred integration launch checklist pass rate = 100%.
- No P0/P1 regressions in core modules after deferred connector rollout.

---

## Governance and Ownership

- Platform/runtime owner: branch sync, gate parity, release blockers
- Infra owner: supplier telemetry + dashboards
- Product/design owner: usability loop + pricing comprehension
- Integrations owner: deferred connectors and cost/risk controls

## Non-Negotiable Guardrails

- No release with unresolved tracked divergence against `origin/main`.
- No release if telemetry snapshot is stale (>24h) for finance or supplier-critical modules.
- No release if tier policy maps diverge between frontend and backend.
- No deferred integration launch before core telemetry and gating controls are green.
