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

#### Motion Architecture (Deterministic Implementation)
- **Layer 1 — Ambient Intelligence Field**: Canvas-based Simplex noise particle system. 100 particles, 1-3px, 0.2-0.6 opacity, gaussian blur 2-6px, noise-based drift with 20-30 second cycle. Particles drift randomly and fade in/out gradually. No linear movement.
- **Layer 2 — Neural Signal Network**: 7 Perlin noise distorted neural threads. 1.5px stroke, gradient #FF7A18→#FF9C45, outer glow rgba(255,140,40,0.25). Travelling light pulses with 6-10 second cycle, pulse colour rgba(255,180,80).
- **Layer 3 — Platform Convergence Field**: Radial glow behind BIQc node. 500px radius, rgba(255,140,40) at 0.15 opacity, 8-second pulse cycle, scale 1.05.

#### Hero System
- **LiquidSteelHeroRotator**: 3 variants with 8s auto-rotate, 1.2s opacity fade transitions, manual arrow navigation, pause on hover/visibility
- **Spacing**: headline→subheadline 24px, subheadline→CTA 40px, CTA→learning statement 40px, learning statement→diagram 80px
- **Learning block**: "Continuously Learning & Designed to: Protect, Stabilise, Strengthen" with orange ticks

#### Platform Intelligence Diagram
- 4-tier flow: Business Signals → Watchtower → BIQc → Decision Support
- Exact text: "What is happening across your systems" / "Continuous monitoring across your tools" / "Business Intelligence Quotient Centre" / "Clear signals that guide leadership decisions"
- BIQc core glow: box-shadow 0 0 40px rgba(255,140,40,0.35) + 0 0 80px rgba(255,140,40,0.15), 6-second loop
- Animated signal pulses, radar sweep in Watchtower, halo rings

#### Integration Carousel
- 21 SVG brand logos (HubSpot, Salesforce, Xero, Stripe, Slack, Google, Shopify, QuickBooks, Notion, Microsoft, AWS, DocuSign, Snowflake, Tableau, Monday, Asana, Zoom, Dropbox, Zendesk, Mailchimp, Pipedrive)
- Cards with background rgba(255,255,255,0.02), border 1px solid rgba(255,255,255,0.05), border-radius 10px
- Hover: border rgba(255,140,40,0.35)
- 25-second loop, pause on hover, two rows opposite direction

#### System Input Blocks
- Finance Systems: Xero, NetSuite, QuickBooks, MYOB
- Operations Systems: ERP Systems, HubSpot, Monday, Asana
- Sales Systems: Salesforce, CRMs, Pipedrive, HubSpot
- Card styling: rgba(255,255,255,0.03), border 1px solid rgba(255,140,40,0.25), border-radius 12px

### Website Pages (Exist)
- PricingPage, IntegrationsPage, IntelligencePage, PlatformPage, TrustLandingPage, TrustSubPages

### Internal Platform (Legacy — Needs Update)
- RevenuePage, RiskPage, OperationsPage, Advisor, SoundBoard — NOT connected to new Cognition Core

## Prioritized Backlog

### P0 — Critical
1. **Fix Broken User Onboarding Journey** — New users land on empty Advisor Dashboard after setup
2. **Phase B: Frontend Cognition Integration** — Connect internal pages to `/api/cognition/{tab}`

### P1 — Important
3. **Daily Habit Loop** — "What changed in 24h?" summary
4. **Admin/Legal Nav Restructure**
5. **Weekly Check-in Calendar**

### P2 — Future
6. **Mobile App Build-out**
7. **A/B Testing & Marketing Automation UIs**

## Blocked Items
- **Production Auth Errors** — `biqc.thestrategysquad.com` stuck in login loop (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY misconfigured in Azure)

## Key Files
- `frontend/src/pages/website/HomePage.js`
- `frontend/src/components/website/EnergyGalaxyBackground.js` — Simplex noise canvas
- `frontend/src/components/website/IntegrationCarousel.js`
- `frontend/src/components/website/BrandLogos.js`
- `frontend/src/components/website/IntelligenceDiagram.js`
- `frontend/src/components/website/LiquidSteelHeroRotator.js`
- `frontend/src/components/website/WebsiteLayout.js`
- `backend/routes/cognition_contract.py`

## Test Credentials
- Email: `andre@thestrategysquad.com.au`
- Password: `BIQc_Test_2026!`
