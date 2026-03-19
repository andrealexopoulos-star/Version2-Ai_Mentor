# Phase 1 — Expanded Actions (minimum 9/10)

This document expands each Phase 1 action from `BIQC_FORENSIC_UX_UI_AUDIT.md` with **Why**, **What to do**, and **Success metric**.  
**Target: Cognition ≥9, Integration ≥9** after Phase 1. 7.5 is not sufficient; minimum 9 is required.

---

## Phase 1 header (replace in main audit)

**Phase 1 — Foundation (minimum 9/10 on both dimensions)**

Phase 1 establishes a single source of truth for access control, consistent loading/error UX, a unified Integration Centre, visible lineage on every insight, and config-driven behaviour with no hard-coded user overrides. **Target: Cognition ≥9, Integration ≥9** after this phase.

---

## 1.1 — Single tier/route source

| | |
|---|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Action** | Migrate all route gating to `tierResolver.js` plus one config file; remove duplication from `tiers.js` and `launchConfig` where they define access. |
| **Why** | Today `ROUTE_ACCESS` lives in `tierResolver.js`, `PATH_TIERS` / `canAccess` / `requiredTier` in `tiers.js`, and `FOUNDATION_FEATURES` / `WAITLIST_FEATURES` / `FOUNDATION_ROUTE_MAP` / `WAITLIST_ROUTE_MAP` in `launchConfig.js`. `App.js` uses `LaunchRoute` with `FOUNDATION_ROUTE_MAP` and `WAITLIST_ROUTE_MAP`; `DashboardLayout` and `MobileNav` may use different checks. That creates drift: a route can be free in one place and paid in another, or show in nav for free users when it should be gated. |
| **What to do** | (1) Choose **one** canonical source: e.g. a single `routeAccessConfig.js` that exports the full map `path → { minTier, featureKey?, launchType: 'free'|'foundation'|'waitlist' }`. (2) Refactor `tierResolver.js` to import and use only that config (no duplicate `ROUTE_ACCESS`). (3) Refactor `tiers.js` to remove `PATH_TIERS` and route-level logic; keep only tier display names/features if needed. (4) Refactor `launchConfig.js` so `FOUNDATION_ROUTE_MAP` / `WAITLIST_ROUTE_MAP` are derived from the same config (or remove and use the single map in `LaunchRoute`). (5) Update `App.js`, `DashboardLayout`, `MobileNav`, and `TierGate` to call one function e.g. `getRouteAccess(path)` / `checkRouteAccess(path, user)` from `tierResolver.js` only. |
| **Owner** | Eng |
| **Success metric** | Zero route access bugs; one file (or one exported object) defines all gated routes; adding a new gated route requires a single change. QA: free user cannot reach paid-only routes; paid user sees no spurious paywall; nav items match actual access. |

---

## 1.2 — Mandate PageLoadingState / PageErrorState

| | |
|---|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Action** | Audit every dashboard (app) page; use `PageLoadingState` and `PageErrorState` everywhere; add a simple lint rule or checklist so new pages cannot ship without them. |
| **Why** | Inconsistent loading (spinners vs skeletons vs blank) and error (inline messages vs full-page) hurt perceived quality and trust. Best-in-class cognition platforms (Notion, Linear, Stripe) use the same loading and error patterns everywhere so users always know "still loading" vs "failed" and what to do next. |
| **What to do** | (1) List every route that renders inside `DashboardLayout` (all `/advisor`, `/soundboard`, `/revenue`, etc.). (2) For each page: ensure initial load shows `PageLoadingState` (with optional `message`) and any fetch failure shows `PageErrorState` with `onRetry` and `moduleName`. Remove one-off spinners or custom error UIs. (3) If a page has multiple sections, use one top-level loading/error for the primary data; section-level loading can use the compact variant or `SkeletonCard` consistently. (4) Add a lint rule (e.g. ESLint plugin or custom script) that flags pages under `pages/` that do not import and use `PageLoadingState` and `PageErrorState`, or add a PR checklist item. |
| **Owner** | Eng |
| **Success metric** | 100% of app routes use the shared loading and error components; no ad-hoc spinner or error div for full-page states. QA: reload each page and simulate network failure; every page shows the same loading skeleton and same error layout with Retry/support/troubleshoot. |

---

## 1.3 — Integration Centre (v1)

