-- Migration 128: account linkage foundation for billing scope
-- Purpose:
--   1) Guarantee users.account_id exists and is indexed.
--   2) Backfill deterministic account linkage for users missing account_id.
--   3) Add FK users.account_id -> accounts.id (NOT VALID first, then validate).

-- 1) Ensure users.account_id exists.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'account_id'
    ) THEN
        ALTER TABLE public.users
            ADD COLUMN account_id uuid;
    END IF;
END
$$;

-- 2) Ensure accounts table exists (defensive in case env skipped 085).
CREATE TABLE IF NOT EXISTS public.accounts (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL,
    owner_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Backfill account rows for users with NULL account_id.
--    One synthetic account per user, deterministic naming.
WITH users_without_account AS (
    SELECT u.id, u.email
    FROM public.users u
    WHERE u.account_id IS NULL
),
inserted_accounts AS (
    INSERT INTO public.accounts (id, name, owner_id)
    SELECT
        gen_random_uuid() AS id,
        COALESCE(
            NULLIF(split_part(COALESCE(uw.email, ''), '@', 1), ''),
            'workspace-' || left(replace(uw.id::text, '-', ''), 8)
        ) AS name,
        uw.id AS owner_id
    FROM users_without_account uw
    RETURNING id, owner_id
)
UPDATE public.users u
SET account_id = ia.id
FROM inserted_accounts ia
WHERE u.id = ia.owner_id
  AND u.account_id IS NULL;

-- 4) Index for account-scoped lookups.
CREATE INDEX IF NOT EXISTS idx_users_account_id
    ON public.users (account_id)
    WHERE account_id IS NOT NULL;

-- 5) Foreign key (idempotent add + validate pattern).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_account_id_fkey'
          AND conrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_account_id_fkey
            FOREIGN KEY (account_id)
            REFERENCES public.accounts(id)
            ON DELETE SET NULL
            NOT VALID;
    END IF;
END
$$;

ALTER TABLE public.users
    VALIDATE CONSTRAINT users_account_id_fkey;

COMMENT ON COLUMN public.users.account_id IS
    'Billing/account scope identifier. Required for account-level entitlement and billing aggregation.';
