# BIQc Platform — Product Requirements Document

## Original Problem Statement
Transform the BIQc platform into a high-performance, AI-driven "Cognition-as-a-Platform" for SMBs with a "Liquid Steel" dark theme, executive-grade positioning, and AI-driven intelligence surfaces.

## Core Architecture
- **Frontend:** React (CRA) with Tailwind CSS + Shadcn/UI
- **Backend:** FastAPI (Python) — thin pass-through to SQL engine
- **Database:** Supabase (PostgreSQL) with SQL-first intelligence engine
- **Deployment:** Azure (production), Emergent preview (development)

## What's Been Implemented

### Backend Cognition Core (Complete)
- Enterprise-grade intelligence engine entirely in SQL
- 8 interconnected engines, master function `ic_generate_cognition_contract` (~25ms)
- API endpoint: `/api/cognition/{tab}`

### Homepage Visual System (Complete — Mar 2026)

#### Motion Architecture (Contained Background Overlay)
The motion system is a **pure decorative background** that does not affect layout flow.

**Hero Container:**
- `min-height: 90vh`, `max-height: 110vh`
- Canvas inside `.hero-background-canvas` wrapper: `position:absolute, top:0, left:0, width:100%, height:100%, z-index:0, pointer-events:none`
- Hero content in `.hero-content` wrapper: `position:relative, z-index:2`
- Content centered: `max-width:1100px, margin:auto, text-align:center`

**Layer 1 — Ambient Intelligence Field:**
- 50 particles, 1-2px, opacity 0.15-0.4, gaussian blur 2-6px
- Simplex noise-based drift, 20-30 second cycle
- Particles drift randomly and fade in/out gradually

**Layer 2 — Neural Signal Network:**
- 4 threads with Perlin noise distortion, 1.5px stroke
- Gradient #FF7A18→#FF9C45, outer glow rgba(255,140,40,0.25)
- Travelling light pulses, 6-10 second cycle, rgba(255,180,80)

**Layer 3 — Platform Convergence Field:**
- 500px radius radial glow, rgba(255,140,40) at 0.15 opacity
- 8-second pulse cycle, scale 1.05

#### Hero Spacing (Mandatory)
- headline → subheadline: 24px
- subheadline → CTA: 40px
- CTA → learning statement: 40px
- learning statement → diagram: 80px

#### Platform Intelligence Diagram
- 4-tier flow: Business Signals → Watchtower → BIQc → Decision Support
- Exact text: "What is happening across your systems" / "Continuous monitoring across your tools" / "Business Intelligence Quotient Centre" / "Clear signals that guide leadership decisions"
- BIQc core glow: `box-shadow: 0 0 40px rgba(255,140,40,0.35), 0 0 80px rgba(255,140,40,0.15)`, 6-second loop

#### Integration Carousel
- 21 SVG brand logos in cards
- Card: `background:rgba(255,255,255,0.02), border:1px solid rgba(255,255,255,0.05), border-radius:10px`
- Hover: `border-color:rgba(255,140,40,0.35)`
- 25-second loop, pause on hover

#### Page Section Order
Hero → 80px gap → Diagram → Stats → Integrations → Cognition → CTA → Footer

### Internal Platform (Legacy — Needs Update)
- RevenuePage, RiskPage, OperationsPage, Advisor, SoundBoard — NOT connected to new Cognition Core

## Prioritized Backlog

### P0 — Critical
1. **Fix Broken User Onboarding Journey** — New users land on empty Advisor Dashboard
2. **Phase B: Frontend Cognition Integration** — Connect internal pages to `/api/cognition/{tab}`

### P1 — Important
3. **Daily Habit Loop** — "What changed in 24h?" summary
4. **Admin/Legal Nav Restructure**
5. **Weekly Check-in Calendar**

### P2 — Future
6. **Mobile App Build-out**
7. **A/B Testing & Marketing Automation UIs**

## Blocked Items
- **Production Auth** — `biqc.thestrategysquad.com` misconfigured SUPABASE vars in Azure

## Key Files
- `frontend/src/pages/website/HomePage.js`
- `frontend/src/components/website/EnergyGalaxyBackground.js`
- `frontend/src/components/website/IntegrationCarousel.js`
- `frontend/src/components/website/BrandLogos.js`
- `frontend/src/components/website/IntelligenceDiagram.js`
- `frontend/src/components/website/LiquidSteelHeroRotator.js`
- `frontend/src/components/website/WebsiteLayout.js`
- `backend/routes/cognition_contract.py`

## Test Credentials
- Email: `andre@thestrategysquad.com.au`
- Password: `BIQc_Test_2026!`
