# BIQC FORENSIC ROUTE DELETION REPORT
## Date: February 11, 2026
## Classification: Forensic Analysis — Nothing Deleted

---

## PRE-AUDIT CONFIRMATION

| Check | Result |
|-------|--------|
| Total route count | **127** (107 in server.py + 20 in routes/) |
| Duplicate method+path pairs | **0** |
| Dynamic route registration outside modules | **0** (all via `include_router` — 5 sub-routers registered) |

---

## ROUTE 1: GET /calibration/activation

| Field | Value |
|-------|-------|
| **Source** | `server.py:3106-3152` |
| **Function** | `get_calibration_activation()` |
| **Description** | Generates a post-calibration "activation briefing" via AI (GPT-4o). Returns JSON with `focus`, `time_horizon`, `engagement`, `integration_framing`, `initial_observation`. Has hardcoded fallback if AI fails. |
| **Calls services** | `get_ai_response()`, `get_business_profile_supabase()` |
| **Writes to DB** | No |
| **Reads from DB** | `business_profiles` (business_name, industry, stage, team_size) |
| **Referenced by other backend routes** | No |
| **Referenced by frontend** | No |
| **Referenced in tests** | No |
| **Overlaps with active route** | No direct overlap. Was intended as a post-calibration screen that never shipped. |
| **Superseded by** | The onboarding wizard welcome screen now serves the post-calibration orientation purpose. |
| **Risk if deleted** | **LOW** — No callers exist anywhere. Hardcoded fallback means it was never reliably functional. |
| **Recommendation** | **SAFE TO DELETE** |

---

## ROUTE 2: POST /calibration/defer

