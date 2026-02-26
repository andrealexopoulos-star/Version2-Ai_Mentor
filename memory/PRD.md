# BIQc Platform - PRD (Product Requirements Document)

## Original Problem Statement
Transform BIQc into a high-performance, AI-driven "Cognition-as-a-Platform" for SMBs with a premium "Liquid Steel" dark theme, Supabase-first architecture, and zero fake data discipline.

## Architecture
- **Frontend**: React (CRA) + Tailwind + Shadcn/UI + Framer Motion
- **Backend**: FastAPI (thin Supabase client only)
- **Database**: Supabase (PostgreSQL, Auth, Edge Functions, Realtime, pg_cron)
- **AI Engine**: OpenAI gpt-4o-mini via `biqc-insights-cognitive` Edge Function
- **CRM Integration**: Merge.dev (HubSpot)

## Core Principles
1. **Supabase-First**: FastAPI is only a thin client. All logic in Edge Functions / SQL.
2. **No Fake Data**: UI shows "insufficient data" states, never fabricated metrics.
3. **Trust by Default**: Identity verification before scoring. Integration truth before claims.

---

## What's Been Implemented

### Session: Feb 27, 2026 — Full-Spectrum Integrity Lockdown

**Phase 1 — Total Placeholder Eradication:**
- Rewrote `AdvisorWatchtower.js` to check integration status via `/integrations/merge/connected` API
- Revenue, Money, Operations, People tabs now show "Connect integrations to view verified data" when corresponding integrations are not connected
- Market tab shows web-scraped data (allowed without CRM)
- Removed all hardcoded fake data from `OperationsPage.js` (eliminated fabricated bottlenecks, SOP compliance numbers, team workload, and AI advisory fallback)
- `RevenuePage.js` already clean — only shows real CRM data
- Integration-aware `IntegrationRequired` component displays per-tab connection prompts

**Phase 3 — Blog Engine (16 articles):**
- Created `BlogPage.js` with search, category filtering, and article grid
- Created `BlogArticlePage.js` with individual article rendering and citation display
- Created `blogArticles.js` data file with 16 industry-specific articles
- All statistics cite verified sources: McKinsey, BCG, PwC, Menlo Ventures, Wharton School, Microsoft, US Census Bureau
- Each citation includes source name, publication year, and direct URL
- Industries covered: Healthcare, Finance, Manufacturing, Retail, Construction, Legal, SMB, Technology, Accounting, Logistics, Marketing, Real Estate, Education, Cross-Industry, Regional
- FOMO/urgency tone based on evidence-driven adoption data

**Phase 4 — Knowledge Base Public Access:**
- Removed `ProtectedRoute` wrapper from Knowledge Base route
- KnowledgeBasePage now conditionally renders WebsiteLayout (public) or DashboardLayout (authenticated)
- Added 7 comprehensive guides + 10 FAQs
- Moved route to public section in App.js

**Phase 5 — Try for Free Routing:**
- Verified all "Try It Free" buttons route to `/register-supabase`
- Nav, homepage hero, blog CTA, article CTA all confirmed

**Phase 6 — Signup Error Handling:**
- Added deterministic error messages for: existing email, weak password, invalid email, rate limiting, network errors
- No generic "Something went wrong" messages

**Phase 7 — Password Dot Visibility:**
- Added `-webkit-text-fill-color: #F4F7FA` to all password inputs
- Added global CSS rule for `input[type="password"]` in App.css
- White dots now visible on dark background

**Navigation Updates:**
- Added "Blog" link to website navigation (WebsiteLayout)

### Previous Sessions (inherited):
- Liquid Steel dark theme applied globally
- Mobile forensic audit + bottom navigation
- SQL migration (Phase 1): contradiction_engine, pressure_calibration, etc.
- Performance optimization: <5s load time for Insights page
- Auth/session hardening, password reset flow
- AI Learning Guarantee page
- Trust navigation menus updated
- Forensic Identity Card for onboarding
- Snapshot v2 with drift_velocity, trajectory, data_gaps
- High-ticket pricing page (5 tiers)
- Soundboard panel (ChatGPT-style right panel)

---

## Files Modified (This Session)
- `REWRITTEN: /app/frontend/src/pages/AdvisorWatchtower.js` — Integration-aware data filtering
- `REWRITTEN: /app/frontend/src/pages/OperationsPage.js` — No fake data, integration checks
- `REWRITTEN: /app/frontend/src/pages/KnowledgeBasePage.js` — Public/auth-aware with guides + FAQs
- `MODIFIED: /app/frontend/src/pages/LoginSupabase.js` — Password dot visibility
- `MODIFIED: /app/frontend/src/pages/RegisterSupabase.js` — Password dots + error handling
- `MODIFIED: /app/frontend/src/App.js` — Blog routes, KB public route
- `MODIFIED: /app/frontend/src/App.css` — Password input dark theme CSS
- `MODIFIED: /app/frontend/src/components/website/WebsiteLayout.js` — Blog nav link
- `NEW: /app/frontend/src/pages/BlogPage.js` — Blog listing page
- `NEW: /app/frontend/src/pages/BlogArticlePage.js` — Individual article page
- `NEW: /app/frontend/src/data/blogArticles.js` — 16 articles with verified citations

---

## Prioritized Backlog

### P0 (Critical)
- [x] Forensic Trust Overhaul (F1-F7) - COMPLETED
- [x] Full-Spectrum Integrity Lockdown (7 phases) - COMPLETED

### P1 (High Priority)
- [ ] Competitor URL scrape accuracy lock (Phase 2 from lockdown)
- [ ] Deep Intelligence Modules: Workforce, Growth, Deep Market
- [ ] Stripe Paid Gating: Feature-gate behind Stripe paywall
- [ ] Soundboard BNA Updates: Allow Soundboard to update Business DNA via chat
- [ ] Google Ads Integration: Wire up data feed

### P2 (Medium Priority)
- [ ] Complete SQL Migration: Remaining Python modules
- [ ] SQL Triggers: Auto-refresh cognitive snapshots
- [ ] Real Channel APIs: Meta Ads, LinkedIn, GA4
- [ ] Supabase Security Audit: RLS policies
- [ ] Signal Provenance Layer (C1)
- [ ] State Justification Formalisation (C2)
- [ ] "Since Your Last Visit" feature (C3)
- [ ] Tension Framing (C4)
- [ ] Chat Determinism completion (C5)

### P3 (Low Priority / Tech Debt)
- [ ] CSS Consolidation: 13 files -> 2
- [ ] Legacy Page Cleanup: Remove 8+ superseded pages
- [ ] Recover Missing Edge Functions
- [ ] Duplicate Supabase Secrets cleanup

---

## Edge Function / SQL Advisory
- `calibration-business-dna` v2 — AWAITING DEPLOY
- `business-identity-lookup` — BACKLOG (needs ABR_GUID)
- `query-integrations-data` — AWAITING DEPLOY
- `biqc-insights-cognitive` v2 — AWAITING DEPLOY
- `insight_outcomes` table — AWAITING SQL RUN
