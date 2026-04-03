# BIQc Tier Entitlement Matrix

Date: 2026-04-03  
Scope: feature, model capability, limit pattern, enforcement point, fallback behavior, upgrade message.

## Tier Definitions
- Free
- Starter
- Pro
- Enterprise
- Custom Build

## Matrix

- **BIQc Overview**
  - Min tier: Free
  - Model capability: baseline summary and operational context
  - Limits: baseline usage
  - Enforcement: frontend route map + backend API access
  - Fallback: show reduced-depth summary if dependency gaps exist
  - Upgrade message: unlock deeper operating controls in Starter+

- **Ask BIQc**
  - Min tier: Free
  - Model capability: tier-scaled context depth and reasoning breadth
  - Limits: tier-scaled throughput and depth
  - Enforcement: frontend route + backend access + pricing/override layer
  - Fallback: reduced context window with explicit coverage notice
  - Upgrade message: unlock deeper memory, reasoning depth, and throughput

- **Inbox / Calendar**
  - Min tier: Free
  - Model capability: baseline categorization and schedule intelligence
  - Limits: volume and advanced workflow depth by tier
  - Enforcement: frontend route + backend access
  - Fallback: core classification/scheduling only
  - Upgrade message: unlock advanced triage and expanded processing

- **Market & Position / Competitive Benchmark**
  - Min tier: Free
  - Model capability: baseline market and comparative reasoning
  - Limits: depth and volume by tier
  - Enforcement: frontend route + backend access
  - Fallback: partial-source answer with confidence disclaimer
  - Upgrade message: unlock deeper signal windows and richer benchmarking

- **Business DNA / Actions / Alerts / Data Health / Connectors / Settings**
  - Min tier: Free
  - Model capability: baseline operations layer
  - Limits: usage and connector count scale by tier
  - Enforcement: frontend route + backend access + pricing overrides for connector count
  - Fallback: reduced diagnostics and capped actions
  - Upgrade message: unlock expanded limits and operating depth

- **Foundation Modules (Exposure Scan, Marketing Auto, Reports, Decision Tracker, SOP Generator, Ingestion Audit, Revenue, Billing, Operations, Marketing Intelligence, Boardroom)**
  - Min tier: Starter
  - Model capability: deeper operational and strategic reasoning
  - Limits: Starter baseline, expanded in Pro/Enterprise
  - Enforcement: route access config + backend tier resolver + launch route behavior
  - Fallback: redirect to Foundation with explicit reason/context
  - Upgrade message: unlocked in Starter, expanded in Pro/Enterprise

- **More Features Staged Modules**
  - Min tier: Pro or Enterprise target (staged)
  - Model capability: advanced reasoning and orchestration
  - Limits: staged until promoted to active
  - Enforcement: waitlist launch behavior + backend access guard
  - Fallback: route to More Features with staging transparency
  - Upgrade message: planned for Pro/Enterprise graduation

- **Custom Build Overlay**
  - Min tier: Custom Build
  - Model capability: contract-defined per account
  - Limits: contract-defined
  - Enforcement: pricing control-plane overrides + admin approvals
  - Fallback: default tier behavior if no override present
  - Upgrade message: contact for tailored package

## Enforcement Source Of Truth
- Frontend policy: `frontend/src/config/routeAccessConfig.js`, `frontend/src/lib/tierResolver.js`
- Backend policy: `backend/tier_resolver.py`
- Commercial plan mapping: `frontend/src/config/pricingTiers.js`, `backend/routes/stripe_payments.py`
- Admin entitlement controls: `backend/routes/pricing_admin.py`
