# BIQc UX IA Audit (Cognition Platform + UIE)

Date: 2026-04-03  
Analyst perspective: cognition-as-a-platform, Unified Integration Engine trust clarity, tier comprehension.

## A. UX Analyst Audit Report

### Current Menu Render By Tier (Observed)
- **Free**
  - Top-level nav shows core modules and commercial entry points: `BIQc Overview`, `Ask BIQc`, `Inbox`, `Calendar`, `Market & Position`, `Competitive Benchmark`, `Business DNA`, `Actions`, `Alerts`, `Data Health`, `Connectors`, `Settings`, `BIQc Foundation`, `More Features`.
  - Gated module clicks are redirected with transparent params (`from`, `required`, `launch`, `feature`) to `BIQc Foundation` or `More Features`.
- **Starter**
  - Same core top-level nav.
  - `BIQc Foundation` section expands and exposes 11 additional paid module entries.
- **Pro**
  - Same IA shape as Starter today.
  - Primary differentiation is limits and deeper capability, not yet strong menu-level visual differentiation.

### Cognitive Load Findings
- Top-level density is high for first-session users; too many concept categories appear at once.
- Taxonomy overlap exists:
  - `Business DNA`, `Data Health`, `Connectors`, `Settings` all compete inside setup/readiness territory.
  - `Actions` and `Alerts` are two sides of one execution loop.
  - `Market & Position` and `Competitive Benchmark` are adjacent intelligence surfaces.
- Commercial vocabulary drift risk:
  - `BIQc Foundation` is both package concept and navigation surface.

### UX Debt (Priority)
1. Pro/Enterprise visible differentiation is weak in left-nav mental model.
2. Module grouping is system-centric more than decision-job-centric.
3. More Features breadth feels expansive without explicit tier-target tagging.
4. Trust signal placement (integration freshness/coverage) is not consistently visible at menu decision points.

### Scorecard (Current State)
- IA clarity: **6.5 / 10**
- Tier differentiation in navigation: **5.5 / 10**
- Cognition workflow continuity: **7 / 10**
- UIE discoverability and trust signaling: **6 / 10**
- Upgrade transparency (anti-dark-pattern): **8 / 10**

## B. Tier-Specific Menu Rendering Blueprint

### Free (Client-Facing Core)
- Show only decision-essential top-level surfaces with clear daily-use pathways.
- Keep `BIQc Foundation` and `More Features` as transparent progression points.
- Always display reason-based locks and expected unlock outcome.

### Starter (Foundation Entry)
- Keep same top-level IA to minimize relearn cost.
- Expand `BIQc Foundation` modules grouped by outcome:
  - `Operate`: Revenue, Operations, Billing
  - `Decide`: Reports, Decision Tracker, Boardroom
  - `Assure`: Ingestion Audit, Exposure Scan, SOP Generator, Marketing Intelligence, Marketing Auto

### Pro
- Same top-level IA plus visible Pro tags and capability depth disclosures.
- Promote first-wave staged modules from More Features into Pro where readiness passes.

### Enterprise
- Same IA, governance-grade module states, policy and assurance overlays.
- Promote enterprise-wave staged modules only with telemetry and trust readiness evidence.

## C. Consolidated Menu Recommendation

### Target Top-Level IA (8-Item Intent Model)
- BIQc Overview
- Ask BIQc
- Inbox
- Calendar
- Intelligence (Market + Benchmark)
- Execution (Actions + Alerts)
- System (Business DNA + Data Health + Connectors + Settings)
- Growth (Foundation + More Features)

### Keep / Merge / Demote
- **Keep top-level:** Overview, Ask BIQc, Inbox, Calendar.
- **Merge:** Market + Benchmark, Actions + Alerts, Business DNA + Data Health + Connectors + Settings.
- **Demote/contextualize:** low-frequency setup/admin-like detail under grouped surfaces.

## D. UIE Visibility Framework
- Place integration confidence at three points:
  1. Menu-level readiness chip on `System` and `Ask BIQc`.
  2. Module entry card confidence/freshness summary.
  3. In-response coverage disclosure for generated recommendations.
- Minimum confidence language set:
  - `Live coverage`
  - `Partial coverage`
  - `Stale source`
  - `No source linked`

## Enforcement And Source-Of-Truth Notes
- Frontend menu and route access:
  - `frontend/src/components/DashboardLayout.js`
  - `frontend/src/components/MobileNav.js`
  - `frontend/src/config/routeAccessConfig.js`
  - `frontend/src/lib/tierResolver.js`
- Backend route/API access:
  - `backend/tier_resolver.py`
- Commercial plan behavior:
  - `frontend/src/config/pricingTiers.js`
  - `backend/routes/stripe_payments.py`
