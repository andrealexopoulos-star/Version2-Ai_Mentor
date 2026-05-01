# PR #409 Runtime Verification Readiness (Access-Pending)

## Purpose
This runbook prepares runtime verification for PR #409 without requiring Azure, Supabase, or Stripe access, and without making live API calls.

Scope stays backend-only and read-safe:
- no frontend changes
- no website changes
- no pricing copy changes
- no live payment actions

## What was prepared
- Local static readiness script: `backend/runtime_verify_pr409_readiness.sh`
- Optional local backend regression test command set (same top-up suite used in merge gates)
- Static audit checkpoints for:
  - hydration fix (`stripe_subscription_id`)
  - webhook event coverage
  - env var validation references
  - health/version endpoint availability

## Run locally (no secrets required)
From repo root:

```bash
bash backend/runtime_verify_pr409_readiness.sh --expected-sha 07eb4b6e27b5192164c4dd4d6b63a6c54a158072
```

Optional (runs local backend tests):

```bash
bash backend/runtime_verify_pr409_readiness.sh \
  --expected-sha 07eb4b6e27b5192164c4dd4d6b63a6c54a158072 \
  --run-tests
```

## Checks performed by the script
1. Confirms current `HEAD` (optionally against expected merged SHA).
2. Confirms required PR #409 files exist:
   - top-up service modules
   - billing route
   - top-up webhook route
   - migration files `131` and `132`
   - hydration regression test
3. Confirms hydration and linkage guard paths:
   - billing route includes `stripe_subscription_id`
   - `manual_topup()` still enforces linkage guard
4. Confirms webhook coverage for:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.requires_action`
5. Confirms env var references for:
   - `STRIPE_API_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
6. Confirms health endpoint presence in backend server routing.

## Env validation audit result (code-level, non-runtime)
Current backend already includes relevant validation/guards:
- `backend/core/env_validator.py`
  - validates required core production env vars
  - warns on Stripe and Supabase-related optional vars
  - checks Stripe key shape in production context
- `backend/supabase_client.py`
  - raises on missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` for admin client init
- `backend/routes/stripe_payments.py` and `backend/services/topup_service.py`
  - fail fast when Stripe configuration is missing for payment actions

## Health/version endpoint readiness
Current status:
- health endpoints exist: `GET /health`, `GET /api/health`, and `/api/health/detailed`
- release metadata is referenced in startup telemetry (`RELEASE_SHA`) via Sentry init

Gap:
- there is no dedicated public endpoint that returns deployed commit SHA directly.

Smallest backend-only proposal (not implemented here):
- add a read-only endpoint returning:
  - `release_sha` from `RELEASE_SHA` env (or `null`)
  - `environment`
  - service health status

## Next step once access is granted
Execute the full runtime verification plan (Azure + Supabase + Stripe live checks) using the access checklist, beginning with deployment lineage proof and schema checks before any payment flow action.
