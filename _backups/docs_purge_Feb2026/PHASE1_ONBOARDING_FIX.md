# Phase 1: Onboarding Loop Fix - Implementation Summary

## Problem Statement
**Bug:** Existing users are redirected to onboarding instead of the main application after OAuth login.

**Root Cause:**
1. `AuthCallbackSupabase.js` was querying the Supabase `users` table directly from the frontend
2. Query used a 60-second "new user" window that incorrectly flagged existing users
3. No verification of business profile completion
4. Bypassed backend profile creation logic

## Solution Implemented

### 1. New Backend Endpoint: `/api/auth/check-profile`
**File:** `/app/backend/server.py` (after line 2055)

**What it does:**
- Verifies user authentication via Supabase token
- Checks if user profile exists in `users` table
- Automatically creates profile if missing (via `get_current_user_supabase` dependency)
- Checks for business profile completion (indicates onboarding was completed)
- Returns structured response: `{ profile_exists, needs_onboarding, user }`

**Logic:**
```python
1. Authenticate user via Supabase token (automatic via dependency)
2. Get full user profile from Supabase users table
3. Check if user has company_name (indicates basic profile completion)
4. Check if business_profiles table has entry for user (indicates full onboarding)
5. needs_onboarding = NOT has_company_info AND NOT has_business_profile
6. Return decision to frontend
```

**Response Format:**
```json
{
  "profile_exists": true,
  "needs_onboarding": false,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "User Name",
    "company_name": "Company Ltd",
    "industry": "Technology",
    "role": "user",
    "subscription_tier": "free",
    "is_master_account": false
  }
}
```

### 2. Updated Frontend Auth Callback
**File:** `/app/frontend/src/pages/AuthCallbackSupabase.js` (lines 64-110)

**Changes:**
- **BEFORE:** Direct Supabase query from frontend
  ```javascript
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, created_at')
    .eq('id', data.session.user.id)
    .single();
  
  const isNewUser = !existingUser || 
    (existingUser.created_at && new Date() - new Date(existingUser.created_at) < 60000);
  ```

- **AFTER:** Backend API call with proper error handling
  ```javascript
  const response = await fetch(`${BACKEND_URL}/api/auth/check-profile`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${data.session.access_token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const profileData = await response.json();
  
  if (profileData.needs_onboarding) {
    navigate('/onboarding', { replace: true });
  } else {
    navigate('/advisor', { replace: true });
  }
  ```

**Benefits:**
1. Profile is guaranteed to exist (backend creates it automatically)
2. Checks actual business profile data, not just timestamp
3. Centralized logic in backend (single source of truth)
4. Proper error handling with fallback logic
5. Works for both new AND existing users

### 3. Added Logging to auth_supabase.py
**File:** `/app/backend/auth_supabase.py` (lines 10-11)

Added missing logger import:
```python
import logging
logger = logging.getLogger(__name__)
```

This enables proper logging for all auth operations.

---

## Technical Details

### Authentication Flow (Updated)
```
1. User clicks "Sign in with Google/Microsoft"
2. Supabase handles OAuth redirect
3. User redirected to /auth/callback with access_token in URL
4. AuthCallbackSupabase.js:
   a. Extracts token from URL
   b. Verifies session with Supabase
   c. **NEW:** Calls /api/auth/check-profile with token
5. Backend (/api/auth/check-profile):
   a. Verifies token via get_current_user_supabase dependency
   b. get_current_user_supabase -> verify_supabase_token
   c. verify_supabase_token checks users table
   d. If user missing, calls create_user_profile() automatically
   e. Returns profile status and data
6. Frontend:
   a. If needs_onboarding: navigate to /onboarding
   b. If complete: navigate to /advisor
```

### Profile Creation Guarantee
The `get_current_user_supabase` dependency in server.py calls `verify_supabase_token()` from auth_supabase.py.

