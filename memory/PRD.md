# BIQc Platform — Product Requirements Document

## Original Problem Statement
BIQc is a Sovereign Strategic Partner for Australian SMEs. AI-powered intelligence that only asks what it doesn't already know.

## Core Mandates
1. Data Harmony — Calibration data flows to all intelligence modules
2. Zero-Question Mandate — No redundant surveys
3. Edge-First Intelligence — Heavy AI offloaded to Edge Functions
4. Actionable Intelligence — [Read/Action/Ignore] briefs
5. Zero-Redirect Protocol — No redirect loops
6. Dynamic Gap-Filling — Only ask questions where data is NULL
7. Operational Sovereignty — 24-node sidebar fully wired to Master Schema

## What's Been Implemented

### Neural Re-Link / Sovereign Alignment (Latest)
- **24-Node Sidebar:** All 9 orphaned pages restored across 5 sections (INTELLIGENCE, ANALYSIS, TOOLS, CONFIGURATION, SETTINGS)
- **Visibility Logic:** Calibration-locked nodes (Strategic Console, Board Room, Operator View, Diagnosis) hidden until `authState === READY`
- **All Pages Functional:** Every page calls proper backend APIs with graceful empty states
- **Home Buttons:** WarRoomConsole + Watchtower have "← Dashboard" button; BoardRoom has HOME button
- **Schema Reference:** Full 53-table reference at /app/memory/SCHEMA_REFERENCE.md

### Page → Table Mapping
| Page | Primary Table(s) | API Endpoint |
|------|------------------|--------------|
| BIQc Insights | chat_history, business_profiles | /api/chat |
| Strategic Console | calibration brain, strategic_console_state | /api/calibration/brain |
| Board Room | watchtower_insights, escalation_memory | /api/boardroom/* |
| Operator View | observation_events, watchtower_events | /api/lifecycle/state |
| SoundBoard | soundboard_conversations | /api/soundboard/* |
| Diagnosis | email_priority_analysis | /api/email/priority-inbox |
| Analysis | analyses, strategy_profiles | /api/analyses |
| Market Analysis | analyses | /api/analyses |
| Intel Centre | business_profiles (scores) | /api/business-profile/scores |
| SOP Generator | sops, data_files | /api/generate/sop |
| Data Center | data_files, business_profiles | /api/data-center/* |
| Documents | documents | /api/documents |
| Email Inbox | email_connections (Supabase direct) | Edge Functions |
| Intelligence Baseline | intelligence_baseline | /api/intelligence/* |
| Business DNA | business_profiles | /api/business-profile |
| Integrations | integration_accounts, merge_integrations | /api/integrations/* |
| Email Config | outlook_oauth_tokens, gmail_connections | /api/email/* |
| Calendar | outlook_calendar_events, calendar_intelligence | /api/calendar/* |
| Settings | business_profiles, users | /api/business-profile, /api/auth/* |

### Dynamic Gap-Filling
- GET /api/calibration/strategic-audit audits 17 dimensions
- WarRoomConsole auto-advances past known dimensions
- fact_resolution.py: 3-layer authority with growth_goals, risk_profile

### Persistence Hooks
- OnboardingWizard upserts on every card selection
- POST /onboarding/complete writes strategic_console_state
- Settings Save buttons execute PUT /api/business-profile

## Backlog
### P1
- [ ] E2E calibration flow with real data
- [ ] Performance optimization
### P2
- [ ] Refactor routes/profile.py (2,000+ lines)
- [ ] Mobile responsive test
- [ ] Video call feature (not yet built)
