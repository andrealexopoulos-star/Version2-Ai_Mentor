-- Migration 118: provider_usage_tracking — running tally per supplier
--
-- Purpose: Power the Super-Admin API Providers dashboard. One row per
-- external vendor BIQc consumes. Tracks total call count, cumulative
-- cost in AUD micros, last-called timestamp, most recent error, and a
-- rolled-up status (up | down | unknown | error).
--
-- Scope locked 2026-04-22 by Andreas: one row per provider for EVERY
-- provider BIQc uses. Drill-down by GP deferred.
--
-- Providers are seeded at migration time (call_count=0, status='unknown')
-- so the dashboard shows every known supplier row from day 1 even before
-- instrumentation has caught up. LLM aggregation is powered by the
-- refresh_provider_usage() function below which rolls usage_ledger into
-- this table on demand. Non-LLM providers (Browse AI, SEMrush, Firecrawl,
-- Perplexity, Resend, Merge) are tracked via backend/core/provider_tracker.py.

CREATE TABLE IF NOT EXISTS public.provider_usage (
    id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    provider              text         NOT NULL,              -- 'openai' | 'anthropic' | 'browse_ai' | ...
    call_count            bigint       NOT NULL DEFAULT 0,
    total_cost_aud_micros bigint       NOT NULL DEFAULT 0,    -- AUD * 1_000_000 (matches usage_ledger)
    last_called_at        timestamptz  NULL,
    last_error            text         NULL,                  -- e.g. 'out_of_credit' | '429 rate_limited'
    last_error_at         timestamptz  NULL,
    status                text         NOT NULL DEFAULT 'unknown'
                                       CHECK (status IN ('up','down','unknown','error')),
    updated_at            timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT provider_usage_unique UNIQUE (provider)
);

CREATE INDEX IF NOT EXISTS idx_provider_usage_status
    ON public.provider_usage (status);
CREATE INDEX IF NOT EXISTS idx_provider_usage_last_called
    ON public.provider_usage (last_called_at DESC NULLS LAST);

COMMENT ON TABLE public.provider_usage IS
    'Super-admin API Providers dashboard source of truth. One row per external '
    'vendor (OpenAI, Anthropic, Gemini, Stripe, Resend, SEMrush, etc.). '
    'Aggregated from usage_ledger for LLMs; updated per-call for non-LLM '
    'providers via backend/core/provider_tracker.record_provider_call(). '
    'Migration 118 / 2026-04-22.';

-- ─── Seed: one row per known provider BIQc uses ─────────────────────────────
-- Sourced by grep across backend/ + supabase/functions/ 2026-04-22. If a new
-- provider is introduced, add a seed row here in a follow-up migration.
INSERT INTO public.provider_usage (provider, status) VALUES
    ('openai',     'unknown'),  -- OPENAI_API_KEY  · backend LLM router + edge funcs
    ('anthropic',  'unknown'),  -- ANTHROPIC_API_KEY · llm_router.py
    ('gemini',     'unknown'),  -- GOOGLE_API_KEY (Gemini) · llm_router.py
    ('browse_ai',  'unknown'),  -- BROWSE_AI_API_KEY · edge fn browse-ai-reviews
    ('semrush',    'unknown'),  -- SEMRUSH_API_KEY · edge fn semrush-domain-intel
    ('firecrawl',  'unknown'),  -- FIRECRAWL_API_KEY · calibration-business-dna + deep-web-recon
    ('perplexity', 'unknown'),  -- PERPLEXITY_API_KEY · calibration-business-dna + market-analysis-ai
    ('resend',     'unknown'),  -- RESEND_API_KEY · services/email_service.py
    ('stripe',     'unknown'),  -- STRIPE_API_KEY · routes/stripe_payments.py
    ('merge',      'unknown'),  -- MERGE_API_KEY · merge_client.py + intelligence_automation_worker
    ('supabase',   'unknown'),  -- SUPABASE_SERVICE_ROLE_KEY · everywhere
    ('serper',     'unknown'),  -- SERPER_API_KEY · core/helpers.py (SERP results)
    ('sentry',     'unknown')   -- SENTRY_DSN · server.py (error observability)
ON CONFLICT (provider) DO NOTHING;

-- ─── RLS: service_role only ─────────────────────────────────────────────────
ALTER TABLE public.provider_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_provider_usage" ON public.provider_usage;
CREATE POLICY "service_role_full_provider_usage"
    ON public.provider_usage FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ─── Aggregator: refresh LLM provider rows from usage_ledger ────────────────
-- Called on demand by the super-admin endpoint. Cron wiring is deferred to a
-- follow-up migration (Andreas — 2026-04-22 scope decision).
--
-- Logic: for each LLM provider present in usage_ledger (kind='consume'),
-- roll up SUM(tokens) as call_count and SUM(COALESCE(cost_aud_micros, 0))
-- as total_cost_aud_micros, and MAX(created_at) as last_called_at. Status
-- is set to 'up' when we have ANY successful call in the last 24 h AND
-- no newer error; otherwise left untouched so manual override via
-- record_provider_call() isn't clobbered.
CREATE OR REPLACE FUNCTION public.refresh_provider_usage()
RETURNS TABLE(provider text, call_count bigint, total_cost_aud_micros bigint, last_called_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH llm_rollup AS (
        SELECT
            ul.provider::text                        AS provider,
            COUNT(*)::bigint                         AS call_count,
            COALESCE(SUM(ul.cost_aud_micros), 0)::bigint AS total_cost_aud_micros,
            MAX(ul.created_at)                       AS last_called_at
        FROM public.usage_ledger ul
        WHERE ul.kind = 'consume' AND ul.provider IS NOT NULL
        GROUP BY ul.provider
    ),
    upserted AS (
        INSERT INTO public.provider_usage
            (provider, call_count, total_cost_aud_micros, last_called_at, status, updated_at)
        SELECT
            r.provider,
            r.call_count,
            r.total_cost_aud_micros,
            r.last_called_at,
            CASE
                WHEN r.last_called_at > (now() - interval '24 hours') THEN 'up'
                ELSE 'unknown'
            END,
            now()
        FROM llm_rollup r
        ON CONFLICT (provider) DO UPDATE
            SET call_count            = EXCLUDED.call_count,
                total_cost_aud_micros = EXCLUDED.total_cost_aud_micros,
                last_called_at        = EXCLUDED.last_called_at,
                status                = CASE
                    WHEN public.provider_usage.last_error_at IS NOT NULL
                     AND public.provider_usage.last_error_at > EXCLUDED.last_called_at
                        THEN public.provider_usage.status
                    ELSE EXCLUDED.status
                END,
                updated_at            = now()
            RETURNING public.provider_usage.provider,
                      public.provider_usage.call_count,
                      public.provider_usage.total_cost_aud_micros,
                      public.provider_usage.last_called_at
    )
    SELECT u.provider, u.call_count, u.total_cost_aud_micros, u.last_called_at FROM upserted u;
END;
$$;

COMMENT ON FUNCTION public.refresh_provider_usage IS
    'Roll LLM usage_ledger rows into provider_usage. Called on demand by '
    'GET /api/super-admin/api-providers. Non-LLM providers are untouched '
    'here — they are updated per-call by backend/core/provider_tracker.py.';

GRANT EXECUTE ON FUNCTION public.refresh_provider_usage() TO service_role;