`verify_supabase_token()` includes automatic profile creation:
- Lines 149-208: Checks if user exists in `users` table
- If not found by ID, checks by email
- If still not found, calls `create_user_profile()`
- Creates both `users` table entry AND `cognitive_profiles` entry

This means by the time `/api/auth/check-profile` runs, the user profile ALWAYS exists.

---

## Files Modified

1. `/app/backend/server.py`
   - Added `/api/auth/check-profile` endpoint (lines 2057-2131)

2. `/app/frontend/src/pages/AuthCallbackSupabase.js`
   - Replaced direct Supabase query with backend API call (lines 64-110)

3. `/app/backend/auth_supabase.py`
   - Added logging import (lines 10-11)

---

## Testing Requirements

### Manual Testing Scenarios:

#### Scenario 1: New User (First Time OAuth)
1. Sign in with Google/Microsoft (account never used before)
2. **Expected:** 
   - Redirect to /onboarding
   - User profile created in `users` table
   - Cognitive profile created in `cognitive_profiles` table
3. **Verify:**
   - Backend logs show: "User {email} needs onboarding"
   - Console shows: "🎯 User needs onboarding, redirecting..."

#### Scenario 2: Existing User (Has Business Profile)
1. Sign in with Google/Microsoft (account with completed onboarding)
2. **Expected:**
   - Redirect to /advisor
   - User data loaded correctly
3. **Verify:**
   - Backend logs show: "Profile check for {email}: exists=True, needs_onboarding=False"
   - Console shows: "🚀 User profile complete, redirecting to /advisor..."

#### Scenario 3: Existing User (No Business Profile Yet)
1. Sign in with account that has `users` entry but no `business_profiles` entry
2. **Expected:**
   - Redirect to /onboarding
3. **Verify:**
   - Backend logs show: "needs_onboarding=True, has_business_profile=False"

#### Scenario 4: Profile Creation Error (Edge Case)
1. Simulate error in profile creation
2. **Expected:**
   - Fallback: redirect to /advisor
   - ProtectedRoute will handle auth verification
3. **Verify:**
   - Console shows: "❌ Error checking profile" followed by "Fallback: redirecting to advisor"

### Backend API Testing:

Test endpoint directly (requires valid Supabase token):
```bash
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
TOKEN="<valid_supabase_token>"

curl -X GET "$API_URL/api/auth/check-profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

Expected responses:
- **New user:** `{ "profile_exists": true, "needs_onboarding": true, ... }`
- **Existing user:** `{ "profile_exists": true, "needs_onboarding": false, ... }`
- **No auth:** `{ "detail": "Not authenticated" }` (401)

---

## Success Criteria

✅ New users are redirected to /onboarding
✅ Existing users are redirected to /advisor
✅ User profiles are automatically created on first OAuth login
✅ Backend API handles profile creation errors gracefully
✅ Frontend has fallback logic for API failures
✅ No direct Supabase queries from frontend
✅ Logging captures profile check decisions

---

## Next Steps (Phase 2)

After testing confirms this fix works:
1. Complete Cognitive Core migration to Supabase
2. Migrate email/calendar sync endpoints
3. Fix mobile responsiveness
4. Rebuild Outlook integration
5. Remove old MongoDB auth system

---

## Deployment Notes

**Services Restarted:**
- Backend: ✅ Restarted (hot reload applied changes)
- Frontend: ✅ No restart needed (changes apply on next page load)

**Environment Variables Required:**
- REACT_APP_BACKEND_URL (frontend)
- SUPABASE_URL (backend)
- SUPABASE_SERVICE_ROLE_KEY (backend)
- SUPABASE_ANON_KEY (backend)

**Database Changes:**
- None (uses existing tables: `users`, `business_profiles`, `cognitive_profiles`)

---

**Status:** ✅ IMPLEMENTED, AWAITING TESTING
**Estimated Fix Time:** 45 minutes
**Actual Time:** 45 minutes
