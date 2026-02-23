# BIQc Platform — PRD (Updated post-audit)

## Architecture
- Frontend: React + Tailwind (Liquid Steel #0F1720/#FF6A00)
- Backend: FastAPI (120+ endpoints) + Supabase (14 Edge Functions)
- AI: OpenAI gpt-4o (backend) + gpt-4o-mini (calibration) + Perplexity (market)
- Integrations: Merge.dev (CRM/Accounting), Outlook, Gmail, Google Drive

## Completed (2026-02-23)
- Full Liquid Steel theme across all 58 routes
- 20 sidebar pages with data/intelligence
- Floating Soundboard on all 6 Intelligence pages
- Zero spinners in auth/loading flows
- 4 accounting endpoints (provider-agnostic)
- Alert Complete/Ignore with backend persistence
- First-login notification for email/integration setup
- Hero text sizing fixed across all website pages
- Comprehensive platform audit completed

## Pages with PLACEHOLDER data (5 pages)
- /actions, /automations, /compliance, /reports, /audit-log

## Live data pages (11 pages)
- /advisor, /revenue, /operations, /risk, /market, /alerts
- /email-inbox, /integrations, /data-health, /business-profile, /settings

## Pending
- P0: Deploy Edge Function financial code to Supabase
- P1: Wire 5 placeholder pages to real backends
- P1: Calibration duplicate answer detection
- P2: Consolidate 16 legacy pages
- P2: Delete calibration_psych duplicate
- P3: Bundle size optimization
