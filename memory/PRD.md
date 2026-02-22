# BIQc Platform - Product Requirements Document

## Original Problem Statement
Transform the BIQc platform into a high-performance, AI-driven strategic business intelligence tool for Australian SMEs. React frontend + FastAPI backend + Supabase (PostgreSQL).

## Design System: Liquid Steel
- **Background**: #0F1720 (main), #141C26 (panels)
- **Borders**: 1px solid #243140
- **Text**: #FFFFFF (headings), #F4F7FA (primary), #9FB0C3 (secondary), #64748B (muted)
- **Accent**: #FF6A00 (orange — alerts, actions, buttons ONLY)
- **Typography**: Cormorant Garamond (headings — elegant serif), Inter (body), JetBrains Mono (metrics)

## Transformation Status

### Phase 1 — Font + Naming (Feb 22, 2026) COMPLETE
- Replaced Sora with Cormorant Garamond across ALL pages (23+ pages)
- Renamed "Executive Overview" → "BIQc Insights"
- Fixed all font readability issues (explicit #FFFFFF white on dark backgrounds)
- Testing: 100% pass (iteration_55.json)

### Phase 2 — Login Transformation (NEXT)
- Replace /login-supabase with Liquid Steel themed login
- Ensure Google/Microsoft OAuth + email login work

### Phase 3 — Platform Transformation (UPCOMING)
- Replace DashboardLayout with Liquid Steel PlatformLayout
- Wire all authenticated routes to new layout
- Add SoundBoard to Intelligence pages

### Phase 4 — Super Admin Portal (UPCOMING)
- Sales page, Support page, User Admin (create/suspend), Billing
- Accessible when logged in as superadmin (andre@thestrategysquad.com.au)

## Pages Built
- 12 website pages (/site/*)
- 6 platform mockup pages (/site/platform/*)
- 5 industry mockup pages (/site/platform/industry/*)
- Total: 23 Liquid Steel pages

## Test Credentials
- Superadmin: andre@thestrategysquad.com.au / BIQc_Test_2026!
