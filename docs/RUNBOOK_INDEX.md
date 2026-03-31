# BIQc Enterprise Runbook Index

Last updated: 2026-03-30 UTC

## Purpose

Central index for operational runbooks required to run BIQc with enterprise-grade security, reliability, and incident response discipline.

## Governance

- Primary owner: Platform Engineering
- Security approver: Security Operations
- Review cadence: monthly for active runbooks, immediate update after incidents or major infra changes
- Evidence storage: attach artifacts to the active Azure support ticket / incident record and reference in sprint log

## Runbooks

| Runbook | Scope | Owner |
|---|---|---|
| `EDGE_AND_WAF_CUTOVER_RUNBOOK.md` | Front Door WAF attach/cutover/rollback | Platform Engineering |
| `WAF_PLATFORM_BLOCKER_ESCALATION_PACKAGE.md` | Microsoft escalation package for WAF platform blocker | Platform Engineering |
| `NETWORK_AND_DDOS_RUNBOOK.md` | VNet, Private Link, DDoS attachment and validation | Platform Engineering |
| `INCIDENT_RESPONSE_PLAYBOOK.md` | Incident severity model, response steps, communications | Platform Engineering + Security |
| `DR_BCP_CHECKLIST.md` | Disaster recovery and business continuity drill evidence | Platform Engineering |
| `WORKER_OPERATIONS_RUNBOOK.md` | Worker runtime operations (App Service + Container Apps Jobs) | Backend/Platform |
| `LOAD_TEST_AND_SLO_EVIDENCE.md` | Capacity/load test method and SLO evidence capture | Platform Engineering |
| `KEY_VAULT_CANARY_MIGRATION_RUNBOOK.md` | Guarded Key Vault migration process | Platform Engineering |
| `WAVE1_HARDENING_DEPLOY_RUNBOOK.md` | Legacy wave hardening deployment flow | Platform Engineering |

## Source of Truth

- Architecture and status baseline:
  - `BIQC_E2E_ENTERPRISE_ARCHITECTURE_STATUS.md`
- Sprint execution history:
  - `SPRINT_ENTERPRISE_HARDENING_LOG_2026-03.md`

