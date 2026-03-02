# BIQc Platform — PRD
## 2 March 2026

## Platform Overview
BIQc is an AI-driven "Cognition-as-a-Platform" for SMBs. The architecture follows a strict backend-first approach: all intelligence computation happens in SQL functions, the frontend is a pure renderer.

## Architecture: Cognition Core (Backend-First)

### Completed Engines (SQL + FastAPI)

| Engine | Status | Location |
|--------|--------|----------|
| Evidence Engine | BUILT | fn_assemble_evidence_pack (SQL) |
| Instability Engine | BUILT | ic_calculate_risk_baseline (SQL, migration 033/034) |
| Propagation Engine | BUILT | fn_compute_propagation_map (SQL) |
| Decision Consequence Engine | BUILT | cognition_decisions + outcome_checkpoints + fn_evaluate_pending_checkpoints (SQL) |
| Confidence Recalibration | BUILT | fn_recalibrate_confidence (SQL) |
| Automation Execution Engine | BUILT | automation_actions + automation_executions (SQL + FastAPI) |
| Integration Health Monitor | BUILT | integration_health + fn_check_integration_health (SQL) |
| Unified Cognition Contract | BUILT | /api/cognition/{tab} (FastAPI) |

### Deployment Status
- SQL Migrations 044 + 045: **READY, NOT YET DEPLOYED TO SUPABASE**
- Backend routes: **DEPLOYED** (cognition_contract.py registered in server.py)
- See `/app/memory/COGNITION_DEPLOYMENT_GUIDE.md` for deployment steps

### Cognition Contract Response Structure
```json
{
  "evidence_pack": { "integrity_score", "missing_sources", "source_count" },
  "instability": { "rvi", "eds", "cdr", "ads", "composite", "risk_band", "deltas", "trajectory" },
  "propagation_map": [{ "source_domain", "target_domain", "mechanism", "probability", "severity" }],
  "decision_effectiveness": { "checkpoints_processed", "results" },
  "confidence": { "score", "reason", "trend", "accuracy_rate" },
  "automation_actions": [{ "action_type", "label", "requires_confirmation", "integration_required" }],
  "tab_insights": [{ "type", "title", "detail", "severity", "evidence_refs" }],
  "evidence_refs": { ... }
}
```

## Previous Work (Earlier Sessions)
- Integrations page dark theme overhaul + Shopify/WooCommerce
- Unified Intelligence Frontend (Revenue/Risk/Operations pages)
- Marketing Automation UI + A/B Testing UI
- SoundBoard RAG upgrade
- Super Admin Console
- DSEE v2.1

## Remaining — Phase B (Frontend, After SQL Deployed)

### P0 (After Migrations Deployed)
- Fix blank post-login screen (skeleton loaders)
- Restructure BIQc Insights tabs to render cognition contract
- Add integration health banners + reconnect CTAs
- SoundBoard integration-awareness (call evidence pack before answering)
- Score transparency modals (formula, weights, thresholds)

### P1
- Admin nav restructure (LEGAL section + Knowledge Base)
- Weekly check-in calendar panel
- Website scan industry confirmation
- Revenue page refresh toggle fix
- Concentration insight with named clients + % + actions

### P2
- SMB terminology enforcement across all pages
- Marketing tools detection
- Mobile App Build-out
- CSS Consolidation

## Known Issues
- Production auth (biqc.thestrategysquad.com) blocked on Azure env vars
- Supabase auth credentials may not work in Emergent preview
- SQL migrations 044/045 pending deployment
