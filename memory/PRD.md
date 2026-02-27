# BIQc Platform - PRD

## Architecture
- **Frontend**: React + Tailwind + Shadcn/UI
- **Backend**: FastAPI → Supabase SQL Functions (15 endpoints)
- **Database**: Supabase PostgreSQL + 10 SQL Functions + 3 Triggers + 4 pg_cron Jobs
- **AI Engine**: OpenAI gpt-4o-mini via Edge Functions

## Completed — All Sessions

### Deep Market Modeling (MarketPage — 5 tabs)
- **Focus tab**: Existing intelligence (moves, risks, opportunities, goal tracking)
- **Saturation tab**: Market position score, demand capture rate, competitor landscape, watchtower positions
- **Demand tab**: Goal achievement probability, misalignment index, pipeline, pressure by channel
- **Friction tab**: Data freshness with decay scoring, friction points, conversion intelligence
- **Reports tab**: Cognitive snapshot history

### Deep Intelligence Modules (SQL-Backed)
- Workforce Intelligence (RiskPage — 2 tabs)
- Growth/Scenario Planning (RevenuePage — 3 tabs)
- Weighted Scoring Formula (AdvisorWatchtower)

### SQL Intelligence Layer
- 10 SQL functions replacing Python modules
- 3 database triggers (auto-fire on events)
- 4 pg_cron scheduled jobs (deployed + running)
- Merge.dev → governance_events auto-emission

### Trust Reconstruction
- workspace_integrations, governance_events, report_exports tables
- Hard gating on AuditLog, Reports, Executive Memo
- PDF generation engine
- Deterministic scrape engine

### Integrity Lockdown
- Blog (16 articles with verified citations)
- Knowledge Base (public, 7 guides + 10 FAQs)
- Zero fake data discipline
- Password visibility, signup errors, routing fixes

## Backlog
### P1
- [ ] Stripe Paid Gating
### P2
- [ ] Signal Provenance Layer
- [ ] "Since Your Last Visit"
### P3
- [ ] CSS Consolidation, Legacy Cleanup
