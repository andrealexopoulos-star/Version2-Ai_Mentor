-- Migration 128: Auto top-up state machine — slider amount, monthly cap, period tracking.
-- Per Andreas direction 2026-05-04 (code 13041978).
--
-- Adds to public.users:
--   topup_amount_cents       — customer-set slider amount, default $50 (5000 cents)
--   topup_consent_at         — when customer opted-in to auto top-up at signup
--   monthly_cap_cents        — customer-set monthly max for total auto top-up spend, default $200
--   current_period_topup_cents  — running total of top-ups fired this billing period
--   current_period_start     — billing period start anchor for cap reset
--   current_period_end       — billing period end anchor for cap reset
--
-- Auto top-up firing logic uses these:
--   if balance < threshold AND auto_topup_enabled
--      AND (current_period_topup_cents + topup_amount_cents) <= monthly_cap_cents
--   then create Stripe PaymentIntent for topup_amount_cents.
--
-- All idempotent (DO blocks check column existence first).

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='users'
                     AND column_name='topup_amount_cents') THEN
        ALTER TABLE public.users ADD COLUMN topup_amount_cents integer NOT NULL DEFAULT 5000
            CHECK (topup_amount_cents >= 2000 AND topup_amount_cents <= 500000);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='users'
                     AND column_name='topup_consent_at') THEN
        ALTER TABLE public.users ADD COLUMN topup_consent_at timestamptz NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='users'
                     AND column_name='monthly_cap_cents') THEN
        ALTER TABLE public.users ADD COLUMN monthly_cap_cents integer NOT NULL DEFAULT 20000
            CHECK (monthly_cap_cents >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='users'
                     AND column_name='current_period_topup_cents') THEN
        ALTER TABLE public.users ADD COLUMN current_period_topup_cents integer NOT NULL DEFAULT 0
            CHECK (current_period_topup_cents >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='users'
                     AND column_name='current_period_start') THEN
        ALTER TABLE public.users ADD COLUMN current_period_start timestamptz NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='public' AND table_name='users'
                     AND column_name='current_period_end') THEN
        ALTER TABLE public.users ADD COLUMN current_period_end timestamptz NULL;
    END IF;
END$$;

-- usage_ledger 'topup' rows track Stripe charges. Add an index supporting the
-- common query: "give me all top-ups for this user in current period (for cap calc)".
CREATE INDEX IF NOT EXISTS idx_usage_ledger_user_topup_created
    ON public.usage_ledger (user_id, created_at DESC)
    WHERE kind = 'topup';

-- Refund window query: 24h after fired_at. usage_ledger.created_at is fired_at;
-- refund flips metadata->>'refunded_at' (no schema change required, jsonb).

COMMENT ON COLUMN public.users.topup_amount_cents IS
    'Customer-set auto-top-up slider amount in AUD cents. Range $20-$5,000 (2000-500000 cents). Default $50. Per Andreas 2026-05-04 code 13041978.';
COMMENT ON COLUMN public.users.topup_consent_at IS
    'When customer opted-in to auto top-up at signup (or last toggled to ON). Required for any Stripe charge.';
COMMENT ON COLUMN public.users.monthly_cap_cents IS
    'Customer-set monthly maximum for total auto top-up spend. Default $200 (20000 cents). 0 = no cap.';
COMMENT ON COLUMN public.users.current_period_topup_cents IS
    'Running total of auto top-up cents fired in current billing period. Reset by period rollover.';
COMMENT ON COLUMN public.users.current_period_start IS
    'Billing period start anchor for cap reset. Set on subscription start, advanced on period rollover.';
COMMENT ON COLUMN public.users.current_period_end IS
    'Billing period end anchor for cap reset.';
