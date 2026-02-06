# BIQc FULL-STACK AUDIT — TECHNICAL BRIEF

Prepared by Lead Systems Architect | Platform Audit for Orchestrator Visibility

---

## 1. COMPONENT MAP — Page Routes & Functional Readiness

Route | Page | Readiness | Architecture | Notes
--- | --- | --- | --- | ---
/ | LandingIntelligent | 90% | New | Production-ready
/login-supabase | LoginSupabase | 85% | New | Working, token verification intermittent
/register-supabase | RegisterSupabase | 85% | New | Working
/auth/callback | AuthCallbackSupabase | 80% | New | Fixed field mismatch, URL depends on platform config
/calibration | CalibrationAdvisor | 85% | New | AI conversational layer, fail-soft Q1-Q9, defer flow
/advisor | AdvisorWatchtower | 70% | New | Post-calibration activation, needs email integration data
/soundboard | MySoundBoard | 75% | New | Voice chat + text, working
/business-profile | BusinessProfile | 60% | Mixed | Autofill/build features, some legacy patterns
/settings | Settings | 70% | Mixed | Agent Calibration indicator added
/integrations | Integrations | 65% | Mixed | Merge.dev + Outlook/Gmail, manual test required
/connect-email | ConnectEmail | 60% | Mixed | OAuth flow works, callback handling fragile
/email-inbox | EmailInbox | 50% | Legacy-heavy | Depends on Outlook sync worker
/calendar | CalendarView | 40% | Legacy-heavy | Outlook calendar, minimal functionality
/diagnosis | Diagnosis | 30% | Legacy | Not in nav, largely unused
/analysis | Analysis | 40% | Legacy | Not in nav, parser fixed but underused
/market-analysis | MarketAnalysis | 25% | Legacy | Not in nav, backup file exists
/sop-generator | SOPGenerator | 30% | Legacy | Not in nav
/data-center | DataCenter | 40% | Legacy | File upload, not in nav
/documents | Documents | 35% | Legacy | Not in nav
/oac | OpsAdvisoryCentre | 45% | Legacy | Not in nav, "Why?" dropdown implemented
/intel-centre | IntelCentre | 30% | Legacy | Minimal
/admin | AdminDashboard | 50% | Mixed | In nav for master account
/pricing | Pricing | 80% | New | Static, production-ready
/terms | TermsAndConditions | 80% | New | Static

Orphaned routes (in App.js but NOT in sidebar nav): /oac, /outlook-test, /gmail-test, /diagnosis, /analysis, /market-analysis, /sop-generator, /data-center, /documents, /onboarding, /onboarding-decision, /profile-import, /advisor-legacy, /auth-debug

---

## 2. STATE & LOGIC — Source of Truth

State Management: React Context only (SupabaseAuthContext.js). No Zustand, no Redux.

Calibration Source of Truth:

- Backend: business_profiles.calibration_status column in Supabase. Values: incomplete, in_progress, deferred, complete
- API: GET /api/calibration/status returns { status, mode }. Mode: INCOMPLETE or DEFERRED
- Frontend: authState (LOADING / NEEDS_CALIBRATION / READY / ERROR) + calibrationMode (INCOMPLETE / DEFERRED / null) stored in SupabaseAuthContext
- Guard: ProtectedRoute.js reads both values. Only NEEDS_CALIBRATION + calibrationMode !== DEFERRED forces /calibration

Auth Flow: Supabase OAuth (Google/Microsoft) → onAuthStateChange → bootstrap calls /api/calibration/status → sets authState + calibrationMode → ProtectedRoute decides routing

Known Auth Issue: supabase_admin.auth.get_user(token) intermittently rejects valid Supabase JWTs with "malformed: invalid number of segments". Backend get_current_user_from_request is the single auth path for all calibration endpoints.

---

## 3. THE ZOMBIE LIST

### Frontend — Dead Files (safe to delete)

- Analysis.backup.js
- BusinessProfile.old.js
- IntegrationsOld.js
- Landing.js.backup
- Landing_WORLDCLASS_BACKUP.js (318 lines)
- MarketAnalysis.backup.js
- Dashboard.js (route just redirects to /advisor)
- Landing.js (replaced by LandingIntelligent.js)
- Advisor.js (replaced by AdvisorWatchtower.js)
- AuthDebug.js (debug tool, not for production)

### Frontend — Unused Components

- ContextDebugPanel.js — debug tool, not rendered
- DegradedIntelligenceBanner.js — removed from DashboardLayout
- OnboardingGate.js — legacy onboarding, replaced by calibration

### Frontend — Legacy Pages (routed but not in nav, no user path)

- OnboardingDecision.js, OnboardingWizard.js, ProfileImport.js — replaced by CalibrationAdvisor
- OutlookTest.js, GmailTest.js — test pages
- Diagnosis.js, Analysis.js, MarketAnalysis.js, SOPGenerator.js, DataCenter.js, Documents.js, DocumentView.js, OpsAdvisoryCentre.js, IntelCentre.js — orphaned from nav

### Frontend — Questionable Dependencies