| | |
|---|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Action** | Build one dedicated page (or replace/enhance `/integrations`) that lists **all** connectors (CRM, accounting, email, marketing, etc.) with status (connected / not connected), last sync time when available, and clear "Connect" / "Reconnect" actions. |
| **Why** | Users need a single place to see "what's connected" and "what can I connect," like Zapier/Make/Merge. Today integration status is scattered; there is no single health dashboard for every connector. |
| **What to do** | (1) Define the list of connectors (e.g. CRM via Merge, Accounting via Merge, Email via Gmail/Outlook, Marketing if applicable). (2) Add or reuse a backend endpoint that returns for the current user: `{ connectorId, name, category, connected: bool, lastSyncAt?, error?: string }` for each connector. (3) Build one UI: a card or row per connector with icon/name, status badge (Connected / Not connected / Error), last sync text (e.g. "Last sync 2h ago"), and primary CTA (Connect or Reconnect). (4) Wire "Connect" to the existing OAuth or connection flow for that connector; after success, redirect back to this page. (5) Ensure the Integration Centre is linked from the main nav and from any "connect more data" prompts (e.g. VerificationBadge). |
| **Owner** | Eng |
| **Success metric** | Single place to see and manage all connections. QA: user can open one page, see every connector's status, and initiate Connect/Reconnect for each without hunting through the app. |

---

## 1.4 — Surface lineage everywhere

| | |
|---|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Action** | Add a small "Source" or "From X, Y • 12m ago" (or equivalent) on **every** intelligence card/block, using the API's `lineage` and `data_freshness` (and optionally `confidence_score`). |
| **Why** | Trust in a cognition platform depends on transparency: "Where did this number come from?" and "How fresh is it?" The backend already returns `lineage`, `data_freshness`, and `confidence_score` from the unified intelligence engine; the frontend does not show them everywhere, so users cannot verify provenance. |
| **What to do** | (1) Identify every UI surface that displays intelligence (e.g. Advisor summary, Revenue/Operations/Risk/Market cards, Soundboard insights, Boardroom tiles, report snippets). (2) Ensure each of these surfaces receives (or fetches) the response that includes `lineage`, `data_freshness`, and optionally `confidence_score`. (3) Add a compact, consistent lineage line: e.g. "From Xero, HubSpot • 12m ago" (from `lineage.connected_sources` and `data_freshness`) and optionally a small confidence indicator (e.g. "High confidence" or a dot when above a threshold). (4) Use the same component or pattern everywhere so "where did this come from?" is always answerable at a glance. |
| **Owner** | Eng |
| **Success metric** | Every insight shows provenance (sources + freshness). QA: for each intelligence view, a user can see which systems contributed and how old the data is; no "naked" insight without source/freshness. |

---

## 1.5 — Remove hard-coded overrides

| | |
|---|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Action** | Replace all hard-coded user identifiers (e.g. `isAndre`, email checks) and role-based overrides in route or feature logic with config (e.g. env `BIQC_MASTER_ADMIN_EMAIL`) or feature flags. |
| **Why** | Hard-coded emails or roles in `App.js` and elsewhere make behaviour depend on a specific user, complicate testing, and risk leaking special access. Best-in-class platforms use config or feature flags for super-admin or beta access. |
| **What to do** | (1) Search the codebase for email literals, `isAndre`-style booleans, and any `user.email === '...'` used for access or redirects. (2) Introduce a single source for "privileged" users: e.g. `BIQC_MASTER_ADMIN_EMAIL` in env (backend already has this for auth); frontend can get a list from an env var or a small config endpoint (e.g. `admin_emails` or `bypass_waitlist_emails`). (3) Replace `isAndre` in `App.js` (and anywhere else) with e.g. `isPrivilegedUser(user)` that reads from that config. (4) Remove any other email or role literals from route/component logic; use tier from `tierResolver` and privileged list from config. |
| **Owner** | Eng |
| **Success metric** | No user email or role literal in route or feature logic. QA: changing the config (e.g. env) changes who has privileged access; no code change required for adding/removing a test or internal user. |

---

## Score summary update (for main audit)

Replace the Phase 1 target and score table with:

| Category | Current | After Phase 1 | After Phase 2 | Target (10/10) |
|----------|---------|----------------|----------------|----------------|
| **Cognition-as-a-Platform** | 6.2 | **≥9** | 9.5 | 10 |
| **Unified Integration Engine** | 5.8 | **≥9** | 9.5 | 10 |

**Overall:** **6.0 → ≥9.0 → 9.5 → 10.**

**Phase 1 is the non-negotiable foundation:** achieving minimum 9/10 on both dimensions before moving on.
