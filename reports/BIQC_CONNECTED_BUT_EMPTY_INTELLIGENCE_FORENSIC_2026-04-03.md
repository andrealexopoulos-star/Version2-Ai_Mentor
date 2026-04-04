# BIQc Connected-But-Empty Intelligence Forensic

## Purpose
- Separate transport success (`200`) from intelligence-value success (dataful, actionable, trustworthy).
- Identify surfaces where connectors can be connected while rendered intelligence remains sparse, stale, or empty.

## Evidence Inputs
- `test_reports/platform_surface_200_audit_20260403_134917.json` (`218/218` transport pass)
- `reports/BIQC_PLATFORM_CLICK_SURFACE_STATUS_TABLES_2026-04-03.md`
- `reports/BIQC_PLATFORM_WIDE_CMO_SCENARIO_AUDIT_2026-04-03.md`
- `test_reports/full_platform_connector_verification_20260403_100353.json`

## Forensic Finding
- Platform currently proves endpoint availability and connector presence, but still has unresolved confidence/coverage completeness at card level.
- Existing explicit fail evidence:
  - FAIL · `CARD-AUDIT-CONFIDENCE-COVERAGE-01` · `DATA_PARTIAL_COVERAGE`
  - FAIL · `SCENARIO-CMO-PARITY-01` · `EXIT_PENDING_BLOCKS_OPEN`

## High-Risk Surfaces (Connected-But-Empty Potential)
- `/calendar` (`CalendarView`)
  - UI states include `No events`, `Degraded`, `Syncing`.
  - Data source rows return 200 but depth is constrained (`days_back=0`, `days_ahead=30`).
- `/forensic-audit` (`ForensicAuditPage`)
  - UI states include `NO DATA`; history endpoints return 200 transport.
  - Indicates pipeline can be reachable while history payload can still be empty.
- `/ops-advisory` (`OpsAdvisoryCentre`)
  - Includes `locked` and `loading` panels; recommendations endpoint returns 200.
  - Requires strict proof that lock/degrade states carry actionable fallback.
- `/email-inbox` (`EmailInbox`)
  - Priority endpoints pass transport; unresolved requirement is rich intelligence payload continuity across refresh/reclassify/reply actions.
- `/advisor` and `/soundboard`
  - Coverage disclosure exists in parts, but parity and deep confidence consistency remain open.

## Root-Cause Classes
- Lookback/window truncation (calendar/email historical depth).
- Coverage metadata not uniformly exposed at card-level surfaces.
- Connected status and intelligence status can diverge in UI semantics.
- Action endpoints pass without a quality gate validating semantic result richness.

## Required Closure Signals (Mandatory)
- Every connected module must emit:
  - `data_status`: `ready|partial|empty|stale`
  - `coverage_window`: start/end + freshness age
  - `confidence_score` and `confidence_reason`
  - `next_best_action` when partial/empty
- UI must display the above on first screen and detail view.

## Hard Gate Status
- FAIL · `CONNECTED-BUT-EMPTY-INTELLIGENCE-01` · `PIPELINE_CONNECTED_BUT_NO_PROCESSED_PAYLOAD` · `reports/BIQC_CONNECTED_BUT_EMPTY_INTELLIGENCE_FORENSIC_2026-04-03.md`
- FAIL · `PAYLOAD-EVIDENCE-CONFIDENCE-REASONING-01` · `CARD_LEVEL_SEMANTIC_DISCLOSURE_INCOMPLETE` · `reports/BIQC_CONNECTED_BUT_EMPTY_INTELLIGENCE_FORENSIC_2026-04-03.md`

## Exit Criteria
- Gate passes only when all connector-backed major surfaces render non-empty intelligence or explicit high-trust degraded guidance with next actions.
