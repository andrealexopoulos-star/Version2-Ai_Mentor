-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION 125: provider_quotas — cross-provider quota / credit
-- exhaustion monitoring (companion to migration 118 provider_usage)
-- ═══════════════════════════════════════════════════════════════════
-- Context (2026-04-22): Firecrawl silently hit 0 credits on the Hobby
-- plan (used 3,952 / 3,000) and nothing surfaced in BIQc — scraping
-- just started failing with per-call errors. This migration adds a
-- dedicated quota-exhaustion table that is populated by a daily worker
-- (backend/jobs/provider_quota_check.py) and drives a new "Quota"
-- column on the Super-Admin Providers dashboard.
--
-- Relationship to migration 118 (provider_usage):
--   • provider_usage: running tally (call_count, total_cost_aud) rolled
--     up from usage_ledger per call.
--   • provider_quotas: plan-allocation headroom, fetched on a daily
--     schedule from each provider's billing/usage API when one exists.
--
-- These are intentionally separate tables because the signals are
-- orthogonal — we can be spending plenty (provider_usage) and still
-- be 98 % exhausted on the plan (provider_quotas), which is exactly
-- the Firecrawl failure mode.
--
-- Scope locked 2026-04-22 by Andreas: one row per provider, seeded
-- with NULLs so the dashboard row exists from day 1. Provider adapters
-- are best-effort — if a provider has no public usage API, the row
-- stays NULL and the worker logs and moves on.

