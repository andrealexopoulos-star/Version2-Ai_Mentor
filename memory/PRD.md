# BIQc Platform — PRD
## Updated: 2026-02-24

## Architecture
- Frontend: React + Tailwind (Liquid Steel)
- Backend: FastAPI (rendering/routing only)
- Database: Supabase (PostgreSQL, Auth, Edge Functions, Realtime, pg_cron)
- AI: OpenAI gpt-4o-mini (Edge Functions only)
- Cognition: 5 SQL deterministic engines → 1 Edge Function → LLM synthesis
- Production: biqc.thestrategysquad.com

## Deterministic Cognition Chain (Deployed)
```
detect_contradictions() → update_escalation() → calibrate_pressure() → decay_evidence() → compute_market_risk_weight() → LLM
```
- 5 SQL functions replace 1,016 lines of Python
- Execute at database speed (~10-50ms vs 200-500ms Python-over-HTTP)
- All functions use SECURITY DEFINER with RLS on every table
- Fallback: TypeScript overlay if any RPC fails

## SQL Functions Deployed
| Function | Replaces | Python Lines | SQL Lines | Status |
|---|---|---|---|---|
| compute_market_risk_weight() | N/A (new) | - | 40 | Deployed |
| detect_contradictions() | contradiction_engine.py | 251 | 140 | Deployed |
| calibrate_pressure() | pressure_calibration.py | 300 | 200 | Deployed |
| decay_evidence() | evidence_freshness.py | 279 | 130 | Deployed |
| update_escalation() | escalation_memory.py | 186 | 110 | Deployed |

## Deployment Required
- `supabase functions deploy biqc-insights-cognitive` (wires all 5 RPCs into chain)

## Pending
- P2: Stripe paid gating
- P2: Wire shell pages (Compliance, Actions, Automations, Reports, AuditLog)
- P2: Real channel APIs (Google Ads, Meta, LinkedIn)
- P2: SQL triggers for auto-refresh (on integration/profile/calibration change)
- P3: Legacy page consolidation (8 pages)
- P3: Python engine deprecation (after dual-run validation)
