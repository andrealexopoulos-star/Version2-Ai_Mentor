# Edge and WAF Cutover Runbook

Last updated: 2026-03-30 UTC

## Objective

Safely attach and enforce WAF on Azure Front Door Premium for BIQc with rollback-ready change control.

## Blocking Gate (Read First)

Do not execute this runbook while `Microsoft.Network/AllowFrontdoor` is `Pending`.
Use `WAF_PLATFORM_BLOCKER_ESCALATION_PACKAGE.md` until Microsoft confirms unblock.

## Preconditions

1. `Microsoft.Network/AllowFrontdoor` feature state is `Registered`.
2. WAF policy can be created under supported resource path.
3. Front Door profile `biqc-fd-premium` and endpoint `biqc-edge-prod` exist.
4. Change window approved.
5. Health probes baseline green:
   - `https://biqc.ai/`
   - `https://biqc.ai/api/health`
   - `https://biqc-api.azurewebsites.net/api/health`

## Step 1: Create WAF policy (Detection first)

```bash
az network front-door waf-policy create \
  --resource-group biqc-production \
  --policy-name biqc-fd-waf-core \
  --sku Premium_AzureFrontDoor \
  --mode Detection
```

## Step 2: Attach WAF via AFD security policy

Get endpoint ID:

```bash
az afd endpoint show \
  --resource-group biqc-production \
  --profile-name biqc-fd-premium \
  --endpoint-name biqc-edge-prod \
  --query id -o tsv
```

Attach:

```bash
az afd security-policy create \
  --resource-group biqc-production \
  --profile-name biqc-fd-premium \
  --security-policy-name biqc-fd-security \
  --domains <endpoint-id> \
  --waf-policy /subscriptions/57d9a89b-4db8-4d17-8112-f3221346d684/resourceGroups/biqc-production/providers/Microsoft.Network/frontdoorWebApplicationFirewallPolicies/biqc-fd-waf-core
```

## Step 3: Validation

1. Confirm policy attachment:

```bash
az afd security-policy list --resource-group biqc-production --profile-name biqc-fd-premium -o json
```

2. Validate edge endpoint paths:
   - `/` returns 200
   - `/api/health` returns 200

3. Validate production still healthy:
   - `https://biqc.ai/` = 200
   - `https://biqc.ai/api/health` = 200

4. Observe for false positives in Detection mode (minimum 24h recommended).

### Detection-to-Prevention Promotion Gate

Promote only if all are true during observation window:

- p95 latency regression < 15% on key routes.
- No sustained 5xx increase above baseline + 1%.
- No critical false-positive blocks on login/calibration/API health paths.

## Step 4: Move to Prevention

```bash
az network front-door waf-policy update \
  --resource-group biqc-production \
  --name biqc-fd-waf-core \
  --mode Prevention
```

Re-run validation matrix.

## Rollback

If availability impact or false positives occur:

1. Revert to Detection mode immediately:

```bash
az network front-door waf-policy update \
  --resource-group biqc-production \
  --name biqc-fd-waf-core \
  --mode Detection
```

2. If still impacting, detach security policy:

```bash
az afd security-policy delete \
  --resource-group biqc-production \
  --profile-name biqc-fd-premium \
  --security-policy-name biqc-fd-security
```

3. Confirm production recovery checks.

## Cutover Evidence Template

- Date/time (UTC):
- Operator:
- WAF policy ARM ID:
- Security policy ARM ID:
- Detection validation results (allow/block/false-positive):
- Production health results:
- Rollback executed? (yes/no):
- Final mode (Detection/Prevention):

