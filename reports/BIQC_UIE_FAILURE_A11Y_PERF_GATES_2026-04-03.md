# BIQc UIE Visibility + Failure UX + A11y/Performance Gates

Date: 2026-04-03

## UIE Visibility Standards
- Show integration health and freshness at menu decision points.
- Show source coverage level at module entry and in AI output surfaces.
- Distinguish clearly between:
  - fully connected
  - partially connected
  - stale connection
  - not connected

## Failure-State UX Copy Standards

### Locked Feature State
- Copy template:
  - `This module requires <tier>.`
  - `You are currently on <current_tier>.`
  - `Upgrade unlocks <specific outcome>.`

### Stale Integration State
- Copy template:
  - `Data may be outdated for <source>.`
  - `Last sync: <timestamp>.`
  - `Reconnect or refresh to restore full confidence.`

### Partial Coverage State
- Copy template:
  - `Answer is based on partial coverage.`
  - `Missing sources: <list>.`
  - `Recommendation confidence is reduced.`

### Downgraded Reasoning Path
- Copy template:
  - `Response depth is reduced due to current tier/limits.`
  - `Upgrade for deeper analysis and expanded context.`

## Accessibility Gates
- Keyboard navigable menu and module cards.
- Visible focus states across all interactive elements.
- Readability threshold:
  - minimum AA contrast on text and lock/alert badges.
- Mobile parity:
  - same lock semantics and disclosure behavior as desktop.

## Performance Gates
- Menu interaction response target:
  - under 100ms for local navigation state changes.
- Tier gate redirect response target:
  - under 300ms perceived transition.
- Module entry card render target:
  - stable and readable above-the-fold within first paint budget.

## Gate IDs
- `PASS|FAIL · UIE-VISIBILITY-STANDARD-01 · failure_code_or_- · artifact`
- `PASS|FAIL · FAILURE-COPY-STANDARD-01 · failure_code_or_- · artifact`
- `PASS|FAIL · A11Y-MENU-PARITY-01 · failure_code_or_- · artifact`
- `PASS|FAIL · PERF-MENU-GATE-01 · failure_code_or_- · artifact`
