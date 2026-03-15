# BIQc Platform — Product Requirements Document
### Sprint 20 — Backend Build Failure Recovery (Complete — Mar 2026)
- **Root cause identified** — Azure backend image build was failing at `pip install -r requirements.txt` due to an impossible dependency set in `backend/requirements.txt`: `google-auth-oauthlib==1.2.3` required `google-auth<2.42.0`, while `google-genai==1.56.0` required `google-auth>=2.45.0`
- **Minimal non-infrastructure fix applied** — removed the unused `google-auth-oauthlib` dependency from the frozen backend requirements and restored `google-auth==2.46.0`, keeping the rest of the backend stack unchanged
- **Verification completed** — reproduced the failure in a clean virtualenv, applied the fix, then re-ran a clean `pip install --no-cache-dir -r /app/backend/requirements.txt` successfully

### Sprint 19 — Azure Redis Queue Integration (Complete — Mar 2026)
- **Additive Redis runtime shipped** — Added `backend/biqc_jobs.py` to detect `REDIS_URL`, establish Azure Redis connection when available, expose queue namespace `biqc-jobs`, support deterministic job IDs, duplicate suppression, delayed retries, and non-blocking async worker processing
- **Graceful startup behavior implemented** — Backend startup now initializes Redis independently of existing service init; when available it logs `Redis connection established`, and when unavailable it logs `Redis unavailable – continuing without queue.` without impacting Cognitive Core, Watchtower, Snapshot Agent, Supabase, or voice/chat startup
- **Scoped BIQc job types added** — Queue supports `watchtower-analysis`, `advisor-analysis`, `market-intelligence-scan`, `crm-ingestion`, and `ai-reasoning-log` only, plus Redis-backed logging buffer support within the same `biqc-jobs` namespace
- **Standalone worker entrypoint added** — Added `backend/biqc_job_worker.py` as a dedicated optional queue consumer process, while API instances can also run the internal async worker safely without blocking requests
- **Health integration added** — `/health`, `/api/health`, `/api/health/detailed`, and `/api/health/workers` now expose `redis_connected` and Redis queue health/details
- **Verification completed** — local health checks passed; preview correctly degraded with `redis_connected=false` because `REDIS_URL` is not present in this container; mocked Redis unit tests passed (`4/4`); backend deep sanity check passed and confirmed no regressions

### Sprint 18 — Advisor Status Strip Layout Refinement (Complete — Mar 2026)
- **Design-agent-guided Advisor refinement** — `frontend/src/pages/AdvisorWatchtower.js` was updated so `Business State` and `Decision Queue Status` now sit as compact cards above the main decision area, while the previous right-side `Executive Snapshot (Live Integration Truth)` block was removed entirely
- **Three-card main row wired** — the main decision surface now uses a fixed `md:grid-cols-3` layout with equal-height cards so the three primary Brain decision cards sit next to each other once live decisions are present
- **Alignment tightened** — the BIQc Insights header area and decision cluster were brought upward with a calmer stacked structure reviewed through the design-agent pass
- **Verification completed by screenshot** — screenshot validation confirmed: `Business State` card present, `Decision Queue Status` card present, `Executive Snapshot` count `0`; current capture showed the Brain syncing state instead of live decision cards, but the 3-column decision grid is now wired in code for the active-decision state

### Sprint 17 — Sidebar Navigation Restructure + Universal Back Button (Complete — Mar 2026)
- **Navigation hierarchy aligned to requested structure** — `frontend/src/components/DashboardLayout.js` now uses the main collapsible groups: **Intelligence**, **Execution**, **Settings & Growth**, **Admin**, and **BIQc Legal**; the **Intelligence** group now presents the requested primary entries: `BIQc Overview`, `Market & Positioning`, `Operations`, `Revenue`, and `Risk`
- **Keep-open behaviour improved** — navigation groups now default open and auto-stay open for the active section so users maintain orientation while moving through pages and sub-pages
- **Universal back navigation added** — every DashboardLayout-powered page now gets a visible `Back` button + current page label row for easier return-path navigation
- **Verification completed by screenshot** — screenshot validation confirmed the `Intelligence`, `Execution`, `Settings & Growth`, and `Admin` groups render, and the back button is present in the authenticated layout

