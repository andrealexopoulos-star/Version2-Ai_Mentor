# BIQc Platform - PRD

## Original Problem Statement
Transform BIQc into a high-performance, AI-driven "Cognition-as-a-Platform" for SMBs with zero fake data discipline.

## Architecture
- **Frontend**: React (CRA) + Tailwind + Shadcn/UI
- **Backend**: FastAPI (thin Supabase client) + SQL Functions
- **Database**: Supabase (PostgreSQL, Auth, Edge Functions, Realtime)
- **AI Engine**: OpenAI gpt-4o-mini via Edge Functions
- **CRM Integration**: Merge.dev (HubSpot)

---

## Completed — This Session

### Deep Intelligence Modules (SQL-Backed)

**SQL Migration `022_intelligence_modules.sql`:**
- `compute_workforce_health(workspace_id)` — Capacity, fatigue, pending decisions from email events
- `compute_revenue_scenarios(workspace_id)` — Win rate, deal counts from CRM events
- `compute_insight_scores(workspace_id)` — Weighted scoring per domain (severity*alerts + bonuses)
- `compute_concentration_risk(workspace_id)` — Client diversification from CRM references
- `v_integration_status` — View: integration status per workspace
- `v_governance_summary` — View: 30-day event summary by source

**Backend API Routes (`/api/intelligence/...`):**
- `/workforce` — SQL-backed workforce health
- `/scenarios` — SQL-backed revenue scenarios
- `/scores` — Weighted insight scores
- `/concentration` — Revenue concentration risk
- `/integration-status` — Workspace integration status from `workspace_integrations` table
- `/governance-summary` — Governance events summary

**Frontend Integration:**
- `RiskPage.js` — Fetches `/intelligence/workforce` + `/intelligence/scores` alongside snapshot data
- `RevenuePage.js` — Fetches `/intelligence/scenarios` alongside CRM deals
- `AdvisorWatchtower.js` — Uses weighted scoring formula in parseToGroups

### Earlier This Session
- Trust Reconstruction (7 sections) — All SQL tables, hard gating, PDF engine
- Full-Spectrum Integrity Lockdown — Blog (16 articles), KB public, password dots, signup errors
- Placeholder eradication — Zero fake data across all dashboard pages

---

## Deployment Queue

| Item | Action | Status |
|------|--------|--------|
| `020_insight_outcomes.sql` | Supabase SQL Editor | DEPLOYED |
| `021_trust_reconstruction.sql` | Supabase SQL Editor | DEPLOYED |
| `022_intelligence_modules.sql` | Supabase SQL Editor | **NEEDS DEPLOY** |
| Edge Functions (4) | Supabase Dashboard | DEPLOYED |

---

## Backlog

### P1
- [ ] Stripe Paid Gating
- [ ] Deep Market Modeling (MarketPage saturation/demand/friction)
- [ ] Wire governance_events population from Merge.dev sync

### P2
- [ ] Signal Provenance, State Justification, "Since Last Visit"
- [ ] Chat Determinism, SQL Migration remaining

### P3
- [ ] CSS Consolidation, Legacy Cleanup, Edge Function Recovery
