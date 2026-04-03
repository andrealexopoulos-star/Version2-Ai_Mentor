# BIQc Tier Implementation Sequence

Date: 2026-04-03  
Goal: deploy tier hardening with rollback compatibility and zero-regression control.

## Phase 1: Policy Runtime (Completed Scaffold)
- Extend frontend/backend tier resolvers to support:
  - `starter`, `pro`, `enterprise`, `custom_build`
- Preserve legacy alias compatibility to avoid account breakage.
- Keep existing route minimums where unchanged to prevent accidental access expansion.

## Phase 2: Commercial Layer (Completed Scaffold)
- Add paid plan structure for `starter`, `pro`, `enterprise`.
- Keep `custom_build` as contract-led path (no self-serve checkout).
- Preserve legacy plan IDs in Stripe route normalization.

## Phase 3: Menu And UX Consistency (Completed)
- Update top nav language:
  - `Soundboard` -> `Ask BIQc`
  - `Email Priority Inbox` -> `Inbox`
- Keep lock-state behavior and redirect context transparent.

## Phase 4: Foundation And More Features Packaging (Completed Planning Artifacts)
- Publish package mapping report for Starter/Pro/Enterprise progression.
- Keep waitlist modules staged until promotion checks pass.

## Phase 5: Block Continuity Integration (Completed)
- Introduce admin checkpoint surface (`/admin/scope-checkpoints`) backed by checkpoint ledger parser.
- Define formal block continuity protocol for every gate change.

## Phase 6: Safety Gates Before Promotion
1. Frontend/backend tier parity check pass.
2. Feature-tier matrix consistency check pass.
3. Supplier telemetry snapshot available and within acceptable thresholds.
4. Checkpoint ledger updated with PASS/FAIL entries and artifacts.

## Rollback Compatibility
- Legacy plan aliases remain mapped to canonical tiers.
- Route paths remain unchanged.
- Existing `starter` behavior remains valid if `pro` or `enterprise` is not active for a user.
