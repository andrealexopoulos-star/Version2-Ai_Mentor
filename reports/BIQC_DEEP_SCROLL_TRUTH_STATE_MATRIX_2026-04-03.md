# BIQc Deep-Scroll Truth-State Matrix

## Objective
- Audit below-fold and secondary surfaces (subcards, drawers, detail columns, command grids) for truth-consistent rendering.
- Ensure no mismatch between top-level status badges and deep-detail states.

## Deep-Scroll Surfaces In Scope
- `/advisor`: action panels, delegate options, connected sources strip, watchtower detail actions.
- `/soundboard`: conversation history, citations/coverage disclosure, scenario expansion blocks.
- `/email-inbox`: folder grid, detail panel, guidance card, reclassify and reply result areas.
- `/calendar`: advisor draft card, intelligence summary, create-event action feedback.
- `/competitive-benchmark`: provenance drawer and confidence evidence sections.
- `/compliance`: contradictions list, single-point-of-failure section, obligations column.
- `/ops-advisory`: locked panel, recommendation details, usage info sections.

## Current Findings
- Transport-level probes confirm endpoint reachability, but do not confirm deep-detail semantic fidelity.
- Existing report evidence confirms open confidence/coverage mismatch risk:
  - FAIL · `CARD-AUDIT-CONFIDENCE-COVERAGE-01` · `DATA_PARTIAL_COVERAGE`
- Several pages expose explicit empty/locked/degraded states which require mandatory next-step guidance quality checks.

## Truth-State Requirements (Per Deep Surface)
- `status_consistency`: top badge and detail section agree (`pass/fail`).
- `evidence_visibility`: detail section shows source + freshness + confidence.
- `actionability`: degraded/empty states include prioritized next action.
- `no_contradiction`: no simultaneous "healthy" and "no data" messaging within the same module state.

## Hard Gate Status
- FAIL · `UI-SURFACE-DEEP-SCROLL-RENDER-01` · `DEEP_SCROLL_SEMANTIC_VALIDATION_NOT_COMPLETE` · `reports/BIQC_DEEP_SCROLL_TRUTH_STATE_MATRIX_2026-04-03.md`
- FAIL · `UI-NO-CONTRADICTORY-CARD-STATES-01` · `TOP_VS_DETAIL_STATE_CONSISTENCY_NOT_PROVEN` · `reports/BIQC_DEEP_SCROLL_TRUTH_STATE_MATRIX_2026-04-03.md`

## Required Evidence To Close
- Per-page deep-scroll replay captures (first fold + below fold).
- State-transition matrix for each key page: `loading -> partial/ready -> degraded -> recovered`.
- Card/detail contradiction scan artifact with zero unresolved contradictions.
