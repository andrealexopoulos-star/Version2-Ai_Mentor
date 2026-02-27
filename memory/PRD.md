# BIQc Platform - PRD

## Architecture
- **Frontend**: React + Tailwind + Shadcn/UI
- **Backend**: FastAPI (thin client) → Supabase SQL Functions
- **Database**: Supabase PostgreSQL + 10 SQL Functions + 3 Triggers + Views
- **AI Engine**: OpenAI gpt-4o-mini via Edge Functions
- **CRM**: Merge.dev (HubSpot)

## SQL Intelligence Layer (Supabase)

### 10 SQL Functions
| # | Function | Replaces | Endpoint |
|---|----------|----------|----------|
| 1 | `compute_workforce_health()` | Python workforce logic | `/api/intelligence/workforce` |
| 2 | `compute_revenue_scenarios()` | Python scenario logic | `/api/intelligence/scenarios` |
| 3 | `compute_insight_scores()` | Python scoring logic | `/api/intelligence/scores` |
| 4 | `compute_concentration_risk()` | Python concentration | `/api/intelligence/concentration` |
| 5 | `detect_contradictions()` | `contradiction_engine.py` | `/api/intelligence/contradictions` |
| 6 | `compute_pressure_levels()` | `pressure_calibration.py` | `/api/intelligence/pressure` |
| 7 | `compute_evidence_freshness()` | `evidence_freshness.py` | `/api/intelligence/freshness` |
| 8 | `detect_silence()` | `silence_detection.py` | `/api/intelligence/silence` |
| 9 | `compute_profile_completeness()` | Python profile scoring | `/api/intelligence/completeness` |
| 10 | `compute_data_readiness()` | Python readiness check | `/api/intelligence/readiness` |

### Supporting Functions
- `get_escalation_summary()` → `/api/intelligence/escalations`
- `compute_watchtower_positions()` → `/api/intelligence/watchtower`
- `build_intelligence_summary()` → `/api/intelligence/summary` (calls all 10)
- `emit_governance_event()` — Helper to insert governance events

### Triggers (Auto-fire)
- `trg_governance_event_sync` — Updates integration `last_sync_at` on new event
- `trg_integration_status_change` — Logs connect/disconnect as governance events
- `trg_report_export_log` — Logs report generation as governance events

### pg_cron Jobs (Scheduled — uncomment after enabling)
- Evidence freshness decay (every 6 hours)
- Silence detection (daily 8am UTC)
- Contradiction check (every 12 hours)
- Full summary rebuild (daily 2am UTC)

## Deployment Queue
| Item | Status |
|------|--------|
| `020_insight_outcomes.sql` | DEPLOYED |
| `021_trust_reconstruction.sql` | DEPLOYED |
| `022_intelligence_modules.sql` | **NEEDS DEPLOY** |
| `023_complete_intelligence_sql.sql` | **NEEDS DEPLOY** |
| Edge Functions (4) | DEPLOYED |

## Backlog
### P1
- [ ] Stripe Paid Gating
- [ ] Deep Market Modeling (MarketPage)
- [ ] Wire governance_events from Merge.dev sync
### P2
- [ ] Signal Provenance, State Justification
- [ ] Enable pg_cron jobs
### P3
- [ ] CSS Consolidation, Legacy Cleanup
