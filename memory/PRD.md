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
- Canvas-based animated energy galaxy background (contained in hero only)
- 4 Perlin noise neural threads, 50 ambient particles, 8s convergence glow
- Hero rotator: 3 variants, 8s auto-rotate, 1.2s fade
- Integration carousel: 21 SVG brand logos, 25s loop, pause on hover
- Intelligence diagram: 4-tier flow with animated signals, 6s BIQc core glow
- Mandatory spacing: headline→sub 24px, sub→CTA 40px, CTA→learning 40px, learning→diagram 80px

### Mobile CSS Migration (Complete — Mar 2026)
- **Forensic removal**: 11 legacy CSS files (3,138 lines) deleted
- **Single replacement**: `mobile.css` (~190 lines) — scoped, surgical, no !important wars
- **Mobile behaviors**: Canvas hidden, arrows hidden, h1=24px, CTA full-width, grids collapse to 1-2 columns
- **Desktop**: Completely unaffected

### Key Files
- `frontend/src/mobile.css` — Single mobile stylesheet
- `frontend/src/pages/website/HomePage.js` — Homepage
- `frontend/src/components/website/EnergyGalaxyBackground.js` — Canvas background
- `frontend/src/components/website/IntegrationCarousel.js` — Logo carousel
- `frontend/src/components/website/BrandLogos.js` — SVG brand definitions
- `frontend/src/components/website/IntelligenceDiagram.js` — Flow diagram
- `frontend/src/components/website/LiquidSteelHeroRotator.js` — Hero rotator
- `backend/routes/cognition_contract.py` — Cognition API

## Prioritized Backlog

### P0 — Critical
1. **Fix Broken User Onboarding Journey** — New users land on empty Advisor Dashboard
2. **Phase B: Frontend Cognition Integration** — Connect internal pages to `/api/cognition/{tab}`

### P1 — Important
3. **Daily Habit Loop** — "What changed in 24h?" summary
4. **Admin/Legal Nav Restructure**
5. **Weekly Check-in Calendar**

### P2 — Future
6. **Mobile App Build-out** (Expo skeleton exists at `/app/mobile/`)
7. **A/B Testing & Marketing Automation UIs**

## Blocked
- **Production Auth** — `biqc.thestrategysquad.com` needs SUPABASE vars in Azure

## Test Credentials
- Email: `andre@thestrategysquad.com.au`
- Password: `BIQc_Test_2026!`
