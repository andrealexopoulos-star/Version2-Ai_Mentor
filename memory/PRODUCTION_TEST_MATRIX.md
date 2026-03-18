# BIQc Production Test Matrix — Free Tier + Security Deep Dive

## Account
- Use only: `andre@thestrategysquad.com.au`

## Round 1 — Login + Entry
- `/login-supabase`
  - Email/password sign-in works
  - Wrong-password cooldown appears after repeated failures
  - No broken redirect after success

## Round 2 — Free-Tier Core Pages
- `/advisor`
  - No infinite syncing trap
  - Priority cards or credible all-clear state visible
- `/market`
  - No waiting-for-data banner when pressure/freshness/watchtower exist
  - External signals + evidence health render cleanly
- `/business-profile`
  - Page renders
  - KPI tab opens
  - KPI save works
- `/integrations`
  - Free-tier banner visible
  - Connected-state count accurate
  - Connected cards visibly marked
- `/email-inbox`
  - Summary cards render
  - Detail panel renders
- `/calendar`
  - Event cards render
  - Side panel renders
- `/competitive-benchmark`
  - Real score if calibrated
  - If not calibrated, intentional empty state + CTA

## Round 3 — Free-Tier Protected API Checks
- `/api/auth/supabase/me`
- `/api/brain/kpis`
- `/api/intelligence/watchtower`
- `/api/intelligence/pressure`
- `/api/intelligence/freshness`
- `/api/email/priority-inbox`
- `/api/integrations/merge/connected`
- `/api/user/integration-status`
- `/api/user/data-coverage`
- `/api/notifications/alerts`
- `/api/marketing/benchmark/latest`

## Round 4 — Security / Hardening Checks
- Unauthenticated requests to protected endpoints blocked
- `/api/*` responses include:
  - `Strict-Transport-Security`
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `Content-Security-Policy`
- Server version header reviewed
- Login repeated-failure behaviour reviewed

## Round 5 — UX / UI Audit Standard
- No skeleton traps
- No misleading success states
- No misleading free-tier gates
- No cramped layouts on main decision surfaces
- Every key page has a clear CTA or a credible no-data explanation

## Evidence Collection
- Capture production screenshots only for:
  - Login cooldown state
  - Advisor
  - Market
  - Business DNA
  - Integrations
  - Priority Inbox
  - Calendar
  - Competitive Benchmark