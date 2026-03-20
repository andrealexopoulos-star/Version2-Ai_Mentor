# BIQc Forensic UX/UI Audit — Military-Grade Assessment

**Classification:** Internal — Product & Engineering  
**Date:** March 2026  
**Scope:** Website, platform app, and integration architecture  
**Benchmark:** World-best cognition-as-a-platform providers + unified integration engines  

**Status:** Phase 1, Phase 2, and Phase 3 **complete**. Current focus: Phase 4 (10/10 best-in-class).

---

## 1. Benchmark Definition

### 1.1 Cognition-as-a-Platform (Reference Set)

| Provider | Strengths |
|----------|-----------|
| **Notion** | Unified workspace, command palette (⌘K), blocks, instant search, consistent empty/loading states |
| **Linear** | Keyboard-first, minimal UI, fast navigation, clear hierarchy, shortcut culture |
| **Cursor** | AI-in-context, composable flows, clear “what can I do” affordances |
| **Vercel** | Clean dashboards, deployment status at a glance, docs + product cohesion |
| **Stripe Dashboard** | Data density + clarity, audit trails, trust signals, progressive disclosure |

**Cognition platform criteria:** Information architecture, command/shortcut layer, loading/error consistency, empty states, progressive disclosure, trust/confidence signals, mobile parity, accessibility baseline.

### 1.2 Unified Integration Engines (Reference Set)

| Provider | Strengths |
|----------|-----------|
| **Zapier** | Single “connect → choose app → map → test” flow, status per connection, retry/visibility |
| **Make (Integromat)** | Visual scenario builder, one place for all connectors, execution history |
| **n8n** | Self-hosted, unified node graph, one engine for all integrations |
| **Merge** | Single API for HRIS/ATS/CRM/accounting, one integration surface |

**Unified integration criteria:** Single surface for “all my connections”, one status/health view, consistent auth (OAuth) flow, unified error/retry, lineage (“this insight came from X”), rate/limit visibility.

---

## 2. Scoring Framework (0–10)

- **0–2:** Missing or broken; blocks core use.  
- **3–4:** Present but inconsistent, confusing, or fragile.  
- **5–6:** Usable; meets minimum expectations; clear gaps vs. best-in-class.  
- **7–8:** Good; comparable to strong SaaS; minor gaps.  
- **9–10:** Best-in-class; reference quality; no material gaps.

---

## 3. BIQc Scores vs. Benchmark

### 3.1 Cognition-as-a-Platform Scorecard

