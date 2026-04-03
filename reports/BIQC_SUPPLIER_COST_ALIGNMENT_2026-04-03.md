# BIQc Supplier And Cost Alignment

Date: 2026-04-03  
Inputs: `reports/BIQC_SUPPLIER_LIVE_MATRIX_2026-04-03.json`, `reports/BIQC_FEATURE_TIER_MATRIX_TARGET_2026-04-03.csv`, `scripts/prod_supplier_telemetry_snapshot.py`

## Production Supplier Baseline
- Supabase prod project linked and healthy (`vwwandhoydemcybltoxz`).
- Azure production web apps and premium plans active.
- Vendor probes available for Stripe, OpenAI, Anthropic, Perplexity, Serper, SEMrush.
- Firecrawl currently reports endpoint-contract drift (`404`) and remains a monitored dependency risk.

## Cost-Constrained Tier Controls
1. **High variable-cost surfaces**
   - `Ask BIQc`, `Market & Position`, `Competitive Benchmark`, `Revenue`, `Boardroom`.
   - Control with tiered monthly limits and model routing by tier.

2. **Connector and ingestion surfaces**
   - `Connectors`, `Data Health`, `Ingestion Audit`, `Operations`.
   - Control with connector count by tier and ingestion cadence caps.

3. **Governance and monitoring surfaces**
   - `Watchtower`, `Data Center`, `Operator Intelligence`.
   - Keep staged until enterprise-grade reliability and telemetry controls are proven.

## Telemetry Threshold Integration
- Current script defaults retained for release evidence:
  - Supabase MAU warn/hard: `40,000 / 50,000`
  - Supabase storage warn/hard: `8 GiB / 10 GiB`
  - Supabase DB size warn/hard: `1 GiB / 2 GiB`
- Tier policy impact:
  - When warn threshold trips, throttle free/high-cost workloads first.
  - When hard threshold trips, block non-critical expansion routes and require release override evidence.

## Supplier-Driven Entitlement Decisions
- Keep Free tier limited to stable, lower-risk pathways.
- Keep Pro/Enterprise uplift focused on modules with higher supplier and compute consumption.
- Keep Custom Build as explicit commercial override, not an implicit route-access bypass.

## Operational Requirement
- Each tier/policy release must attach:
  - latest supplier snapshot artifact
  - feature-tier matrix revision artifact
  - checkpoint ledger update with PASS/FAIL lines.
