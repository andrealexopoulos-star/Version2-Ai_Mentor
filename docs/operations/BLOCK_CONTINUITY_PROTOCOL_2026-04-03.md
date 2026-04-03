# Block Continuity Protocol

Date: 2026-04-03  
Purpose: ensure scope blocks and gate outcomes are never lost during tier hardening.

## Canonical Sources
1. **Checkpoint Ledger (authoritative):**
   - `docs/operations/SCOPE_EXECUTION_CHECKPOINTS.md`
2. **Release Evidence Artifacts:**
   - `test_reports/*.json`
3. **Roadmap Carry-Forward Narrative:**
   - `reports/BIQC_IMPLEMENTATION_ROADMAP_2026-04-03.md`

## Update Contract (Required On Every Block Change)
1. Append one line in checkpoint format:
   - `PASS|FAIL · gate_id · failure_code · artifact`
2. If `FAIL`, include explicit failure code and artifact path.
3. If `PASS` supersedes a prior `FAIL`, append a new `PASS` line (do not delete history).
4. Update roadmap carry-forward section with open blockers and owner.

## In-Product Placeholder
- Admin surface: `/admin/scope-checkpoints`
- API source: `/api/admin/scope-checkpoints`
- Function: expose latest gate status by `gate_id`, open failure count, and artifact pointers.

## Tier Hardening Integration Rule
- No tier menu/policy release is complete unless these artifacts are present:
  - revised tier matrix artifact
  - supplier telemetry artifact
  - checkpoint ledger delta entries for all touched gates
  - parity validation outcome for frontend/backend tier policy.
