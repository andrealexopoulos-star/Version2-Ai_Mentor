# BIQc PHASE 2 PLATFORM AUDIT
## Cognition-as-a-Platform & Unified Integration Engine for SMBs
**Date:** 19 March 2026
**Auditor:** AI Audit Agent (Phase 2)
**Scope:** Full-stack platform audit against world-class CaaP + UIE standard
**Sprint:** 33 (Launch Packaging Redesign Correction)
**Production:** biqc.thestrategysquad.com

---

## EXECUTIVE VERDICT

| Dimension | Score | Grade |
|-----------|-------|-------|
| **Cognition Core (SQL Engine)** | 5.5/10 | C+ |
| **Business Brain Engine (Python)** | 9/10 | A |
| **Unified Integration Engine** | 5.5/10 | C+ |
| **Intelligence Surface Quality** | 8/10 | A- |
| **Action & Execution Layer** | 2/10 | F |
| **Security & Governance** | 7/10 | B |
| **Architecture & Production Readiness** | 6.5/10 | B- |
| **COMPOSITE PLATFORM SCORE** | **6.2/10** | **B-** |

**Bottom line:** BIQc has a genuinely world-class intelligence reading layer — the Business Brain Engine, SoundBoard guardrail system, and intelligence surface explainability are production-grade and differentiated. However, the SQL cognition contract layer has regressed from real computation to hardcoded placeholders, the canonical data pipeline is orphaned, the action layer is almost entirely decorative, and two HIGH-severity security gaps exist. The platform is currently a **world-class intelligence dashboard** that cannot yet execute actions, making it a cognition reader rather than a cognition platform.

---

## SECTION A: COGNITION CORE AUDIT

### A.1 What EXISTS and WORKS

**Business Brain Engine (`business_brain_engine.py`) — WORLD-CLASS**

The strongest component in the entire platform. A genuinely deterministic, evidence-based, truth-aware concern scoring engine:

- Computes 20+ metrics from REAL canonical data (`business_core` schema): total_revenue, pipeline_value, win_rate, sales_velocity, cash_runway, churn_rate, task_overdue_rate, AR/AP aging
- Zero LLM calls — pure deterministic computation
- Priority scoring formula: `(impact * iw) * (urgency * uw) * (confidence * cw) / max(1, effort * ed)`
- Truth-aware evaluation: concerns from unverified/stale connectors are downgraded or blocked with integrity alerts
- Structured executive briefs: issue_brief, why_now_brief, action_brief, if_ignored_brief with truth-aware language
- Full Intelligence Spine integration: events logged to `ic_intelligence_events`, model executions tracked
- Tier-aware output shaping (free/paid/custom tiers)
- Evidence lineage tracking per concern

**Live Integration Truth (`intelligence_live_truth.py`) — SOLID**

- Deterministic, non-LLM truth resolution from multiple DB tables
- Checks `business_core.source_runs` for live/stale/error state per connector
- 12-hour stale threshold enforced
- Reconciles `integration_accounts`, `email_connections`, `outlook_oauth_tokens`

**Deterministic Risk Baseline (Migrations 033/034) — CORRECT but SUPERSEDED**

- `ic_calculate_risk_baseline` computes RVI (revenue volatility), EDS (engagement decay), CDR (cash deviation), ADS (anomaly density) from real `ic_daily_metric_snapshots` using stddev/mean calculations
- 6 industry-specific weight profiles with immutable constraint enforcement
- This is excellent engineering — but it has been silently replaced (see A.2)

**Propagation Rules — DETERMINISTIC SQL**

- `fn_compute_propagation_map` reads from `propagation_rules` table (14 seeded cross-domain rules)
- Not AI-generated — SQL-computed from a deterministic rule base
- Covers finance → operations → people → revenue → cash → delivery → market chains

**Decision Management — FUNCTIONAL**

- CRUD for decisions with instability snapshot capture at creation time
- Auto-generated 30/60/90 day outcome checkpoints
- Manual checkpoint-outcome recording works

