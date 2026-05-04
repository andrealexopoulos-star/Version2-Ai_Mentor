# Daily CMO Check — Setup

This workflow protects retention by running the URL Scan → CMO Report flow against 5 production URLs twice per day. Andreas's standing order 2026-04-23 (`ops_daily_health_check_procedure.md`, `ops_daily_calibration_check.md`, `feedback_zero_401_tolerance.md`).

Workflow path: `.github/workflows/daily-cmo-check.yml`
Schedule: cron `0 19,7 * * *` (UTC). Maps to ~05:00 + ~17:00 AEST/AEDT depending on DST.
Manual trigger: `workflow_dispatch` from the GitHub Actions UI.

## Prerequisites

The workflow will fail-fast in the `preflight-secrets` job if any secret is missing. **Provision all 7 before enabling the schedule.**

### 1. Synthetic QA user — `qa-synthetic@biqc.ai`

A dedicated, never-tier-flipped synthetic user is required. The user-journey tests in `ops_daily_health_check_procedure.md` use the superadmin account; this CMO check uses a separate trial-tier QA user so calibration runs against fresh data each day without polluting the superadmin's history.

**To seed the user (Andreas + an authorised migration agent):**

```sql
-- Run via mcp__a66b5ae2-...__execute_sql against project vwwandhoydemcybltoxz.
-- Approval code 13041978 required.
-- 1. Create the auth.users row via Supabase auth admin API (cannot be inserted directly):
--    POST https://vwwandhoydemcybltoxz.supabase.co/auth/v1/admin/users
--    body: { "email": "qa-synthetic@biqc.ai", "password": "<long random>", "email_confirm": true }
-- 2. Then mirror into public.users:
INSERT INTO public.users (id, email, role, subscription_tier, is_disabled, created_at)
SELECT id, email, 'user', 'trial', false, NOW()
FROM auth.users
WHERE email = 'qa-synthetic@biqc.ai'
ON CONFLICT (id) DO NOTHING;
-- 3. Confirm:
SELECT id, email, role, subscription_tier, is_disabled FROM public.users
WHERE email = 'qa-synthetic@biqc.ai';
```

**Reset cadence:** The QA user's calibration/scan data accumulates across runs. To avoid stale state:

- Optional: spawn a nightly cleanup cron (separate task) that deletes scan rows for `user_id = qa-synthetic@biqc.ai` older than 7 days.
- Until that ships, the test will still pass — the assertions look at the most-recent `business_dna_enrichment` row by `created_at DESC`.

**DO NOT** flip this user's tier to Pro. The whole point is that a trial-tier user must be able to complete calibration and see the CMO report.

### 2. GitHub Actions Secrets

Set in `Settings → Secrets and variables → Actions → Repository secrets`:

| Secret | Purpose | Example value |
|---|---|---|
| `BIQC_QA_EMAIL` | Synthetic QA login | `qa-synthetic@biqc.ai` |
| `BIQC_QA_PASSWORD` | QA login password (long random, never reused) | `<48-char random string>` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side queries to `business_dna_enrichment`, `enrichment_traces`, `share_events`, `daily_check_runs` | Project Settings → API → service_role key |
| `SUPABASE_PROJECT_ID` | Project identifier in URL | `vwwandhoydemcybltoxz` |
| `BIQC_API_BASE_URL` | Backend base for any API probes | `https://biqc-api.azurewebsites.net` |
| `BIQC_FRONTEND_BASE_URL` | Frontend base | `https://biqc.ai` |
| `ALERT_WEBHOOK_URL` | POST destination on FAIL/DEGRADED. Slack-compatible. | Slack incoming-webhook URL or generic JSON receiver |

### 3. Service-role key scoping

The `SUPABASE_SERVICE_ROLE_KEY` used by this workflow MUST be limited to the read-only evidence path:

