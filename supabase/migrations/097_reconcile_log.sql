-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION 097: stripe_reconcile_log — drift tracking between Stripe
--                and the users / payment_transactions tables.
--
-- Why (Step 10 / P1-5):
--   Every Stripe webhook can fail silently: a 5xx from Supabase, a
--   deployed-but-restarting container, a signature-verification blip,
--   or a webhook that fired before the user row existed. When that
--   happens the DB can drift from Stripe on:
--     • subscription_status  (active in DB, canceled in Stripe → user
--                             keeps paid tier after cancel)
--     • subscription_tier    (Stripe upgraded via customer portal, DB
--                             never heard about it)
--     • current_period_end   (Stripe didn't renew, DB thinks it did)
--     • the link itself      (users.stripe_customer_id lost, so webhooks
--                             can't resolve the user on cancel)
--
--   Without a reconciler, these drifts only surface as angry support
--   tickets. This table is the audit trail / work queue for a nightly
--   job (see backend/jobs/stripe_reconcile.py) that compares Stripe's
--   source of truth to our mirror and writes one row per delta.
--
-- Design:
--   • One row = one observed drift for one (run_id, stripe_subscription_id).
--   • run_id ties a batch together so you can see "what did the 2am run
--     find" in one filter.
--   • drift_type is constrained so dashboards can group cleanly.
--   • resolved_at is NULL until ops acknowledges / fixes the drift; the
--     next run can close rows it can't re-detect.
--   • service_role only — PII-adjacent, never exposed to end users.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.stripe_reconcile_log (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id                  uuid NOT NULL,
    created_at              timestamptz NOT NULL DEFAULT now(),
    stripe_subscription_id  text,
    stripe_customer_id      text,
    user_id                 uuid REFERENCES public.users(id) ON DELETE SET NULL,
    drift_type              text NOT NULL,
    stripe_value            text,
    db_value                text,
    notes                   text,
    resolved_at             timestamptz,
    CONSTRAINT stripe_reconcile_log_drift_type_check CHECK (
        drift_type IN (
            'status_mismatch',
            'tier_mismatch',
            'period_end_mismatch',
            'missing_user',
            'stale_db_status',
            'unknown_price',
            'run_summary'
        )
    )
);

-- Hot query 1: "show me everything from run X"  — ops dashboard grouping.
CREATE INDEX IF NOT EXISTS idx_stripe_reconcile_log_run_id
    ON public.stripe_reconcile_log (run_id, created_at DESC);

-- Hot query 2: "what's unresolved right now" — dashboards filter on
-- resolved_at IS NULL and partial index keeps that scan bounded.
CREATE INDEX IF NOT EXISTS idx_stripe_reconcile_log_unresolved
    ON public.stripe_reconcile_log (created_at DESC)
    WHERE resolved_at IS NULL;

-- Hot query 3: drill-down from a user to their drift history.
CREATE INDEX IF NOT EXISTS idx_stripe_reconcile_log_user_id
    ON public.stripe_reconcile_log (user_id)
    WHERE user_id IS NOT NULL;

-- Hot query 4: drill-down from a Stripe subscription id.
CREATE INDEX IF NOT EXISTS idx_stripe_reconcile_log_subscription
    ON public.stripe_reconcile_log (stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;

ALTER TABLE public.stripe_reconcile_log ENABLE ROW LEVEL SECURITY;

-- service_role only. Reconcile output is internal audit data — it
-- contains stripe subscription IDs and mirrors user tier state, so no
-- end user should ever read it.
DROP POLICY IF EXISTS stripe_reconcile_log_service_role ON public.stripe_reconcile_log;
CREATE POLICY stripe_reconcile_log_service_role
    ON public.stripe_reconcile_log
    FOR ALL
    USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role')
    WITH CHECK ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

GRANT ALL ON public.stripe_reconcile_log TO service_role;

COMMENT ON TABLE public.stripe_reconcile_log IS
    'Audit trail of drift between Stripe subscriptions and the DB mirror. Written by backend/jobs/stripe_reconcile.py on each nightly run. One row per observed delta.';
COMMENT ON COLUMN public.stripe_reconcile_log.run_id IS
    'UUID grouping all rows written in a single reconcile pass. Enables "show me the 2am run" queries.';
COMMENT ON COLUMN public.stripe_reconcile_log.drift_type IS
    'status_mismatch: users.subscription_status != stripe status. '
    'tier_mismatch: users.subscription_tier != inferred tier from Stripe line item. '
    'period_end_mismatch: users.current_period_end != stripe current_period_end. '
    'missing_user: Stripe has the sub but no user row resolves to the customer id. '
    'stale_db_status: users row says active/past_due but no matching Stripe sub exists. '
    'unknown_price: subscription has a unit_amount we don''t recognise in PLANS. '
    'run_summary: single bookkeeping row per run holding counts.';
COMMENT ON COLUMN public.stripe_reconcile_log.stripe_value IS
    'Authoritative Stripe-side value at observation time (string form).';
COMMENT ON COLUMN public.stripe_reconcile_log.db_value IS
    'DB-side value at observation time (string form). NULL means the field was NULL in the DB.';
COMMENT ON COLUMN public.stripe_reconcile_log.resolved_at IS
    'Set by ops when the drift has been fixed. NULL = still open work.';
