# Intelligence Spine — Deployment Validation Report
## Date: 2026-02-27

## 1. Schema Diff

### NEW schema created: `intelligence_core`
No modifications to `public` schema.

| Object | Type | Schema | Status |
|--------|------|--------|--------|
| `intelligence_core` | SCHEMA | — | NEW |
| `intelligence_core.event_type` | ENUM TYPE | intelligence_core | NEW |
| `intelligence_core.intelligence_events` | TABLE | intelligence_core | NEW |
| `intelligence_core.daily_metric_snapshots` | TABLE | intelligence_core | NEW |
| `intelligence_core.ontology_nodes` | TABLE | intelligence_core | NEW |
| `intelligence_core.ontology_edges` | TABLE | intelligence_core | NEW |
| `intelligence_core.decisions` | TABLE | intelligence_core | NEW |
| `intelligence_core.decision_outcomes` | TABLE | intelligence_core | NEW |
| `intelligence_core.model_registry` | TABLE | intelligence_core | NEW |
| `intelligence_core.model_executions` | TABLE | intelligence_core | NEW |
| `intelligence_core.feature_flags` | TABLE | intelligence_core | NEW |
| `intelligence_core.is_spine_enabled()` | FUNCTION | intelligence_core | NEW |

### PUBLIC schema changes: ZERO
No tables modified. No columns added. No functions altered. No RLS policies changed.

## 2. RLS Policy List

| Table | Policy | Role | Type |
|-------|--------|------|------|
| intelligence_events | tenant_read_events | authenticated | SELECT (tenant_id = auth.uid()) |
| intelligence_events | service_all_events | service_role | ALL |
| daily_metric_snapshots | tenant_read_snapshots | authenticated | SELECT (tenant_id = auth.uid()) |
| daily_metric_snapshots | service_all_snapshots | service_role | ALL |
| ontology_nodes | tenant_read_nodes | authenticated | SELECT (tenant_id = auth.uid()) |
| ontology_nodes | service_all_nodes | service_role | ALL |
| ontology_edges | tenant_read_edges | authenticated | SELECT (tenant_id = auth.uid()) |
| ontology_edges | service_all_edges | service_role | ALL |
| decisions | tenant_read_decisions | authenticated | SELECT (tenant_id = auth.uid()) |
| decisions | service_all_decisions | service_role | ALL |
| decision_outcomes | tenant_read_outcomes | authenticated | SELECT (all) |
| decision_outcomes | service_all_outcomes | service_role | ALL |
| model_registry | tenant_read_registry | authenticated | SELECT (all) |
| model_registry | service_all_registry | service_role | ALL |
| model_executions | tenant_read_executions | authenticated | SELECT (tenant_id = auth.uid()) |
| model_executions | service_all_executions | service_role | ALL |
| feature_flags | anyone_read_flags | authenticated | SELECT (all) |
| feature_flags | service_all_flags | service_role | ALL |

**Total: 18 new policies. 0 existing policies modified.**

## 3. Index List

| Index | Table | Columns |
|-------|-------|---------|
| idx_ic_events_tenant | intelligence_events | tenant_id |
| idx_ic_events_type | intelligence_events | event_type |
| idx_ic_events_created | intelligence_events | created_at DESC |
| idx_ic_snapshots_tenant_date | daily_metric_snapshots | tenant_id, snapshot_date DESC |
| idx_ic_nodes_tenant | ontology_nodes | tenant_id |
| idx_ic_nodes_type | ontology_nodes | node_type |
| idx_ic_edges_from | ontology_edges | from_node |
| idx_ic_edges_to | ontology_edges | to_node |
| idx_ic_edges_tenant | ontology_edges | tenant_id |
| idx_ic_decisions_tenant | decisions | tenant_id |
| idx_ic_outcomes_decision | decision_outcomes | decision_id |
| idx_ic_registry_name | model_registry | model_name |
| idx_ic_executions_tenant | model_executions | tenant_id |
| idx_ic_executions_model | model_executions | model_name |

**Total: 14 indexes. All in intelligence_core schema.**

## 4. Estimated Storage Footprint

| Table | Row Size (avg) | At 100 tenants | At 1000 tenants |
|-------|---------------|----------------|-----------------|
| intelligence_events | ~200 bytes | ~2MB/month | ~20MB/month |
| daily_metric_snapshots | ~100 bytes | ~300KB/month | ~3MB/month |
| ontology_nodes | ~300 bytes | ~300KB | ~3MB |
| ontology_edges | ~100 bytes | ~100KB | ~1MB |
| decisions | ~500 bytes | ~500KB/month | ~5MB/month |
| decision_outcomes | ~100 bytes | ~100KB/month | ~1MB/month |
| model_registry | ~200 bytes | Negligible | Negligible |
| model_executions | ~300 bytes | ~300KB/month | ~3MB/month |
| feature_flags | ~100 bytes | Negligible | Negligible |

**Total estimated: ~3.5MB/month at 100 tenants. ~33MB/month at 1000 tenants.**

## 5. Migration Risk Assessment

| Risk | Level | Mitigation |
|------|-------|-----------|
| Public schema modification | ZERO | All structures in intelligence_core schema |
| Existing table alteration | ZERO | No ALTER on public tables |
| Foreign key breakage | ZERO | No FK references to public tables |
| RLS policy conflict | ZERO | New policies on new tables only |
| API contract change | ZERO | No endpoint modifications |
| Frontend disruption | ZERO | No frontend changes |
| Data loss | ZERO | No DELETE, DROP, or TRUNCATE |
| Performance impact | NEGLIGIBLE | New schema is dormant (feature flag = false) |

## 6. Existing Table Modification Confirmation

**ZERO existing tables modified.**

Verified by: No ALTER TABLE, DROP TABLE, or TRUNCATE on any table in public schema.

## 7. Feature Flag State

```
intelligence_spine_enabled = FALSE (dormant)
```

All modelling engines will check `intelligence_core.is_spine_enabled()` before execution.
No compute runs until flag is explicitly set to TRUE.

## 8. Reversibility

To completely remove the Intelligence Spine:
```sql
DROP SCHEMA intelligence_core CASCADE;
```
This removes all tables, types, functions, and policies in the intelligence_core schema without affecting anything in public.
