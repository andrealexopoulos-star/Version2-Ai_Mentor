# BIQc ZD-ZR-ZA Manager

## Purpose

The ZD-ZR-ZA Manager is the operating authority that enforces:
- **Zero Drift**: no unresolved divergence between source-of-truth data and rendered intelligence.
- **Zero Regression**: no deploy reaches production if website/platform/advisor contracts regress.
- **Zero Assumption**: no AI recommendation is shipped without source lineage and confidence.

This manager is the final gatekeeper for production promotion.

## Why This Path

- BIQc competes in a category where trust, speed, and explainability must coexist.
- Client-heavy logic cannot reliably satisfy security/compliance and evidence requirements.
- A gate-driven evidence model removes subjective release decisions and prevents silent failures.

## Architecture Control Stack

1. **Storage Control Plane**
   - Accounting/ERP is financial authority.
   - Canonical entities normalize operational sources.
   - Audit/event logs are append-only for lineage.
2. **Execution Control Plane**
   - Edge Functions orchestrate low-latency integrations and AI tasks.
   - DB functions (RPC) execute heavy deterministic logic near data.
3. **Backend Control Plane**
   - FastAPI enforces auth, RBAC, output contracts, and evidence packaging.
4. **Frontend Control Plane**
   - Cards display only internal capability labels and role-relevant action guidance.
5. **Advisor Control Plane**
   - Soundboard responses require source-attributed facts and confidence transparency.

## Blocking Gate Stack

### Gate 1: Contract Gate
- Validate endpoints and edge functions against expected status contracts.
- Target success behavior:
  - `200` when request is valid and fulfilled.
  - explicit auth/validation statuses where contract requires (`401/403/422/400`).
- Any unexpected `5xx` is a release blocker.

### Gate 2: Data Drift Gate
- Reconcile card metrics against authoritative financial/operational sources.
- Enforce variance thresholds by metric criticality.
- Block release when unresolved variance exceeds threshold.
- CFO invariant applies: any finance-card threshold breach blocks release.

### Gate 3: White-Label Gate
- Block if UI exposes supplier branding on customer-facing surfaces.
- Internal technical references are allowed only outside user-visible channels.

### Gate 4: Security and Compliance Gate
- Validate OAuth/OIDC/token lifecycle, least privilege, and secret handling.
- Validate no client exposure of privileged keys/tokens.
- Validate encryption and role policy coverage.

### Gate 5: Advisor Quality Gate
- Soundboard must preserve continuity and return retrievable conversation IDs.
- High-impact guidance requires source attribution and evidence references.
- Block on ungrounded advisory output in controlled evaluation set.

### Gate 6: Experience Gate
- Golden journeys for onboarding, calibration, integrations, and Soundboard must pass.
- Block on broken route, route-auth mismatch, or degraded card rendering.

## Evidence Schema

Each gate emits machine-readable evidence with:
- environment (`staging|production`)
- commit SHA
- gate name/version
- test vectors
- pass/fail outcomes
- failing artifacts
- owner and timestamp
- failure code (if failed)
- artifact hash/signature

No release approval without complete evidence coverage.

Evidence validity rules:
- stale-evidence timeout: `4 hours` max at release decision.
- partial evidence: treated as gate failure.
- artifact upload failure: treated as gate failure.
- retention: minimum `180 days`.

## Automation Entry Point

Run the manager script to generate machine-readable evidence:

`python scripts/zd_zr_za_manager.py`

Optional output override:

`ZDZRZA_OUTPUT_PATH=test_reports/zd_zr_za_manager_latest.json python scripts/zd_zr_za_manager.py`

Primary artifact sections:
- `summary`
- `frontend_routes`
- `backend_endpoints`
- `edge_functions`
- `vendor_branding_findings`
- `deploy_workflow_analysis`

## RACI

- **Release authority:** ZD-ZR-ZA Manager
- **Engineering owners:** route/edge/component maintainers
- **Security owner:** identity/secrets/RBAC authority
- **Data owner:** CFO-appointed source-of-truth steward
- **Product owner:** cognitive load and advisor clarity owner

## Success Metrics

- Contract reliability: `>= 99.9%` non-5xx for critical surfaces.
- Drift control: `<= threshold` variance on CFO-critical cards.
- Attribution quality: `>= 95%` source-attributed high-impact advisor claims.
- Regression control: `0` production releases with unresolved P0 gate failures.

## Escalation Policy

- P0 gate failure: immediate release stop and rollback readiness.
- P1: degrade non-critical surfaces allowed only with explicit risk acceptance and hotfix SLA.
- P2: backlog with scheduled remediation and owner assignment.

Override policy:
- P0 overrides require dual approval (`Engineering DRI` + `CFO data owner` for finance-related gates).
- Single-approver overrides are invalid.