| Field | Value |
|-------|-------|
| **Source** | `server.py:2508-2561` |
| **Function** | `defer_calibration()` |
| **Description** | Writes `persona_calibration_status = 'deferred'` to `user_operator_profile`. Also writes `calibration_status = 'deferred'` to `business_profiles` (column doesn't exist — silently fails). |
| **Calls services** | `get_business_profile_supabase()` |
| **Writes to DB** | `user_operator_profile.persona_calibration_status`, `business_profiles` (fails silently) |
| **Reads from DB** | `user_operator_profile`, `business_profiles` |
| **Referenced by other backend routes** | No |
| **Referenced by frontend** | No — `CalibrationAdvisor.js` does NOT call defer. No skip/defer button in the UI. |
| **Referenced in tests** | Yes — `test_iteration12_calibration_writes.py` verifies it writes to `user_operator_profile` |
| **Overlaps with active route** | No |
| **Superseded by** | Nothing — defer was a planned feature for skipping calibration. However, the auth gate does not recognize 'deferred' as a pass-through state, so calling this route would set the status to 'deferred' but the user would still be routed to `/calibration` on next login. |
| **Risk if deleted** | **LOW** — Route is non-functional: the 'deferred' state is not recognized by the auth gate. But it writes to the authoritative table, so deletion requires care. |
| **Recommendation** | **RECLASSIFY TO CATEGORY B** — This is a parked feature, not dead code. If a "skip calibration" button is ever added, this route is needed. The auth gate would need to recognize 'deferred' first. |

---

## ROUTE 3: GET /chat/history

| Field | Value |
|-------|-------|
| **Source** | `server.py:6299-6307` |
| **Function** | `get_chat_history()` |
| **Description** | Fetches chat history from `chat_history` table via `get_chat_history_supabase()`. Accepts optional `session_id` query param. |
| **Calls services** | `get_chat_history_supabase()` |
| **Writes to DB** | No |
| **Reads from DB** | `chat_history` |
| **Referenced by other backend routes** | No |
| **Referenced by frontend** | No — the frontend chat component (`Advisor.js`) does not call this. Chat history is built in-memory per session. |
| **Referenced in tests** | No |
| **Overlaps with active route** | Partially overlaps with `build_advisor_context()` which also reads `chat_history`, but that's a backend-internal function, not a route. |
| **Superseded by** | The chat is session-based; history is not surfaced to the user. |
| **Risk if deleted** | **LOW** — No callers. Read-only. |
| **Recommendation** | **RECLASSIFY TO CATEGORY B** — Chat history API could be useful if a "conversation history" feature is added. |

---

## ROUTE 4: GET /chat/sessions

| Field | Value |
|-------|-------|
| **Source** | `server.py:6309-6344` |
| **Function** | `get_chat_sessions()` |
| **Description** | Groups `chat_history` rows by `session_id`, returns last 20 sessions with message counts. |
| **Calls services** | None (direct Supabase query) |
| **Writes to DB** | No |
| **Reads from DB** | `chat_history` |
| **Referenced by other backend routes** | No |
| **Referenced by frontend** | No |
| **Referenced in tests** | No |
| **Overlaps with active route** | None |
| **Superseded by** | SoundBoard has its own `/soundboard/conversations` endpoint. Chat sessions listing was never surfaced. |
| **Risk if deleted** | **LOW** — Read-only, no callers. |
| **Recommendation** | **RECLASSIFY TO CATEGORY B** — Same reasoning as Route 3. |

---

## ROUTE 5: POST /email/analyze-priority

| Field | Value |
|-------|-------|
| **Source** | `server.py:4738-4851` |
| **Function** | `analyze_email_priority()` |
| **Description** | AI-powered email prioritization. Reads recent emails, business profile, email intelligence. Sends to GPT-4o for priority classification (high/medium/low). 113 lines of code. |
| **Calls services** | `get_business_profile_supabase()`, `get_user_emails_supabase()`, `get_email_intelligence_supabase()`, `get_ai_response()` |
| **Writes to DB** | Yes — writes results to `email_priority_analysis` table |
| **Reads from DB** | `business_profiles`, `outlook_emails`, `email_intelligence` |
| **Referenced by other backend routes** | No |
| **Referenced by frontend** | No — `EmailInbox.js` uses a Supabase Edge Function (`email_priority`) for priority, not this endpoint. |
| **Referenced in tests** | No |
| **Overlaps with active route** | Overlaps functionally with `GET /email/priority-inbox` (which IS used by frontend) |
| **Superseded by** | `GET /email/priority-inbox` and the `email_priority` Edge Function |
| **Risk if deleted** | **LOW** — Superseded. Writes to `email_priority_analysis` but the frontend reads via Edge Function. |
| **Recommendation** | **SAFE TO DELETE** |

---

## ROUTE 6: GET /gmail/status

| Field | Value |
|-------|-------|
| **Source** | `server.py:3666-3694` |
| **Function** | `gmail_status()` |
| **Description** | Checks if user has a row in `gmail_connections` table. Returns `{connected, labels_count, inbox_type, connected_email}`. Labels_count and inbox_type are hardcoded to `0` and `null`. |
| **Calls services** | None (direct Supabase query) |
| **Writes to DB** | No |
| **Reads from DB** | `gmail_connections` |
| **Referenced by other backend routes** | No |
| **Referenced by frontend** | No — `Integrations.js` uses `/outlook/status` for email status, not `/gmail/status`. `ConnectEmail.js` doesn't call it either. |
| **Referenced in tests** | No |
| **Overlaps with active route** | Overlaps with `/outlook/status` which checks email connection status |
| **Superseded by** | `/outlook/status` handles email connection status. Gmail-specific status was never surfaced. |
| **Risk if deleted** | **LOW** — Read-only, stub values, no callers. |
| **Recommendation** | **SAFE TO DELETE** |

---

## ROUTE 7: GET /baseline/defaults

| Field | Value |
|-------|-------|
| **Source** | `routes/intelligence.py:89-95` |
| **Function** | `baseline_defaults()` |
| **Description** | Returns the default baseline configuration structure from `intelligence_baseline` module. |
| **Calls services** | `get_intelligence_baseline().get_defaults()` |
| **Writes to DB** | No |
| **Reads from DB** | No (returns hardcoded defaults from module) |
| **Referenced by other backend routes** | Yes — `GET /baseline` calls `bl.get_defaults()` internally when no baseline exists. Same logic, different entry point. |
| **Referenced by frontend** | No |
| **Referenced in tests** | No |
| **Overlaps with active route** | Yes — `GET /baseline` already returns defaults when `configured: false`. This is a redundant entry point. |
| **Superseded by** | `GET /baseline` (which returns defaults when unconfigured) |
| **Risk if deleted** | **LOW** — Duplicate of logic already in `/baseline`. |
| **Recommendation** | **SAFE TO DELETE** |

---

## ROUTE 8: POST /outlook/comprehensive-sync

| Field | Value |
|-------|-------|
| **Source** | `server.py:4028-4088` |
| **Function** | `comprehensive_outlook_sync()` |
| **Description** | Triggers a 36-month deep email analysis across all Outlook folders as a background job. Creates a `sync_job`, spawns `start_comprehensive_sync_job()`. |
| **Calls services** | `find_user_sync_job_supabase()`, `create_sync_job_supabase()`, `start_comprehensive_sync_job()` (background) |
| **Writes to DB** | `outlook_sync_jobs` (creates job), `outlook_emails` (via background worker), `email_intelligence` |
| **Reads from DB** | `outlook_sync_jobs`, `outlook_oauth_tokens` |
| **Referenced by other backend routes** | Yes — referenced in comments by `/outlook/intelligence` ("Run comprehensive sync first") and `migrate_emails_to_supabase.py` |
| **Referenced by frontend** | No |
| **Referenced in tests** | No |
| **Overlaps with active route** | Related to but distinct from `GET /outlook/emails/sync` (quick sync vs deep analysis) |
| **Superseded by** | Not superseded — this is the deep analysis path. But it's never triggered by the UI. |
| **Risk if deleted** | **MEDIUM** — This is the only path for 36-month deep email analysis. `/outlook/emails/sync` only does a quick sync. However, no UI triggers it. |
| **Recommendation** | **RECLASSIFY TO CATEGORY B** — Parked capability for scheduled deep email analysis. |

---

## ROUTE 9: GET /outlook/debug-tokens

| Field | Value |
|-------|-------|
| **Source** | `server.py:4520-4567` |
| **Function** | `debug_outlook_tokens()` |
| **Description** | Debug endpoint. Returns raw OAuth token state from `outlook_oauth_tokens`, `m365_tokens`, and email count. Has a production guard (`ENVIRONMENT == "production"` → 404). |
| **Calls services** | None (direct Supabase queries) |
| **Writes to DB** | No |
| **Reads from DB** | `outlook_oauth_tokens`, `m365_tokens`, `outlook_emails` |
| **Referenced by other backend routes** | No |
| **Referenced by frontend** | No |
| **Referenced in tests** | No |
| **Overlaps with active route** | None |
| **Superseded by** | Nothing — this is a debug tool |
| **Risk if deleted** | **LOW** — Development artifact with production guard. |
| **Recommendation** | **SAFE TO DELETE** |

---

## ROUTE 10: GET /outlook/sync-status/{job_id}

| Field | Value |
|-------|-------|
| **Source** | `server.py:4339-4347` |
| **Function** | `get_sync_status()` |
| **Description** | Checks the status of a comprehensive email sync job. Reads from `outlook_sync_jobs`. |
| **Calls services** | `get_sync_job_supabase()` |
| **Writes to DB** | No |
| **Reads from DB** | `outlook_sync_jobs` |
| **Referenced by other backend routes** | No |
| **Referenced by frontend** | No |
| **Referenced in tests** | No |
| **Overlaps with active route** | Companion to `/outlook/comprehensive-sync` (Route 8) |
| **Superseded by** | Nothing — paired with comprehensive-sync |
| **Risk if deleted** | **LOW** if comprehensive-sync is also deleted. **MEDIUM** if comprehensive-sync is kept. |
| **Recommendation** | **RECLASSIFY TO CATEGORY B** — Paired with comprehensive-sync. Same lifecycle. |

---

## ROUTE 11: POST /strategy/regeneration/request

| Field | Value |
|-------|-------|
| **Source** | `server.py:3258-3260` |
| **Function** | `queue_regeneration_request()` |
| **Description** | Delegates to `request_regeneration()` from `regeneration_governance.py`. Queues a strategy regeneration request for a specific layer (e.g., "strategy", "operations"). |
| **Calls services** | `regeneration_governance.request_regeneration()` |
| **Writes to DB** | Yes — writes to regeneration queue table (via `regeneration_governance`) |
| **Reads from DB** | Via `regeneration_governance` |
| **Referenced by other backend routes** | No |
| **Referenced by frontend** | No |
| **Referenced in tests** | No |
| **Overlaps with active route** | None |
| **Superseded by** | Nothing — feature was never launched |
| **Risk if deleted** | **LOW** — No callers. The `regeneration_governance.py` module would remain but be unused. |
| **Recommendation** | **RECLASSIFY TO CATEGORY B** — Planned feature for strategy layer regeneration. Not dead code — intentional roadmap item. |

---

## ROUTE 12: POST /strategy/regeneration/response

| Field | Value |
|-------|-------|
| **Source** | `server.py:3263-3268` |
| **Function** | `handle_regeneration_response()` |
| **Description** | Records user's response (accept/refine/keep) to a regeneration proposal. Delegates to `record_regeneration_response()`. |
| **Calls services** | `regeneration_governance.record_regeneration_response()` |
| **Writes to DB** | Yes — updates regeneration record |
| **Reads from DB** | Via `regeneration_governance` |
| **Referenced by other backend routes** | No |
| **Referenced by frontend** | No |
| **Referenced in tests** | No |
| **Overlaps with active route** | Paired with Route 11 |
| **Superseded by** | Nothing |
| **Risk if deleted** | **LOW** — Same lifecycle as Route 11 |
| **Recommendation** | **RECLASSIFY TO CATEGORY B** — Paired with Route 11. Same lifecycle. |

---

## ROUTE 13: GET /data-center/categories

| Field | Value |
|-------|-------|
| **Source** | `server.py:7225-7237` |
| **Function** | `get_data_categories()` |
| **Description** | Groups `data_files` by category, returns category names with counts. |
| **Calls services** | None (direct Supabase query) |
| **Writes to DB** | No |
| **Reads from DB** | `data_files` |
| **Referenced by other backend routes** | **YES** — called internally by `get_data_center_stats()` (line 7250: `categories = await get_data_categories(current_user)`) |
| **Referenced by frontend** | No direct call, but data appears in `/data-center/stats` response which IS used |
| **Referenced in tests** | No |
| **Overlaps with active route** | Contained within `GET /data-center/stats` |
| **Superseded by** | Not superseded — it's a dependency of `/data-center/stats` |
| **Risk if deleted** | **HIGH** — Deleting this route would break `GET /data-center/stats` which calls the function directly. |
| **Recommendation** | **RECLASSIFY TO CATEGORY A** — This is NOT dead code. It is called internally by an active route. The route endpoint itself is unused, but the function `get_data_categories()` is a dependency. |

---

## ROUTE 14: GET /data-center/files/{file_id}/download

| Field | Value |
|-------|-------|
| **Source** | `server.py:7201-7215` |
| **Function** | `download_data_file()` |
| **Description** | Returns file content (base64 encoded `file_content` from `data_files` table) for download. |
| **Calls services** | None (direct Supabase query) |
| **Writes to DB** | No |
| **Reads from DB** | `data_files` (filename, file_content, file_type) |
| **Referenced by other backend routes** | No |
| **Referenced by frontend** | No — `DataCenter.js` has file listing and delete but no download button |
| **Referenced in tests** | No |
| **Overlaps with active route** | None |
| **Superseded by** | Nothing — download capability was built but never surfaced |
| **Risk if deleted** | **LOW** — Read-only, no callers |
| **Recommendation** | **RECLASSIFY TO CATEGORY B** — Useful capability to surface later |

---

## ROUTE 15: POST /business-profile/autofill

| Field | Value |
|-------|-------|
| **Source** | `server.py:6807-6930` |
| **Function** | `business_profile_autofill()` |
| **Description** | AI-powered autofill from uploaded documents and website URL. Reads data files, scrapes website, sends to GPT-4o to extract profile fields. 123 lines. Uses `BusinessProfileAutofillRequest` / `BusinessProfileAutofillResponse` models. |
| **Calls services** | `get_business_profile_supabase()`, `fetch_website_text()`, `get_ai_response()` |
| **Writes to DB** | No (returns suggested fields, doesn't persist) |
| **Reads from DB** | `data_files`, `business_profiles` |
| **Referenced by other backend routes** | No |
| **Referenced by frontend** | No — `ProfileImport.js` uses `/business-profile/build` not `/business-profile/autofill` |
| **Referenced in tests** | Yes — `test_profile_autofill.py` exists |
| **Overlaps with active route** | **YES** — Functionally superseded by `POST /business-profile/build` which does the same thing (AI extraction from documents + website) |
| **Superseded by** | `POST /business-profile/build` |
| **Risk if deleted** | **LOW** — Superseded. Test file references it but test is not in the regression suite. |
| **Recommendation** | **SAFE TO DELETE** |

---

## ROUTE 16: POST /notifications/dismiss/{notification_id}

| Field | Value |
|-------|-------|
| **Source** | `server.py:8757-8765` |
| **Function** | `dismiss_notification()` |
| **Description** | Upserts a row into `dismissed_notifications` table to mark a notification as dismissed. |
| **Calls services** | None (direct Supabase upsert) |
| **Writes to DB** | `dismissed_notifications` |
| **Reads from DB** | No |
| **Referenced by other backend routes** | Yes — `GET /notifications/alerts` checks `dismissed_notifications` to filter out dismissed items |
| **Referenced by frontend** | No — `DashboardLayout.js` has `ENABLE_NOTIFICATIONS_POLLING = false` (line 102). Notification bell exists but polling is disabled. No dismiss button rendered. |
| **Referenced in tests** | No |
| **Overlaps with active route** | Paired with `GET /notifications/alerts` |
| **Superseded by** | Nothing — notifications are disabled, not superseded |
| **Risk if deleted** | **LOW** — Notifications system is disabled. But `GET /notifications/alerts` is Category A (referenced in frontend), so the dismiss companion should follow the same lifecycle. |
| **Recommendation** | **RECLASSIFY TO CATEGORY B** — Paired with the notifications system. Will be needed when `ENABLE_NOTIFICATIONS_POLLING` is set to true. |

---

## SUMMARY

| Route | Recommendation |
|-------|---------------|
| GET /calibration/activation | **SAFE TO DELETE** |
| POST /calibration/defer | **RECLASSIFY TO B** |
| GET /chat/history | **RECLASSIFY TO B** |
| GET /chat/sessions | **RECLASSIFY TO B** |
| POST /email/analyze-priority | **SAFE TO DELETE** |
| GET /gmail/status | **SAFE TO DELETE** |
| GET /baseline/defaults | **SAFE TO DELETE** |
| POST /outlook/comprehensive-sync | **RECLASSIFY TO B** |
| GET /outlook/debug-tokens | **SAFE TO DELETE** |
| GET /outlook/sync-status/{job_id} | **RECLASSIFY TO B** |
| POST /strategy/regeneration/request | **RECLASSIFY TO B** |
| POST /strategy/regeneration/response | **RECLASSIFY TO B** |
| GET /data-center/categories | **RECLASSIFY TO A** (internal dependency) |
| GET /data-center/files/{file_id}/download | **RECLASSIFY TO B** |
| POST /business-profile/autofill | **SAFE TO DELETE** |
| POST /notifications/dismiss/{notification_id} | **RECLASSIFY TO B** |

### Final Counts

| Verdict | Count | Routes |
|---------|-------|--------|
| SAFE TO DELETE | 6 | /calibration/activation, /email/analyze-priority, /gmail/status, /baseline/defaults, /outlook/debug-tokens, /business-profile/autofill |
| RECLASSIFY TO B | 9 | /calibration/defer, /chat/history, /chat/sessions, /outlook/comprehensive-sync, /outlook/sync-status, /strategy/regeneration/request, /strategy/regeneration/response, /data-center/files/download, /notifications/dismiss |
| RECLASSIFY TO A | 1 | /data-center/categories (internal dependency of /data-center/stats) |
| INVESTIGATE FURTHER | 0 | |

---

## UPDATED CATEGORY COUNTS (Revised)

| Category | Original Count | After Reclassification |
|----------|---------------|----------------------|
| A — Active Production | 85 | **86** (+1: data-center/categories) |
| B — Parked / Future | 30 | **39** (+9 reclassified from C) |
| C — True Dead Code | 12 | **6** (safe to delete) |
| **Total** | **127** | **127** (unchanged) |

---

## END OF FORENSIC REPORT

Nothing deleted. Nothing modified. Forensic analysis only.
