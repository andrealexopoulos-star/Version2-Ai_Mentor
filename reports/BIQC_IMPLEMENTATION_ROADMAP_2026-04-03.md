# BIQc Prioritized Implementation Roadmap

Date: 2026-04-03  
Objective: unify UX/UI, gating, and infra controls with zero regression and zero duplication.

---

## Priority Framework
- P0: hard failure, security/governance, revenue-impacting regression risk.
- P1: major UX/architecture inconsistency with high operational friction.
- P2: optimization and maintainability gains.

---

## Wave 1 (P0, Week 0-2): Stability and Truth Controls

1. **Tier policy drift guard (frontend/backend parity)**
   - Build an automated parity check between:
     - `frontend/src/config/routeAccessConfig.js`
     - `backend/tier_resolver.py` (`ROUTE_ACCESS`, `API_ACCESS`)
   - Block release on mismatch for routed modules.

2. **Admin-adjustable pricing control plane (foundation schema)**
   - Add pricing tables: `pricing_plans`, `pricing_features`, `pricing_overrides`, `pricing_audit_log`.
   - Introduce read-only admin pricing APIs first.
   - Keep existing Stripe route behavior as fallback until publish workflow is live.

3. **Supplier health proof artifact**
   - Produce sanitized probe artifact per release:
     - Azure/Supabase/GitHub status
     - vendor key presence + endpoint contract probe status
   - Prevent release when finance-critical suppliers are unavailable.

4. **Mobile/desktop gate parity**
   - Align mobile lock-state behavior to desktop lock-state policy (no hidden paid capability without explanation).

Acceptance criteria:
- Release gate fails on route-tier drift.
- Pricing schema deployed with rollback-safe migration.
- Gate artifact includes supplier statuses and timestamps.
- Mobile and desktop show equivalent tier lock semantics.

---

## Wave 2 (P1, Week 2-6): UX Unification and Gating Runtime

1. **Unified module card system**
   - Standard card contract:
     - value statement
     - status tag
     - tier and usage indicator
     - confidence/freshness
     - primary CTA
   - Apply across Advisor, Foundation, and intelligence surfaces.

2. **FeatureGate runtime consolidation**
   - Build centralized policy runtime consumed by:
     - route guards
     - nav visibility/locks
     - module cards
     - API deny reason mapping
   - Add structured telemetry for gate-deny causes.

3. **Deprecated surface cleanup**
   - Inventory and retire preview/legacy routes not needed in production path.
   - Preserve explicit redirects for active aliases.

Acceptance criteria:
- At least 80% of primary modules use standardized card contract.
- Single policy read path for route/menu locking in frontend.
- Deprecated routes either removed or feature-flagged with owner.

---

## Wave 3 (P1-P2, Week 6-10): Supplier Quota and Cost Governance

1. **Supabase usage/billing observability integration**
   - Ingest dashboard-level quota signals (egress/storage/MAU/edge invocations) into release readiness artifacts.

2. **Azure capacity and cost posture guard**
   - Track app service plan utilization and scaling behavior.
   - Define thresholds for cost/perf anomaly alerts.

3. **Model vendor spend control**
   - Per-vendor budgets + request ceilings + fallback model chains.
   - Contract tests for endpoint changes (e.g., Firecrawl endpoint drift).

Acceptance criteria:
- Usage and spend snapshots attached to release pack.
- Alerting on quota/rate-limit risk before service degradation.
- Vendor probe suite detects endpoint contract breaks.

---

## Wave 4 (P2, Week 10-14): Advanced Entitlements and Admin Pricing Publish

1. **Admin pricing publish workflow**
   - Draft -> review -> publish -> rollback lifecycle.
   - Dual approval for finance-impacting changes.

2. **Entitlement and permission expansion**
   - team/role permission overlays beyond tier-only gating.
   - audit trail for every entitlement override.

3. **UX quality hardening**
   - latency budgets and reliability SLOs for advisor interactions.
   - lock copy and upgrade rationale consistency.

Acceptance criteria:
- Pricing publish and rollback completed in staging and production drills.
- Permission changes are traceable and reversible.
- SLO dashboards include response latency and failure bands.

---

## Recommended Owners (DRI)
- Tier policy and gate runtime: Platform FE + API lead
- Pricing control plane: Billing/API lead + Finance systems lead
- Supplier observability: Infra lead
- UX unification: Design system lead + product engineering
- Release gate enforcement: Ops/release lead

---

## Execution Safety Rules
- No release if finance reconciliation, drift SLA, or evidence integrity fails.
- No gate bypass without explicit logged override policy.
- No lock-state behavior changes without parity tests (desktop/mobile).
- No pricing behavior changes without rollback plan and audit log coverage.

---

## Tier Hardening Carry-Forward (2026-04-03)
- Canonical policy target is now `Free + Starter + Pro + Enterprise + Custom Build`.
- `BIQc Foundation` remains Starter package entry; `More Features` remains staged graduation surface.
- Scope continuity is anchored to:
  - `docs/operations/SCOPE_EXECUTION_CHECKPOINTS.md`
  - `docs/operations/BLOCK_CONTINUITY_PROTOCOL_2026-04-03.md`
- Admin visibility for current blocks is exposed at `/admin/scope-checkpoints` (API: `/api/admin/scope-checkpoints`).

