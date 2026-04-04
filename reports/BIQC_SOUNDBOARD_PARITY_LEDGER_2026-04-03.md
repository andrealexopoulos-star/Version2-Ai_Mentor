# BIQc Soundboard Parity Ledger (Main + Side)

## Benchmark Target
- Parity target set: Claude/ChatGPT-grade assistant UX for SMB operators.
- Required qualities:
  - context continuity across sessions,
  - citation/confidence and coverage-window disclosure,
  - role-aware answer shaping (owner/operator/finance),
  - deterministic fallback for low-confidence states,
  - side-panel and full-page behavior parity.

## Current State
- Main Soundboard:
  - assistant framing and coverage window present (`partial`),
  - continuity behavior present but not fully quality-gated across all scenarios (`partial`),
  - deep-scroll answer blocks and contradiction checks not fully audited (`partial`).
- Side Soundboard panel:
  - not fully verified for parity with main page prompts, memory continuity, and fallback states (`fail`).

## Gap Ledger

| Item | Main | Side | Required Closure | Gate |
|---|---|---|---|---|
| Context carry-over quality | partial | fail | same context retention semantics in both surfaces | `SOUNDBOARD-CONTINUITY-01` |
| Coverage window visibility | partial | fail | show coverage/confidence in both surfaces | `SOUNDBOARD-COVERAGE-DISCLOSURE-01` |
| Role-based response policy | partial | fail | owner/operator/finance profile parity | `SOUNDBOARD-ROLE-POLICY-01` |
| Degraded fallback UX | partial | fail | graceful low-data path with next-best actions | `SOUNDBOARD-DEGRADED-PATH-01` |
| Actionability quality | partial | fail | answer -> concrete prioritized actions | `SOUNDBOARD-ACTIONABILITY-01` |

## Hard Gate Status
- FAIL · `SOUNDBOARD-MAIN-PARITY-01` · `MAIN_SURFACE_PARITY_NOT_FULLY_VERIFIED` · `reports/BIQC_SOUNDBOARD_PARITY_LEDGER_2026-04-03.md`
- FAIL · `SOUNDBOARD-SIDE-PARITY-01` · `SIDE_SURFACE_PARITY_OPEN` · `reports/BIQC_SOUNDBOARD_PARITY_LEDGER_2026-04-03.md`

## Closure Evidence Required
- Side-by-side UX behavior matrix (main vs side) with identical prompt set.
- Replay pack with at least:
  - normal data-rich path,
  - sparse data path,
  - contradictory evidence path,
  - connector stale path.
- SMB owner acceptance checklist with pass/fail per prompt family.
