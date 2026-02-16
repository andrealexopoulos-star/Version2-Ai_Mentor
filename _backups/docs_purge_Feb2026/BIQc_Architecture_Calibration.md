# BIQc Platform — Architecture & Calibration System
## Internal Technical Document
### Date: 8 February 2026

---

## 1. Platform Overview

BIQc (Business Intelligence Quotient Centre) is an AI-powered business intelligence platform that continuously monitors business activity and surfaces what matters. The platform has two core calibration systems that work in sequence to personalise the experience.

---

## 2. The Two Calibration Systems

### 2.1 Persona Calibration (Operator Psychology)

**Purpose:** Understand HOW the operator (human) thinks, communicates, and makes decisions.

**Implementation:** Supabase Edge Function (`calibration-psych`)

**Endpoint:** `POST /functions/v1/calibration-psych`

**Auth:** Supabase JWT (ES256) — JWT verification disabled at platform level, verified internally via `supabase.auth.getUser()`

**AI Model:** OpenAI GPT-4o via Responses API with structured JSON outputs

**Secret:** `Calibration-Psych` (Supabase Edge Function secret containing OpenAI API key)

**Database Table:** `user_operator_profile`
- `user_id` (UUID, references auth.users)
- `operator_profile` (JSONB — accumulated answers)
- `agent_persona` (JSONB — generated on completion)
- `agent_instructions` (TEXT — system prompt fragment)
- `persona_calibration_status` (TEXT — incomplete/in_progress/complete)
- `prev_response_id` (TEXT — OpenAI multi-turn continuity)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**9 Steps:**

| Step | Field                    | What It Captures                              |
|------|--------------------------|-----------------------------------------------|
| 1    | communication_style      | Bullets, narrative, data-first, conversational |
| 2    | verbosity                | Minimal, moderate, comprehensive               |
| 3    | bluntness                | Blunt, balanced, diplomatic                    |
| 4    | risk_posture             | Conservative, moderate, aggressive             |
| 5    | decision_style           | Gut-instinct, data-driven, consensus, hybrid   |
| 6    | accountability_cadence   | Daily, weekly, ad-hoc, milestone-based         |
| 7    | time_constraints         | Always-rushed, moderate, has-breathing-room    |
| 8    | challenge_tolerance      | Challenge-me, balanced, support-me             |
| 9    | boundaries               | Off-limits topics, tones, approaches           |

**On Completion:**
- Generates `agent_persona` — JSON object describing ideal AI personality (tone, pacing, directness, formality)
- Generates `agent_instructions` — plain-text system prompt fragment for all AI agents to prepend
- Sets `persona_calibration_status = 'complete'`
- User is redirected to `/advisor` dashboard

**Output Contract (per turn):**
```json
{
  "message": "string",
  "status": "IN_PROGRESS | COMPLETE",
  "step": 1-9,
  "percentage": 0-100,
  "captured": { "field": "string|null", "value": "string|null" },
  "agent_persona": "object|null",
  "agent_instructions": "string|null"
}
```

**JSON Schema Enforcement:** OpenAI Responses API with `strict: true` flat schema. All fields are `string|null` to comply with OpenAI's strict mode requirements (no untyped or nested objects without `additionalProperties: false`).

**Step Tracking:** Computed deterministically from `operator_profile` — counts how many of the 9 fields are filled. No `current_step` column needed.

---

### 2.2 War Room (Business Strategic Map)

**Purpose:** Understand WHAT the business is, what it does, and what to monitor.

**Implementation:** FastAPI backend endpoint

**Endpoint:** `POST /api/calibration/brain`

**Auth:** Supabase JWT via FastAPI `get_current_user_from_request()`

**AI Model:** OpenAI GPT-4o via Emergent LLM integration (`LlmChat`)

**AI Agent Identity:** BIQc-02, "Senior Strategic Architect"

**Database Table:** `business_profiles` (existing Supabase table)

**17-Point Strategic Map:**