### A.2 CRITICAL FINDINGS — What is BROKEN

**CRITICAL-01: `ic_generate_cognition_contract` uses HARDCODED instability indices**

The master SQL function in migration 045 hardcodes binary values instead of computing real indices:

```sql
v_instability_indices := jsonb_build_object(
  'revenue_volatility_index', CASE WHEN v_crm_connected THEN 0.25 ELSE 0.6 END,
  'engagement_decay_score', CASE WHEN v_email_connected THEN 0.2 ELSE 0.5 END,
  'cash_deviation_ratio', CASE WHEN v_accounting_connected THEN 0.15 ELSE 0.55 END,
  'anomaly_density_score', 0.2
);
```

If CRM is connected, RVI = 0.25. If not, RVI = 0.6. This is a boolean toggle masquerading as a computed index. The real deterministic computation from 033/034 (stddev-based volatility from 30-day snapshots) has been **regressed away**.

**CRITICAL-02: `ic_calculate_risk_baseline` in 045 REPLACED the real engine**

Migration 045 silently overwrites the genuine 034 version with a delegation stub that returns the hardcoded indices from CRITICAL-01. Anyone calling `ic_calculate_risk_baseline` now gets binary toggles instead of real statistical analysis.

**CRITICAL-03: `fn_evaluate_pending_checkpoints` is a STUB**

```sql
UPDATE outcome_checkpoints
SET status = 'evaluated', evaluated_at = now(),
    decision_effective = true, variance_delta = 0
WHERE id = r.id;
```

Always marks EVERY checkpoint as effective with zero variance. No predicted-vs-actual comparison. The entire confidence feedback loop is broken — confidence will always trend to ~0.99.

**HIGH-01: `fn_assemble_evidence_pack` returns static type labels, not real data**

Returns hardcoded evidence type/weight pairs (`[{"type":"crm_deals","weight":0.8}]`) based on connection status. No actual data points, metric values, or timestamps in evidence packs.

**HIGH-02: `fn_snapshot_daily_instability` always writes zeros**

Always writes `composite_risk_score = 0`, `system_state = 'STABLE'`, `confidence_score = 0.5`. Does not read any actual data. Drift detection is permanently blind as a result.

**HIGH-03: Dual decision registries with no linkage**

- `intelligence_core.decisions` + `decision_outcomes` (migration 030) — used by Business Brain
- `cognition_decisions` + `outcome_checkpoints` (migration 044) — used by cognition_contract.py

These systems don't cross-reference. No unified decision history exists.

### A.3 CLAIMED but NOT IMPLEMENTED

| Feature | Schema Exists | Logic Exists | Status |
|---------|:---:|:---:|--------|
| Memory Layer (episodic/semantic) | Yes (037) | No | Tables only, zero population logic |
| Ontology Graph | Yes (030) | No | Tables only, zero traversal logic |
| Evidence Freshness Decay | Yes (060) | No | Table only, no decay computation |
| Anomaly Detection | Enum value only | No | No statistical anomaly function |
| Model Drift Detection | Column exists | No | Nothing computes drift_score |
| Churn Score Updates | Enum value only | No | No churn scoring function |
| pg_cron Scheduling | Commented out | No | Daily batch risk not scheduled |
| `cognition_telemetry` table | Referenced | No | Endpoint reads nonexistent table |

---

## SECTION B: UNIFIED INTEGRATION ENGINE AUDIT

### B.1 Integration Pipeline Status

