# WAF Platform Blocker Escalation Package

Last updated: 2026-03-30 UTC

## Objective

Escalate and unblock Azure Front Door Premium WAF attachment for BIQc when local configuration is correct but Azure platform prerequisites are not yet enabled.

## Environment

- Subscription: `57d9a89b-4db8-4d17-8112-f3221346d684`
- Resource Group: `biqc-production`
- Front Door Profile: `biqc-fd-premium`
- Front Door Endpoint: `biqc-edge-prod`
- Target domain path: `biqc.ai`

## Reproduced Blockers (Evidence)

1. Feature gate still pending:
- Command:
  - `az feature show --namespace Microsoft.Network --name AllowFrontdoor --output json`
- Result:
  - `properties.state = Pending`

2. Microsoft.Network WAF policy create path fails:
- Command:
  - `az network front-door waf-policy create --resource-group biqc-production --policy-name biqc-fd-waf-core --sku Premium_AzureFrontDoor --mode Prevention --output json`
- Result:
  - `BadRequest: Policy ArmResourceId has incorrect formatting`

3. Microsoft.Cdn WAF policy path is retired:
- Command (ARM REST):
  - PUT `Microsoft.Cdn/CdnWebApplicationFirewallPolicies` for `biqc-fd-waf-core`
- Result:
  - `BadRequest: Web Application Firewall Policy creation fails due to CDN WAF retirement.`

4. No active security policy currently attached:
- Command:
  - `az afd security-policy list --resource-group biqc-production --profile-name biqc-fd-premium --output json`
- Result:
  - `[]`

## Escalation Execution Status

Microsoft support case has now been successfully created.

- Ticket name: `biqc-fd-waf-blocker-20260331080113`
- Ticket ID: `2603300030008112`
- Status: `Open`
- Plan/SLA: `Standard` (SLA minutes: `240`)
- Service: `Front Door Standard and Premium`

Earlier blocker (`InvalidSupportPlan`) is now resolved after support-plan upgrade.

## Latest Retry Attempt (Post-Upgrade)

Re-ran unblock attempts after support-plan upgrade:

1. `az feature show --namespace Microsoft.Network --name AllowFrontdoor`
   - still `Pending`
2. Re-issued:
   - `az feature register --namespace Microsoft.Network --name AllowFrontdoor`
   - `az provider register --namespace Microsoft.Network`
3. Re-tried WAF create:
   - `az network front-door waf-policy create ...`
   - result unchanged: `BadRequest` with `Policy ArmResourceId has incorrect formatting`
4. Front Door security policies remain empty on `biqc-fd-premium`.

Support follow-up communication posted:

- Communication name: `biqc-waf-followup-20260331083759`
- Timestamp: `2026-03-30T21:38:07Z`
- Requested exact unblock action, ETA, and supported policy creation/attachment path.

## Required Escalation Path (Manual)

Use Azure Portal with an account/subscription that has a valid support plan:

1. Open support request:
   - Service: **Front Door Standard and Premium**
   - Category: **Configuration and setup / Other**
2. Include this exact blocker summary:
   - `Microsoft.Network/AllowFrontdoor` stuck in `Pending`
   - Network WAF create returns `Policy ArmResourceId has incorrect formatting`
   - CDN WAF path returns retirement error
3. Request explicit Microsoft action:
   - Confirm/complete backend enablement for `AllowFrontdoor`
   - Confirm supported policy resource path for AFD Premium in this subscription
   - Provide ETA and remediation steps

## Ready-to-Run Commands After Microsoft Unblocks

1. Recheck feature and provider:
- `az feature show --namespace Microsoft.Network --name AllowFrontdoor --query properties.state --output tsv`
- `az provider register --namespace Microsoft.Network --output json`
- `az provider register --namespace Microsoft.Cdn --output json`

2. Create WAF policy (Detection first):
- `az network front-door waf-policy create --resource-group biqc-production --policy-name biqc-fd-waf-core --sku Premium_AzureFrontDoor --mode Detection --output json`

3. Attach policy to AFD endpoint domain:
- Get endpoint resource ID:
  - `az afd endpoint show --resource-group biqc-production --profile-name biqc-fd-premium --endpoint-name biqc-edge-prod --query id --output tsv`
- Create security policy:
  - `az afd security-policy create --resource-group biqc-production --profile-name biqc-fd-premium --security-policy-name biqc-fd-security --domains <endpoint-id> --waf-policy /subscriptions/57d9a89b-4db8-4d17-8112-f3221346d684/resourceGroups/biqc-production/providers/Microsoft.Network/frontdoorWebApplicationFirewallPolicies/biqc-fd-waf-core --output json`

4. Validate:
- `az afd security-policy list --resource-group biqc-production --profile-name biqc-fd-premium --output json`
- `curl -sS -i "https://biqc-edge-prod-amd2b6a6a7d2arcj.z01.azurefd.net/"`
- `curl -sS -i "https://biqc-edge-prod-amd2b6a6a7d2arcj.z01.azurefd.net/api/health"`

5. Move to Prevention mode after clean validation window:
- `az network front-door waf-policy update --resource-group biqc-production --name biqc-fd-waf-core --mode Prevention --output json`