| #  | Field              | What It Captures                    |
|----|--------------------|-------------------------------------|
| 1  | Identity           | Business name, industry             |
| 2  | Current Stage      | Startup, growth, mature, etc.       |
| 3  | Location           | Where they're based                 |
| 4  | Website URL        | Digital presence                    |
| 5  | Target Market      | Who they sell to                    |
| 6  | Business Model     | How they make money                 |
| 7  | Geographic Focus   | Where they operate                  |
| 8  | Products/Services  | What they sell                      |
| 9  | Differentiation    | What makes them unique              |
| 10 | Pricing Strategy   | How they charge                     |
| 11 | Team Size          | How big they are                    |
| 12 | Founder Context    | Who's behind it                     |
| 13 | Team Gaps          | Missing capabilities                |
| 14 | Mission            | Why they exist                      |
| 15 | Vision             | Where they're headed                |
| 16 | Current Obstacles  | What's blocking them                |
| 17 | Strategic Goals    | What success looks like             |

**AI Behaviour:**
- Leads the conversation (user follows)
- Asks ONE targeted question per turn
- Rejects off-topic diversions
- Tracks progress deterministically
- On completion: sets `calibration_status = 'complete'` in `business_profiles`

**Output Contract (per turn):**
```json
{
  "message": "string",
  "status": "IN_PROGRESS | COMPLETE",
  "current_step_number": 1-17,
  "percentage_complete": 0-100
}
```

---

## 3. User Journey Flow

```
┌─────────────────────────────────────────────────┐
│                    LOGIN                         │
│  Email/Password or Google/Microsoft OAuth        │
│  (Supabase Auth with ES256 JWTs)                │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│         PERSONA CALIBRATION (/calibration)       │
│                                                  │
│  "Before I can advise you, I need to understand  │
│   how you operate."                              │
│                                                  │
│  9 questions about operator psychology           │
│  One question per turn                           │
│  Progress bar: step X of 9                       │
│  No skip button — mandatory first time           │
│  Back arrow to revisit previous steps            │
│                                                  │
│  On complete:                                    │
│  → Thank you screen                              │
│  → "Your AI advisor is now tuned to your style"  │
│  → Auto-redirect to /advisor                     │
│                                                  │
│  Edge Function: calibration-psych                │
│  Table: user_operator_profile                    │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│          ADVISOR DASHBOARD (/advisor)            │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │  WAR ROOM (top section, 500px)          │    │
│  │  Black & amber tactical terminal UI     │    │
│  │  17-point strategic map conversation    │    │
│  │  "Full Screen" button → /war-room       │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │  WATCHTOWER (below)                     │    │
│  │  Intelligence events from monitoring    │    │
│  │  "Run Analysis" for cold-read           │    │
│  │  Events grouped by domain              │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  Sidebar: BIQc Insights | War Room | SoundBoard │
└─────────────────────────────────────────────────┘
```

---

## 4. Comparison Table

| Dimension              | Persona Calibration          | War Room                        |
|------------------------|------------------------------|---------------------------------|
| **About**              | The operator (human)         | The business                    |
| **Question count**     | 9                            | 17                              |
| **Question type**      | Psychology / preferences     | Business strategy / operations  |
| **AI identity**        | Calibration Agent            | BIQc-02 Strategic Architect     |
| **Endpoint**           | Supabase Edge Function       | FastAPI backend                 |
| **AI model**           | GPT-4o (Responses API)       | GPT-4o (Emergent LLM)          |
| **Database table**     | user_operator_profile        | business_profiles               |
| **Output**             | agent_persona + instructions | Strategic map for monitoring    |
| **Purpose**            | How to TALK to this person   | What to WATCH for this business |
| **Mandatory**          | Yes (first login)            | Available on /advisor           |
| **UI style**           | Dark gradient chat           | Black & amber tactical terminal |

---

## 5. Technical Architecture