| Category | Link Token | API Endpoints | Canonical Ingest | Cognition Connected | Verdict |
|----------|:---:|:---:|:---:|:---:|---------|
| **CRM** (HubSpot, Salesforce) | Yes | Yes | Yes (edge function) | Partial (live API, not canonical) | **Functional** |
| **Accounting** (Xero, QuickBooks) | Yes | Yes | Yes (edge function) | Partial (live API, not canonical) | **Functional** |
| **Outlook Email** | Yes | Yes | Yes | Yes (priority inbox, intelligence) | **Full** |
| **Gmail Email** | Yes | Yes | Partial (status only) | Minimal | **Partial** |
| **Outlook Calendar** | Yes | Yes | Yes | Yes (calendar intelligence) | **Full** |
| **Google Calendar** | No | No | No | No | **Not implemented** |
| **Google Drive** | Yes | Yes | Yes (file list) | No cognition | **Connected, no intelligence** |
| **HRIS** (BambooHR etc.) | Yes (link modal) | **None** | **None** | **None** | **PHANTOM** |
| **ATS** | Yes (link modal) | **None** | **None** | **None** | **PHANTOM** |
| **Marketing** | Edge fn ready | **No backend** | Edge fn can write | **None** | **Half-built** |
| **Ticketing** (Jira/Asana) | Yes | Yes (delegate) | No ingest | No | **Write-only** |

### B.2 CRITICAL FINDINGS

**CRITICAL-04: Canonical tables are orphaned — the biggest architectural gap**

The `business-brain-merge-ingest` edge function populates `business_core` tables (deals, invoices, payments, customers, companies, owners) — but the backend API routes bypass these tables entirely and call Merge's API directly at query time.

```
ACTUAL FLOW:
Merge API → Edge Function → business_core tables → [DEAD END - no consumers]
Merge API → Backend routes → Direct response to frontend (bypasses canonical)

REQUIRED FLOW:
Merge API → Edge Function → business_core tables → Cognition Engine → Advisor/Watchtower
```

The canonical ingest pipeline is decorative. The cognition engine's real data source is live Merge API calls.

**CRITICAL-05: No scheduled ingest trigger**

The `business-brain-merge-ingest` edge function is invoked manually or one-time. There is no cron job, webhook handler, or scheduled invocation to keep canonical tables fresh. Without automated ingest, the "intelligence over time" promise is impossible.

**HIGH-04: Gmail token refresh is missing**

Gmail connections will silently break after ~1 hour when the access token expires. No `refresh_gmail_token` function exists anywhere. Compare with Outlook which has a fully implemented `refresh_outlook_token_supabase()`.

**HIGH-05: HRIS and ATS are phantom categories**

Offered in the Merge link modal but have zero backend infrastructure. A user could connect BambooHR and literally nothing would happen with the data.

**HIGH-06: No proactive connection health alerts**

Stale/broken integrations are detected only when the user visits the dashboard. No background health monitor, no notification for token expiry, no automated retry for failed ingestion runs.

### B.3 Integration Engine Maturity

| Capability | Status |
|-----------|--------|
| OAuth connection flows | Working (CRM, Accounting, Outlook, Gmail, Drive) |
| Data read from external APIs | Working (live Merge API calls) |
| Canonical data warehouse | Populated but orphaned |
| Scheduled data refresh | Not implemented |
| Webhook-based real-time sync | Not implemented |
| Connection health monitoring | Passive only (on page load) |
| Data freshness tracking | Present but passive |
| Multi-source conflict resolution | Not implemented |

**Unified Integration Engine Score: 5.5/10** — connections work, but data doesn't flow through to intelligence systematically.

---

## SECTION C: INTELLIGENCE SURFACE QUALITY AUDIT

### C.1 Surface-by-Surface Assessment

| Surface | Data Source | Grounding | Quality |
|---------|-----------|-----------|---------|
| **AdvisorWatchtower** | 5 real sources (events, CRM, accounting, email, Brain) | Real data with signal dedup, severity ranking, role-based scoring | **9/10** |
| **RevenuePage** | CRM deals via `/integrations/crm/deals` | Client-side computation from real deal data, scenario modeling with actual probability fields | **9/10** |
| **RiskPage** | `/cognition/risk` + email/calendar signals | 6-category risk matrix with honest "Insufficient data" labels | **8/10** |
| **OperationsPage** | Cognitive snapshot + instability indices | Cross-domain intelligence, limited by lack of PM tool integration | **7/10** |
| **MarketPage** | Watchtower + calibration analysis | Mixed: external signals are real, competitor landscape is AI-calibrated | **6.5/10** |
| **CompliancePage** | Cognitive snapshot | AI-analyzed summaries, not direct regulatory system feeds | **5/10** |

