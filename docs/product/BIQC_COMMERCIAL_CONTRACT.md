# BIQC Commercial Contract

## 1. Purpose
This document is the commercial source of truth for BIQc Day 1 metered billing and top-ups.
It defines approved public commercial promises and the non-negotiable contract that implementation, tests, and go-live copy must follow.

## 2. Approved positioning
BIQc is a paid platform with tiered capacity.
Top-ups extend monthly AI capacity within the current cycle and do not change base plan tier.
Capacity and access claims must reflect enforced backend behavior.

## 3. Pricing and Plan Contract
| Plan | Internal Tier | Price | Seats | Tokens | Top-Up Cap | Sync Depth | Memory | Integrations | Support | CTA |
|---|---|---:|---:|---:|---:|---|---|---|---|---|
| Growth | starter | $69 AUD/month | 1 user | 1M tokens | 3 top-ups | 90 days | Starter business memory | all supported integrations | Email support | Start with Growth |
| Pro | pro | $199 AUD/month | up to 5 users | 5M tokens | 5 top-ups | 365 days | Extended business memory | all supported integrations | Priority support | Choose Pro |
| Business | business | $349 AUD/month | up to 12 users | 20M tokens | 10 top-ups | 1,095 days | Long-term business memory | all supported integrations | Priority support | Choose Business |
| Specialist | specialist | Custom | Custom | Custom | Custom | Custom | Custom | all supported + custom planning | Specialist-led | Book a call with a BIQc Specialist |

## 4. Approved seat model
- Growth / Starter: 1 user
- Pro: up to 5 users
- Business: up to 12 users
- Specialist: custom
- Enterprise/custom/super_admin: custom or uncapped depending on internal convention

## 5. Approved token model
- Growth: 1,000,000 total AI tokens per account per month
- Pro: 5,000,000 total AI tokens per account per month
- Business: 20,000,000 total AI tokens per account per month
- Specialist: custom

## 6. Approved top-up model
- Pack size: 250,000 AI tokens
- Price: 19 AUD per pack
- Scope: account/business-level
- Validity: current billing cycle only
- Plan impact: does not change base plan
- Grant rule: tokens are granted only after payment succeeds

## 7. Approved monthly top-up caps
- Growth: 3 packs per billing cycle
- Pro: 5 packs per billing cycle
- Business: 10 packs per billing cycle
- Specialist: custom

## 8. Approved auto top-up conditions
Auto top-up is allowed only when all are true:
- explicit customer consent is recorded
- auto top-up is enabled
- Stripe customer exists
- Stripe subscription exists
- subscription status is active or trialing
- monthly top-up cap has not been reached
- `payment_required` is false
- no duplicate pending top-up exists for the same cycle/threshold/idempotency key

## 9. Approved manual top-up model
- Manual top-up is allowed from billing UI
- Uses the same 250K / 19 AUD pack
- Must be idempotent
- Must be recorded

## 10. Approved sync-depth model
- Growth: 90 days
- Pro: 365 days
- Business: 1,095 days
- Specialist: custom

## 11. Approved memory/storage/PDF/export metering position
- memory: metered where technically measurable, not auto-charged
- storage: metered where technically measurable, not auto-charged
- sync depth: metered/enforced per approved plan values, not auto-charged
- PDF/export/reporting: metered where technically measurable, not auto-charged

Where exact measurable limits are missing, implementation must treat this as:
"Implementation blocker — exact measurable limit not approved."

## 12. Approved integration policy
- all paid plans get all supported integrations
- no paid connector-count cap
- do not use "unlimited integrations"
- use "all supported integrations"

## 13. Approved trial/introductory-period model
- no standing free plan
- no loose unauthenticated free trial
- user selects a tier
- user enters card/payment method
- Stripe customer and subscription exist from day one
- selected tier includes 14 days before first payment
- first charge occurs on day 15
- billing then recurs every 30 days

Allowed wording:
- "14 days included before your first payment"

