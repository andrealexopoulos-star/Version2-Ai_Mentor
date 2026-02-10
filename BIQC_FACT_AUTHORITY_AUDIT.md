# BIQC GLOBAL FACT AUTHORITY — BYPASS AUDIT REPORT
## Date: February 10, 2026
## Classification: Observation Only — No Fixes Applied

---

## AUDIT METHODOLOGY

Traced every path that renders questions, input fields, or AI-generated prompts.
For each path, verified whether `resolve_facts()` or `build_known_facts_prompt()` is called before output.

---

## 1. RENDER PATHS AUDITED

### Category A: Frontend Pages That Render Input Fields

| # | Page | Route | Renders Fields | Calls Fact Resolution? | Verdict |
|---|------|-------|----------------|----------------------|---------|
| A1 | OnboardingWizard | `/onboarding` | 22 form fields across 7 steps | YES — calls `GET /api/business-profile/context` which calls `resolve_facts()` and returns `resolved_fields` | PASS |
| A2 | BusinessProfile (Business DNA) | `/business-profile` | ~25 form fields across 5 tabs | NO — calls `GET /api/business-profile` only (raw profile data). Does NOT call `GET /api/facts/resolve` or `GET /api/business-profile/context`. | **VIOLATION** |
| A3 | Settings | `/settings` | ~10 preference/profile fields | NO — calls `GET /api/business-profile` only. No fact resolution. | **VIOLATION** |
| A4 | CalibrationAdvisor | `/calibration` | Free-text input (chat-style) | NO — calls Edge Function `calibration-psych` directly. No fact resolution. | **VIOLATION** |
| A5 | IntelligenceBaseline | `/intelligence-baseline` | Domain monitoring configuration | Calls `GET /api/baseline` — reads from `intelligence_baseline` table. The baseline IS a fact source, but it doesn't cross-check other facts. | PASS (self-contained) |
| A6 | ProfileImport | `/profile-import` | File upload + website URL | NO — calls `POST /api/business-profile/build` and `PUT /api/business-profile`. No fact resolution. | **VIOLATION** |

### Category B: Backend Endpoints That Generate AI Prompts

| # | Endpoint | Calls `resolve_facts()`? | Calls `build_advisor_context()`? | Uses `known_facts_prompt`? | Verdict |
|---|----------|--------------------------|----------------------------------|---------------------------|---------|
| B1 | `POST /api/chat` | NO (indirectly via build_advisor_context) | YES | `build_advisor_context` returns `known_facts_prompt` but `format_advisor_brain_prompt` IGNORES it | **VIOLATION** |
| B2 | `POST /api/soundboard/chat` | NO | NO — uses `cognitive_core.get_context_for_agent()` instead | NO | **VIOLATION** |
| B3 | `POST /api/calibration/brain` (War Room) | NO | NO | NO | **VIOLATION** |
| B4 | `POST /api/boardroom/respond` | NO | NO — reads tables directly | NO | **VIOLATION** |
| B5 | `POST /api/intelligence/cold-read` | NO | NO — uses `truth_engine_rpc` | NO | N/A (read-only intelligence, no questions asked) |
| B6 | `POST /api/generate/sop` | NO (indirectly via build_advisor_context) | YES | Same as B1 — `known_facts_prompt` ignored by `format_advisor_brain_prompt` | **VIOLATION** |
| B7 | `POST /api/generate/checklist` | NO | NO — uses raw prompt with minimal context | NO | **VIOLATION** |
| B8 | `POST /api/generate/action-plan` | NO | NO — uses raw prompt with current_user metadata only | NO | **VIOLATION** |
| B9 | `POST /api/diagnose` | NO (indirectly via build_advisor_context) | YES | Same as B1 | **VIOLATION** |
| B10 | `POST /api/analysis` | NO (indirectly via build_advisor_context) | YES | Same as B1 | **VIOLATION** |

### Category C: Backend Prompt Builder That References Facts

| # | Function | Uses Resolved Facts? | Verdict |
|---|----------|---------------------|---------|
| C1 | `build_cognitive_context_for_prompt()` (line ~1786) | YES — calls `resolve_facts()` + `build_known_facts_prompt()` and appends to context | PASS |
| C2 | `build_advisor_context()` (line ~7528) | YES — calls `resolve_facts()` and returns `known_facts_prompt` | PASS (but prompt is not used downstream) |
| C3 | `format_advisor_brain_prompt()` (line ~7659) | NO — receives `context` dict containing `known_facts_prompt` but **never reads it**. Instead builds its own `detailed_profile` with "ASK THEM" fallbacks. | **VIOLATION** |
| C4 | `get_ai_response()` (line ~2298) | NO — calls `get_business_context()` (old function) not `resolve_facts()`. Uses `build_business_knowledge_context()` which has no fact resolution. | **VIOLATION** |

---

## 2. VIOLATIONS DETAIL

### VIOLATION V1: `format_advisor_brain_prompt` ignores `known_facts_prompt` (CRITICAL)
**Location**: `server.py` line 7659
**Description**: `build_advisor_context()` correctly resolves facts and returns `known_facts_prompt` in the context dict. However, `format_advisor_brain_prompt()` never reads `context["known_facts_prompt"]`. Instead, it builds its own `detailed_profile` string with hardcoded `'Not specified - ASK THEM'` fallbacks for empty fields.
**Impact**: Every AI endpoint using `format_advisor_brain_prompt` (chat, SOP, diagnosis, analysis) has "ASK THEM" instructions in the prompt even when the fact is known and resolved. The AI is actively instructed to re-ask questions that have already been answered.