### C.2 SoundBoard Intelligence — PRODUCTION-GRADE

The SoundBoard is the most sophisticated AI component in the platform:

- **Multi-layer guardrails**: Coverage blocking (BLOCKED/DEGRADED/FULL), generic response detection with auto-regeneration, hallucination detection, banned phrase enforcement
- **Real data injection**: Business profile, observation events (up to 30 real signals with deal names/amounts/stages), live CRM/accounting/email data, marketing benchmarks, RAG documents
- **Model routing**: Intent classification routes to appropriate models (GPT-5.4 for finance/risk, Gemini for marketing, Trinity mode for complex analysis)
- **Anti-hallucination**: If LLM disclaims data access despite having it, response is replaced with grounded executive fallback using actual observation events

**Verdict**: When integrations are connected, the SoundBoard delivers genuinely data-specific responses citing real deal names, invoice amounts, and signal severities. Not generic GPT.

### C.3 Intelligence Quality Summary

| Dimension | Score |
|-----------|-------|
| CRM-derived metrics (pipeline, deals, concentration) | **Real data** |
| Accounting-derived metrics (overdue invoices, cash) | **Real data** |
| Email/Calendar signals (fatigue, meeting load) | **Real data** |
| Observation events / watchtower signals | **Real data** |
| Cognition instability indices via SQL | **Hardcoded (broken)** |
| Propagation chains | **SQL-computed (real)** |
| Market positioning / competitor landscape | **AI-calibrated** |
| Explainability (Why Visible / Why Now / Next Action / If Ignored) | **Excellent** |

**Intelligence Surface Quality Score: 8/10** — genuinely impressive when connected, honest about gaps.

---

## SECTION D: ACTION & EXECUTION LAYER AUDIT

### D.1 Action Layer Reality Check

| Capability | UI Exists | Backend Exists | Actually Works | Verdict |
|-----------|:---:|:---:|:---:|---------|
| Auto-Email from alerts | Yes (button) | **No** | **No** | **DECORATIVE** |
| Quick-SMS from alerts | Yes (button) | **No** | **No** | **DECORATIVE** |
| Hand Off / Delegate | Yes (modal) | Yes (`/workflows/delegate/execute`) | Partial | **Internal only** |
| Complete/Ignore alert | Yes | Yes (`/intelligence/alerts/action`) | Yes | **Works** |
| IF/THEN automation rules | Yes (page) | **No** | **No** | **PLACEHOLDER** |
| Scheduled automated actions | No | **No** | **No** | **Not built** |
| Email template + send | No | **No** | **No** | **Not built** |
| CRM task creation | Referenced | Unclear | Unlikely | **Aspirational** |
| Calendar event creation | Yes (modal) | Yes (Outlook only) | Yes | **Works (Outlook)** |

### D.2 The Core Gap

**BIQc detects but cannot act.** The user journey is:

```
See signal → Read analysis → Get recommended action → ...leave the platform to actually do it
```

The SoundBoard suggests actions like "Draft overdue invoice reminders" — clicking them just sends the label as a new chat message. They don't execute anything. The "Auto-Email" and "Quick-SMS" buttons on alerts are `<button>` elements with no `onClick` handlers.

The Automations page is a tier-gated shell that re-displays filtered resolution queue items. There is no rule builder, no trigger system, no scheduled actions.

**Action Layer Score: 2/10** — the single largest gap between "cognition platform" and "dashboard."

---

## SECTION E: SECURITY & GOVERNANCE AUDIT

### E.1 Security Findings

