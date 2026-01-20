# Supabase Migration Audit Report
**Generated:** $(date)
**Status:** HYBRID STATE - INCOMPLETE MIGRATION

## Executive Summary
The application is in a critical hybrid state with MongoDB and Supabase coexisting, causing authentication bugs and data inconsistency. This report details the exact migration gaps.

---

## 🔴 CRITICAL FINDINGS

### 1. AUTHENTICATION SYSTEM - DUAL STACK ACTIVE
**Problem:** Two authentication systems running in parallel

#### Frontend Auth Context Analysis:
- **OLD MongoDB Auth:** `/app/frontend/src/context/AuthContext.js` (82 lines)
  - Still imported by 12+ components
  - Uses JWT tokens + localStorage
  - Connected to `/api/auth/login` (MongoDB backend)
  
- **NEW Supabase Auth:** `/app/frontend/src/context/SupabaseAuthContext.js` (239 lines)
  - Uses Supabase Auth with OAuth
  - Session-based authentication
  - Connected to Supabase PostgreSQL

#### Components Still Using MongoDB Auth:
1. `/app/frontend/src/App.js` - ProtectedRoute & PublicRoute check BOTH
2. `/app/frontend/src/components/DashboardLayout.js` - Uses both `mongoUser` and `supabaseUser`
3. `/app/frontend/src/pages/Advisor.js` - Checks `mongoUser`
4. `/app/frontend/src/pages/OnboardingWizard.js` - Uses `mongoUser`
5. `/app/frontend/src/pages/Login.js` - Old MongoDB login page
6. `/app/frontend/src/pages/Register.js` - Old MongoDB register page
7. `/app/frontend/src/pages/Dashboard.js` - Uses old auth
8. `/app/frontend/src/pages/DataCenter.js` - Uses old auth
9. `/app/frontend/src/pages/Settings.js` - Uses old auth
10. `/app/frontend/src/pages/BusinessProfile.js` - Uses old auth
11. `/app/frontend/src/pages/AdminDashboard.js` - Uses old auth

**Impact:** This creates conflicting auth states and is the root cause of the onboarding loop bug.

---

### 2. COGNITIVE CORE - INCOMPLETE MIGRATION
**Problem:** Two versions exist, MongoDB version is still active

#### MongoDB Version (ACTIVE):
- **File:** `/app/backend/cognitive_core.py` (1,163 lines)
- **Status:** FULLY FUNCTIONAL - Currently in use
- **Database:** MongoDB collections: `cognitive_profiles`, `advisory_log`
- **Methods:** 30+ methods fully implemented

#### Supabase Version (STUB):
- **File:** `/app/backend/cognitive_core_supabase.py` (209 lines)
- **Status:** INCOMPLETE - Only 2 methods migrated
- **Migrated:** `get_profile()`, `_create_initial_profile()`
- **NOT Migrated:** 28+ methods including:
  - `observe()` - Critical for learning
  - `get_context_for_agent()` - Used by all AI agents
  - `log_recommendation()` - Advisory tracking
  - `calculate_escalation_state()` - Urgency detection
  - `calculate_confidence()` - Decision support
  - All advisory log methods
  - All behavioral tracking methods

