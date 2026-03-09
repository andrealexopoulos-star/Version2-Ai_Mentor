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

### Phase 2 — Navigation & UX (Complete — Mar 2026)
- **Sidebar multi-expand** — Changed from single accordion to `Set<sectionId>` multi-expand. Intelligence + Execution open by default. Active section auto-expands without closing others. ARIA: `aria-expanded`, `aria-controls` on all sections.
- **4 sidebar sections** (was 5) — Marketing merged into "Settings & Growth" alongside Compliance, Reports, Settings, Business DNA. Reduces cognitive load, eliminates unnecessary section header.
- **Mobile nav Risk = direct tab** — Bottom bar now: Overview | Revenue | **Risk** | Alerts | More (Risk was 2 taps, now 1). Market moved to More sheet.
- **More sheet: 3 grouped sections** — Intelligence (Market, Decisions, Operations), Execution (Actions, Inbox, Automations), Settings (Integrations, Settings, Reports). Scannability improved vs. flat 6-item grid.
- **API timeouts added** — 8s timeout on slow API calls in Revenue, Decisions, Alerts pages to ensure loading states resolve and empty states render.
- **Empty state copy rewritten** — Revenue: "Your pipeline is waiting to be analysed — connect HubSpot/Xero to see deal velocity, stalled opportunities"; Decisions: "Decisions surface when deal stalls, cash burn, or operational signals require leadership action"; Alerts: "All systems normal — BIQc monitors your data 24/7"; Audit Log: "start building your governance trail"
- **Test result**: 15/17 Phase 2 features verified ✅ (iteration_110, 2 source-verified)

- **Unified CSS Variables** — `index.css` now has `--biqc-*` tokens covering all colors, both dark (default) and light themes. ARIA-accessible.
- **Light Mode Toggle** — Sun/Moon icon in dashboard header (`data-testid="theme-toggle"`). Toggles `data-theme` on `<html>`, persisted via `localStorage`.
- **WCAG AA Contrast Fix** — `textMuted` updated from `#64748B` (3.48:1) to `#8B9DB5` (4.6:1) on dark backgrounds.
- **ARIA Labels** — Navigation sidebar: `role="navigation"`, `aria-label`, `aria-expanded`, `aria-current="page"`, `aria-controls` on all sections and items.
- **Login Inline Error** — Persistent red error banner (`role="alert"`, `aria-live="polite"`, `data-testid="login-error-message"`) replaces disappearing toast. Also fixed Supabase body-stream error mapping.
- **DashboardLayout CSS vars** — Main content, sidebar, soundboard panel now use `var(--biqc-bg)` instead of hardcoded `#0F1720`.
- **Design System Doc** — `/app/memory/DESIGN_SYSTEM_PHASE1.md` — full colour palette, typography, spacing, shadows, component states, ARIA guide.
- **Test result**: 12/12 Phase 1 features verified ✅ (iteration_109)

- **`data_coverage.py`** (backend): Weighted field schema across 5 domains (Revenue, Cash, Operations, People, Market) with critical (weight 2) and optional (weight 1) fields; `calculate_coverage()` returns coverage_pct, per_domain breakdown, missing_fields, guardrail_status
- **`GET /api/user/data-coverage`**: New endpoint returning coverage + missing fields + guardrail status
- **SoundBoard guardrails updated**: Now uses percentage-based gating (BLOCKED <20%, DEGRADED 20-40%, FULL >40%) replacing simple field-count logic; BLOCKED response includes specific missing critical fields + actionable CTAs
- **Calibration context injection**: When no integrations connected, ABN/website/preferences injected into prompt for personalised guidance even without CRM/accounting
- **Updated system prompt**: Enhanced `_SOUNDBOARD_FALLBACK` with Situation/Analysis/Recommendation structure, tone calibration, transparency rules, banned phrases — aligned with Sprint 4 spec
- **`DataCoverageGate.js`** (frontend): Blocked state shows critical missing fields with direct links; Degraded shows compact dismissible notice with improvement suggestions; Full hides component
- **SoundboardPanel**: Integrated `DataCoverageGate`; emits `ai_response_blocked`/`ai_response_degraded`/`ai_response_full` telemetry events
- **StageProgressBar tooltips**: Each stage pill now has ARIA-accessible hover/focus tooltip explaining "What's being analysed?" (Fetching/Preprocessing/Analysing/Assembling stages)
- **analytics.js**: Added AI_RESPONSE_BLOCKED, AI_RESPONSE_DEGRADED, AI_RESPONSE_FULL events

- **`AsyncDataLoader.js`**: Universal reusable async wrapper — handles loading stages, determinate progress bar, skeleton cards, tier gating, integration gating, timeout fallback CTA, multi-action error state (Retry/Support/Troubleshoot)
- **`PageStateComponents.js`**: `PageLoadingState` + `PageErrorState` — consistent loading/error for ALL pages
- **`useSnapshotProgress.js`**: Enhanced snapshot hook — granular stages (fetching→preprocessing→analyzing→assembling→complete), auto-advancing progress, telemetry events (snapshot_start/stage_complete/finish/error/timeout/resume), `resumeSnapshot()` method
- **`StageProgressBar`**: Determinate progress bar with stage pills — fills over 30s if no real updates
- **IntelligencePhases.js**: Stage-aware progress bar during analysis, actionable timeout CTA with support/troubleshoot links, telemetry on start/finish/timeout
- **AdvisorWatchtower**: Uses `useSnapshotProgress`, floating progress bar overlay during load, `PageErrorState` with resume option
- **analytics.js**: Added snapshot telemetry events (SNAPSHOT_START/FINISH/ERROR/TIMEOUT/RESUME) + page load events + `trackSnapshotEvent()` helper
- **All module pages updated**: RiskPage, RevenuePage, OperationsPage, MarketPage, Dashboard, DataCenter, CompetitiveBenchmark, DecisionsPage — all use `PageLoadingState`/`PageErrorState` consistently
- **RiskPage**: Now uses `useIntegrationStatus` (removed `/integrations/merge/connected` call), `IntegrationStatusWidget` for "not connected" state

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
2. **Fix Outlook/Gmail OAuth in production** — Set `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_REDIRECT_URI`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` in Azure App Service
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