| Dimension | Score | Evidence | Gap Summary |
|-----------|-------|----------|--------------|
| **Information architecture** | 6/10 | Rich route set (advisor, soundboard, market, revenue, boardroom, etc.); `DashboardLayout` + `MobileNav` with tier-aware sections. Three overlapping tier sources (`tierResolver`, `launchConfig`, `tiers.js`) create risk of inconsistent gating. | Consolidate tier/route config to single source; clarify IA for “free vs paid vs waitlist” in nav. |
| **Command / shortcut layer** | 2/10 | No global command palette (⌘K), no documented keyboard shortcuts, no “quick jump” to pages or actions. | Add command palette and core shortcuts (e.g. go to Advisor, Soundboard, Search). |
| **Loading / skeleton consistency** | 7/10 | `PageLoadingState`, `PageErrorState`, `AsyncDataLoader`, `SkeletonCard`; brand spinner and skeletons. Not every page uses them; some custom loaders. | Mandate `PageLoadingState`/`PageErrorState` on every dashboard page; remove ad-hoc spinners. |
| **Empty states** | 5/10 | Some pages have empty states; no repo-wide empty-state component or copy guidelines. | Introduce `EmptyState` component and standard copy; apply to all list/card views. |
| **Progressive disclosure** | 6/10 | Tier gating (`TierGate`, `LaunchRoute`) and feature lists in `launchConfig`; upgrade paths exist. Hard-coded `isAndre` in `App.js`; paywall messaging could be more contextual. | Replace special-case logic with config; add contextual “Unlock this” with benefit. |
| **Trust / confidence signals** | 7/10 | `VerificationBadge` (snapshot confidence), `IntelligenceCoverageBar`, data contract in API (`confidence_score`, `data_sources_count`, `data_freshness`, `lineage`). Not surfaced everywhere insights are shown. | Surface confidence/lineage on every intelligence view; add “Last updated” and source list. |
| **Mobile / responsive** | 6/10 | `MobileNav` (5-tab + More), touch targets 44px in tokens, breakpoints and mobile CSS. Sidebar becomes drawer. Some pages likely still desktop-heavy. | Audit all app pages for mobile; add responsive tables/cards and touch-friendly actions. |
| **Accessibility (a11y)** | 5/10 | Radix UI (dialog, dropdown, etc.); touch targets; `textMuted` WCAG fix. No centralized a11y doc; no skip link; focus management and aria usage scattered. | Add skip link, document a11y in design system, run axe + keyboard audit. |
| **Design system consistency** | 8/10 | Single `tokens.js` (typography, spacing, colors, radius, shadows, breakpoints); CSS vars; Cormorant + Inter + JetBrains. Some inline overrides. | Tighten enforcement (lint/design review); reduce inline color/font overrides. |
| **Error handling & recovery** | 7/10 | `AppErrorBoundary`, `AuthError`, `PageErrorState` with Retry + support + troubleshoot; API client rejects HTML, 401 retry with refresh. | Standardize on `PageErrorState`; add optional “Report issue” and correlation ID. |
| **Onboarding & first-run** | 6/10 | Onboarding routes (`/onboarding-decision`, `/onboarding`, `/calibration`, `FirstLoginNotification`). Calibration and profile-import exist. Flow could be more guided and measurable. | Define “activation” metrics and single clear path (e.g. calibrate → first soundboard use). |
| **Performance perception** | 6/10 | Skeleton loaders and warmup for cognitive engine. No route-level code-splitting documented; no explicit “fast shell” strategy. | Lazy-load heavy routes; ensure LCP < 2.5s on advisor/soundboard. |

**Cognition-as-a-Platform aggregate (equal weight):** **(6.2/10)**

---

### 3.2 Unified Integration Engine Scorecard

| Dimension | Score | Evidence | Gap Summary |
|-----------|-------|----------|--------------|
| **Single surface for connections** | 6/10 | `/integrations` page; backend has Merge, email (OAuth), Stripe. No single “Integration Centre” with all connectors (CRM, accounting, email, marketing) and status in one view. | Build single Integration Centre: list all connectors, status, last sync, reconnect. |
| **Unified auth (OAuth) flow** | 7/10 | Supabase for app auth; Google OAuth; Merge for accounting/CRM. Email connect flow exists. Different routes for different integrations. | Single “Connect an integration” entry point with provider list and consistent callback handling. |
| **Status / health visibility** | 5/10 | `VerificationBadge` and data contract show “confidence” and lineage. No per-connector status (e.g. “Xero connected, last sync 2h ago”) or sync logs. | Add per-integration status, last sync time, and optional “Sync now” / logs. |
| **Unified error & retry** | 5/10 | API and route-level errors; no central “integration failures” or retry queue visible to user. | User-visible integration health + retry or “Reconnect” for failed connectors. |
| **Lineage (“where did this come from?”)** | 8/10 | `unified_intelligence` returns `lineage` (engine, page, connected_sources, cache_hit, timestamps). Backend `_fetch_all_integration_data` and data contract. Not always shown in UI. | Surface lineage on every intelligence widget (e.g. “From Xero + HubSpot, 12m ago”). |
| **Rate / limit visibility** | 4/10 | Backend rate limits and tier limits (`TIER_LIMITS` in deps); free tier caps (e.g. soundboard_daily). No in-app “usage this period” or “limits” view. | Usage/limits dashboard: e.g. “Soundboard 7/10 today”, “API calls 80/100”. |
| **Unified engine abstraction** | 6/10 | `unified_intelligence` router and `_fetch_all_integration_data` aggregate CRM, accounting, email, marketing; Business Brain and platform_services reference it. Other routes still call Supabase/Merge/email separately. | Route all “intelligence” through unified engine; document single contract for frontend. |
| **Integration discovery** | 5/10 | Launch config and pricing tiers list “integrations” or “up to 5”; no in-app catalog of “available integrations” with descriptions and “Connect” CTA. | Catalog page: available integrations, status (connected/available), one-click connect. |