- @react-oauth/google — wraps entire app but Supabase handles OAuth natively. Likely dead code.
- cra-template — CRA scaffold artifact
- next-themes — no Next.js in use
- react-day-picker, embla-carousel-react, input-otp, react-resizable-panels — verify usage

### Backend — Dead Files (safe to delete)

- cognitive_core_mongodb_backup.py
- check_mongodb_data.py
- check_supabase_user.py
- cleanup_mongodb.py
- mongodb_removal_patch.py
- run_migration.py
- migrate_emails_to_supabase.py
- list_users.py
- server.py.backup, server.py.backup_sedfix, server.py.pre_final_migration
- cognitive_core.py (1163 lines — MongoDB version, replaced by cognitive_core_supabase.py)
- truth_engine.py, truth_engine_rpc.py — verify if still called

### Backend — MongoDB Remnants

- from motor.motor_asyncio import AsyncIOMotorClient — still imported in server.py line 7
- db = client[os.environ["DB_NAME"]] — still initialized at line 155
- MongoDB running via supervisor but almost nothing uses it

---

## 4. AGENT LOGIC — Prompt Inventory

24 hardcoded "You are..." prompts across server.py. No external prompt management system.

### Prompt Sources

Location | Identity | Context
--- | --- | ---
biqc_constitution_prompt.py | BIQC Constitution | Injected into all system prompts
server.py:1070 | "You are MyAdvisor" | General chat — LEGACY NAMING
server.py:1348 | "You are MyAdvisor (proactive)" | Proactive advisory — LEGACY NAMING
server.py:1469 | "You are MyIntel" | Intelligence/signal detection — LEGACY NAMING
server.py:1596 | "Chief of Strategy" | OAC recommendations
server.py:2916 | "You are BIQC (calibration)" | Calibration 3-beat responses — NEW
server.py:2959 | "You are BIQC (activation)" | Post-calibration activation — NEW
server.py:4499 | "strategic business advisor" | Email priority analysis
server.py:4655 | "You are BIQC (email reply)" | Email reply generation
server.py:4772 | "You are MySoundBoard" | SoundBoard chat — LEGACY NAMING
server.py:7279 | "ELITE AI Business Mentor" | OAC generation — HALLUCINATION RISK

### Hallucination Risks

1. server.py:7279 — "ELITE AI Business Mentor" — superlative language encourages overconfident outputs
2. server.py:1070 — MyAdvisor prompt has no grounding constraints for factual claims
3. server.py:1596 — "Chief of Strategy" has no uncertainty calibration
4. No prompt versioning — all prompts are inline strings, no audit trail
5. Legacy naming inconsistency — "MyAdvisor"/"MyIntel"/"MySoundBoard" vs "BIQC" in newer prompts

---

## 5. THE BACKLOG

### RED — Critical Bugs

1. Supabase token verification — get_user(token) fails with "malformed JWT" for some valid tokens. Root cause unknown, possibly supabase-py SDK version or token format mismatch.
2. Environment variable reversion — REACT_APP_BACKEND_URL overridden by Emergent Platform Dashboard on deploy. User must manually set in platform dashboard.

### ORANGE — Known Issues

3. Google Drive/OneDrive — Connect button reported non-functional (user verification pending)
4. PostgREST schema cache — calibration_status, context_type, target_country, analysis_type columns intermittently not found. Requires NOTIFY pgrst, 'reload schema' in Supabase SQL editor.
5. Service worker caching — PWA service worker may serve stale JS bundles after deploy

### YELLOW — Tech Debt (blocking Innovation Status)

6. server.py is 9,393 lines — needs decomposition into route modules
7. MongoDB still imported and initialized — motor client imported, db object created, supervisor runs mongodb. Zero functional dependency remains.
8. 24 inline hardcoded prompts — no prompt registry, no versioning, no A/B testing capability
9. Legacy naming — "MyAdvisor"/"MyIntel"/"MySoundBoard" in prompts while UI says "BIQC"/"Watchtower"/"SoundBoard"
10. cognitive_core.py (MongoDB) still exists alongside cognitive_core_supabase.py — 1163 lines of dead code
11. 15+ orphaned page routes consuming bundle size with no user path to them
12. No error monitoring — no Sentry or equivalent
13. No test coverage — test files exist in /app/backend/tests/ but are endpoint-specific, no unit tests

### BLUE — Pending Feature Tasks

14. Connect calibration data (intelligence_priorities) to intelligence_automation_worker
15. Implement weekly check-in agent based on progress_cadence table
16. Restore "Business Diagnosis" page using Supabase data
17. Add more intelligence patterns to Watchtower
18. Complete MongoDB elimination (remove import, stop supervisor service)

### Supabase Tables in Use (21)

advisory_log, analyses, business_profiles, business_profiles_versioned, calibration_schedules, calibration_sessions, chat_history, data_files, dismissed_notifications, documents, gmail_connections, integration_accounts, intelligence_priorities, m365_tokens, outlook_emails, outlook_oauth_tokens, progress_cadence, soundboard_conversations, strategy_profiles, users, working_schedules

---

END OF BRIEF
