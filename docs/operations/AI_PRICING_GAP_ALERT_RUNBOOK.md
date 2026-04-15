# AI Pricing Gap Alert — Operations Runbook

_Step 15 / P1-11. Companion to the super-admin endpoint at `POST /api/admin/cost/pricing-gaps/alert`._

## What this alert tells you

`v_ai_pricing_gaps` (migration 094) aggregates rows in `ai_usage_log` where a model produced billable tokens but `cost_aud = 0`. Those rows mean one of two things:

1. **The model name isn't in `MODEL_PRICING`.** The token_metering middleware couldn't look up a rate, so it recorded cost 0. Every GP dashboard that sums `cost_aud` is silently underreporting LLM spend until you fix this.
2. **A pricing lookup errored at runtime.** The request still served (good), but the cost row is wrong (bad). This is rarer — investigate the logs for the affected model around `first_seen`.

Either way, the fix is: open `backend/middleware/token_metering.py`, add the model to `MODEL_PRICING` with the correct input/output rates, redeploy.

## When the alert fires

Daily at 08:00 UTC (recommend Mon–Fri). An Azure Logic App timer calls:

```
POST https://biqc-api.azurewebsites.net/api/admin/cost/pricing-gaps/alert
Authorization: Bearer <super-admin JWT>
```

The endpoint runs `jobs.ai_pricing_gap_alert.run_pricing_gap_alert()`, which:

1. Calls the `admin_ai_pricing_gaps` RPC (enforces its own auth via the service_role JWT claim).
2. If `gap_count > 0`: formats a plaintext email listing each offending model with row count, token totals, affected users, first/last seen; sends via Resend to `BIQC_ADMIN_NOTIFICATION_EMAIL`.
3. Writes an `admin_actions` audit row with action_type `ai_pricing_gap_alert_run` so the run history is visible in the super-admin dashboard.

## Triage when the email lands

```
Subject: BIQc AI pricing gaps: 2 model(s) missing from MODEL_PRICING
```

1. **Identify the models.** The email body lists each `model_used` with its token totals. Prioritise by `total_input_tokens + total_output_tokens` descending — that's the biggest GP leak.
2. **Look up rates.** Go to the provider's published pricing page (OpenAI, Anthropic, Google, etc.) and copy the per-1M-token input/output rates.
3. **Patch MODEL_PRICING.** In `backend/middleware/token_metering.py`, add the entry:
   ```python
   MODEL_PRICING["gpt-5.4-ultra"] = ModelRate(
       input_per_million_usd=12.00,   # from OpenAI pricing
       output_per_million_usd=48.00,
       display_name="GPT-5.4 Ultra",
   )
   ```
4. **Open a small PR** with the model name + rate source in the commit message. Deploy.
5. **Verify** by re-running the endpoint with `?force_send=true`: the next response should show the model dropping out of `gaps` (historical rows stay at cost_aud=0 — backfill separately if the volume warrants).

## Hard-no triage patterns

- **Same model reappears every day despite a MODEL_PRICING entry.** Check for case mismatch (`GPT-5.4-Ultra` vs `gpt-5.4-ultra`) — the middleware is case-sensitive. Normalise in `token_metering.py`.
- **Model name is obviously garbage (`test-stub`, `none`, empty-looking).** Investigate `ai_usage_log` row origin — likely a broken code path wrote the row. Don't add it to MODEL_PRICING; fix the source.
- **Zero-gap day but email arrived anyway.** Someone ran with `?force_send=true` for testing. The `skipped_reason` field in the audit row distinguishes real alerts from smoke tests.

## Pipeline health checks

- **No emails for 3+ days straight** is suspicious even if gap_count was zero — it might mean the Logic App timer stopped firing. Check `admin_actions` for rows with `action_type='ai_pricing_gap_alert_run'`. The run writes an audit row every time, so a gap in that timeline = the cron is broken.
- **Resend errors in the summary** (`email_error` populated) don't fail the job — the audit row still lands. If Resend is down for >24h, escalate to ops to use the super-admin dashboard directly until Resend is back.
- **502 from the endpoint** means the Supabase RPC is down. Logic App will retry; if retries all 502, page on-call.

## Manual invocation

Ops can force a run from the terminal:

```bash
curl -X POST "https://biqc-api.azurewebsites.net/api/admin/cost/pricing-gaps/alert?force_send=false" \
  -H "Authorization: Bearer $BIQC_SUPER_ADMIN_JWT" \
  | jq .
```

Expected response shape:
```json
{
  "run_id": "uuid",
  "started_at": "2026-04-15T08:00:00+00:00",
  "finished_at": "2026-04-15T08:00:01+00:00",
  "gap_count": 2,
  "gaps": [...],
  "email_sent": true
}
```

## Links

- View: `public.v_ai_pricing_gaps` (migration 094)
- RPC: `public.admin_ai_pricing_gaps` (migration 094)
- Job: `backend/jobs/ai_pricing_gap_alert.py`
- Endpoint: `POST /api/admin/cost/pricing-gaps/alert`
- GP dashboard view: Super-admin → Cost → Pricing Gaps
- Related runbook: `docs/operations/REFUND_POLICY_RUNBOOK.md` (same email delivery pattern via Resend)
