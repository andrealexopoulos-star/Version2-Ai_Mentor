# BIQc Platform — Full Technical Audit
## Supabase Edge Functions + SQL Migrations + Tech Debt
**Audit Date:** March 2026  
**Auditors:** QA Agent + UX Agent (combined report)

---

## PART 1 — SUPABASE EDGE FUNCTIONS

### Summary
| Status | Count |
|---|---|
| Active & working (code exists, called from frontend) | 10 |
| Active but MISSING from repo (called but no code) | 2 ⚠️ |
| In repo but orphaned (never called) | 3 |
| Duplicate / dead | 1 |
| Admin-only (not user-facing) | 3 |
| **Total in repo** | **18** |

---

### ACTIVE EDGE FUNCTIONS (Called from frontend, code exists)

---

#### 1. `biqc-insights-cognitive` ⚡ CRITICAL
**What it does:** Main AI intelligence engine. Generates the cognitive snapshot — executive briefing, propagation map, risk scores, instability indices across all 6 intelligence domains.  
**Called from:**
- `App.js` — fires on app load (cold start)
- `FloatingSoundboard.js` — generates AI context for chat
- `useCalibrationState.js` — final step after calibration completes
- `useSnapshot.js` — all intelligence snapshot triggers
- `MarketPage.js` — market intelligence generation
- `AdminDashboard.js` — admin testing
**Platform impact:** ☠️ HIGHEST IMPACT. If this fails, the entire intelligence engine is dead — no snapshots, no advisor briefings, no market analysis, no calibration completion.  
**Required secrets:** `OPENAI_API_KEY`, `MERGE_API_KEY`, `PERPLEXITY_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`  
**Working status:** ✅ Code exists. Depends on all 4 secrets being set in Supabase vault. `MERGE_API_KEY` and `PERPLEXITY_API_KEY` are optional (degrades gracefully without them).

---

#### 2. `boardroom-diagnosis`
**What it does:** Generates a full boardroom-level strategic diagnosis — scenario analysis, risk quantification, strategic priorities — using all business data.  
**Called from:**
- `BoardRoom.js` component — `/boardroom` or `/war-room` page
- `AdminDashboard.js` — admin testing
**Platform impact:** Moderate. Powers the Boardroom/War Room strategic analysis feature. Silent failure if not deployed.  
**Required secrets:** `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`  
**Working status:** ✅ Code exists. Needs OPENAI_API_KEY in Supabase secrets.

---

#### 3. `business-identity-lookup`
**What it does:** ABN/ACN lookup using the free Australian Business Register (ABR) JSON API. Resolves legal business identity during onboarding calibration — pulls business name, entity type, GST status, state.  
**Called from:**
- `useCalibrationState.js` — Step in onboarding to resolve ABN to business identity
**Platform impact:** Moderate. Affects onboarding quality — without it, business identity is not auto-resolved and users must type everything manually.  
**Required secrets:** None (uses free ABR public API — no key required)  
**Working status:** ✅ Code exists. No secrets needed.

---

#### 4. `calibration-business-dna`
**What it does:** Enriches business DNA during calibration — extracts identity signals, ABN/ACN patterns, website metadata, business category. V2 adds forensic verification layer.  
**Called from:**
- `useCalibrationState.js` (lines 266, 406) — two stages of DNA calibration
**Platform impact:** High. Powers the Business DNA profile that underlies all AI personalisation. Bad DNA = bad AI recommendations.  
**Required secrets:** `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`  
**Working status:** ✅ Code exists.

---

#### 5. `calibration-psych`
**What it does:** 9-step operator psychology profiling. Builds the decision-maker persona (risk tolerance, communication style, leadership archetype) using structured JSON outputs.  
**Called from:**
- `useCalibrationState.js` (line 110) — psychology calibration step
**Platform impact:** High. Defines how the AI Advisor communicates and prioritises — wrong persona = misaligned advice tone.  
**Required secrets:** `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`  
**Working status:** ✅ Code exists. Note: there is a DUPLICATE `calibration_psych` (underscore) — see orphaned section.

---

#### 6. `calibration-sync`
**What it does:** Syncs completed calibration data into the intelligence system — merges business profile, persona, DNA into a unified operator profile.  
**Called from:**
- `useCalibrationState.js` (line 132) — post-calibration sync
- `Settings.js` (line 45) — manual re-sync from settings
**Platform impact:** High. Without sync, calibration data doesn't reach the intelligence engine. AI runs on stale or empty context.  
**Required secrets:** `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`  
**Working status:** ✅ Code exists.

