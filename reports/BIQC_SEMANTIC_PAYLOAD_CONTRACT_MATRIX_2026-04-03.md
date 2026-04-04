# BIQc Semantic Payload Contract Matrix

## Purpose
- Define the minimum semantic payload contract required for cognition/UIE quality beyond HTTP `200`.
- Bind each critical page surface to required data fields, fallback behavior, and pass/fail gate outcomes.

## Global Contract (Applies To All Connector-Backed Surfaces)
- Required payload keys:
  - `data_status` (`ready|partial|empty|stale`)
  - `confidence_score` (`0.0-1.0`)
  - `confidence_reason` (plain-English explanation)
  - `coverage_window` (`start`, `end`, `freshness_hours`)
  - `source_lineage` (connector and endpoint provenance)
  - `next_best_actions` (ordered list, minimum 1 when `partial|empty|stale`)
- Required UI behavior:
  - show current state + confidence + freshness on first fold,
  - show provenance and coverage details in expanded/detail view,
  - never display healthy/green status while payload state is `empty|stale` without warning copy.

## Critical Surface Matrix

| Page | Primary Card/Tab Surface | Required Semantic Fields | Fallback Requirement | Gate |
|---|---|---|---|---|
| `/advisor` | Watchtower cards, actions panel | full global contract + `priority_rank`, `owner_role` | if partial, show top 3 prioritized actions | `PAYLOAD-SEMANTIC-ADVISOR-01` |
| `/soundboard` | main chat + side panel | full global contract + `answer_citations`, `continuity_context_id` | low confidence must include caution + action plan | `PAYLOAD-SEMANTIC-SOUNDBOARD-01` |
| `/alerts` | alert list + detail | full global contract + `severity`, `urgency_window` | if stale, show last reliable timestamp + manual verify step | `PAYLOAD-SEMANTIC-ALERTS-01` |
| `/actions` | delegate workflow + status | full global contract + `execution_readiness` | if provider unavailable, show manual path | `PAYLOAD-SEMANTIC-ACTIONS-01` |
| `/email-inbox` | priority folders + detail panel | full global contract + `priority_reasoning`, `reply_safety` | empty inbox must show ingest state + reconnect/run guidance | `PAYLOAD-SEMANTIC-INBOX-01` |
| `/calendar` | intelligence summary + draft card | full global contract + `days_back_effective`, `days_ahead_effective` | no events must include lookback limit disclosure | `PAYLOAD-SEMANTIC-CALENDAR-01` |
| `/competitive-benchmark` | confidence + provenance drawer | full global contract + `competitor_set`, `scan_age` | low confidence must block hard recommendations | `PAYLOAD-SEMANTIC-BENCHMARK-01` |
| `/revenue` | scenarios + concentration/risk cards | full global contract + `scenario_assumptions`, `upside_downside_range` | partial data must display missing source classes | `PAYLOAD-SEMANTIC-REVENUE-01` |
| `/operations` | bottleneck + SOP/SLA cards | full global contract + `constraint_driver`, `impact_window` | empty state must produce explicit data requirements | `PAYLOAD-SEMANTIC-OPERATIONS-01` |
| `/risk` | cross-domain risk + guidance | full global contract + `risk_vector`, `mitigation_priority` | stale risk signals must be downgraded visibly | `PAYLOAD-SEMANTIC-RISK-01` |
| `/data-health` | readiness + force-sync controls | full global contract + `connector_health_map`, `sync_lag` | degraded state requires remediation checklist | `PAYLOAD-SEMANTIC-DATAHEALTH-01` |
| `/ops-advisory` | recommendation panel + lock panel | full global contract + `recommendation_confidence` | lock panel must include unblock path and estimate | `PAYLOAD-SEMANTIC-OAC-01` |

## Contract Exceptions (Explicit, Non-Silent)
- Static/info routes (`NO_API_CALL_DETECTED`) are exempt from semantic payload gates.
- Admin-only transport checks are exempt only if auth fixture scope is unavailable; must carry contract exception reason.

## Hard Gate Status
- FAIL · `PAYLOAD-SEMANTIC-CONTRACT-MATRIX-01` · `SEMANTIC_FIELDS_NOT_ENFORCED_PLATFORM_WIDE` · `reports/BIQC_SEMANTIC_PAYLOAD_CONTRACT_MATRIX_2026-04-03.md`
- FAIL · `PAYLOAD-SEMANTIC-SURFACE-COVERAGE-01` · `PAGE_CARD_TAB_CONTRACT_BINDING_INCOMPLETE` · `reports/BIQC_SEMANTIC_PAYLOAD_CONTRACT_MATRIX_2026-04-03.md`

## Closure Evidence Required
- Endpoint response snapshots per critical surface showing all required fields.
- UI captures (first fold + detail views) confirming field visibility and truthful degraded behavior.
- Automated contract validator report with zero missing required fields on connector-backed surfaces.
