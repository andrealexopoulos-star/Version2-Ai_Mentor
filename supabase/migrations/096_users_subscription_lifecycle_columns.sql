-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION 096: users.subscription_status / current_period_end /
--                past_due_since  (+ optional stripe_customer_id cache)
--
-- Background: invoice.payment_succeeded and invoice.payment_failed
-- webhooks (Step 2 / P0-3 / P0-4) need a place on the users row to
-- record subscription lifecycle state so the app can:
--   • show "Your card was declined" banners before tier is revoked
--   • export an accurate MRR / churn / past-due cohort at any point in time
--   • suppress premium features after N days in past_due without waiting
--     for customer.subscription.deleted to fire
--
-- The table currently only has `subscription_tier` (set by
-- _apply_tier_upgrade), which collapses "paid but past_due" into "paid".
-- That ambiguity is dangerous at billing time.
--
-- All columns are nullable + additive — safe to deploy ahead of the code
-- that writes them and safe to leave on free rows forever.
-- ═══════════════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
          AND column_name = 'subscription_status'
    ) THEN
        ALTER TABLE public.users
            ADD COLUMN subscription_status TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
          AND column_name = 'current_period_end'
    ) THEN
        ALTER TABLE public.users
            ADD COLUMN current_period_end TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
          AND column_name = 'past_due_since'
    ) THEN
        ALTER TABLE public.users
            ADD COLUMN past_due_since TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
          AND column_name = 'stripe_customer_id'
    ) THEN
        ALTER TABLE public.users
            ADD COLUMN stripe_customer_id TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
          AND column_name = 'trial_ends_at'
    ) THEN
        ALTER TABLE public.users
            ADD COLUMN trial_ends_at TIMESTAMPTZ;
    END IF;
END
$$;

-- Enforce the finite set of statuses Stripe can emit. Leaving the column
-- free-text invites garbage that breaks dashboards. We keep it permissive
-- enough to cover every documented Stripe subscription status.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_subscription_status_check'
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_subscription_status_check
            CHECK (
                subscription_status IS NULL OR subscription_status IN (
                    'active',
                    'trialing',
                    'past_due',
                    'unpaid',
                    'canceled',
                    'incomplete',
                    'incomplete_expired',
                    'paused'
                )
            );
    END IF;
END
$$;

-- Indexes cover two hot queries: (a) resolve user by stripe_customer_id
-- at webhook receipt (O(log n) vs sequential scan) and (b) list all users
-- currently in a given subscription status for dunning / export.
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id
    ON public.users (stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_subscription_status
    ON public.users (subscription_status)
    WHERE subscription_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_past_due_since
    ON public.users (past_due_since)
    WHERE past_due_since IS NOT NULL;

COMMENT ON COLUMN public.users.subscription_status IS
    'Latest Stripe subscription status: active|trialing|past_due|unpaid|canceled|incomplete|incomplete_expired|paused. NULL for users who never had a paid subscription.';
COMMENT ON COLUMN public.users.current_period_end IS
    'End of the currently paid-for billing period. Renewed on invoice.payment_succeeded.';
COMMENT ON COLUMN public.users.past_due_since IS
    'Timestamp of the first invoice.payment_failed in the current dunning cycle. Cleared on invoice.payment_succeeded. Used to decide when to hard-revoke tier.';
COMMENT ON COLUMN public.users.stripe_customer_id IS
    'Stripe customer (cus_…). Cached on the user row so webhooks can resolve the user without a payment_transactions lookup.';
COMMENT ON COLUMN public.users.trial_ends_at IS
    'When the user''s Stripe trial ends. Set on customer.subscription.created / updated. Used by trial_will_end reminder logic.';
