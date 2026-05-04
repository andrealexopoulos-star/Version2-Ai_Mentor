# F1 — wires `/r/:token` SPA route on top of E8

**Branch:** `fix/p0-marjo-f1-spa-share-route` (based on `fix/p0-marjo-e8-share-function`)
**Date:** 2026-05-04
**Closes:** R8 P0 blocker on E8 — Marjo Critical Incident
**Authority:** code `13041978` required to push.

## What E8 shipped (background)

E8 (commit `5fd880b21fb51a76d6b31eb6073152807f259329`) wired the backend share function:

- `POST /reports/cmo-report/share` → returns `{share_url, expires_at}` where `share_url = https://biqc.ai/r/{token}`
- `GET /reports/cmo-report/shared/{token}` → returns sanitised text/html (200) or 400/404/410/503
- `share_events` migration with RLS
- Frontend `handleShare` modal in `CMOReportPage.js` (works correctly client-side)

## What R8 caught

The frontend SPA had **no route at `/r/:token`**. Recipients of a share URL opened it and hit the catch-all `<Route path="*" element={<NotFoundPage />} />` at `frontend/src/App.js:518`. There is no `_redirects`, no `staticwebapp.config.json`, no rewrite. This is the exact silent end-to-end failure PR #449 was supposed to fix.

## What F1 does

### 1. New page component — `frontend/src/pages/SharedReportPage.js`

- Reads `:token` from URL via `useParams`
- Fetches `/api/reports/cmo-report/shared/{token}` directly with `fetch` (NOT `apiClient`, because that interceptor enforces JSON responses + adds an `Authorization` header. The share endpoint returns `text/html` and is public.)
- `credentials: 'omit'` — no cookie/auth leakage to the public surface
- Five explicit display states:
  - **loading** — spinner, "Loading shared report..."
  - **ready** — sanitised backend HTML rendered inside a sandboxed `<iframe srcdoc=...>`
  - **invalid** (404 / 400 / malformed token) — "This share link is invalid"
  - **expired** (410) — "This share link has expired"
  - **error** (5xx / network) — "This shared report is temporarily unavailable"
- Brand: "Ask BIQc" in the header (NEVER "Soundboard" / "Chat" / "Assistant", per `feedback_ask_biqc_brand_name.md`)
- CTA: "Sign up for Ask BIQc" → `/register-supabase` (canonical signup, used by marketing homepage already)
- **No** authenticated SPA shell — no `Sidebar`, no `DashboardLayout`, no top-nav user menu, no Supabase session required, no `ProtectedRoute` / `LaunchRoute` wrapper. The token URL holder IS the authorisation, per E8's backend contract.
- **No** supplier names anywhere on the rendered surface (Contract v2). Header/footer/status panels are generic "Ask BIQc" / "BIQc" copy. The backend's `_build_public_share_html` already strips supplier names + runs through `assert_no_banned_tokens` server-side, so the iframe payload is also pre-sanitised.

### 2. Route registration — `frontend/src/App.js`

- New lazy-loaded import in the "marketing" webpack chunk (no auth code-splits), placed alongside `NotFoundPage` (line 62)
- Route entry `<Route path="/r/:token" element={<SharedReportPage />} />` placed at line 533, **before** the catch-all `<Route path="*">`. If reordered, recipients would hit `NotFoundPage` again — the exact regression we're fixing.
- Comment in the route block explains the contract so a future contributor doesn't re-arrange it.

### 3. Frontend tests — `frontend/src/__tests__/SharedReportPage.test.jsx`

11/11 tests pass:

```
PASS src/__tests__/SharedReportPage.test.jsx
  SharedReportPage — fix/p0-marjo-f1 (Marjo Critical Incident)
    ✓ renders the loading state initially while fetch is pending
    ✓ renders the sanitised report HTML inside an iframe on a 200 response
    ✓ renders an explicit "expired" message on a 410 response
    ✓ renders an explicit "invalid" message on a 404 response
    ✓ renders an explicit "temporarily unavailable" message on a 5xx response
    ✓ renders the "Ask BIQc" brand in the header
    ✓ renders a clear "Sign up for Ask BIQc" CTA pointing at /register-supabase
    ✓ renders OUTSIDE the authenticated SPA shell — no sidebar / authenticated nav
    ✓ rendered page contains no supplier names (Contract v2)
    ✓ treats a malformed (too-short) token as invalid without hitting the backend
    ✓ treats a network failure as the explicit "temporarily unavailable" state

Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total
```

The test mocks `react-router-dom` (`{ virtual: true }`) because react-router-dom v7's `exports`-only package layout breaks the CRA-shipped jest-27 resolver — same gap that prevents E8's existing `CMOReportShare.test.jsx` from running. F1 is a leaf component (just `useParams` + `Link`), so a virtual mock suffices and avoids re-tooling the project's jest config.

## End-to-end flow now (post-F1)

1. CMO Report owner clicks "Share" inside the authenticated app
2. Backend `POST /reports/cmo-report/share` issues a token, persists a row in `share_events`, returns `share_url = https://biqc.ai/r/{token}`
3. Owner copies/sends the URL
4. Recipient opens `https://biqc.ai/r/{token}`
5. **NEW — F1**: SPA matches route `/r/:token` → mounts `SharedReportPage`
6. Component fetches `GET /api/reports/cmo-report/shared/{token}` (no auth header)
7. Backend resolves the token, rebuilds the report, runs Contract-v2 sanitiser, returns sanitised HTML
8. Frontend renders the HTML inside a sandboxed iframe within the Ask-BIQc-branded shell
9. Recipient sees: brand header, full report content, signup CTA, footer — **no 404, no silent blank screen**

For the failure paths (expired token / revoked / invalid / 5xx), the recipient sees an explicit, branded error message + a "Sign up for Ask BIQc" CTA — never the generic 404 page.

## Files

| Action | Path |
|---|---|
| Added | `frontend/src/pages/SharedReportPage.js` |
| Added | `frontend/src/__tests__/SharedReportPage.test.jsx` |
| Modified | `frontend/src/App.js` (lazy import + route entry) |
| Added | `evidence/F1-fixes-E8-spa-route.md` (this file) |

## Authority and out-of-scope

- Branched off E8: yes
- Commit to `fix/p0-marjo-f1-spa-share-route`: yes
- Push: NO (gated by Andreas's `13041978` code)
- Touched billing/marketing/tier-flip: NO
- Modified backend `reports.py` share endpoints: NO (E8 backend is correct as-is)
- Modified migrations: NO
- Spawned sub-agents: NO

## Zero-defect bar (per `feedback_ship_asap_zero_defect_contract.md`)

- Zero regression — only adds a new route + new page; no existing route changed
- Zero bugs — 11/11 tests passing, including explicit error states
- Zero drop — no functionality removed
- Zero drift — page lives in the marketing chunk; no backend / migration drift
- Zero summary-without-evidence — this file + test output is the proof
- Zero failures — silent 404 + silent blank closed; explicit messaging on every failure path; iframe sandboxed (`allow-same-origin` only — no scripts, no forms)
