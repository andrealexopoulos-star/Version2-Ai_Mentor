# F15 — SEMrush API Units Budget Explainer

**Author:** F15
**Date:** 2026-05-04
**Audience:** Andreas (CEO) — for plan-tier sizing and capacity planning
**Source code:** `supabase/functions/semrush-domain-intel/index.ts`

## TL;DR for Andreas

The header comment in the SEMrush edge function previously claimed `~232 units worst-case per scan`. The real number is **~3650 units worst-case per uncached scan** — about **15× higher than documented**. The 24-hour cache (R2D added) is the only reason this is sustainable on a Pro plan.

---

## Why the old number was wrong

R2D's deepening branch bumped `domain_organic` from 20 lines → **100 lines**, and added two new high-cost endpoints (`domain_organic_pages` at 10 units/line × 20 lines = 200 units, and `domain_adwords_history` at **100 units/line** × 12 lines = **1200 units**). The header comment was not updated to match the new line counts and per-line costs.

Per-line costs come from `UNIT_COSTS` table at the top of `index.ts:54-63` (sourced from developer.semrush.com pricing pages, snapshot 2026-04):

| Endpoint                  | Per-line cost | Flat cost | Lines requested | Worst-case units |
|---------------------------|---------------|-----------|-----------------|------------------|
| domain_rank               | 0             | 10        | n/a             | 10               |
| domain_organic            | 10            | 0         | 100             | 1000             |
| domain_adwords            | 20            | 0         | 20              | 400              |
| domain_organic_organic    | 40            | 0         | 10              | 400              |
| domain_adwords_adwords    | 40            | 0         | 10              | 400              |
| backlinks_overview        | 0             | 40        | n/a             | 40               |
| domain_organic_pages      | 10            | 0         | 20              | 200              |
| domain_adwords_history    | **100**       | 0         | 12              | **1200**         |
| **TOTAL**                 |               |           |                 | **3650**         |

Typical scans of low-traffic Aussie SMB domains return far fewer rows (most domains don't have 100 organic keywords ranking, don't have 12 months of paid history, etc.) so the typical case is ~200–600 units. But the header has to document the worst case for capacity planning.

---

## What this means for plan-tier sizing

### Pro plan (~$140/mo, 1,000,000 units/month)
- **Worst-case-only**: 1,000,000 ÷ 3,650 = **~273 unique uncached scans/month**
- **With 24h cache (typical re-scan rate)**: effectively **2,000–10,000+ scans/month** because most domains get re-scanned within the TTL window (zero units on cache hit)

### Guru plan (~$250/mo, 3,000,000 units/month)
- Worst-case-only: ~821 uncached scans/month
- With cache: effectively 8,000–30,000+ scans/month

### Business plan (~$500/mo, 5,000,000 units/month)
- Worst-case-only: ~1,369 uncached scans/month
- With cache: effectively 15,000–50,000+ scans/month

---

## The 24-hour cache is the saving grace

R2D's branch bumped `EDGE_TTL` for SEMrush to `SCAN_TTL=86400` (24 hours). Without this cache, Pro plan would exhaust in <300 scans/month. With it, repeated scans of the same domain in 24h cost **zero units**, lifting effective capacity 10–100×.

For BIQc retention math: an SMB customer running a calibration scan on their own domain ~weekly only spends ~3,650 units/month (1 uncached + ~6 cached at zero cost). 273 customers × 3,650 = ~1M units = exactly Pro plan capacity. With the cache + competitor domain re-use, real capacity is 5–10× that.

---

## Recommendation

- **Stay on Pro tier** for the trial-customer phase (<100 paying customers). Cache + low re-scan churn keeps us well under the cap.
- **Move to Guru** once paid customer count crosses ~150 OR when we add competitor-domain scanning (each scan would then trigger 5–10 sub-scans of competitor domains).
- **Add a units-used dashboard** to operations memory (`ops_daily_health_check_procedure.md`) — pull `provider_telemetry.api_units_used` from `business_dna_enrichment.enrichment` and roll up monthly to monitor against the cap.

---

## Where this is documented in code

After F15 fix, the header comment block in `supabase/functions/semrush-domain-intel/index.ts` lines 18–46 has the corrected breakdown table. The per-endpoint cost source-of-truth is `UNIT_COSTS` at lines 54–63 (already correct — the bug was only in the human-readable header).
