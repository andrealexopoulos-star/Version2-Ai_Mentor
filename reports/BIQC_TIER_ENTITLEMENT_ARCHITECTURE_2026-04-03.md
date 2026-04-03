# BIQc Tier Entitlement Architecture

Date: 2026-04-03  
Model: `Free`, `Starter`, `Pro`, `Enterprise`, `Custom Build`, `Super Admin`

## Canonical Tier Intent
- `Free`: client-facing core surfaces and foundational operations.
- `Starter`: BIQc Foundation package, paid entry for deeper operating intelligence.
- `Pro`: higher volume, expanded workflows, and stronger operational depth.
- `Enterprise`: governance-first, organization-scale controls and reliability posture.
- `Custom Build`: contract overlay with tailored entitlements and implementation scope.

## Runtime Canonicalization
- Frontend and backend now support canonical paid tiers while preserving legacy aliases.
- Legacy aliases map as follows:
  - `foundation`, `growth` -> `starter`
  - `professional`, `pro` -> `pro`
  - `custom` -> `custom_build`
- Super admin remains immutable override.

## Policy Layers
1. **Route Access**
   - Minimum tier requirement by route.
   - Launch type controls (`free`, `foundation`, `waitlist`) remain active.

2. **Feature Entitlements**
   - Plan-key and feature-key mapping in admin pricing control plane.
   - Per-feature min tier, usage limits, and overage fields supported.

3. **Usage Limits**
   - Tiered caps for snapshots/audits and KPI depth.
   - Distinct values for `starter`, `pro`, `enterprise`, `custom_build`.

4. **Commercial Layer**
   - Stripe self-serve for `starter`, `pro`, `enterprise`.
   - `custom_build` remains contract-driven (contact + override workflow).

## Admin Control Plane Readiness
- Existing endpoints already support:
  - plan drafts and versioning
  - entitlement upserts
  - dual-approval publish/rollback
  - pricing overrides for account/user/feature
- This is sufficient to manage the 3-tier + custom model without schema redesign.

## Governance Rules
- No tier behavior change without parity validation in frontend and backend resolvers.
- No pricing publish without dual approval and audit log.
- No custom-build promises without explicit override payload or contract artifact.
