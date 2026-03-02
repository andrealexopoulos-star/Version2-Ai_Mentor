# BIQc Cognition Core — Architecture Specification
## Version 1.0 | 2 March 2026

## 1. EXISTING INFRASTRUCTURE (Already Built)

### 1.1 Instability Indices (SQL — migration 033/034)
- `ic_calculate_risk_baseline(tenant_id)` → RVI, EDS, CDR, ADS, CRS
- `ic_risk_weight_configs` → Industry-specific weights with immutability
- `ic_resolve_industry_code(industry)` → Maps free text → standard code
- `ic_daily_metric_snapshots` → Source data for indices
- `ic_model_registry` + `ic_model_executions` → Execution logging
- Risk bands: LOW (0–0.4), MODERATE (0.4–0.7), HIGH (0.7–1.0)

### 1.2 Intelligence Spine (SQL — migration 030)
- `intelligence_core.decisions` → Basic decision table (needs enhancement)
- `intelligence_core.decision_outcomes` → Basic outcome table (needs enhancement)
- `intelligence_core.model_registry` → Model governance
- `intelligence_core.feature_flags` → Feature gating

### 1.3 Integration Layer (Python — routes/integrations.py)
- Merge.dev (CRM/Accounting/HRIS/ATS)
- Outlook/Gmail (Edge Functions)
- `integration_accounts` table with `account_token`, `status`, `category`

## 2. NEW SCHEMA — Migration 044: Cognition Core

### 2.1 Integration Health Monitor
```sql
TABLE integration_health (
  id UUID PK,
  tenant_id UUID NOT NULL,
  provider TEXT NOT NULL,           -- 'hubspot', 'xero', 'gmail', 'outlook'
  category TEXT NOT NULL,           -- 'crm', 'accounting', 'email', 'calendar', 'marketing'
  status TEXT NOT NULL DEFAULT 'NOT_CONNECTED',  -- CONNECTED | TOKEN_EXPIRED | PERMISSION_CHANGED | SYNC_FAILED | NOT_CONNECTED
  last_successful_sync TIMESTAMPTZ,
  data_freshness_minutes INT,
  last_error_message TEXT,
  required_user_action TEXT,        -- 'Reconnect' | 'Re-authorise' | 'Fix permissions' | NULL
  checked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, provider)
)
RLS: tenant_id = auth.uid()
```

### 2.2 Evidence Packs (Cached Assemblies)
```sql
TABLE evidence_packs (
  id UUID PK,
  tenant_id UUID NOT NULL,
  assembled_at TIMESTAMPTZ DEFAULT now(),
  ttl_seconds INT DEFAULT 300,
  evidence JSONB NOT NULL,          -- Full evidence pack
  integrity_score FLOAT,            -- 0-1, completeness measure
  missing_sources TEXT[],           -- ['crm', 'accounting'] etc
  source_count INT,
  UNIQUE(tenant_id)                 -- One active pack per tenant
)
RLS: tenant_id = auth.uid()
```

### 2.3 Enhanced Decisions Table
```sql
TABLE cognition_decisions (
  id UUID PK,
  tenant_id UUID NOT NULL,
  decision_category TEXT NOT NULL,  -- 'revenue', 'operations', 'people', 'finance', 'market'
  decision_statement TEXT NOT NULL,
  affected_domains TEXT[] NOT NULL, -- ['revenue', 'cash', 'operations']
  expected_instability_change JSONB,-- {revenue: -0.1, cash: +0.05}
  expected_time_horizon INT DEFAULT 30, -- days: 30, 60, 90
  confidence_at_time FLOAT,
  evidence_refs TEXT[],             -- Source keys for why decision was taken
  instability_snapshot_at_time JSONB, -- Snapshot of all indices at decision time
  status TEXT DEFAULT 'active',     -- active | superseded | withdrawn
  created_at TIMESTAMPTZ DEFAULT now()
)
RLS: tenant_id = auth.uid()
APPEND-ONLY: UPDATE trigger prevents changes except status
```

### 2.4 Outcome Checkpoints
```sql
TABLE outcome_checkpoints (
  id UUID PK,
  decision_id UUID FK → cognition_decisions(id),
  tenant_id UUID NOT NULL,
  checkpoint_day INT NOT NULL,      -- 30, 60, 90
  scheduled_at TIMESTAMPTZ NOT NULL,
  evaluated_at TIMESTAMPTZ,
  actual_instability JSONB,         -- Snapshot of indices at checkpoint
  predicted_instability JSONB,      -- From decision.expected_instability_change
  variance_delta JSONB,             -- Difference per domain
  decision_effective BOOLEAN,       -- Did instability decrease as predicted?
  confidence_adjustment FLOAT,      -- How much to adjust confidence
  status TEXT DEFAULT 'pending',    -- pending | evaluated | skipped
  UNIQUE(decision_id, checkpoint_day)
)
RLS: tenant_id = auth.uid()
```

