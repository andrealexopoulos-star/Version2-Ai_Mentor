# BIQc Platform — PRD

## Completed 2026-02-23

### Business DNA in Sidebar
- Added Business DNA under Governance in sidebar (links to existing /business-profile page)
- Fixed spinner in BusinessProfile auto-save indicator

### Alert Actions Wired to Backend
- New endpoint: POST /api/intelligence/alerts/action (accepts alert_id + action: complete/ignore/hand-off/auto-email)
- Frontend AlertsPageAuth: Complete/Ignore buttons now call backend, visually mark alerts as actioned
- Logs actions to alert_actions table in Supabase

### Calibration — Full Liquid Steel Theme
- All calibration components themed: CalibratingSession, CalibrationComponents, WowSummary, ExecutiveReveal, ContinuitySuite
- Zero spinners — all replaced with branded animations
- Executive Summary at completion with Decision Style, Risk Posture, Communication, Focus Area cards

### First-Login Notification
- Prompts email + integration connection on first login

### Floating Soundboard
- On all 6 Intelligence pages

### Financial Data Pipeline
- 4 accounting endpoints via Merge.dev
- Edge Function code at /app/memory/EDGE_FUNCTION_FINANCIAL_DATA.js

### Sidebar Structure
- Intelligence: BIQc Insights, Revenue, Operations, Risk, Compliance, Market
- Execution: Alerts, Priority Inbox, Actions, Automations
- Systems: Integrations, Data Health
- Governance: Reports, Audit Log, Business DNA, Settings

## Pending
- Deploy Edge Function financial data code to Supabase
- Calibration intelligence: detect duplicate answers, adapt questions based on previous responses (requires Edge Function update to calibration-psych)
