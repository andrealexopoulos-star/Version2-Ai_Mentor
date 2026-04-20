-- Migration 111: public.usage_ledger (v2 — insight-grade)
-- Append-only. kind IN (consume, topup, reset). tokens >= 0.
-- Net balance = SUM(CASE WHEN kind='consume' THEN -tokens ELSE tokens END)

CREATE TABLE IF NOT EXISTS public.usage_ledger (
    id                       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  uuid         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    kind                     text         NOT NULL CHECK (kind IN ('consume', 'topup', 'reset')),
    tokens                   bigint       NOT NULL CHECK (tokens >= 0),

    -- consume detail (null for topup/reset)
    input_tokens             bigint       NULL CHECK (input_tokens IS NULL OR input_tokens >= 0),
    output_tokens            bigint       NULL CHECK (output_tokens IS NULL OR output_tokens >= 0),
    cached_input_tokens      bigint       NULL CHECK (cached_input_tokens IS NULL OR cached_input_tokens >= 0),
    model                    text         NULL,
    provider                 text         NULL,
    feature                  text         NULL,
    action                   text         NULL,
    request_id               text         NULL,
    cost_aud_micros          bigint       NULL,
    cache_hit                boolean      NULL,
    tier_at_event            text         NULL,

    -- topup detail (null for consume/reset)
    stripe_invoice_id        text         NULL,
    stripe_payment_intent_id text         NULL,
    price_aud_cents          integer      NULL CHECK (price_aud_cents IS NULL OR price_aud_cents >= 0),

    -- reset detail (null for consume/topup)
    reset_reason             text         NULL CHECK (reset_reason IS NULL OR reset_reason IN ('period_start','plan_change','admin','trial_end')),
    period_start             timestamptz  NULL,
    period_end               timestamptz  NULL,

    metadata                 jsonb        NOT NULL DEFAULT '{}'::jsonb,
    created_at               timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT usage_ledger_consume_requires_model
        CHECK (kind <> 'consume' OR (model IS NOT NULL AND provider IS NOT NULL)),
    CONSTRAINT usage_ledger_topup_requires_pi
        CHECK (kind <> 'topup' OR stripe_payment_intent_id IS NOT NULL),
    CONSTRAINT usage_ledger_reset_requires_reason
        CHECK (kind <> 'reset' OR reset_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_user_created
    ON public.usage_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_user_kind_created
    ON public.usage_ledger (user_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_user_feature_created
    ON public.usage_ledger (user_id, feature, created_at DESC) WHERE feature IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usage_ledger_model_created
    ON public.usage_ledger (model, created_at DESC) WHERE model IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usage_ledger_stripe_invoice
    ON public.usage_ledger (stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usage_ledger_stripe_pi
    ON public.usage_ledger (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

ALTER TABLE public.usage_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_ledger_user_read
    ON public.usage_ledger FOR SELECT
    USING (auth.uid() = user_id);

COMMENT ON TABLE public.usage_ledger IS
    'Append-only token accounting ledger. kind=consume (LLM), topup (paid pack), reset (allowance). v2 insight-grade. Track B / migration 111 / 2026-04-20.';
