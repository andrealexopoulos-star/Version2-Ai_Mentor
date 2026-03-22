# Calibration 2.0 Edge Function Registry Baseline

## Purpose

Create one baseline registry for calibration-critical and adjacent functions, including duplicate slug risks and ownership intent.

## Canonicalization Rule

Until explicitly approved otherwise, `supabase/functions/*` is treated as canonical deploy source.  
`supabase_edge_functions/*` is treated as duplicate/legacy mirror unless proven active by deployment records.

## Critical Path Registry

| Function slug | Canonical path | Purpose | Required secrets | Owner surface |
|---|---|---|---|---|
| `calibration-business-dna` | `supabase/functions/calibration-business-dna` | Website/manual DNA extraction and identity signals | `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (+ optional `FIRECRAWL_API_KEY`, `PERPLEXITY_API_KEY`) | Calibration pipeline |
| `scrape-business-profile` | `supabase/functions/scrape-business-profile` | Fast deterministic website extraction | none required in source | Calibration prefill |
| `business-identity-lookup` | `supabase/functions/business-identity-lookup` | ABN/identity verification enrichment | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, ABR GUID secret | Identity checkpoint |
| `calibration-psych` | `supabase/functions/calibration-psych` | Psych/operator calibration runtime | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (+ model key path) | Operator profile |
| `competitor-monitor` | `supabase/functions/competitor-monitor` | Competitor intelligence | `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (+ optional `PERPLEXITY_API_KEY`) | Market benchmarking |
| `market-signal-scorer` | `supabase/functions/market-signal-scorer` | Market scoring layer | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Signal scoring |
| `market-analysis-ai` | `supabase/functions/market-analysis-ai` | Long-form market analysis synthesis | `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | CMO report synthesis |
| `biqc-insights-cognitive` | `supabase/functions/biqc-insights-cognitive` | Snapshot/reveal intelligence | `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (+ optional integrations) | Executive snapshot |
| `calibration-sync` | `supabase/functions/calibration-sync` | Completion sync bridge | `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Completion finalize |

## Priority Inbox / Calendar Adjacent Registry

| Function slug | Canonical path | Purpose | Notes |
|---|---|---|---|
| `email_priority` | `supabase/functions/email_priority` | Inbox prioritization and task extraction | Duplicate exists in `supabase_edge_functions/email_priority` |
| `refresh_tokens` | `supabase/functions/refresh_tokens` | OAuth token refresh for providers | Must preserve scopes required for calendar/inbox feature parity |
| `gmail_prod` | `supabase/functions/gmail_prod` | Gmail helper path | Duplicate exists in `supabase_edge_functions/gmail_prod` |
| `outlook_auth` | `supabase/functions/outlook_auth` | Outlook auth helper | Slug drift vs `outlook-auth` in mirror tree |

## Duplicate / Drift Risks (Must Resolve Before Behavior Work)

1. Duplicate function names in two trees:
   - `email_priority`
   - `gmail_prod`
   - `business-brain-merge-ingest`
   - `business-brain-metrics-cron`

2. Slug drift:
   - `calibration-psych` vs `calibration_psych`
   - `outlook_auth` vs `outlook-auth`

3. Missing or weakly referenced function contracts:
   - references to unavailable slugs in backend/services must be reconciled before release.

## Logging Contract (Phase A baseline requirement)

Every critical function invocation must emit structured logs:

- `trace_id`
- `user_id` (or system actor)
- `phase` (`scan`, `identity`, `wow`, `aha`, `psych`, `snapshot`, `sync`)
- `duration_ms`
- `sources_used`
- `confidence_summary`
- `status`

No silent failure paths permitted for critical steps.

## Approval Gate

Before Phase B/C/D:

- one canonical path per slug approved
- duplicate slug disposition approved
- secrets map verified per canonical function
- logging contract accepted

