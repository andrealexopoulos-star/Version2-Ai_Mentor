# BIQc Platform - Product Requirements Document

## Design System: Liquid Steel
- **Background**: #0F1720, panels #141C26, sidebar #0A1018
- **Borders**: 1px solid #243140
- **Text**: #FFFFFF (headings), #F4F7FA (primary), #9FB0C3 (secondary), #64748B (muted)
- **Accent**: #FF6A00 (alerts, actions, active states)
- **Typography**: Cormorant Garamond (elegant serif headings), Inter (body), JetBrains Mono (metrics)

## Transformation Complete — 4 Phases

### Phase 1 ✅ Fonts + Naming (iteration_55 — 100%)
- Cormorant Garamond across all 23+ pages
- Renamed Executive Overview → BIQc Insights
- Fixed all font readability issues

### Phase 2 ✅ Login/Register (iteration_56 — 100%)
- Both pages transformed to Liquid Steel
- Google/Microsoft OAuth + email login all functional
- Real login tested with credentials

### Phase 3 ✅ Platform Layout (iteration_57 — 100%)
- DashboardLayout.js rewritten — wraps ALL authenticated pages
- Dark sidebar, topbar, content area
- All features preserved: tutorials, notifications, calibration, collapse, mobile, admin link

### Phase 4 ✅ Super Admin (iteration_58 — 95%)
- 4 tabs: User Admin, Sales, Support, Billing
- User Admin: search, user list, detail panel, suspend/unsuspend, impersonate
- Sales: pipeline with mock data (needs CRM for live data)
- Support: client health monitor
- Billing: Stripe placeholder with 3 subscription tiers

## What's MOCKED in Super Admin
- Sales pipeline data (static)
- Billing metrics ($0 — no Stripe connected)
- Support health scores (derived from user position)

## Test Credentials
- Superadmin: andre@thestrategysquad.com.au / BIQc_Test_2026!
