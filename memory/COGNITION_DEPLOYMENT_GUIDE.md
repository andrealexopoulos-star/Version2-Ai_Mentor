# BIQc Cognition Core v2 — Pre-Deployment Verification Report
## 2 March 2026

## COLUMN ALIGNMENT: ALL 15 VERIFIED

| Column | Table (044) | Used in Functions (045) | Status |
|--------|-------------|------------------------|--------|
| industry_override | propagation_rules | fn_compute_propagation_map | ALIGNED |
| amplification_factor | propagation_rules | fn_compute_propagation_map | ALIGNED |
| dampening_factor | propagation_rules | fn_compute_propagation_map | ALIGNED |
| normalized_variance | outcome_checkpoints | fn_evaluate_pending_checkpoints | ALIGNED |
| false_positive | outcome_checkpoints | fn_evaluate_pending_checkpoints, fn_recalibrate_confidence | ALIGNED |
| rollback_guidance | automation_actions | ic_generate_cognition_contract | ALIGNED |
| model_version | cognition_decisions, instability_snapshots | fn_snapshot_daily_instability, ic_generate_cognition_contract | ALIGNED |
| propagation_count | instability_snapshots | fn_snapshot_daily_instability | ALIGNED |
| minimum_threshold_met | confidence_recalibrations | fn_recalibrate_confidence | ALIGNED |
| freshness_score | evidence_packs | fn_assemble_evidence_pack | ALIGNED |
| stale_sources | evidence_packs | fn_assemble_evidence_pack | ALIGNED |
| assembly_ms | evidence_packs | fn_assemble_evidence_pack | ALIGNED |
| latency_ms | integration_health | fn_check_integration_health | ALIGNED |
| sla_breached | integration_health | fn_check_integration_health | ALIGNED |
| consecutive_failures | integration_health | fn_check_integration_health | ALIGNED |

## EXTERNAL DEPENDENCIES (Must pre-exist in Supabase)

| Table/Function | Migration | Status |
|----------------|-----------|--------|
| business_profiles | Pre-existing | EXISTS |
| intelligence_snapshots | Pre-existing | EXISTS |
| integration_accounts | Pre-existing | EXISTS |
| email_connections | Pre-existing | EXISTS |
| marketing_benchmarks | 037 | EXISTS |
| ic_daily_metric_snapshots | 030 | EXISTS |
| ic_calculate_risk_baseline() | 034 | EXISTS |
| ic_resolve_industry_code() | 034 | EXISTS |
| is_spine_enabled() | 030 | EXISTS |

## MIGRATION 044 SUMMARY
- **15 tables** created
- **26 indexes** (including composite indexes on snapshot_date + composite)
- **25 RLS policies** (tenant_id = auth.uid())
- **1 append-only trigger** on cognition_decisions
- **14 propagation rules** seeded with amplification factors
- **10 automation actions** seeded with rollback guidance
- **12 cognition_config** entries (dynamic, not hardcoded)
- **8 evidence sources** registered
- **6 retention policies** defined

## MIGRATION 045 SUMMARY
- **9 SQL functions** with SECURITY DEFINER
- **fn_log_telemetry** — instrumentation helper
- **fn_assemble_evidence_pack** — config-driven freshness scoring
- **fn_check_integration_health** — SLA + degradation history
- **fn_compute_propagation_map** — compound chains + amplification
- **fn_evaluate_pending_checkpoints** — normalized variance + FP detection
- **fn_recalibrate_confidence** — Bayesian with config-driven decay + gating
- **fn_detect_drift** — Z-score anomaly detection
- **fn_snapshot_daily_instability** — daily snapshot generator
- **ic_generate_cognition_contract** — MASTER function, evidence-gated

## REVIEW CONCERNS ADDRESSED

| Concern | Resolution |
|---------|-----------|
| v_total_possible hardcoded to 8 | Now loaded from cognition_config table |
| Evidence integrity threshold static 0.25 | Now loaded from cognition_config |
| Confidence min decisions hardcoded to 3 | Now loaded from cognition_config |
| Decay rate/period hardcoded | Now loaded from cognition_config |
| Fresh/stale hour thresholds hardcoded | Now loaded from cognition_config |
| No index on snapshot_date alone | Added idx_is_date |
| No composite index (tenant, date, composite) | Added idx_is_tenant_date_composite |
| No source registry for evidence | Added evidence_source_registry table |
| No retention policy | Added data_retention_policies table |
| No config table for dynamic values | Added cognition_config table |

## ACKNOWLEDGED LIMITATIONS (v2 scope)

| Item | Status | Enterprise Path |
|------|--------|----------------|
| Retry with exponential backoff | Counter only | Implement in pg_cron job with backoff logic |
| Token expiry detection | Based on updated_at | Requires actual token metadata storage |
| Propagation O(n²) chain detection | Acceptable for 14 rules | Graph optimization for 100+ rules |
| Propagation depth > 2 | Not implemented | Recursive CTE for N-depth |
| Propagation history persistence | Not persisted | Add propagation_events table |
| Caching layer | None | Redis/Azure Cache for hot paths |
| Partitioning strategy | None defined | Partition instability_snapshots by month |
| Workspace abstraction | tenant = user | Requires workspace_id FK migration |

## DEPLOYMENT ORDER
1. Run `044_cognition_core.sql` in Supabase SQL Editor
2. Run `045_cognition_core_functions.sql` in Supabase SQL Editor
3. Verify: `SELECT ic_generate_cognition_contract('YOUR_UUID', 'overview');`
