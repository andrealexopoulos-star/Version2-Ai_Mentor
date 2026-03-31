# BIQc Worker Operations Runbook

Last updated: 2026-03-30 UTC

## Runtime Components

- App Service worker:
  - `biqc-worker` (prod)
  - `biqc-worker-dev` (dev)
- Container Apps Jobs (migration path):
  - `biqc-worker-job-prod`
  - `biqc-worker-job-dev`

## Operational Model

Current safe default:

- App Service worker active.
- Container Apps Jobs provisioned but manually triggered only.

## Daily Checks

1. Worker app health/state in Azure.
2. Queue latency/backlog trend.
3. Redis connectivity/error alerts.
4. Job execution failures (if manual jobs were triggered).

## Change Procedure (Worker Runtime)

1. Apply change in dev worker first.
2. Verify:
   - no startup failure,
   - queue processing behavior correct,
   - no duplicate processing.
3. Promote to production during low-risk window.
4. Monitor 30 minutes minimum.

## Failure Response

If worker regression appears:

1. Stop new manual job triggers.
2. Roll back worker image/settings to previous known good.
3. Validate queue consumption recovers.
4. Document incident and corrective action.

## Migration Completion Criteria (App Service -> Jobs)

1. Job schedule and retry policy defined.
2. Secret/config parity verified.
3. Observability in place for job success/failure.
4. Duplicate execution protection validated.