- `public.business_dna_enrichment` (SELECT)
- `public.enrichment_traces` (SELECT) *(table may not exist yet — workflow tolerates this with WARN)*
- `public.scans` (SELECT)
- `public.share_events` (SELECT) *(table may not exist yet)*
- `public.review_aggregates` (SELECT) *(if present)*
- `public.daily_check_runs` (SELECT, INSERT)
- `public.users` (SELECT — for resolving QA user_id by email)

Recommended pattern: provision a dedicated `daily_check_runner` Postgres role with a scoped JWT, and use that role's key as the secret rather than the global service_role. If a scoped role is not yet in place, the workflow will run with the standard service_role key — but Andreas should rotate it to a scoped role as a follow-up retention/security task.

### 4. Database migration

Ship `supabase/migrations/20260504000000_create_daily_check_runs.sql` before the workflow's first scheduled run, otherwise persistence will WARN-out (which is non-fatal but degrades the historical record needed for the two-consecutive-failure escalation).

### 5. First run validation

Before relying on the schedule:

1. Provision all 7 secrets.
2. Apply the migration.
3. Seed the QA user.
4. Trigger via `workflow_dispatch` with `target_url` empty (runs all 5 URLs).
5. Verify:
   - `preflight-secrets` job: PASS (no missing secret error)
   - At least one `per-url-check` job: 25+ screenshots in artefacts
   - `aggregate-and-alert` job: writes a row to `public.daily_check_runs`
   - On a forced FAIL (e.g. break a URL), the issue + webhook fire correctly

## Failure handling

- `per-url-check` matrix slot does not fail the workflow on per-URL failure — it always uploads artefacts. This is deliberate: we want full evidence even when one URL breaks.
- `aggregate-and-alert`:
  - PASS → exit 0, no issue/webhook.
  - DEGRADED → exit 1, webhook posted, issue opened.
  - FAIL → exit 1, webhook posted, issue opened, `severity=CRITICAL`.
  - 2 consecutive FAILs → severity escalated to `PAGE`.

## Output schema

Per-URL `result.json` (uploaded as `evidence-<slug>-<runid>` artefact):

```json
{
  "schema_version": "1.0.0-marjo-e10",
  "agent": "E10",
  "url": "www.bunnings.com.au",
  "slug": "bunnings",
  "label": "bunnings",
  "run_at_utc": "...",
  "overall_status": "PASS|FAIL|DEGRADED",
  "scan_id": "...",
  "user_id": "...",
  "latencies": { "t_login_ms": 0, "t_backend_ack_ms": 0, "t_fanout_complete_ms": null, "t_terminal_ms": 0, "t_total_ms": 0 },
  "terminal_state": "DATA_AVAILABLE|INSUFFICIENT_SIGNAL|DEGRADED|null",
  "checks": [{ "name": "...", "status": "PASS|FAIL|WARN", "detail": "..." }],
  "failures": [{ "check": "...", "detail": "..." }],
  "warnings": [{ "check": "...", "detail": "..." }],
  "screenshots": ["001-login-page.png", "..."],
  "pdf_path": "report.pdf",
  "pdf_size_bytes": 0,
  "pdf_content_type": "application/pdf",
  "console_errors": []
}
```

Aggregate `aggregate.json`:

```json
{
  "overall_status": "PASS|FAIL|DEGRADED",
  "severity": "INFO|WARN|CRITICAL|PAGE",
  "pass_count": 0,
  "fail_count": 0,
  "degraded_count": 0,
  "total_urls": 5,
  "per_url": [/* PerUrlSummary[] */]
}
```

## Maintenance