**Unified Integration Engine aggregate (equal weight):** **(5.8/10)**

---

## 4. Cross-Cutting Gaps (Summary)

1. **No command palette or shortcut layer** — largest cognition UX gap.  
2. **Tier/route config in three places** — risk of wrong gating and confusing paywalls.  
3. **Integration UX not unified** — no single “Integration Centre”, per-connector status, or usage/limits view.  
4. **Lineage/confidence not consistently surfaced** — backend has it; frontend does not show it everywhere.  
5. **Accessibility** — no skip link, no centralized a11y standard or automation.  
6. **Empty states** — no standard component or copy.  
7. **Hard-coded overrides** — e.g. `isAndre` in `App.js`; special cases should be config-driven.  
8. **Documentation** — README and product/value docs are thin; no single “BIQc value proposition” doc.

---

## 5. Plan to Reach 10/10

### Phase 1 — Foundation ✅ Complete

| # | Action | Owner | Success metric |
|---|--------|--------|----------------|
| 1.1 | **Single tier/route source** — Migrate all route gating to `tierResolver.js` + one config file; remove duplication from `tiers.js` and `launchConfig` where it defines access. | Eng | Zero route access bugs; one place to add a new gated route. |
| 1.2 | **Mandate PageLoadingState / PageErrorState** — Audit all dashboard pages; use `PageLoadingState` and `PageErrorState` everywhere; add simple lint or checklist. | Eng | 100% of app routes use shared loading/error. |
| 1.3 | **Integration Centre (v1)** — One page: list all connectors (CRM, accounting, email, marketing), status (connected/not), last sync if available, “Connect”/“Reconnect”. | Eng | Single place to see and manage all connections. |
| 1.4 | **Surface lineage everywhere** — Add small “Source” or “From X, Y • 12m ago” on every intelligence card/block using API `lineage` and `data_freshness`. | Eng | Every insight shows provenance. |
| 1.5 | **Remove hard-coded overrides** — Replace `isAndre` and similar with config (e.g. `BIQC_MASTER_ADMIN_EMAIL` or feature flags). | Eng | No user-email or role in route logic. |

### Phase 2 — Cognition 9+, Integration 9+ ✅ Complete

| # | Action | Owner | Success metric |
|---|--------|--------|----------------|
| 2.1 | **Command palette (⌘K)** — Global shortcut to open palette: search pages, “Go to Soundboard”, “Go to Integrations”, optional “Run action”. | Eng | ⌘K (and Ctrl+K) open palette; top 10 routes reachable. |
| 2.2 | **Keyboard shortcuts** — Document and implement: e.g. G then A = Advisor, G then S = Soundboard, ? = shortcuts help. | Eng | Shortcut help modal; at least 5 core shortcuts. |
| 2.3 | **EmptyState component** — Single component with illustration/copy/CTA; apply to all list and card views (e.g. no alerts, no reports, no connections). | Eng/Design | All empty views use component and standard copy. |
| 2.4 | **Usage & limits view** — Per tier: show “Soundboard 7/10 today”, “Reports 2/3 this month”, etc.; link to upgrade where relevant. | Eng | One “Usage” or “Limits” section in Settings or dashboard. |
| 2.5 | **Per-connector status** — In Integration Centre: “Xero • Connected • Last sync 2h ago” and “Sync now” or “Reconnect” where supported. | Eng | Every connector shows status and last sync. |
| 2.6 | **Unified “Connect” flow** — Single entry “Add integration” → list of available integrations → choose one → OAuth/callback → back to Integration Centre with status. | Eng | One flow for all OAuth-based integrations. |

### Phase 3 — Cognition 9.5, Integration 9.5 ✅ Complete

