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

### Backlog Items (Complete — Mar 2026)
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
1. CDN cache purge for `beta.thestrategysquad.com`
2. Configure analytics provider keys (Mixpanel/Amplitude/PostHog)
3. Create `push_devices` table in Supabase for device token storage

### P1
4. Reset `andre@thestrategysquad.com.au` + test account 2 passwords
5. API performance optimization
6. Admin panel billing adjustments
7. Mobile App Store deployment (TestFlight/Play Store)

### P2
8. Decision outcome visualization (trend charts at checkpoints)
9. Competitive Benchmark auto-refresh (weekly cron)
10. Push notification backend triggers (instability breach, checkpoint due, daily brief)