- **Adding a 6th URL:** edit the `matrix.include` block in `daily-cmo-check.yml` and `TEST_URLS` in `config.ts`. Both must change together.
- **Updating CMO sections:** edit `CMO_SECTIONS` in `run-cmo-check.ts`. Each entry produces 1 screenshot. Min 25 sections required.
- **Tightening the supplier denylist:** edit `SUPPLIER_NAME_DENYLIST` in `config.ts`. Per Contract v2 §"External responses MUST NEVER expose".
- **Tightening the placeholder denylist:** edit `PLACEHOLDER_DENYLIST` in `config.ts`. Add new sentinel strings as they are discovered in production HTML.
- **Lowering the polling timeout:** `T_TERMINAL_TIMEOUT_MS` in `config.ts`. Currently 8 minutes. Long-tail scans during supplier slowdowns can take 4-6 min.

## Related standing orders

- `ops_daily_health_check_procedure.md` — broader SQL/HTTP infra sweep (different scope)
- `ops_daily_calibration_check.md` — 18-item calibration checklist (broader scope, this workflow implements §C+§D end-to-end)
- `feedback_zero_401_tolerance.md` — every enrichment edge fn MUST 200
- `BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2.md` — supplier names must never reach the user

## Known Limitations

These are documented gaps in the current setup that are accepted for now (per F6 P0 patch series — peer reviewer R10-FU-2 acknowledgement).

### Superadmin tier-bypass (false PASS risk on tier-restricted surfaces)

**If the operator chooses a superadmin account for `BIQC_QA_EMAIL`** (e.g. `andre@thestrategysquad.com.au`), the daily checks will produce a **FALSE PASS on tier-restricted surfaces**. Superadmin bypasses tier gates in the routing layer (`routeAccessConfig.js`) and the backend tier resolver (`tier_resolver.py`), so a CMO Report rendered for a superadmin proves nothing about whether a real trial-tier user can complete the same flow.

This is acceptable as a **bridge** while the QA user is being provisioned, but it MUST NOT be the steady-state. A FAIL surfaced under a superadmin login still proves a P0 (because superadmin gets the same content even when bypassing gates), but a PASS does not prove the trial path works.

**Recommended P1 follow-up:** Seed a dedicated `qa-synthetic@biqc.ai` trial-tier user (instructions in §1 above) and use that account for accurate tier-coverage. Once seeded, rotate `BIQC_QA_EMAIL` + `BIQC_QA_PASSWORD` to the synthetic user and remove the superadmin from the workflow secrets.

### F6 P0 patches (reference)

The current workflow has been hardened against three classes of silent-failure (peer reviewer R10 findings, F6 patch series — code 13041978):

1. **Escalation prior-run query** — was reading the row it had just inserted. Now fetches the 2 most recent rows and filters out the current `workflow_run_id` (with belt-and-braces fallbacks for legacy rows missing the ID).
2. **Webhook delivery silent drop** — was logging `console.error` and exiting 0 on any failure. Now retries 3 times with exponential backoff (1s/3s/9s), emits `::error::` GH annotations on every miss, exits 3 on final failure, and writes `alert-delivery.json` so the GH issue body documents whether the alert webhook itself failed.
3. **Aggregator false PASS on missing JSON** — was counting only physically-present per-URL JSONs, so a matrix-slot crash before `finalize()` would yield `overall=PASS` if surviving slots all PASSed. Now compares against `EXPECTED_URL_COUNT = TEST_URLS.length` and FAILs with `missing_urls` listed if any slot didn't write a `result.json`.

Regression tests live in `scripts/daily-check/__tests__/`.

## Open follow-ups

- [ ] **Andreas**: provision the 7 GH Secrets above.
- [ ] **Andreas**: seed `qa-synthetic@biqc.ai` user (code 13041978 required) — see Known Limitations above.
- [ ] **Andreas**: confirm `enrichment_traces` table will be wired (currently WARN-tolerant).
- [ ] **Andreas**: confirm `share_events` table will be wired (currently WARN-tolerant).
- [ ] **Engineering**: provision a scoped `daily_check_runner` Postgres role + JWT to replace global service_role usage.
- [ ] **Engineering**: nightly cleanup cron to truncate the QA user's old scan rows.