### Sprint 16 — Advisor Cognitive Load Reduction Pass (Complete — Mar 2026)
- **Advisor visual load reduced** — `frontend/src/pages/AdvisorWatchtower.js` now removes the Market / Revenue / Operations pills from the Advisor surface, removes the live-data sync banner, shortens the main section title from `BIQc Priority Snapshot · Full Decision Context` to `BIQc Priority Snapshot`, and removes the `Live Signals` + `Connected Sources (Live)` cards
- **Greeting hierarchy softened** — `Good morning/afternoon/evening, Andre.` was reduced materially in visual size to make the page feel less dominant and more mentor-like
- **Verification completed by screenshot** — local authenticated screenshot check confirmed the requested elements are gone: nav pills count `0`, sync banner count `0`, Live Signals card count `0`, Connected Sources card count `0`, and the decision title now reads `BIQc Priority Snapshot`

### Sprint 15 — Module UX Rebuild Pass + SMB Protect Naming (Complete — Mar 2026)
- **Plan naming updated** — Enterprise/Growth-tier user-facing naming now uses **SMB Protect** in `backend/tier_resolver.py`, in-app pricing, and public pricing surfaces
- **Shared rebuild primitives added** — `frontend/src/components/intelligence/SurfacePrimitives.js` now provides reusable cards, signal surfaces, and calmer section framing for intelligence modules
- **Revenue UX tightened** — `frontend/src/pages/RevenuePage.js` now adds a clearer intervention-first flow with top revenue signal cards, explicit CRM/accounting/email-derived provenance, weighted pipeline, concentration, and source-clarity panels
- **Operations UX tightened** — `frontend/src/pages/OperationsPage.js` now foregrounds bottlenecks, SLA/task aging actionability, and separates workflow/accounting/watchtower source context more clearly
- **Risk density reduced** — `frontend/src/pages/RiskPage.js` now surfaces a smaller top risk frame (composite risk, monitored categories, runway, concentration), a concise “what could hurt the business first” section, and guidance for using deeper tabs only when needed
- **Compliance rebuilt around real outputs** — `frontend/src/pages/CompliancePage.js` now shows live-only obligation feed, SPOFs, alignment contradictions, and ABN-on-file status from the business profile without fake compliance scoring
- **Market separation clarified** — `frontend/src/pages/MarketPage.js` now explicitly separates external market signals from internal channel performance and adds evidence-health messaging for pressure/freshness data
- **Business DNA flow preserved** — KPI tab remains live and tutorial auto-blocking on `/business-profile` stays removed
- **Verification completed** — Testing agent iteration_141 passed all redesigned page checks; frontend specialist confirmed Revenue/Operations/Risk/Compliance/Market UX sections and KPI tab behavior; final smoke check confirmed `/pricing` now shows SMB Protect

### Sprint 14 — Tier-Aware KPI Access + Business DNA KPI Policy Tab (Complete — Mar 2026)
- **Tier-aware Brain KPI policy implemented** — Existing plans now map to KPI visibility limits: Free 10, Foundation 25, Performance 50, Growth 75, Custom/Super Admin 100
- **Brain API policy layer added** — `backend/business_brain_engine.py` and `backend/routes/business_brain.py` now expose `brain_policy` metadata, enforce visible KPI limits in `/api/brain/metrics`, and provide new `GET/PUT /api/brain/kpis` endpoints for per-user KPI threshold configuration
- **Threshold persistence without schema migration** — KPI threshold settings are stored in `business_profiles.intelligence_configuration.brain_kpis`, allowing live Brain policy updates on refresh without adding a new table
- **Business DNA KPI tab shipped** — `frontend/src/components/business-dna/KpiThresholdTab.js` added under `frontend/src/pages/BusinessProfile.js`, with plan summary, KPI search, threshold controls, and save flow
- **Business DNA UX hardening** — Removed the auto tutorial overlay for `/business-profile` and changed profile enrichment / score loading to be non-blocking so the KPI tab is reachable faster
- **Pricing copy aligned** — `frontend/src/config/pricingTiers.js` now reflects the KPI counts per existing plan
- **Verification completed** — Backend testing agent iteration_140 passed 13/13 backend tests; frontend specialist verified KPI tab load, 100 KPI rows for custom/super admin, and successful save flow via `/api/brain/kpis`

