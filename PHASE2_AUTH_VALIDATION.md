# PHASE 2: SUPABASE AUTH VALIDATION (GATE 1)
**Date:** 2025-01-20
**Objective:** Validate Supabase auth flows work 100% reliably
**Failure Criteria:** Any auth flow that doesn't complete end-to-end = FAIL AND STOP

---

## TEST PLAN

### Test 1: Google OAuth Flow
**Steps:**
1. Navigate to `/login-supabase`
2. Click "Continue with Google"
3. Complete OAuth consent
4. Verify redirect to `/auth/callback`
5. Verify backend `/api/auth/check-profile` is called
6. Verify redirect to `/advisor` or `/onboarding`
7. Verify session persists on refresh

**Expected Result:** User lands on correct page, no errors
**Status:** PENDING

### Test 2: Microsoft OAuth Flow  
**Steps:**
1. Navigate to `/login-supabase`
2. Click "Continue with Microsoft"
3. Complete OAuth consent
4. Verify redirect to `/auth/callback`
5. Verify backend `/api/auth/check-profile` is called
6. Verify redirect to `/advisor` or `/onboarding`
7. Verify session persists on refresh

**Expected Result:** User lands on correct page, no errors
**Status:** PENDING

### Test 3: Email/Password Flow
**Steps:**
1. Navigate to `/login-supabase`
2. Enter valid email/password
3. Click "Sign in"
4. Verify redirect to `/advisor`
5. Verify session persists on refresh

**Expected Result:** User lands on `/advisor`, no errors
**Status:** PENDING

---

## BACKEND ENDPOINT TEST

Before testing UI flow, verify backend endpoint works correctly:

### Endpoint: `/api/auth/check-profile`
**Method:** GET
**Auth:** Bearer token (Supabase JWT)
**Expected Response:**
```json
{
  "profile_exists": true,
  "needs_onboarding": false,
  "user": {
    "id": "...",
    "email": "...",
    "full_name": "...",
    "company_name": "...",
    "role": "user"
  }
}
```

**Test Status:** NEEDS VALIDATION

---

## CURRENT ISSUE TO RESOLVE

**User Report:** "Webserver returned unknown error"

**Hypothesis:** Backend `/api/auth/check-profile` endpoint may have a bug

**Investigation Steps:**
1. Check backend logs for errors during auth callback
2. Verify endpoint logic is correct
3. Test endpoint with curl (if possible)
4. Identify exact error message

**Status:** IN PROGRESS

---