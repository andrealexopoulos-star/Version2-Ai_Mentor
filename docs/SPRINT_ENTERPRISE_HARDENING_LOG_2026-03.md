# Sprint Enterprise Hardening Log (March 2026)

## 2026-03-30 - Closure Implementation Wave (Plan Execution)

### Objective

Execute all remaining items from the enterprise hardening closure plan with zero-regression guardrails and publish full operational runbook coverage.

### Completed in this wave

1. **Track A closure: Key Vault hardening finalized**
   - Re-audited prod/dev app settings for secret-like values still plain.
   - Confirmed remaining plain settings are public values/placeholders/non-secret runtime config.
   - Re-verified health endpoints:
     - `https://biqc.ai/` -> 200
     - `https://biqc.ai/api/health` -> 200
     - `https://biqc-api.azurewebsites.net/api/health` -> 200
     - `https://biqc-web-dev.azurewebsites.net/` -> 200
     - `https://biqc-api-dev.azurewebsites.net/api/health` -> 200

2. **Track B closure: app-layer IP and abuse hardening implemented**
   - Backend:
     - Removed unconditional CAPTCHA bypass in `backend/routes/auth.py`.
     - Added signup throttles in `backend/core/config.py` (`/api/auth/supabase/signup`, `/api/auth/signup`).
     - Replaced raw `print` auth errors with structured logger calls in `backend/auth_supabase.py`.
     - Disabled public FastAPI docs/openapi in production runtime in `backend/server.py`.
   - Frontend/deploy:
     - Disabled production sourcemaps in container build path (`Dockerfile.frontend`, `.github/workflows/deploy.yml`).
     - Removed backend deploy-time re-injection of reCAPTCHA secrets in workflow to avoid overriding Key Vault references.
     - Added stronger response hardening headers and CSP report-only policy in `deploy/nginx.conf`.
   - Validation:
     - Backend files passed syntax compile checks.
     - No linter diagnostics on touched files.

3. **Track C closure: WAF blocker escalation package executed**
   - Reproduced blockers again as fresh evidence:
     - `Microsoft.Network/AllowFrontdoor` = `Pending`
     - `az network front-door waf-policy create` -> `Policy ArmResourceId has incorrect formatting`
     - ARM create on `Microsoft.Cdn/CdnWebApplicationFirewallPolicies` -> `CDN WAF retirement`
   - Attempted support ticket creation via Azure Support CLI.
   - Hard blocker: `InvalidSupportPlan` (no entitlement for API-driven support case creation).
   - Published executable escalation + post-unblock runbook in:
     - `docs/WAF_PLATFORM_BLOCKER_ESCALATION_PACKAGE.md`

4. **Track D closure: resilience runbook suite published**
   - Added:
     - `docs/RUNBOOK_INDEX.md`
     - `docs/EDGE_AND_WAF_CUTOVER_RUNBOOK.md`
     - `docs/NETWORK_AND_DDOS_RUNBOOK.md`
     - `docs/INCIDENT_RESPONSE_PLAYBOOK.md`
     - `docs/DR_BCP_CHECKLIST.md`
     - `docs/WORKER_OPERATIONS_RUNBOOK.md`
     - `docs/LOAD_TEST_AND_SLO_EVIDENCE.md`

5. **Final verification evidence captured**
   - Alerts:
     - metric alerts enabled: `16/16`
     - activity-log alerts enabled: `5/5`
   - DDoS plan still present and healthy:
     - `biqc-ddos-standard` provisioning state `Succeeded`
   - Health checks remain green on production and dev verification paths.

### Remaining blocker after closure wave

1. WAF attach remains externally blocked until Microsoft unblocks feature/provider path in this subscription.

### 2026-03-30 - WAF Escalation Update (Post Support-Plan Upgrade)

