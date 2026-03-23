# BIQc Platform - Product Requirements Document

## Original Problem Statement
Transform the BIQc platform into a high-performance, AI-driven strategic business intelligence tool for Australian SMEs. React frontend + FastAPI backend + Supabase (PostgreSQL).

## Core Requirements
1. **Best-in-Class UX** - Modern, fast, interactive on desktop AND mobile
2. **Instantaneous Performance** - All pages load instantly
3. **Production Stability** - Deployable and stable in production
4. **Cognition-as-a-Platform** - Full executive cognition replacing CTO/CFO/CMO/COO/CCO

## Design System: Liquid Steel
- **Background**: #0F1720 (main), #141C26 (panels)
- **Borders**: 1px solid #243140
- **Text**: #FFFFFF (headings), #F4F7FA (primary), #9FB0C3 (secondary), #64748B (muted)
- **Accent**: #FF6A00 (orange — alerts, actions, buttons ONLY)
- **Typography**: Sora (headings 600-700), Inter (body 400-500), JetBrains Mono (metrics)
- **Spacing**: 8pt system, 64px sections, 12-column grid

## What's Been Implemented

### Liquid Steel Website + Platform Mockup (Feb 22, 2026)

#### Website Pages (12 pages under /site/*)
- `/site` - Home (hero, stats, cognition cards, architecture diagram, CTA)
- `/site/platform` - Platform page (problem, solution, architecture)
- `/site/intelligence` - 6-category analysis grid, pipeline steps
- `/site/integrations` - Integration grid (6 categories), custom APIs, data control
- `/site/pricing` - Hiring comparison vs BIQc subscription
- `/site/trust` - Sovereign hosting, security infrastructure, legal docs
- 5 Trust sub-pages: Terms, Privacy, DPA, Security, Trust Centre

#### Platform Mockup Pages (6 pages under /site/platform/*)
- `/site/platform/login` - Liquid Steel themed login (pre-filled andre@thestrategysquad.com.au, Google/Microsoft SSO)
- `/site/platform/overview` - Executive Overview (health strip, attention cards, financial snapshot, intelligence pulse)
- `/site/platform/revenue` - Revenue module (pipeline stability, concentration risk, churn probability)
- `/site/platform/alerts` - Alerts & Actions (Critical/Moderate/Info grouped, expandable, action buttons)
- `/site/platform/automations` - IF/THEN automation builder with toggle switches
- `/site/platform/integrations` - Connected systems grid with slide-out detail panel

#### Shared Components
- `WebsiteLayout.js` - Marketing site nav + footer
- `PlatformLayout.js` - Platform sidebar (Intelligence/Execution/Systems/Governance) + topbar

#### Font Readability Fix
- All headings explicitly use `color: '#FFFFFF'` for maximum contrast against dark backgrounds
- Resolved issue where headings blended into #0F1720 dark background

#### Bug Fix: cacheAge Reference Error
- Fixed `ReferenceError: cacheAge is not defined` in AdvisorWatchtower.js

### Testing
- iteration_53.json: 100% pass - 12 website pages
- iteration_54.json: 100% pass - 6 platform mockup pages + font fix verification

### Previous Work (Feb 20-21, 2026)
- Dashboard v2 with 5 Cognition Groups
- Edge Function architecture (8 functions)
- Cache-first performance + pg_cron
- API cost tracking, recalibration/check-in system
- Collapsible sidebar, animated loading screen (Lottie)
- Tutorial/onboarding (21 pages), notifications, Intelligence Bridge

## Prioritized Backlog

### P0 (Critical)
- [x] Liquid Steel website + platform mockup (COMPLETE)
- [x] Font readability fix (RESOLVED)
- [x] cacheAge bug fix (RESOLVED)

### P1 (High Priority)
- [ ] Action Layer backend (Auto-Email, Quick-SMS, Hand Off)
- [ ] Deploy calibration-sync Edge Function
- [ ] Recover un-versioned Edge Functions
- [ ] Mobile responsiveness on authenticated pages

### P2 (Medium Priority)
- [ ] Build remaining platform mockup pages (Operations, Risk, Compliance, Market, Data Health, Reports, Audit Log, Settings)
- [ ] Complete Settings page population
- [ ] Consolidate duplicate Supabase secrets

### P3 (Low Priority / Tech Debt)
- [ ] Refactor routes/profile.py (1,917 lines)
- [ ] Refactor routes/email.py (1,855 lines)
- [ ] Eliminate MongoDB code references
- [ ] React Native App

## Test Credentials
- Superadmin: andre@thestrategysquad.com.au / BIQc_Test_2026!
- Test User: e2e.test.feb17@biqc.ai / TestPassword123!
