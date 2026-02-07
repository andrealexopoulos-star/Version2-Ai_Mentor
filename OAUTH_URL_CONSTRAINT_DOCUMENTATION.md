# BIQC AUTHENTICATION ENVIRONMENT — OAUTH URL CONSTRAINT

**Date:** December 23, 2024  
**Priority:** P0 - Auth Stability Documentation  
**Type:** Environment Alignment (No Code Changes)

---

## CURRENT SITUATION

### Canonical OAuth URL (Supabase Configured)
**Working URL:** `https://auth-loop-fix-4.preview.emergentagent.com`

This URL is configured in Supabase as the authorized OAuth redirect URL for:
- Microsoft OAuth (Outlook integration)
- Google OAuth (if configured)

### Current Preview URL (This Fork)
**Active URL:** `https://auth-loop-fix-4.preview.emergentagent.com`

**Environment Variables:**
```
REACT_APP_BACKEND_URL=https://auth-loop-fix-4.preview.emergentagent.com
FRONTEND_URL=https://auth-loop-fix-4.preview.emergentagent.com
BACKEND_URL=https://auth-loop-fix-4.preview.emergentagent.com
```

---

## THE MISMATCH

### OAuth Flow Expectation:
1. User clicks "Sign in with Microsoft" on `business-iq-1`
2. Microsoft redirects to Supabase
3. Supabase redirects to configured callback: `advisor-chat-1` ❌
4. User lands on different URL than they started
5. Session confusion / redirect loop

### Why This Happens:
- **Emergent preview URLs change with each fork**
- **Supabase OAuth URLs are fixed** (configured once)
- Each fork gets a new preview URL (business-iq-1, business-iq-2, etc.)
- But Supabase still redirects to the original URL (advisor-chat-1)

---

## CANONICAL URL BEHAVIOR

### ✅ What WORKS at advisor-chat-1:
- Microsoft OAuth login
- Google OAuth login (if configured)
- OAuth callback handling
- Session persistence
- All integrations requiring OAuth

### ❌ What DOES NOT WORK at business-iq-1:
- Microsoft OAuth (redirects to advisor-chat-1)
- Google OAuth (redirects to advisor-chat-1)
- Any OAuth-dependent flow

### ✅ What STILL WORKS at business-iq-1:
- Email/password login (Supabase direct)
- Regular API calls
- All non-OAuth features
- Session management (if logged in via advisor-chat-1 first)

---

## TESTING GUIDELINES

### For OAuth Testing (Microsoft/Google Login):
**USE ONLY:** `https://auth-loop-fix-4.preview.emergentagent.com`

**Workflow:**
1. Navigate to: `https://auth-loop-fix-4.preview.emergentagent.com`
2. Click "Sign in with Microsoft" or "Sign in with Google"
3. Complete OAuth flow
4. Will redirect back to advisor-chat-1 ✅
5. Session persists correctly

### For Non-OAuth Testing (Email/Password, Features):
**CAN USE:** `https://auth-loop-fix-4.preview.emergentagent.com` (this fork)

**Workflow:**
1. Use email/password login (no OAuth)
2. Test all features except OAuth-dependent ones
3. Session works normally

### Cross-URL Session Sharing:
**Possible:** If you log in at advisor-chat-1, then navigate to business-iq-1
- Session MAY persist (shared Supabase instance)
- But NOT guaranteed (different domains)
- Best practice: Stay on one URL per session

---

## LIMITATIONS DOCUMENTED

### New Preview URLs (Forks):
- ✅ Run application code
- ✅ Access backend APIs
- ✅ Email/password auth
- ❌ OAuth login (redirects to canonical URL)
- ❌ OAuth integrations (Outlook, Google)

### Why We Can't Fix This Without Supabase Changes:
To support multiple preview URLs, would need to:
1. Add ALL preview URLs to Supabase allowed list (not scalable)
2. Use wildcard domains (not supported by Supabase)
3. Reconfigure OAuth per fork (defeats purpose of forking)

**Decision:** Accept canonical URL limitation instead.

---

## RECOMMENDED WORKFLOW

### During Development (Using Forks):
1. **Test features** on current fork URL (business-iq-1)
2. **Test OAuth flows** on canonical URL (advisor-chat-1)
3. Document that OAuth requires canonical URL
4. Use email/password for quick auth testing on forks

### For Production/Demo:
1. Configure Supabase with production domain
2. No longer using preview URLs
3. OAuth works normally

---

## CURRENT ENVIRONMENT STATUS

### This Fork (business-iq-1):
```
Frontend: https://auth-loop-fix-4.preview.emergentagent.com
Backend: https://auth-loop-fix-4.preview.emergentagent.com/api
Database: Supabase (shared)
Auth: Supabase (shared)
```

**Working:**
- ✅ Email/password login
- ✅ All API endpoints
- ✅ All features except OAuth

**Not Working:**
- ❌ OAuth login (redirects to advisor-chat-1)

### Canonical URL (advisor-chat-1):
```
Frontend: https://auth-loop-fix-4.preview.emergentagent.com
Backend: https://auth-loop-fix-4.preview.emergentagent.com/api
Database: Supabase (shared)
Auth: Supabase (shared)
OAuth: Configured ✅
```

**Working:**
- ✅ Email/password login
- ✅ OAuth login (Microsoft, Google)
- ✅ All features
- ✅ All integrations

---

## NO CODE CHANGES REQUIRED

### Why No Changes:
1. ✅ App code is URL-agnostic (uses env variables)
2. ✅ Supabase client auto-detects callback URLs
3. ✅ OAuth redirect is handled by Supabase (external)
4. ✅ Session management works correctly

### What This Means:
- Same codebase works on both URLs
- OAuth limitation is **environmental**, not **code-based**
- No refactoring needed
- No UX changes needed

---

## TESTING MATRIX BY URL

| Feature | business-iq-1 | advisor-chat-1 |
|---------|---------------|----------------|
| Email/Password Login | ✅ Works | ✅ Works |
| Microsoft OAuth | ❌ Redirects to advisor-chat-1 | ✅ Works |
| Google OAuth | ❌ Redirects to advisor-chat-1 | ✅ Works |
| Outlook Integration | ❌ Requires OAuth | ✅ Works |
| All Other Features | ✅ Works | ✅ Works |
| API Endpoints | ✅ Works | ✅ Works |
| Session Management | ✅ Works | ✅ Works |

---

## RECOMMENDATION

### For This Session:
**Accept the limitation:**
- OAuth testing: Use advisor-chat-1
- Feature testing: Use business-iq-1
- Document clearly for future developers

### For Future:
**When moving to production:**
- Configure Supabase with production domain
- OAuth will work normally
- No preview URL limitations

---

## DOCUMENTATION FOR DEVELOPERS

### ⚠️ IMPORTANT: OAuth URLs
If you are testing OAuth features (Microsoft login, Outlook, Google):
- **YOU MUST USE:** `https://auth-loop-fix-4.preview.emergentagent.com`
- **DO NOT USE:** Other preview URLs (business-iq-1, etc.)

Reason: Supabase OAuth is configured for advisor-chat-1 only.

### For Non-OAuth Testing:
Any preview URL works fine:
- Email/password login
- All features
- All APIs
- Session management

---

**Status:** ✅ DOCUMENTED  
**Code Changes:** NONE (not required)  
**Action Required:** Use correct URL for OAuth testing  
**Impact:** Developers know which URL to use for which tests

---

**Environment alignment complete. OAuth constraint documented.**
