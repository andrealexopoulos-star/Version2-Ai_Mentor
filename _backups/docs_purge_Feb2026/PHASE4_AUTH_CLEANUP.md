# PHASE 4: FRONTEND AUTH CLEANUP
**Date:** 2025-01-20
**Objective:** Remove MongoDB AuthContext, use only SupabaseAuthContext
**Status:** IN PROGRESS

---

## CURRENT STATE

### Files Using Old MongoDB Auth (AuthContext)
1. `/app/frontend/src/App.js` - ProtectedRoute, PublicRoute
2. `/app/frontend/src/components/DashboardLayout.js` - Logout, user display
3. `/app/frontend/src/pages/Advisor.js` - User access
4. `/app/frontend/src/pages/OnboardingWizard.js` - User data
5. `/app/frontend/src/pages/Dashboard.js` - User access
6. `/app/frontend/src/pages/DataCenter.js` - User access
7. `/app/frontend/src/pages/Settings.js` - User access
8. `/app/frontend/src/pages/BusinessProfile.js` - User access
9. `/app/frontend/src/pages/AdminDashboard.js` - Admin check
10. `/app/frontend/src/pages/Login.js` - OLD login page (deprecated)
11. `/app/frontend/src/pages/Register.js` - OLD register page (deprecated)

### Legacy Auth Pages to DELETE
- `/app/frontend/src/pages/Login.js` (MongoDB JWT login)
- `/app/frontend/src/pages/Register.js` (MongoDB registration)

---

## MIGRATION STRATEGY

### Step 1: Update App.js (ProtectedRoute & PublicRoute)
- Remove AuthContext import
- Remove MongoDB user checks
- Use only SupabaseAuthContext

### Step 2: Update DashboardLayout.js
- Remove MongoDB user/logout references
- Use only Supabase session

### Step 3: Update All Page Components
- Replace `useAuth()` with `useSupabaseAuth()`
- Replace `user` with `user` from Supabase context
- Update logout calls

### Step 4: Delete Legacy Pages
- Delete Login.js (old)
- Delete Register.js (old)
- Remove routes in App.js

### Step 5: Delete AuthContext.js
- Remove the file entirely
- Final cleanup

### Step 6: Test All Routes
- Test protected routes
- Test admin routes (if any)
- Test logout
- Test session persistence

---

## RISK ASSESSMENT

**Risk Level:** MEDIUM
- Multiple files affected
- Route protection is critical
- Must test thoroughly

**Mitigation:**
- Change one file at a time
- Test after each change
- Keep track of changes for rollback if needed

---

## EXECUTION LOG

**Status:** Starting Step 1...
