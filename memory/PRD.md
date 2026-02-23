# BIQc Platform — Product Requirements Document

## Original Problem Statement
Transform BIQc into a high-performance, AI-driven "Cognition-as-a-Platform" for SMBs with "Liquid Steel" dark theme.

## Architecture
- **Frontend**: React (CRA + CRACO), Tailwind CSS, Liquid Steel theme (#0F1720, #FF6A00)
- **Backend**: FastAPI + Supabase (PostgreSQL, Auth, Edge Functions)
- **Integrations**: Merge.dev (Xero, HubSpot), Google/Microsoft OAuth, OpenAI

## What's Been Implemented

### 2026-02-23: Systems Audit & Critical Fixes
- **ZERO spinners policy**: Replaced ALL spinning wheels across the app:
  - ProtectedRoute LoadingScreen → branded BIQc pulse animation with progress bar
  - CognitiveLoadingScreen → orbital animation (removed broken Lottie dependency)
  - InitiatingBIQC → branded pulse animation
  - AdvisorWatchtower refresh → static icon (no spin)
  - All new pages → "syncing..." text instead of Loader2 spinner
- **Priority Inbox added to sidebar** under Execution heading (/email-inbox)
- **Complete/Ignore buttons** added to all alert items (AdvisorWatchtower + AlertsPageAuth)
- **CheckInAlerts** fully dark-themed (was using light backgrounds)

### 2026-02-23: Live Data Integration
- Revenue, Operations, Risk, Market, Alerts, Data Health pages wired to live APIs
- Demo data fallback when APIs unavailable

### 2026-02-23: Sidebar Restructuring + 11 New Pages
- Intelligence: BIQc Insights, Revenue, Operations, Risk, Compliance, Market
- Execution: Alerts, Priority Inbox, Actions, Automations
- Systems: Integrations, Data Health
- Governance: Reports, Audit Log, Settings

### 2026-02-23: Route Migration
- Root `/` serves Liquid Steel homepage
- All routes migrated from `/site/*` to root paths

## Known Issue: Xero Data Not In Cognitive Engine
- Xero IS connected via Merge.dev but the cognitive engine (Supabase Edge Function `biqc-insights-cognitive`) doesn't ingest accounting data
- Sources show: "HubSpot CRM (30 contacts, 25 deals)" but no Xero
- FIX REQUIRED: The Edge Function needs to query Merge.dev accounting API for Xero data
- This produces the false alert: "Cash flow analysis critical due to lack of financial tool integration"

## Pending Tasks
### P0
- Deploy to production
- Fix Xero data ingestion in cognitive Edge Function
- Verify all pages render correctly on production after deploy

### P1
- Wire Complete/Ignore alert actions to backend
- Connect Actions page to actual email/SMS sending
- First-signup notification to connect email

### P2
- Build report generation backend
- Implement Soundboard capability
- Industry-specific UI customization
