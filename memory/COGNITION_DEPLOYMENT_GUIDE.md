# BIQc Cognition Core — SQL Migration Deployment Guide

## Migrations to Deploy (IN ORDER)

### Step 1: Deploy Migration 044 (Schema)
**File:** `/app/supabase/migrations/044_cognition_core.sql`

Creates 9 tables:
- `integration_health` — Integration status tracking
- `evidence_packs` — Cached evidence assemblies
- `cognition_decisions` — Append-only structured decisions
- `outcome_checkpoints` — 30/60/90 day outcome tracking
- `propagation_rules` — Deterministic cross-domain migration rules (seeded with 14 rules)
- `automation_actions` — Action registry (seeded with 10 actions)
- `automation_executions` — Execution logs
- `instability_snapshots` — Daily instability history
- `confidence_recalibrations` — Confidence adjustment log

**How to deploy:**
1. Go to Supabase Dashboard → SQL Editor
2. Copy the entire contents of `044_cognition_core.sql`
3. Paste and click "Run"
4. Verify no errors

### Step 2: Deploy Migration 045 (Functions)
**File:** `/app/supabase/migrations/045_cognition_core_functions.sql`

Creates 5 SQL functions:
- `fn_assemble_evidence_pack(tenant_id)` — Assembles all available evidence
- `fn_compute_propagation_map(tenant_id, instability)` — Computes risk propagation
- `fn_evaluate_pending_checkpoints(tenant_id)` — Evaluates decision outcomes
- `fn_recalibrate_confidence(tenant_id)` — Adjusts system confidence
- `fn_check_integration_health(tenant_id)` — Checks integration status

**How to deploy:**
1. Go to Supabase Dashboard → SQL Editor
2. Copy the entire contents of `045_cognition_core_functions.sql`
3. Paste and click "Run"
4. Verify no errors

### Verification
After deployment, test with:
```sql
SELECT fn_assemble_evidence_pack('YOUR_USER_UUID');
SELECT ic_calculate_risk_baseline('YOUR_USER_UUID');
SELECT fn_compute_propagation_map('YOUR_USER_UUID', NULL);
```

## API Endpoints (Available After Deployment)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cognition/{tab}` | GET | Unified intelligence contract (revenue/risk/operations/people/market/overview) |
| `/api/cognition/decisions` | GET | List structured decisions |
| `/api/cognition/decisions` | POST | Record new decision (creates 30/60/90 checkpoints) |
| `/api/cognition/automation/execute` | POST | Execute automation action |
| `/api/cognition/automation/history` | GET | Automation execution history |
| `/api/cognition/integration-health` | GET | Integration health status |
| `/api/cognition/snapshot-instability` | POST | Store daily instability snapshot |