**Impact:** The Cognitive Core (BIQC's intelligence layer) is 100% dependent on MongoDB.

---

### 3. BACKEND DATABASE ACCESS - 190+ MONGODB CALLS
**Problem:** `server.py` has 190+ direct MongoDB database calls

#### Key MongoDB Dependencies in server.py:
- Line 59-61: MongoDB client initialization
- Line 64: Cognitive Core initialized with MongoDB
- Multiple endpoints query MongoDB directly:
  - User management endpoints
  - Business profile endpoints
  - Document storage
  - Email/Calendar sync data
  - Advisory recommendations

**Specific High-Impact MongoDB Usage:**
- Lines 1433-1842: All Cognitive Core calls use MongoDB version
- Email sync endpoints: Still store data in MongoDB
- Calendar sync endpoints: Still store data in MongoDB
- Document parsing: Still store in MongoDB

---

### 4. SUPABASE TABLES - PARTIALLY UTILIZED

#### Tables Created (from handoff):
✅ `users` - User profiles (linked to auth.users)
✅ `cognitive_profiles` - Cognitive Core data
✅ `m365_tokens` - Microsoft OAuth tokens
❓ `advisory_log` - Unknown if created
❓ `email_sync_data` - Unknown if created
❓ `calendar_sync_data` - Unknown if created
❓ `documents` - Unknown if created

#### Tables Currently Used:
- `users` - Partially (only for OAuth sign-up in SupabaseAuthContext)
- `cognitive_profiles` - Only for initial creation, never queried afterward
- `m365_tokens` - Attempted use, but broken

---

## 📊 MIGRATION COMPLETION STATUS

| Component | MongoDB | Supabase | Status |
|-----------|---------|----------|--------|
| **Frontend Auth** | ✅ Active | ⚠️ Parallel | HYBRID |
| **Backend Auth Endpoints** | ✅ Active | ⚠️ Partial | HYBRID |
| **Cognitive Core** | ✅ Active | ❌ Stub Only | NOT MIGRATED |
| **User Profiles** | ✅ Active | ⚠️ OAuth Only | HYBRID |
| **Email Sync** | ✅ Active | ❌ None | NOT MIGRATED |
| **Calendar Sync** | ✅ Active | ❌ None | NOT MIGRATED |
| **Documents** | ✅ Active | ❌ None | NOT MIGRATED |
| **Advisory Log** | ✅ Active | ❌ None | NOT MIGRATED |
| **M365 Integration** | N/A | ❌ Broken | BROKEN |

**Overall Migration:** ~15% Complete

---

## 🎯 ROOT CAUSE OF CURRENT BUGS

### Bug: Onboarding Loop for Existing Users
**File:** `/app/frontend/src/pages/AuthCallbackSupabase.js` (Lines 71-91)

**Current Logic:**
```javascript
const { data: existingUser } = await supabase
  .from('users')
  .select('id, created_at')
  .eq('id', data.session.user.id)
  .single();

const isNewUser = !existingUser || 
  (existingUser.created_at && new Date() - new Date(existingUser.created_at) < 60000);
```

**Problem:** 
1. Query only checks Supabase `users` table
2. If user signed up via MongoDB originally, they don't exist in Supabase `users`
3. Even if they exist, the 60-second "new user" window is too broad
4. No fallback check for MongoDB user data

**Why It Fails:**
- User exists in MongoDB `users` collection
- User does NOT exist in Supabase `users` table
- Result: Treated as "new" → sent to onboarding

---

### Bug: User Profile Not Created on Sign-Up
**File:** `/app/backend/auth_supabase.py`

**Problem:**
- Function `create_user_profile_if_not_exists()` exists but may not be called correctly
- Race condition: Supabase creates auth.users entry, but app fails to create `users` table entry
- RLS policies may block the insert

---

## 📋 REQUIRED ACTIONS

### PHASE 1: STABILIZE AUTH (PRIORITY P0)

#### Action 1.1: Fix Onboarding Loop
**Files to modify:**
- `/app/frontend/src/pages/AuthCallbackSupabase.js`

**Solution:**
- Query backend API to check user existence (checks both MongoDB AND Supabase)
- Backend endpoint: Create `/api/auth/check-profile` that returns profile status
- Only redirect to onboarding if NO profile exists in either database

#### Action 1.2: Fix Profile Creation
**Files to modify:**
- `/app/backend/auth_supabase.py`
- `/app/backend/server.py`

**Solution:**
- Ensure `create_user_profile_if_not_exists()` is called EVERY time after OAuth callback
- Add error logging and retry logic
- Verify RLS policies allow insert

---

### PHASE 2: COMPLETE COGNITIVE CORE MIGRATION

#### Action 2.1: Migrate All Methods
**Files to modify:**
- `/app/backend/cognitive_core_supabase.py`

**Methods to migrate (in order):**
1. `observe()` - Core learning function
2. `get_context_for_agent()` - Used by all AI agents (13 calls in server.py)
3. `log_recommendation()` - Advisory tracking
4. `record_recommendation_outcome()` - Outcome tracking
5. `calculate_escalation_state()` - Urgency detection
6. `calculate_confidence()` - Decision support
7. `get_known_information()` - Context retrieval
8. `get_questions_asked()` - Question tracking
9. `get_ignored_advice_for_escalation()` - Escalation logic
10. All remaining methods

**Estimated Effort:** 
- Core methods (1-6): 3-4 hours
- Remaining methods: 2-3 hours
- Testing: 2 hours
- **Total: ~8 hours**

#### Action 2.2: Create Missing Supabase Tables
**Tables to create:**
- `advisory_log` (if missing)
- `email_sync_data` (if missing)
- `calendar_sync_data` (if missing)
- `business_documents` (if missing)

#### Action 2.3: Switch server.py to Use Supabase Cognitive Core
**Files to modify:**
- `/app/backend/server.py` (Line 23-24, Line 64)

**Change:**
```python
# OLD:
from cognitive_core import CognitiveCore, init_cognitive_core, get_cognitive_core
cognitive_core = init_cognitive_core(db)  # MongoDB

# NEW:
from cognitive_core_supabase import CognitiveCore, init_cognitive_core, get_cognitive_core
cognitive_core = init_cognitive_core(supabase_admin)  # Supabase
```

---

### PHASE 3: MIGRATE DATA SYNC ENDPOINTS

#### Action 3.1: Migrate Email Sync
**Endpoints to update:**
- Email fetch endpoints
- Email storage logic

**Change:** Store email data in Supabase tables instead of MongoDB

#### Action 3.2: Migrate Calendar Sync
**Endpoints to update:**
- Calendar fetch endpoints
- Calendar storage logic

**Change:** Store calendar data in Supabase tables instead of MongoDB

---

### PHASE 4: REMOVE MONGODB DEPENDENCIES

#### Action 4.1: Remove Old Auth Context
**Files to delete:**
- `/app/frontend/src/context/AuthContext.js`
- `/app/frontend/src/pages/Login.js` (old MongoDB login)
- `/app/frontend/src/pages/Register.js` (old MongoDB register)

**Files to update:**
Remove all imports of `useAuth` from `AuthContext.js`:
- App.js
- DashboardLayout.js
- Advisor.js
- OnboardingWizard.js
- Dashboard.js
- DataCenter.js
- Settings.js
- BusinessProfile.js
- AdminDashboard.js

#### Action 4.2: Remove MongoDB Backend Endpoints
**File:** `/app/backend/server.py`

**Endpoints to remove:**
- `/api/auth/login` (old JWT login)
- `/api/auth/register` (old registration)
- Any other MongoDB-specific auth endpoints

#### Action 4.3: Remove MongoDB Client
**File:** `/app/backend/server.py`

**Lines to remove:**
- Lines 59-61 (MongoDB connection)
- Line 6 (import statement)

---

## ⚠️ RISKS & BLOCKERS

### Risk 1: Data Loss
**Concern:** Users who signed up via MongoDB may lose access if migration is rushed
**Mitigation:** 
- Keep MongoDB read-only during transition
- Migrate existing MongoDB users to Supabase before removing MongoDB
- Create data migration script

### Risk 2: Cognitive Core Intelligence Loss
**Concern:** All learned user behavior is in MongoDB cognitive profiles
**Mitigation:**
- Export all MongoDB cognitive_profiles
- Import into Supabase cognitive_profiles
- Verify data integrity before switching

### Risk 3: Breaking Changes During Migration
**Concern:** App may break during intermediate migration steps
**Mitigation:**
- Maintain hybrid state until full migration complete
- Test each phase thoroughly before proceeding
- Use feature flags if possible

---

## 🧪 TESTING REQUIREMENTS

### After Each Phase:
1. **Auth Testing:**
   - New user sign-up (Google & Microsoft)
   - Existing user login (Google & Microsoft)
   - Profile creation verification
   - Onboarding flow for new users
   - Dashboard access for existing users

2. **Cognitive Core Testing:**
   - Profile retrieval
   - Observation logging
   - Context generation for agents
   - Advisory log recording
   - Confidence calculation

3. **Integration Testing:**
   - End-to-end user flow
   - AI agent interactions
   - Data persistence across sessions

---

## 📈 SUCCESS CRITERIA

Migration is complete when:
- ✅ Zero MongoDB imports in server.py
- ✅ AuthContext.js deleted
- ✅ All components use SupabaseAuthContext only
- ✅ cognitive_core_supabase.py has 100% method parity
- ✅ All endpoints query Supabase only
- ✅ MongoDB client removed from codebase
- ✅ All existing users can log in successfully
- ✅ Cognitive Core maintains learned intelligence
- ✅ Testing agent passes all auth & core functionality tests

---

## 🛠️ RECOMMENDED EXECUTION ORDER

1. ✅ **Fix onboarding loop** (1 hour) - IMMEDIATE
2. ✅ **Fix profile creation** (30 min) - IMMEDIATE
3. ⏳ **Complete Cognitive Core migration** (8 hours)
4. ⏳ **Migrate email/calendar sync** (3 hours)
5. ⏳ **Remove old auth system from frontend** (2 hours)
6. ⏳ **Remove MongoDB from backend** (1 hour)
7. ⏳ **Full system testing** (3 hours)

**Total Estimated Time:** ~18.5 hours

---

**Report End**
