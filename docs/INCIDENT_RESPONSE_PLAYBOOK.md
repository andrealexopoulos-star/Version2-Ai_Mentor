# BIQc Incident Response Playbook

Last updated: 2026-03-30 UTC

## Severity Model

- **SEV-1**: Full production outage, security breach, or high-impact data integrity incident.
- **SEV-2**: Partial outage or major feature degradation with broad customer impact.
- **SEV-3**: Localized or recoverable issue with limited impact.

## First 15 Minutes

1. Declare severity and incident commander.
2. Freeze risky changes (deploys/manual infra changes).
3. Confirm blast radius:
   - `biqc.ai`
   - `biqc.ai/api/health`
   - `biqc-api.azurewebsites.net/api/health`
4. Pull current alerts and correlated logs (Azure Monitor + App Service logs + Sentinel where applicable).
5. Start incident timeline.

## Containment

- Revert the most recent known risky control change first.
- Use least-destructive rollback path:
  - app setting rollback
  - container image rollback
  - WAF mode from Prevention to Detection
- Keep evidence and timestamps.

## Communications

- Internal update cadence:
  - SEV-1: every 15 min
  - SEV-2: every 30 min
  - SEV-3: every 60 min (or on material status change)
- Include:
  - what failed,
  - current impact,
  - next action and ETA.

For customer-impacting incidents, publish an external status update with current impact, scope, and next update time.

## Recovery Criteria

Service considered recovered when:

1. Health endpoints stable 200 for 30+ minutes.
2. No elevated 5xx alert storms.
3. Customer critical paths validated (auth, calibration entry, API core paths).

## Post-Incident Review (Required)

Within 24 hours:

1. Root cause summary.
2. Why existing controls failed to prevent/detect earlier.
3. Permanent corrective actions with owner/date.
4. Update runbooks and architecture status docs.

## Security Incident Branch

If unauthorized access, data exposure, or breach indicators are present:

1. Escalate to Security Operations immediately.
2. Preserve forensic evidence and stop non-essential changes.
3. Follow legal/compliance notification obligations for impacted regions.

