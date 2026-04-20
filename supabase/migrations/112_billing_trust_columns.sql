-- Migration 112: billing-trust-layer columns on public.users
-- Track B dependency. Adds: auto_topup_enabled, payment_required, topup_warned_at.
-- All idempotent. auto_topup_enabled default=true per Andreas 2026-04-20 B8 lock.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='users'
                     AND column_name='auto_topup_enabled') THEN
        ALTER TABLE public.users ADD COLUMN auto_topup_enabled boolean NOT NULL DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='users'
                     AND column_name='payment_required') THEN
        ALTER TABLE public.users ADD COLUMN payment_required boolean NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='users'
                     AND column_name='topup_warned_at') THEN
        ALTER TABLE public.users ADD COLUMN topup_warned_at timestamptz NULL;
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_users_payment_required_true
    ON public.users (id) WHERE payment_required = true;

COMMENT ON COLUMN public.users.auto_topup_enabled IS
    'When true, backend auto-charges A$29 for a 500K-token pack at allowance exhaustion. Default true per Andreas 2026-04-20 lock (B8).';
COMMENT ON COLUMN public.users.payment_required IS
    'Set true by B7 cron when a top-up PaymentIntent fails definitively. UI shows red banner + forces portal visit. Cleared by Stripe webhook on invoice.payment_succeeded / payment_intent.succeeded.';
COMMENT ON COLUMN public.users.topup_warned_at IS
    'Timestamp of most recent E12 "approaching allowance" warning so B6 cron does not spam. Reset per billing period.';