```
Frontend (React)
├── /login-supabase          → LoginSupabase.js
├── /calibration             → CalibrationAdvisor.js
│                               Calls: Supabase Edge Function
├── /advisor                 → AdvisorWatchtower.js
│                               Contains: War Room (top) + Watchtower (below)
├── /war-room                → Full-screen WarRoomConsole.js
│                               Calls: POST /api/calibration/brain
└── /soundboard, /settings, etc.

Backend (FastAPI)
├── POST /api/calibration/brain     → War Room AI conversation
├── POST /api/calibration/status    → Legacy calibration check
├── POST /api/calibration/defer     → Legacy defer (being phased out)
├── GET  /api/intelligence/watchtower → Watchtower events
└── GET  /api/auth/check-profile    → Profile rehydration

Supabase
├── Edge Function: calibration-psych  → Persona Calibration
├── Table: user_operator_profile      → Operator psychology data
├── Table: business_profiles          → Business strategic data
├── Table: auth.users                 → Authentication
└── Auth: Google/Microsoft OAuth + Email/Password (ES256 JWTs)

External
├── OpenAI GPT-4o (Responses API)  → Persona Calibration structured outputs
├── OpenAI GPT-4o (Emergent LLM)   → War Room conversation
└── Supabase Auth                   → JWT issuance and verification
```

---

## 6. Auth Flow & Route Protection

```
SupabaseAuthContext.js (bootstrap on every page load):
  1. Get session from Supabase
  2. Query user_operator_profile for persona_calibration_status
  3. If status != 'complete' → authState = NEEDS_CALIBRATION
  4. If status == 'complete' → fetch business profile → authState = READY

ProtectedRoute.js:
  - LOADING → show spinner
  - No session → redirect to /login-supabase
  - NEEDS_CALIBRATION (not deferred) → redirect to /calibration
    - Exception: /calibration, /war-room, /settings are whitelisted
  - READY or DEFERRED → render children

PublicRoute.js (wraps /login-supabase, /register-supabase):
  - If authenticated → redirect to /advisor
```

---

## 7. Key Decisions & Issues Resolved

1. **JWT Algorithm Mismatch:** Supabase Auth issues ES256 JWTs but Edge Function platform check expected HS256. Fixed by deploying with `--no-verify-jwt` and verifying internally via `auth.getUser()`.

2. **OpenAI Strict Schema:** OpenAI Responses API with `strict: true` rejects nested objects without explicit types and `additionalProperties: false`. Fixed by flattening schema to all `string|null` fields.

3. **Missing Table Column:** `current_step` column didn't exist in the user's Supabase table. Fixed by computing step deterministically from the count of filled fields in `operator_profile` JSONB.

4. **Service Worker Caching:** Stale `build/` directory caused deployments to serve old code. Fixed by rebuilding and cache-busting service worker.

5. **OAuth Sandbox Blocking:** `window.confirm()` in login flow was silently blocked by sandboxed iframe environment. Fixed by removing the confirmation dialog.

---

## 8. Deployment Checklist

### Supabase (manual)
- [ ] Table `user_operator_profile` exists with correct columns
- [ ] RLS policies enabled (users read/write own rows)
- [ ] Edge Function `calibration-psych` deployed with `--no-verify-jwt`
- [ ] Secret `Calibration-Psych` set with OpenAI API key
- [ ] JWT verification toggled OFF for `calibration-psych`

### Emergent (deploy button)
- [ ] Frontend production build is fresh (`yarn build`)
- [ ] Build contains `calibration-psych` Edge Function URL
- [ ] Build contains `PERSONA CALIBRATION` welcome screen
- [ ] No legacy `/api/calibration/init`, `/answer`, `/activation` references
- [ ] Service worker cache version updated

### Verification
- [ ] New user: login → /calibration → 9 steps → COMPLETE → /advisor
- [ ] Existing complete user: login → /advisor directly
- [ ] War Room visible on /advisor (top section)
- [ ] Watchtower section renders below War Room
- [ ] /war-room full-screen accessible from sidebar
- [ ] Mobile: keyboard opens on all inputs
- [ ] Calibration answers persisted in `user_operator_profile`
- [ ] agent_persona and agent_instructions generated on step 9
