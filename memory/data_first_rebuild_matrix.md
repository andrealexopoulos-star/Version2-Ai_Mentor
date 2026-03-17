# BIQc Data-First Rebuild Matrix (Cognition-as-a-Platform)

## Current State Snapshot
- Intelligence spine exists and is valuable (`intelligence_events`, snapshots, ontology, decisions, model registry).
- Unified intelligence API exists and serves core pages.
- Business Brain priorities + structured briefs are active.
- Redis queue execution path is active.

## Data-First Gaps (Execution Matrix)

| Layer | Status | What Exists | What Was Missing | Implemented in this sprint |
|---|---|---|---|---|
| Canonical concern persistence | Partial | `business_core.concern_evaluations` | No explicit confidence/data-freshness/lineage/action linkage fields | Added migration fields + response contract enrichment |
| Canonical naming compatibility | Missing | `concern_registry`, `concern_evaluations` | `brain_concerns`, `brain_evaluations` semantic layer | Added compatibility views |
| Initial calibration artifact | Missing | No dedicated function for first-time executive calibration | `brain_initial_calibration(tenant)` | Added SQL function + API fallback endpoint |
| Integration cache layer | Missing | Live pull at runtime in unified endpoints | Snapshot cache for 5-15 minute reads | Added `business_core.integration_snapshots` + backend cache helper |
| Confidence contract | Partial | Some pages show confidence-like cues | Unified `confidence_score`, `data_sources_count`, `data_freshness`, `lineage` contract | Added to Brain + Unified APIs + SoundBoard response payloads |
| SoundBoard anti-generic behavior | Partial | Prompt constraints + guardrails | Deterministic fallback for generic/low-context/provider failure | Added generic detector + deterministic specificity fallback |
| Platform-wide readiness visibility | Missing | Fragmented health checks | Single matrix for SQL/schema/RPC/edge/webhooks + serving map | Added `/api/services/cognition-platform-audit` + admin UI table |

## Serving Surfaces (Where Cognition Powers UI)

| UI Surface | Primary API(s) | Contract State |
|---|---|---|
| Advisor | `/api/brain/priorities`, `/api/unified/advisor` | Enriched confidence + lineage |
| Revenue | `/api/unified/revenue`, `/api/cognition/revenue` | Enriched confidence + lineage |
| Operations | `/api/unified/operations`, `/api/cognition/operations` | Enriched confidence + lineage |
| Risk | `/api/unified/risk`, `/api/cognition/risk` | Enriched confidence + lineage |
| Market | `/api/unified/market`, `/api/cognition/market` | Enriched confidence + lineage |
| SoundBoard | `/api/soundboard/chat` | Contract metadata + anti-generic fallback |

## Remaining High-Value Hardening
1. Migrate all live Merge-heavy runtime pulls to scheduled snapshot refresh jobs.
2. Expand concern ranking to deterministic economic top-3 by page + action linkage in automations.
3. Add admin + non-admin UX audit path for all page tabs/dropdowns/toggles with explicit cognition assertions.
