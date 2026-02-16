# BIQc Cognitive Trace — User: andre@thestrategysquad.com.au
## Forensic Data-Flow Audit | February 2026

---

## LIVE DATABASE STATE (Queried at audit time)

| Table | Status | Data |
|---|---|---|
| `users` | **HAS DATA** | email: andre@..., company: TSS, industry: Professional Services, is_master_account: true |
| `user_operator_profile` | **HAS DATA** | persona_calibration_status: **complete**, agent_persona: populated, fact_ledger: **EMPTY []** |
| `business_profiles` | **EMPTY** | No row exists for this user |
| `onboarding` | **EMPTY** | No row exists |
| `email_connections` | **HAS DATA** | provider: outlook, connected: true, connected_email: andre@... |
| `outlook_oauth_tokens` | **HAS DATA** | provider: microsoft, expires_at: 2026-02-16T20:08 |
| `outlook_emails` | **HAS DATA** | 25 emails synced |
| `integration_accounts` | **HAS DATA** | HubSpot (CRM), Xero (Accounting), Outlook (Email) |
| `cognitive_profiles` | **EMPTY SHELL** | Row exists but all fields are `{}` |
| `chat_history` | **EMPTY** | 0 messages |
| `observation_events` | **EMPTY** | 0 observations |
| `watchtower_insights` | **EMPTY** | 0 insights |
| `intelligence_baseline` | **EMPTY** | No row |
| `email_intelligence` | **EMPTY** | No analysis generated |
| `email_priority_analysis` | **EMPTY** | No priority triage |
| `intelligence_snapshots` | **EMPTY** | No snapshots generated |
| `analyses` | **EMPTY** | 0 |
| `documents` | **EMPTY** | 0 |

### Critical State: `operator_profile.console_state`
```json
{
  "status": "IN_PROGRESS",
  "current_step": 2,
  "updated_at": "2026-02-16T19:02:24"
}
```
This is **WHY the Strategic Console shows the 17-question survey**. It reads `console_state.status = "IN_PROGRESS"` and resumes at step 2.

### Critical State: `operator_profile.onboarding_state`
```json
{
  "completed": true,
  "current_step": 14
}
```
Onboarding IS marked complete, but the console_state is separate and still IN_PROGRESS.

---

## SCRUTINY POINT 1: Calibration-to-DNA Mapping

### The Break: User Record → Business Profile is SEVERED

```
SOURCE                          TARGET                         STATUS
─────────────────────────────── ────────────────────────────── ──────
users.company_name = "TSS"     business_profiles.business_name  ❌ NO ROW EXISTS
users.industry = "Prof Svcs"   business_profiles.industry       ❌ NO ROW EXISTS
Calibration website scrape     business_profiles.website        ❌ NEVER WRITTEN
Calibration goals              business_profiles.short_term_goals ❌ NEVER WRITTEN
```

**ROOT CAUSE:** The calibration flow (`calibration-psych` Edge Function) profiles the **OPERATOR's personality** (communication style, risk tolerance, decision style). It writes to `user_operator_profile.agent_persona`. It does **NOT** write to `business_profiles`.

The `business_profiles` table is ONLY populated by:
1. `PUT /api/business-profile` — Manual save from the Business DNA page
2. `POST /api/business-profile/autofill` — Website scrape autofill
3. `POST /api/business-profile/build` — AI-assisted profile build

**Andre has never visited the Business DNA page to save data.** The calibration "handshake" captured WHO Andre is (operator psychology), but NOT WHAT his business does.

The `users` table has `company_name: "TSS"` and `industry: "Professional Services"` from signup, but **NO CODE copies this into `business_profiles`**. These are two separate data silos.

### The Fix Required:
After calibration completes, auto-seed `business_profiles` from `users` table:
```
users.company_name → business_profiles.business_name
users.industry → business_profiles.industry
calibration website_url → business_profiles.website
```

---

## SCRUTINY POINT 2: The "Insights" Void

