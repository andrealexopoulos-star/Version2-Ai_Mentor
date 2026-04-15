-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION 095: payment_transactions.stripe_customer_id / stripe_subscription_id
--
-- Background: stripe_payments._downgrade_user_tier queries
-- payment_transactions.stripe_customer_id and .stripe_subscription_id to
-- resolve a user on subscription-cancel webhooks. Those columns never
-- existed in migration 029_payment_transactions.sql, so the lookup
-- silently returned nothing and cancellation webhooks no-op'd. Cancelled
-- users therefore kept paid tier forever.
--
-- This migration adds the two columns idempotently so existing rows
-- survive unchanged, then backfills nothing (we cannot reconstruct the
-- Stripe IDs retroactively — that's what step 10's reconcile job handles).
-- Indexes enable O(log n) lookup on webhook receipt.
-- ═══════════════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'payment_transactions'
          AND column_name  = 'stripe_customer_id'
    ) THEN
        ALTER TABLE public.payment_transactions
            ADD COLUMN stripe_customer_id TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'payment_transactions'
          AND column_name  = 'stripe_subscription_id'
    ) THEN
        ALTER TABLE public.payment_transactions
            ADD COLUMN stripe_subscription_id TEXT;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_payment_tx_stripe_customer
    ON public.payment_transactions (stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_tx_stripe_subscription
    ON public.payment_transactions (stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;

COMMENT ON COLUMN public.payment_transactions.stripe_customer_id IS
    'Stripe customer (cus_…). Populated from checkout.session.completed and invoice.* webhooks. Required for cancellation/dunning resolution.';
COMMENT ON COLUMN public.payment_transactions.stripe_subscription_id IS
    'Stripe subscription (sub_…). Populated once a subscription exists. Null for one-off payments and at checkout-create time.';