### Sprint 13 — Business Brain 100-Metric Recovery + Advisor Pending-State Guard (Complete — Mar 2026)
- **Root cause confirmed** — Production Brain metric count was collapsing to 20 because Azure’s backend image copies `backend/` contents into `/app`, while the catalog loader was hardcoded to `/app/backend/business_brain_top100_catalog.json`
- **Portable catalog lookup fix** — `backend/business_brain_engine.py` now resolves `business_brain_top100_catalog.json` relative to `Path(__file__).resolve().parent`, plus `/app/business_brain_top100_catalog.json` and existing fallback candidates, so both preview and Azure container layouts can find the authoritative 100-KPI catalog
- **Advisor false-state fix** — `frontend/src/pages/AdvisorWatchtower.js` no longer starts with Brain status = unavailable and no longer renders a false red failure or false all-clear card while Brain source health is still pending; it now shows a dedicated syncing state
- **Verification completed in preview** — `/api/brain/runtime-check` now reports `catalog_metric_count: 100`; `/api/brain/metrics?include_coverage=true` returns `total_metrics: 100`; login + advisor smoke test + testing agent iteration_139 all passed
- **Production status note** — External production `https://biqc.thestrategysquad.com` still showed `fallback_core_metrics` with 20 metrics at the time of verification, so the code fix now needs the next Azure deploy to make production match preview

### Sprint 12 — Production Forensic Recovery + Panel UX Move (Complete — Mar 2026)
- **Production recovery verified** — Post-deploy production retest (`iteration_133`) confirms previously broken modules are now working live on `https://biqc.thestrategysquad.com`: War Room Q&A, Ops Advisory, Documents, and Priority Inbox
- **War Room resilience** — `backend/routes/boardroom.py` now normalizes analysis-only upstream payloads into readable `answer` / `response` text; `frontend/src/components/WarRoomConsole.js` renders the normalized output and uses a longer request timeout for live production latency
- **Ops Advisory + Documents backend fixes** — Removed broken `supabase_admin` read paths in `backend/routes/profile.py` and `backend/routes/generation.py`; OAC now has deterministic fallback recommendations when AI generation fails, and `/api/documents` no longer 500s
- **Priority Inbox recovery** — `backend/routes/email.py` now uses valid OpenAI model names for email analysis, includes deterministic fallback priority classification, and `frontend/src/pages/EmailInbox.js` prefers backend-backed analysis flow instead of brittle direct edge JWT dependency
- **Requested UX move completed** — Weekly Check-In banner moved into the SoundBoard side panel directly under Forensic Market Exposure (`frontend/src/components/SoundboardPanel.js`) and removed from the advisor page body (`frontend/src/pages/AdvisorWatchtower.js`)
- **Schema preview fix** — Added missing `decision_pressure` table creation to `supabase/migrations/017_calibrate_pressure.sql` so Supabase Preview no longer fails on `relation "decision_pressure" does not exist`

### Sprint 9 — Soundboard Stability Pass (In Progress — Mar 2026)
- **Soundboard direct-provider hardening** — Fixed backend request schema to accept `mode`, added missing `os` import for env-key access, and implemented OpenAI/Gemini fallback routing in `backend/routes/soundboard.py`
- **Graceful provider failure handling** — Soundboard now returns clear `503` configuration/auth messages when provider keys are missing/invalid instead of opaque crashes/toasts
- **Conversation persistence fix** — `update_soundboard_conversation_supabase()` now updates by `conversation_id` / `id` instead of incorrect `session_id`
- **Frontend error UX** — `SoundboardPanel.js`, `FloatingSoundboard.js`, and `MySoundBoard.js` now surface backend `detail` / `reply` messages instead of generic connection failures
- **Verification completed** — Python + JS lint passed on changed files; frontend smoke testing passed; backend deep testing passed for health/auth/chat guardrail and graceful provider-failure behavior

### Sprint 10 — Calibration Regression Recovery (Complete — Mar 2026)
- **Auth/session isolation fix** — `backend/auth_supabase.py` now uses a dedicated auth/anon Supabase client for `sign_up`, `sign_in_with_password`, and `get_user` so the global service-role client is not mutated during login flows
- **Supabase env loading hardening** — `backend/supabase_client.py` now force-loads backend `.env` for consistent service-role initialization in this runtime
- **Calibration route recovery** — `frontend/src/components/ProtectedRoute.js` now prevents completed users from re-entering `/calibration`, including during auth bootstrap loading, using cached auth-state recovery logic
- **Calibration verification** — QA user seeded as fully calibrated/onboarded; `/api/calibration/status` returned `COMPLETE`, `/api/onboarding/status` returned `completed=true`, login landed on `/advisor`, and manual `/calibration` access redirected back to `/advisor`

