-- Migration 113: UNIQUE index on usage_ledger.stripe_payment_intent_id for topups
-- Prevents B7 auto-top-up cron from inserting duplicate ledger rows if re-run
-- within the same month. Stripe's idempotency cache is only 24h, so a same-month
-- retry after day 1 can create a new PI — this index stops our ledger from
-- double-counting that PI if we accidentally insert twice.
-- Partial index on kind='topup' only (consume rows don't carry a PI id).
-- Coexists with migration 111's non-unique idx_usage_ledger_stripe_pi.

CREATE UNIQUE INDEX IF NOT EXISTS uq_usage_ledger_topup_pi
    ON public.usage_ledger (stripe_payment_intent_id)
    WHERE stripe_payment_intent_id IS NOT NULL AND kind = 'topup';

COMMENT ON INDEX public.uq_usage_ledger_topup_pi IS
    'Partial UNIQUE on topup rows only. B7 cron pre-insert guard + this index = no duplicate top-up ledger rows even if Stripe idempotency cache expires.';