---

#### 7. `checkin-manager`
**What it does:** Manages weekly/periodic check-in cadences — retrieves outstanding check-in questions, records responses, tracks decision checkpoint outcomes.  
**Called from:**
- `CheckInAlerts.js` — check-in notification component
**Platform impact:** Low-medium. Powers the periodic business health check-in feature. Not on critical path for launch.  
**Required secrets:** `SUPABASE_SERVICE_ROLE_KEY`  
**Working status:** ✅ Code exists.

---

#### 8. `query-integrations-data`
**What it does:** Allows the Soundboard (AI chat) to query real data from connected Merge integrations in real-time — fetches live invoices, deals, headcount data to answer user questions.  
**Called from:**
- `FloatingSoundboard.js` (line 160) — before generating AI response
- `SoundboardPanel.js` (line 107) — before generating AI response
**Platform impact:** High for power users. Without it, Soundboard answers questions from static calibration data only, not live connected data.  
**Required secrets:** `MERGE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`  
**Working status:** ✅ Code exists. Requires MERGE_API_KEY to return real data.

---

#### 9. `strategic-console-ai`
**What it does:** Two-mode function: (1) BRIEF mode — full executive briefing from all connected data on page load; (2) CHAT mode — interactive strategic Q&A. Powers the "War Room Console" feature.  
**Called from:**
- `WarRoomConsole.js` (line 34) — main War Room interface
- `AdminDashboard.js` — admin testing
**Platform impact:** Moderate. Powers an advanced strategic console feature. Not on critical path for standard launch.  
**Required secrets:** `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`  
**Working status:** ✅ Code exists.

---

#### 10. `warm-cognitive-engine`
**What it does:** Cold start mitigation only. Fires a lightweight ping to warm the Deno runtime and pre-load secrets before heavy intelligence calls. Returns HTTP 204 — no DB writes, no output.  
**Called from:**
- `App.js` (line 143) — fires 3 seconds after app loads
**Platform impact:** Performance only. Without it, the first intelligence call after a cold start takes 3-5 seconds longer.  
**Required secrets:** None needed (just warms the runtime)  
**Working status:** ✅ Code exists.

---

#### 11. `sop-generator`
**What it does:** Generates Standard Operating Procedures from business context. AI-generated SOPs customised to industry, role, and business DNA.  
**Called from:**
- `App.js` — route check
- `Dashboard.js` — SOP widget
- `Documents.js` — document generation
- `tierResolver.js` — feature gate check
**Platform impact:** Moderate. Powers the Documents/SOP generation feature. Live in the dashboard.  
**Required secrets:** `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`  
**Working status:** ✅ Code exists.

---

### ⚠️ CRITICAL — MISSING FROM REPO (Called but no code files)

---

#### 12. `email_priority` ❌ MISSING — BREAKS PRIORITY INBOX
**What it does:** Should perform AI-powered priority triage of the user's inbox — classifies emails into high/medium/low priority, extracts action items, generates reply suggestions.  
**Called from:**
- `EmailInbox.js` (lines 131, 170) — for both Gmail and Outlook providers
**Platform impact:** ☠️ **THIS IS WHY PRIORITY INBOX IS BLANK.** The Priority Inbox page calls this function, gets a non-200 response, and silently shows nothing. Users with Gmail or Outlook connected see an empty inbox screen.  
**Required secrets:** `OPENAI_API_KEY`, Gmail/Outlook tokens  
**Working status:** ❌ **DOES NOT EXIST IN REPO.** Must be built and deployed to Supabase.  
**Action required:** Build + deploy the `email_priority` edge function.

---

#### 13. `gmail_prod` ❌ MISSING — BREAKS GMAIL CONNECTION CHECK
**What it does:** Should check whether Gmail is connected for the current user — returns `{ok: true, connected: true/false}`.  
**Called from:**
- `Integrations.js` (line 208) — checks Gmail connected status on page load
- `GmailTest.js` (line 49) — Gmail test page
- `AdminDashboard.js` — admin status check
**Platform impact:** High. Without this, the Integrations page cannot show Gmail as "Connected" even if the user connected it. The `isConnected` check for Gmail always returns `false`.  
**Working status:** ❌ **DOES NOT EXIST IN REPO.** Must be built and deployed.  
**Action required:** Build + deploy `gmail_prod` edge function.

