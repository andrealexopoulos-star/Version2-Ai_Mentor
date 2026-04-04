# BIQc Pricing Governance Approval Model

## Purpose
- Close billing/pricing cross-functional governance gaps with explicit approval ownership.
- Prevent pricing-packaging drift, trust regressions, and unauthorized commercial changes.

## Approval Contract (Mandatory)
- Product approval: validates UX/IA coherence and tier value narrative.
- Finance approval: validates margin, supplier cost alignment, and CFO truth controls.
- Legal approval: validates terms, disclosure copy, and consumer/commercial compliance.
- No publish action is valid unless all three approvals are present for the release version.

## Governance Matrix

| Change Type | Product | Finance | Legal | Required Artifact |
|---|---|---|---|---|
| Tier packaging/feature movement | required | required | required | release pricing decision record |
| Price point changes | required | required | required | pricing impact + margin model |
| Entitlement fallback behavior | required | required | required | entitlement contract diff |
| UX-only copy (no commercial promise) | required | optional | required | copy approval log |
| Experimental pricing tests | required | required | required | experiment guardrail approval |

## Hard Gates
- FAIL · `BILLING-PRICING-GOVERNANCE-01` · `TRIPLE_APPROVAL_NOT_ENFORCED` · `reports/BIQC_PRICING_GOVERNANCE_APPROVAL_MODEL_2026-04-03.md`
- FAIL · `BILLING-CHECKOUT-INTEGRITY-01` · `END_TO_END_APPROVAL_BINDING_NOT_VERIFIED` · `reports/BIQC_PRICING_GOVERNANCE_APPROVAL_MODEL_2026-04-03.md`

## Required Evidence For PASS
- Versioned approval object tied to publish/rollback API actions.
- Immutable pricing release audit log with approver IDs and timestamp.
- CI gate that blocks deploy if approval bundle is absent or incomplete.
