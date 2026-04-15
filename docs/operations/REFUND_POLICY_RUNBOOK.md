# Refund Policy — Operations Runbook

_Step 14 / P1-9. Companion to the public-facing Refund Policy at [/trust/refund-policy](https://biqc.ai/trust/refund-policy)._

This runbook is the procedural how-to for ops. The public page is the contract with the customer; everything here should be consistent with that page. When the two disagree, the public page wins and this runbook is updated.

## When to use this runbook

A refund request has landed in `support@biqc.ai` and you need to decide:

1. Is the request eligible under policy?
2. How much (if anything) is refunded and in what form — cash vs credit?
3. How do you execute it in Stripe + our DB without drift?

## 30-second decision tree

```
┌─ Charge within 7 days of FIRST paid invoice?
│    ├─ yes  →  §2 satisfaction_7day — full cash refund
│    └─ no   →  continue
│
├─ Downgrade mid-cycle?
│    └─ Calculate unused portion of higher tier → credit_issued_cents
│       Refund reason: plan_downgrade_credit. Credit applied on next invoice.
│
├─ Annual cancel mid-term?
│    └─ Pro-rata unused months → account credit (not cash)
│       Refund reason: annual_cancel_credit.
│
├─ Billing error (duplicate / wrong amount / failed provisioning)?
│    └─ Refund in full (cash) + file stripe_reconcile_log entry
│       Refund reason: billing_error.
│
├─ Chargeback incoming / disputed?
│    └─ If we agree the charge is wrong → pre-empt with refund
│       Refund reason: chargeback_reversal.
│
├─ Outside policy but ops decides to refund anyway?
│    └─ Flag for SLT review before issuing
│       Refund reason: goodwill. Must log rationale.
│
└─ Something else?
     └─ Refund reason: other. Open a reconcile_log row to describe it.
```

## Executing a cash refund (§2, billing_error, chargeback_reversal, goodwill)

All three use the same execution steps. Only the `refund_reason` differs.

1. **Locate the charge in Stripe.** Pull up the customer in the Stripe dashboard, then the specific `ch_...` charge. Verify it matches the amount the customer is disputing and that it isn't already refunded.
2. **Issue the refund in Stripe.** Click _Refund_ → full or partial → note reason in the Stripe memo (use the same `refund_reason` code for consistency).
3. **Update `payment_transactions`.** Run the following in the Supabase SQL editor (or via the `supabase` CLI with the service role):
   ```sql
   UPDATE public.payment_transactions
   SET refunded_at         = now(),
       refund_reason       = 'satisfaction_7day',    -- or the chosen code
       refund_initiated_by = 'ops@biqc.ai',          -- your email
       credit_issued_cents = NULL                    -- cash refund
   WHERE session_id = 'cs_...';                      -- or id = 'uuid'
   ```
4. **Confirm with the customer.** Reply to their support thread with the Stripe refund ID and the expected 5–10 business-day window.
5. **Close the loop in Notion.** Drop a one-line entry in the `Refund Log` database with charge ID, reason, amount, and refunded_at. (If we eventually wire up `backend/jobs/stripe_reconcile.py` to auto-log refunds, this step goes away.)

## Executing a credit (§3 plan_downgrade_credit, §4 annual_cancel_credit)

Credits are not refunds — the customer never sees cash come back. They see a reduction on their next invoice. Do NOT issue a Stripe refund for these.

1. **Compute the credit.**
   - **Downgrade** (§3): `credit_cents = old_tier_cents × (remaining_days / period_days)` minus the new tier's prorated charge for those same days.
   - **Annual cancel** (§4): `credit_cents = annual_cents × (remaining_full_months / 12)`. Deduct any annual-discount differential so we don't effectively refund more than the customer paid.
2. **Apply the credit in Stripe.** Customer → Balance → _Add credit_ → enter amount → set description to match the refund reason.
3. **Update `payment_transactions`.** Same shape as a cash refund but keep `credit_issued_cents` populated and do NOT set `refunded_at` to a cash refund timestamp — use the credit issue date.
   ```sql
   UPDATE public.payment_transactions
   SET refunded_at         = now(),
       refund_reason       = 'plan_downgrade_credit',   -- or annual_cancel_credit
       refund_initiated_by = 'ops@biqc.ai',
       credit_issued_cents = 3450   -- e.g. $34.50 in cents
   WHERE session_id = 'cs_...';
   ```
4. **Confirm with the customer.** Reply with the credit amount and a note that it will appear on their next invoice.

## Hard-no requests

The policy explicitly excludes these. Decline politely and point at the Refund Policy page:

- **Usage overages already billed.** Stripe's metered line items are consumption we've already paid our LLM bill for. Explain the overage dashboard and any applicable caps.
- **Custom build / Enterprise engagements post-kickoff.** These are governed by the SOW; the refund clause there supersedes this policy.
- **Consumed add-on bundles.** Snapshots / deep-analysis runs are one-shot. Once run, no refund.
- **Accounts terminated for Acceptable Use violations.** Ops must have written evidence of the violation in the support thread.
- **Partial months outside the 7-day window.** Direct them to the cancel button in billing; access continues to period end.

## Reconciliation with Stripe

Nightly, `backend/jobs/stripe_reconcile.py` scans Stripe for drift and writes to `public.stripe_reconcile_log`. A row with `drift_type='status_mismatch'` on a subscription you refunded usually means the DB update was missed — re-run the UPDATE from step 3 / 3 above, then mark the reconcile_log row resolved.

## When policy says no but ops wants yes

`refund_reason = 'goodwill'` exists specifically for this. Use it when:

- The customer is clearly upset but not legally entitled.
- The expected retention value outweighs the one-time refund cost.
- SLT has signed off in #biqc-ops.

Record the signoff in the Notion Refund Log and leave a short note in `refund_initiated_by` (e.g. `ops@biqc.ai (SLT-approved)`).

## Reporting

These views light up automatically once the migration is applied:

- **Open refunds by reason (current month)**:
  ```sql
  SELECT refund_reason, COUNT(*) AS n, SUM(amount) AS total_refunded
  FROM public.payment_transactions
  WHERE refunded_at >= date_trunc('month', now())
  GROUP BY refund_reason
  ORDER BY n DESC;
  ```
- **Credits outstanding** (issued but not yet applied):
  ```sql
  SELECT user_id, SUM(credit_issued_cents) / 100.0 AS credit_dollars
  FROM public.payment_transactions
  WHERE credit_issued_cents > 0
  GROUP BY user_id
  ORDER BY credit_dollars DESC;
  ```

## Links

- Public policy: https://biqc.ai/trust/refund-policy
- Migration: `supabase/migrations/098_refund_columns.sql`
- Reconcile job: `backend/jobs/stripe_reconcile.py`
- Drift log table: `public.stripe_reconcile_log` (migration 097)
