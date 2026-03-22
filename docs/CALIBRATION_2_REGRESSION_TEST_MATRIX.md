# Calibration 2.0 Regression Test Matrix

## Test Policy

- No phase progresses without full pass on that phase gate.
- No deployment with failing critical tests.
- All tests must reference requirement IDs and changed file paths.

## Requirement IDs

- `CAL-ROUTE-001` Completion authority and routing integrity
- `CAL-FLOW-002` Canonical state machine integrity
- `CAL-WOW-003` Wow/Aha evidence integrity
- `CAL-DATA-004` Storage and provenance integrity
- `CAL-REPORT-005` Reports quota + artifact integrity
- `INBOX-DATA-006` Priority Inbox source-of-truth consistency
- `INBOX-UX-007` Priority Inbox action/explainability quality
- `CALENDAR-CRUD-008` Calendar CRUD and date semantics
- `MOTION-009` Journey animation continuity + reduced-motion compliance

## A. Golden Path Journey Tests

1. Signup -> login -> calibration -> market success path  
   - validates no dead end and correct final destination
   - IDs: `CAL-ROUTE-001`, `CAL-FLOW-002`

2. Calibration resume from each checkpoint  
   - welcome, identity, wow, psych, integration, snapshot
   - ensures resume to last valid checkpoint only
   - IDs: `CAL-ROUTE-001`, `CAL-FLOW-002`

3. Completion write authority validation  
   - checks `/api/calibration/status` output after completion
   - checks `strategic_console_state` + fallback parity
   - IDs: `CAL-ROUTE-001`

## B. Manual Input Path Tests

1. Manual-only onboarding produces wow/aha cards with evidence
2. Confidence ladder asks clarifiers when low confidence
3. Manual path stores structured provenance payload
4. Manual path reaches completion with no null-state dead screen

IDs: `CAL-FLOW-002`, `CAL-WOW-003`, `CAL-DATA-004`

## C. Data Integrity Tests (Calibration)

1. Business profile fields mapped into Business DNA/Market/Product/Team/Strategy
2. `dna_trace`, `source_map`, `confidence_map`, `timestamp_map` populated when required
3. operator calibration journey metadata persisted correctly
4. no silent field drops on `PUT /api/business-profile`

IDs: `CAL-DATA-004`

## D. Reports and Quota Tests

1. Free tier allows 1 Deep CMO report per rolling 30 days
2. $349 tier allows 3 Deep CMO reports per rolling 30 days
3. quota exceeded shows deterministic gated behavior
4. PDF artifact generated, stored, downloadable from reports
5. report naming and tab gating behavior match spec

IDs: `CAL-REPORT-005`

## E. Priority Inbox Tests

1. provider parity read path (Outlook and Gmail where available)
2. ranking payload consistency (`reason`, `confidence`, `evidence`, freshness)
3. thread grouping and action rail persistence
4. quick actions and reply flows do not break provider-specific IDs
5. no stale split-brain overwrite between data paths

IDs: `INBOX-DATA-006`, `INBOX-UX-007`

## F. Calendar Tests

1. upcoming filter semantics match UI labels
2. date edit roundtrip is timezone-safe
3. create/read/update/delete matrix pass (approved scope)
4. token refresh preserves scopes required for CRUD
5. advisor draft event handoff remains valid

IDs: `CALENDAR-CRUD-008`

## G. Motion and UX Continuity Tests

1. route transition continuity: signup -> calibration -> market
2. no hard visual drop at completion transition
3. reduced-motion compliance across all motion-rich views
4. animation performance budget within agreed thresholds

IDs: `MOTION-009`

## H. Visual Regression Suite

Snapshot targets:

- Auth pages (register, login, callback)
- Calibration states: loading, ignition, welcome, analyzing, identity, wow, psych, integration, snapshot, reveal
- Market initial load and first interactive state
- Priority inbox list/detail/action states
- Calendar list/edit/create states
- Reports tabs and quota locked states

## I. Telemetry Validation

Critical event checks:

- `calibration_started`
- `scan_started`
- `scan_first_result_ms`
- `identity_confirmed`
- `wow_card_viewed_{type}`
- `aha_plan_generated`
- `psych_started`
- `psych_completed`
- `integration_step_entered`
- `calibration_completed`
- `time_to_activation_ms`

Validation:
- event fired once per expected action
- correct user/session correlation
- no missing critical events in golden path

