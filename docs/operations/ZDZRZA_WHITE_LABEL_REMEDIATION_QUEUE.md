# ZD-ZR-ZA White-Label Remediation Queue

## Source

- Evidence artifact: `test_reports/zd_zr_za_manager_20260402_041728.json`
- Scope: likely customer-visible supplier-term hits in frontend surfaces.

## Priority Model

- **P0**: Primary customer-facing pages with repeated supplier naming.
- **P1**: Secondary UI flows and onboarding surfaces.
- **P2**: Mixed UI/internal surfaces requiring wording cleanup and conventions.

## P0 Targets

- `frontend/src/pages/Integrations.js`
- `frontend/src/pages/AdvisorWatchtower.js`
- `frontend/src/components/FirstTimeOnboarding.js`
- `frontend/src/pages/LandingIntelligent.js`
- `frontend/src/components/website/WebsiteLayout.js`

## P1 Targets

- `frontend/src/App.js`
- `frontend/src/pages/website/PricingPage.js`
- `frontend/src/pages/Landing.js`
- `frontend/src/pages/Pricing.js`
- `frontend/src/pages/website/platform/PlatformLogin.js`

## P2 Targets

- `frontend/src/pages/AdminDashboard.js`
- `frontend/src/pages/AuthCallbackSupabase.js`
- `frontend/src/hooks/useCalibrationState.js`
- `frontend/src/hooks/usePlatformData.js`
- `frontend/src/pages/BusinessProfile.js`

## Remediation Rules

1. Replace supplier-facing labels with internal capability labels.
2. Keep technical integration references only in internal/admin/debug contexts.
3. Do not change integration behavior while changing copy.
4. Add regressions checks for affected routes after each batch.
5. Re-run `scripts/zd_zr_za_manager.py` after each batch and record new artifact.

## Completion Definition

- `likely_visible_vendor_leak_hits` reduced to `0` for production-facing surfaces.
- No degraded integration functionality.
- Website and platform smoke checks remain passing.

