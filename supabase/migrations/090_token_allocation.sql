-- ═══════════════════════════════════════════════════════════════
-- MIGRATION 090: Token Allocation & Metering
-- Monthly per-user token budgets with overage tracking.
-- Extends ai_usage_log with per-call token + cost columns.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Token allocations table ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.token_allocations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tier          TEXT NOT NULL DEFAULT 'free',
    period_start  TIMESTAMPTZ NOT NULL,
    period_end    TIMESTAMPTZ NOT NULL,
    input_allocated   BIGINT NOT NULL DEFAULT 0,
    output_allocated  BIGINT NOT NULL DEFAULT 0,
    input_used        BIGINT NOT NULL DEFAULT 0,
    output_used       BIGINT NOT NULL DEFAULT 0,
    overage_input     BIGINT NOT NULL DEFAULT 0,
    overage_output    BIGINT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_token_alloc_user_period UNIQUE (user_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_token_alloc_user   ON public.token_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_token_alloc_period  ON public.token_allocations(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_token_alloc_tier    ON public.token_allocations(tier);

-- RLS
ALTER TABLE public.token_allocations ENABLE ROW LEVEL SECURITY;

-- Users can read their own allocations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'token_allocations'
          AND policyname = 'users_read_own_allocations'
    ) THEN
        CREATE POLICY users_read_own_allocations ON public.token_allocations
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

-- Service role manages all rows (insert/update/delete)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'token_allocations'
          AND policyname = 'service_manage_token_allocations'
    ) THEN
        CREATE POLICY service_manage_token_allocations ON public.token_allocations
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

GRANT ALL ON public.token_allocations TO service_role;
GRANT SELECT ON public.token_allocations TO authenticated;

-- ─── 2. Extend ai_usage_log with token-level columns ──────────
-- These columns track per-call token counts and cost.
-- Using DO blocks so the migration is idempotent.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ai_usage_log'
          AND column_name = 'model_used'
    ) THEN
        ALTER TABLE public.ai_usage_log ADD COLUMN model_used TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ai_usage_log'
          AND column_name = 'input_tokens'
    ) THEN
        ALTER TABLE public.ai_usage_log ADD COLUMN input_tokens INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ai_usage_log'
          AND column_name = 'output_tokens'
    ) THEN
        ALTER TABLE public.ai_usage_log ADD COLUMN output_tokens INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ai_usage_log'
          AND column_name = 'cost_aud'
    ) THEN
        ALTER TABLE public.ai_usage_log ADD COLUMN cost_aud NUMERIC(12,6) DEFAULT 0;
    END IF;
END $$;

-- Index for token-level queries on ai_usage_log
CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON public.ai_usage_log(model_used);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tokens ON public.ai_usage_log(user_id, input_tokens, output_tokens);
