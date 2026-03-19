# Backend Architecture Map

## 1. Entry point (main server)

| Item | Location | Notes |
|------|----------|--------|
| **Main app** | `backend/server.py` | FastAPI app: `app = FastAPI(title="Strategic Advisor API")` |
| **Run** | `uvicorn.run("server:app", host="0.0.0.0", port=PORT)` (default 8000) | No request timeout configured at uvicorn level |
| **Static** | Serves `frontend/build` at `/` when present | Catch-all `/{catchall:path}` → `index.html` |

**Startup sequence (server.py):**
1. `startup_core_runtime`: `init_supabase()` → `init_route_deps()` → `init_services()` → `init_prompt_registry()`
2. `startup_redis_runtime`: `biqc_jobs.initialize()` only (Redis client for enqueue; worker is NOT started here)
3. State stored on `app.state`: `supabase_admin`, `services`, `cognitive_core`, `biqc_jobs`

---

## 2. API routes

All routes are mounted under **`/api`** via `api_router` (prefix `/api`). Health also exposed at root `/health` and `api_router.get("/health")` → `/api/health`.

| Router module | Import in server | Typical prefix (if any) | Purpose |
|---------------|-----------------|--------------------------|---------|
| auth | auth_router | — | `/api/auth/supabase/*`, check-profile |
| cognitive | cognitive_router | — | Cognitive profile, escalation, advisory |
| onboarding | onboarding_router | — | Onboarding status, save, complete |
| facts | facts_router | — | Facts API |
| generation | generation_router | — | SOP/document generation |
| profile | profile_router | — | Business profile |
| integrations | integrations_router | — | Merge, CRM, email, drive, etc. |
| admin | admin_router | — | Users, stats, prompts, backfill |
| watchtower | watchtower_router | — | Watchtower |
| boardroom | boardroom_router | — | Boardroom/respond |
| intelligence | intelligence_router | — | Cold-read, snapshot, etc. |
| research | research_router | — | Research jobs |
| soundboard | soundboard_router | — | Chat, conversations, scan-usage |
| data_center | data_center_router | — | Files, categories |
| calibration | calibration_router | — | Init, status, brain, defer, reset |
| email | email_router | — | Email sync, priority, analysis |
| health | health_router | **/health** | `/api/health/detailed`, `/api/health/workers`, `/api/health/warmup` |
| intelligence_actions | intelligence_actions_router | — | Intelligence actions |
| strategic_console | strategic_console_router | — | Console state |
| reports | reports_router | — | Reports |
| intelligence_modules | intelligence_modules_router | — | Intelligence modules |
| forensic_audit | forensic_audit_router | — | Forensic audit |
| ingestion_engine | ingestion_engine_router | — | Ingestion jobs |
| hybrid_ingestion | hybrid_ingestion_router | — | Hybrid ingestion |
| engagement_engine | engagement_engine_router | — | Engagement |
| stripe_payments | stripe_payments_router | — | Stripe |
| spine_api | spine_api_router | — | Spine API |
| dsee | dsee_router | — | DSEE |
| memory_agent | memory_router | — | Memory agent |
| marketing_intel | marketing_intel_router | — | Marketing intel / benchmarks |
| rag_service | rag_router | — | RAG |
| marketing_automation | marketing_auto_router | — | Marketing automation |
| platform_services | platform_services_router | — | Platform services |
| super_admin | super_admin_router | — | Super admin |
| file_service | file_service_router | — | File generation jobs |
| advanced_intelligence | advanced_intel_router | — | Advanced intelligence |
| unified_intelligence | unified_intel_router | — | Unified intelligence |
| cognition_contract | cognition_router | — | Cognition overview, revenue, etc. |
| tutorials | tutorials_router | — | Tutorials |
| business_brain | business_brain_router | — | Business brain |

**Voice (separate prefix):** `voice_router` at **`/api/voice`** — `realtime/session`, `realtime/negotiate` (OpenAI direct).

---

## 3. Background workers