| ID | Finding | Severity | Impact |
|----|---------|----------|--------|
| **S-01** | Unauthenticated voice endpoints (`/api/voice/realtime/session`, `/api/voice/realtime/negotiate`) | **HIGH** | Any caller can generate OpenAI Realtime API sessions charged to your account. Auth block is in try/except that silently swallows failures. Not in rate limit rules. |
| **S-02** | Admin backfill-calibration missing role guard | **HIGH** | Any authenticated user can trigger bulk write of `user_operator_profile` rows for ALL users. Uses service-role client (bypasses RLS). |
| **S-03** | Hardcoded master admin email in 3 files | **MEDIUM** | Cannot rotate master admin without code change + redeploy. |
| **S-04** | Rate limits fail open on DB failure | **MEDIUM** | During Supabase outage, ALL rate limits silently disabled. Uncapped AI costs possible. |
| **S-05** | Test files contain hardcoded credentials (25+ files) | **MEDIUM** | Real Supabase test account passwords in version control. |
| **S-06** | Health endpoints expose internal topology | **LOW** | `/api/health/detailed` reveals service status, integration configs, Redis/Supabase connectivity. |
| **S-07** | `auto_error=False` on HTTPBearer | **LOW** | Missing auth headers don't auto-401; relies on manual checking. |

### E.2 Security Strengths

- **CORS: Well-configured.** Origin regex limits to `*.thestrategysquad.com`, `*.preview.emergentagent.com`, `localhost:3000`. No wildcard with credentials.
- **Security headers: A-grade.** HSTS, X-Frame-Options DENY, X-Content-Type-Options, CSP, Referrer-Policy, Permissions-Policy all set.
- **Rate limiting: Dual-layer.** Middleware sliding window (path-based) + application-level tier-aware monthly quotas with burst protection.
- **RLS: Comprehensive.** 52 migration files enable RLS. Standard `auth.uid() = tenant_id` pattern. Security lint passes (041/042).
- **No hardcoded secrets in production code.** All API keys loaded from `os.environ`.

### E.3 Governance Maturity

| Capability | Status |
|-----------|--------|
| LLM call logging (model, tokens, latency) | Present but **gated behind feature flag** |
| Prompt audit trail (who changed what) | **Working** |
| AI usage tracking per user/feature | **Working** (via `ai_usage_log`) |
| Admin action logging | **Working** (impersonation, password reset, etc.) |
| Dollar-cost attribution per LLM call | **Not implemented** |
| Compliance export (SOC 2 / ISO 27001) | **Not implemented** |
| Data retention policy | **Not implemented** |
| Governance dashboard | **Not implemented** |

**Security & Governance Score: 7/10**

### E.4 Architecture & Production Readiness

| Metric | Value |
|--------|-------|
| Backend route files | 44 |
| Total endpoints | ~291 |
| Edge Functions | 20 |
| SQL migrations | 62 |
| Frontend pages | 35+ |
| Test files | 83 |
| Tests in CI/CD | **0 (not integrated)** |
| Staging environment | **None** |
| Docker workers | Single uvicorn |

**Production Readiness Score: 6.5/10**

---

## SECTION F: GAP ANALYSIS — Current State vs World-Class CaaP + UIE

### F.1 What IS World-Class Today

1. **Business Brain Engine** — genuine deterministic computation from real data, truth-aware, zero AI speculation
2. **SoundBoard guardrail system** — coverage blocking, generic detection, hallucination prevention, multi-model routing
3. **Intelligence surface explainability** — every surface has Why Visible / Why Now / Next Action / If Ignored strips
4. **Data honesty** — "Insufficient data" labels, empty state messaging, integration CTAs. Platform doesn't fake what it doesn't have
5. **Security headers and CORS** — OWASP-grade HTTP security posture
6. **Propagation rules** — deterministic cross-domain risk chain computation

### F.2 What Prevents World-Class Status

