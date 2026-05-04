-- Migration 130: usage_ledger account scope support
-- Purpose:
--   1) Add account_id to usage_ledger while preserving user_id.
--   2) Backfill account_id from users.account_id.
--   3) Auto-stamp account_id from user_id on new writes.
--   4) Allow authenticated account-member reads via RLS.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'usage_ledger'
          AND column_name = 'account_id'
    ) THEN
        ALTER TABLE public.usage_ledger
            ADD COLUMN account_id uuid NULL;
    END IF;
END
$$;

-- Backfill existing rows from users.account_id.
UPDATE public.usage_ledger ul
SET account_id = u.account_id
FROM public.users u
WHERE ul.user_id = u.id
  AND ul.account_id IS NULL
  AND u.account_id IS NOT NULL;

-- FK constraint (add-not-valid then validate).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'usage_ledger_account_id_fkey'
          AND conrelid = 'public.usage_ledger'::regclass
    ) THEN
        ALTER TABLE public.usage_ledger
            ADD CONSTRAINT usage_ledger_account_id_fkey
            FOREIGN KEY (account_id)
            REFERENCES public.accounts(id)
            ON DELETE SET NULL
            NOT VALID;
    END IF;
END
$$;

ALTER TABLE public.usage_ledger
    VALIDATE CONSTRAINT usage_ledger_account_id_fkey;

CREATE INDEX IF NOT EXISTS idx_usage_ledger_account_created
    ON public.usage_ledger (account_id, created_at DESC)
    WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usage_ledger_account_kind_created
    ON public.usage_ledger (account_id, kind, created_at DESC)
    WHERE account_id IS NOT NULL;

-- Trigger to auto-stamp account_id from user_id.
CREATE OR REPLACE FUNCTION public.stamp_usage_ledger_account_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.account_id IS NULL AND NEW.user_id IS NOT NULL THEN
        SELECT u.account_id
        INTO NEW.account_id
        FROM public.users u
        WHERE u.id = NEW.user_id
        LIMIT 1;
    END IF;
    RETURN NEW;
END
$$;

ALTER FUNCTION public.stamp_usage_ledger_account_id() SET search_path = public;

DROP TRIGGER IF EXISTS trg_stamp_usage_ledger_account_id ON public.usage_ledger;
CREATE TRIGGER trg_stamp_usage_ledger_account_id
BEFORE INSERT OR UPDATE OF user_id, account_id
ON public.usage_ledger
FOR EACH ROW
EXECUTE FUNCTION public.stamp_usage_ledger_account_id();

-- Keep existing user-scope read policy and add account-member read policy.
DROP POLICY IF EXISTS usage_ledger_account_member_read ON public.usage_ledger;
CREATE POLICY usage_ledger_account_member_read
    ON public.usage_ledger
    FOR SELECT
    TO authenticated
    USING (
        account_id IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND u.account_id = usage_ledger.account_id
        )
    );

COMMENT ON COLUMN public.usage_ledger.account_id IS
    'Account billing scope for account-level usage aggregation; user_id is preserved for actor traceability.';