### Sprint 11 — Live Truth Recovery + Deployment Determinism (In Progress — Mar 2026)
- **Live integration truth layer** — Added `backend/intelligence_live_truth.py` to derive canonical CRM/accounting/email connection state, latest snapshot context, and live observation-event alerts directly from Supabase tables without LLM speculation
- **P0 backend truth fixes** — Revenue/operations/risk/advisor/alerts APIs now overlay live connected-state truth; watchtower and notifications fall back to `observation_events`; business-profile scoring now correctly marks onboarding complete from `user_operator_profile` / `strategic_console_state` fallback when `onboarding` row is absent
- **Frontend auth-bootstrap fixes** — `useIntegrationStatus`, `useSnapshot`, Revenue, Operations, Risk, and Alerts pages now wait for authenticated session bootstrap before firing API loads, reducing false disconnected/zero-data renders
- **Returning-user onboarding guard** — Advisor welcome/onboarding modal only auto-shows when there are genuinely no integrations or live signals, preventing repeated “get started” states for Andre
- **Live production verification** — Post-restart authenticated route checks now show: `/revenue` with HubSpot/Xero connected and pipeline data, `/operations` with active bottleneck + live signals, `/risk` monitoring 4 of 6 categories, `/alerts` showing active alert count, `/soundboard` answering grounded prompts, `/advisor` surfacing real priorities, `/board-room` and `/war-room` loading instead of empty placeholders
- **Deployment hardening** — `.github/workflows/deploy.yml` now tags frontend/backend images with immutable `github.sha`, deploys Azure Web Apps using those exact SHA tags (not `latest`), removes the `emergentintegrations` install from backend image build, and adds post-deploy image-pin + health verification steps

### Sprint 8 — Priority Inbox Full Build (Complete — Mar 2026)
- **`email_priority` edge function** — Full v2: Gmail (REST API) + Outlook (Graph API), AI classification via GPT-4o-mini (high/medium/low + reason + suggested_action + action_item + due_date), writes to `priority_inbox` + `email_tasks` Supabase tables, idempotent upsert
- **`gmail_prod` edge function** — Built: returns `{ok, connected, email}` for single provider; supports `?provider=all` for multi-provider status check simultaneously
- **`refresh_tokens` edge function** — Built: refreshes expiring Gmail (Google OAuth) and Outlook (Azure AD) tokens, marks `sync_status=token_expired` when refresh fails
- **SQL migrations 051+052** — New tables: `priority_inbox`, `email_tasks`, `email_intelligence_runs`, `icloud_connections`, `imap_connections`; cron job every 10 min; `get_priority_inbox` helper SQL function
- **`EmailInbox.js` frontend** — Fixed: calls edge function with correct POST body; loads from `priority_inbox` cache immediately then refreshes; reclassification buttons (H/M/L override stored in `user_override` column); field name normalization (`from_address` → `from`, `received_date` → `received`); "Cached results · Refresh now" indicator
- **iCloud/IMAP** — Schema tables created, placeholder functions with PROVIDER_UNAVAILABLE error (Deno TCP limitation noted; backend Python job path documented)


- **Integrations page full redesign** — Premium dark command-centre layout replacing dated codespace grid: section labels, horizontal category tabs, 65+ integration cards with Clearbit logos, connected state glow, "Browse all 220+" CTA
- **Email & Calendar pinned section** — Gmail, Outlook, Google Calendar shown at top with "Supabase OAuth" badge, separate from Merge-powered integrations
- **Marketing platforms section** — Google Ads, Meta Ads, LinkedIn Ads added as "Coming Soon" with notify-me CTA
- **Calendar added to sidebar** — Moved from buried "Weekly Check-In" in Settings & Growth to Execution section (alongside Priority Inbox, Alerts, Actions) with correct "Calendar" label
- **3 integration bugs fixed**: email_connections status column crash, workspace creation fallback (no accounts table required), integration_accounts upsert fallback chain
- **Merge API key placeholder detection** — Returns clean 503 instead of cryptic 500 when key is not set


- **Public /our-integrations page** — full enterprise rebuild: left-aligned hero, 7 horizontal filter chips with (i) tooltips, 24 integration cards (Clearbit logos, ghost Connect CTAs, category badges, benefit statements), data-usage hint bar, security section (AES-256/AU Residency/Revoke), bottom CTA — 94% test pass (17/18)
- **`IntelligenceCoverageBar.js`** — compact header pill showing % coverage based on connected integrations. Renders immediately from `useIntegrationStatus` (not gated by slow cognitive snapshot). Tooltip shows per-category status. Navigates to /integrations on click.
- **AdvisorWatchtower** — coverage bar rendered in persistent header section, visible immediately on page load without waiting for cognitive snapshot
- **PostCMOIntegrationOverlay** — enhanced headline "Your intelligence foundation is ready." + 3 trust signals (30 seconds · Read-only · Revoke anytime)
- **Backend fix** — removed non-existent `status` column from `email_connections` query in `/api/user/integration-status`


