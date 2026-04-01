# Ask BIQc Dev Evidence Matrix

## Deployment

- Frontend image deployed: `biqcregistry.azurecr.io/biqc-frontend:dev-askbiqc-20260401-080547`
- Backend image deployed: `biqcregistry.azurecr.io/biqc-api:dev-askbiqc-20260401-081027`
- Targets:
  - `biqc-web-dev`
  - `biqc-api-dev`

## Build and Validation

| Check | Result | Status |
|---|---|---|
| Frontend production build | `npm run build` succeeded (warnings only) | GREEN |
| Backend syntax gate | `python -m py_compile backend/routes/calibration.py backend/routes/soundboard.py` succeeded | GREEN |
| Web health | `GET https://biqc-web-dev.azurewebsites.net/api/health -> 200` | GREEN |
| API health | `GET https://biqc-api-dev.azurewebsites.net/api/health -> 200` | GREEN |
| OAuth callback target | Microsoft OAuth request resolves to dev callback URL | GREEN |
| Secure contract (unauth forensic) | `POST /api/forensic/calibration -> 401` | GREEN |
| Ask BIQc route auth gate | `/ask-biqc` redirects unauthenticated user to login | GREEN |
| Legacy route compatibility | `/soundboard` path resolves through auth flow (backward-safe path) | GREEN |
| Homepage signature baseline | `One intelligence layer for every decision that matters` marker not detected | RED |

## Notes

- RED item requires homepage parity review against the expected dev baseline visual copy.
- Functional deployment and core auth/API contracts are live in dev.
