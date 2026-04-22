-- Migration 120: public.cancel_reasons
-- Captures WHY a user is heading to the Stripe portal (to cancel/manage/downgrade).
-- Voice-of-customer data for retention. Sprint B #18 (2026-04-22).
-- Append-only. User can insert their own rows; super_admin reads all.

CREATE TABLE IF NOT EXISTS public.cancel_reasons (
    id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            uuid         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason_key         text         NOT NULL CHECK (reason_key IN (
                                        'too_expensive',
                                        'not_enough_value',
                                        'missing_feature',
                                        'switching_tool',
                                        'pausing',
                                        'other'
                                    )),
    note               text         NULL CHECK (note IS NULL OR char_length(note) <= 2000),
    submitted_at       timestamptz  NOT NULL DEFAULT now(),
    current_tier       text         NULL,
    days_since_signup  integer      NULL CHECK (days_since_signup IS NULL OR days_since_signup >= 0)
);

CREATE INDEX IF NOT EXISTS idx_cancel_reasons_user_submitted
    ON public.cancel_reasons (user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_cancel_reasons_reason_submitted
    ON public.cancel_reasons (reason_key, submitted_at DESC);

ALTER TABLE public.cancel_reasons ENABLE ROW LEVEL SECURITY;

-- User can INSERT rows for themselves only (backend also writes as service role,
-- which bypasses RLS — this policy exists so a Supabase-client-authed user
-- cannot spoof someone else's user_id).
DROP POLICY IF EXISTS cancel_reasons_user_insert ON public.cancel_reasons;
CREATE POLICY cancel_reasons_user_insert
    ON public.cancel_reasons FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- User can SELECT only their own rows.
DROP POLICY IF EXISTS cancel_reasons_user_read ON public.cancel_reasons;
CREATE POLICY cancel_reasons_user_read
    ON public.cancel_reasons FOR SELECT
    USING (auth.uid() = user_id);

-- super_admin can SELECT everything (retention-intel dashboard will read this).
-- Mirrors the pattern used in migrations 067 / 094 — role OR subscription_tier.
DROP POLICY IF EXISTS cancel_reasons_super_admin_read ON public.cancel_reasons;
CREATE POLICY cancel_reasons_super_admin_read
    ON public.cancel_reasons FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
              AND (
                  LOWER(COALESCE(u.role, '')) IN ('super_admin', 'superadmin')
                  OR LOWER(COALESCE(u.subscription_tier, '')) IN ('super_admin', 'superadmin')
              )
        )
    );

COMMENT ON TABLE public.cancel_reasons IS
    'Voice-of-customer: WHY a user is heading to Stripe billing portal. Captured before the cancel flow, not gated. Sprint B #18 / 2026-04-22.';
COMMENT ON COLUMN public.cancel_reasons.reason_key IS
    'One of six canonical retention buckets. Keep in sync with CancelReasonModal.js REASONS + backend billing.py ALLOWED_CANCEL_REASONS.';
COMMENT ON COLUMN public.cancel_reasons.note IS
    'Optional free-text "Anything else?" response. Capped at 2000 chars.';
COMMENT ON COLUMN public.cancel_reasons.current_tier IS
    'Snapshot of users.subscription_tier at time of submission — lets us see which tier is churning most without joining on a future plan change.';
COMMENT ON COLUMN public.cancel_reasons.days_since_signup IS
    'Snapshot of (now - users.created_at) in days. Same rationale: avoid future signup-date mutations breaking the cohort view.';
