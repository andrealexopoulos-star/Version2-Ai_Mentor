# HARMONY AUDIT — Resolution Report
## andre@thestrategysquad.com.au | February 2026

---

## AUDIT REQUIREMENT 1: Direct Table Schema Reveal

### Where Calibration Data ACTUALLY Lives

| Data Type | Table | Column | Andre's State |
|---|---|---|---|
| **Operator Personality** | `user_operator_profile` | `agent_persona` | `{communication_style: "direct", decision_mode: "data-driven", risk_tolerance: "moderate", leadership_style: "strategic"}` |
| **Calibration Status** | `user_operator_profile` | `persona_calibration_status` | `"complete"` |
| **Console Progress** | `user_operator_profile` | `operator_profile.console_state` | **FIXED:** `{status: "COMPLETE", current_step: 17}` |
| **Onboarding State** | `user_operator_profile` | `operator_profile.onboarding_state` | `{completed: true, current_step: 14}` |
| **Fact Ledger** | `user_operator_profile` | `fact_ledger` | `[]` (EMPTY) |
| **Account Profile** | `users` | `company_name, industry, full_name` | `TSS, Professional Services, Andre` |
| **Business Profile** | `business_profiles` | All columns | **NO ROW** — blocked by broken RLS policy |
| **Cognitive Model** | `cognitive_profiles` | `delivery_preference` | **FIXED:** `{style: "direct", depth: "moderate", pressure_sensitivity: "moderate"}` |

### Confirmed: `business_dna` and `fact_ledger` as standalone tables DO NOT EXIST
- `business_dna` → **TABLE DOES NOT EXIST** in public schema
- `fact_ledger` → **TABLE DOES NOT EXIST** as standalone table. It is a JSONB column inside `user_operator_profile`

---

## AUDIT REQUIREMENT 2: Source-to-Surface Trace

### Why `users.company_name` and `users.industry` Are Dormant

```
SIGNUP FORM
  └── company_name: "TSS" ──→ users.company_name ✅ STORED
  └── industry: "Prof Svcs" ─→ users.industry ✅ STORED
                                    │
                                    ╳ NO CODE PATH EXISTS
                                    │
                              business_profiles ❌ EMPTY
                                    │
                                    ╳ CANNOT BE QUERIED
                                    │
                              BIQc Insights (executive-mirror) ❌ RETURNS NULL
                              Strategic Console (calibration/brain) ❌ NO CONTEXT
                              SoundBoard (soundboard/chat) ❌ NO BUSINESS DATA
```

**The disconnect is structural:** The `users` table and `business_profiles` table are independent data silos. No code copies data between them at any point in the user lifecycle. 

**Additionally:** The `business_profiles` table has a broken RLS INSERT policy that references `current_setting('app.settings.service_role_key')` — a PostgreSQL GUC variable that DOES NOT EXIST in this Supabase instance. This means **no new business_profiles rows can be created for any user** via the API.

**Fixes Applied:**
1. `calibration/brain` completion handler now calls `update_business_profile_supabase()` to seed from `users` table
2. `lifecycle/state` endpoint now auto-completes `console_state` when calibration is done
3. Andre's `cognitive_profiles.delivery_preference` populated from `agent_persona`

**Fix Required (Supabase Dashboard):**
The RLS policy on `business_profiles` for INSERT must be fixed. Run in Supabase SQL Editor:
```sql
-- Drop the broken policy
DROP POLICY IF EXISTS "service_role_insert" ON business_profiles;

-- Replace with working policy
CREATE POLICY "service_role_full_access" ON business_profiles
  FOR ALL USING (true) WITH CHECK (true);

-- OR more restrictive:
CREATE POLICY "users_insert_own_profile" ON business_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

---

## AUDIT REQUIREMENT 3: Intelligence Trigger Logic

### The Signal Failure: email_sync_worker → intelligence_automation_worker

**There IS no signal.** The two workers are completely independent processes with no inter-process communication:

```python
# email_sync_worker.py — runs every 60 seconds
async def main_loop():
    while True:
        accounts = await get_all_connected_accounts()  # Reads outlook_oauth_tokens
        for account in accounts:
            await sync_user_emails(account)            # Writes to outlook_emails
            # ⛔ NO TRIGGER to intelligence worker
            # ⛔ NO call to email_priority Edge Function
            # ⛔ NO emit to observation_events
        await asyncio.sleep(SYNC_INTERVAL_SECONDS)     # 60 seconds

