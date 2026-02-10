# BIQC (Business IQ Centre) - Product Requirements Document

## Original Problem Statement
Build a strategic business intelligence platform (BIQC) — a "continuous situational awareness system" that observes signals from integrated business tools, forms opinions on business health, and presents findings with authority.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + Supabase Edge Functions (Deno/TypeScript)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (Google/Microsoft OAuth, Email/Password)
- **AI**: OpenAI GPT-4o via Emergent LLM Key
- **Intelligence Pipeline**: Emission → Watchtower → Escalation → Contradiction → Pressure → Board Room

## What's Been Implemented

### Persona Calibration (COMPLETE)
- 9-step operator psychology profiling via `calibration-psych` Edge Function
- Stores in `user_operator_profile` table
- `persona_calibration_status` is the single source of truth for calibration state

### War Room / Strategic Console (COMPLETE)
- 17-step strategic business interrogation at `/war-room`
- Backend: `POST /api/calibration/brain`

### Watchtower Engine (COMPLETE)
- Continuous domain-based intelligence: finance, sales, operations, team, market
- Positions: STABLE → ELEVATED → DETERIORATING → CRITICAL

### Board Room (COMPLETE)
- Authority execution mode at `/board-room`
- Acknowledge/Defer actions for escalations

### Intelligence Stack (COMPLETE)
- Merge Emission Layer, Escalation Memory, Contradiction Engine
- Snapshot Agent, Pressure Calibration, Confidence Decay

### Intelligence Baseline (COMPLETE)
- User configuration for monitoring domains and thresholds

### Operator Dashboard (COMPLETE)
- Read-only view of user intelligence state at `/operator`

### Onboarding & Data Coherence (COMPLETE — Feb 10, 2026)
- **Calibration State Fix**: `user_operator_profile.persona_calibration_status` is the sole calibration flag (checked first in auth context and calibration status endpoint)
- **Onboarding Wizard**: 8-step flow (Welcome → Business Identity → Website → Market → Products → Team → Goals → Preferences)
- **Business DNA Rename**: "Business Profile" → "Business DNA" in sidebar and page title
- **Auto-Population**: Onboarding answers immediately persist to `business_profiles` via field mapping
- **Website Enrichment**: `POST /api/website/enrich` scrapes URL metadata and infers business name
- **Pre-fill & Confirm**: Existing profile data pre-loaded into onboarding with "pre-filled" badges
- **Progressive Save**: Auto-save with 1.5s debounce on every field change
- **Resume**: Onboarding resumes from `last_completed_step` on page reload
- **Onboarding Gate**: ProtectedRoute redirects to `/onboarding` if not completed
- **Profile Context**: `GET /api/business-profile/context` returns profile + onboarding + baseline + calibration status

## Data Authority Rules
| Data | Source Table |
|------|-------------|
| Business identity, website, industry, products | `business_profiles` |
| Team, stage, strategy | `business_profiles` |
| Intelligence preferences | `intelligence_baseline` |
| Calibration status | `user_operator_profile.persona_calibration_status` |
| Onboarding progress | `onboarding` table |

## Key API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/calibration/status` | GET | Calibration status (user_operator_profile → business_profiles fallback) |
| `/api/onboarding/status` | GET | Onboarding completion status |
| `/api/onboarding/save` | POST | Save onboarding progress + persist to business_profiles |
| `/api/onboarding/complete` | POST | Mark onboarding complete |
| `/api/business-profile` | GET/PUT | Read/update business profile |
| `/api/business-profile/context` | GET | Full context for pre-population |
| `/api/business-profile/scores` | GET | Profile completeness scores |
| `/api/website/enrich` | POST | Scrape website metadata |
| `/api/boardroom/respond` | POST | Board Room authority response |
| `/api/watchtower/analyse` | POST | Trigger intelligence analysis |
| `/api/emission/run` | POST | Trigger emission layer |
| `/api/intelligence-baseline` | GET/POST | Intelligence configuration |
| `/api/operator/state` | GET | Operator dashboard data |
| `/api/escalation/action` | POST | Acknowledge/defer escalation |
| `/api/snapshot/generate` | POST | Generate intelligence snapshot |

## Prioritized Backlog

### P0 - Critical
- [x] Calibration state fix (single source of truth)
- [x] Onboarding flow with progressive save
- [x] Business DNA auto-population
- [ ] Modularize `server.py` (~10K lines → domain modules)

### P1 - High
- [ ] Resumable orientation overlay (post-onboarding)
- [ ] Unify UI/UX with eco-cyberpunk aesthetic
- [ ] Agent recalibration flow from Settings

### P2 - Medium
- [ ] Improve Integration UX (Merge.dev-first)
- [ ] Cleanup zombie code (165+ markdown files, backups)
- [ ] Live integration data (connect real Merge.dev sources)

### P3 - Backlog
- [ ] Add cron scheduling for intelligence analysis
- [ ] Backend refactoring into route modules
- [ ] Mobile UX improvements

## Credentials
- **Test Account UUID**: 361086fe-8a9b-43bf-ab3d-8793541a47fd
- **App URL**: https://boardroom-console.preview.emergentagent.com

---
*Last Updated: February 10, 2026*
