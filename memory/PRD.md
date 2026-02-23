# BIQc Platform — PRD

## Super Admin Setup
- **Master account**: andre@thestrategysquad.com.au
- **Access level**: Full super admin — can skip calibration, access admin portal, recalibrate, manage users
- **Bypass logic**: Checked by email in backend deps.py (get_super_admin), calibration/status, calibration/skip, ProtectedRoute, DashboardLayout

## Super Admin Capabilities
1. Skip calibration entirely (POST /api/calibration/skip)
2. Go back to any calibration step (Back button on calibration page)
3. Access /admin portal with all 8 sections
4. Impersonate any user
5. Suspend/unsuspend users
6. Manage AI prompts (Prompt Lab)
7. View system health, user stats, governance
8. Recalibrate at any time (user menu → Recalibrate)

## Admin Portal Sections (8)
1. Command Centre — system metrics, health status
2. User Admin — user list, search, detail view, suspend/impersonate
3. Governance — compliance, audit trail
4. Security — access control, session management
5. AI Governance — model usage, prompt management
6. Commercial — subscription, revenue metrics
7. Operations — system performance, integrations
8. Growth — user acquisition, engagement metrics

## Architecture
- Frontend: React + Tailwind (Liquid Steel)
- Backend: FastAPI (120+ endpoints) + Supabase (14 Edge Functions)
- AI: OpenAI gpt-4o + Perplexity
- Integrations: Merge.dev (CRM/Accounting), Outlook, Gmail, Google Drive

## Pages with PLACEHOLDER data (5)
- /actions, /automations, /compliance, /reports, /audit-log

## Live data pages (11)
- /advisor, /revenue, /operations, /risk, /market, /alerts
- /email-inbox, /integrations, /data-health, /business-profile, /settings

## Pending
- P0: Deploy Edge Function financial code
- P1: Wire 5 placeholder pages to real backends
- P2: Consolidate 16 legacy pages
