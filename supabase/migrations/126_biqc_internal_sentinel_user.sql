-- Migration 126: BIQc internal-system sentinel user for metering attribution.
--
-- WHY: Several edge functions (calibration-business-dna, market-analysis-ai,
-- social-enrichment, intelligence-snapshot, strategic-console-ai, competitor-
-- monitor, biqc-insights-cognitive) call recordUsageSonar / recordUsage with
-- an empty or non-UUID userId when triggered by service-role / cron paths
-- that have no authenticated user. Until now those rows were either silently
-- dropped (empty string no-op) or attempted with the literal placeholder
-- "service-role-scan" — which fails usage_ledger's uuid + FK contract.
--
-- Fix: designate a canary UUID as the BIQc-internal sentinel user, insert it
-- here, and have `_shared/metering.ts` substitute it (plus tag
-- `metadata.attribution = 'internal_system'`) whenever the incoming userId
-- is blank or fails UUID validation.
--
-- Track: Retention Master Plan — Sprint 2 "Value Loop" / metering trust.
-- Date: 2026-04-22.

-- ─── 1. Insert the sentinel user row (idempotent) ─────────────────────────
-- public.users has no FK to auth.users in the current schema (see migration
-- 040), so a public-only row is sufficient for the FK from usage_ledger.
INSERT INTO public.users (id, email, full_name, role, is_master_account, is_disabled)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'internal-system@biqc.internal',
    'BIQc Internal System',
    'system',
    false,
    true  -- is_disabled=true so this row can never log in / own data
)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Backfill existing usage_ledger rows with bad user_id ──────────────
-- Any row whose user_id is not a valid RFC-4122 UUID v1-5 gets re-attributed
-- to the sentinel + tagged `metadata.attribution = 'internal_system'` with
-- the original value preserved under `metadata.original_user_id`.
--
-- Note: user_id is declared uuid NOT NULL, so Postgres would have rejected
-- literal-string-with-no-dashes inserts at write time. This UPDATE therefore
-- only affects rows where user_id is a valid UUID but NOT present in
-- public.users (FK violators — shouldn't exist given the NOT NULL REFERENCES,
-- but we run the update anyway as a trust exercise).
DO $$
DECLARE
    updated_count int;
BEGIN
    UPDATE public.usage_ledger ul
    SET metadata = COALESCE(ul.metadata, '{}'::jsonb)
                   || jsonb_build_object(
                        'attribution', 'internal_system',
                        'original_user_id', ul.user_id::text,
                        'backfilled_at', now()::text
                      ),
        user_id = '00000000-0000-0000-0000-000000000001'::uuid
    WHERE NOT EXISTS (
        SELECT 1 FROM public.users u WHERE u.id = ul.user_id
    );
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '[126_biqc_internal_sentinel_user] usage_ledger backfill: % rows re-attributed to sentinel', updated_count;
END;
$$;

-- ─── 3. Index to keep sentinel queries fast ───────────────────────────────
-- Reconciliation queries on internal-system cost will filter on this.
CREATE INDEX IF NOT EXISTS idx_usage_ledger_internal_system
    ON public.usage_ledger (created_at DESC)
    WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- ─── 4. Comment for downstream operators ──────────────────────────────────
COMMENT ON COLUMN public.usage_ledger.user_id IS
    'User that incurred this LLM cost. Service-role / cron paths with no '
    'authenticated user attribute to the sentinel '
    '00000000-0000-0000-0000-000000000001 and stamp '
    'metadata.attribution=''internal_system''. See migration 126.';