-- ─── Table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.provider_quotas (
    provider           text         PRIMARY KEY,
    plan_name          text         NULL,              -- 'Hobby' | 'Team' | 'Starter' | 'Pro' | …
    quota_period       text         NULL,              -- 'monthly' | 'billing_period' | …
    quota_total        bigint       NULL,              -- e.g. 3000 for Firecrawl Hobby
    quota_used         bigint       NULL,              -- e.g. 3952 (yes, can exceed total)
    -- Computed columns so every consumer agrees on the math. NULL-safe:
    -- when either side is unknown, the computed value is also NULL and
    -- the dashboard shows "—" for that row.
    quota_remaining    bigint       GENERATED ALWAYS AS (
        CASE WHEN quota_total IS NULL OR quota_used IS NULL
             THEN NULL
             ELSE quota_total - quota_used
        END
    ) STORED,
    pct_used           numeric      GENERATED ALWAYS AS (
        CASE
            WHEN quota_total IS NULL OR quota_used IS NULL THEN NULL
            WHEN quota_total = 0 THEN NULL  -- avoid division by zero
            ELSE ROUND((quota_used::numeric / quota_total::numeric) * 100.0, 2)
        END
    ) STORED,
    last_checked_at    timestamptz  NULL,
    last_check_error   text         NULL,              -- set when the health check fails
    notes              text         NULL,              -- e.g. 'billed card ending 9198'
    updated_at         timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.provider_quotas IS
    'Plan-level quota / credit headroom per external provider. Populated '
    'daily by backend/jobs/provider_quota_check.py. Drives the super-admin '
    '"Quota" column on the Providers dashboard. Migration 125 / 2026-04-22 '
    'after the Firecrawl silent-exhaustion incident.';
COMMENT ON COLUMN public.provider_quotas.quota_remaining IS
    'Generated: quota_total - quota_used. Negative when the account is over-cap '
    '(Firecrawl 2026-04-22: 3000 - 3952 = -952).';
COMMENT ON COLUMN public.provider_quotas.pct_used IS
    'Generated: (quota_used / quota_total) * 100. The super-admin UI colours '
    'this bar: <50 green, 50-80 yellow, >=80 red. Warning alert fires at 80, '
    'critical at 100.';
COMMENT ON COLUMN public.provider_quotas.last_check_error IS
    'Most recent error string from the provider quota API — NULL on a '
    'successful poll. Cleared on next successful poll.';

-- ─── Indexes ────────────────────────────────────────────────────────

-- "Hottest providers first" — the super-admin dashboard orders by pct_used
-- DESC so the near-exhausted providers float to the top of the page.
CREATE INDEX IF NOT EXISTS idx_provider_quotas_pct_used
    ON public.provider_quotas (pct_used DESC NULLS LAST);

-- Fast "who haven't we checked in 24 h" query for the worker self-audit.
CREATE INDEX IF NOT EXISTS idx_provider_quotas_last_checked
    ON public.provider_quotas (last_checked_at ASC NULLS FIRST);

-- ─── RLS ───────────────────────────────────────────────────────────

ALTER TABLE public.provider_quotas ENABLE ROW LEVEL SECURITY;

-- service_role: full access (worker writes, admin endpoints read)
DROP POLICY IF EXISTS "service_role_full_provider_quotas" ON public.provider_quotas;
CREATE POLICY "service_role_full_provider_quotas"
    ON public.provider_quotas FOR ALL
    USING ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role')
    WITH CHECK ((current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role');

-- authenticated: SELECT only. The super-admin gate is enforced in the
-- backend route (consistent with how migration 118 handles provider_usage).
-- Regular users don't see plan totals because the route returns 403 before
-- this policy ever matters, but the policy keeps the door locked if a
-- future route forgets the gate.
DROP POLICY IF EXISTS "authenticated_read_provider_quotas" ON public.provider_quotas;
CREATE POLICY "authenticated_read_provider_quotas"
    ON public.provider_quotas FOR SELECT
    TO authenticated
    USING (true);

GRANT SELECT ON public.provider_quotas TO authenticated;
GRANT ALL    ON public.provider_quotas TO service_role;

-- ─── Seed: one row per provider BIQc uses ───────────────────────────
-- Mirrors the seed list in migration 118 so every provider has a quota
-- row from day 1, even before the worker has run. All facts NULL until
-- the worker fills them in (or leaves them NULL for providers without a
-- public usage API — that's a known-good state, not a missing-data bug).

INSERT INTO public.provider_quotas (provider, notes) VALUES
    ('firecrawl',  'Adapter live — GET /v1/team/credit-usage. Hobby plan = 3000 credits/month as of 2026-04-22.'),
    ('perplexity', 'No public usage endpoint as of 2026-04-22 — adapter stubs and logs response body for future tuning.'),
    ('anthropic',  'No public usage endpoint. Track via provider_usage (LLM rollup) instead.'),
    ('openai',     'Requires OPENAI_ADMIN_KEY (admin key, not app key) for /v1/usage. Adapter skips when absent.'),
    ('supabase',   'No public quota endpoint. Project tier caps managed in Supabase dashboard.'),
    ('browse_ai',  'Task-runs-per-month quota lives in Browse AI dashboard; no public usage API surfaced in adapter yet.'),
    ('semrush',    'API units-per-month quota lives in SEMrush dashboard; no public usage API surfaced in adapter yet.'),
    ('serper',     'Credits-per-month quota lives in serper.dev dashboard; no public usage API surfaced in adapter yet.')
ON CONFLICT (provider) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- POST-DEPLOY VERIFICATION SQL (run via MCP execute_sql after apply)
-- ═══════════════════════════════════════════════════════════════════
-- 1. Table exists + RLS on:
--      SELECT relname, relrowsecurity FROM pg_class
--      WHERE relname = 'provider_quotas';
--    Expected: one row, relrowsecurity = true
--
-- 2. All eight seed rows present:
--      SELECT provider, plan_name, quota_total, quota_used, pct_used,
--             last_checked_at, last_check_error
--      FROM public.provider_quotas
--      ORDER BY provider;
--    Expected: 8 rows (anthropic, browse_ai, firecrawl, openai,
--    perplexity, semrush, serper, supabase). All numeric fields NULL
--    until the worker runs.
--
-- 3. Generated columns behave correctly (manual test — run then
--    UPDATE back to NULL so seed state is preserved):
--      UPDATE public.provider_quotas
--         SET quota_total = 3000, quota_used = 3952
--       WHERE provider = 'firecrawl';
--      SELECT provider, quota_total, quota_used, quota_remaining, pct_used
--        FROM public.provider_quotas WHERE provider = 'firecrawl';
--    Expected: quota_remaining = -952, pct_used = 131.73
--      UPDATE public.provider_quotas
--         SET quota_total = NULL, quota_used = NULL
--       WHERE provider = 'firecrawl';
--
-- 4. Index present:
--      SELECT indexname FROM pg_indexes
--       WHERE tablename = 'provider_quotas'
--       ORDER BY indexname;
--    Expected: idx_provider_quotas_last_checked,
--              idx_provider_quotas_pct_used,
--              provider_quotas_pkey
--
-- 5. RLS policies:
--      SELECT polname FROM pg_policy
--       WHERE polrelid = 'public.provider_quotas'::regclass
--       ORDER BY polname;
--    Expected: authenticated_read_provider_quotas,
--              service_role_full_provider_quotas
--
-- 6. Anonymous role is BLOCKED:
--      SET LOCAL ROLE anon;
--      SELECT count(*) FROM public.provider_quotas;
--      RESET ROLE;
--    Expected: permission denied / 0 rows (depending on PostgREST setup)