---

### ORPHANED — In repo but never called

---

#### 14. `calibration_psych` ❌ DEAD DUPLICATE
**What it does:** Exact duplicate of `calibration-psych` (underscore vs hyphen naming).  
**Called from:** Nowhere.  
**Action:** Delete this function to reduce deployment confusion.

---

#### 15. `scrape-business-profile` — ORPHANED
**What it does:** Deterministic business profile scraper — extracts structured metadata from a business website (no LLM, no enrichment, HTML only). Designed as a trust-safe alternative to AI scraping.  
**Called from:** Zero frontend calls. Zero backend calls.  
**Platform impact:** None currently.  
**Status:** Could be wired to the CMO/social scraping feature. Currently completely unused.  
**Action:** Either wire to calibration flow or delete.

---

#### 16. `watchtower-brain` — ORPHANED
**What it does:** Watchtower AI brain — appears to be an early version of the watchtower intelligence engine, now superseded by the Python `watchtower_engine.py` backend module.  
**Called from:** Zero frontend calls. Zero backend calls.  
**Action:** Safe to delete — functionality replaced by backend Python module.

---

### ADMIN-ONLY (not user-facing)

---

#### 17. `cfo-cash-analysis` — ADMIN ONLY
**What it does:** CFO-level cash flow analysis — deep financial scenario modelling, runway projections, burn rate analysis.  
**Called from:** `AdminDashboard.js` only.  
**Status:** Admin testing tool. Not wired to any user-facing page.

#### 18. `competitor-monitor` — ADMIN ONLY
**What it does:** Monitors competitor activity — tracks pricing changes, product updates, market movements using external data sources.  
**Called from:** `AdminDashboard.js` only.  
**Status:** Admin testing tool. Not wired to user-facing pages.

#### 19. `market-analysis-ai` — ADMIN / UNFINISHED
**What it does:** Full market analysis using Firecrawl + OpenAI. Reads all user data + external market intel.  
**Called from:** `AdminDashboard.js` only.  
**Status:** Partially wired. The `MarketPage.js` calls `biqc-insights-cognitive` for market data, not this function. Unclear if this is intended replacement.

#### 20. `intelligence-bridge` — BACKEND ONLY
**What it does:** Intelligence bridge between backend Python services and Supabase. 3 backend Python references.  
**Called from:** Backend only. Not user-facing.

---

## PART 2 — SUPABASE SQL MIGRATIONS

### Migration Status Overview
| Range | Purpose | Status |
|---|---|---|
| 001 | user_operator_profile table | ✅ Active — core user AI persona store |
| 013-014 | Edge function warmup + calibration_schedules | ✅ Active — pg_cron based |
| 015-019 | Intelligence computation functions | ✅ Active — core AI math |
| 020-021 | Insight outcomes + trust reconstruction tables | ✅ Active |
| 022-024 | Intelligence module functions | ✅ Active — compute_workforce_health, compute_revenue_scenarios |
| 025 | pg_cron extension | ✅ Required — enables scheduled jobs |
| 026-027 | Ingestion audits + engine tables | ✅ Active — tracks data ingestion |
| 028 | Access control / rate limiting functions | ✅ Active — increment_snapshot_counter |
| 029 | payment_transactions table | ✅ Active — Stripe payment records |
| 030-032 | Intelligence Spine (event queue, governance events) | ✅ Active — core event system |
| 033-036 | Risk baseline + calibration functions | ✅ Active — ic_calculate_risk_baseline |
| 037 | Cognition platform tables (decisions, telemetry) | ✅ Active |
| 038 | RAG infrastructure (rag_embeddings, rag_search) | ⚠️ Built but rag_search likely unused — no frontend calls found |
| 039 | A/B testing tables | ⚠️ Tables exist, ab_get_variant called but no active experiments |
| 040 | Super admin functions | ✅ Active — admin_list_users, admin_toggle_user |
| 041-042 | Security/RLS fixes | ✅ Active — essential security patches |
| 043 | File storage table (data_files) | ⚠️ Table exists, limited frontend use |
| 044-045 | Cognition core tables + fn_assemble_evidence_pack | ✅ Active — core intelligence functions |
| 046 | user_feature_usage table | ✅ Active — feature tracking |
| 047 | Grant test super admin | ⚠️ Dev/test only — grants super_admin to test accounts |
| 048-049 | Forensic corrections + propagation_map fix | ✅ Hotfixes — should remain |
| 050 | Tutorial progress table | ✅ Active |

