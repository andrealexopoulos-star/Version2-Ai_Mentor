# BIQc Platform — Product Requirements Document

## Original Problem Statement
Transform the BIQc platform into a high-performance, AI-driven "Cognition-as-a-Platform" for SMBs with a "Liquid Steel" dark theme, executive-grade positioning, and AI-driven intelligence surfaces.

## Core Architecture
- **Frontend:** React (CRA) with Tailwind CSS + Shadcn/UI
- **Backend:** FastAPI (Python) — thin pass-through to SQL engine
- **Database:** Supabase (PostgreSQL) with SQL-first intelligence engine
- **Mobile:** React Native (Expo) — native iOS/Android app
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

### Mobile CSS (Complete — Mar 2026)
- Single `mobile.css` (~300 lines) — covers all pages
- **Homepage mobile**: Canvas hidden, arrows hidden, h1=24px, CTA full-width, grids collapse
- **Login/Register mobile**: Full-width buttons, 16px inputs (no iOS zoom), orange CTA
- **Advisor mobile**: Horizontal scroll cognition tabs, single-column insight grids
- **Calibration mobile**: Auto-height, proper identity bar wrapping
- **Platform sidebar mobile**: Pointer-events gating, compact topbar
- **Generic**: Tab lists horizontal scroll, form inputs 16px, sidebar off-screen

### Expo React Native App (Built — Mar 2026)
- **Auth flow**: Login screen gates tab navigator, SecureStore token persistence
- **5 functional screens**: Overview (HomeScreen), Chat (SoundBoard), Market, Alerts, Settings
- **API connected**: Points to production backend (`biqc.thestrategysquad.com/api`)
- **Real data**: HomeScreen shows risk baseline, executive memo, system state
- **ChatScreen**: Full conversational interface with SoundBoard API, prompt chips
- **MarketScreen**: Market intelligence, positioning, competitor data, demand pressure
- **AlertsScreen**: Spine events, silence detection
- **SettingsScreen**: Profile, spine status, integrations menu, logout
- **System fonts**: Uses platform defaults (SF Pro on iOS, Roboto on Android)
- **Location**: `/app/mobile/`

### Key Files
- `frontend/src/mobile.css` — Single mobile stylesheet
- `frontend/src/pages/website/HomePage.js` — Homepage
- `frontend/src/components/website/EnergyGalaxyBackground.js` — Canvas background
- `mobile/App.tsx` — Expo app entry with auth flow
- `mobile/src/screens/` — All 6 screens (Login + 5 tabs)
- `mobile/src/lib/api.ts` — API client with SecureStore auth
- `mobile/src/theme/index.ts` — Theme tokens mirroring web
- `mobile/src/components/ui.tsx` — Reusable UI components

## Prioritized Backlog

### P0 — Critical
1. **Fix Broken User Onboarding Journey** — New users land on empty Advisor Dashboard
2. **Phase B: Frontend Cognition Integration** — Connect internal pages to `/api/cognition/{tab}`

### P1 — Important
3. **Daily Habit Loop** — "What changed in 24h?" summary
4. **Admin/Legal Nav Restructure**
5. **Weekly Check-in Calendar**

### P2 — Future
6. **Expo App Store Deployment** — Build, sign, submit to App Store / Google Play
7. **A/B Testing & Marketing Automation UIs**

## Blocked
- **Production Auth** — `biqc.thestrategysquad.com` needs SUPABASE vars in Azure

## Test Credentials
- Email: `andre@thestrategysquad.com.au`
- Password: `BIQc_Test_2026!`
