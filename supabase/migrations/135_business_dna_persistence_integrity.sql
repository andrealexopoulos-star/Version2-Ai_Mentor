-- ═══════════════════════════════════════════════════════════════════════════
-- 135_business_dna_persistence_integrity.sql
--
-- P0 Marjo Critical Incident — E5 mission.
-- Cites: BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2,
--        feedback_zero_401_tolerance, ops_daily_calibration_check.
--
-- Adds DB-level integrity for the URL-scan write path:
--
--   1.  CHECK constraint `business_dna_required_fields` on
--       `business_dna_enrichment` enforcing the 3 required JSONB fields:
--          enrichment->>'business_name'   non-empty
--          enrichment->>'industry'        non-empty
--          (enrichment->'core_signals' is JSONB array len >= 1)
--          OR enrichment->>'truth_state' = 'INSUFFICIENT_SIGNAL'
--
--       Added with NOT VALID so the existing single tainted row
--       (audited 2026-05-04 — has empty industry, no core_signals,
--        ai_errors populated) does NOT block this migration. New writes
--       and any subsequent UPDATE on the bad row WILL be enforced. The
--       application chokepoint
--       (backend/core/business_dna_persistence.py) is the primary line of
--       defence; this CHECK is defence-in-depth.
--
--   2.  New table `business_dna_persistence_incidents` for backend
--       audit of any scan that violates the persistence contract
--       (ai_errors present, required fields missing, upsert exception).
--       The daily-check SQL stub queries this table.
--
-- Roll-forward only. No DROP. Idempotent (IF NOT EXISTS / DO blocks).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. CHECK constraint on business_dna_enrichment ──────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM   pg_constraint
        WHERE  conname = 'business_dna_required_fields'
          AND  conrelid = 'public.business_dna_enrichment'::regclass
    ) THEN
        ALTER TABLE public.business_dna_enrichment
            ADD CONSTRAINT business_dna_required_fields
            CHECK (
                -- business_name must be a non-empty string
                COALESCE( NULLIF(TRIM(BOTH FROM (enrichment->>'business_name')), ''), '') <> ''
                AND
                -- industry must be a non-empty string
                COALESCE( NULLIF(TRIM(BOTH FROM (enrichment->>'industry')), ''), '') <> ''
                AND
                (
                    -- core_signals JSONB array with at least one element
                    (
                        jsonb_typeof(enrichment->'core_signals') = 'array'
                        AND jsonb_array_length(enrichment->'core_signals') >= 1
                    )
                    OR
                    -- explicit "we tried and got nothing" escape valve
                    -- (Contract v2 §4: empty != success; INSUFFICIENT_SIGNAL is
                    --  the contract-shaped acknowledgement of that state)
                    UPPER(COALESCE(enrichment->>'truth_state', '')) = 'INSUFFICIENT_SIGNAL'
                )
            )
            NOT VALID;
    END IF;
END
$$;

COMMENT ON CONSTRAINT business_dna_required_fields ON public.business_dna_enrichment IS
'P0 Marjo (E5, 2026-05-04). Every persisted row MUST carry business_name + industry + core_signals (>=1) OR explicit truth_state=INSUFFICIENT_SIGNAL. NOT VALID so historical rows do not block; new writes + updates on existing rows enforced.';


-- ─── 2. business_dna_persistence_incidents ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.business_dna_persistence_incidents (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL,
    business_profile_id  UUID NULL,
    incident_type        TEXT NOT NULL,
    detail               JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bdp_incidents_user_idx
    ON public.business_dna_persistence_incidents (user_id);
CREATE INDEX IF NOT EXISTS bdp_incidents_type_idx
    ON public.business_dna_persistence_incidents (incident_type);
CREATE INDEX IF NOT EXISTS bdp_incidents_created_idx
    ON public.business_dna_persistence_incidents (created_at DESC);

ALTER TABLE public.business_dna_persistence_incidents ENABLE ROW LEVEL SECURITY;

-- Owner-scoped read for the user themselves (never customer-visible UI today,
-- but if/when surfaced through a "diagnostics" route the owner sees only
-- their own incidents).
DROP POLICY IF EXISTS bdp_incidents_owner_select ON public.business_dna_persistence_incidents;
CREATE POLICY bdp_incidents_owner_select ON public.business_dna_persistence_incidents
    FOR SELECT
    USING (user_id = auth.uid());

-- Service-role writes only — backend chokepoint inserts; nothing else may.
-- (No INSERT policy for `authenticated` role → effectively service-role-only
--  given RLS is enabled.)

GRANT SELECT ON public.business_dna_persistence_incidents TO authenticated;

COMMENT ON TABLE public.business_dna_persistence_incidents IS
'P0 Marjo (E5, 2026-05-04). Backend audit log of every business_dna persistence-contract violation (ai_errors_present_at_persistence | required_fields_missing | upsert_exception). Written by backend/core/business_dna_persistence.py. Daily-check SQL alerts on count > 0 in last 24h. Detail JSONB carries supplier-name-free redacted info — Contract v2 §3 (backend is the boundary).';
