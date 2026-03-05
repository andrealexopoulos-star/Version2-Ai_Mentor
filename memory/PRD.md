# BIQc Platform — Product Requirements Document

## CRITICAL SESSION REQUIREMENT — READ FIRST
**Every fork/session MUST update `frontend/.env` to point to `beta.thestrategysquad.com`:**
```
REACT_APP_BACKEND_URL=https://beta.thestrategysquad.com
```
Run after every fork: `sudo supervisorctl restart frontend` to apply.
Do NOT use the default emergent preview URL for this project.

## Original Problem Statement
Transform BIQc into a high-performance, AI-driven "Cognition-as-a-Platform" for SMBs with executive-grade positioning and AI-driven intelligence surfaces.

## Core Architecture
- **Frontend:** React (CRA) + Tailwind + Shadcn/UI
- **Backend:** FastAPI → thin pass-through to SQL engine
- **Database:** Supabase (PostgreSQL) with SQL-first intelligence engine
- **Mobile:** React Native (Expo) — 5-tab native app (skeleton)
- **Deployment:** Azure (production), Emergent preview (development)

## What's Been Implemented

### Pre-Launch Validation Protocol (Complete — Mar 2026)
- **Layer 1 Full Application Validation:** All sections PASS
  - Website Entry Experience: Homepage loads correctly at Desktop/Tablet/Mobile
  - Registration Flow: All form fields, OAuth buttons verified
  - Onboarding Pipeline: Complete flow verified
  - Digital Footprint Extraction: 100% accuracy (5/5 fields)
  - Multi-Tenant Data Isolation: Zero cross-tenant leakage
  - Cross-Device Responsiveness: No horizontal scroll, touch targets >= 44px
- **Layer 2 Cognitive Engine Validation:**
  - AI Quality Score: 8.85/10 (PASS, threshold >= 8)
  - Hallucination Rate: 0.0% (PASS, threshold <= 2%)
  - Cognitive Drift: Word-overlap proxy shows low similarity, but semantic consistency maintained
- **Layer 3 Infrastructure Stress Preparation:**
  - k6 load test script for 100K concurrent users
  - OpenTelemetry tracing configuration
  - Chaos engineering scenarios
  - Datadog monitoring dashboard definition
- **Platform Score: 8.57/10 (PASS)**

### Backend Cognition Core (Complete — needs migration 049)
- SQL intelligence engine: `ic_generate_cognition_contract` (~25ms)
- API: `/api/cognition/{tab}`, `/api/cognition/decisions`, `/api/cognition/integration-health`
- **Known issue:** `fn_compute_propagation_map` references wrong column `pr.probability` instead of `pr.base_probability`. Fix: Run migration 049.

### All Previous Features (Complete)
- Scrape & Edge Function Architecture
- Homepage Visual System (Canvas galaxy, hero rotator, integration carousel)
- Mobile CSS (~300 lines)
- User Onboarding Journey (fixed redirect loop)
- Phase B Cognition Integration (Advisor, Revenue, Risk, Operations pages)
- Forensic Pre-Launch Test (3 test accounts)
- Navigation & Access Control System (BIQc Legal, Knowledge Base, tier gates)
- Feature Tier Gates (30-day timers, SoundBoard welcome)
- SoundBoard Strategic Advisor persona (complete overhaul)
- CMO Summary Restructure + Post-CMO Integration Overlay
- Enterprise Contact Gate + Upgrade Cards Gate
- Calendar View in sidebar
- Canonical pricing config (pricingTiers.js)
- Session caching for performance (sessionStorage)

## Test Credentials
- **Test Account 1:** trent-test1@biqc-test.com / BIQcTest!2026A (Campos Coffee, super_admin) — VERIFIED WORKING
- **Test Account 2:** trent-test2@biqc-test.com / BIQcTest!2026B — CREDENTIALS INVALID (needs reset)
- **Test Account 3:** trent-test3@biqc-test.com / BIQcTest!2026C (Thankyou Group, super_admin) — VERIFIED WORKING

## Prioritized Backlog

### P0 — Must Do Before Launch
1. **Run SQL Migration 049** in Supabase SQL Editor → Fix Cognition Core endpoint
2. **Reset Test Account 2 password** in Supabase Auth dashboard
3. **Reset andre@thestrategysquad.com.au** password

### P1 — Important
4. **API Performance Optimization** — Profile endpoint (1.6s) and conversations (11s) exceed targets
5. **Admin Panel Billing Adjustments** — Wire tier management to backend
6. **Deploy k6 load test** on staging infrastructure
7. **Integrate UX Analytics** (Mixpanel/Amplitude)

### P2 — Future
8. **Expo Mobile App** — Full build-out connecting all screens to backend
9. **Decision Tracking UI** — For Cognition Core's learning loop
10. **Proactive SoundBoard / Daily Brief** — Overnight summary for engagement
11. **Live Competitive Benchmark** — Weekly Digital Footprint percentile
12. **Deploy OpenTelemetry tracing** and Datadog monitoring

## Key Files
- `/app/reports/BIQC_LAUNCH_READINESS_REPORT.md` — Complete pre-launch validation report
- `/app/test_reports/layer2_cognitive_validation.json` — AI quality test results
- `/app/infrastructure/` — k6, OpenTelemetry, Chaos, Datadog configs
- `/app/supabase/migrations/049_fix_propagation_map_columns.sql` — Critical SQL fix
- `/app/frontend/src/config/pricingTiers.js` — Canonical pricing source
- `/app/backend/routes/soundboard.py` — Strategic Advisor persona
- `/app/backend/routes/cognition_contract.py` — Cognition Core API
