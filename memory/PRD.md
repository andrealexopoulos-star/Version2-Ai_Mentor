# BIQc Platform - PRD (Product Requirements Document)

## Original Problem Statement
Transform BIQc into a high-performance, AI-driven "Cognition-as-a-Platform" for SMBs with a premium "Liquid Steel" dark theme, Supabase-first architecture, and zero fake data discipline.

## Architecture
- **Frontend**: React (CRA) + Tailwind + Shadcn/UI
- **Backend**: FastAPI (thin Supabase client only)
- **Database**: Supabase (PostgreSQL, Auth, Edge Functions, Realtime)
- **AI Engine**: OpenAI gpt-4o-mini via Edge Functions
- **CRM Integration**: Merge.dev (HubSpot)

## Core Principles
1. **Supabase-First**: FastAPI is only a thin client.
2. **No Fake Data**: UI shows "insufficient data" states, never fabricated metrics.
3. **Trust by Default**: Integration truth before claims.
4. **Deterministic Integrity**: No AI narrative filler without verified signal data.

---

## Completed Work

### Session 3: Feb 27, 2026 — Deep Intelligence Modules

**Workforce Intelligence (RiskPage.js):**
- Two-tab structure: Risk & Governance + Workforce Intelligence
- Workforce tab: Capacity utilisation meter, fatigue level, pending decisions, calendar density, email stress, key-person dependency (SPOF)
- Integration-gated: Requires email/calendar connection
- Null state with "Connect email and calendar" CTA

**Growth/Scenario Planning (RevenuePage.js):**
- Three-tab structure: Pipeline + Scenarios + Concentration
- Scenarios tab: Best/base/worst case projections computed from real CRM deal probability data
- Pipeline by probability distribution (high/medium/low tiers with bars)
- Win/loss analysis from real data
- Concentration tab: Revenue risk by client company with percentage bars, top client share, diversification score
- All computed from real CRM deals only

**Weighted Scoring Formula (AdvisorWatchtower.js):**
- Score = (severity_weight * alert_count) + (metrics * 5) + (details ? 10 : 0) + (insight ? 5 : 0)
- Severity weights: high=3, medium=2, low=1
- Score displayed in group header with color-coded badge (green/yellow/red)
- Max score capped at 100

### Session 2: Feb 27, 2026 — Trust Reconstruction (7 Sections)
- SQL migration 021_trust_reconstruction.sql (workspace_integrations, governance_events, report_exports, business_profiles provenance)
- AuditLogPage queries governance_events from Supabase (no AI-generated entries)
- ReportsPage financial snapshot gated behind accounting integration
- PDF generation engine (/api/reports/generate-pdf)
- Scrape engine hard lock (deterministic metadata extraction only)
- Synthetic string purge (Client A/B removed)

### Session 1: Feb 27, 2026 — Full-Spectrum Integrity Lockdown (7 Phases)
- Placeholder eradication across all dashboard pages
- Blog engine with 16 verified-citation articles
- Knowledge Base public access with 7 guides + 10 FAQs
- Password dot visibility fix
- Try for Free routing verification
- Signup error handling improvements

### Earlier Sessions (inherited):
- Liquid Steel dark theme, mobile navigation
- Forensic Identity Card, Snapshot v2
- High-ticket pricing page (5 tiers)
- Soundboard panel (ChatGPT-style)
- Auth hardening, password reset

---

## Deployment Queue (USER ACTION REQUIRED)

| Item | Action |
|------|--------|
| `021_trust_reconstruction.sql` | Run in Supabase SQL Editor |
| `scrape-business-profile` | `supabase functions deploy scrape-business-profile` |
| `calibration-business-dna` v2 | `supabase functions deploy calibration-business-dna` |
| `biqc-insights-cognitive` v2 | `supabase functions deploy biqc-insights-cognitive` |
| `query-integrations-data` | `supabase functions deploy query-integrations-data` |
| `020_insight_outcomes.sql` | Run in Supabase SQL Editor |

---

## Prioritized Backlog

### P0 (Critical) — COMPLETED
- [x] Full-Spectrum Integrity Lockdown
- [x] Trust Reconstruction
- [x] Deep Intelligence Modules

### P1 (High Priority)
- [ ] Stripe Paid Gating (test key in pod)
- [ ] Google Ads Integration
- [ ] Populate governance_events from integration syncs
- [ ] Deep Market Modeling (saturation, demand capture, funnel friction) — MarketPage enhancement

### P2 (Medium Priority)
- [ ] Signal Provenance Layer (C1)
- [ ] State Justification (C2)
- [ ] "Since Your Last Visit" (C3)
- [ ] Chat Determinism (C5)
- [ ] SQL Migration remaining modules
- [ ] Supabase Security Audit

### P3 (Tech Debt)
- [ ] CSS Consolidation (13 -> 2 files)
- [ ] Legacy Page Cleanup (8+ pages)
- [ ] Recover Missing Edge Functions
