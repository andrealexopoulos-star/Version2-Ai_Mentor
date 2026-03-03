# BIQc Platform — Product Requirements Document

## Original Problem Statement
Transform the BIQc platform into a high-performance, AI-driven "Cognition-as-a-Platform" for SMBs. This involves a complete visual and architectural overhaul to a "Liquid Steel" dark theme, migrating backend logic to be vendor-agnostic, and building out numerous features. The core focus is on trust, data integrity (no fake data), and a seamless, intelligent user experience with high-ticket, executive-grade positioning.

## Core Architecture
- **Frontend:** React (CRA) with Tailwind CSS + Shadcn/UI
- **Backend:** FastAPI (Python) — thin pass-through to SQL engine
- **Database:** Supabase (PostgreSQL) with SQL-first intelligence engine
- **Deployment:** Azure (production), Emergent preview (development)

## What's Been Implemented

### Backend Cognition Core (Complete)
- Enterprise-grade intelligence engine built entirely in SQL
- 8 interconnected engines (Evidence, Instability, Propagation, etc.)
- Master function `ic_generate_cognition_contract` (~25ms execution)
- API endpoint: `/api/cognition/{tab}`

### Homepage Visual System (Complete — Mar 2026)
- **EnergyGalaxyBackground**: Canvas-based animated orange intelligence field with neural energy threads, floating particles with glow, signal pulses, particle connections, energy wave bands, and central glow convergence
- **LiquidSteelHeroRotator**: 3 rotating hero variants with 8s auto-rotate, 1.2s fade transitions, manual arrow navigation, pause on hover
- **IntegrationCarousel**: 21 real SVG brand logos (HubSpot, Salesforce, Xero, Stripe, Slack, Google, Shopify, QuickBooks, Notion, Microsoft, AWS, DocuSign, Snowflake, Tableau, Monday, Asana, Zoom, Dropbox, Zendesk, Mailchimp, Pipedrive) in styled cards, 25s loop, pause on hover, two rows scrolling opposite directions
- **IntelligenceDiagram**: 4-tier intelligence flow (Business Signals → Watchtower → BIQc → Decision Support) with animated signal pulses, glowing BIQc core with halo, radar sweep in Watchtower, animated connection lines
- **Stats section**: 5 metrics with orange monospace values
- **Cognition section**: 6 glass cards (Monitors, Detects, Prevents, Briefings, Sovereign, Output)
- **CTA section**: Bottom call-to-action with registration links
- **WebsiteLayout**: Dark nav with Trust dropdown, full footer

### Website Pages (Exist)
- PricingPage, IntegrationsPage, IntelligencePage, PlatformPage, TrustLandingPage, TrustSubPages

### Internal Platform (Legacy — Needs Update)
- RevenuePage, RiskPage, OperationsPage, Advisor, SoundBoard — NOT connected to new Cognition Core

## Prioritized Backlog

### P0 — Critical
1. **Fix Broken User Onboarding Journey** — New users land on empty Advisor Dashboard after setup. Integration connection not in flow.
2. **Phase B: Frontend Cognition Integration** — Connect internal pages to `/api/cognition/{tab}` endpoint

### P1 — Important  
3. **Daily Habit Loop** — "What changed in 24h?" summary, daily priority
4. **Admin/Legal Nav Restructure** — Reorganize admin menu
5. **Weekly Check-in Calendar** — Sidebar calendar with sync

### P2 — Future
6. **Mobile App Build-out** — Connect Expo skeleton to API
7. **A/B Testing & Marketing Automation UIs**

## Blocked Items
- **Production Auth Errors** — `biqc.thestrategysquad.com` stuck in login loop due to misconfigured `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Azure. Blocked on user action.

## Key Files
- `frontend/src/pages/website/HomePage.js` — Main homepage
- `frontend/src/components/website/EnergyGalaxyBackground.js` — Canvas background
- `frontend/src/components/website/IntegrationCarousel.js` — Logo carousel
- `frontend/src/components/website/BrandLogos.js` — SVG brand definitions
- `frontend/src/components/website/IntelligenceDiagram.js` — Flow diagram
- `frontend/src/components/website/LiquidSteelHeroRotator.js` — Hero rotator
- `frontend/src/components/website/WebsiteLayout.js` — Layout wrapper
- `backend/routes/cognition_contract.py` — Cognition API endpoint

## Test Credentials
- Email: `andre@thestrategysquad.com.au`
- Password: `BIQc_Test_2026!`
