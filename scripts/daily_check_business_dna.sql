-- ═══════════════════════════════════════════════════════════════════════════
-- daily_check_business_dna.sql
--
-- P0 Marjo Critical Incident — E5 mission, 2026-05-04.
-- Cites: ops_daily_calibration_check.md, BIQc_PLATFORM_CONTRACT_SECURE_NO_SILENT_FAILURE_v2.
--
-- Runs on the same 5am + 5pm AEST tick as the existing infra + calibration
-- daily checks. Surfaces any persistence-contract violation in the last
-- 24 hours so the operator gets P0 visibility instead of finding out
-- when a customer reports broken intelligence.
--
-- USAGE:
--   - Manual: paste into Supabase SQL editor
--   - MCP:    mcp__a66b5ae2-74da-4b0e-b8bb-92e90944c22b__execute_sql
--               { project_id: "vwwandhoydemcybltoxz",
--                 query:      "<contents of this file>" }
--   - Future: GH Actions workflow daily_check_business_dna.yml
--
-- PASS CONDITIONS (all four):
--   §1  rows_with_ai_errors_24h               = 0
--   §2  rows_missing_required_24h             = 0
--   §3  incident_count_24h                    = 0
--   §4  rows_violating_check_constraint       = 0
--      (any value > 0 = P0; surface root-cause + hotfix)
-- ═══════════════════════════════════════════════════════════════════════════

-- §1 — Any rows persisted in the last 24h still carrying ai_errors? Should
--      be zero post-PR — the chokepoint strips them. Any non-zero count
--      means a write bypassed the chokepoint.
SELECT
    '§1 ai_errors_present_in_persisted_rows_24h' AS check_name,
    COUNT(*)                                     AS violations,
    COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(enrichment->'ai_errors', '[]'::jsonb)) > 0) AS rows_with_nonempty_ai_errors
FROM   public.business_dna_enrichment
WHERE  updated_at > NOW() - INTERVAL '24 hours';

-- §2 — Rows in the last 24h that violate the required-fields contract.
--      Mirrors the CHECK constraint logic in migration 135 so daily check
--      catches drift even if the constraint were ever dropped.
SELECT
    '§2 required_fields_missing_24h' AS check_name,
    COUNT(*)                          AS violations,
    COUNT(*) FILTER (WHERE COALESCE(NULLIF(TRIM(BOTH FROM (enrichment->>'business_name')), ''), '') = '') AS missing_business_name,
    COUNT(*) FILTER (WHERE COALESCE(NULLIF(TRIM(BOTH FROM (enrichment->>'industry')), ''), '')      = '') AS missing_industry,
    COUNT(*) FILTER (
        WHERE NOT (
            ( jsonb_typeof(enrichment->'core_signals') = 'array'
              AND jsonb_array_length(enrichment->'core_signals') >= 1 )
         OR UPPER(COALESCE(enrichment->>'truth_state', '')) = 'INSUFFICIENT_SIGNAL'
        )
    ) AS missing_core_signals_no_insufficient_flag
FROM   public.business_dna_enrichment
WHERE  updated_at > NOW() - INTERVAL '24 hours';

-- §3 — Incident rows written by the backend chokepoint in the last 24h.
--      Each incident row corresponds to a contract violation that the
--      chokepoint repaired; investigate the root cause regardless.
SELECT
    '§3 incident_rows_24h'    AS check_name,
    COUNT(*)                   AS incident_count,
    COUNT(*) FILTER (WHERE incident_type = 'ai_errors_present_at_persistence') AS ai_errors_incidents,
    COUNT(*) FILTER (WHERE incident_type = 'required_fields_missing')          AS missing_field_incidents,
    COUNT(*) FILTER (WHERE incident_type = 'upsert_exception')                  AS upsert_exception_incidents
FROM   public.business_dna_persistence_incidents
WHERE  created_at > NOW() - INTERVAL '24 hours';

-- §4 — Validate the CHECK constraint against current rows. Returns rows
--      that would VIOLATE the constraint if it were enforced. Migration 135
--      added it as NOT VALID so historical bad rows do not block; this
--      query surfaces remaining violations the operator can manually
--      remediate or accept as known-bad.
SELECT
    '§4 rows_violating_check_constraint' AS check_name,
    COUNT(*)                              AS violations
FROM   public.business_dna_enrichment
WHERE  NOT (
        COALESCE(NULLIF(TRIM(BOTH FROM (enrichment->>'business_name')), ''), '') <> ''
    AND COALESCE(NULLIF(TRIM(BOTH FROM (enrichment->>'industry')), ''),      '') <> ''
    AND (
            ( jsonb_typeof(enrichment->'core_signals') = 'array'
              AND jsonb_array_length(enrichment->'core_signals') >= 1 )
         OR UPPER(COALESCE(enrichment->>'truth_state', '')) = 'INSUFFICIENT_SIGNAL'
        )
);

-- §5 — Listing of last 5 incidents so the operator can triage without a
--      second round-trip. Includes the redacted detail (no supplier names
--      in detail per Contract v2 — the chokepoint redacts before write).
SELECT
    created_at,
    incident_type,
    user_id,
    business_profile_id,
    detail
FROM   public.business_dna_persistence_incidents
ORDER  BY created_at DESC
LIMIT  5;