1. **Microsoft support case successfully raised from CLI**
   - Ticket name: `biqc-fd-waf-blocker-20260331080113`
   - Ticket ID: `2603300030008112`
   - Service: `Front Door Standard and Premium`
   - Classification: `Configuration and setup / Other`
   - Status: `Open`
2. **Support-plan gating resolved**
   - Previous `InvalidSupportPlan` blocker is cleared after upgrade to Standard support.
3. **Current waiting condition**
   - Pending Microsoft response to unblock WAF attachment path (`AllowFrontdoor` feature/provider-side state and correct post-retirement policy path guidance).

### 2026-03-30 - Live Retry After Ticket Open

1. Re-checked platform state and re-ran unblock commands:
   - `AllowFrontdoor` remains `Pending`.
   - Reissued feature register + provider register for `Microsoft.Network`.
2. Re-attempted WAF creation in Detection mode:
   - still fails with:
   - `BadRequest: Policy ArmResourceId has incorrect formatting`
3. `az afd security-policy list` remains empty for `biqc-fd-premium`.
4. Added fresh inbound communication to Microsoft support case:
   - communication: `biqc-waf-followup-20260331083759`
   - tracking: `2603300030008112`
   - request: explicit unblock action + ETA + exact supported API/path for WAF attach.

### Remaining enterprise completion items (post-wave)

1. Execute manual Microsoft support case via portal and complete WAF attach/cutover once unblocked.
2. Introduce/attach VNet topology and bind DDoS plan.
3. Execute formal load test evidence and DR drills using newly published runbooks.
4. Complete worker runtime transition evidence (App Service worker -> job-first).

## 2026-03-30 - Sprint Continuation (Infra + Documentation)

### Objective

Continue enterprise hardening while maintaining runtime stability and documenting the architecture/state as source-of-truth artifacts.

### Completed in this sprint wave

1. **Alerting delivery path activated**
   - Updated action group `biqc-wave1-ag` to include a primary email receiver.
   - This closes the prior gap where metric alerts existed but had no notification recipients.

2. **Subscription-level health signal coverage added**
   - Created activity log alert `biqc-subscription-service-health`.
   - Created activity log alert `biqc-subscription-resource-health`.
   - Both alerts target scope `/subscriptions/57d9a89b-4db8-4d17-8112-f3221346d684` and dispatch to `biqc-wave1-ag`.

3. **Front Door/WAF blocker revalidated**
   - `Microsoft.Network/AllowFrontdoor` remains `Pending`.
   - Front Door security policies list remains empty until platform gate completes.

4. **Operational stability reconfirmed**
   - Production and development web/API endpoints were rechecked healthy during this sprint continuation wave.

5. **Key Vault canary migration executed successfully**
   - Migrated dev API setting `SEMRUSH_API_KEY` on `biqc-api-dev` from plain value to Key Vault reference:
     - `@Microsoft.KeyVault(SecretUri=https://biqckvcore01.vault.azure.net/secrets/biqc-api-dev-semrush-api-key)`
   - Applied health-gated canary flow with rollback guard.
   - `biqc-api-dev` remained healthy (`/api/health` returned 200 immediately after restart cycle).

6. **Second Key Vault canary migration executed successfully**
   - Migrated dev frontend setting `AZURE_CLIENT_SECRET` on `biqc-web-dev` from plain value to Key Vault reference:
     - `@Microsoft.KeyVault(SecretUri=https://biqckvcore01.vault.azure.net/secrets/biqc-web-dev-azure-client-secret)`
   - Applied the same health-gated canary + rollback guard process.
   - `biqc-web-dev` remained healthy (root endpoint returned 200 immediately after restart cycle).

7. **Third Key Vault canary/batch migration executed successfully**
   - Migrated dev API settings on `biqc-api-dev`:
     - `MERGE_API_KEY`
     - `MERGE_WEBHOOK_SECRET`
     - `BROWSE_AI_API_KEY`
   - All three now reference Key Vault secrets and passed health-gated validation.

