# BIQC (Business IQ Centre) - Product Requirements Document

## Original Problem Statement
Build a strategic business intelligence platform (BIQC) — a "continuous situational awareness system" that observes signals from integrated business tools, forms opinions on business health, and presents findings with authority.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python) + Supabase Edge Functions (Deno/TypeScript)
- **Database**: Supabase (PostgreSQL) — SOLE authoritative datastore
- **Auth**: Supabase Auth (Google/Microsoft OAuth, Email/Password)
- **AI**: OpenAI GPT-4o via Emergent LLM Key
- **Intelligence Pipeline**: Emission → Watchtower → Escalation → Contradiction → Pressure → Board Room

## Data Authority Rules (Enforced Feb 10, 2026)
| Data Domain | Single Source of Truth |
|------------|----------------------|
| Calibration status | `user_operator_profile.persona_calibration_status` |
| Business identity | `business_profiles` (Supabase) |
| Intelligence preferences | `intelligence_baseline` (Supabase) |
| Onboarding progress | `onboarding` (Supabase) |
| Auth session | Supabase SDK (`biqc-auth` key) |
| Intelligence state | Watchtower tables (`watchtower_insights`, `observation_events`) |

**MongoDB**: Decommissioned at application level (Feb 10, 2026). Process may still run but no app code reads/writes.

## What's Been Implemented

### Audit Fixes H3, F4, F2 (COMPLETE — Feb 10, 2026)
- **H3 — User profile from DB**: `fetchUserProfile` now enriches user data from `GET /api/auth/supabase/me` (reads `users` table) for authoritative `role`, `subscription_tier`, `is_master_account`. Session metadata used as instant fallback, then overwritten with DB values.
- **F4 — DashboardLayout name fix**: Avatar initial, greeting, and dropdown now use `user?.full_name` instead of `user?.name`.
- **F2 — Save and continue later**: `deferOnboarding()` callback temporarily sets `onboardingStatus.completed = true` so `ProtectedRoute` allows `/advisor` access. Progress is saved; onboarding can be resumed later.

### Onboarding State Fix (COMPLETE — Feb 10, 2026)
- **Single fetch per session**: Onboarding status fetched ONCE during auth bootstrap in `SupabaseAuthContext`, cached in `onboardingStatus` state. `ProtectedRoute` consumes cached state — makes ZERO API calls for onboarding.
- **Auto-complete removed**: `GET /api/onboarding/status` no longer auto-marks onboarding complete based on `company_name`. Returns `completed: false` when no record exists.
- **Resumable state**: OnboardingWizard loads from `/api/business-profile/context`, resumes from `current_step`.
- **Cache update on completion**: `markOnboardingComplete()` callback updates cached state without re-fetch.

### Admin Access Control (COMPLETE — Feb 10, 2026)
- **ProtectedRoute adminOnly enforcement**: `ProtectedRoute` accepts `adminOnly` prop, calls `GET /api/auth/supabase/me` to get authoritative role from `users` table, blocks access if role not in `['admin', 'superadmin']`.
- **AccessDenied screen**: Non-admin users see "Access restricted" with "Return to Dashboard" link.
- **Backend enforcement**: `get_admin_user` dependency accepts `admin` and `superadmin` roles, returns 403 otherwise.
- **Double enforcement**: Both frontend (ProtectedRoute) and backend (get_admin_user) independently verify admin role.

### Calibration Write Unification (COMPLETE — Feb 10, 2026)
- **All completion paths now write to `user_operator_profile`**: `calibration/brain` (War Room), `calibration/answer` (legacy 9-step), and `calibration-psych` Edge Function all write `persona_calibration_status = 'complete'` to `user_operator_profile`.
- **calibration/defer** writes `persona_calibration_status = 'deferred'` to `user_operator_profile`.
- **calibration/init** cleaned: no longer references non-existent `calibration_status` column.
- **Backfill endpoint**: `POST /api/admin/backfill-calibration` for migrating any missed users.
- **Discovery**: `business_profiles.calibration_status` column does NOT exist in Supabase schema. All previous writes to it were silently failing.

### Data-Plane Remediation (COMPLETE — Feb 10, 2026)
- **Calibration Source Alignment**: `/api/auth/check-profile` and `/api/calibration/status` read ONLY from `user_operator_profile.persona_calibration_status`. All legacy `business_profiles.calibration_status` reads removed.
- **MongoDB Decommission**: `motor` import removed, no MongoDB client initialization on startup. App boots without MongoDB.
- **Shadow State Removal**: Removed `biqc_context_v1`, `biqc_intelligence_state`, `biqc_focus_history` from localStorage. Removed dead React context state (`businessContext`, `contextLoading`, `contextError`, `contextSource`, `onboardingState`, `calibrationMode`). Removed legacy `token` fallback from api.js, VoiceChat.js, Integrations.js, ConnectEmail.js.
- **Profile Read Priority**: `GET /business-profile` reads from `business_profiles` directly. `business_profiles_versioned` used for history only.

### Onboarding & Data Coherence (COMPLETE — Feb 10, 2026)
- 8-step onboarding wizard with progressive save
- Business DNA rename and auto-population
- Website enrichment endpoint
- Pre-fill from existing profile data

### Intelligence Stack (COMPLETE)
- Watchtower Engine, Board Room, Escalation Memory, Contradiction Engine
- Snapshot Agent, Pressure Calibration, Confidence Decay
- Intelligence Baseline configuration, Operator Dashboard

### Persona Calibration (COMPLETE)
- 9-step profiling via `calibration-psych` Edge Function
- Stores in `user_operator_profile`

## Key API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/calibration/status` | GET | Reads `user_operator_profile.persona_calibration_status` ONLY |
| `/api/auth/check-profile` | GET | Reads `user_operator_profile.persona_calibration_status` ONLY |
| `/api/business-profile` | GET/PUT | Reads/writes `business_profiles` (authoritative) |
| `/api/business-profile/context` | GET | Full context for pre-population |
| `/api/business-profile/scores` | GET | Calculates from `business_profiles` |
| `/api/onboarding/save` | POST | Saves to `onboarding` + `business_profiles` |
| `/api/website/enrich` | POST | Scrapes website metadata |
| `/api/boardroom/respond` | POST | Board Room authority response |
| `/api/watchtower/analyse` | POST | Trigger intelligence analysis |

## Prioritized Backlog

### P0 - Critical
- [x] Calibration source alignment (single source of truth)
- [x] MongoDB decommission (application level)
- [x] Shadow state removal
- [x] Profile read priority fix
- [ ] Modularize `server.py` (~10K lines → domain modules)

### P1 - High
- [ ] Resumable orientation overlay (post-onboarding)
- [ ] Unify UI/UX with eco-cyberpunk aesthetic
- [ ] Agent recalibration flow from Settings

### P2 - Medium
- [ ] Improve Integration UX (Merge.dev-first)
- [ ] Cleanup zombie code (165+ markdown files, backups, dead components like ContextDebugPanel)
- [ ] Live integration data (connect real Merge.dev sources)

### P3 - Backlog
- [ ] Add cron scheduling for intelligence analysis
- [ ] Backend refactoring into route modules

## Credentials
- **Test Account UUID**: 361086fe-8a9b-43bf-ab3d-8793541a47fd
- **App URL**: https://boardroom-console.preview.emergentagent.com

---
*Last Updated: February 10, 2026*
