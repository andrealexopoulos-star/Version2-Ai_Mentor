# DATA DUPLICATION CONTROL MATRIX
**PROMPT 1 - Source of Truth Declaration**

**Purpose:** Prevent data inconsistency by explicitly declaring single source of truth for each duplicated dataset

**Status:** READ-ONLY analysis, NO data movement

---

## DUPLICATED DATASETS (5 identified)

### 1. SOUNDBOARD_CONVERSATIONS

| Aspect | MongoDB | Supabase |
|--------|---------|----------|
| **Collection/Table** | `soundboard_conversations` | `soundboard_conversations` |
| **Records** | 6 documents | Unknown |
| **Write Path** | server.py line 4418, 4429 | server.py line 4241 |
| **Read Path** | ❌ NOT USED | server.py line 4211, 4220 |
| **Schema** | {id, user_id, title, messages[], created_at, updated_at} | Unknown |
| **Declared Role** | **DEPRECATED** | **SOURCE OF TRUTH** |

**Analysis:**
- Code READS from Supabase (lines 4211, 4220)
- Code WRITES to MongoDB (lines 4418, 4429)
- **INCONSISTENCY RISK:** Reads don't reflect writes

**Recommendation:**
- MongoDB: Mark as READ-ONLY (deprecated)
- Supabase: Source of truth
- Migration path: Stop MongoDB writes, remove MongoDB reads

---

### 2. USERS

| Aspect | MongoDB | Supabase |
|--------|---------|----------|
| **Collection/Table** | `users` | `auth.users` |
| **Records** | 64 documents | ~64 users (estimated) |
| **Write Path** | Legacy registration endpoints | Supabase Auth API |
| **Read Path** | server.py line 757 (JWT validation), line 1750, 2325, 4768, 7259 | Supabase Auth (get_current_user_supabase) |
| **Schema** | {id, email, password (bcrypt), name, business_name, industry, role, is_active, created_at, updated_at} | Supabase auth schema (id, email, encrypted_password, etc.) |
| **Declared Role** | **LEGACY (DEPRECATED)** | **SOURCE OF TRUTH** |

**Analysis:**
- Supabase auth is primary for new users
- MongoDB users still queried in 5+ locations
- **INCONSISTENCY RISK:** New users in Supabase won't have MongoDB record

**Recommendation:**
- Supabase: Source of truth for auth
- MongoDB: Legacy lookup only (phase out)
- Migration path: Remove MongoDB user queries, use Supabase exclusively

---

### 3. BUSINESS_PROFILES

| Aspect | MongoDB | Supabase |
|--------|---------|----------|
| **Collection/Table** | `business_profiles` | `business_profiles` |
| **Records** | 31 documents | Unknown |
| **Write Path** | ❓ UNKNOWN | supabase_remaining_helpers.py functions |
| **Read Path** | ❓ UNKNOWN | GET /business-profile endpoints |
| **Schema** | {user_id, abn, acn, business_name, business_type, industry, retention_known, retention_rag, retention_rate_range, target_country} | Unknown |
| **Declared Role** | **DEPRECATED** | **SOURCE OF TRUTH** |

**Analysis:**
- Cannot verify read/write paths from PROMPT 0 data
- Assumption: Supabase is newer, MongoDB is legacy

**Recommendation:**
- Supabase: Source of truth
- MongoDB: Mark as deprecated snapshot
- Requires code review to confirm write paths

---

### 4. DOCUMENTS

| Aspect | MongoDB | Supabase |
|--------|---------|----------|
| **Collection/Table** | `documents` | `documents` |
| **Records** | 5 documents | Unknown |
| **Write Path** | ❓ UNKNOWN | supabase_document_helpers.py (create_document_supabase) |
| **Read Path** | ❓ UNKNOWN | supabase_document_helpers.py (get_user_documents_supabase) |
| **Schema** | {id, user_id, title, document_type, content, tags, created_at, updated_at} | Likely same |
| **Declared Role** | **DEPRECATED** | **SOURCE OF TRUTH** |

**Analysis:**
- supabase_document_helpers.py exists (imported in server.py)
- Suggests Supabase is active system
- MongoDB likely legacy

**Recommendation:**
- Supabase: Source of truth
- MongoDB: Deprecated

---

### 5. ANALYSES

| Aspect | MongoDB | Supabase |
|--------|---------|----------|
| **Collection/Table** | `analyses` | `analyses` |
| **Records** | 3 documents | Unknown |
| **Write Path** | ❓ UNKNOWN | ❓ UNKNOWN |
| **Read Path** | ❓ UNKNOWN | server.py line 5112 (delete), 7307 (delete) |
| **Schema** | {id, user_id, title, analysis_type, business_context, ai_analysis, recommendations, action_items, created_at, updated_at} | Unknown |
| **Declared Role** | **DEPRECATED** | **SOURCE OF TRUTH** |

**Analysis:**
- Supabase has delete operations (lines 5112, 7307)
- Suggests Supabase is active

**Recommendation:**
- Supabase: Source of truth
- MongoDB: Deprecated

---

## SOURCE OF TRUTH DECLARATION (FINAL)

| Dataset | MongoDB Status | Supabase Status | Write Guard Needed |
|---------|----------------|-----------------|-------------------|
| **soundboard_conversations** | DEPRECATED (read-only) | ✅ SOURCE OF TRUTH | ✅ YES - block MongoDB writes |
| **users** | LEGACY (auth only) | ✅ SOURCE OF TRUTH | ⚠️ YES - remove MongoDB lookups |
| **business_profiles** | DEPRECATED | ✅ SOURCE OF TRUTH | ⚠️ VERIFY first |
| **documents** | DEPRECATED | ✅ SOURCE OF TRUTH | ⚠️ VERIFY first |
| **analyses** | DEPRECATED | ✅ SOURCE OF TRUTH | ⚠️ VERIFY first |

**GENERAL RULE:**
- Supabase = Source of truth for ALL duplicated data
- MongoDB = Legacy/deprecated (read-only until migration)

---

## WRITE GUARDS (Code-level safety)

### GUARD 1: SoundBoard Conversations

**File:** server.py lines 4418, 4429

**Current code (UNSAFE):**
```python
await db.soundboard_conversations.update_one(...)  # MongoDB write
await db.soundboard_conversations.insert_one(...)  # MongoDB write
```

**Add comment guard:**
```python
# WARNING: MongoDB write is DEPRECATED
# SOURCE OF TRUTH: Supabase soundboard_conversations table
# TODO: Remove this write path after verifying Supabase writes work
await db.soundboard_conversations.update_one(...)
```

**Action:** Add warning comments (non-breaking)

---

## NEXT STEPS (After PROMPT 1)

1. Code review to verify write paths for profiles/documents/analyses
2. Add runtime guards to prevent accidental MongoDB writes
3. Add logging when deprecated paths are used
4. Plan phased removal of MongoDB writes (PROMPT 2)

---

**DUPLICATION CONTAINMENT: DECLARED (Code changes in next section)**
