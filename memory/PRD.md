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
| Onboarding progress | `user_operator_profile.operator_profile.onboarding_state` |
| Auth session | Supabase SDK (`biqc-auth` key) |
| Intelligence state | Watchtower tables (`watchtower_insights`, `observation_events`) |
| Known facts | `user_operator_profile.operator_profile.fact_ledger` + resolved from all sources |

## What's Been Implemented

### Adversarial Validation & Critical Fix (Feb 11, 2026)
- **CRITICAL FIX**: `maybeSingle()` → `maybe_single()` in 17 occurrences across `server.py` and `fact_resolution.py`. The Supabase Python client v2.27.2 uses snake_case. All prior camelCase calls threw silent exceptions, causing `/api/calibration/status` to return `NEEDS_CALIBRATION` for ALL users.
- **CalibrationAdvisor RLS Fix**: Replaced client-side `supabase.from('user_operator_profile')` query (blocked by RLS) with backend API call `GET /api/calibration/status` (uses service_role key).
- **Validation Result**: 19/19 API tests passed. Login → /advisor routing works. /calibration redirects calibrated users. Admin access denied for non-admin. Facts resolve and persist correctly.

### Global Fact Authority (COMPLETE — Feb 10, 2026)
- Three-layer resolution: Supabase tables → integration data (confidence >= 0.75) → fact ledger
- Zero-bypass enforcement: All AI prompt paths inject resolved facts
- `format_advisor_brain_prompt` uses "Not yet known" (not "ASK THEM")
- Business DNA and Settings pages use `/api/business-profile/context` with `resolved_fields`

### Onboarding State Fix (COMPLETE — Feb 10, 2026)
- Authoritative source: `user_operator_profile.operator_profile.onboarding_state`
- Single fetch per session, cached in React context
- No auto-complete, anti-regression on step

### Calibration Write Unification (COMPLETE — Feb 10, 2026)
- All completion paths write to `user_operator_profile.persona_calibration_status`

### Data-Plane Remediation (COMPLETE — Feb 10, 2026)
- MongoDB decommissioned, shadow state removed, profile read priority fixed

### Admin Access Control (COMPLETE — Feb 10, 2026)
- ProtectedRoute enforces `adminOnly` via backend API, AccessDenied screen

## Key API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/calibration/status` | GET | Reads `user_operator_profile.persona_calibration_status` ONLY |
| `/api/business-profile/context` | GET | Profile + resolved_fields + onboarding + baseline |
| `/api/facts/resolve` | GET | All known facts from Global Fact Authority |
| `/api/facts/confirm` | POST | Persist confirmed fact |
| `/api/onboarding/status` | GET | Onboarding completion state |
| `/api/onboarding/save` | POST | Save progress + persist to fact_ledger |
| `/api/boardroom/respond` | POST | Board Room with resolved facts injected |
| `/api/watchtower/emit` | POST | Emit observation event |
| `/api/watchtower/analyse` | POST | Trigger analysis cycle |

## Prioritized Backlog
- [ ] Modularize `server.py` (~10K lines into domain modules)
- [ ] Remove 15 dead routes without sidebar navigation
- [ ] Add Board Room/War Room back-navigation
- [ ] Unify UI/UX with eco-cyberpunk aesthetic
- [ ] Clean up zombie files (165+ markdown files)

## Credentials
- **Test Account**: andrewrx@hotmail.com / TestBIQC2026!
- **Test Account UUID**: 361086fe-8a9b-43bf-ab3d-8793541a47fd
- **App URL**: https://boardroom-console.preview.emergentagent.com

---
*Last Updated: February 11, 2026*