8. **Fourth Key Vault canary migration executed successfully**
   - Migrated `GOOGLE_CLIENT_SECRET` on `biqc-web-dev` to Key Vault reference.
   - Health remained stable after restart cycle.

9. **Post-change stability verification**
   - Confirmed healthy responses (HTTP 200):
     - `https://biqc.ai/`
     - `https://biqc.ai/api/health`
     - `https://biqc-web-dev.azurewebsites.net/`
     - `https://biqc-api-dev.azurewebsites.net/api/health`

10. **Runbook documentation added**
    - Added `docs/KEY_VAULT_CANARY_MIGRATION_RUNBOOK.md` with:
      - preconditions,
      - deterministic secret naming,
      - health-gated migration procedure,
      - rollback criteria,
      - current canary progress,
      - next recommended batch.

11. **Parallel agent execution wave completed**
    - Ran parallel infrastructure workstreams for:
      - dev secret centralization completion,
      - prod canary centralization,
      - WAF unblock attempts,
      - observability closure audit/remediation.
    - Consolidated and verified outputs in a final stabilization pass.

12. **Dev secret centralization materially completed**
    - `biqc-api-dev` additional secret migrations to Key Vault references (including `SERPER_API_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_*`, `RECAPTCHA_*`, `GOOGLE_CLIENT_SECRET`, `AZURE_CLIENT_SECRET`, and other previously plain secret keys).
    - `biqc-web-dev` additional secret migrations to Key Vault references (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `REACT_APP_SUPABASE_ANON_KEY`, `REACT_APP_RECAPTCHA_SITE_KEY`).
    - `biqc-worker-dev` secret coverage remained centralized (with only empty/non-secret items left plain).

13. **Production canary centralization materially advanced**
    - `biqc-web` migrated with health gates:
      - `AZURE_CLIENT_SECRET`
      - `GOOGLE_CLIENT_SECRET`
      - `SUPABASE_SERVICE_ROLE_KEY`
    - `biqc-api` migrated with health gates:
      - `ANTHROPIC_API_KEY`
      - `SERPER_API_KEY`
      - `MERGE_API_KEY`
      - `MERGE_WEBHOOK_SECRET`
      - `STRIPE_API_KEY`
      - `STRIPE_WEBHOOK_SECRET`
      - `RECAPTCHA_SECRET_KEY`
      - `AZURE_CLIENT_SECRET`
      - `GOOGLE_CLIENT_SECRET`
    - All migrations used restart + endpoint verification and rollback guardrails.

14. **Observability closure enhancements confirmed**
    - Existing metric alerts verified enabled (`16/16`).
    - Added activity-log alerts:
      - `biqc-activity-prod-apps-restart`
      - `biqc-activity-prod-apps-stop`
      - `biqc-activity-keyvault-admin-failed`
    - Existing subscription health activity alerts remain enabled and wired to `biqc-wave1-ag`.

### Known blocker

- WAF attach remains blocked by Azure feature-gate status:
  - `Microsoft.Network/AllowFrontdoor = Pending`.
- Additional platform response on direct `Microsoft.Cdn/CdnWebApplicationFirewallPolicies` create:
  - `Web Application Firewall Policy creation fails due to CDN WAF retirement.`
  - Net effect: WAF attach remains platform-blocked pending Azure-side path/state resolution.
- End-of-wave recheck confirms feature state is still `Pending`.

### Remaining priority items after this wave

1. Attach WAF policy and finalize Front Door protected routing after feature state changes to `Registered`.
2. Complete optional Key Vault normalization for any intentionally public or placeholder settings.
3. Attach DDoS plan to VNets once network topology is introduced/confirmed.
4. Run formal load test and DR evidence runbook execution for enterprise closure.

### Change discipline

- No app code paths changed in this sprint log wave.
- Infra changes included monitoring/alerting controls, guarded secret centralization, and platform status validation.
