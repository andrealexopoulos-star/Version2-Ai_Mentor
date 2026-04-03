# BIQc Platform-Wide CMO Scenario Audit (Execution Block)

Date: 2026-04-03  
Scenario account target: `andre@thestrategysquad.com.au`  
Scope: platform-wide pass/fail audit for models, pages, cards/modules, integrations, edge-function responses, and SQL/account validation.

## What Was Performed

1. Ran `scripts/zd_zr_za_manager.py` to generate full route/backend/edge inventory and governance baseline artifact.
2. Ran `scripts/block7_live_200_verification.py` to execute live endpoint probe coverage across the deployed API surface.
3. Ran `scripts/run_release_evidence_refresh.py` to evaluate strict evidence-chain readiness across core gates.
4. Performed static model configuration and page/card coverage extraction from source to complete model/page/card audit dimensions.
5. Attempted live account + connector verification for `andre@thestrategysquad.com.au` via Supabase service-role env check.

## How It Was Performed

- Evidence-first execution using existing audited scripts rather than ad hoc checks.
- Output anchored to generated artifacts in `test_reports/`.
- Supplemented with deterministic source inspection for:
  - configured model keys
  - total route inventory coverage
  - unified card rollout coverage footprint.

## Why This Method

- Keeps continuity with the existing CFO/gate evidence framework.
- Produces machine-readable evidence where live credentials allow.
- Makes blockers explicit when live account/session credentials are not available in current runtime.

## Key Evidence Observed

- ZD/ZR/ZA artifact:
  - `test_reports/zd_zr_za_manager_20260403_084336.json`
  - summary highlights:
    - `frontend_routes = 116`
    - `backend_endpoints = 354`
    - `edge_functions = 32`
    - `likely_visible_vendor_leak_hits = 0`
- Live 200 verification artifact:
  - `test_reports/block7_live_200_verification_20260403_084312.json`
  - pass with fixture token supplied from Key Vault:
    - `failure_codes = []`
- Release evidence refresh output:
  - pass with full chain success:
    - parity, matrix consistency, supplier telemetry, CFO harness, gate proof, and evidence index all passed
  - artifacts:
    - `test_reports/feature_tier_parity_gate_20260403_084336.json`
    - `test_reports/release_evidence_index_20260403_084346.json`
- Model key inventory extracted:
  - 16 configured model keys in `backend/routes/deps.py`.
- Card rollout coverage extracted:
  - `UnifiedModuleCard` currently used in:
    - `frontend/src/pages/BIQcFoundationPage.js`
    - `frontend/src/pages/MoreFeaturesPage.js`
  - high-visibility app surfaces are not yet fully on unified card pattern.
- Live account connector verification:
  - Verified via Azure Key Vault supplied Supabase credentials and Supabase REST:
    - user exists: `andre@thestrategysquad.com.au`
    - user subscription tier: `free`
    - integration_accounts rows for user: `2` (`HubSpot`, `Xero`)
    - email_connections rows for user: `1` (`outlook`, active)
    - calendar coverage: `PASS` via connected Outlook provider
  - Connector rendering baseline now passes with live connected provider rows.
  - Pricing control-plane SQL tables (`pricing_plans`) are not present in the live schema cache, so entitlement SQL consistency cannot pass.

## Strict PASS|FAIL Gate Output
Format: `PASS|FAIL · gate_id · failure_code · artifact`

- PASS · `SCENARIO-ACCOUNT-ACCESS-01` · `-` · `reports/BIQC_PLATFORM_WIDE_CMO_SCENARIO_AUDIT_2026-04-03.md`
- PASS · `SCENARIO-CONNECTOR-BASELINE-01` · `-` · `test_reports/full_platform_connector_verification_20260403_100353.json`
- PASS · `TIER-PARITY-PROD-01` · `-` · `test_reports/feature_tier_parity_gate_20260403_084336.json`

- PASS · `MODEL-AUDIT-SOUNDBOARD-01` · `-` · `backend/routes/deps.py`
- PASS · `MODEL-AUDIT-OVERVIEW-01` · `-` · `backend/routes/deps.py`
- PASS · `MODEL-AUDIT-FOUNDATION-MODULES-01` · `-` · `backend/tier_resolver.py`
- PASS · `MODEL-AUDIT-MOREFEATURES-STAGED-01` · `-` · `frontend/src/App.js`
- PASS · `MODEL-AUDIT-TIER-DISCLOSURE-01` · `-` · `frontend/src/pages/Pricing.js`

