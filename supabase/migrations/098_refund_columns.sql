-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION 098: payment_transactions refund-tracking columns
--                (Step 14 / P1-9 — Refund Policy & Ops)
--
-- Why:
--   The 029_payment_transactions table records initiated / paid Stripe
--   charges but has no place to record what happens when we refund one.
--   Ops has been tracking refunds out-of-band in a shared sheet, which
--   drifts from Stripe and hides revenue impact from the dashboards.
--
--   These four columns let us record a refund against the original
--   charge row without creating a separate shadow table, so:
--     • SELECT SUM(amount) WHERE payment_status='paid' AND refunded_at IS NULL
--       gives accurate net revenue in a single scan.
--     • Every refund is attributable to a person + reason for the audit
--       trail and support history.
--     • Credits issued in lieu of cash refunds (annual plan downgrades,
--       pro-rata adjustments) are tracked separately from cash refunds,
--       matching the Refund Policy page's distinction.
--
-- Design choices:
--   • refunded_at is nullable — a paid row is "open for refund" until
--     it's set; most rows will never have it populated.
--   • credit_issued_cents and the amount it corresponds to are both
--     expressed in minor units (cents) to match Stripe's internal
--     representation and avoid float drift on downgrades.
--   • refund_initiated_by stores a free-form identifier (ops email,
--     automation job name) rather than an FK so ops actions don't
--     require a users row and automated jobs can be attributed.
--   • refund_reason uses a CHECK constraint on a small enum so
--     dashboards can group cleanly. 'other' is the escape hatch for
--     anything the policy doesn't anticipate; 'other' rows should
--     populate the supporting note in stripe_reconcile_log if the
--     drift is system-significant.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.payment_transactions
    ADD COLUMN IF NOT EXISTS refunded_at         timestamptz,
    ADD COLUMN IF NOT EXISTS refund_reason       text,
    ADD COLUMN IF NOT EXISTS refund_initiated_by text,
    ADD COLUMN IF NOT EXISTS credit_issued_cents integer;

-- Drop-if-exists + create keeps this migration idempotent across re-runs
-- in dev without ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS (which
-- Postgres doesn't natively support).
ALTER TABLE public.payment_transactions
    DROP CONSTRAINT IF EXISTS payment_transactions_refund_reason_check;

ALTER TABLE public.payment_transactions
    ADD CONSTRAINT payment_transactions_refund_reason_check
    CHECK (
        refund_reason IS NULL OR refund_reason IN (
            'satisfaction_7day',       -- §2 of refund policy
            'plan_downgrade_credit',   -- §3 pro-rata credit on downgrade
            'annual_cancel_credit',    -- §4 annual mid-term cancel
            'billing_error',           -- duplicate charge, wrong amount, etc.
            'chargeback_reversal',     -- preempting a dispute
            'goodwill',                -- ops decision outside policy
            'other'                    -- escape hatch; note in reconcile_log
        )
    );

-- Integrity: if a row is marked refunded, it must carry a reason.
-- We deliberately don't require refund_initiated_by — automated
-- reversals (e.g. a future reconcile-job backfill) can populate it
-- later without blocking the write.
ALTER TABLE public.payment_transactions
    DROP CONSTRAINT IF EXISTS payment_transactions_refund_shape_check;
ALTER TABLE public.payment_transactions
    ADD CONSTRAINT payment_transactions_refund_shape_check
    CHECK (
        refunded_at IS NULL OR refund_reason IS NOT NULL
    );

-- Hot query 1: "how many open refunds this month" — ops dashboard.
CREATE INDEX IF NOT EXISTS idx_payment_transactions_refunded_at
    ON public.payment_transactions (refunded_at DESC)
    WHERE refunded_at IS NOT NULL;

-- Hot query 2: "what's been refunded for this user" — support lookup.
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_refunded
    ON public.payment_transactions (user_id, refunded_at DESC)
    WHERE refunded_at IS NOT NULL;

COMMENT ON COLUMN public.payment_transactions.refunded_at IS
    'Timestamp when the charge was refunded in Stripe. NULL for active / non-refunded paid rows.';
COMMENT ON COLUMN public.payment_transactions.refund_reason IS
    'One of: satisfaction_7day, plan_downgrade_credit, annual_cancel_credit, billing_error, chargeback_reversal, goodwill, other. Matches the Refund Policy page sections.';
COMMENT ON COLUMN public.payment_transactions.refund_initiated_by IS
    'Free-form attribution string — ops email for manual refunds, job name (e.g. "stripe_reconcile.py/2026-04-15") for automation.';
COMMENT ON COLUMN public.payment_transactions.credit_issued_cents IS
    'When a refund is issued as an account credit rather than cash (e.g. plan_downgrade_credit), the credit amount in minor units. NULL when the refund was paid back to the original method.';
