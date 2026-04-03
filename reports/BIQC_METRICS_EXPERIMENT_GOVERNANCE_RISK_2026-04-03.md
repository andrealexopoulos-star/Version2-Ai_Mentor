# BIQc Metrics, Experiment, Governance, and Risk Plan

Date: 2026-04-03

## H. Metrics And Experiment Plan

### Baseline and Target Metrics
- **Navigation comprehension**
  - Baseline: first-session menu confusion events per 100 sessions
  - Target: reduce by 30%
- **Tier upgrade CTR**
  - Baseline: upgrade click-through from locked surfaces
  - Target: improve by 20% without trust-regression events
- **Activation-to-value time**
  - Baseline: minutes from first login to first meaningful action/output
  - Target: reduce by 25%
- **Retention/churn by tier**
  - Baseline: 30-day retained and churned users per tier
  - Target: improve retention and reduce churn trend in Free->Starter progression

### Event Schema (Minimum)
- `menu_item_clicked`
- `locked_route_redirected`
- `upgrade_cta_shown`
- `upgrade_cta_clicked`
- `integration_confidence_state_seen`
- `tier_disclosure_viewed`
- `ask_biqc_response_with_partial_coverage`
- `feature_unlock_success`

### Experiment Design
- Use phased rollout with holdout cohorts.
- Primary comparisons:
  - current nav IA vs consolidated IA
  - baseline lock copy vs explicit value-first lock copy
- Statistical threshold:
  - minimum confidence threshold agreed with Product Analytics before rollout signoff.
- Stop conditions:
  - trust complaint increase above threshold
  - billing confusion spike
  - CFO truth-control degradation signal

## Commercial Governance
- **UX-only IA/copy changes**
  - Approver: Product lead
- **Packaging/tier entitlement changes**
  - Approvers: Product + Finance
- **Pricing changes and legal disclosure impact**
  - Approvers: Product + Finance + Legal

## I. Risk Register

- **Trust regression risk**
  - Trigger: increased low-confidence complaints
  - Mitigation: stronger confidence disclosure and fallback visibility
- **Billing confusion risk**
  - Trigger: increased billing support tickets after tier copy updates
  - Mitigation: simplify in-product tier disclosure and checkout explanation
- **Conversion manipulation risk**
  - Trigger: lock/upgrade copy failing transparency review
  - Mitigation: enforce anti-dark-pattern copy checks
- **Legal/compliance misrepresentation risk**
  - Trigger: tier claims exceed enforced capability
  - Mitigation: model/tier contract validation before release
- **CFO truth-control degradation risk**
  - Trigger: evidence chain breaks or gate bypass without logged exception
  - Mitigation: strict gate reporting and checkpoint evidence updates

## Governance Gate IDs
- `PASS|FAIL · METRICS-BASELINE-TARGET-01 · failure_code_or_- · artifact`
- `PASS|FAIL · EXPERIMENT-GUARDRAILS-01 · failure_code_or_- · artifact`
- `PASS|FAIL · COMMERCIAL-GOVERNANCE-SIGNOFF-01 · failure_code_or_- · artifact`
- `PASS|FAIL · RISK-REGISTER-COVERAGE-01 · failure_code_or_- · artifact`
