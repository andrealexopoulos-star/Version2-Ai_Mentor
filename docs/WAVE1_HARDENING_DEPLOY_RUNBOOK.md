# Wave 1 Hardening Deploy Runbook

This runbook deploys hardening changes from `hotfix/rls-tier-stabilization` with zero direct edits to `main`.

## Scope

- DB migration `065_rls_tenant_lockdown.sql`
- DB migration `066_subscription_tier_source_of_truth.sql`
- DB migration `067_super_admin_rpc_authorization.sql`
- Backend hardening:
  - Stripe webhook signature verification
  - Tier updates aligned to `users.subscription_tier` (with compatibility sync)
  - Super-admin verify route guard
- Frontend hardening:
  - Contact form truthful submit state
  - Trust/legal route corrections and compatibility redirects

## Preconditions

- Branch is reviewed and approved.
- `main` is protected (no direct pushes).
- Database backup is completed and verified.
- `STRIPE_WEBHOOK_SECRET` is configured in runtime environment.
- Staging environment is available.
- Migration ordering note: two `064_*` migrations exist and apply in lexical order.

## Deploy Order (Required)

1. Apply DB migrations (`065`, then `066`, then `067`) in staging.
2. Deploy backend to staging.
3. Deploy frontend to staging.
4. Run staging verification checklist.
5. Merge PR into `main`.
6. Apply DB migrations in production.
7. Deploy backend production.
8. Deploy frontend production.
9. Run production verification checklist.

## Staging Verification Checklist

- Auth:
  - Login works.
  - `GET /api/auth/supabase/me` returns expected role and tier.
- Tier logic:
  - Free test user remains on free-only routes.
  - Starter test user unlocks paid routes.
- Support/admin RPCs:
  - Super admin can load `GET /api/support/users` without 500.
  - Super admin can run `POST /api/support/toggle-user` and `POST /api/support/update-subscription` successfully.
- Stripe webhook:
  - Missing `Stripe-Signature` is rejected (400) when webhook secret is configured.
  - Valid signature accepted.
  - Invalid signature rejected with 400.
- Contact flow:
  - Success shown only after successful submit.
  - Public (no-auth) submit succeeds without false success state.
  - Submitted record is visible in authorized admin flow.
- Trust/legal routes:
  - `/trust/*` pages load.
  - Legacy `/site/trust/*` redirects correctly to `/trust/*`.
- Data isolation spot checks:
  - `workspace_integrations`, `governance_events`, `report_exports`, and `generated_files` are tenant-scoped for authenticated reads.
  - `enterprise_contact_requests` is not globally readable by normal users; full queue visibility is through authorized admin flow (`/api/enterprise/contact-requests`).

## Production Verification Checklist (15-30 min)

- API health endpoint returns healthy response.
- No unusual 4xx/5xx spikes.
- Stripe webhook traffic shows no signature errors for valid events.
- Contact requests are persisted and visible through authorized admin flow.
- Free vs starter route behavior confirmed with test users.
- Support/admin RPC endpoints operate correctly for super-admin users.

## Emergency Rollback

- SQL rollback script:
  - `deploy/sql/rollback_wave1_hardening.sql`
- Application rollback:
  - Redeploy previous backend and frontend artifacts.

Use rollback only for emergency stabilization, then re-apply hardening after incident resolution.

## Automation (Recommended Each Deploy)

Run smoke checks immediately after backend + frontend deployment:

`python deploy/scripts/wave1_smoke_check.py`

Optional environment variables:

- `BACKEND_URL` (default `http://localhost:8000`)
- `FRONTEND_URL` (enables trust redirect checks)
- `AUTH_TOKEN` (enables `/api/auth/supabase/me` check)
- `SUPPORT_AUTH_TOKEN` (enables `/api/support/users` and `/api/super-admin/verify` checks)

Webhook expectation in smoke:

- If `STRIPE_WEBHOOK_SECRET` is configured in runtime, missing/invalid signature checks should return 400.
- If not configured, webhook endpoint should return 503.
