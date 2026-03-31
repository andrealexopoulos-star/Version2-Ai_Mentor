# Key Vault Canary Migration Runbook

## Purpose

Safely migrate app settings from plain values to Key Vault references with zero-drift rollback control and health-gated verification.

## Scope

This runbook is for App Service settings migration only.

Applies to:

- `biqc-api`
- `biqc-web`
- `biqc-worker`
- `biqc-api-dev`
- `biqc-web-dev`
- `biqc-worker-dev`

## Preconditions

1. System-assigned managed identity exists on target app.
2. Target identity has `Key Vault Secrets User` on `biqckvcore01`.
3. Secret exists in Key Vault using deterministic name convention.
4. Endpoint health probe path is known and callable.

## Naming Convention

- Secret naming format: `<app-name>-<setting-name-lower-hyphen>`
- Example:
  - App setting: `SEMRUSH_API_KEY`
  - App: `biqc-api-dev`
  - Secret: `biqc-api-dev-semrush-api-key`

## Canary Strategy

1. Start in dev only.
2. Migrate one low-risk setting first.
3. Restart app.
4. Validate health endpoint returns 200.
5. If healthy, migrate a small batch.
6. Only after repeated success, promote to production canaries.

## Health-Gated Migration Procedure

1. Read all current app settings.
2. Store old values for rollback map.
3. Replace selected key(s) with Key Vault reference(s).
4. PUT full appsettings payload via ARM (`az rest`).
5. Restart app.
6. Poll health endpoint for up to 3 minutes.
7. If health fails:
   - restore old values,
   - restart,
   - re-verify health.

## Rollback Trigger Conditions

Rollback immediately if any of the following occurs:

- Health probe non-200 after timeout window.
- Startup failures in container logs.
- Authentication or critical route failures after change.

## Current Sprint Progress (2026-03-30)

Completed canaries:

- `biqc-api-dev`
  - `SEMRUSH_API_KEY`
  - `MERGE_API_KEY`
  - `MERGE_WEBHOOK_SECRET`
  - `BROWSE_AI_API_KEY`
- `biqc-web-dev`
  - `AZURE_CLIENT_SECRET`
  - `GOOGLE_CLIENT_SECRET`

All above canaries passed health-gated checks.

## Next Recommended Batch

1. Continue dev canaries:
   - remaining non-core secrets on `biqc-api-dev` and `biqc-web-dev`.
2. Pause and observe for one full operational window.
3. Promote same sequence to production one setting at a time.