| # | Action | Owner | Success metric |
|---|--------|--------|----------------|
| 3.1 | **Accessibility baseline** — Skip link, focus order, aria where needed; document in design system; run axe + keyboard test on critical paths. | Eng/Design | Zero critical a11y issues; doc in tokens or design-system. |
| 3.2 | **Mobile audit** — Every app page: responsive layout, touch targets, no horizontal scroll, tables/cards adapt. | Eng | All pages pass mobile checklist. |
| 3.3 | **Contextual upgrade** — Replace generic “Upgrade” with “Unlock [feature]: [one-line benefit]” and link to Foundation or waitlist. | Product/Eng | Every paywall has contextual copy and CTA. |
| 3.4 | **Integration catalog** — “Available integrations” with logo, short description, “Connect” for each; show “Coming soon” where applicable. | Eng/Product | Discovery page for all current and planned connectors. |
| 3.5 | **Activation funnel** — Define and instrument: e.g. sign up → calibrate → first Soundboard use → first report. Optimize onboarding to maximize activation. | Product/Eng | Funnel metrics in place; one clear “first value” path. |

### Phase 4 — 10/10 (Best-in-Class)

| # | Action | Owner | Success metric |
|---|--------|--------|----------------|
| 4.1 | **Backend: single integration facade** — All intelligence-serving routes use unified engine only; no ad-hoc Supabase/Merge/email calls from route handlers. | Eng | Single contract; all intelligence from unified engine. |
| 4.2 | **Frontend: single integration client** — One API module for “integration status”, “connect”, “disconnect”, “sync”; all integration UI calls it. | Eng | No duplicate integration logic in UI. |
| 4.3 | **Performance** — Lazy routes where needed; LCP < 2.5s on Advisor and Soundboard; no layout shift. | Eng | Core Web Vitals green on key routes. |
| 4.4 | **Trust & security in UI** — Audit trail visibility where appropriate; security/trust copy on sensitive pages; consistent with `SECURITY_LAUNCH_CHECKLIST.md`. | Product/Eng | Trust signals and audit visibility documented and shipped. |
| 4.5 | **Value proposition & docs** — One internal doc: “BIQc value proposition”, target personas, and differentiators; README or docs link for onboarding. | Product | Single source of truth for “what BIQc is” and “who it’s for”. |

---

## 6. Score Summary and Target

| Category | Baseline | Phase 1 ✅ | Phase 2 ✅ | Phase 3 ✅ | Phase 4 (next) |
|----------|----------|------------|------------|------------|----------------|
| **Cognition-as-a-Platform** | 6.2 | ≥9 | 9.5 | 9.5 | 10 |
| **Unified Integration Engine** | 5.8 | ≥9 | 9.5 | 9.5 | 10 |

**Overall (50% cognition, 50% integration):** **6.0 → ≥9.0 → 9.5 → 9.5 → 10.**

**Current state:** Phase 1, Phase 2, and Phase 3 complete. Next: Phase 4 (10/10 best-in-class).

---

## 7. References (Codebase)

- Routes & guards: `frontend/src/App.js`  
- Layout & nav: `frontend/src/components/DashboardLayout.js`, `frontend/src/components/MobileNav.js`  
- Tier/feature: `frontend/src/lib/tierResolver.js`, `frontend/src/config/launchConfig.js`, `frontend/src/config/pricingTiers.js`, `frontend/src/config/tiers.js`  
- Design: `frontend/src/design-system/tokens.js`  
- Loading/error: `frontend/src/components/PageStateComponents.js`, `frontend/src/components/ProtectedRoute.js`, `frontend/App.js` (AppErrorBoundary)  
- API client: `frontend/src/lib/api.js`  
- Backend API: `backend/server.py`, `backend/routes/deps.py`, `backend/auth_supabase.py`, `backend/supabase_client.py`, `backend/core/config.py`  
- Unified intelligence: `backend/routes/unified_intelligence.py`  
- Security: `docs/SECURITY_LAUNCH_CHECKLIST.md`  

---

*End of audit.*