| Worker | Entry point | How run | What it does |
|--------|-------------|--------|--------------|
| **Redis queue worker** | `backend/biqc_job_worker.py` | Separate process only (e.g. `python -m biqc_job_worker` or supervisor). Not started by `server.py`. | Consumes `biqc-jobs:queue` (and delayed set); runs watchtower-analysis, advisor-analysis, market-intelligence-scan, crm-ingestion, ai-reasoning-log, email-analysis, drive-sync, website-ingestion, market-research, file-generation, integration-count-sync. API server only initializes Redis client for enqueueing. |
| **Email sync worker** | `backend/email_sync_worker.py` | **Separate process** (e.g. supervisor: `email_sync_worker`). Not started by server. | Loop: every 60s fetches connected accounts from `outlook_oauth_tokens`, syncs Outlook/Gmail into Supabase. |
| **Intelligence automation worker** | `backend/intelligence_automation_worker.py` | **Separate process** (e.g. supervisor: `intelligence_worker`). `asyncio.run(intelligence_loop())`. | Every 15 min: Merge emission for all integration_accounts; daily: cold-read + silence/regeneration per user; weekly: progress_cadence synthesis. |

Health checks assume supervisor process names: `email_sync_worker`, `intelligence_worker` (`routes/health.py`).

---

## 4. Redis usage

| Component | File | Usage |
|-----------|------|--------|
| **BIQc jobs** | `backend/biqc_jobs.py` | Azure Redis / `REDIS_URL`: list `biqc-jobs:queue`, sorted set `biqc-jobs:delayed`, list `biqc-jobs:logging-buffer`, dedupe keys `biqc-jobs:dedupe:*`. Optional: app starts worker only if Redis connects; no Redis = no queue, API still runs. |
| **Client** | `redis.asyncio.Redis` | From URL or Azure-style connection string; retry, timeouts (5s socket), health_check_interval 30s, max_connections 12. |

No other backend code uses Redis; edge functions do not use Redis.

---

## 5. Supabase usage

### Backend (Python)

| Area | Usage |
|------|--------|
| **Client init** | `backend/supabase_client.py`: `init_supabase()` → service-role client (global `supabase_admin`). SDK check for `maybe_single`, `eq`, `execute`. |
| **Auth** | `auth_supabase.py`, routes: validate JWT, get user, login/signup/OAuth. |
| **Data** | Tables used across routes: e.g. `users`, `business_profiles`, `outlook_oauth_tokens`, `outlook_emails`, `integration_accounts`, `intelligence_snapshots`, `observation_events`, `watchtower_events`, `cognitive_profiles`, `progress_cadence`, etc. RPCs: e.g. `detect_contradictions`, `update_escalation`, `calibrate_pressure`, `decay_evidence`, `compute_market_risk_weight`. |
| **Workers** | `email_sync_worker`, `intelligence_automation_worker` call `init_supabase()` and use the same tables. |

### Supabase Edge Functions (Deno)

Deployed under `supabase/functions/` (and duplicated/legacy in `supabase_edge_functions/`):

- **Auth/OAuth:** `refresh_tokens`, `outlook_auth`, `gmail_prod`
- **Intelligence / AI:** `biqc-insights-cognitive`, `intelligence-bridge`, `strategic-console-ai`, `boardroom-diagnosis`, `biqc-trinity`, `market-analysis-ai`, `market-signal-scorer`, `cfo-cash-analysis`, `biqc-insights-cognitive`, `calibration-engine`, `calibration-business-dna`, `calibration_psych` / `calibration-psych`, `sop-generator`, `warm-cognitive-engine`, `watchtower-brain`
- **Data / CRM:** `business-brain-merge-ingest`, `business-brain-metrics-cron`, `query-integrations-data`, `business-identity-lookup`, `scrape-business-profile`
- **Product:** `email_priority`, `checkin-manager`, `calibration-sync`, `competitor-monitor`

Frontend calls these via `SUPABASE_URL/functions/v1/<name>`. Warmup in backend: `GET /api/health/warmup` pings a fixed list of edge function names.

---

# Analysis

## 1. Performance risks

