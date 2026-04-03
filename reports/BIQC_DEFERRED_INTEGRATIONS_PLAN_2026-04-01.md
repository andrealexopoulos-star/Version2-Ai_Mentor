# BIQc Deferred Integrations Plan

Date: 2026-04-01  
Scope: Xero and other postponed supplier integrations

## 1) Sequencing Rule

Deferred integrations start only after:
1. branch synchronization controls are active,
2. tier/gating parity checks are green,
3. supplier telemetry ingestion and monitoring dashboards are in place.

## 2) Xero Integration Plan

### A. Authentication
- OAuth 2.0 app registration with tenant-scoped consent.
- Secure token storage with rotation metadata and encrypted-at-rest policy.
- Token refresh worker with retry/backoff and failure alerting.

### B. Data Ingestion
- Initial backfill:
  - invoices (AR/AP)
  - payments
  - contacts/suppliers
  - chart of accounts
- Incremental sync:
  - webhook-first, API polling fallback
  - idempotent event keys and replay-safe writes
- Coverage contract in UI:
  - data range
  - missing periods
  - last sync timestamp
  - confidence impact

### C. Pricing and Cost Impact
- Cost domains:
  - Xero app/API commercial terms
  - Merge connector pass-through where used
  - storage growth for financial records
  - additional compute for reconciliation jobs
- Tier impacts:
  - Starter: summary-level finance insights with capped historical depth
  - Advanced tiers: deeper historical reconciliation and supplier analytics
- Overage handling:
  - soft warning at 70% budget
  - hard alert at 90%
  - degrade non-critical enrichments before blocking core truth paths

### D. Risk Controls
- CFO invariant lock:
  - no release with reconciliation threshold breach
  - no release with unresolved drift
  - no release with incomplete evidence
- Golden tests:
  - stale-data simulation
  - reconciliation edge cases
  - evidence integrity tampering checks

## 3) Other Deferred Integrations

### BrowseAI (deferred)
- Blocker: stable health endpoint and contract certainty not yet standardized.
- Plan:
  1) define endpoint contract tests,
  2) establish run-credit budget policies,
  3) gate rollout behind telemetry and overage alerts.

### Firecrawl (deferred)
- Blocker: tested credits endpoint mismatch for current contract.
- Plan:
  1) normalize API endpoint contract,
  2) enforce timeout/retry policy,
  3) add crawl-cost budget controls and quality checks.

## 4) Milestone Schedule

- Milestone M1 (Core controls complete): branch + gating + telemetry done
- Milestone M2 (Xero auth and schema): OAuth + storage model + sync job scaffolding
- Milestone M3 (Xero ingestion beta): backfill + incremental sync + coverage contract
- Milestone M4 (Xero monetization): tier entitlements + pricing controls + overage policy
- Milestone M5 (Deferred vendor activation): BrowseAI/Firecrawl promoted from placeholders

## 5) Exit Criteria per Deferred Integration

- Auth reliability >= 99% success
- Incremental sync lag within defined SLO
- Coverage window visible in all user-facing answers
- Overage warning and hard alert paths tested
- No P0/P1 regressions in core modules after canary rollout