### 2.5 Propagation Rules
```sql
TABLE propagation_rules (
  id UUID PK,
  source_domain TEXT NOT NULL,
  target_domain TEXT NOT NULL,
  mechanism TEXT NOT NULL,           -- SMB language explanation
  base_probability FLOAT NOT NULL,   -- 0-1
  severity TEXT NOT NULL,            -- high | medium | low
  time_horizon TEXT NOT NULL,        -- 'immediate', '1-4 weeks', '1-3 months'
  trigger_condition TEXT NOT NULL,   -- SQL expression or instability threshold
  is_active BOOLEAN DEFAULT true,
  UNIQUE(source_domain, target_domain, mechanism)
)
-- SEED with deterministic rules (no RLS — global config)
```

### 2.6 Automation Registry
```sql
TABLE automation_actions (
  id UUID PK,
  action_type TEXT NOT NULL,          -- 'send_invoice_reminder', 'trigger_re_engagement', etc
  insight_category TEXT NOT NULL,     -- 'overdue_invoice', 'stalled_deal', etc
  integration_required TEXT,          -- 'xero', 'hubspot', NULL
  action_label TEXT NOT NULL,         -- SMB-friendly button text
  secondary_action_label TEXT,
  requires_confirmation BOOLEAN DEFAULT true,
  risk_level TEXT DEFAULT 'low',      -- low | medium | high
  is_active BOOLEAN DEFAULT true
)

TABLE automation_executions (
  id UUID PK,
  tenant_id UUID NOT NULL,
  action_id UUID FK → automation_actions(id),
  insight_ref TEXT,                   -- What insight triggered this
  evidence_refs TEXT[],
  status TEXT DEFAULT 'pending',      -- pending | confirmed | executed | failed | rolled_back
  confirmed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  result JSONB,
  governance_event_id UUID,          -- FK to governance log
  created_at TIMESTAMPTZ DEFAULT now()
)
RLS: tenant_id = auth.uid()
```

### 2.7 Instability History
```sql
TABLE instability_snapshots (
  id UUID PK,
  tenant_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  rvi FLOAT, eds FLOAT, cdr FLOAT, ads FLOAT,
  composite FLOAT,
  risk_band TEXT,
  config_name TEXT,
  industry_code TEXT,
  evidence_integrity FLOAT,
  UNIQUE(tenant_id, snapshot_date)
)
RLS: tenant_id = auth.uid()
```

## 3. SQL FUNCTIONS

### 3.1 fn_assemble_evidence_pack(tenant_id)
Assembles ALL available evidence:
- Integration data (CRM deals, accounting invoices, email connections)
- Business profile
- Latest cognitive snapshot
- SoundBoard history (last 10 decision-related threads)
- Decision registry
- Outcome checkpoints
- Daily metric snapshots (30 days)
- Integration health status
Returns: JSONB evidence_pack + integrity_score + missing_sources

### 3.2 fn_compute_propagation_map(tenant_id)
Reads current instability indices + propagation_rules.
For each rule where trigger_condition met:
- Compute adjusted probability based on actual index values
- Return structured propagation_map array

### 3.3 fn_evaluate_pending_checkpoints(tenant_id)
For each pending outcome_checkpoint where scheduled_at <= now():
- Fetch current instability snapshot
- Compare to predicted instability from decision
- Compute variance_delta per domain
- Mark checkpoint as evaluated
- Return effectiveness trend

### 3.4 fn_recalibrate_confidence(tenant_id)
Based on decision effectiveness history:
- Compute running accuracy of predictions
- Return confidence_trend and adjustment factor

## 4. UNIFIED COGNITION CONTRACT

Single endpoint: `/api/cognition/{tab}`

Calls (in parallel where possible):
1. fn_assemble_evidence_pack → evidence
2. ic_calculate_risk_baseline → instability indices
3. fn_compute_propagation_map → propagation
4. fn_evaluate_pending_checkpoints → decision effectiveness
5. fn_recalibrate_confidence → confidence trend
6. Attach automation_actions per insight

Returns structured JSON:
```json
{
  "evidence_pack": {...},
  "instability": {
    "rvi": 0.42, "eds": 0.15, "cdr": 0.08, "ads": 0.03,
    "composite": 0.24, "risk_band": "LOW",
    "deltas": {"rvi": +0.05, "eds": -0.02, ...},
    "trajectory": "stable"
  },
  "propagation_map": [...],
  "decision_effectiveness": {...},
  "confidence": {"score": 0.85, "reason": "...", "trend": "improving"},
  "automation_actions": [...],
  "evidence_refs": {...},
  "tab_insights": [...]  // Tab-specific intelligence
}
```

## 5. LATENCY PLAN
- Evidence pack assembly: <200ms (parallel Supabase queries)
- Instability computation: <50ms (existing SQL function)
- Propagation map: <30ms (rule evaluation)
- Decision checkpoints: <50ms (batch update)
- Total endpoint: <500ms target

## 6. RLS COMPLIANCE
- All tenant-scoped tables: `tenant_id = auth.uid()` SELECT policy
- Service role for cross-tenant batch operations
- Propagation rules + automation_actions: global read, service_role write
- Evidence packs: strict tenant isolation
- Append-only on cognition_decisions: UPDATE trigger prevents mutation
