# BIQc Platform — PRD
## Updated: 2026-02-25

## Architecture
- Frontend: React + Tailwind (Liquid Steel)
- Backend: FastAPI (rendering/routing only)
- Database: Supabase (PostgreSQL, Auth, Edge Functions, Realtime, pg_cron)
- AI: OpenAI gpt-4o-mini (Edge Functions only)
- Cognition: 5 SQL engines → 1 Edge Function → LLM → unified snapshot → modular rendering
- Production: biqc.thestrategysquad.com

## Completed (Full Session)
- P0: Calibration signup fix, password reset flow, auth resilience
- Forensic Calibration scoring, Channel Intelligence, Market Intelligence
- BIQc Action Plan with deterministic overlay
- 5 SQL engines deployed (detect_contradictions, update_escalation, calibrate_pressure, decay_evidence, compute_market_risk_weight)
- Edge Function wired with full deterministic chain
- BIQc Insights 5-tab enrichment (Money, Revenue, Operations, People, Market)
- 5 shell pages wired to cognitive data (Compliance, Actions, Automations, Reports, AuditLog)
- Mobile: bottom nav, soundboard modal, responsive grids, touch targets, reduced motion
- Edge Function warmup fix (200 instead of 401)
- Login mobile padding, forgot password link

## All Pages Now Live
| Page | Data Source | Status |
|---|---|---|
| BIQc Insights (/advisor) | useSnapshot → 5 tabs | Live |
| Market (/market) | snapshot + market-intelligence | Live |
| Revenue (/revenue) | useSnapshot | Live |
| Operations (/operations) | useSnapshot | Live |
| Risk (/risk) | useSnapshot | Live |
| Compliance (/compliance) | useSnapshot | Live |
| Actions (/actions) | useSnapshot → resolution_queue | Live |
| Automations (/automations) | useSnapshot → automatable actions | Live |
| Reports (/reports) | useSnapshot → weekly_brief/memo | Live |
| Audit Log (/audit-log) | useSnapshot → event log | Live |

## Pending
- P2: Stripe paid gating
- P2: Real channel APIs (Google Ads, Meta, LinkedIn)
- P2: SQL triggers for auto-refresh
- P3: Legacy page consolidation (8 pages)
- P3: Python engine deprecation
