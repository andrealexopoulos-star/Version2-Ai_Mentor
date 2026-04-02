# ZD-ZR-ZA Baseline Audit (2026-04-02)

## Run Context

- Script: `scripts/zd_zr_za_manager.py`
- Evidence artifact: `test_reports/zd_zr_za_manager_20260402_041806.json`
- Environment: repository baseline scan (code + workflow controls)

## Baseline Results

- Frontend routes discovered: `112`
- Backend endpoints discovered: `335`
- Edge functions discovered: `32`
- Vendor-label hits in frontend code: `541`
- Likely customer-visible vendor-label hits: `204`
- Vendor terms with hits: `merge`, `supabase`
- Deploy forensic gate marker: `v6`
- Website change gate present: `true`
- Pre-prod forensic gate present: `true`

## What This Means

- Governance controls for website and forensic gate are present and detectable.
- Platform surface area is large enough to require strict lineage and contract automation.
- White-label cleanup remains a major workstream; likely customer-visible leaks require immediate remediation pass.

## Top Concentration Areas for White-Label Remediation

### Merge references

- `frontend/src/pages/Integrations.js`
- `frontend/src/components/FirstTimeOnboarding.js`
- `frontend/src/pages/AdvisorWatchtower.js`
- `frontend/src/pages/OnboardingWizard.js`

### Supabase references

- `frontend/src/App.js`
- `frontend/src/pages/AuthCallbackSupabase.js`
- `frontend/src/hooks/useSnapshot.js`
- `frontend/src/pages/AdminDashboard.js`
- `frontend/src/pages/Integrations.js`

## Next Execution Steps

1. Build card lineage map by extracting route -> page -> component -> data hook -> endpoint -> edge function.
2. Split vendor-term findings into:
   - customer-visible text leaks (blocking),
   - internal technical references (non-blocking).
3. Add contract matrix generator for endpoints and edge functions with expected status classes.
4. Introduce release evidence index file aggregating:
   - gate status,
   - lineage coverage,
   - contract failures,
   - white-label leakage status.

## Pass/Block Policy for Upcoming Iteration

- Block if customer-visible supplier branding remains in production surfaces.
- Block if any critical contract endpoint returns unexpected `5xx`.
- Block if lineage coverage for critical cards is incomplete.

