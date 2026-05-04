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
  "schema_version": "1.1.0-marjo-r2f",
  "agent": "E10+F6+F14+R2F",
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
  "console_errors": [],

  "depth": {
    "semrush_keyword_count": 0,
    "semrush_backlinks": 0,
    "semrush_ad_history_months": 0,
    "semrush_competitors": 0,
    "customer_reviews_total": 0,
    "customer_reviews_platforms_with_5plus": 0,
    "customer_reviews_themes": 0,
    "staff_reviews_total": 0,
    "staff_reviews_platforms_with_rating": 0,
    "employer_brand_health_score": null,
    "enrichment_traces_count": 0,
    "sections_missing_source_trace_id": [],
    "marketing_101_detected": [],
    "quorum_capability": "FULL_QUORUM|PARTIAL|SINGLE|FAILED|UNKNOWN",
    "brand_correct": true,
    "brand_banned_variants_seen": [],
    "authority_rank_present": true,
    "semrush_rank_leak_seen": false
  },
  "depth_checks": [{ "name": "...", "status": "PASS|FAIL|WARN", "detail": "...", "category": "semrush|customer_reviews|staff_reviews|provenance|trinity|brand" }],
  "depth_pass": true,
  "depth_failures": [{ "check": "...", "detail": "...", "category": "..." }],
  "g0d_semrush_total_failure": false,
  "presence_failures": [{ "check": "...", "detail": "..." }]
}
```

Aggregate `aggregate.json`:

```json
{
  "schema_version": "1.1.0-marjo-r2f",
  "agent": "E10+F6+F14+R2F",
  "overall_status": "PASS|FAIL|DEGRADED",
  "severity": "INFO|WARN|CRITICAL|PAGE",
  "pass_count": 0,
  "fail_count": 0,
  "degraded_count": 0,
  "missing_count": 0,
  "total_urls": 5,
  "expected_url_count": 5,
  "per_url": [/* PerUrlSummary[] */],
  "missing_urls": [],

  "depth_pass_count": 0,
  "depth_fail_count": 0,
  "presence_only_fail_count": 0,
  "g0d_semrush_total_failure_count": 0
}
```

## R2F — depth verification (Marjo round 2)

The presence-only daily check (E10 + F6 + F14) confirms scans complete and CMO sections render. With R2A-D's deepened data + F14/F15 fixes shipping, presence is no longer enough — Marjo's round-2 verification requires that the data we accepted as "rendered" is actually *deep*. R2F extends the runner with six categories of post-render assertions.

### What each depth assertion checks

#### 1. SEMrush data depth (R2D / F15)

Read from `business_dna_enrichment.enrichment` JSONB:

| Assertion | Established floor | SMB floor | Source path |
|---|---|---|---|
| `semrush_organic_keywords_depth` | `>= 30` | `>= 10` | `keyword_intelligence.organic_keywords.length` |
| `semrush_backlinks_present` | `> 0` (FAIL) | `>= 0` (WARN if 0) | `backlink_intelligence.total_backlinks` |
| `semrush_ad_history_present` | `>= 1 month` | `>= 0` (WARN if 0) | `advertising_intelligence.ad_history_12m.length` |
| `semrush_detailed_competitors_depth` | `>= 5` | `>= 5` | `competitive_intelligence.detailed_competitors.length` |

If **all four** assertions FAIL simultaneously, the runner sets `g0d_semrush_total_failure: true` — surfaced as a separate alert (`SEMRUSH_SUPPLIER_TOTAL_FAILURE`) so the alert pipeline can label "supplier total failure" vs "individual metric below floor".

**To debug a failure:**
- Pull the most recent `business_dna_enrichment.enrichment` row for the QA user
- Verify the four nested objects above are non-empty
- Check edge-function logs for `semrush-domain-intel` 200 responses with payload size >0
- Confirm `SEMRUSH_API_KEY` is present in Supabase Edge Secrets (per ops_daily_calibration_check.md §B12)

#### 2. Customer reviews depth (R2B)

| Assertion | Threshold | Source path |
|---|---|---|
| `customer_reviews_total_present` | `> 0` (established) / WARN-only (SMB) | `customer_review_intelligence_v2.total_reviews_cross_platform` |
| `customer_reviews_platform_with_5plus` | `>= 1 platform with >= 5 reviews` | `customer_review_intelligence_v2.per_platform[].review_count` |
| `customer_reviews_themes_extracted` | `>= 1 theme` (LLM extraction worked) | `customer_review_intelligence_v2.themes.length` |
| `customer_reviews_productreview_au_queried` | jimsmowing only — WARN if missing | platform list contains "ProductReview" |

**To debug:** check `customer-reviews-deep` edge-function logs and `review_aggregates` table.

#### 3. Staff reviews depth (R2C / F14)

| Assertion | Threshold | Source path |
|---|---|---|
| `staff_reviews_field_present` | structural — `workplace_intelligence` exists | `enrichment.workplace_intelligence` |
| `staff_reviews_platform_with_rating` | established: `>= 1 platform with rating`; SMB: any | `workplace_intelligence.per_platform[].rating > 0` |
| `employer_brand_health_score_valid` | number 0-100, not null | `workplace_intelligence.employer_brand_health_score` |

**SMB tolerance:** small businesses may legitimately have zero staff reviews. The structural field still has to exist (with zero values) per F14's perimeter contract.

**To debug:** check `staff-reviews-deep` edge function + the F14 perimeter test (`tests/test_perimeter_complete_for_new_edge_fns.py`).

#### 4. Provenance integrity (E2 + E6)

| Assertion | Threshold | Source |
|---|---|---|
| `enrichment_traces_count_threshold` | `>= 13 rows per scan` (was 12 happy-path; ~20-30 with R2 deepening) | `public.enrichment_traces` filtered by scan_id |
| `sections_have_source_trace_id` | `>= 1 section→trace link` | `enrichment_traces.section_name + source_trace_id` |
| `anti_marketing_101_sweep` | zero generic phrases | regex sweep over rendered HTML |

**Marketing-101 patterns** (defined in `config.ts:ANTI_MARKETING_101_REGEXES`):
- "Improve your social media presence"
- "Engage more with your audience"
- "Create more quality content"
- "Optimize your website for SEO"
- "Leverage social media"
- "Build a strong brand identity"
- "Focus on customer experience/service"
- "Utilize email marketing"
- "Run targeted ad campaigns"
- "Implement a content marketing strategy"

Add new patterns whenever a generic phrase is spotted in production output — this is a living list.

**To debug:** the failure detail names the offending phrase. Trace it back to the LLM prompt that produced it (likely an executive-summary or 90-day-plan section that fell back to defaults instead of using captured signals).

#### 5. Trinity quorum health (E9 + F14)

Reads `get_router_config()` RPC (or `router_config` table fallback):

| State | Treatment |
|---|---|
| `FULL_QUORUM` | PASS |
| `PARTIAL` | WARN (one provider degraded) |
| `SINGLE` | WARN (P1 alert) — does NOT fail the workflow per spec |
| `FAILED` | FAIL |
| `UNKNOWN` (router_config missing) | WARN |

**Per spec:** if `SINGLE_PROVIDER` for 7+ days, the WARN detail surfaces "P1: provision second key" so Andreas can act on it. The workflow still PASSes overall — depth_pass is unaffected by Trinity WARNs.

**To debug:** check the Trinity router config in Supabase + verify both Anthropic and Gemini API keys are provisioned in Edge Secrets.

#### 6. Brand consistency

| Assertion | Threshold | Source |
|---|---|---|
| `brand_ask_biqc_present` | "Ask BIQc" present, no banned variants | regex over rendered HTML |
| `authority_rank_naming` | "Authority rank/score" present (only when SEMrush data is in HTML); "SEMrush rank" never present | regex over rendered HTML |

**Banned variants** (per `feedback_ask_biqc_brand_name.md`):
- "Soundboard"
- "Ask Chat"
- "Ask Assistant"

**F15 brand cleanup:** the SEMrush Authority Score MUST be labelled "Authority rank" or "Authority Score". Any reference to "SEMrush rank" in user-facing HTML is both a brand violation and a Contract v2 supplier-name leak — surfaced as `authority_rank_naming` FAIL.

**To debug:** open the rendered CMO HTML and grep for the offending strings. Likely culprit is a stale CMO template or a fallback string that hasn't been swept post-rebrand.

### Failure semantics

| Outcome | Behaviour |
|---|---|
| `depth_pass = true` AND no presence failures | URL PASS |
| `depth_pass = false` (any depth FAIL) | URL FAIL — same precedence as a presence FAIL, no false-PASS escape |
| `g0d_semrush_total_failure = true` | URL FAIL + separate alert label `SEMRUSH_SUPPLIER_TOTAL_FAILURE` |
| Aggregate sees `>= 1 depth_fail` | overall_status = FAIL, severity per F6 rules |

Depth and presence failures are reported separately in `aggregate.json` (`depth_fail_count`, `presence_only_fail_count`) so the issue body and Slack webhook can label "scan completed but data was thin" distinctly from "scan didn't complete". This matters for triage — the on-call engineer needs to know whether to look at the scan pipeline or the supplier configuration.

### Cross-check with F14's perimeter test

F14 added `tests/test_perimeter_complete_for_new_edge_fns.py` to ensure `customer-reviews-deep` and `staff-reviews-deep` are both in `REQUIRED_EDGE_FUNCTIONS`. The R2F daily check naturally exercises the perimeter — if either edge function 401s during a real scan, the existing zero-401 assertion (`enrichment_traces_zero_401`) catches it as a presence failure, and the new depth assertions catch the resulting empty `workplace_intelligence` / `customer_review_intelligence_v2` payloads as depth failures. The two layers are belt-and-braces, not redundant.

### Adjusting depth thresholds

All thresholds live in `config.ts:DEPTH_THRESHOLDS`. Floors are intentionally conservative — a real CMO Report against a real domain produces far more than these. We're catching collapses to zero / single-digit, not regressions of 30 → 28. If a scheduled run starts FAILing on a legitimate URL, the threshold may need to be lowered for that depth class — but the default position is "investigate the data first, then loosen the floor".

### Per-URL depth class

The runner picks "established" vs "smb" thresholds per URL via `URL_DEPTH_CLASS` in `config.ts`:

- `smsglobal`, `bunnings` → `established` (mature SEO + paid + reviews footprint)
- `jimsmowing`, `koalafoam`, `maddocks` → `smb`

When adding a new URL, also pick its depth class. Default (if unspecified) = `smb`, which is the conservative choice.

## Maintenance

- **Adding a 6th URL:** edit the `matrix.include` block in `daily-cmo-check.yml` and `TEST_URLS` in `config.ts`. Both must change together. Also pick a depth class via `URL_DEPTH_CLASS`.
- **Updating CMO sections:** edit `CMO_SECTIONS` in `run-cmo-check.ts`. Each entry produces 1 screenshot. Min 25 sections required.
- **Tightening the supplier denylist:** edit `SUPPLIER_NAME_DENYLIST` in `config.ts`. Per Contract v2 §"External responses MUST NEVER expose".
- **Tightening the placeholder denylist:** edit `PLACEHOLDER_DENYLIST` in `config.ts`. Add new sentinel strings as they are discovered in production HTML.
- **Lowering the polling timeout:** `T_TERMINAL_TIMEOUT_MS` in `config.ts`. Currently 8 minutes. Long-tail scans during supplier slowdowns can take 4-6 min.
- **Adjusting depth thresholds:** edit `DEPTH_THRESHOLDS` in `config.ts`. See "R2F — depth verification" section below for the rationale and per-class semantics.
- **Adding a Marketing-101 phrase:** edit `ANTI_MARKETING_101_REGEXES` in `config.ts`. Each entry needs a regex + a human-readable label. Add whenever a new generic phrase shows up in production HTML.
- **Adjusting the brand banned-variant list:** edit `BRAND_BANNED_VARIANTS` in `config.ts`. Per `feedback_ask_biqc_brand_name.md` — never propose name alternatives.

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
