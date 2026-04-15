-- ═══════════════════════════════════════════════════════════════════════════
-- 099_business_dna_enrichment.sql
-- Persists the Website Deep Scan enrichment payload + derived digital_footprint
-- composite so Market & Position, BoardRoom, and CMO Report can render real
-- scores without re-scanning. Keyed on (user_id, business_profile_id) with
-- latest-scan-wins upsert semantics. Owner-scoped RLS only — no USING(true).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.business_dna_enrichment (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL,
    business_profile_id  UUID NOT NULL,
    website_url          TEXT,
    enrichment           JSONB NOT NULL DEFAULT '{}'::jsonb,
    digital_footprint    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, business_profile_id)
);

CREATE INDEX IF NOT EXISTS business_dna_enrichment_user_idx
    ON public.business_dna_enrichment (user_id);

ALTER TABLE public.business_dna_enrichment ENABLE ROW LEVEL SECURITY;

-- Owner-scoped read
DROP POLICY IF EXISTS bde_owner_select ON public.business_dna_enrichment;
CREATE POLICY bde_owner_select ON public.business_dna_enrichment
    FOR SELECT
    USING (user_id = auth.uid());

-- Owner-scoped write (INSERT / UPDATE / DELETE)
DROP POLICY IF EXISTS bde_owner_write ON public.business_dna_enrichment;
CREATE POLICY bde_owner_write ON public.business_dna_enrichment
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.business_dna_enrichment TO authenticated;