- **No global request timeout:** Uvicorn is run without `timeout_keep_alive` or request timeout. Long-running handlers (snapshot generation, boardroom, soundboard, ingestion) can hold connections and workers indefinitely.
- **Redis worker runs in a separate process** (`biqc_job_worker.py`); the API only enqueues. A slow job can still block the worker process but no longer blocks the API server.
- **Heavy startup:** `_initialize_core_runtime()` does Supabase init, `init_services()` (many subsystems), and `init_prompt_registry()`. Failures are swallowed with warnings; partial init can leave the app in an inconsistent state.
- **Rate limiting is in-memory:** `RATE_LIMIT_BUCKETS` in `core/config.py` is process-local. With multiple API instances, limits are per process, not global; no Redis-backed rate limit.
- **Health “detailed” can be slow:** `/api/health/detailed` runs Supabase query, Redis `health_async()`, and two `supervisorctl` subprocess calls. No timeout around the overall check; if Redis or Supabase is slow, the health endpoint itself can hang.
- **Large dependency graph in routes:** Many route handlers import heavy modules (e.g. `snapshot_agent`, `watchtower_engine`, `merge_emission_layer`) at request or job time, which can add latency and memory spikes under load.
- **Emission loop in intelligence worker:** Runs over all `integration_accounts` every 15 minutes with sequential `run_emission` per (user_id, account_id). Large tenant count can make the loop long and delay the next cycle.

---

## 2. Duplication

- **Two function folders:** `supabase/functions/` (many edge functions) and `supabase_edge_functions/` (overlap: `email_priority`, `gmail_prod`, `outlook-auth`, `business-brain-metrics-cron`, `business-brain-merge-ingest`). Risk of deploying from one folder while the other is stale or vice versa.
- **Calibration psych:** `supabase/functions/calibration_psych/` and `calibration-psych/` (naming inconsistency; possible duplicate).
- **Snapshot / intelligence generation in two places:** Backend has `snapshot_agent` (Python) and Redis job `advisor-analysis` → `generate_snapshot()`; Supabase has `biqc-insights-cognitive` (Deno) writing to `intelligence_snapshots`. Frontend can call either backend or edge; logic and prompts can drift.
- **Supabase client creation:** Many edge functions each call `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` (or anon) inside the handler. No shared pool or singleton per invocation.
- **Context gathering:** Both `biqc-insights-cognitive` and `strategic-console-ai` (and possibly backend) have similar “gather business_profiles, observation_events, integrations, etc.” logic. Duplicated and can diverge.
- **init_route_deps called twice:** In `_initialize_core_runtime()`, `init_route_deps` is called once before checking `supabase_admin`, then again after `init_services`. Redundant and slightly confusing.

---

## 3. Missing production safeguards

- **No explicit liveness vs readiness:** Only generic `/health` and `/api/health`. No separate “liveness” (process up) vs “readiness” (Supabase + Redis + optional workers). K8s/orchestrators often need both; marking ready before Supabase/Redis are OK can send traffic to a broken pod.
- **No request timeout at server level:** No uvicorn/gunicorn request timeout or FastAPI middleware to cap request duration. Slow endpoints can hold connections until client or proxy times out.
- **Worker visibility:** Email sync and intelligence workers are separate processes; if they crash, only supervisor (if used) restarts them. There is no in-app visibility (e.g. last run timestamp, success/failure) beyond supervisor status in `/api/health/workers`.
- **Graceful shutdown:** Redis worker is cancelled on `shutdown_redis_runtime`; in-flight job may be lost. No “drain” period to finish current job before exit.
- **Secrets and env:** `JWT_SECRET` is required in config (`os.environ['JWT_SECRET_KEY']`); others are optional. No single checklist or startup validation that all required env vars for production (e.g. Supabase, Redis, OpenAI) are set.
- **CORS:** Origins are regex + `CORS_ALLOW_ORIGINS`. Misconfiguration can open cross-origin access; no explicit production allow-list documented.
- **Master admin bypass:** `MASTER_ADMIN_EMAIL` in config bypasses rate limits. Hardcoded email in code; no role-based bypass from DB/config.
- **Health depends on supervisor:** Detailed health assumes `supervisorctl` and specific process names. In Docker/K8s without supervisor, worker checks always show “unknown” or “stopped”.
- **No circuit breaker:** Outbound calls (Supabase, OpenAI, Merge, Serper, etc.) have no circuit breaker. Repeated failures can keep hitting failing dependencies.
- **Logging:** No structured request ID or correlation ID; harder to trace a request across API → Redis job → Supabase.

---

## Summary table

| Category | Finding |
|----------|---------|
| **Performance** | No request timeout; in-process Redis worker; in-memory rate limits; heavy startup and lazy imports; emission loop scalability. |
| **Duplication** | Two edge function folders; snapshot logic backend vs edge; duplicate context-gathering; double `init_route_deps`. |
| **Production** | No liveness/readiness split; no server-side request timeout; worker status tied to supervisor; no drain on shutdown; no env validation; master admin hardcoded; no circuit breakers. |
