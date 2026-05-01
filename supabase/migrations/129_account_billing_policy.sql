-- Migration 129: account billing policy + deterministic cycle state
-- Purpose:
--   1) Create account-level billing policy/state table.
--   2) Seed defaults from current users lifecycle/billing-trust fields.
--   3) Keep policy in sync from users updates (Stripe lifecycle writes users today).

CREATE TABLE IF NOT EXISTS public.account_billing_policy (
    account_id                   uuid PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
    effective_tier               text        NOT NULL DEFAULT 'free',
    monthly_topup_cap_override   integer     NULL CHECK (monthly_topup_cap_override IS NULL OR monthly_topup_cap_override >= 0),
    auto_topup_enabled           boolean     NOT NULL DEFAULT true,
    payment_required             boolean     NOT NULL DEFAULT false,
    topup_warned_at              timestamptz NULL,
    current_period_start         timestamptz NULL,
    current_period_end           timestamptz NULL,
    created_at                   timestamptz NOT NULL DEFAULT now(),
    updated_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_billing_policy_effective_tier
    ON public.account_billing_policy (effective_tier);
CREATE INDEX IF NOT EXISTS idx_account_billing_policy_payment_required
    ON public.account_billing_policy (payment_required)
    WHERE payment_required = true;
CREATE INDEX IF NOT EXISTS idx_account_billing_policy_period
    ON public.account_billing_policy (current_period_start, current_period_end);

ALTER TABLE public.account_billing_policy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_billing_policy_member_read ON public.account_billing_policy;
CREATE POLICY account_billing_policy_member_read
    ON public.account_billing_policy
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND u.account_id = account_billing_policy.account_id
        )
    );

DROP POLICY IF EXISTS account_billing_policy_service_role ON public.account_billing_policy;
CREATE POLICY account_billing_policy_service_role
    ON public.account_billing_policy
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Helper: derive deterministic period_start from period_end when available.
CREATE OR REPLACE FUNCTION public._derive_period_start_from_end(p_period_end timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
AS $$
DECLARE
    v_year int;
    v_month int;
    v_day int;
BEGIN
    IF p_period_end IS NULL THEN
        RETURN NULL;
    END IF;

    v_year := EXTRACT(YEAR FROM p_period_end);
    v_month := EXTRACT(MONTH FROM p_period_end)::int - 1;
    IF v_month = 0 THEN
        v_month := 12;
        v_year := v_year - 1;
    END IF;
    v_day := LEAST(
        EXTRACT(DAY FROM p_period_end)::int,
        EXTRACT(DAY FROM (date_trunc('month', make_timestamptz(v_year, v_month, 1, 0, 0, 0)) + interval '1 month - 1 day'))::int
    );
    RETURN make_timestamptz(
        v_year,
        v_month,
        v_day,
        EXTRACT(HOUR FROM p_period_end)::int,
        EXTRACT(MINUTE FROM p_period_end)::int,
        FLOOR(EXTRACT(SECOND FROM p_period_end))::int
    );
END
$$;

ALTER FUNCTION public._derive_period_start_from_end(timestamptz) SET search_path = public;

-- Seed policy rows from users. First user in account wins tie-break by created_at.
WITH ranked_users AS (
    SELECT
        u.account_id,
        u.subscription_tier,
        u.auto_topup_enabled,
        u.payment_required,
        u.topup_warned_at,
        u.current_period_end,
        ROW_NUMBER() OVER (
            PARTITION BY u.account_id
            ORDER BY u.created_at ASC, u.id ASC
        ) AS rn
    FROM public.users u
    WHERE u.account_id IS NOT NULL
),
seed AS (
    SELECT
        ru.account_id,
        COALESCE(NULLIF(lower(trim(ru.subscription_tier)), ''), 'free') AS effective_tier,
        COALESCE(ru.auto_topup_enabled, true) AS auto_topup_enabled,
        COALESCE(ru.payment_required, false) AS payment_required,
        ru.topup_warned_at,
        public._derive_period_start_from_end(ru.current_period_end) AS current_period_start,
        ru.current_period_end
    FROM ranked_users ru
    WHERE ru.rn = 1
)
INSERT INTO public.account_billing_policy (
    account_id,
    effective_tier,
    auto_topup_enabled,
    payment_required,
    topup_warned_at,
    current_period_start,
    current_period_end
)
SELECT
    s.account_id,
    s.effective_tier,
    s.auto_topup_enabled,
    s.payment_required,
    s.topup_warned_at,
    s.current_period_start,
    s.current_period_end
FROM seed s
ON CONFLICT (account_id) DO UPDATE
SET
    effective_tier = EXCLUDED.effective_tier,
    auto_topup_enabled = EXCLUDED.auto_topup_enabled,
    payment_required = EXCLUDED.payment_required,
    topup_warned_at = EXCLUDED.topup_warned_at,
    current_period_start = COALESCE(EXCLUDED.current_period_start, account_billing_policy.current_period_start),
    current_period_end = COALESCE(EXCLUDED.current_period_end, account_billing_policy.current_period_end),
    updated_at = now();

-- Sync policy row whenever users lifecycle/billing trust fields change.
CREATE OR REPLACE FUNCTION public.sync_account_billing_policy_from_users()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.account_id IS NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.account_billing_policy (
        account_id,
        effective_tier,
        auto_topup_enabled,
        payment_required,
        topup_warned_at,
        current_period_start,
        current_period_end
    )
    VALUES (
        NEW.account_id,
        COALESCE(NULLIF(lower(trim(NEW.subscription_tier)), ''), 'free'),
        COALESCE(NEW.auto_topup_enabled, true),
        COALESCE(NEW.payment_required, false),
        NEW.topup_warned_at,
        public._derive_period_start_from_end(NEW.current_period_end),
        NEW.current_period_end
    )
    ON CONFLICT (account_id) DO UPDATE
    SET
        effective_tier = EXCLUDED.effective_tier,
        auto_topup_enabled = EXCLUDED.auto_topup_enabled,
        payment_required = EXCLUDED.payment_required,
        topup_warned_at = EXCLUDED.topup_warned_at,
        current_period_start = COALESCE(EXCLUDED.current_period_start, account_billing_policy.current_period_start),
        current_period_end = COALESCE(EXCLUDED.current_period_end, account_billing_policy.current_period_end),
        updated_at = now();

    RETURN NEW;
END
$$;

ALTER FUNCTION public.sync_account_billing_policy_from_users() SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_account_billing_policy_from_users ON public.users;
CREATE TRIGGER trg_sync_account_billing_policy_from_users
AFTER INSERT OR UPDATE OF
    account_id,
    subscription_tier,
    auto_topup_enabled,
    payment_required,
    topup_warned_at,
    current_period_end
ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_account_billing_policy_from_users();

COMMENT ON TABLE public.account_billing_policy IS
    'Account-level billing policy/state used by account-scoped entitlement and top-up controls.';
