# BIQc Full Environment Visibility Report
## For Cognition-as-a-Platform Architecture Agent
## Generated: 1 March 2026 | Read-Only | No Credentials Exposed

---

## 1. SOURCE CODE INVENTORY

### Backend (Python/FastAPI) — 68 files
| Category | Files | Key Functions |
|----------|-------|---------------|
| Routes | 28 | 195 API endpoints across integrations(27), calibration(20), email(18), generation(17), intelligence(15+8), profile(14), admin(14), spine(13) |
| Core Logic | 18 | auth_supabase, intelligence_spine, tier_resolver, fact_resolution, snapshot_agent, merge_client, watchtower_engine, contradiction_engine, pressure_calibration, evidence_freshness, silence_detection, escalation_memory |
| Middleware | 2 | tier_guard, __init__ |
| Supabase Helpers | 6 | supabase_client, supabase_document/drive/email/intelligence/remaining_helpers |
| Tests | 38 | iterations 10-79 + p0 tests |
| Server | 1 | server.py (main app, router registration) |

### Edge Functions (Deno/TypeScript) — 18 functions
| Function | Lines | Model | Temperature | Purpose |
|----------|-------|-------|-------------|---------|
| biqc-insights-cognitive | 870 | Perplexity sonar + GPT-4o-mini | 0.5 | Cognitive snapshot generation |
| calibration-business-dna | 424 | Perplexity sonar + GPT-4o-mini | 0.3 | URL scan + identity extraction |
| boardroom-diagnosis | 347 | GPT-4o-mini | 0.4 | Executive advisory |
| strategic-console-ai | 330 | Perplexity sonar | 0.4 | Strategic synthesis |
| cfo-cash-analysis | 316 | GPT-4o-mini | 0.2 | Cash flow analysis |
| calibration_psych | 274 | None (questionnaire) | — | Calibration questions |
| competitor-monitor | 270 | Perplexity sonar | 0.2 | Weekly competitor scan |
| market-analysis-ai | 264 | Perplexity sonar | 0.35 | Market positioning |
| business-identity-lookup | 261 | None | — | ABN registry lookup |
| scrape-business-profile | 257 | None | — | Deterministic HTML extraction |
| query-integrations-data | 253 | GPT-4o-mini | 0.3 | Soundboard data queries |
| calibration-psych | 232 | None | — | Calibration questions |
| sop-generator | 190 | GPT-4o-mini | 0.4 | SOP document generation |
| checkin-manager | 188 | None | — | Weekly check-in scheduling |
| intelligence-bridge | 183 | None | — | Signal correlation |
| calibration-sync | 182 | GPT-4o-mini | 0.1 | Calibration state sync |
| watchtower-brain | 88 | GPT-4o-mini | 0.5 | Watchtower analysis |
| warm-cognitive-engine | 30 | None | — | Cold start prevention |

### Frontend (React) — 142 JS files
| Category | Count |
|----------|-------|
| Pages | ~45 |
| Components | ~35 |
| Hooks | ~8 |
| Design System | 4 |
| CSS Files | 8 |
| Data/Constants | 3 |

### SQL Migrations — 24 files (001-036)

---

## 2. DATABASE SCHEMA

### Supabase Tables (31 confirmed)
| Table | Status | Purpose |
|-------|--------|---------|
| users | ✓ | User accounts |
| business_profiles | ✓ | Business DNA + subscription_tier |
| integration_accounts | ✓ | Merge.dev CRM/accounting connections |
| intelligence_snapshots | ✓ | Cognitive snapshot storage |
| observation_events | ✓ | Raw signal events |
| email_connections | ✓ | Gmail/Outlook OAuth |
| strategic_console_state | ✓ | Calibration/onboarding state |
| workspace_integrations | ✓ | Integration status truth table |
| governance_events | ✓ | Append-only audit events |
| report_exports | ✓ | PDF export audit trail |
| insight_outcomes | ✓ | AI prediction tracking |
| escalation_history | ✓ | Escalation tracking |
| ingestion_sessions | ✓ | Scrape session metadata |
| ingestion_pages | ✓ | Per-page raw HTML |
| ingestion_cleaned | ✓ | Cleaned text storage |
| ingestion_audits | ✓ | Forensic audit results |
| soundboard_conversations | ✓ | Chat history |
| documents | ✓ | Document storage |
| system_prompts | ✓ | Configurable AI prompts |
| ic_feature_flags | ✓ | Intelligence Spine flags |
| ic_intelligence_events | ✓ | Spine event log |
| ic_daily_metric_snapshots | ✓ | Daily metric snapshots |
| ic_ontology_nodes | ✓ | Knowledge graph nodes |
| ic_ontology_edges | ✓ | Knowledge graph edges |
| ic_decisions | ✓ | Decision registry |
| ic_decision_outcomes | ✓ | Decision outcome tracking |
| ic_model_registry | ✓ | Model versioning |
| ic_model_executions | ✓ | Model execution log |
| ic_event_queue | ✓ | Durable write queue |
| ic_risk_weight_configs | ✓ | Industry risk weights |
| ic_industry_codes | ✓ | Canonical industry enum |
| payment_transactions | ✗ | NOT DEPLOYED (029) |
| data_center_files | ✗ | NOT DEPLOYED |
| forensic_calibrations | ✗ | NOT DEPLOYED |

