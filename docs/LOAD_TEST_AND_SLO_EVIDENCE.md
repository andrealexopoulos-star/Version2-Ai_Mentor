# Load Test and SLO Evidence

Last updated: 2026-03-30 UTC

## Goal

Generate objective performance evidence for BIQc target scale and tune production alerts/autoscale accordingly.

## Test Targets

- Primary target profile: up to 5,000 active users equivalent pattern.
- Critical routes:
  - `/`
  - `/api/health`
  - representative authenticated API path(s)

## Pre-Test Checklist

1. Baseline alerts enabled and routed (`biqc-wave1-ag`).
2. No active incident or deployment instability.
3. Test window approved.

## Metrics to Capture

- p50 / p95 / p99 latency
- throughput (RPS)
- error rates (4xx/5xx)
- app plan CPU/memory
- API response-time alert behavior

## Evidence Template

- Test date:
- Tool/profile:
- Duration:
- Peak concurrent users:
- Latency summary (p50/p95/p99):
- Error summary:
- Infra utilization summary:
- Observed bottlenecks:
- Recommended threshold/autoscale updates:
- Approver:

## Acceptance Criteria

1. No uncontrolled error spikes under target profile.
2. Alert thresholds validated against observed behavior.
3. Any required scaling policy updates documented and applied.

