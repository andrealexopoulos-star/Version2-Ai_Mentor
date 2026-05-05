-- 2026-05-05 (13041978) — Billing scalability registry: 4 tables + seeds.
--
-- Purpose: move pricing config out of code and into the database so adding a new
-- tier, pack, background loop, or LLM provider is a database operation (or
-- super_admin admin-panel click), not a code-deploy.
--
-- See OPS Manual entry 01 section 8 for the design rationale.
--
-- Tables created:
--   1. pricing_tier_rates       — per-tier $/1M-tokens rate for top-up pack pricing
--   2. topup_pack_sizes         — available top-up pack sizes (1M / 5M / 10M / 25M / 50M)
--   3. background_loop_registry — autonomous BIQc "thinking" loops with toggle metadata
--   4. llm_providers            — provider catalogue (openai / anthropic / google / perplexity)
--
-- All tables seeded with current production values so behaviour is unchanged at deploy.
-- Backend code that reads these tables is added in a follow-up PR.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. pricing_tier_rates
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pricing_tier_rates (
    tier_id                          text PRIMARY KEY,
    monthly_token_allowance          bigint NOT NULL CHECK (monthly_token_allowance >= 0),
    monthly_subscription_aud_cents   integer NOT NULL CHECK (monthly_subscription_aud_cents >= 0),
    rate_aud_cents_per_1m            integer NOT NULL CHECK (rate_aud_cents_per_1m >= 0),
    effective_from                   timestamptz NOT NULL DEFAULT now(),
    effective_to                     timestamptz,
    notes                            text,
    created_at                       timestamptz NOT NULL DEFAULT now(),
    updated_at                       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.pricing_tier_rates IS 'Per-tier monthly subscription + token allowance + per-1M-tokens top-up rate. Read at runtime by billing services. Time-versioned via effective_from/to. Migration 20260505 / OPS Manual entry 01.';
COMMENT ON COLUMN public.pricing_tier_rates.rate_aud_cents_per_1m IS 'Top-up pack rate per 1,000,000 tokens, in AUD cents. Lite=9333 ($93.33), Growth=6900 ($69), Pro=3980 ($39.80), Business=1745 ($17.45).';

CREATE INDEX IF NOT EXISTS idx_pricing_tier_rates_active
    ON public.pricing_tier_rates (tier_id)
    WHERE effective_to IS NULL;

ALTER TABLE public.pricing_tier_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pricing_tier_rates_authenticated_read ON public.pricing_tier_rates;
CREATE POLICY pricing_tier_rates_authenticated_read
    ON public.pricing_tier_rates
    FOR SELECT
    TO authenticated
    USING (true);  -- pricing is public-knowable

DROP POLICY IF EXISTS pricing_tier_rates_service_role ON public.pricing_tier_rates;
CREATE POLICY pricing_tier_rates_service_role
    ON public.pricing_tier_rates
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

INSERT INTO public.pricing_tier_rates (tier_id, monthly_token_allowance, monthly_subscription_aud_cents, rate_aud_cents_per_1m, notes)
VALUES
    ('lite',     150000,    1400,  9333, 'Lite — $14/mo, 150K tokens, $93.33/1M top-up rate'),
    ('starter',  1000000,   6900,  6900, 'Growth — $69/mo, 1M tokens, $69/1M top-up rate (id "starter" is the backend canonical key for the Growth tier)'),
    ('pro',      5000000,   19900, 3980, 'Pro — $199/mo, 5M tokens, $39.80/1M top-up rate'),
    ('business', 20000000,  34900, 1745, 'Business — $349/mo, 20M tokens, $17.45/1M top-up rate')
ON CONFLICT (tier_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. topup_pack_sizes
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.topup_pack_sizes (
    pack_size_tokens   bigint PRIMARY KEY CHECK (pack_size_tokens > 0),
    active             boolean NOT NULL DEFAULT true,
    sort_order         integer NOT NULL,
    ui_label           text NOT NULL,
    created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.topup_pack_sizes IS 'Top-up pack sizes available for purchase. Adding/removing packs = INSERT/UPDATE here. Read at runtime by /billing/topup endpoint.';

ALTER TABLE public.topup_pack_sizes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS topup_pack_sizes_authenticated_read ON public.topup_pack_sizes;
CREATE POLICY topup_pack_sizes_authenticated_read
    ON public.topup_pack_sizes
    FOR SELECT
    TO authenticated
    USING (active = true);

DROP POLICY IF EXISTS topup_pack_sizes_service_role ON public.topup_pack_sizes;
CREATE POLICY topup_pack_sizes_service_role
    ON public.topup_pack_sizes
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

INSERT INTO public.topup_pack_sizes (pack_size_tokens, active, sort_order, ui_label)
VALUES
    (1000000,  true, 1, '1M tokens'),
    (5000000,  true, 2, '5M tokens'),
    (10000000, true, 3, '10M tokens'),
    (25000000, true, 4, '25M tokens'),
    (50000000, true, 5, '50M tokens')
ON CONFLICT (pack_size_tokens) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. background_loop_registry
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.background_loop_registry (
    schedule_key                  text PRIMARY KEY,
    description                   text NOT NULL,
    frequency_human               text NOT NULL,
    edge_function_name            text,
    backend_endpoint              text,
    tokens_estimate_per_user_run  integer NOT NULL CHECK (tokens_estimate_per_user_run >= 0),
    user_toggleable               boolean NOT NULL DEFAULT true,
    default_enabled               boolean NOT NULL DEFAULT true,
    excluded_tiers                text[] NOT NULL DEFAULT '{}',
    ui_label                      text NOT NULL,
    off_warning_text              text,
    off_consequence_summary       text,
    category                      text,
    created_at                    timestamptz NOT NULL DEFAULT now(),
    updated_at                    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.background_loop_registry IS 'Autonomous BIQc "thinking" loops. Each row controls UI toggle rendering + backend enforcement. Adding a new loop = INSERT here. excluded_tiers blocks specific tiers (e.g. cognitive_refresh excluded on lite).';
COMMENT ON COLUMN public.background_loop_registry.excluded_tiers IS 'Array of tier_ids where this loop is NOT available (e.g. ARRAY[''lite''] excludes Lite tier per D2 2026-05-05).';

ALTER TABLE public.background_loop_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS background_loop_registry_authenticated_read ON public.background_loop_registry;
CREATE POLICY background_loop_registry_authenticated_read
    ON public.background_loop_registry
    FOR SELECT
    TO authenticated
    USING (true);  -- catalogue is public-knowable

DROP POLICY IF EXISTS background_loop_registry_service_role ON public.background_loop_registry;
CREATE POLICY background_loop_registry_service_role
    ON public.background_loop_registry
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

INSERT INTO public.background_loop_registry
    (schedule_key, description, frequency_human, edge_function_name, tokens_estimate_per_user_run, user_toggleable, default_enabled, excluded_tiers, ui_label, off_warning_text, off_consequence_summary, category)
VALUES
    ('cognitive_refresh', 'OpenAI snapshot per active user — keeps dashboard insights warm.', 'every 4h', 'biqc-insights-cognitive', 12000, true, true, ARRAY['lite'],
     'Cognitive Insights Refresh',
     'Without Cognitive Insights Refresh, your dashboard insights won''t auto-update. You''ll only see what was captured at your last manual scan or page load. Disable anyway?',
     'Dashboard insights stop auto-updating; data freshness drops to manual scans only.',
     'intelligence'),
    ('watchtower_scan', 'OpenAI signal-detection scan per active user.', 'every 6h', 'watchtower-brain', 3000, true, true, ARRAY[]::text[],
     'Watchtower Signal Detection',
     'Without Watchtower signals, BIQc won''t proactively detect threats or opportunities in your industry. You''ll need to manually check your dashboard for changes. Disable anyway?',
     'Proactive threat/opportunity alerts stop. User must manually check for changes.',
     'intelligence'),
    ('market_scan', 'Perplexity + OpenAI market trend analysis per user.', 'daily 15:00 UTC', 'market-analysis-ai', 5000, true, true, ARRAY[]::text[],
     'Daily Market Analysis',
     'Without Daily Market Analysis, BIQc won''t surface industry trends or movements. Your Market panel will only update when you re-scan manually. Disable anyway?',
     'Market panel goes stale until manual re-scan.',
     'intelligence'),
    ('email_intelligence', 'gpt-4o-mini scoring across user inbox.', 'daily 20:00 UTC', 'email_priority', 1500, true, true, ARRAY[]::text[],
     'Inbox Priority Scoring',
     'Without Inbox Priority Scoring, BIQc won''t sort your inbox by urgency overnight. You''ll see emails in their original order. Disable anyway?',
     'Inbox loses overnight priority sort; emails shown in original order.',
     'communications'),
    ('competitor_monitor', 'Perplexity competitor search + OpenAI delta analysis.', 'weekly Mon 20:00 UTC', 'competitor-monitor', 2000, true, true, ARRAY[]::text[],
     'Competitor Monitor',
     'Without Competitor Monitor, BIQc won''t track changes at your listed competitors. The Competitor section will only update when you trigger it. Disable anyway?',
     'Competitor section stops auto-tracking; manual triggers only.',
     'intelligence'),
    ('cash_projection', 'OpenAI cashflow projection per user.', 'weekly Mon 21:00 UTC', 'cfo-cash-analysis', 3000, true, true, ARRAY[]::text[],
     'Cash Projection',
     'Without Cash Projection, BIQc won''t update your weekly cashflow forecast. The CFO panel will go stale. Disable anyway?',
     'CFO cashflow forecast stops weekly refresh.',
     'finance'),
    ('morning_brief', 'Daily summary email per active user (currently cached-only; LLM hookup pending).', 'daily 19:00 UTC (05:00 AEST)', NULL, 5000, true, true, ARRAY[]::text[],
     'Morning Brief Email',
     'Without Morning Brief, you''ll stop receiving the daily summary email at 5am AEST. Disable anyway?',
     'Daily 5am AEST email stops sending.',
     'communications')
ON CONFLICT (schedule_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. llm_providers
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.llm_providers (
    provider_id                          text PRIMARY KEY,
    display_name                         text NOT NULL,
    api_endpoint                         text NOT NULL,
    api_key_env                          text NOT NULL,
    pricing_aud_micros_per_1k_input      bigint NOT NULL CHECK (pricing_aud_micros_per_1k_input >= 0),
    pricing_aud_micros_per_1k_output     bigint NOT NULL CHECK (pricing_aud_micros_per_1k_output >= 0),
    pricing_aud_micros_per_1k_cached     bigint CHECK (pricing_aud_micros_per_1k_cached IS NULL OR pricing_aud_micros_per_1k_cached >= 0),
    active                               boolean NOT NULL DEFAULT true,
    effective_from                       timestamptz NOT NULL DEFAULT now(),
    effective_to                         timestamptz,
    notes                                text,
    created_at                           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.llm_providers IS 'LLM provider catalogue + default pricing (in AUD micros per 1k tokens). Adding a new provider (Mistral, xAI, Cohere, etc.) = INSERT row + drop a provider adapter file. Pricing here is a default; per-model overrides handled in metering.ts cost computation.';

ALTER TABLE public.llm_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS llm_providers_authenticated_read ON public.llm_providers;
CREATE POLICY llm_providers_authenticated_read
    ON public.llm_providers
    FOR SELECT
    TO authenticated
    USING (active = true);

DROP POLICY IF EXISTS llm_providers_service_role ON public.llm_providers;
CREATE POLICY llm_providers_service_role
    ON public.llm_providers
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Default rates approximate gpt-4o, claude-sonnet-4-5, gemini-2.5-flash, perplexity-sonar.
-- Per-model overrides live in supabase/functions/_shared/metering.ts pricing table.
-- AUD micros per 1k tokens — 1 AUD = 1,000,000 micros, so 3,750 micros = $0.00375 AUD per 1k tokens = $3.75 / 1M tokens.
INSERT INTO public.llm_providers (provider_id, display_name, api_endpoint, api_key_env, pricing_aud_micros_per_1k_input, pricing_aud_micros_per_1k_output, pricing_aud_micros_per_1k_cached, notes)
VALUES
    ('openai',     'OpenAI',     'https://api.openai.com/v1',                     'OPENAI_API_KEY',     3750,  15000, 1875, 'Default rates approximate gpt-4o; per-model overrides in metering.ts'),
    ('anthropic',  'Anthropic',  'https://api.anthropic.com/v1',                  'ANTHROPIC_API_KEY',  4500,  22500, NULL, 'Default rates approximate claude-sonnet-4-5'),
    ('google',     'Google',     'https://generativelanguage.googleapis.com/v1',  'GOOGLE_API_KEY',     112,   450,   NULL, 'Default rates approximate gemini-2.5-flash'),
    ('perplexity', 'Perplexity', 'https://api.perplexity.ai',                     'PERPLEXITY_API_KEY', 1500,  1500,  NULL, 'Default rates approximate sonar')
ON CONFLICT (provider_id) DO NOTHING;
