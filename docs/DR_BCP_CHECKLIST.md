# BIQc DR and BCP Checklist

Last updated: 2026-03-30 UTC

## Target Objectives

- **RTO target:** 60 minutes (initial operational target)
- **RPO target:** 15 minutes for critical platform state

## Quarterly Drill Checklist

1. Confirm backup/export paths are current for all critical stores.
2. Simulate app-service failure and execute documented rollback/restart flow.
3. Simulate secret-access failure and validate Key Vault rollback process.
4. Validate recovery of:
   - frontend availability,
   - API health,
   - authentication flow.
5. Record measured RTO and RPO.
6. Capture evidence artifacts and sign-off.

## Evidence Record Template

- Drill date/time (UTC):
- Scenario:
- Recovery steps executed:
- Measured RTO:
- Measured RPO:
- Customer-visible impact:
- Follow-up actions:
- Owner sign-off:

## Minimum Annual BCP Validation

1. Validate contact tree and escalation paths.
2. Validate deployment rollback path from CI artifacts.
3. Validate critical external dependency failure handling:
   - Supabase
   - Redis
   - AI provider routes
4. Update architecture and runbook index.

