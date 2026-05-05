-- 2026-05-05 (13041978) — account_background_preferences: per-account toggle state for background loops.
--
-- Purpose: when a user toggles a background loop OFF in Settings → Billing, write
-- a row here. Backend edge functions check this table before firing the loop.
-- Default behaviour (no row) = use background_loop_registry.default_enabled.
--
-- See OPS Manual entry 01 section 5.3.

CREATE TABLE IF NOT EXISTS public.account_background_preferences (
    account_id     uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    schedule_key   text NOT NULL REFERENCES public.background_loop_registry(schedule_key) ON DELETE CASCADE,
    enabled        boolean NOT NULL,
    updated_at     timestamptz NOT NULL DEFAULT now(),
    updated_by     uuid REFERENCES auth.users(id),
    created_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, schedule_key)
);

COMMENT ON TABLE  public.account_background_preferences IS 'Per-account toggle state for autonomous BIQc background loops. Default if no row = background_loop_registry.default_enabled. Edge fns check is_loop_enabled_for_account() before firing.';

CREATE INDEX IF NOT EXISTS idx_acct_bg_prefs_account
    ON public.account_background_preferences (account_id);

ALTER TABLE public.account_background_preferences ENABLE ROW LEVEL SECURITY;

-- Account members can read+update their own account's preferences.
DROP POLICY IF EXISTS account_background_preferences_member_read ON public.account_background_preferences;
CREATE POLICY account_background_preferences_member_read
    ON public.account_background_preferences
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
              AND u.account_id = account_background_preferences.account_id
        )
    );

DROP POLICY IF EXISTS account_background_preferences_member_write ON public.account_background_preferences;
CREATE POLICY account_background_preferences_member_write
    ON public.account_background_preferences
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
              AND u.account_id = account_background_preferences.account_id
        )
    );

DROP POLICY IF EXISTS account_background_preferences_member_update ON public.account_background_preferences;
CREATE POLICY account_background_preferences_member_update
    ON public.account_background_preferences
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
              AND u.account_id = account_background_preferences.account_id
        )
    );

DROP POLICY IF EXISTS account_background_preferences_service_role ON public.account_background_preferences;
CREATE POLICY account_background_preferences_service_role
    ON public.account_background_preferences
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Helper function for edge functions / backend to check effective state.
-- Returns true if loop is enabled for the account, considering both per-account
-- preferences and the registry's default_enabled + excluded_tiers.
CREATE OR REPLACE FUNCTION public.is_loop_enabled_for_account(
    p_account_id uuid,
    p_schedule_key text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pref_enabled boolean;
    v_default_enabled boolean;
    v_excluded_tiers text[];
    v_account_tier text;
BEGIN
    -- Look up the registry entry.
    SELECT default_enabled, excluded_tiers
      INTO v_default_enabled, v_excluded_tiers
      FROM public.background_loop_registry
     WHERE schedule_key = p_schedule_key;

    IF NOT FOUND THEN
        -- Unknown loop — fail safe (don't fire)
        RETURN false;
    END IF;

    -- Check tier exclusion.
    SELECT effective_tier
      INTO v_account_tier
      FROM public.account_billing_policy
     WHERE account_id = p_account_id;

    IF v_account_tier IS NOT NULL AND v_account_tier = ANY(v_excluded_tiers) THEN
        RETURN false;  -- tier excluded
    END IF;

    -- Per-account override.
    SELECT enabled
      INTO v_pref_enabled
      FROM public.account_background_preferences
     WHERE account_id = p_account_id
       AND schedule_key = p_schedule_key;

    IF FOUND THEN
        RETURN v_pref_enabled;
    END IF;

    -- Fall back to registry default.
    RETURN v_default_enabled;
END;
$$;

COMMENT ON FUNCTION public.is_loop_enabled_for_account(uuid, text) IS 'Single source of truth for whether a background loop should fire for a given account. Checks: tier exclusion → per-account preference → registry default. Edge functions and crons should call this before any LLM work.';

GRANT EXECUTE ON FUNCTION public.is_loop_enabled_for_account(uuid, text) TO authenticated, service_role;
