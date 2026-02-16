# REMAINING MIGRATION TASKS: 103 MongoDB References

## DETAILED BREAKDOWN BY COLLECTION

---

## 1. USERS TABLE (22 references) - 3-4 hours

### What these are:
- User lookup queries in old endpoints
- MongoDB JWT auth helper functions
- Admin user management

### Line numbers in server.py:
- Line 711: get_current_user() - MongoDB JWT verification
- Line 713: Account ID update
- Line 769: User profile fetch (no password)
- Line 1567: Outlook token check (legacy)
- Line 2142: Legacy user check in check-profile
- Line 3124: User fetch for reply suggestion
- Line 3470: User fetch for priority analysis
- Line 3878: User existence check
- Line 3941: User insert (legacy)
- Line 4923: User update
- Line 5322, 5746, 5755, 5767: User profile fetches
- Line 6384, 6389, 6395: Admin user listing/counting
- Line 6415, 6419: Admin user update
- Line 6427: Admin user delete
- Line 6499: User document fetch

### Migration tasks:
1. Replace `db.users.find_one()` with `get_user_by_id_supabase()` (already exists)
2. Replace `db.users.update_one()` with Supabase update
3. Replace `db.users.count_documents()` with Supabase count
4. Remove or update legacy auth functions (get_current_user)

**Estimated time:** 3-4 hours

---

## 2. DATA_FILES TABLE (12 references) - 2 hours

### What these are:
- File upload metadata storage
- File listing and counting
- File retrieval for AI context

### Operations:
- 6x `db.data_files.find()` - Get file lists
- 3x `db.data_files.find_one()` - Get specific file
- 2x `db.data_files.count_documents()` - Count files
- 2x `db.data_files.aggregate()` - Aggregate queries
- 1x `db.data_files.insert_one()` - Create file (already migrated)
- 1x `db.data_files.delete_one()` - Delete file

### Migration tasks:
1. Migrate find() queries to `get_user_data_files_supabase()`
2. Migrate aggregate() to Supabase queries
3. Add delete helper function

**Estimated time:** 2 hours

---

## 3. ANALYSES TABLE (9 references) - 1.5 hours

### What these are:
- Business analysis storage
- Analysis retrieval
- Analysis counting

### Operations:
- 3x `db.analyses.find()` - Get analyses
- 3x `db.analyses.count_documents()` - Count analyses
- 1x `db.analyses.insert_one()` - Create (already migrated)
- 1x `db.analyses.find_one()` - Get specific analysis
- 1x `db.analyses.delete_one()` - Delete analysis
- 1x `db.analyses.delete_many()` - Delete user analyses

### Migration tasks:
1. Replace find() with `get_user_analyses_supabase()`
2. Replace count with Supabase count
3. Add delete helpers

**Estimated time:** 1.5 hours

---

## 4. SOUNDBOARD_CONVERSATIONS TABLE (7 references) - 1.5 hours

### What these are:
- MySoundboard voice partner conversations
- Session management

### Operations:
- 2x `db.soundboard_conversations.find_one()` - Get conversation (already migrated)
- 2x `db.soundboard_conversations.update_one()` - Update conversation (already migrated)
- 1x `db.soundboard_conversations.insert_one()` - Create (already migrated)
- 1x `db.soundboard_conversations.find()` - List conversations
- 1x `db.soundboard_conversations.delete_one()` - Delete

### Migration tasks:
1. Add list and delete helper functions
2. Replace remaining calls

**Estimated time:** 1.5 hours

---

## 5. ONBOARDING TABLE (7 references) - 1.5 hours

### What these are:
- Onboarding wizard data storage
- Onboarding progress tracking

### Operations:
- 5x `db.onboarding.find_one()` - Get onboarding data
- 2x `db.onboarding.update_one()` - Update progress

### Migration tasks:
1. Create Supabase `onboarding` table
2. Create helper functions
3. Migrate all queries

**Estimated time:** 1.5 hours

---

## 6. CHAT_HISTORY TABLE (7 references) - 1 hour

### What these are:
- Chat conversation history
- Session tracking

### Operations:
- Already migrated: insert, delete_many
- Remaining: 4x find(), 1x distinct(), 2x count_documents(), 1x aggregate()

### Migration tasks:
1. Migrate find() queries to `get_chat_history_supabase()`
2. Migrate distinct() for session listing
3. Migrate count() queries
4. Migrate aggregate() for chat statistics

**Estimated time:** 1 hour

---

## 7. BUSINESS_PROFILES_VERSIONED (5 references) - 1 hour

### What these are:
- Versioned business profile system
- Profile change tracking

### Operations:
- 2x find_one() - Get versioned profile
- 1x update_one() - Update version
- 1x insert_one() - Create version
- 1x find() - List versions

### Migration tasks:
1. Create `business_profiles_versioned` Supabase table
2. Create helper functions
3. Migrate queries

**Estimated time:** 1 hour

---

## 8. MINOR COLLECTIONS (45 references) - 4-5 hours

### Collections:
- **email_priority_analysis** (4 refs) - Update calls need migration
- **calendar_events** (4 refs) - Straggler refs
- **web_sources** (3 refs) - Web scraping data
- **sops** (3 refs) - SOP documents
- **outlook_emails** (3 refs) - Stragglers
- **invites** (3 refs) - User invites
- **oac_usage** (2 refs) - Operations Advisory Centre usage
- **oac_recommendations** (2 refs) - OAC recommendations
- **email_intelligence** (2 refs) - Stragglers
- **documents** (2 refs) - Stragglers
- **diagnoses** (2 refs) - Business diagnosis
- **settings** (2 refs) - App settings
- **dismissed_notifications** (1 ref) - Notification tracking
- **calendar_intelligence** (1 ref) - Straggler
- **business_profiles** (1 ref) - Straggler
- **accounts** (1 ref) - Account system (if multi-tenant)

### Migration tasks:
1. Create Supabase tables for missing collections
2. Create helper functions
3. Migrate all queries
4. Test each feature

**Estimated time:** 4-5 hours

---

## TOTAL REMAINING EFFORT: 16-20 HOURS

### Breakdown:
1. users table: 3-4 hours
2. data_files: 2 hours
3. analyses: 1.5 hours
4. soundboard_conversations: 1.5 hours
5. onboarding: 1.5 hours
6. chat_history: 1 hour
7. business_profiles_versioned: 1 hour
8. Minor collections: 4-5 hours
9. Testing: 2 hours

**GRAND TOTAL: 16-20 hours**

---

## ALTERNATIVE: KEEP HYBRID ARCHITECTURE

### What to Keep on MongoDB (if not migrating):
- users table (admin queries, not user-facing)
- data_files (file metadata, working fine)
- Minor collections (low usage features)

### What's Already Supabase (Core Features):
- ✅ Authentication
- ✅ Outlook integration
- ✅ Cognitive Core
- ✅ Email/Calendar storage
- ✅ Documents
- ✅ Business profiles
- ✅ Intelligence collections

### Hybrid Benefits:
- Stable system NOW
- Focus on user features
- Complete migration later if needed
- ~85% already migrated

**Time Saved:** 16-20 hours → Invest in mobile + BIQC instead

---

## YOUR CALL

**Option A:** Complete remaining 103 refs (16-20 hours)
**Option B:** Keep hybrid, move to mobile + BIQC (6-8 hours) ← **RECOMMENDED**

What would you like to do?
