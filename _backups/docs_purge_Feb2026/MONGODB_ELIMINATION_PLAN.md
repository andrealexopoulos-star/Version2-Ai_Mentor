# ============================================================
# MONGODB ELIMINATION PLAN
# Complete removal of MongoDB dependency from BIQC
# ============================================================

## CURRENT STATUS: HYBRID (MongoDB + Supabase)

### WATCHTOWER: 100% Supabase ✅
- outlook_emails → Supabase (43 rows, actively syncing)
- watchtower_events → Supabase (1 event)
- Intelligence RPCs → Supabase PostgreSQL functions
- Email sync worker → Supabase only

### STILL USING MONGODB:
- Legacy auth fallback (40 MongoDB calls in server.py)
- Historical data (chat_history, data_files, analyses)
- Soundboard (partial)


## PHASE 1: REMOVE MONGODB AUTH FALLBACK (COMPLETED)
## ============================================================

✅ Modified get_current_user() in server.py
✅ Removed MongoDB JWT validation fallback
✅ All auth now Supabase-only

**Impact:**
- Legacy MongoDB-only users can no longer log in
- Must use Supabase Auth (Google/Microsoft OAuth or email/password)


## PHASE 2: REDIRECT MONGODB READS TO SUPABASE
## ============================================================

**Collections with MongoDB reads that need Supabase equivalents:**

### 2.1 chat_history (32 documents)
**MongoDB calls:** 6 instances
**Action:** Return empty array (no migration - fresh start)

```python
# OLD: await db.chat_history.find(...)
# NEW: await get_chat_history_supabase(supabase_admin, user_id, session_id)
```

### 2.2 data_files (active reads)
**MongoDB calls:** 8 instances
**Action:** Use supabase helpers (already exist)

```python
# OLD: await db.data_files.find(...)
# NEW: await get_user_data_files_supabase(supabase_admin, user_id)
```

### 2.3 analyses (3 documents)
**MongoDB calls:** 6 instances  
**Action:** Use supabase helpers (already exist)

```python
# OLD: await db.analyses.find(...)
# NEW: await get_user_analyses_supabase(supabase_admin, user_id)
```

### 2.4 soundboard_conversations (6 documents)
**MongoDB calls:** 2 instances
**Action:** Use supabase helpers (already exist)

```python
# OLD: await db.soundboard_conversations.update_one(...)
# NEW: await update_soundboard_conversation_supabase(...)
```

### 2.5 documents (5 documents)
**Action:** Already using Supabase helpers


## PHASE 3: CLEANUP MONGODB DATA
## ============================================================

**Script created:** /app/backend/cleanup_mongodb.py

**What it does:**
- Deletes all MongoDB collections
- Resets all test data
- Prepares for MongoDB service shutdown

**Run when ready:**
```bash
cd /app/backend
python3 cleanup_mongodb.py
# Type "DELETE ALL" to confirm
```


## PHASE 4: REMOVE MONGODB FROM CODEBASE
## ============================================================

### 4.1 Remove MongoDB Initialization
```python
# REMOVE from server.py:
from motor.motor_asyncio import AsyncIOMotorClient
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
```

### 4.2 Remove Shutdown Handler
```python
# REMOVE from server.py:
@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
```

### 4.3 Update requirements.txt
```bash
# REMOVE:
motor==3.3.1
```

### 4.4 Update supervisor config
```bash
# REMOVE mongodb service from:
/etc/supervisor/conf.d/supervisord.conf
```


## PHASE 5: VERIFY 100% SUPABASE
## ============================================================

**After MongoDB removal, verify:**

✅ All email data → outlook_emails (Supabase)
✅ All intelligence → watchtower_events (Supabase)
✅ All users → auth.users + users table (Supabase)
✅ All chat → chat_messages (Supabase)
✅ All documents → documents (Supabase)
✅ All files → data_files (Supabase)
✅ All integrations → merge_integrations (Supabase)

**MongoDB usage: ZERO**


## RECOMMENDED EXECUTION ORDER
## ============================================================

1. ✅ Remove auth fallback (DONE - in this response)
2. ⏭️ Comment out MongoDB reads (will do next)
3. ⏭️ Test application works without MongoDB
4. ⏭️ Run cleanup_mongodb.py (delete all data)
5. ⏭️ Stop MongoDB service
6. ⏭️ Remove Motor from requirements.txt
7. ⏭️ Remove MongoDB initialization code


## IMMEDIATE NEXT STEP
## ============================================================

Should I proceed to:
A) Comment out all remaining MongoDB read operations?
B) Provide complete code changes to remove MongoDB entirely?
C) Create migration verification script?
