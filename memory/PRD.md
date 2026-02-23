# BIQc Platform — Product Requirements Document

## Architecture
- Frontend: React + Tailwind (Liquid Steel theme)
- Backend: FastAPI + Supabase
- Integrations: Merge.dev (any CRM/Accounting), Google/Microsoft OAuth

## Implemented This Session (2026-02-23)

### Financial Data Pipeline (Xero/Any Accounting)
- Added 4 new backend endpoints: `/api/integrations/accounting/invoices`, `/payments`, `/transactions`, `/summary`
- All endpoints are **provider-agnostic** — work with Xero, QuickBooks, MYOB, or any Merge.dev accounting integration
- Revenue page now fetches both CRM deals AND accounting data in parallel
- Created Edge Function code for Supabase deployment at `/app/memory/EDGE_FUNCTION_FINANCIAL_DATA.js`

### Floating Soundboard on All Intelligence Pages
- Created FloatingSoundboard component — floating Lightbulb button → expandable chat panel
- Added to: BIQc Insights, Revenue, Operations, Risk, Compliance, Market
- Uses existing `/api/soundboard/chat` backend endpoint
- Includes quick-start suggestion buttons

### Zero Spinners Policy
- Replaced ALL spinning wheels: ProtectedRoute, CognitiveLoadingScreen, InitiatingBIQC
- Branded BIQc pulse animations with progress bars instead

### Sidebar Updates
- Added Priority Inbox under Execution heading
- Complete/Ignore buttons on all alert items

### Backend Accounting Endpoints
- GET /api/integrations/accounting/invoices
- GET /api/integrations/accounting/payments
- GET /api/integrations/accounting/transactions
- GET /api/integrations/accounting/summary (financial intelligence aggregation)

## Pending
- Deploy Edge Function code to Supabase (provided in /app/memory/EDGE_FUNCTION_FINANCIAL_DATA.js)
- Calibration improvements (multiple choice, executive summary, Business DNA population)
- Wire Complete/Ignore alert actions to backend
- First-signup email connection notification
