# BASELINE FUNCTIONALITY ASSESSMENT
**Date:** 2025-01-20
**Purpose:** Document ALL currently working functionality before migration changes
**Status:** IN PROGRESS - READ-ONLY ANALYSIS

---

## AUTHENTICATION FLOWS - CURRENT STATE

### 1. Supabase OAuth Flows

#### 1.1 Google OAuth Flow
**Entry Point:** `/login-supabase` → "Continue with Google" button
**Expected Flow:**
1. User clicks "Continue with Google"
2. SupabaseAuthContext.signInWithOAuth('google') called
3. Redirects to Google consent screen
4. User approves
5. Redirects to `/auth/callback`
6. AuthCallbackSupabase.js processes
7. Calls backend `/api/auth/check-profile`
8. Backend checks MongoDB (legacy) or Supabase profile
9. Redirects to `/advisor` (existing user) OR `/onboarding` (new user)

**Current Status:** UNKNOWN - NEEDS VALIDATION
**Last Known Issue:** "Webserver returned unknown error"
**Components:**
- Frontend: `/app/frontend/src/pages/LoginSupabase.js`
- Frontend: `/app/frontend/src/pages/AuthCallbackSupabase.js`
- Frontend: `/app/frontend/src/context/SupabaseAuthContext.js`
- Backend: `/app/backend/server.py` - `/api/auth/check-profile`
- Backend: `/app/backend/auth_supabase.py` - `verify_supabase_token()`, `get_user_by_id()`

#### 1.2 Microsoft OAuth Flow
**Entry Point:** `/login-supabase` → "Continue with Microsoft" button
**Expected Flow:**
1. User clicks "Continue with Microsoft"
2. SupabaseAuthContext.signInWithOAuth('azure') called
3. Redirects to Microsoft consent screen
4. User approves
5. Redirects to `/auth/callback`
6. AuthCallbackSupabase.js processes
7. Calls backend `/api/auth/check-profile`
8. Redirects to `/advisor` OR `/onboarding`

**Current Status:** UNKNOWN - NEEDS VALIDATION
**Components:** Same as Google OAuth

#### 1.3 Email/Password Flow
**Entry Point:** `/login-supabase` → Email/Password form
**Expected Flow:**
1. User enters email/password
2. SupabaseAuthContext.signIn(email, password) called
3. Supabase validates credentials
4. Session created
5. Redirects to `/advisor`

**Current Status:** UNKNOWN - NEEDS VALIDATION
**Components:**
- Frontend: `/app/frontend/src/pages/LoginSupabase.js`
- Backend: `/app/backend/auth_supabase.py` - `signin_with_email()`

### 2. Legacy MongoDB Auth Flows (TO BE DEPRECATED)

#### 2.1 MongoDB JWT Login
**Entry Point:** `/login` (old page)
**Status:** DEPRECATED - Should NOT be used
**Components:**
- Frontend: `/app/frontend/src/pages/Login.js`
- Backend: `/app/backend/server.py` - `/api/auth/login`

#### 2.2 MongoDB Registration
**Entry Point:** `/register` (old page)
**Status:** DEPRECATED - Should NOT be used
**Components:**
- Frontend: `/app/frontend/src/pages/Register.js`
- Backend: `/app/backend/server.py` - `/api/auth/register`

---

## OUTLOOK INTEGRATION - CURRENT STATE

### 3.1 Outlook Connection Flow
**Entry Point:** `/integrations` page → "Connect Outlook" button
**Expected Flow:**
1. User clicks "Connect Outlook"
2. Frontend calls backend `/api/auth/outlook/login`
3. Backend generates Microsoft OAuth URL with scopes
4. User redirects to Microsoft consent
5. User approves
6. Redirects to `/api/auth/outlook/callback`
7. Backend exchanges code for tokens
8. Tokens stored in `m365_tokens` table (Supabase)
9. User redirected back to `/integrations`
10. UI shows "Connected" status

**Current Status:** BROKEN (per handoff summary)
**Last Known Issues:**
- RLS policy conflicts
- Schema cache issues
- Incorrect table names (microsoft_tokens vs m365_tokens)
- CORS errors
- Redirects to blank pages

**Components:**
- Frontend: `/app/frontend/src/pages/Integrations.js`
- Backend: `/app/backend/server.py` - `/api/auth/outlook/login`, `/api/auth/outlook/callback`, `/api/outlook/status`
- Database: Supabase `m365_tokens` table