| # | Gap | Impact | Effort | Priority |
|---|-----|--------|--------|----------|
| 1 | **Action layer is decorative** — Auto-Email, SMS, automation buttons don't work | Platform is a dashboard, not a cognition platform | HIGH | **P0** |
| 2 | **Cognition SQL contract uses hardcoded indices** — real engine from 033/034 replaced by binary toggles | `/cognition/{tab}` returns fake instability numbers | MEDIUM | **P0** |
| 3 | **Canonical tables orphaned** — business_core populated but never consumed by cognition | Ingest pipeline is decorative | MEDIUM | **P0** |
| 4 | **Unauthenticated voice endpoints** — OpenAI Realtime API cost exposure | Unbounded cost attack vector | LOW | **P0** |
| 5 | **Admin backfill missing role guard** — privilege escalation | Any user can trigger cross-tenant writes | LOW | **P0** |
| 6 | **No scheduled ingest trigger** — canonical data goes stale immediately | "Intelligence over time" impossible | MEDIUM | **P1** |
| 7 | **Checkpoint evaluator is a stub** — confidence feedback loop broken | All decisions appear 100% effective forever | MEDIUM | **P1** |
| 8 | **Gmail token refresh missing** — connections die after 1 hour | Gmail users silently lose connectivity | LOW | **P1** |
| 9 | **HRIS/ATS phantom categories** — link modal offers connection, nothing happens | Trust-damaging false promise | LOW | **P1** |
| 10 | **No tests in CI/CD** — 83 test files never run before deploy | Regressions ship to production | LOW | **P1** |
| 11 | **No proactive connection health alerts** — broken integrations discovered passively | Users lose trust when data silently stops | MEDIUM | **P2** |
| 12 | **Memory/Ontology/Freshness Decay — tables only** — three architectural pillars have zero runtime logic | Advanced cognition features are schema-only | HIGH | **P2** |
| 13 | **Dual decision registries** — Brain and Cognition Contract don't cross-reference | No unified decision history | LOW | **P2** |
| 14 | **Google Calendar not implemented** — only Outlook Calendar works | Half the email-connected user base has no calendar | MEDIUM | **P2** |

---

## SECTION G: PRIORITISED REMEDIATION ROADMAP

### Phase 2A — Critical Fixes (Week 1-2)

**Security (same day):**
1. Add `Depends(get_current_user)` to voice endpoints (`server.py`)
2. Add `Depends(get_super_admin)` to backfill-calibration route (`admin.py`)
3. Move master admin email to `MASTER_ADMIN_EMAIL` env var

**Cognition Core Recovery:**
4. Restore `ic_calculate_risk_baseline` from migration 034 (the REAL engine) — remove the 045 override that replaced it with hardcoded indices
5. Fix `ic_generate_cognition_contract` to call the real `ic_calculate_risk_baseline` from 034 for actual stddev-based volatility computation
6. Fix `fn_evaluate_pending_checkpoints` to compare `predicted_instability` vs current actual metrics instead of auto-approving all checkpoints
7. Fix `fn_snapshot_daily_instability` to read real metric data and write actual values instead of zeros
8. Fix `fn_assemble_evidence_pack` to query and include actual data points with values and timestamps

### Phase 2B — Integration Engine Activation (Week 2-4)

**Canonical Pipeline Activation:**
9. Wire backend cognition routes to READ from `business_core` canonical tables instead of calling Merge API directly
10. Deploy `business-brain-merge-ingest` edge function to production and create scheduled trigger (pg_cron or Azure timer)
11. Implement `refresh_gmail_token()` for Gmail connections
12. Remove HRIS and ATS from Merge link modal until backend endpoints exist (or build them)
13. Implement Google Calendar integration (read + create events)

### Phase 2C — Action Layer Foundation (Week 4-8)

**Minimum Viable Action Platform:**
14. Wire Auto-Email button to actually send emails via connected Outlook/Gmail
15. Wire Hand Off to create tasks in connected CRM (HubSpot tasks via Merge)
16. Build basic IF/THEN automation engine with 5 starter rules:
    - IF invoice overdue > 7 days → generate payment reminder draft
    - IF deal stalled > 14 days → alert assigned owner
    - IF new lead not contacted in 24h → surface priority alert
    - IF cash runway < 8 weeks → escalate to finance priority
    - IF meeting cancellation cluster detected → flag people risk