### Why BIQc Insights shows "advisory brief is being prepared"

The `/advisor` page (AdvisorWatchtower.js) calls:
```
GET /api/executive-mirror
```

This endpoint reads from TWO tables:

| Source | Table | Query | Andre's State | Result |
|---|---|---|---|---|
| Agent Persona | `user_operator_profile.agent_persona` | `eq('user_id', uid)` | **HAS DATA** | Returns persona |
| Fact Ledger | `user_operator_profile.fact_ledger` | `eq('user_id', uid)` | **EMPTY []** | Returns empty array |
| Executive Memo | `intelligence_snapshots` | `eq('user_id', uid).order('generated_at', desc).limit(1)` | **NO ROWS** | Returns null |
| Resolution Score | `intelligence_snapshots.resolution_score` | Same query | **NO ROWS** | Returns null |

**The "advisory brief is being prepared" message appears because:**
1. `executive_memo = null` (no intelligence snapshot exists)
2. `resolution_status = null` (no score exists)
3. `fact_ledger = []` (no facts captured)

**WHY no intelligence snapshot exists:**
The `intelligence_snapshots` table is populated by the `intelligence-snapshot` Edge Function.
This Edge Function is **NOT DEPLOYED** on Supabase. The backend calls it (`cognitive_context.py:26`) and gets a fallback response. It never writes to `intelligence_snapshots`.

**The chain of failure:**
```
Email Sync Worker → outlook_emails (25 emails) ✅
  ↓ NOTHING TRIGGERS ↓
Intelligence Worker → truth_engine → observation_events (0 events) ❌
  ↓ NOTHING EXISTS ↓
Watchtower Engine → watchtower_insights (0 insights) ❌
  ↓ NOTHING EXISTS ↓
Intelligence Snapshot → intelligence_snapshots (0 snapshots) ❌
  ↓ NOTHING EXISTS ↓
Executive Mirror → returns null memo ❌
  ↓ UI SHOWS ↓
"Advisory brief is being prepared" — INDEFINITELY
```

**25 emails sit in `outlook_emails` and NOTHING reads them for intelligence.**

---

## SCRUTINY POINT 3: Onboarding Loop (17 Questions)

### Why Strategic Console defaults to 17 questions

The Strategic Console (`/war-room` → WarRoomConsole.js) calls:
```javascript
// Step 1: Check lifecycle state
GET /api/lifecycle/state

// Step 2: Check console state
GET /api/console/state  // Actually a POST to save, but reads from operator_profile
```

The lifecycle state returns:
```json
{
  "calibration": {"status": "complete", "complete": true},
  "onboarding": {"complete": true, "step": 14},
  "integrations": {"count": 3, "providers": ["HubSpot", "Xero", "outlook"]},
  "intelligence": {"has_events": false, "domains_enabled": []}
}
```

**BUT** the console_state inside `user_operator_profile.operator_profile` is:
```json
{"status": "IN_PROGRESS", "current_step": 2}
```

The WarRoomConsole sees `console_state.status = "IN_PROGRESS"` and **resumes the 17-question intelligence baseline survey at step 2**, even though onboarding and calibration are complete.

**ROOT CAUSE:** The console_state and onboarding_state are **INDEPENDENT state machines** stored in the same JSON column (`operator_profile`). Completing calibration does NOT complete the console survey. Andre started the console survey, answered 2 questions, then left. The console remembers and forces him to finish.

**The 17 questions ARE the Intelligence Baseline setup.** They configure which domains (finance, sales, operations, team, market) to monitor and set initial thresholds. Until these are answered, `intelligence.domains_enabled = []` and the Watchtower has nothing to watch.

---

## SCRUTINY POINT 4: SoundBoard Isolation

### Is SoundBoard stateless? NO — but it's context-starved.

