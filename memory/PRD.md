# BIQc Platform — PRD

## Implemented 2026-02-23 (Latest)

### Calibration Overhaul — Liquid Steel Theme
- Full dark theme applied to ALL calibration components: CalibratingSession, CalibrationComponents, WowSummary, ExecutiveReveal, ContinuitySuite
- Removed ALL spinners — replaced with branded BIQc pulse animations and "thinking..." text
- Multiple choice options with radio-style selection UI (orange highlight on select)
- Step indicators with labels (Communication Style, Detail Level, Directness, etc.)
- Executive Summary at completion: shows Decision Style, Risk Posture, Communication, Focus Area cards
- Progress bar with individual step markers

### First-Login Notification
- FirstLoginNotification component shows on first login
- Prompts user to connect Email (Outlook/Gmail) and Integrations (Xero, HubSpot, CRM)
- Auto-dismisses after 30 seconds, persists dismiss state in localStorage

### Floating Soundboard on All Intelligence Pages
- FloatingSoundboard widget on: BIQc Insights, Revenue, Operations, Risk, Compliance, Market
- Bottom-right lightbulb button → expandable chat panel
- Quick-start suggestion buttons, uses /api/soundboard/chat backend

### Financial Data Pipeline
- 4 backend endpoints: /api/integrations/accounting/{invoices,payments,transactions,summary}
- Provider-agnostic — works with ANY Merge.dev accounting integration
- Revenue page fetches both CRM deals AND accounting summary in parallel

### Zero Spinners Policy
- All animate-spin removed from: ProtectedRoute, CognitiveLoadingScreen, InitiatingBIQC, all calibration components, AdvisorWatchtower

### Priority Inbox + Alert Actions
- Priority Inbox added to sidebar under Execution
- Complete/Ignore buttons on all alert items

## Pending
- Deploy Supabase Edge Function financial data code (/app/memory/EDGE_FUNCTION_FINANCIAL_DATA.js)
- Wire Complete/Ignore alert actions to backend persistence
- Business DNA page under Settings (auto-populated from calibration)
