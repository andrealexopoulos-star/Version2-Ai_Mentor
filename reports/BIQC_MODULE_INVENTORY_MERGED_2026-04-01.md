# BIQc Module Inventory (Merged Baseline + Supplier Confirmation)

Date: 2026-04-01  
Scope: merged codebase (`HEAD` vs `origin/main`) + live supplier telemetry snapshot

## 1) Merge Baseline and Drift Classification

- `HEAD`: `98ad2e025f492a593b104de42d6cf113e07cb822`
- `origin/main`: `98ad2e025f492a593b104de42d6cf113e07cb822`
- Tracked diff (`origin/main...HEAD`): none
- Local drift present only as untracked/working artifacts:
  - `reports/BIQC_*_2026-04-03.*` (local report artifacts)
  - `supabase/.temp/*` (CLI-local ephemeral files)
  - `SERPAPI` (local marker file)

Conclusion: no branch-level code divergence to merge; reconciliation work is operational hygiene (detach-head normalization + untracked artifact policy), not code conflict resolution.

## 2) Supplier Usage Confirmation (Programmatic Snapshot)

### Supabase usage telemetry (from live SQL against prod and dev projects)

| Environment | Project Ref | DB Size (bytes) | Storage Object Bytes | Storage Object Count | MAU (current month) | Total Users |
|---|---:|---:|---:|---:|---:|---:|
| main/prod | `vwwandhoydemcybltoxz` | 47,664,275 | 1,266,004 | 1 | 12 | 22 |
| local/dev | `xdqwclwsgksbapxmwjaq` | 20,925,587 | 0 | 0 | 0 | 14 |

Notes:
- Supabase dashboard-only billing metrics (network egress and billable storage overage line items) are not exposed by the current CLI query surface.
- The telemetry integration track should ingest dashboard/API billing exports for `egress_gb` and paid-storage overages into release evidence.

### Azure usage/cost telemetry (CLI extraction)

- `az functionapp list`: no Function Apps found in active subscription.
- Runtime is currently App Service plans:
  - `biqc-plan` (`PremiumV2`, `P3v2`, workers=2)
  - `ASP-biqcbetawebgroup-bbc2` (`Premium0V3`, `P0v3`, workers=1)
- `az consumption usage list` snapshot for April window returns usage records by product class, but `pretaxCost` values are not materialized in this API response payload (`None` values).

Implication:
- Consumption-plan cold start and max execution limits are not the current bottleneck because no Function Apps are deployed.
- Premium-vs-Consumption decision should be documented as "not applicable to current topology"; optimization focus shifts to App Service utilization, autoscale policy, and idle premium spend.

## 3) Updated Module Inventory (De-duplicated)

| Module | Route/Surface | Status | Access | Supplier Dependency | De-dup / Deprecation Action |
|---|---|---|---|---|---|
| BIQc Overview | `/advisor` | Active | Free | Supabase + OpenAI | Keep |
| Soundboard | `/soundboard` | Active (flagship) | Free + mode policy | OpenAI/Anthropic/Perplexity | Keep; continue UX parity hardening |
| Boardroom | `/board-room` | Active | Starter | OpenAI + watchtower | Keep |
| Integrations Hub | `/integrations` | Active | Free | Merge + OAuth providers | Keep |
| Email + Calendar | `/email-inbox`, `/calendar` | Active | Free | Microsoft/Google | Keep |
| Revenue + Billing | `/revenue`, `/billing` | Active | Starter | Stripe + Merge accounting | Keep |
| Marketing Intelligence | `/marketing-intelligence` | Active/Beta | Starter | SEMrush/Serper/LLM | Keep |
| Risk + Compliance | `/risk`, `/compliance` | Partial/waitlist | Starter (waitlist launch) | Supabase + LLM | Keep as waitlist; preserve placeholders |
| Data Center + Documents | `/data-center`, `/documents` | Partial/waitlist | Starter (waitlist launch) | Storage integrations | Keep |
| Admin + Observability | `/admin`, `/observability`, `/support-admin` | Active (restricted) | Super admin | Internal ops stack | Keep |
| Legacy landing variants | `Landing.js` fallback | Deprecated candidate | Public | None | Consolidate to single canonical landing entry |
| Preview routes | calibration/loading mockups | Deprecated candidate | Internal preview | None | Move behind explicit preview flag or remove |

## 4) Migration Plan for Branch/Config Reconciliation

1. Create `sync/main-reconcile` branch from `origin/main` and attach current worktree to a named branch (exit detached HEAD).
2. Move `supabase/.temp/*` and local markers to `.git/info/exclude` (local-only ignore) to prevent accidental staging.
3. Keep report artifacts versioned under `reports/` only when approved for source control; otherwise archive under a local evidence directory excluded from Git.
4. Add CI check that fails if `supabase/.temp` paths are staged.
5. Re-run route and entitlement parity checks after any merge touching `routeAccessConfig` or `tier_resolver`.

## 5) Inventory Delta Since Prior Stocktake

- Code modules: unchanged vs `origin/main` tracked baseline.
- Supplier telemetry: now quantified for Supabase prod/dev core usage metrics (DB size, MAU, storage object bytes).
- Azure topology clarification: no FunctionApp footprint in subscription; production services run on App Service premium plans.
- Deferred module placeholders retained (Xero and other postponed connectors) in planning artifacts.
