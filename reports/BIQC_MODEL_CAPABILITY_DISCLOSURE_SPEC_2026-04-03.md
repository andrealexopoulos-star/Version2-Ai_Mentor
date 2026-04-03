# BIQc Model Capability Disclosure Spec

Date: 2026-04-03  
Goal: transparent in-product disclosure of what each tier can and cannot do.

## Disclosure Principles
- No hidden capability differences.
- No ambiguous “AI magic” claims.
- Always disclose when confidence is reduced by missing or stale integrations.

## Tier Capability Statements

### Free
- Baseline reasoning depth.
- Baseline context window and throughput.
- Core Unified Integration Engine surfaces with capped depth.
- Explicitly show when answer quality is limited by coverage.

### Starter
- Deeper operating and strategic reasoning than Free.
- Higher throughput and expanded module depth.
- Full Foundation package unlocked.
- Confidence and coverage still disclosed when dependencies are partial.

### Pro
- Extended reasoning depth and higher throughput than Starter.
- Broader advanced workflows as staged modules graduate.
- Enhanced retrieval depth and richer analysis windows.
- Explicit display of Pro-only capability tags.

### Enterprise
- Highest governance-grade capability profile.
- Highest throughput and advanced policy/assurance overlays.
- Enterprise-level reliability and operational controls.
- Transparent enterprise disclosure for policy and confidence boundaries.

### Custom Build
- Contract-defined capability profile.
- Account-specific limits, modules, and retrieval behavior.
- Disclosure must show custom package terms in account context.

## Required UI Placement
- Pricing page: concise tier capability comparison.
- Upgrade and subscribe flows: capability differences by plan.
- Foundation and More Features: target-tier capability messaging.
- Ask BIQc surface: inline confidence and coverage disclosure.
- Module cards: tier tag + limit behavior + fallback behavior.

## Required Disclosure States
- `Full coverage`
- `Partial coverage`
- `Stale source`
- `No source connected`
- `Tier-limited depth`

## Non-Negotiables
- No dark-pattern lock copy.
- No silent quality downgrade without disclosure.
- No tier claim that is not enforced by entitlement policy.
