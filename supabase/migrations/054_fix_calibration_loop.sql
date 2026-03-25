-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 054: Fix strategic_console_state unique constraint
-- Prevents calibration loop by ensuring one row per user
-- ═══════════════════════════════════════════════════════════════

-- Remove duplicate rows first (keep the most recent per user)
DO $$
BEGIN
  IF to_regclass('public.strategic_console_state') IS NOT NULL THEN
    DELETE FROM public.strategic_console_state
    WHERE id NOT IN (
      SELECT DISTINCT ON (user_id) id
      FROM public.strategic_console_state
      ORDER BY user_id, updated_at DESC NULLS LAST
    );
  END IF;
END $$;

-- Add unique constraint if not exists
DO $$
BEGIN
  IF to_regclass('public.strategic_console_state') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'strategic_console_state_user_id_key'
    ) THEN
      ALTER TABLE public.strategic_console_state 
      ADD CONSTRAINT strategic_console_state_user_id_key UNIQUE (user_id);
    END IF;
  END IF;
END $$;

-- Add updated_at column with default if missing
DO $$
BEGIN
  IF to_regclass('public.strategic_console_state') IS NOT NULL THEN
    ALTER TABLE public.strategic_console_state 
      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Index for fast lookup
DO $$
BEGIN
  IF to_regclass('public.strategic_console_state') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_strategic_console_state_user 
      ON public.strategic_console_state(user_id, updated_at DESC);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.strategic_console_state') IS NOT NULL THEN
    GRANT ALL ON public.strategic_console_state TO service_role, authenticated;
  END IF;
END $$;