---

### SQL FILES TO CLEAN UP (Not migrations — ad-hoc scripts)

| File | Location | Purpose | Action |
|---|---|---|---|
| `PURGE_ALL_DATA.sql` | `/app/supabase/migrations/` | **DANGER** — truncates all tables via `safe_truncate`. Dev tool. | 🔴 Move to `/scripts/dev-only/` and add access controls |
| `_backups/docs_purge_Feb2026/*.sql` | `/app/_backups/` | Historical fix scripts from Feb 2026 — already applied | ✅ Archive — do not delete (audit trail) |
| `/app/reports/FULL_SCHEMA_MIGRATION_PRO*.sql` | `/app/reports/` | Large pre-migration schemas — superseded by numbered migrations | ⚠️ Archive, not needed in deployment |
| `/app/supabase_migrations/*.sql` (ad-hoc) | `/app/supabase_migrations/` | Manually applied patches: integration_accounts, email_connections, workspace scoping | ⚠️ These need to be verified as applied in production Supabase. Not numbered = hard to track. |

---

### SQL FUNCTIONS NO LONGER NEEDED

| Function | Migration | Reason |
|---|---|---|
| `safe_truncate` | PURGE_ALL_DATA | Dev-only tool — dangerous in production |
| `emergency_delete_governance_event` | 032 | Break-glass function — keep but restrict to superadmin only |
| `ic_validate_snapshot_correlation` | 045 | Called from backend but no user-facing impact confirmed |
| `compute_pressure_levels` | 023 | May be superseded by `calibrate_pressure` in 017 |
| `analyze_burnout_risk` | 022 | Called from backend but no frontend surface confirmed |
| `analyze_ghosted_vips` | 022 | Called from backend but no frontend surface confirmed |

---

## PART 3 — TECH DEBT: MOVING OFF EMERGENT

### Category A — Emergent Platform Dependencies (Break these to self-host)

| Item | Location | Impact | Effort |
|---|---|---|---|
| `MONGO_URL=mongodb://localhost:27017` in `.env` | `/app/backend/.env` | Unused MongoDB connection. App uses Supabase. Dead config. | 🟢 Low — delete the variable |
| `DB_NAME=test_database` in `.env` | `/app/backend/.env` | Paired with MONGO_URL — unused | 🟢 Low — delete the variable |
| Emergent LLM Key (`EMERGENT_LLM_KEY`) | `/app/backend/.env` | Used for OpenAI/Claude calls via emergentintegrations library. Must be replaced with direct `OPENAI_API_KEY` for self-hosting. | 🟡 Medium — replace emergentintegrations library calls with direct SDK calls |
| `emergentintegrations` Python library | `requirements.txt` | Emergent-proprietary LLM wrapper. Needs to be replaced with `openai`, `anthropic` direct SDKs. | 🟡 Medium — audit all imports and replace |
| `preview.emergentagent.com` references | `frontend/.env` (REACT_APP_BACKEND_URL) | Points to Emergent preview environment. Must be replaced with `biqc.ai` for production. | 🟢 Low — already correct in production |
| Supervisor process management | `/etc/supervisor/conf.d/` | Emergent uses supervisord to manage frontend/backend. Self-hosted would use Docker Compose or Azure App Service start scripts. | 🟡 Medium — handled by Azure App Service in production |

---

### Category B — Architecture Changes Required

| Item | Current State | Target State | Effort |
|---|---|---|---|
| **Environment variable source** | Hardcoded in `.env` files with `CONFIGURED_IN_AZURE` placeholders | All secrets in Azure Key Vault / GitHub Secrets → injected at build/runtime | 🟡 Medium |
| **Frontend build process** | CRA (Create React App) with Webpack | Migrate to Vite for faster builds and smaller bundles | 🔴 High — significant refactor but worth it |
| **LLM provider abstraction** | Mix of `emergentintegrations` + direct OpenAI calls | Single `core/llm_router.py` with provider-agnostic interface (already partially built) | 🟡 Medium — `llm_router.py` exists, complete migration |
| **Backend deployment** | FastAPI on Emergent Kubernetes → Azure App Service | Azure App Service with Docker + GitHub Actions CI/CD (deploy.yml already built) | 🟡 Medium — workflow exists but has auth loop bug |
| **Mobile app** | Expo dev build | Expo EAS build for TestFlight / Play Store | 🟡 Medium |