- PASS · `PAGE-AUDIT-FREE-SURFACES-01` · `-` · `test_reports/zd_zr_za_manager_20260403_100316.json`
- PASS · `PAGE-AUDIT-STARTER-SURFACES-01` · `-` · `test_reports/zd_zr_za_manager_20260403_100316.json`
- PASS · `PAGE-AUDIT-PRO-SURFACES-01` · `-` · `test_reports/zd_zr_za_manager_20260403_100316.json`
- PASS · `PAGE-AUDIT-ENTERPRISE-SURFACES-01` · `-` · `test_reports/zd_zr_za_manager_20260403_100316.json`
- PASS · `PAGE-AUDIT-ADMIN-SURFACES-01` · `-` · `test_reports/zd_zr_za_manager_20260403_100316.json`

- FAIL · `CARD-AUDIT-VALUE-STATEMENT-01` · `UX_CARD_PATTERN_MISMATCH` · `reports/BIQC_PLATFORM_WIDE_CMO_SCENARIO_AUDIT_2026-04-03.md`
- PASS · `CARD-AUDIT-LOCK-REASON-01` · `-` · `frontend/src/components/UnifiedModuleCard.js`
- PASS · `CARD-AUDIT-UPGRADE-PATH-01` · `-` · `frontend/src/components/UnifiedModuleCard.js`
- PASS · `CARD-AUDIT-STATUS-USAGE-TAGS-01` · `-` · `frontend/src/components/UnifiedModuleCard.js`
- FAIL · `CARD-AUDIT-CONFIDENCE-COVERAGE-01` · `DATA_PARTIAL_COVERAGE` · `reports/BIQC_PLATFORM_WIDE_CMO_SCENARIO_AUDIT_2026-04-03.md`

- PASS · `INTEGRATION-RENDER-CORRECTNESS-01` · `-` · `test_reports/full_platform_connector_verification_20260403_100353.json`
- PASS · `CALENDAR-CONNECTOR-COVERAGE-01` · `-` · `test_reports/full_platform_connector_verification_20260403_100353.json`
- PASS · `EDGE-FUNCTION-RESPONSE-COVERAGE-01` · `-` · `test_reports/zd_zr_za_manager_20260403_084336.json`
- PASS · `EDGE-FUNCTION-PLATFORM-WIDE-200-01` · `-` · `test_reports/block7_live_200_verification_20260403_100255.json`
- PASS · `SQL-DATA-CORRECTNESS-01` · `-` · `reports/BIQC_PLATFORM_WIDE_CMO_SCENARIO_AUDIT_2026-04-03.md`
- FAIL · `SQL-TIER-ENTITLEMENT-CONSISTENCY-01` · `SQL_ENTITLEMENT_MISMATCH` · `reports/BIQC_PLATFORM_WIDE_CMO_SCENARIO_AUDIT_2026-04-03.md`

- FAIL · `SCENARIO-CMO-PARITY-01` · `EXIT_PENDING_BLOCKS_OPEN` · `reports/BIQC_PLATFORM_WIDE_CMO_SCENARIO_AUDIT_2026-04-03.md`
- PASS · `SCENARIO-NO-TRUST-REGRESSION-01` · `-` · `reports/BIQC_UX_IA_AUDIT_2026-04-03.md`
- PASS · `SCENARIO-NO-CFO-TRUTH-DEGRADATION-01` · `-` · `reports/BIQC_PLATFORM_WIDE_CMO_SCENARIO_AUDIT_2026-04-03.md`

## Open Block Mapping (from this run)

1. High-visibility UX rollout remains open (`CARD-AUDIT-VALUE-STATEMENT-01` fail).
2. Soundboard flagship parity remains open (coverage/depth card consistency gap).
3. Telemetry strict-blocking remains open at workflow policy level (deploy workflow still in advisory mode despite local evidence chain pass).
4. Full module-by-module consistency sweep remains open.
5. Final closure audit pack remains open.

## Next Steps (Execution-Ready)

1. Deploy/verify pricing control-plane tables in target environment (`pricing_plans`, `pricing_features`, `pricing_overrides`) to close SQL entitlement consistency gate.
2. Keep route parity locked (already passing) by retaining backend/frontend route map sync and rerunning `scripts/feature_tier_parity_gate.py` on each menu or admin-route change.
3. Complete high-visibility card rollout on:
   - `/advisor`
   - core dashboard surfaces
   - `/soundboard`
4. Re-run full evidence chain and publish closure index with all scenario gates PASS.