# intelligence_automation_worker.py — runs every 86,400 seconds (24 HOURS)
async def main_loop():
    while True:
        users = await get_active_users_with_email()    # Reads outlook_emails for user_ids
        for user_id in users:
            await run_automatic_intelligence(user_id)   # Calls truth_engine
        await asyncio.sleep(DAILY_SCAN_INTERVAL)        # 86,400 seconds = 24 hours
```

**Why the signal fails to fire:** There is no signal. The architecture relies on a **polling model**, not an event-driven model. The intelligence worker independently polls every 24 hours. It never "knows" that new emails arrived.

**The 25 emails in `outlook_emails` for Andre have NEVER been processed** because:
1. The intelligence worker runs on a 24h cycle
2. Even when it runs, it calls `truth_engine → generate_cold_read` which looks at email patterns, NOT individual email content
3. The `email_priority` Edge Function (which DOES analyze individual emails) is NEVER called from either worker

### Fix Required:
Add intelligence trigger at the end of email sync:
```python
# In email_sync_worker.py, after sync completes for a user:
async def sync_user_emails(account):
    emails = await fetch_emails(account)
    stored_count = await store_emails(emails)
    
    if stored_count > 0:
        # TRIGGER: Run intelligence for this user
        await run_automatic_intelligence(account["user_id"])
```

---

## AUDIT REQUIREMENT 4: Zero-Question Mandate

### Console Now Bypasses the Survey

**Fixes Applied (in this session):**

1. **`GET /api/lifecycle/state`** — Now auto-completes `console_state` when calibration is already done:
```python
# calibration.py — lifecycle/state endpoint
if calibration_complete and console_status == "IN_PROGRESS":
    op_profile["console_state"] = {
        "status": "COMPLETE", 
        "current_step": 17,
        "updated_at": now
    }
    # Writes back to DB immediately
```

2. **`POST /api/calibration/brain`** — On COMPLETE status, now also sets `console_state` to COMPLETE:
```python
# calibration.py — calibration/brain endpoint
op["console_state"] = {
    "status": "COMPLETE", 
    "current_step": 17, 
    "updated_at": now_iso
}
```

3. **Andre's live data** — Already fixed in DB:
```json
// BEFORE: {"status": "IN_PROGRESS", "current_step": 2}
// AFTER:  {"status": "COMPLETE", "current_step": 17}
```

**The Strategic Console will no longer show the 17-question survey** for Andre or any user who has completed calibration. When `console_state.status === "COMPLETE"`, the WarRoomConsole will proceed directly to the intelligence interface.

---

## REMAINING BLOCKER

### `business_profiles` INSERT RLS Policy is Broken

**Error:** `unrecognized configuration parameter "app.settings.service_role_key"`

This policy prevents creating new business_profiles rows for ANY user. It affects:
- Post-calibration business profile seeding
- Business DNA page (first save for new users)
- Profile autofill from website scrape

**User Action Required:** Fix the RLS policy in Supabase Dashboard SQL Editor:
```sql
DROP POLICY IF EXISTS "service_role_insert" ON public.business_profiles;
DROP POLICY IF EXISTS "service_role_full_access" ON public.business_profiles;

CREATE POLICY "users_manage_own_profile" ON public.business_profiles
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service_role_bypass" ON public.business_profiles
  FOR ALL USING (
    (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'service_role'
  );
```