17. Implement triggered notification system (in-app + optional email digest)

### Phase 2D — Production Hardening (Week 4-6, parallel)

18. Add `pytest` step to `deploy.yml` before Docker build
19. Remove or consolidate duplicate `main_biqc-web.yml` workflow
20. Move test credentials to environment variables
21. Activate `observability_full_enabled` feature flag for LLM call logging
22. Implement dollar-cost attribution on LLM calls (track actual token costs from API response)
23. Schedule `pg_cron` jobs for daily risk baseline computation

---

## SECTION H: THE PATH TO WORLD-CLASS

### Current State (6.2/10)
BIQc is a **world-class intelligence reading platform** with a placeholder action layer. The cognition quality is genuinely differentiated — the Business Brain Engine, SoundBoard guardrails, and surface explainability are better than most enterprise BI tools. But the platform stops at "here's what you should do" and never reaches "let me help you do it."

### Target State (8.5/10) — After Phase 2A-2D
- Real instability indices computed from actual business data
- Canonical data pipeline flowing: Merge → business_core → Cognition → Advisor
- Users can execute at least 3 action types from within the platform
- Basic automation rules running in background
- Security gaps closed, CI/CD with tests, governance logging active

### World-Class State (9.5/10) — Phase 3+
- Full action layer with email/SMS/task/calendar execution
- Multi-step propagation chain tracing
- Memory layer operational (episodic + semantic)
- Confidence feedback loop working (real checkpoint evaluation)
- Proactive intervention chains (detect → alert → suggest → execute)
- Weekly intelligence digest auto-generated
- Mobile push notifications for critical signals
- Multi-workspace / agency mode for resellers

---

## APPENDIX: FILE INVENTORY

### Key Files Audited

**Cognition Core:**
- `supabase/migrations/030_intelligence_spine.sql`
- `supabase/migrations/033_*.sql` (risk baseline)
- `supabase/migrations/034_*.sql` (risk weights)
- `supabase/migrations/037_cognition_platform.sql`
- `supabase/migrations/044_cognition_core.sql`
- `supabase/migrations/045_cognition_core_functions.sql`
- `supabase/migrations/058_cognition_platform_hardening.sql`
- `supabase/migrations/060_cognition_activation_alignment.sql`
- `backend/routes/cognition_contract.py`
- `backend/business_brain_engine.py`
- `backend/intelligence_live_truth.py`
- `backend/routes/business_brain.py`
- `backend/routes/unified_intelligence.py`

**Integration Engine:**
- `backend/routes/integrations.py`
- `backend/routes/email.py`
- `backend/routes/data_center.py`
- `frontend/src/hooks/useIntegrationStatus.js`
- `supabase/functions/business-brain-merge-ingest/index.ts`
- `supabase_edge_functions/business-brain-merge-ingest/index.ts`

**Intelligence Surfaces:**
- `frontend/src/pages/AdvisorWatchtower.js`
- `frontend/src/pages/RevenuePage.js`
- `frontend/src/pages/OperationsPage.js`
- `frontend/src/pages/RiskPage.js`
- `frontend/src/pages/MarketPage.js`
- `frontend/src/pages/CompliancePage.js`
- `frontend/src/pages/MySoundBoard.js`
- `frontend/src/pages/ActionsPage.js`

**Security & Architecture:**
- `backend/server.py`
- `backend/auth_supabase.py`
- `backend/supabase_client.py`
- `backend/core/config.py`
- `backend/routes/deps.py`
- `backend/routes/admin.py`
- `backend/guardrails.py`
- `.github/workflows/deploy.yml`
- `docker-compose.yml`
- `Dockerfile.backend`
- `Dockerfile.frontend`

---

*End of Phase 2 Audit Report*
*Next: Remediation execution per Phase 2A priority list*
