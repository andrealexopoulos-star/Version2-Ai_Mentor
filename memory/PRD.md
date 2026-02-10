# BIQC (Business IQ Centre) - Product Requirements Document

## Original Problem Statement
Build a strategic business intelligence platform (BIQC) with:
- Persona Calibration (9-step operator psychology profiling)
- War Room (17-step business strategy extraction)
- Watchtower Engine (continuous domain-based intelligence)
- Board Room (authority interface for intelligence delivery)
- Full user lifecycle (onboarding, orientation, recalibration)

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + Supabase Edge Functions (Deno/TypeScript)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (Google/Microsoft OAuth, Email/Password)
- **AI**: OpenAI GPT-4o via Emergent LLM Key + User's own key for calibration
- **Intelligence**: Watchtower Engine (domain positions) → Board Room (authority delivery)

## What's Been Implemented

### Persona Calibration (COMPLETE)
- 9-step operator psychology profiling via `calibration-psych` Edge Function
- Stores results in `user_operator_profile` table
- Fields: communication_style, verbosity, bluntness, risk_posture, decision_style, accountability_cadence, time_constraints, challenge_tolerance, boundaries

### War Room (COMPLETE)
- 17-step strategic business interrogation at `/war-room` and embedded in `/advisor`
- Backend: `POST /api/calibration/brain` with `WATCHTOWER_BRAIN_PROMPT`
- Stores completion in `business_profiles.calibration_status`

### Watchtower Engine V2 (COMPLETE — Feb 9, 2026)
- Continuous business intelligence authority
- Backend: `/app/backend/watchtower_engine.py`
- Tables: `observation_events`, `watchtower_insights`
- Column: `business_profiles.intelligence_configuration`
- API Endpoints:
  - `POST /api/watchtower/emit` — integrations emit observation events
  - `POST /api/watchtower/analyse` — trigger analysis cycle
  - `GET /api/watchtower/positions` — read current domain positions
  - `GET /api/watchtower/findings` — read historical findings
- Domains: finance, sales, operations, team, market
- Positions: STABLE → ELEVATED → DETERIORATING → CRITICAL
- Features: window-based evaluation, trend detection, cognitive weighting, silence detection, drift/recovery detection

### Board Room (COMPLETE — Feb 9, 2026)
- Authority execution mode interface at `/board-room`
- Backend: `POST /api/boardroom/respond`
- Prompt builder: `/app/backend/boardroom_prompt.py`
- Frontend: `/app/frontend/src/components/BoardRoom.js`
- Priority order: Watchtower State → Intelligence Config → Calibration → User Message
- Response format: Position → Evidence → Trajectory → Decision Window
- Rules: no hedging, no options, no bullet lists, silence is valid

### Auth & Routing (COMPLETE)
- Redirect loop fixed via `get-calibration-status` Edge Function
- Calibration-first gating in `SupabaseAuthContext.js`
- Protected routes with deterministic state machine

## Database Schema

### Key Tables
| Table | Purpose |
|-------|---------|
| `user_operator_profile` | Persona calibration data, lifecycle flags |
| `business_profiles` | Business data, calibration_status, intelligence_configuration |
| `observation_events` | Raw signals from integrations (NEW) |
| `watchtower_insights` | Domain positions and findings (NEW) |
| `cognitive_profiles` | Behavioral models, delivery preferences |
| `chat_history` | Advisor conversations |
| `users` | User profiles |
| `outlook_oauth_tokens` | Microsoft OAuth tokens |
| `outlook_emails` | Synced emails |
| `gmail_connections` | Gmail OAuth |

## Key API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/boardroom/respond` | POST | Board Room authority response |
| `/api/watchtower/emit` | POST | Emit observation event |
| `/api/watchtower/analyse` | POST | Trigger analysis cycle |
| `/api/watchtower/positions` | GET | Read domain positions |
| `/api/watchtower/findings` | GET | Read historical findings |
| `/api/calibration/brain` | POST | War Room interrogation |
| `/functions/v1/calibration-psych` | POST | Persona calibration |
| `/functions/v1/get-calibration-status` | GET | Auth-safe status check |

## Prioritized Backlog

### P0 - IN PROGRESS
- [ ] Post-Calibration Handoff Screen
- [ ] First-Time Orientation Tour
- [ ] Intelligence Enablement Screen

### P1 - HIGH PRIORITY
- [ ] Agent Recalibration Flow (from Settings)
- [ ] Integration emission layer (integrations → observation_events)
- [ ] Scheduled Watchtower analysis (cron/periodic)

### P2 - MEDIUM PRIORITY
- [ ] Mobile keyboard fix verification
- [ ] Board Room sidebar navigation link
- [ ] Board Room in DashboardLayout

### P3 - BACKLOG
- [ ] Google Calendar integration
- [ ] Gmail intelligence emission
- [ ] CRM integrations
- [ ] Backend refactoring (break down server.py)

## Credentials
- **Test Account**: andrewrx@hotmail.com / KooksMou06**
- **App URL**: https://boardroom-console.preview.emergentagent.com

---
*Last Updated: February 9, 2026*
