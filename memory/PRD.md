# BIQc Platform — Product Requirements Document

## CRITICAL SESSION REQUIREMENT
**Every fork/session MUST set `frontend/.env` to `beta.thestrategysquad.com`.**
**For dev/testing, use `strategy-platform-1.preview.emergentagent.com` (CDN caches old builds on beta).**

## Architecture (Sovereign Model)
- **Frontend:** React (CRA) + Tailwind + Shadcn/UI — thin visualisation/interaction layer only
- **Backend:** FastAPI → thin pass-through to Supabase SQL engine
- **Database:** Supabase (PostgreSQL) — all intelligence computed here
- **Mobile:** React Native (Expo) — thin client consuming same APIs
- **Analytics:** External (Mixpanel/Amplitude/PostHog) — frontend instruments only
- **Observability:** External (Datadog/OTel/Grafana) — frontend sends events only

## Completed Features

### Cognition Core (LIVE — Migration 049 Success)
- `/api/cognition/overview` returns `status: "computed"` with propagation map, instability indices
- All cognition tabs functional: overview, revenue, money, operations, people, market

### Phase 1: Decision Tracking + Daily Brief (Complete)
- `/decisions` page: Record decisions (type/description/domains/horizon), view history, 30/60/90 checkpoints
- `<DailyBriefBanner />`: Login banner "Your Business Brief is ready"
- `<DailyBriefCard />`: Advisor page "Today's Priority" card

### Phase 2: Analytics + Observability (Complete)
- `analytics.js`: Provider-agnostic `trackEvent()` (Mixpanel/Amplitude/PostHog)
- `telemetry.js`: `trackPageRender()`, `startApiTimer()`/`endApiTimer()`, `trackComponentError()`

### Phase 3: Push Notifications (Complete)
- Expo push notification service with `registerForPushNotifications()`
- Android channels: biqc-alerts (HIGH), biqc-daily-brief (DEFAULT), biqc-checkpoints (DEFAULT)
- Backend `POST /api/notifications/register-device` endpoint
- Listeners for foreground + tap notifications integrated in App.tsx

### Sprint 2: Integration Status & Data Coverage (Complete — Mar 2026)
- **`GET /api/user/integration-status`**: Unified endpoint returning granular per-integration status (connected, provider, records_count, last_sync_at, error_message)
- **`POST /api/user/integration-status/sync`**: Manual sync trigger — fetches deal/invoice counts from Merge API
- **`IntegrationStatusWidget`** component: Replaces all generic "Missing Integrations" banners with actionable, per-integration status rows:
  - ✅ Connected + data: "HubSpot connected — 15 deals"
  - ⏳ Connected, no data: "Xero connected — 0 invoices; first sync may take a few minutes"
  - 🔴 Not connected: "CRM not connected — Connect to analyse pipeline" + CTA button
- **`useIntegrationStatus`** hook: Shared hook for all pages consuming integration status
- **Pages updated**: AdvisorWatchtower, RevenuePage, OperationsPage, MarketPage, Integrations Data Connections tab
- **Integrations Data Connections tab**: Shows record counts, last sync time, disconnect buttons, "Not Yet Connected" CTAs, "Refresh All" button
- **Background sync**: After OAuth token exchange, immediately fetches initial record counts
- **AdvisorWatchtower**: Added `WelcomeBanner` empty state for `!loading && !cognitive && !error`
- **SQL migration**: `/app/supabase_migrations/create_integration_status.sql` — needs to be run on production Supabase to enable record count caching

### NOTE: SQL Migration Required
Run `/app/supabase_migrations/create_integration_status.sql` in Supabase SQL editor for the `vwwandhoydemcybltoxz` project to enable the `integration_status` caching table. Until then, records_count always returns 0 (endpoint still works correctly, just without cached counts).

- **Competitive Benchmark** (`/competitive-benchmark`): Digital Footprint score gauge, Industry percentile ranking, 5-Pillar breakdown (Website/Social/Reviews/Content/SEO), competitor landscape
- **Decision Outcome Recording**: Expandable checkpoint timeline with "Effective"/"Ineffective" buttons for due checkpoints. Backend `POST /api/cognition/decisions/checkpoint-outcome`

### Mobile App (5 Screens Built Out)
- HomeScreen → `/api/cognition/overview` + `/api/auth/check-profile`
- ChatScreen → `/api/soundboard/chat` (conversation_id + session_id)
- MarketScreen → `/api/cognition/market` + `/api/snapshot/latest`
- AlertsScreen → `/api/intelligence/watchtower` + `/api/snapshot/latest`
- SettingsScreen → `/api/auth/check-profile` + sign out

### Previous Features
- Mobile responsiveness (12px min fonts, 44px touch targets)
- Pre-launch validation (Platform Score 8.57, AI Quality 8.85, Hallucination 0%)
- Enterprise gates, tier gates, SoundBoard Strategic Advisor, CMO Summary
- Calendar View, canonical pricing, session caching

## Test Credentials
- **Test 1:** trent-test1@biqc-test.com / BIQcTest!2026A (Campos Coffee, super_admin) — WORKING
- **Test 3:** trent-test3@biqc-test.com / BIQcTest!2026C (Thankyou Group) — WORKING
- **Test 2:** trent-test2@biqc-test.com — INVALID (needs reset)

## Remaining Backlog

### P0
1. **Run SQL migration** `create_integration_status.sql` in Supabase (vwwandhoydemcybltoxz) to enable `records_count` caching for integration status
2. **Fix Executive Intelligence Snapshot stuck** — Add 30-second timeout fallback in `IntelligencePhases.js` ExecutiveCMOSnapshot component (if `isReady=false` after 30s, show CTA anyway)
3. CDN cache purge for `beta.thestrategysquad.com`
4. Configure analytics provider keys (Mixpanel/Amplitude/PostHog)
5. Create `push_devices` table in Supabase for device token storage

### P1
6. **Fix Outlook/Gmail OAuth in production** — Set `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_REDIRECT_URI`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` in Azure App Service
7. Reset `andre@thestrategysquad.com.au` + test account 2 passwords
8. API performance optimization
9. Admin panel billing adjustments
10. Mobile App Store deployment (TestFlight/Play Store)
11. **Deploy updated backend to production** — `/api/soundboard/scan-usage` and `/api/cognition/overview` return 404 in production (endpoint exists locally)

### P2
12. Decision outcome visualization (trend charts at checkpoints)
13. Competitive Benchmark auto-refresh (weekly cron)
14. Push notification backend triggers (instability breach, checkpoint due, daily brief)
15. Sprint 3: Snapshot Failure State UI (error/retry when intelligence snapshot fails)
16. SoundBoard AI context injection — use calibration data (business name, industry, CMO summary) even when no external integrations connected