### VIOLATION V2: Business DNA page (`/business-profile`) skips fact resolution (HIGH)
**Location**: `BusinessProfile.js` line 54
**Description**: Calls `GET /api/business-profile` directly. Never calls `GET /api/facts/resolve` or `GET /api/business-profile/context`. Fields are rendered without checking if they're already known from other sources (e.g., onboarding data, user account, integrations).
**Impact**: User may see empty fields for data that exists in the fact ledger or was entered during onboarding.

### VIOLATION V3: Settings page (`/settings`) skips fact resolution (HIGH)
**Location**: `Settings.js` line 34
**Description**: Same as V2 — reads raw business profile, no fact resolution.

### VIOLATION V4: `soundboard_chat` uses `cognitive_core` instead of fact resolution (HIGH)
**Location**: `server.py` line 5183
**Description**: Uses `cognitive_core.get_context_for_agent()` which reads from `cognitive_profiles` table — a separate data store with its own "known facts" that may be stale or incomplete compared to the Global Fact Authority.

### VIOLATION V5: `calibration/brain` (War Room) has no fact resolution (MEDIUM)
**Location**: `server.py` line 3140
**Description**: Uses a raw `WATCHTOWER_BRAIN_PROMPT` with user message history. No fact resolution. However, calibration is intentionally a conversational extraction flow, so this may be by design.

### VIOLATION V6: `boardroom_respond` reads tables directly (MEDIUM)
**Location**: `server.py` line 9669
**Description**: Reads `business_profiles.intelligence_configuration` and `user_operator_profile` directly. Does not use `resolve_facts()`. However, Board Room is a read-only intelligence delivery interface — it doesn't ask questions. The violation is that it doesn't have access to the full fact map for context.

### VIOLATION V7: `generate_checklist` and `generate_action_plan` use no fact resolution (MEDIUM)
**Location**: `server.py` lines 6589, 6623
**Description**: Both use raw prompts with minimal user context (`current_user.get("business_name")`). No fact resolution, no advisor context.

### VIOLATION V8: `get_ai_response` uses `get_business_context()` not `resolve_facts()` (MEDIUM)
**Location**: `server.py` line 2298
**Description**: `get_ai_response()` calls the old `get_business_context()` function (line 919) which reads from `business_profiles` and `data_files` but does NOT call `resolve_facts()`. This means the "intelligence snapshot" path bypasses fact authority.

### VIOLATION V9: ProfileImport page skips fact resolution (LOW)
**Location**: `ProfileImport.js` line 142
**Description**: Calls `POST /api/business-profile/build` and `PUT /api/business-profile` without checking existing facts first.

### VIOLATION V10: CalibrationAdvisor skips fact resolution (LOW)
**Location**: `CalibrationAdvisor.js` line 60
**Description**: Calibration is a psychology profiling flow via Edge Function. It asks identity questions (name, role) that may already be known. The Edge Function does NOT call `resolve_facts()`.

---

## 3. `log_fact_resolution_violation()` ENFORCEMENT

**Status**: The function EXISTS in `fact_resolution.py` (line 376) but is **NEVER CALLED** anywhere in the codebase.

```bash
$ grep -rn "log_fact_resolution_violation" /app/backend/
/app/backend/fact_resolution.py:376:def log_fact_resolution_violation(user_id: str, fact_key: str, context: str):
```

**Verdict**: The violation logging function is dead code. No enforcement mechanism exists.

---

## 4. SUMMARY

| Metric | Count |
|--------|-------|
| **Total render paths audited** | 16 (6 frontend + 10 backend) |
| **Paths with correct fact resolution** | 4 |
| **Paths with violations** | 12 |
| **Violation count** | 10 distinct violations |
| **Critical violations** | 1 (V1: format_advisor_brain_prompt ignores known_facts_prompt) |
| **High violations** | 3 (V2, V3, V4) |
| **Medium violations** | 4 (V5, V6, V7, V8) |
| **Low violations** | 2 (V9, V10) |
| **log_fact_resolution_violation() call sites** | 0 (dead code) |

---

## 5. ROOT CAUSE

The Global Fact Authority produces correct output (`resolve_facts()` and `build_known_facts_prompt()` work correctly). The failure is at the **consumption layer**:

1. **`format_advisor_brain_prompt()`** is the single most impactful violation. It's used by 4 endpoints (chat, SOP, diagnosis, analysis) and explicitly instructs the AI to "ASK THEM" for fields that `known_facts_prompt` already resolved. The `known_facts_prompt` is computed and stored in the context dict but never injected into the actual prompt text.

2. **Business DNA and Settings pages** read raw profile data without fact resolution. The fact resolution layer was added to the onboarding path but not retrofitted to these pages.

3. **Soundboard, checklist, and action-plan** endpoints were never updated to use the fact authority.

---

## 6. REQUIRED FIXES (Ordered, Not Implemented)

1. **V1 FIX (CRITICAL)**: Inject `context["known_facts_prompt"]` into `format_advisor_brain_prompt()` output. Remove all `'Not specified - ASK THEM'` fallbacks — replace with `'Not yet known'` (passive, not an instruction to ask).

2. **V2 FIX**: Update `BusinessProfile.js` to call `GET /api/business-profile/context` (which includes `resolved_fields`) instead of `GET /api/business-profile`.

3. **V3 FIX**: Update `Settings.js` to call `GET /api/business-profile/context`.

4. **V4 FIX**: Update `soundboard_chat` to inject `known_facts_prompt` from `resolve_facts()`.

5. **V7 FIX**: Update `generate_checklist` and `generate_action_plan` to call `build_advisor_context()`.

6. **V8 FIX**: Update `get_ai_response` to call `resolve_facts()` or replace `get_business_context()` with `build_advisor_context()`.

7. **ENFORCEMENT FIX**: Add `log_fact_resolution_violation()` call sites in endpoints that should not generate questions without resolution.

---

## END OF AUDIT

Awaiting next instruction.
