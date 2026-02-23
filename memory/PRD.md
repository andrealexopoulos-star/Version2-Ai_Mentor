# BIQc Platform — Product Requirements Document

## Original Problem Statement
Transform BIQc into a high-performance, AI-driven "Cognition-as-a-Platform" for SMBs with a "Liquid Steel" dark theme.

## Architecture
- **Frontend**: React (CRA + CRACO), Tailwind CSS, Liquid Steel theme (#0F1720 bg, #FF6A00 accents)
- **Backend**: FastAPI (Python) + Supabase (PostgreSQL, Auth, Edge Functions)
- **Integrations**: Merge.dev (Xero, HubSpot), Google/Microsoft OAuth, OpenAI

## What's Been Implemented

### 2026-02-23: Live Data Integration
- **Revenue page** pulls live HubSpot CRM deals via `/api/integrations/crm/deals` with demo fallback
- **Operations page** pulls from `/api/snapshot/latest` cognitive data with demo fallback
- **Risk page** pulls cash runway from snapshot with demo fallback
- **Market page** pulls market narrative from snapshot with demo fallback
- **Alerts page** pulls from `/api/intelligence/watchtower` events with demo fallback
- **Data Health page** pulls from `/api/integrations/merge/connected` and `/api/intelligence/data-readiness`
- Created `usePlatformData.js` shared hook for centralized API fetching
- All pages show live data when authenticated, fall back to demo data gracefully

### 2026-02-23: Sidebar Restructuring + 11 New Pages
- Rebuilt sidebar: Intelligence, Execution, Systems, Governance
- Created 11 new pages: Revenue, Operations, Risk, Compliance, Market, Alerts, Actions, Automations, Data Health, Reports, Audit Log
- Fixed CheckInAlerts dark theme

### 2026-02-23: Route Migration
- Root `/` now serves Liquid Steel homepage
- All `/site/*` routes migrated to root paths
- 20/20 frontend tests passed

## Sidebar Menu Structure
- **Intelligence**: BIQc Insights, Revenue, Operations, Risk, Compliance, Market
- **Execution**: Alerts, Actions, Automations
- **Systems**: Integrations, Data Health
- **Governance**: Reports, Audit Log, Settings

## Data Flow
- Pages call backend APIs when authenticated
- Backend routes: `/api/integrations/crm/deals`, `/api/integrations/crm/contacts`, `/api/integrations/merge/connected`, `/api/intelligence/watchtower`, `/api/snapshot/latest`, `/api/intelligence/data-readiness`
- Demo/static data shown as fallback when APIs fail or return empty

## Pending Tasks
### P0
- Deploy to production
- Verify live data flows from Xero/HubSpot/Email after login

### P1
- Connect Actions page to actual email sending
- Implement Soundboard capability
- Connect Automations to real workflow engine

### P2
- Build report generation backend
- Industry-specific UI customization
- Recover missing Edge Functions
