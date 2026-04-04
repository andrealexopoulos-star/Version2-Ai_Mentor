# BIQc Lookback Depth Matrix (Current vs Target)

## Objective
- Freeze explicit current lookback depth per connector/surface.
- Set mandatory target depths for phase closure:
  - Phase 1: `365` days
  - Phase 2: `730` days

## Current-State Findings (Code Trace)

| Domain | Current Depth Signal | Evidence | Target | Status |
|---|---|---|---|---|
| Outlook calendar intelligence | `days_back=0`, `days_ahead=30` | `backend/routes/email.py` (`get_calendar_events`) | 365 -> 730 | fail |
| Calibration intelligence windows | `lookback_months=12` | `backend/routes/calibration.py` | 365 -> 730 | partial |
| CRM retrieval (merge) | cursor/page-based; no explicit day ceiling contract | `backend/routes/integrations.py` | explicit depth contract + backfill controls | fail |
| Accounting retrieval (merge) | cursor/page-based; no explicit day ceiling contract | `backend/routes/integrations.py` | explicit depth contract + backfill controls | fail |
| Unified intelligence coverage | exposes `coverage_window` and cursor continuation metadata | `backend/routes/unified_intelligence.py` | enforce depth SLO and missing-window remediation | partial |
| Soundboard cognition coverage | computes merged `coverage_window`, flags `missing_periods` | `backend/routes/soundboard.py` | guarantee depth floors by tier and connector | partial |

## Required Contract Additions
- Connector lookback fields must be explicit in API response:
  - `lookback_days_effective`
  - `lookback_days_target`
  - `coverage_start`
  - `coverage_end`
  - `missing_periods`
  - `backfill_state` (`none|queued|running|completed|failed`)
- UI cards must render depth and coverage confidence for owner trust.
- Tier contract must disclose depth constraints and upgrade effects.

## Hard Gates
- FAIL · `LOOKBACK-DEPTH-365-01` · `LOOKBACK_DEPTH_CONTRACT_NOT_ENFORCED` · `reports/BIQC_LOOKBACK_DEPTH_MATRIX_2026-04-03.md`
- FAIL · `LOOKBACK-DEPTH-730-01` · `PHASE2_DEPTH_BACKFILL_NOT_IMPLEMENTED` · `reports/BIQC_LOOKBACK_DEPTH_MATRIX_2026-04-03.md`

## Immediate Execution Steps
- Add explicit depth contract payload fields in connector and cognition endpoints.
- Add scheduled backfill jobs for email/calendar/crm/accounting historical windows.
- Add card-level depth badges and stale-window warnings on all major intelligence surfaces.
