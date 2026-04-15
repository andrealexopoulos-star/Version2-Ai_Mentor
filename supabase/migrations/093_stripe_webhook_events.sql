-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION 093: Stripe webhook idempotency + subscription lifecycle
-- Stores every Stripe webhook event id we've processed so retries are
-- safe (Stripe re-sends events on any non-2xx). Also gives us an audit
-- trail of the full subscription lifecycle.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
    event_id        text PRIMARY KEY,
    event_type      text NOT NULL,
    received_at     timestamptz NOT NULL DEFAULT now(),
    processed_at    timestamptz,
    user_id         uuid REFERENCES public.users(id) ON DELETE SET NULL,
    customer_id     text,
    subscription_id text,
    raw_payload     jsonb,
    processing_status text NOT NULL DEFAULT 'pending'
        CHECK (processing_status IN ('pending', 'processed', 'failed', 'duplicate_skipped'))
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type
    ON public.stripe_webhook_events(event_type, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_user
    ON public.stripe_webhook_events(user_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status
    ON public.stripe_webhook_events(processing_status)
    WHERE processing_status IN ('pending', 'failed');

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- service_role only — webhook events are never read by end users.
DROP POLICY IF EXISTS stripe_webhook_events_service_role ON public.stripe_webhook_events;
CREATE POLICY stripe_webhook_events_service_role
    ON public.stripe_webhook_events
    FOR ALL
    USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role')
    WITH CHECK ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

GRANT ALL ON public.stripe_webhook_events TO service_role;
