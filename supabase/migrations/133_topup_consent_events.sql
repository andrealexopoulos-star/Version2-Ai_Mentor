-- Migration 132: append-only top-up consent audit events
-- PR-2 latest-event-wins consent model.

CREATE TABLE IF NOT EXISTS public.topup_consent_events (
    id                        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id                uuid         NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    user_id                   uuid         NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    consent_action            text         NOT NULL CHECK (consent_action IN ('granted', 'revoked')),
    consent_version           text         NOT NULL,
    source                    text         NOT NULL,
    auto_topup_enabled_after  boolean      NOT NULL,
    monthly_topup_cap_after   integer      NULL CHECK (monthly_topup_cap_after IS NULL OR monthly_topup_cap_after >= 0),
    created_at                timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_topup_consent_events_account_created
    ON public.topup_consent_events (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_topup_consent_events_account_action_created
    ON public.topup_consent_events (account_id, consent_action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_topup_consent_events_user_created
    ON public.topup_consent_events (user_id, created_at DESC);

ALTER TABLE public.topup_consent_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS topup_consent_events_account_member_read ON public.topup_consent_events;
CREATE POLICY topup_consent_events_account_member_read
    ON public.topup_consent_events
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND u.account_id = topup_consent_events.account_id
        )
    );

DROP POLICY IF EXISTS topup_consent_events_service_role_all ON public.topup_consent_events;
CREATE POLICY topup_consent_events_service_role_all
    ON public.topup_consent_events
    FOR ALL
    USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role')
    WITH CHECK ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

GRANT SELECT ON public.topup_consent_events TO authenticated;
GRANT ALL ON public.topup_consent_events TO service_role;

COMMENT ON TABLE public.topup_consent_events IS
    'Append-only consent audit events. Effective consent is derived by latest-event-wins per account.';
