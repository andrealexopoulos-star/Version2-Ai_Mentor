-- Migration 131: account-scoped token allocation foundation
-- Purpose:
--   1) Add nullable account_id to token_allocations (non-destructive).
--   2) Backfill account_id from users.account_id where deterministic.
--   3) Add account-period unique/index paths for shared billing scope.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'token_allocations'
          AND column_name = 'account_id'
    ) THEN
        ALTER TABLE public.token_allocations
            ADD COLUMN account_id uuid NULL;
    END IF;
END
$$;

-- Deterministic backfill: existing row.user_id -> users.account_id.
UPDATE public.token_allocations ta
SET account_id = u.account_id
FROM public.users u
WHERE ta.user_id = u.id
  AND ta.account_id IS NULL
  AND u.account_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'token_allocations_account_id_fkey'
          AND conrelid = 'public.token_allocations'::regclass
    ) THEN
        ALTER TABLE public.token_allocations
            ADD CONSTRAINT token_allocations_account_id_fkey
            FOREIGN KEY (account_id)
            REFERENCES public.accounts(id)
            ON DELETE SET NULL
            NOT VALID;
    END IF;
END
$$;

ALTER TABLE public.token_allocations
    VALIDATE CONSTRAINT token_allocations_account_id_fkey;

CREATE INDEX IF NOT EXISTS idx_token_alloc_account
    ON public.token_allocations (account_id)
    WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_token_alloc_account_period
    ON public.token_allocations (account_id, period_start, period_end)
    WHERE account_id IS NOT NULL;

-- Shared-billing uniqueness path (keeps legacy uq_token_alloc_user_period intact).
CREATE UNIQUE INDEX IF NOT EXISTS uq_token_alloc_account_period
    ON public.token_allocations (account_id, period_start)
    WHERE account_id IS NOT NULL;

COMMENT ON COLUMN public.token_allocations.account_id IS
    'Account/business scope for shared monthly AI allowance. user_id remains for actor attribution.';
