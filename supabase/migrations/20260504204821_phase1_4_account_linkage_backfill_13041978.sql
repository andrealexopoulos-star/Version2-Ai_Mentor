-- Phase 1.4 — RC-6: Backfill accounts + users.account_id for every existing user
-- Code: 13041978
-- BEFORE: 19 active users + 1 sentinel all have account_id=NULL; only 4 orphan accounts (owner_id=NULL)
-- AFTER: every user has a canonical 1:1 account (account.id = user.id, owner_id = user.id)
-- Trigger trg_sync_account_billing_policy_from_users will auto-populate account_billing_policy

-- Step 1: ensure FK constraint on users.account_id exists pointing to accounts.id
-- (Do not add if already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema='public' AND table_name='users'
          AND constraint_name='users_account_id_fkey'
    ) THEN
        ALTER TABLE public.users
        ADD CONSTRAINT users_account_id_fkey
        FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;
    END IF;
END$$;

-- Step 2: for every user without an account_id, create a 1:1 account using user.id
-- Skip the BIQc internal sentinel
INSERT INTO public.accounts (id, name, owner_id, created_at)
SELECT
    u.id,
    COALESCE(
        NULLIF(trim(bp.business_name), ''),
        NULLIF(trim(u.company_name), ''),
        u.email
    ) AS name,
    u.id AS owner_id,
    u.created_at
FROM public.users u
LEFT JOIN public.business_profiles bp ON bp.user_id = u.id
WHERE u.account_id IS NULL
  AND u.id != '00000000-0000-0000-0000-000000000001'
ON CONFLICT (id) DO NOTHING;

-- Step 3: link users to their freshly-created accounts (this fires the policy-sync trigger)
UPDATE public.users u
SET account_id = u.id, updated_at = now()
WHERE u.account_id IS NULL
  AND u.id != '00000000-0000-0000-0000-000000000001'
  AND EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = u.id);

-- Step 4: backfill any users that already had a linked account but where the policy row is missing
-- (covers edge cases where trigger didn't fire on prior UPDATE)
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
    u.account_id,
    COALESCE(NULLIF(lower(trim(u.subscription_tier)), ''), 'free'),
    COALESCE(u.auto_topup_enabled, true),
    COALESCE(u.payment_required, false),
    u.topup_warned_at,
    public._derive_period_start_from_end(u.current_period_end),
    u.current_period_end
FROM public.users u
WHERE u.account_id IS NOT NULL
  AND u.id != '00000000-0000-0000-0000-000000000001'
ON CONFLICT (account_id) DO NOTHING;