### Key Relationships
```
users.id → business_profiles.user_id
users.id → strategic_console_state.user_id
users.id → integration_accounts.user_id
users.id → intelligence_snapshots.user_id
users.id → soundboard_conversations.user_id
workspace_integrations.workspace_id → users.id
governance_events.workspace_id → users.id
ic_*.tenant_id → users.id
```

### SQL Functions (25 deployed)
All deployed and callable via Supabase RPC. Functions requiring `p_workspace_id` need UUID parameter.

---

## 3. ENVIRONMENT VARIABLES

### Backend (.env)
| Variable | Purpose |
|----------|---------|
| SUPABASE_URL | Supabase project URL |
| SUPABASE_ANON_KEY | Public anon key for auth |
| SUPABASE_SERVICE_ROLE_KEY | Admin access to all tables |
| OPENAI_API_KEY | GPT-4o API access |
| EMERGENT_LLM_KEY | Emergent universal LLM key |
| SERPER_API_KEY | Google search API |
| MERGE_API_KEY | CRM/accounting integration |
| STRIPE_API_KEY | Payment processing |
| AZURE_CLIENT_ID/SECRET/TENANT | Outlook OAuth |
| GOOGLE_CLIENT_ID/SECRET | Google OAuth |
| JWT_SECRET_KEY | JWT token signing |
| MONGO_URL | MongoDB (legacy) |

### Frontend (.env)
| Variable | Purpose |
|----------|---------|
| REACT_APP_BACKEND_URL | API base URL |
| REACT_APP_SUPABASE_URL | Supabase project URL |
| REACT_APP_SUPABASE_ANON_KEY | Public Supabase key |
| REACT_APP_GOOGLE_CLIENT_ID | Google OAuth |

---

## 4. DEPLOYMENT PIPELINE

### Current (Emergent → GitHub → Manual)
```
1. Code changes in Emergent platform
2. "Save to GitHub" → pushes to GitHub repo
3. Manual copy Edge Functions from GitHub → Supabase Dashboard
4. Manual run SQL migrations in Supabase SQL Editor
5. Manual rebuild Docker → push to Azure Container Registry → restart App Service
```

### Planned (Azure CI/CD)
```
GitHub → Azure Container Registry → Azure App Service (always-on)
Supabase: Database + Auth + Edge Functions (managed separately)
```

### Files Ready for Azure
```
/app/Dockerfile.backend
/app/Dockerfile.frontend
/app/docker-compose.yml
/app/deploy/azure-deploy.sh
/app/deploy/nginx.conf
/app/deploy/AZURE_GUIDE.md
```

---

## 5. OBSERVABILITY DATA

### Current Logging
| Layer | What's Logged | Where |
|-------|--------------|-------|
| Backend | Request/response, auth events, errors | stdout → supervisor logs |
| Edge Functions | Execution logs | Supabase Dashboard → Logs |
| Intelligence Spine | Events, model executions, queue writes | ic_intelligence_events, ic_model_executions |
| pg_cron | Job execution results | Supabase pg_cron logs |

### Known Performance Benchmarks
| Operation | Latency |
|-----------|---------|
| Auth callback (refactored) | <500ms |
| Cognitive snapshot generation | 5-12s |
| DSEE scan (full) | 40-90s |
| SoundBoard response | 1-3s |
| Ingestion (hybrid headless) | 15-30s |
| Edge Function cold start | 3-8s |

### Token Usage
**Not tracked.** No Edge Function or backend route logs token consumption. This is a gap.

### Error Patterns (Production)
- 401 on `/api/calibration/status` → JWT validation failure → blank dashboard
- Response body stream already read in Merge Link flow
- Gmail/Outlook/Merge integration checks all fail-open silently
- Console outputs ~19 errors per page load

---

## 6. INTELLIGENCE SPINE STATUS

### Tables: ALL DEPLOYED ✓
### Feature Flag: `intelligence_spine_enabled = false` (dormant)
### pg_cron Jobs: 4 active (evidence-freshness, silence-detection, contradiction-check, daily-summary)
### Risk Calibration: NEEDS_MORE_DATA (0 executions, 0 snapshots)
### Activation: Blocked until 14-day validation passes

---

## 7. CRITICAL ISSUES FOR NEW AGENT

| # | Issue | Impact | Priority |
|---|-------|--------|----------|
| 1 | Production 401 on all API calls → blank dashboard | Users cannot use platform | CRITICAL |
| 2 | Extraction prompt instructs hallucination | AI fabricates business data | HIGH (FIXED in code, needs deploy) |
| 3 | Context truncation at 8000 chars | Incomplete cognitive snapshots | HIGH (FIXED in code, needs deploy) |
| 4 | No RAG/vector for SoundBoard | Generic chat responses | HIGH |
| 5 | 6 CSS files conflicting on mobile | Login button renders as blue circle | MEDIUM |
| 6 | 38 website claims not delivered | Marketing/capability gap | MEDIUM |
| 7 | Intelligence Spine not activated | Risk baseline dormant | MEDIUM |
