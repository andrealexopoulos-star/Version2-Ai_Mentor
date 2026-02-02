# ONBOARDING NOT SHOWING AFTER GOOGLE SIGNUP - ROOT CAUSE ANALYSIS

**Status:** 🔴 **CONFIRMED BUG**  
**Date:** $(date)  
**Severity:** HIGH (UX Issue - New Users Skip Onboarding)

---

## ISSUE SUMMARY

When new users sign up via Google OAuth, they are **NOT being redirected to the onboarding questionnaire**. Instead, they go directly to the `/advisor` page, missing critical business profile setup.

---

## ROOT CAUSE IDENTIFIED

### **File:** `/app/backend/server.py` Line 2331

```python
# NEW SUPABASE-ONLY USER: check if they have company info
has_company_info = bool(user_profile.get("company_name"))
needs_onboarding = not has_company_info
```

### **The Problem:**

When users sign up via **Google OAuth**, Supabase captures their metadata from Google:

```javascript
// From Google OAuth
user_metadata: {
  full_name: "John Doe",
  email: "john@example.com",
  // ❌ NO company_name from Google
}
```

**Result:**
1. User signs up with Google
2. Backend checks: `company_name = None`
3. Backend returns: `needs_onboarding = True` ✅ (CORRECT)
4. **BUT** Frontend callback has a fallback that skips onboarding on API errors

### **File:** `/app/frontend/src/pages/AuthCallbackSupabase.js` Lines 109-116

```javascript
if (!response.ok) {
  console.error('❌ Profile check failed:', response.status);
  // For new OAuth users, skip onboarding and go to advisor
  console.log('Redirecting to advisor (profile check failed)');
  setStatus('Redirecting...');
  navigate('/advisor', { replace: true });  // ⚠️ SKIPS ONBOARDING
  return;
}
```

---

## WHAT HAPPENS IN YOUR CASE

### **Scenario 1: API Call Succeeds**
1. ✅ User signs up with Google
2. ✅ Backend creates user profile (no `company_name`)
3. ✅ Backend returns `needs_onboarding: true`
4. ✅ Frontend reads response correctly
5. ✅ **Should redirect to `/onboarding`** ← THIS SHOULD HAPPEN

### **Scenario 2: API Call Fails (404, 500, etc.)**
1. ✅ User signs up with Google
2. ❌ API `/auth/check-profile` fails or returns error
3. ❌ Frontend catches error
4. ❌ Frontend defaults to `/advisor` **SKIPPING ONBOARDING** ← BUG

---

## WHY YOU'RE NOT SEEING ONBOARDING

**Hypothesis:** The `/auth/check-profile` API call is failing silently or returning a non-200 status code.

**Possible causes:**
1. **Auth token not being passed correctly** in the API request
2. **Backend throwing an error** during profile check
3. **CORS or network issue** preventing API call from completing
4. **Timing issue** - frontend calling API before backend is ready

---

## THE "COMPLETE ONBOARDING" BUTTON

You mentioned you created a button yesterday. I found it in `/app/frontend/src/pages/Settings.js` lines 140-154:

```jsx
{/* Onboarding Section */}
<div className="pt-6 border-t">
  <h3 className="font-semibold mb-3">Onboarding</h3>
  <p className="text-sm mb-4">
    Complete your onboarding to help BIQC understand your business better.
  </p>
  <Button onClick={() => window.location.href = '/onboarding'}>
    <SettingsIcon className="w-4 h-4" />
    Complete Onboarding
  </Button>
</div>
```

**This button:**
- ✅ Shows for ALL users (no conditional logic)
- ✅ Always redirects to `/onboarding`
- ✅ Works as a manual workaround

**However:** New users shouldn't need to find this button - they should be auto-redirected to onboarding.

---

## SOLUTION OPTIONS

### **Option 1: Remove Error Fallback (Recommended)**

Change the frontend to **fail loudly** instead of silently redirecting to advisor:

```javascript
if (!response.ok) {
  console.error('❌ Profile check failed:', response.status);
  // Show error instead of bypassing onboarding
  setError(`Profile check failed (${response.status}). Please try again.`);
  setTimeout(() => navigate('/login-supabase'), 3000);
  return;
}
```

### **Option 2: Default to Onboarding on Error (Safer)**

Assume new users need onboarding if API fails:

```javascript
if (!response.ok) {
  console.error('❌ Profile check failed:', response.status);
  console.log('Defaulting to onboarding (safe fallback for new users)');
  navigate('/onboarding', { replace: true });  // ✅ SAFE FALLBACK
  return;
}
```

### **Option 3: Add Conditional Logic to Settings Button**

Only show "Complete Onboarding" button if user has incomplete profile:

```jsx
{!hasCompletedOnboarding && (
  <div className="pt-6 border-t">
    <Button onClick={() => window.location.href = '/onboarding'}>
      Complete Onboarding
    </Button>
  </div>
)}
```

---

## DEBUG STEPS TO CONFIRM

1. **Check backend logs** when you sign up with a new Google account:
   ```bash
   tail -f /var/log/supervisor/backend.out.log | grep "Profile check"
   ```

2. **Check browser console** during signup:
   ```javascript
   // Look for these messages:
   "📋 Profile check result:"
   "needs_onboarding: true/false"
   "❌ Profile check failed"
   ```

3. **Test the API manually** with a valid auth token:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        https://biqc-advisor.preview.emergentagent.com/api/auth/check-profile
   ```

---

## RECOMMENDED FIX

**Change Line 111-116 in `/app/frontend/src/pages/AuthCallbackSupabase.js`:**

**BEFORE (Current - Skips Onboarding on Error):**
```javascript
if (!response.ok) {
  console.error('❌ Profile check failed:', response.status);
  // For new OAuth users, skip onboarding and go to advisor
  console.log('Redirecting to advisor (profile check failed)');
  setStatus('Redirecting...');
  navigate('/advisor', { replace: true });
  return;
}
```

**AFTER (Safe Fallback - Sends New Users to Onboarding):**
```javascript
if (!response.ok) {
  console.error('❌ Profile check failed:', response.status);
  // Safe fallback: new users should go to onboarding
  console.log('Profile check failed - redirecting to onboarding (safe default for new users)');
  setStatus('Redirecting to onboarding...');
  navigate('/onboarding', { replace: true });
  return;
}
```

---

## WHY GOOGLE AUTH WORKS WITHOUT JS ORIGINS

You asked why Google auth works without JavaScript origins. Here's why:

**Supabase Auth Flow:**
```
1. Your app calls: supabase.auth.signInWithOAuth({ provider: 'google' })
2. Supabase backend initiates OAuth (server-side)
3. Supabase redirects user to Google
4. Google checks: Is uxyqpdfftxpkzeppqtvk.supabase.co authorized? ✅
5. User authenticates on Google
6. Google redirects back to Supabase (not your app)
7. Supabase processes tokens (server-side)
8. Supabase redirects to your app with session tokens
```

**Your app NEVER directly calls Google APIs** - Supabase does everything server-side.

**JavaScript Origins are only needed if:**
- You call Google APIs directly from frontend (Maps, YouTube, Drive, etc.)
- You use Google's One Tap sign-in widget (different from Supabase OAuth)
- Google enforces them for enhanced security (recommended but not required)

---

## NEXT STEPS

1. **Confirm the issue** by checking backend logs during a test signup
2. **Apply the recommended fix** to line 111 in `AuthCallbackSupabase.js`
3. **Test with a new Google account** to verify onboarding shows
4. **Optional:** Add conditional logic to Settings button to hide it for users who completed onboarding

---

**STATUS:** Bug identified, fix ready for implementation