SoundBoard (`POST /api/soundboard/chat`) does this:
```python
# 1. Loads cognitive core context
core_context = await cognitive_core.get_context_for_agent(user_id, "MySoundboard")

# 2. Resolves known facts
resolved_facts = await resolve_facts(get_sb(), user_id)

# 3. Gets business profile
profile = await get_business_profile_supabase(get_sb(), user_id)

# 4. Builds cognitive context from frontend-passed intelligence_context
cognitive_context = _build_cognitive_context(req, core_context)
```

**Andre's SoundBoard state:**
| Data Source | Status | Impact |
|---|---|---|
| `cognitive_profiles` | EMPTY `{}` | No behavioral model → SoundBoard can't adapt to Andre's communication style |
| `business_profiles` | NO ROW | No business context → SoundBoard doesn't know what TSS does |
| `fact_ledger` | EMPTY `[]` | No confirmed facts → SoundBoard will re-ask basic questions |
| `intelligence_baseline` | NO ROW | No thresholds → SoundBoard can't reference risk tolerance or priorities |
| `req.intelligence_context` | `{}` | Frontend sends empty object → No real-time signals |

**SoundBoard IS pulling from Intelligence Baseline — but it returns null.**
It IS pulling from Cognitive Core — but the profile is empty `{}`.
It IS pulling from Business Profile — but no row exists.

**SoundBoard is not "isolated." It is CORRECTLY CONNECTED but STARVED OF DATA.**

---

## SOURCE-TO-SURFACE MAP

### Complete Data Route for Andre

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ SOURCE-TO-SURFACE MAP: andre@thestrategysquad.com.au                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ [SIGNUP FORM]                                                                │
│  company_name: "TSS" ──────→ users.company_name ✅                          │
│  industry: "Prof Svcs" ────→ users.industry ✅                              │
│                          ╳──→ business_profiles  ❌ NEVER COPIED            │
│                                                                              │
│ [CALIBRATION]                                                                │
│  9-step psych profiling ───→ user_operator_profile.agent_persona ✅         │
│  Website URL ──────────────→ ❌ NOT PERSISTED TO business_profiles          │
│  Business context ─────────→ ❌ NOT PERSISTED (only used in-session)        │
│                          ╳──→ business_profiles  ❌ NEVER WRITTEN           │
│                          ╳──→ fact_ledger        ❌ EMPTY                   │
│                                                                              │
│ [OUTLOOK CONNECT]                                                            │
│  OAuth tokens ─────────────→ outlook_oauth_tokens ✅                        │
│  Connection status ────────→ email_connections ✅                            │
│  Integration state ────────→ integration_accounts ✅                        │
│                                                                              │
│ [EMAIL SYNC WORKER]                                                          │
│  25 emails fetched ────────→ outlook_emails ✅                              │
│                          ╳──→ email_intelligence    ❌ NEVER GENERATED      │
│                          ╳──→ email_priority_analysis ❌ NEVER GENERATED    │
│                          ╳──→ observation_events    ❌ NEVER EMITTED        │
│                                                                              │
│ [HUBSPOT + XERO CONNECT]                                                     │
│  Merge.dev tokens ─────────→ integration_accounts ✅                        │
│                          ╳──→ observation_events    ❌ NO DATA PULL         │
│  Data streams ─────────────→ ❌ STATIC FLAGS ONLY (connected/not)           │
│                                                                              │
│ [INTELLIGENCE WORKER (runs every 24h)]                                       │
│  Reads outlook_emails ─────→ truth_engine ──→ observation_events ❓         │
│  BUT: 0 observation_events exist → 0 watchtower_insights generated          │
│                          ╳──→ intelligence_snapshots ❌ NEVER GENERATED     │
│                                                                              │
│ [UI: BIQc INSIGHTS (/advisor)]                                               │
│  Reads executive-mirror:                                                     │
│    agent_persona ✅ ───────→ Shows persona card                             │
│    fact_ledger [] ─────────→ Shows nothing                                  │
│    executive_memo null ────→ "Advisory brief is being prepared" ❌          │
│    resolution_status null ─→ No status indicator                            │
│                                                                              │
│ [UI: STRATEGIC CONSOLE (/war-room)]                                          │
│  Reads lifecycle/state:                                                      │
│    calibration: complete ✅                                                 │
│    onboarding: complete ✅                                                  │
│    BUT: console_state.status = "IN_PROGRESS" at step 2                      │
│    → Shows 17-question survey instead of console ❌                         │
│                                                                              │
│ [UI: SOUNDBOARD (/soundboard)]                                               │
│  Pulls cognitive_profiles: {} → No behavioral model ❌                      │
│  Pulls business_profiles: null → No business context ❌                     │
│  Pulls fact_ledger: [] → Will re-ask basics ❌                              │
│                                                                              │
│ [UI: BUSINESS DNA (/business-profile)]                                       │
│  Reads business_profiles: null → All fields empty ❌                        │
│  User has never visited this page to save data                               │
│                                                                              │
│ [UI: OPERATOR VIEW (/operator)]                                              │
│  Reads dashboard/stats: 0 analyses, 0 docs, 0 sessions ❌                  │
│  Reads dashboard/focus: "You're in the early signal phase" (fallback)       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## WHERE DATA STOPS MOVING — 5 BREAK POINTS