### Phase 5 — React Native Token Alignment + Full Regression (Complete — Mar 2026)
- **Mobile theme fully aligned** — textMuted/tabInactive #8B9DB5 (WCAG AA), bgPanel, bgSidebar, helper exports
- **font-display:optional** — eliminates FOUT on slow connections
- **Pricing trust badge** — "Privacy Act Compliant" (was "Zero Data Leakage")
- **Regression suite (33/33 PASS)** — all 20 dark routes, 8 light routes, all Phase 1-4 features, FCP 1820ms


### Phase 4 — Font Unification (Complete — Mar 2026)
- **`fontFamily.displayING` undefined fixed** — 37 marketing heading instances now render Cormorant Garamond (was browser default fallback)
- **Tailwind + tokens.js unified** — `heading/display: Cormorant Garamond`, `sans/body: Inter`, `mono: JetBrains Mono` across all config files
- **3 unused fonts removed** from `index.html` (Plus Jakarta Sans, DM Sans, Sora) — reduces page load
- **Typography**: Hero H1 → Inter (intentional high-impact); Section H2/H3 → Cormorant Garamond; Body → Inter; Data → JetBrains Mono



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

### Phase 2b — Light Mode Full Coverage + Phase 3 Trust & Conversion (Complete — Mar 2026)
- **743 inline style color replacements** across 63 files: `#141C26` → `var(--biqc-bg-card)`, `#0F1720` → `var(--biqc-bg)`, `#0A1018` → `var(--biqc-bg-input)`, `#243140` → `var(--biqc-border)`, `#F4F7FA/9FB0C3/64748B` → CSS vars — ALL 10 platform pages pass light mode test
- **CSS Tailwind overrides** in `index.css`: `[data-theme="light"]` selectors for Tailwind utility classes that can't be controlled via inline CSS vars
- **`--biqc-panel-bg` + `--biqc-sidebar-bg`** tokens added to complete the variable set
- **New Pricing.js** — 5-plan grid, Monthly/Annual toggle (20% savings), feature comparison table (12 rows × 5 columns), trust badges, expandable FAQ, orange gradient CTA
- **Routing fixed** — `/pricing` now serves new `Pricing.js` (was serving old `SitePricingPage`)
- **Homepage** — Trust badges section (🇦🇺/🔒/🛡️/✅) + 3-card testimonials section with SMB metrics
- **Login page** — 4th trust item added: "Australian Hosted — Sydney & Melbourne, zero offshore processing"
- **Test result**: Light mode 100% verified (13/13 platform pages), Phase 3 features verified ✅ (iteration_111)

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
2. **Run SQL migration** `supabase/migrations/055_ai_rate_limiting.sql` in Supabase SQL editor to activate AI usage/rate limiting
3. **Fix Outlook/Gmail OAuth in production** — Set `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_REDIRECT_URI`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` in Azure App Service
4. **Provide real AI provider keys in environment** — preview currently has `OPENAI_API_KEY=CONFIGURED_IN_AZURE` placeholder and no `GOOGLE_API_KEY`, so graceful errors are expected until real keys are present
5. **Let latest frontend deploy finish and re-verify production pages after image-pin workflow change merges**
6. Configure analytics provider keys (Mixpanel/Amplitude/PostHog)
7. Create `push_devices` table in Supabase for device token storage

### P1
8. Tighten Data Confidence scoring so connected live-signal routes do not still under-score healthy pages
9. Improve War Room / Board Room specificity so executive summaries go beyond a single live-signal sentence
10. Reset `andre@thestrategysquad.com.au` + test account 2 passwords
11. API performance optimization
12. Admin panel billing adjustments
13. Mobile App Store deployment (TestFlight/Play Store)

### P2
12. Decision outcome visualization (trend charts at checkpoints)
13. Competitive Benchmark auto-refresh (weekly cron)
14. Push notification backend triggers (instability breach, checkpoint due, daily brief)
15. Sprint 3: Snapshot Failure State UI (error/retry when intelligence snapshot fails)
16. SoundBoard AI context injection — use calibration data (business name, industry, CMO summary) even when no external integrations connected

## Post-UX Audit (Non-Todo Note)
- If you want, next I’ll implement the token-health monitor + pre-expiry warning surfaces as the next P0 hardening step.
