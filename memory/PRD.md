# BIQc Platform — PRD
## 2 March 2026

## Platform Overview
BIQc: AI-driven Cognition-as-a-Platform for SMBs. Architecture: backend-first — ALL computation in SQL functions, Python is thin pass-through, frontend renders only.

## Cognition Core v2 — Enterprise Grade (BUILT)

### Master SQL Function
`ic_generate_cognition_contract(tenant_id, tab)` — single function that orchestrates:
1. Evidence Engine (freshness-weighted integrity scoring)
2. Integration Health (SLA breach + degradation history)
3. Instability Engine (RVI/EDS/CDR/ADS via ic_calculate_risk_baseline)
4. Delta computation (vs yesterday's snapshot)
5. Propagation Engine (compound chains A→B→C with amplification)
6. Decision Consequence Evaluation (variance normalization + false positive detection)
7. Bayesian Confidence Recalibration (decay + min 3 checkpoint gating)
8. Drift Detection (Z-score >2 std deviations)
9. Automation action attachment
10. Evidence gating (blocks when integrity < 0.25)

### Tables (Migration 044)
integration_health, integration_health_history, evidence_packs, cognition_decisions, outcome_checkpoints, propagation_rules, automation_actions, automation_executions, instability_snapshots, confidence_recalibrations, cognition_telemetry, drift_detection_log

### SQL Functions (Migration 045)
fn_log_telemetry, fn_assemble_evidence_pack, fn_check_integration_health, fn_compute_propagation_map, fn_evaluate_pending_checkpoints, fn_recalibrate_confidence, fn_detect_drift, fn_snapshot_daily_instability, ic_generate_cognition_contract

### Deployment Status
- SQL Migrations 044 + 045: **READY, AWAITING SUPABASE DEPLOYMENT**
- Backend routes: **DEPLOYED** (17 endpoints, all auth-gated)
- See `/app/memory/COGNITION_DEPLOYMENT_GUIDE.md`

## API Endpoints — Cognition
| Endpoint | Method | SQL Function Called |
|----------|--------|-------------------|
| /api/cognition/{tab} | GET | ic_generate_cognition_contract |
| /api/cognition/decisions | GET/POST | Direct table access |
| /api/cognition/automation/execute | POST | Direct table + health check |
| /api/cognition/automation/history | GET | Direct table |
| /api/cognition/integration-health | GET | fn_check_integration_health |
| /api/cognition/integration-health/history | GET | Direct table |
| /api/cognition/snapshot-instability | POST | fn_snapshot_daily_instability |
| /api/cognition/drift | GET | fn_detect_drift |
| /api/cognition/telemetry | GET | Direct table |

## Phase B — Frontend (After SQL Deployed)
- Fix blank post-login screen
- Restructure tabs to render cognition contract
- Score transparency modals
- Integration health banners
- SoundBoard evidence injection
- Admin nav restructure
- Weekly check-in calendar
- SMB terminology enforcement