Forbidden wording:
- Free plan
- Free trial
- Free Calibration Scan

## 14. Approved access model
Paid access requires:
- `stripe_customer_id`
- `stripe_subscription_id`
- subscription status `active` or `trialing`

Access that does not meet these billing-linkage rules must be treated as non-paid access.

## 15. Approved pricing-page wording

### Growth
- For business owners who want BIQc operating across their core business signals.
- 1 user included
- 1M AI tokens per month
- Foundational AI capacity
- All supported integrations
- 90 days data sync history
- Starter business memory
- AI usage pauses at plan limit unless top-up capacity is available
- Top-ups available
- Email support
- CTA: Start with Growth

### Pro
- For growing teams that want BIQc across leadership, revenue, operations and finance.
- Up to 5 users included
- 5M AI tokens per month
- Active AI capacity
- All supported integrations
- 365 days data sync history
- Extended business memory
- AI usage pauses at plan limit unless top-up capacity is available
- Top-ups available
- Priority support
- Badge: Most popular
- CTA: Choose Pro

### Business
- For businesses that need deeper intelligence capacity, more users and stronger operating visibility.
- Up to 12 users included
- 20M AI tokens per month
- High-volume AI capacity
- All supported integrations
- 1,095 days data sync history
- Long-term business memory
- AI usage pauses at plan limit unless top-up capacity is available
- Top-ups available
- Priority support
- CTA: Choose Business

### Specialist
- For businesses that need custom users, higher AI capacity, advanced integrations or specialist onboarding.
- Custom users
- Custom AI capacity
- Custom sync history
- Custom integration planning
- Custom business memory
- Specialist-led setup
- Multi-location support
- Commercial review with a BIQc Specialist
- CTA: Book a call with a BIQc Specialist

Footnote:
- AI capacity is allocated to your business account. Additional AI capacity can be added through top-ups where available. Need more users or custom capacity? Upgrade your plan or book a call with a BIQc Specialist.

## 16. Top-Up Commercial Rules
| Rule | Approved Contract |
|---|---|
| Pack size | 250K AI tokens |
| Price | $19 AUD |
| Applies to | Current billing cycle only |
| Scope | Account/business-level |
| Auto-charge allowed? | Yes, only with explicit consent and cap controls |
| Manual top-up allowed? | Yes |
| Token grant timing | Only after successful payment |
| Failed payment | No tokens granted |
| Payment action required | No tokens granted |
| Duplicate charges | Forbidden |
| Existing intelligence | Remains visible |
| New AI usage | Pauses when capacity is exhausted |

## 17. What Is Not Auto-Charged
- memory expansion
- storage expansion
- sync-depth expansion
- extra seats
- Specialist onboarding
- custom integrations
- compliance/data retention add-ons
- priority support
- failed-payment retry fees

## 18. Forbidden public copy list
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

## 19. Specialist trigger
Specialist pathway must be used for:
- 13+ users
- multi-entity business
- regulated or compliance-heavy business
- custom onboarding
- custom integration planning
- unusually high AI usage
- bespoke support/advisory requirement
- sync depth or memory needs beyond Business

## 20. Day 1 implementation rules
- no token grant before successful payment
- no silent unlock
- no duplicate charging
- no silent failure
- existing intelligence remains visible at hard stop
- new AI/cognition pauses when included + successful top-up capacity is exhausted
- top-up must be visible in billing and usage surfaces
- top-up must be tied to Stripe payment/invoice references
- no unsupported customer-facing claim may go live before enforcement exists

## 21. What must not be invented
Do not invent:
- prices
- limits
- overage behavior
- entitlement gates
- customer-facing promises
- measurable limits for memory/storage/PDF/export/reporting if not approved
- auto-charge behavior outside approved top-up model

## 22. Change-control rule
No commercial value, limit, price, entitlement, auto-charge behaviour, route gate, or customer-facing billing promise may be changed without updating this contract and the technical entitlement spec in the same PR.
