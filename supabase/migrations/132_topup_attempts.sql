-- Migration 131: account-scoped top-up attempts lifecycle
-- PR-2 Day 1 metered billing pipeline foundation.

CREATE TABLE IF NOT EXISTS public.topup_attempts (
    id                       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id               uuid         NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id                  uuid         NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    tier                     text         NOT NULL,
    status                   text         NOT NULL
        CHECK (status IN ('pending', 'requires_action', 'failed', 'succeeded', 'cap_reached', 'blocked')),
    trigger_type             text         NOT NULL
        CHECK (trigger_type IN ('manual', 'auto_request_time')),
    threshold_trigger        numeric(6,5) NULL
        CHECK (threshold_trigger IS NULL OR (threshold_trigger >= 0 AND threshold_trigger <= 1)),
    cycle_start              timestamptz  NOT NULL,
    cycle_end                timestamptz  NOT NULL,
    tokens_grant             bigint       NOT NULL CHECK (tokens_grant > 0),
    price_aud_cents          integer      NOT NULL CHECK (price_aud_cents >= 0),
    currency                 text         NOT NULL DEFAULT 'aud',
    stripe_customer_id       text         NULL,
    stripe_subscription_id   text         NULL,
    stripe_payment_intent_id text         NULL,
    stripe_invoice_id        text         NULL,
    idempotency_key          text         NOT NULL,
    failure_reason           text         NULL,
    created_at               timestamptz  NOT NULL DEFAULT now(),
    updated_at               timestamptz  NOT NULL DEFAULT now(),
    succeeded_at             timestamptz  NULL,
    failed_at                timestamptz  NULL,
    CONSTRAINT topup_attempts_cycle_order CHECK (cycle_end > cycle_start),
    CONSTRAINT topup_attempts_idempotency_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_topup_attempts_account_created
    ON public.topup_attempts (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_topup_attempts_account_status_created
    ON public.topup_attempts (account_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_topup_attempts_account_cycle
    ON public.topup_attempts (account_id, cycle_start, cycle_end);

CREATE UNIQUE INDEX IF NOT EXISTS uq_topup_attempts_stripe_pi
    ON public.topup_attempts (stripe_payment_intent_id)
    WHERE stripe_payment_intent_id IS NOT NULL;

-- Prevent duplicate concurrent pending attempts in the same scope.
CREATE UNIQUE INDEX IF NOT EXISTS uq_topup_attempts_pending_scope
    ON public.topup_attempts (
        account_id,
        cycle_start,
        cycle_end,
        trigger_type,
        tokens_grant,
        price_aud_cents
    )
    WHERE status = 'pending';

ALTER TABLE public.topup_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS topup_attempts_account_member_read ON public.topup_attempts;
CREATE POLICY topup_attempts_account_member_read
    ON public.topup_attempts
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND u.account_id = topup_attempts.account_id
        )
    );

DROP POLICY IF EXISTS topup_attempts_service_role_all ON public.topup_attempts;
CREATE POLICY topup_attempts_service_role_all
    ON public.topup_attempts
    FOR ALL
    USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role')
    WITH CHECK ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

GRANT SELECT ON public.topup_attempts TO authenticated;
GRANT ALL ON public.topup_attempts TO service_role;

COMMENT ON TABLE public.topup_attempts IS
    'Top-up attempt lifecycle audit for manual and request-time auto top-ups. Tokens are granted only after successful Stripe payment.';