| # | Break Point | Upstream Has Data | Downstream is Empty | Impact |
|---|---|---|---|---|
| **1** | `users` → `business_profiles` | users.company_name = "TSS" | business_profiles = NO ROW | ALL intelligence is blind to what Andre's business does |
| **2** | `outlook_emails` → `email_intelligence` | 25 emails synced | 0 intelligence generated | Email signals are dead weight — never analyzed |
| **3** | `email_intelligence` → `observation_events` | N/A (empty) | 0 observations | Watchtower has nothing to observe |
| **4** | `observation_events` → `intelligence_snapshots` | 0 events | 0 snapshots | Executive Mirror returns "brief is being prepared" forever |
| **5** | `console_state.status = "IN_PROGRESS"` | Calibration complete, Onboarding complete | Console survey still blocking | Strategic Console is stuck in onboarding loop |

---

## INTEGRATION SILOS — HubSpot + Xero

| Integration | Connection Status | Data Streaming | Observation Events |
|---|---|---|---|
| HubSpot (CRM) | ✅ Connected via Merge.dev | **STATIC FLAG ONLY** — Token stored, no data pull | 0 events |
| Xero (Accounting) | ✅ Connected via Merge.dev | **STATIC FLAG ONLY** — Token stored, no data pull | 0 events |
| Outlook (Email) | ✅ Connected via Edge Function | **ACTIVE SYNC** — 25 emails in outlook_emails | 0 events (never processed) |

**HubSpot and Xero are checkboxes, not data streams.** The `integration_accounts` table stores the Merge.dev account token but no code pulls CRM contacts, deals, invoices, or financial data into `observation_events`. The Merge Emission Layer (`merge_emission_layer.py`) is initialized but **never triggered by a scheduler or webhook**.

---

## RECOMMENDED FIXES (Priority Order)

### P0: Unblock the Intelligence Pipeline
1. **Seed `business_profiles` from `users` table** after calibration completes
2. **Trigger email intelligence** after email sync (call `email_priority` Edge Function or run inline)
3. **Reduce intelligence worker cycle** from 24h to 1h
4. **Deploy `intelligence-snapshot` Edge Function** OR move logic to backend

### P0: Fix the Console Loop
5. **Auto-complete console_state** when calibration + onboarding are both complete, OR skip the 17-question survey if Business DNA already has data

### P1: Activate Integration Data Streams
6. **Wire Merge.dev data pull** for HubSpot (contacts, deals) and Xero (invoices, P&L)
7. **Emit observation_events** from integration data pulls

### P1: Populate Cognitive Core
8. **Back-fill cognitive_profiles** from calibration agent_persona data
9. **Populate fact_ledger** from business profile + calibration answers
