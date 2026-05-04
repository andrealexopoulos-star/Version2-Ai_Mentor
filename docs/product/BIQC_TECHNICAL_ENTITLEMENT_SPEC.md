# BIQC Technical Entitlement Spec

## 1. Purpose
This document is the technical source of truth for entitlement enforcement, billing behavior, top-up lifecycle handling, and copy/contract parity controls for BIQc Day 1 metered billing.
Implementation must be derivable from this specification without inference.

## 2. Canonical internal tier keys
- `starter` (customer-facing Growth)
- `pro`
- `business`
- `specialist` (custom contract)
- `enterprise`
- `custom_build`
- `super_admin`
- `trial` (intro state bound to selected paid tier)

## 3. Customer-facing tier labels
- Growth
- Pro
- Business
- Specialist

## 4. Seat constants
- `starter`: 1
- `pro`: 5
- `business`: 12
- `specialist`: custom
- `enterprise` / `custom_build` / `super_admin`: custom or uncapped by internal convention

## 5. Token allowance constants
- `starter`: 1,000,000 total tokens/cycle
- `pro`: 5,000,000 total tokens/cycle
- `business`: 20,000,000 total tokens/cycle
- `specialist`: custom

## 6. Top-up constants
- `TOPUP_TOKENS = 250_000`
- `TOPUP_PRICE_AUD_CENTS = 1900`
- capacity applies to current cycle only
- no base plan mutation

## 7. Monthly top-up cap constants
- `starter`: 3
- `pro`: 5
- `business`: 10
- `specialist`: custom

## 8. Auto top-up eligibility rules
Auto top-up is executable only when all conditions are true:
- explicit consent record exists
- auto top-up enabled flag is true
- Stripe customer id exists
- Stripe subscription id exists
- subscription status in `active|trialing`
- cycle top-up cap not exceeded
- `payment_required == false`
- no duplicate pending top-up in same cycle/threshold/idempotency scope

## 9. Manual top-up rules
- initiated only from authenticated billing UI
- same pack as auto top-up (250K / 19 AUD)
- idempotent
- recorded as a top-up attempt
- grants tokens only after success state

## 10. Billing cycle rules
- top-up validity is limited to current billing cycle
- cycle boundaries drive allowance, cap, and idempotency scope
- first paid charge occurs day 15 for intro period flows; then every 30 days

## 11. Usage ledger requirements
- ledger must support and be used for `consume`, `topup`, and `reset`
- top-up rows must include Stripe references (`payment_intent` and/or invoice IDs)
- capacity calculations include successful top-up grants only
- failed or action-required attempts must not create grant rows

## 12. Top-up attempt state machine
Top-up lifecycle is represented with explicit states and audited transitions.

## 13. Consent audit requirements
- explicit consent stored as event records (not only boolean)
- each event captures actor, timestamp, source, consent_version
- revocation event support required

## 14. Stripe requirements
- Stripe customer and subscription required for paid access
- top-up execution bound to Stripe payment artifacts
- runtime env validation required before enabling payment paths

## 15. Webhook requirements
Webhook ingestion must process top-up and subscription lifecycle events idempotently and without duplicate grants.

## 16. Idempotency rules
- deterministic idempotency key for each top-up attempt scope
- duplicate pending attempts in same cycle/threshold scope forbidden
- webhook replay must not duplicate token grants or state transitions

## 17. Payment failure rules
- no token grant
- set/retain `payment_required=true` as needed
- preserve existing intelligence visibility
- pause new AI/cognition when capacity exhausted

## 18. Payment action required rules
- no token grant
- mark attempt as `requires_action`
- set user-visible actionable billing state
- no silent fallback charge

## 19. Token hard-stop rules
- warning at 80% usage
- urgent warning at 95% usage
- hard stop at 100% unless successful top-up capacity exists
- no additional AI/cognition usage beyond available capacity

## 20. Existing intelligence visibility rule
When hard stop is active, existing intelligence remains visible/readable. Only new AI/cognition execution is paused.

## 21. Memory metering rule
Meter where technically measurable. Implementation blocker — exact measurable limit not approved.

## 22. Storage metering rule
Meter where technically measurable. Implementation blocker — exact measurable limit not approved.

## 23. Sync-depth rule
- `starter`: 90 days
- `pro`: 365 days
- `business`: 1,095 days
- `specialist`: custom

## 24. PDF/export/reporting metering rule
Meter where technically measurable. Implementation blocker — exact measurable limit not approved.

## 25. Integration policy
- all paid tiers get all supported integrations
- no paid connector-count caps
- avoid public wording "unlimited integrations"

## 26. Trial/introductory-period technical rule
- no standing free plan
- no unauthenticated trial path
- selected tier + payment method required at onboarding
- Stripe customer/subscription created day one
- 14-day included period before first payment
- paid gate requires `stripe_customer_id`, `stripe_subscription_id`, and status `active|trialing`

## 27. Route access principle
Route/API access must derive from canonical entitlement constants and billing linkage checks.
Frontend and backend route gate behavior must remain parity-locked.

## 28. Forbidden public copy gate
The following strings/patterns are blocked from customer-facing pricing/billing surfaces:
- War Room
- Board Room
- Professional
- Free plan
- Free trial
- Unlimited integrations
- Unlimited usage
- Three free ways
- 30-minute call
- Free Calibration Scan
- Additional seat pricing to be finalised
- AI usage above allowance may be charged
- Add paid seat
- unsupported top-up claims
- unsupported memory enforcement claims
- unsupported storage enforcement claims
- unsupported sync-depth claims
- raw Stripe/payment error details

