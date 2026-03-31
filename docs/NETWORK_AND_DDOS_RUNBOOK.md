# Network and DDoS Hardening Runbook

Last updated: 2026-03-30 UTC

## Objective

Attach BIQc to a network topology that enables effective DDoS protection and controlled private connectivity.

## Current Baseline

- DDoS plan exists: `biqc-ddos-standard`.
- Attached VNets: `0`.
- App Services currently rely on public ingress endpoints.

## Target State

1. VNet exists for BIQc ingress/service paths.
2. DDoS plan attached to VNet(s).
3. Private connectivity model defined (Private Link and/or controlled egress).
4. Post-change health and routing validated.

## Step 1: Create or identify VNet

If no suitable VNet exists:

```bash
az network vnet create \
  --resource-group biqc-production \
  --name biqc-vnet-core \
  --address-prefixes 10.40.0.0/16 \
  --subnet-name biqc-apps \
  --subnet-prefixes 10.40.1.0/24
```

## Step 2: Attach DDoS plan

```bash
az network vnet update \
  --resource-group biqc-production \
  --name biqc-vnet-core \
  --ddos-protection true \
  --ddos-protection-plan /subscriptions/57d9a89b-4db8-4d17-8112-f3221346d684/resourceGroups/biqc-production/providers/Microsoft.Network/ddosProtectionPlans/biqc-ddos-standard
```

Verify:

```bash
az network vnet show --resource-group biqc-production --name biqc-vnet-core -o json
```

## Step 3: Integrate workloads

Choose one of:

- App Service regional VNet integration for controlled egress path.
- Private endpoint model for data-plane services.
- Edge-first ingress with hardened Front Door + WAF.

Document chosen model and apply in staged rollout (dev then prod).

## Step 4: Validation

1. Confirm VNet now references DDoS plan.
2. Confirm BIQc endpoints remain healthy:
   - `https://biqc.ai/`
   - `https://biqc.ai/api/health`
3. Confirm no unexpected latency/error regression.

## Rollback

If regression occurs:

1. Revert last VNet/workload attachment step.
2. Preserve DDoS plan resource; only detach where required to restore service.
3. Re-check endpoints and alerts.