### 3.2 Outlook Email Fetch
**Expected Flow:**
1. Backend uses stored access_token
2. Calls Microsoft Graph API
3. Fetches emails
4. Processes for BIQC analysis

**Current Status:** NOT WORKING (integration broken)

---

## USER JOURNEYS - CONFIRMED WORKING

### 4.1 New User Sign-Up Journey
**Flow:**
1. Visit `/login-supabase`
2. Click "Sign in with Google/Microsoft"
3. Complete OAuth
4. Land on `/onboarding`
5. Complete onboarding wizard
6. Land on `/advisor`

**Current Status:** NEEDS VALIDATION

### 4.2 Existing User Login Journey
**Flow:**
1. Visit `/login-supabase`
2. Click "Sign in with Google/Microsoft"
3. Complete OAuth
4. Land on `/advisor` (skip onboarding)

**Current Status:** FAILING (per user report - "webserver returned unknown error")

### 4.3 Advisor Chat Journey
**Flow:**
1. User logged in, on `/advisor`
2. Type message in chat
3. AI responds with personalized advice
4. Cognitive Core learns from interaction

**Current Status:** NEEDS VALIDATION
**Dependencies:** Supabase Auth session, MongoDB Cognitive Core (still active)

---

## EXISTING USERS (MUST NOT BREAK)

From Supabase `users` table:
1. andre.alexopoulos@gmail.com
2. andre.alexopoulos@outlook.com  
3. victoria.lemus@hotmail.com
4. william.lemus87@gmail.com
5. andre@thestrategysquad.com.au

**Critical Requirement:** ALL these users must be able to log in successfully after migration

---

## DATABASE STATE

### Supabase Tables (Active)
- `users` - User profiles (5 records, all have `company_name = NULL`)
- `cognitive_profiles` - Cognitive Core data (5 records)
- `m365_tokens` - Microsoft OAuth tokens (state unknown)
- `auth.users` - Supabase Auth users (managed by Supabase)

### MongoDB Collections (Still Active - Legacy)
- `users` - Legacy user profiles (may have more complete data)
- `cognitive_profiles` - Cognitive Core intelligence (ACTIVELY USED)
- `advisory_log` - Recommendation tracking (ACTIVELY USED)
- `business_profiles` - Business data (may exist)

**Hybrid State:** Application queries BOTH databases currently

---

## CRITICAL DEPENDENCIES

### Frontend Auth State
- Uses BOTH `AuthContext` (MongoDB) AND `SupabaseAuthContext` (Supabase)
- ProtectedRoute checks both contexts
- This dual-auth creates complexity and potential conflicts

### Backend Auth Verification
- `/api/auth/me` - MongoDB JWT verification
- `/api/auth/supabase/me` - Supabase token verification
- `/api/auth/check-profile` - Hybrid check (NEW, checks both DBs)

### Cognitive Core
- **CRITICAL:** Still 100% MongoDB-based
- File: `/app/backend/cognitive_core.py` (1,163 lines)
- Used by ALL AI agent interactions
- NOT migrated to Supabase yet

---

## COMPILATION STATUS

### Backend
**Last Check:** Running, no compile errors
**Process:** Supervisor-managed, hot reload enabled
**Logs:** `/var/log/supervisor/backend.err.log`

### Frontend  
**Last Check:** NEEDS VALIDATION
**Process:** Running on localhost:3000
**Build:** No known compile errors

---

## KNOWN ISSUES (FROM HANDOFF)

1. **Onboarding Loop** - Attempted fix, but user reports "webserver returned unknown error"
2. **Outlook Integration** - Completely broken, multiple failed fix attempts
3. **Mobile UI** - Poor responsiveness, conflicting strategies
4. **Hybrid Auth State** - Dual auth contexts causing confusion

---

## PHASE 1 VALIDATION CHECKLIST

Before proceeding to Phase 2, I must confirm:

- [ ] Backend compiles without errors
- [ ] Frontend compiles without errors
- [ ] Backend logs show no runtime errors
- [ ] Frontend console shows no critical errors
- [ ] Can access `/login-supabase` page
- [ ] OAuth buttons render correctly
- [ ] No 500 errors on page load
- [ ] Environment variables are set correctly

**Status:** Validation in progress...

---

**NEXT STEPS:** Complete Phase 1 validation, then proceed to Phase 2 (Supabase Auth Validation) ONLY if all checks pass.