## 29. Constants
| Constant | Value |
|---|---|
| `STARTER_SEATS` | `1` |
| `PRO_SEATS` | `5` |
| `BUSINESS_SEATS` | `12` |
| `STARTER_TOKENS` | `1_000_000` |
| `PRO_TOKENS` | `5_000_000` |
| `BUSINESS_TOKENS` | `20_000_000` |
| `TOPUP_TOKENS` | `250_000` |
| `TOPUP_PRICE_AUD_CENTS` | `1900` |
| `STARTER_TOPUP_CAP` | `3` |
| `PRO_TOPUP_CAP` | `5` |
| `BUSINESS_TOPUP_CAP` | `10` |
| `WARNING_THRESHOLD` | `0.80` |
| `URGENT_WARNING_THRESHOLD` | `0.95` |
| `HARD_STOP_THRESHOLD` | `1.00` |

## 30. Required Backend Objects
| Object | Type | Required? | Purpose |
|---|---|---:|---|
| Entitlement constants module | Module | Yes | Canonical values for seats/tokens/top-up/caps/thresholds |
| Usage ledger top-up writer | Service/function | Yes | Write `kind='topup'` grants only after success |
| Top-up attempts table | Data model/table | Yes | Track attempt lifecycle/idempotency/scope/status |
| Top-up consent events table | Data model/table | Yes | Audit explicit consent and revocation |
| Top-up service | Service | Yes | Manual/auto initiation and policy checks |
| Billing overview endpoint | API endpoint | Yes | Expose billing/usage/top-up state for UI |
| Manual top-up endpoint | API endpoint | Yes | Trigger manual top-up flow |
| Auto top-up settings endpoint | API endpoint | Yes | Toggle and read auto top-up settings |
| Monthly cap endpoint | API endpoint | Yes | Read/update per-plan cap where applicable |
| Stripe webhook handlers | API handler | Yes | Apply payment lifecycle transitions |
| `payment_required` state writer | Service/function | Yes | Lock/unlock based on payment outcomes |
| `topup_warned_at` writer | Service/function | Yes | De-duplicate threshold warnings |
| Idempotency guard | Service/function | Yes | Prevent duplicate attempts and grants |

## 31. Stripe Event Handling
| Stripe Event | Required Handling |
|---|---|
| `payment_intent.succeeded` | Mark attempt succeeded, grant tokens once, clear lock where applicable |
| `payment_intent.payment_failed` | Mark attempt failed, no token grant, set `payment_required` |
| `payment_intent.requires_action` (or equivalent status) | Mark `requires_action`, no token grant, surface UI action requirement |
| `invoice.payment_succeeded` (if relevant) | Sync lifecycle/lock clear behavior for recurring billing |
| `invoice.payment_failed` (if relevant) | Sync lifecycle failure state and user billing alerts |
| `customer.subscription.updated` | Sync subscription linkage/status gating fields |
| `customer.subscription.deleted` | Enforce loss of paid-access entitlement path |

## 32. Top-Up State Machine
| State | Meaning | Token Grant? | Customer UX |
|---|---|---:|---|
| `disabled` | Auto top-up not enabled/consented | No | Toggle available, no auto charges |
| `enabled` | Auto top-up eligible baseline state | No | Auto top-up active indicator |
| `pending` | Attempt created, awaiting payment outcome | No | Processing state |
| `requires_action` | Payment needs user action/authentication | No | Action-required banner/CTA |
| `failed` | Payment failed definitively | No | Payment failure banner, update card CTA |
| `succeeded` | Payment captured and grant written | Yes | Success confirmation, capacity increased |
| `cap_reached` | Monthly top-up cap reached | No | Upgrade/Specialist prompt |
| `exhausted` | Total available capacity consumed | No | Hard-stop for new AI/cognition |
| `cycle_reset` | New cycle started and counters reset | No | Refreshed capacity state |

## 33. API Contract
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/billing/overview` | Return billing/usage/top-up state for account |
| `PATCH` | `/billing/auto-topup` | Enable/disable auto top-up |
| `PATCH` | `/billing/topup-cap` | Set/read monthly top-up cap policy |
| `POST` | `/billing/topup/consent` | Record explicit top-up consent event |
| `POST` | `/billing/topup` | Initiate manual top-up attempt |
| `POST` | `/webhook/stripe` | Process Stripe event-driven billing/top-up transitions |

## 34. Required tests
- `backend/tests/test_entitlement_policy_contract.py`
- `backend/tests/test_billing_usage.py`
- `backend/tests/test_topup_initiation.py`
- `backend/tests/test_topup_webhook_success.py`
- `backend/tests/test_topup_webhook_failure.py`
- `backend/tests/test_topup_webhook_idempotency.py`
- `backend/tests/test_topup_cap.py`
- `backend/tests/test_payment_required_state.py`
- `backend/tests/test_subscription_entitlement_gate.py`
- `backend/tests/test_route_access_parity.py`
- frontend billing contract test if test structure exists

## 35. Required CI/evidence gates
- contract parity gate
- pricing copy parity/forbidden-copy gate
- route parity gate
- Stripe env validation gate
- top-up pack parity gate
- scope guard for non-billing website redesign files
- billing test suite merge blocker

## 36. Open implementation blockers
- BLOCKER: memory exact measurable limit missing
- BLOCKER: storage exact measurable limit missing
- BLOCKER: PDF/export exact included limit missing
- BLOCKER: sync-depth enforcement must be verified end-to-end before customer claims go live
- BLOCKER: Stripe top-up product/price IDs or config required
- BLOCKER: top-up transaction pipeline must be implemented before top-up copy goes live
- BLOCKER: top-up consent audit table required
- BLOCKER: top-up attempts table required
- BLOCKER: frontend billing UI must be wired to real backend state
- BLOCKER: legacy billing UI must not remain active billing source of truth
