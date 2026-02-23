# BIQc Platform — Product Requirements Document

## Original Problem Statement
Transform BIQc into a high-performance, AI-driven "Cognition-as-a-Platform" for SMBs. Complete visual and architectural overhaul to a "Liquid Steel" dark theme with premium typography (Cormorant Garamond + Inter).

## Core Requirements
- Premium "Liquid Steel" aesthetic (dark theme #0F1720 background, orange #FF6A00 accents)
- Fast, intuitive, agentic user experience
- Industry-contextualized intelligence
- Enterprise-grade platform structure
- Comprehensive data, insights, and intelligence on every page

## Architecture
- **Frontend**: React (CRA + CRACO) with Tailwind CSS
- **Backend**: FastAPI (Python)
- **Database**: Supabase (PostgreSQL, Auth, Edge Functions, pg_cron)
- **AI**: OpenAI + Perplexity via Supabase Edge Functions
- **Integrations**: Merge.dev (CRM/Accounting), Google/Microsoft OAuth

## What's Been Implemented

### 2026-02-23: Sidebar Restructuring + 11 New Intelligence Pages
- **Rebuilt sidebar menu** to enterprise structure:
  - **Intelligence**: BIQc Insights, Revenue, Operations, Risk, Compliance, Market
  - **Execution**: Alerts, Actions, Automations
  - **Systems**: Integrations, Data Health
  - **Governance**: Reports, Audit Log, Settings
- **Created 11 new data-rich pages** with demo data, insights, and intelligence:
  - RevenuePage.js, OperationsPage.js, RiskPage.js, CompliancePage.js, MarketPage.js
  - AlertsPageAuth.js, ActionsPage.js, AutomationsPageAuth.js
  - DataHealthPage.js, ReportsPage.js, AuditLogPage.js
- **Fixed CheckInAlerts** component: converted from light to dark Liquid Steel theme
- **Testing**: Build passes, code review pass, all protected routes redirect correctly
- **Note**: All new pages use DEMO/STATIC data (not connected to live APIs)

### 2026-02-23: Route Migration Fix (CRITICAL)
- Swapped main routes to use Liquid Steel components
- Root URL now serves Liquid Steel homepage
- Updated navigation links across WebsiteLayout, PlatformLayout, TrustSubPages
- 20/20 frontend tests PASSED

### Previous Session: Complete UI/UX Transformation
- Redesigned 65+ pages/components to Liquid Steel dark theme
- Built 8-section Super Admin portal
- Created architectural planning documents

## Sidebar Menu Structure (Current)
### Intelligence
- BIQc Insights (/advisor) — AI cognitive dashboard
- Revenue (/revenue) — Pipeline, churn, deal velocity
- Operations (/operations) — SOP compliance, bottlenecks, workload
- Risk (/risk) — Financial, operational, market risk
- Compliance (/compliance) — Regulatory obligations, document status
- Market (/market) — Competitor signals, trends

### Execution
- Alerts (/alerts) — Business alert centre with filters
- Actions (/actions) — AI-recommended actions ready for execution
- Automations (/automations) — AI-powered workflows

### Systems
- Integrations (/integrations) — Merge.dev integration management
- Data Health (/data-health) — Sync status, data quality

### Governance
- Reports (/reports) — AI-generated business reports
- Audit Log (/audit-log) — Activity trail
- Settings (/settings) — Account settings

## Pending Tasks

### P0
- Deploy to production: "Save to GitHub" → "Deploy"
- Post-deployment E2E testing (verify auth and all pages)

### P1
- Connect new pages to live data (replace demo data with real Supabase/Merge.dev data)
- Debug Xero/HubSpot/email data flow through Edge Functions
- Implement "Soundboard" capability

### P2
- Build Action Layer backend (email/SMS/ticketing execution)
- Recover 5 missing Edge Function source files
- Connect Reports to actual report generation

### Backlog
- Industry-specific UI customization
- Consolidate duplicate Supabase secrets
- Add Merge.dev webhook handler
