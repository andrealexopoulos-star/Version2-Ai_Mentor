# BIQc End-to-End Enterprise Architecture and Platform Status

Last updated: 2026-03-30 (UTC, closure implementation wave complete)
Owner: Platform Engineering

## 1) Purpose

This document is the current enterprise architecture baseline for BIQc and the operational status snapshot after recent hardening and rollback/recovery actions.

It is designed to answer:

- What is deployed end-to-end.
- What is enterprise-ready now.
- What is still remaining, blocked, or in-progress.
- What can be considered safe if work is paused.

## 2) End-to-End Architecture (Current)

### 2.1 User and Edge Layer

- Primary production domain: `biqc.ai`.
- Global edge: Azure Front Door Premium profile `biqc-fd-premium`.
- Front Door endpoint: `biqc-edge-prod-amd2b6a6a7d2arcj.z01.azurefd.net`.
- Edge routing model:
  - Web traffic (`/*`) -> frontend origin group `og-web`.
  - API traffic (`/api/*`) -> backend origin group `og-api`.

### 2.2 Application Layer

- Frontend:
  - React (CRA + CRACO).
  - Production app service: `biqc-web`.
  - Development app service: `biqc-web-dev`.
- Backend:
  - FastAPI/Uvicorn.
  - Production app service: `biqc-api`.
  - Development app service: `biqc-api-dev`.
- Worker:
  - Production worker app service: `biqc-worker`.
  - Development worker app service: `biqc-worker-dev`.
  - Container Apps Jobs are provisioned for migration path:
    - `biqc-worker-job-prod`
    - `biqc-worker-job-dev`

### 2.3 Data and Intelligence Layer

- Primary application data and auth: Supabase (prod/dev projects).
- AI and enrichment path includes backend routes + Supabase Edge Functions.
- Redis is present and used for queue/worker patterns with graceful fallback behavior.

### 2.4 Security and Secrets Layer

- Managed identities enabled on production and development app services used in current hardening.
- Key Vault in use: `biqckvcore01`.
- RBAC model in place for app identities with `Key Vault Secrets User` where configured.
- Secret centralization is now effectively complete for non-public values. Remaining plain values are intentionally public, placeholders, or non-secret runtime config.

### 2.5 Observability and Security Operations Layer

- Central workspace: Log Analytics `biqc-law-core`.
- Application Insights: `biqc-ai-core`.
- Sentinel onboarded via `SecurityInsights(biqc-law-core)` solution (Succeeded).
- Defender for Cloud standard plans confirmed for key surfaces including API/AppServices/CloudPosture.
- Metric alert estate is deployed across prod/dev web, api, worker, app service plan, and Redis tiers.
- Alert delivery path is active via action group `biqc-wave1-ag` with primary email receiver configured.
- Subscription-level Azure incident visibility is enabled via activity-log alerts:
  - `biqc-subscription-service-health`
  - `biqc-subscription-resource-health`
- Additional activity-log controls are active for operations and governance:
  - `biqc-activity-prod-apps-restart`
  - `biqc-activity-prod-apps-stop`
  - `biqc-activity-keyvault-admin-failed`

### 2.6 CI/CD and Release Layer

- GitHub Actions drives build/deploy.
- Deploy workflow includes retry/backoff hardening for image convergence and smoke checks.
- Rollback capability validated through recent production rollback event.

## 3) Verified Runtime Health Snapshot

At last verification checkpoint:

- `https://biqc.ai/` -> 200
- `https://biqc.ai/api/health` -> 200
- `https://biqc-api.azurewebsites.net/api/health` -> 200
- `https://biqc-web-dev.azurewebsites.net/` -> 200
- `https://biqc-api-dev.azurewebsites.net/api/health` -> 200

Additional incident note:

- Dev services experienced `ACRTokenRetrievalFailure` during hardening changes.
- Corrective action applied:
  - Enabled ACR managed identity pull mode on dev apps.
  - Assigned `AcrPull` to the relevant dev managed identities.
  - Restarted services and re-validated health.

## 4) Enterprise Capability Scorecard

### 4.1 Completed / Operational

- Front Door Premium profile and routing objects deployed.
- Sentinel onboarded and active.
- Defender for Cloud key plans at Standard (including API subplan P1).
- DDoS Standard plan resource created (`biqc-ddos-standard`).
- Container Apps Jobs migration path created (prod/dev jobs provisioned, manual trigger).
- Deployment pipeline resiliency improvements applied.
- Production rollback and recovery procedure proven under live conditions.
- Alerting delivery path fixed (receivers now configured, not metrics-only).
- Subscription-wide service/resource health alert coverage deployed.
- Key Vault migration finalized for true secrets across prod/dev with canary + rollback discipline.
- App-layer IP hardening implemented in codebase:
  - reCAPTCHA bypass removed (production fail-closed behavior preserved),
  - signup throttling added,
  - auth logging sanitized (no raw print flows),
  - production API docs/openapi disabled by environment gate,
  - frontend production sourcemaps disabled in container build pipeline,
  - frontend edge headers/CSP report-only policy strengthened.
- Enterprise runbook pack published:
  - `RUNBOOK_INDEX.md`
  - `EDGE_AND_WAF_CUTOVER_RUNBOOK.md`
  - `NETWORK_AND_DDOS_RUNBOOK.md`
  - `INCIDENT_RESPONSE_PLAYBOOK.md`
  - `DR_BCP_CHECKLIST.md`
  - `WORKER_OPERATIONS_RUNBOOK.md`
  - `LOAD_TEST_AND_SLO_EVIDENCE.md`
  - `WAF_PLATFORM_BLOCKER_ESCALATION_PACKAGE.md`

### 4.2 In Progress

- Worker runtime modernization from web app worker model toward job-first execution model.
- Formal load/DR execution evidence collection (runbooks are now in place).

### 4.3 Blocked / External Dependency

- Front Door WAF final attach/cutover is blocked by Azure feature gate state:
  - `Microsoft.Network/AllowFrontdoor` remains `Pending`.
- Direct WAF policy create path for `Microsoft.Cdn/CdnWebApplicationFirewallPolicies` currently returns:
  - `Web Application Firewall Policy creation fails due to CDN WAF retirement.`
- Microsoft escalation ticket is now open:
  - Name: `biqc-fd-waf-blocker-20260331080113`
  - Ticket ID: `2603300030008112`
  - Status: `Open`
  - Awaiting Azure platform-side unblock guidance/execution.

## 5) Current Gaps to Full Enterprise Completion

Remaining high-priority items:

1. Complete WAF policy attach and validate Front Door protection path.
2. Introduce/attach VNets and Private Link where required.
3. Attach DDoS plan to actual VNets (current attachment count is zero).
4. Execute formal 5k-user load test and tune autoscale/SLO alerts from measured results.
5. Run disaster recovery drills (failover/restore evidence), not just resource provisioning.
6. Finalize worker migration operating model transition from App Service worker to job-first.

## 6) Stop-Now Position (If Work Pauses)

If work pauses now, BIQc is in a stable and production-viable state with meaningful enterprise hardening already in place.

However, it is not yet at final "fully completed enterprise hardening" because:

- WAF enforcement is not fully attached due to platform gate.
- Network isolation and DDoS attachment are incomplete.
- Full load/DR evidence pack is not yet complete.

## 7) Estimated Remaining Effort

Estimated remaining to full completion: ~10% to 20% (mostly external/platform and execution-evidence items).

Expected duration (assuming Microsoft unblock + planned drills): ~2 to 6 working days.

## 8) Change Control Notes

- No secret values are documented in this file.
- This file is a status and architecture artifact and should be updated after every major hardening wave.
