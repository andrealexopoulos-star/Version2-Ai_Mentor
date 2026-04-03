# BIQc Free Tier Hardening Policy

Date: 2026-04-03  
Objective: define what is safe, client-facing, and production-ready in Free tier with explicit guardrails.

## Free Tier Product Promise
Free tier is a real operating product, not a demo shell. It must deliver useful daily value without hidden lock behavior or ambiguous entitlement wording.

## Free Tier Included Surfaces
- `BIQc Overview` (`/advisor`)
- `Ask BIQc` (`/soundboard`)
- `Inbox` (`/email-inbox`)
- `Calendar` (`/calendar`)
- `Market & Position` (`/market`)
- `Competitive Benchmark` (`/competitive-benchmark`)
- `Business DNA` (`/business-profile`)
- `Actions` (`/actions`)
- `Alerts` (`/alerts`)
- `Data Health` (`/data-health`)
- `Connectors` (`/integrations`)
- `Settings` (`/settings`)
- `BIQc Foundation` and `More Features` pages as transparent upgrade/waitlist entry points

## Hardening Rules (Must-Have)
1. **Transparent lock semantics**
   - Any gated route must explain: from route, required tier, launch type.
   - No silent redirects without context params.

2. **Deterministic limits and language**
   - Free usage caps must be visible in cards, billing/upgrade surfaces, and denial reasons.
   - Avoid internal naming in client-facing lock text.

3. **Supplier fragility handling**
   - When a supplier is degraded or unavailable, return graceful fallbacks (not hard errors) on Free critical paths.
   - Data freshness and coverage hints must be visible where output confidence can drop.

4. **No hidden premium behavior**
   - Mobile and desktop nav must display equivalent lock/entitlement logic.
   - No premium-only action should appear as clickable free functionality without an explicit lock reason.

5. **Client-facing consistency**
   - Naming baseline: `Ask BIQc`, `Inbox`, `BIQc Overview`, `BIQc Foundation`, `More Features`.
   - Keep copy consistent in nav, pricing, upgrade, and module cards.

## Free Tier Guardrail Defaults
- Integrations: minimum baseline connector limit with explicit upgrade path.
- Snapshots/audits: enforce backend limits and reflect current usage in UI where applicable.
- AI outputs: maintain evidence-constrained wording and display coverage context when available.

## Free Tier Release Criteria
- Route parity passes between frontend and backend policies.
- No unresolved P0 client-facing regressions in free routes.
- Supplier telemetry snapshot available for production dependencies.
- Checkpoint ledger updated with PASS/FAIL and artifacts for each release block.