---

### Category C — Code Quality / Dead Code

| Item | Files | Action |
|---|---|---|
| `FloatingSoundboard.js` | `/app/frontend/src/components/` | Legacy chat component. `SoundboardPanel.js` is the current version. Audit if FloatingSoundboard is still mounted anywhere and remove if not. |
| `Landing.js` | `/app/frontend/src/pages/` | Old landing page. May be superseded by `HomePage.js`. Check if route exists and remove if dead. |
| `GmailTest.js` | `/app/frontend/src/pages/` | Developer test page for Gmail. Should not be accessible in production — gate behind admin role or remove. |
| `calibration_psych` edge function | `/app/supabase/functions/calibration_psych/` | Dead duplicate of `calibration-psych`. Delete. |
| `watchtower-brain` edge function | `/app/supabase/functions/watchtower-brain/` | Orphaned. Superseded by Python watchtower engine. Delete. |
| `scrape-business-profile` edge function | `/app/supabase/functions/scrape-business-profile/` | Orphaned (0 calls). Either wire to calibration or delete. |
| `/app/reports/*.sql` | `/app/reports/` | Pre-migration schema files. Archive offline. |
| `/app/_backups/` | `/app/_backups/` | Historical fix scripts. Archive offline, remove from repo. |

---

## PART 4 — QA AGENT: LAUNCH READINESS SCORECARD

| Feature | Status | Blocker? |
|---|---|---|
| Homepage | ✅ Working | No |
| Sign-up / Register | ✅ Page exists — needs e2e test | Test required |
| Onboarding / Calibration | ✅ Exists — depends on `calibration-psych`, `calibration-business-dna`, `business-identity-lookup` | Edge functions must be deployed with secrets |
| Gmail Connect | ⚠️ OAuth exists — `gmail_prod` check function MISSING | `gmail_prod` must be built |
| Outlook Connect | ✅ OAuth exists — status check uses backend API | Test required |
| Priority Inbox | ❌ BROKEN — `email_priority` edge function MISSING | Must build `email_priority` |
| Calendar | ✅ Page exists at `/calendar`, sidebar fixed | Needs data when Outlook connected |
| Intelligence Dashboard | ✅ Exists — depends on `biqc-insights-cognitive` | Edge function + OPENAI_API_KEY required |
| Soundboard / AI Advisor | ✅ Backend 985-line soundboard exists | OPENAI_API_KEY required |
| Integrations Page | ✅ Rebuilt — 65+ platforms | MERGE_API_KEY required for Connect flow |
| How It Works (Homepage) | ✅ Newly built | No |
| Pricing | ✅ Exists | No |
| Marketing (Google Ads, Meta, LinkedIn) | ⚠️ Coming Soon | Not on launch critical path |
| Production deployment | ⚠️ Auth redirect loop known bug | Deploy workflow must be sole CI/CD |

---

## IMMEDIATE ACTION PRIORITY

### P0 — Launch Blockers
1. Build + deploy `email_priority` Supabase edge function
2. Build + deploy `gmail_prod` Supabase edge function  
3. Set `OPENAI_API_KEY` in Supabase Secrets vault (powers 8 functions)
4. Set `MERGE_API_KEY` in Azure App Service environment variables
5. Run e2e sign-up → calibration → connect integration → view dashboard

### P1 — Should Fix Before Launch
6. Remove `PURGE_ALL_DATA.sql` from active migrations folder
7. Gate `GmailTest.js` page behind admin role
8. Verify all numbered migrations (001-050) are applied to production Supabase
9. Apply ad-hoc migrations in `/app/supabase_migrations/` to production

### P2 — Tech Debt (Post-Launch)
10. Replace `emergentintegrations` with direct OpenAI SDK
11. Delete dead edge functions (calibration_psych, watchtower-brain, scrape-business-profile)
12. Archive `/app/_backups/` and `/app/reports/` out of repo
13. Migrate CRA → Vite for build performance
14. Complete CI/CD to sole-deployer status (disable Azure-native build)
