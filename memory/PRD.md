# BIQc Platform — Product Requirements Document

## CRITICAL SESSION REQUIREMENT — READ FIRST
**Every fork/session MUST update `frontend/.env` to point to `beta.thestrategysquad.com`:**
```
REACT_APP_BACKEND_URL=https://beta.thestrategysquad.com
```
Run after every fork: `sudo supervisorctl restart frontend` to apply.

**NOTE:** The custom domain `beta.thestrategysquad.com` caches production builds via CDN. For development/testing, use `https://strategy-platform-1.preview.emergentagent.com` to see live dev server changes.

## Original Problem Statement
Transform BIQc into a high-performance, AI-driven "Cognition-as-a-Platform" for SMBs. Frontend is a thin visualisation/interaction layer only — all computation happens in Supabase SQL + Edge Functions.

## Architecture (Sovereign Model)
- **Frontend:** React (CRA) + Tailwind + Shadcn/UI — UI surfaces consuming APIs only
- **Backend:** FastAPI → thin pass-through to SQL engine
- **Database:** Supabase (PostgreSQL) with SQL-first intelligence engine
- **Mobile:** React Native (Expo) — thin client consuming same APIs
- **Deployment:** Azure (production), Emergent preview (development)
- **Analytics:** External (Mixpanel/Amplitude/PostHog) — frontend instruments, infrastructure processes
- **Observability:** External (Datadog/OpenTelemetry/Grafana) — frontend sends events only

## What's Been Implemented

### Phase 1: Decision Tracking UI (Complete — Mar 2026)
- **`/decisions` route** — Full CRUD page for recording strategic decisions
- **Decision form:** Type dropdown (Hiring/Pricing/Client Strategy/Operational Change/etc.), Description textarea, Affected Domains selector (Revenue/Cash/Operations/People/Market), Time Horizon, Evidence refs
- **Decision history:** Cards with type icon, date, affected domains, expandable 30/60/90 day checkpoint timeline
- **API:** POST/GET to `/api/cognition/decisions`
- **Sidebar:** "Decisions" item added under INTELLIGENCE section

### Phase 1: Daily Brief / Proactive SoundBoard (Complete — Mar 2026)
- **`<DailyBriefBanner />`** — Shows once per day on login: "Your Business Brief is ready." with View button → opens SoundBoard
- **`<DailyBriefCard />`** — Rendered on Advisor page, shows "Today's Priority" with priority domain, message, suggested action, alert count
- **Data source:** Fetches from `/api/cognition/overview` (primary) with `/api/snapshot/latest` fallback
- **Session control:** Banner shows once per day via sessionStorage

### Phase 1: Expo Mobile App Build-out (Complete — Mar 2026)
- **HomeScreen:** Fetches `/api/cognition/overview` + `/api/snapshot/latest` + `/api/auth/check-profile`. Shows greeting, status banner, instability indices grid, executive brief
- **ChatScreen:** Connected to `/api/soundboard/chat` with conversation_id and session_id. Quick prompt chips, keyboard-aware input
- **MarketScreen:** Fetches `/api/cognition/market` + `/api/snapshot/latest`. Shows digital footprint score, market position, market signals, competitive landscape
- **AlertsScreen:** Fetches `/api/intelligence/watchtower` + `/api/snapshot/latest`. Shows severity-coded alert cards with recommendations
- **SettingsScreen:** Fetches `/api/auth/check-profile`. Shows profile, company, tier, sign out
- **Auth:** Fixed session.access_token extraction from login response

### Phase 2: Analytics Instrumentation (Complete — Mar 2026)
- **`/app/frontend/src/lib/analytics.js`** — Provider-agnostic event dispatch wrapper
- **`trackEvent(eventName, metadata)`** — Dispatches to configured providers + console log in dev
- **`identifyUser(id, properties)`** — Identifies user across providers
- **Providers supported:** Mixpanel, Amplitude, PostHog (keys to be provided)
- **Events instrumented:** user_login, dashboard_view, tab_switch, integration_connect_click, soundboard_open, soundboard_query, decision_recorded, automation_trigger_click, daily_brief_open, alert_open
- **Integrated in:** SupabaseAuthContext (login), AdvisorWatchtower (dashboard_view), SoundboardPanel (soundboard_query), DecisionsPage (decision_recorded), DailyBriefCard (daily_brief_open)

### Phase 2: Observability Hooks (Complete — Mar 2026)
- **`/app/frontend/src/lib/telemetry.js`** — Frontend telemetry hooks (send events only, no processing)
- **`trackPageRender(pageName)`** — Records page render time from Navigation Timing API
- **`startApiTimer(requestId)` / `endApiTimer(requestId, endpoint, status)`** — Records API response times
- **`trackComponentError(componentName, error)`** — Records component errors
- **`trackActionLatency(actionName, latencyMs)`** — Records user action latency
- **Integrated in:** AdvisorWatchtower (page_render_time)

### Previous Features (Complete)
- Mobile responsiveness overhaul (homepage 12px min, touch targets 44px, bottom nav)
- Pre-launch validation protocol (Platform Score 8.57, AI Quality 8.85, Hallucination 0%)
- Backend Cognition Core, Scrape & Edge Functions, Homepage Visual System
- User Onboarding, Calibration, SoundBoard Strategic Advisor
- Enterprise Contact Gate, Upgrade Cards Gate, Feature Tier Gates
- Canonical pricing config, Session caching, Calendar View

## Test Credentials
- **Test Account 1:** trent-test1@biqc-test.com / BIQcTest!2026A (Campos Coffee, super_admin) — WORKING
- **Test Account 3:** trent-test3@biqc-test.com / BIQcTest!2026C (Thankyou Group, super_admin) — WORKING
- **Test Account 2:** trent-test2@biqc-test.com — CREDENTIALS INVALID (needs Supabase reset)

## Prioritized Backlog

### P0 — Must Do Before Launch
1. **Run SQL Migration 049** in Supabase SQL Editor → Fix Cognition Core endpoint
2. **CDN Cache Purge** for `beta.thestrategysquad.com`
3. **Configure analytics provider keys** (Mixpanel/Amplitude/PostHog)

### P1 — Important
4. **Push Notifications (Phase 3)** — Expo push notification setup for backend-triggered events
5. **Reset andre@thestrategysquad.com.au** and test account 2 passwords
6. **API Performance Optimization** — Profile endpoint latency
7. **Admin Panel Billing Adjustments**

### P2 — Future
8. **Competitive Benchmark** — Weekly Digital Footprint percentile ranking
9. **Decision Tracking Outcome UI** — Visual outcome recording at checkpoints
10. **Mobile App Store Deployment** — TestFlight/Play Store submission

## Key Files
- `/app/frontend/src/pages/DecisionsPage.js` — Decision Tracking UI
- `/app/frontend/src/components/DailyBriefCard.js` — Daily Brief (Card + Banner)
- `/app/frontend/src/lib/analytics.js` — Analytics instrumentation wrapper
- `/app/frontend/src/lib/telemetry.js` — Observability hooks
- `/app/mobile/src/screens/` — All 5 Expo mobile screens (built out)
- `/app/mobile/src/lib/api.ts` — Mobile API client (fixed auth)
- `/app/infrastructure/` — k6, OpenTelemetry, Chaos, Datadog configs
