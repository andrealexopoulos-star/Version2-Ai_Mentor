# SUPABASE OAUTH UPDATE GUIDE — business-iq-1 Fork

**Current Fork URL:** `https://warroom-strategic-ai.preview.emergentagent.com`  
**Previous URL:** `https://warroom-strategic-ai.preview.emergentagent.com`  
**Task:** Update Supabase OAuth to work with current fork  
**Status:** Awaiting user configuration

---

## REQUIRED CHANGES

### 1. SUPABASE DASHBOARD (Required)

#### Step 1: Add New Redirect URL

1. Go to: **Supabase Dashboard** → Your Project
2. Navigate to: **Authentication** → **URL Configuration**
3. Find: **Redirect URLs** section
4. Add the following URLs (keep existing ones):

```
https://warroom-strategic-ai.preview.emergentagent.com/auth/callback
https://warroom-strategic-ai.preview.emergentagent.com/**
```

**Why both:**
- `/auth/callback` — For Google OAuth
- `/**` — For Microsoft OAuth (uses Edge Function)

#### Step 2: Update Site URL (Optional but Recommended)

In same **URL Configuration** section:

**Site URL:** Change from:
```
https://warroom-strategic-ai.preview.emergentagent.com
```

To:
```
https://warroom-strategic-ai.preview.emergentagent.com
```

**Note:** You can keep both URLs active if you want to support both forks.

---

### 2. AZURE AD APP REGISTRATION (Required for Microsoft OAuth)

#### Check if Update Needed:

Since you're using a **Supabase Edge Function** for Outlook OAuth callback, check your Azure app:

1. Go to: **Azure Portal** → **App Registrations**
2. Find your BIQC app registration
3. Navigate to: **Authentication** → **Redirect URIs**

#### Current Redirect URI (likely):
```
https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/outlook-auth/callback
```

**Status:** ✅ **NO CHANGE REQUIRED**

**Why:** The Edge Function URL is tied to Supabase, NOT to your frontend preview URL. The Edge Function handles the OAuth flow and redirects to your frontend based on state parameter.

**Confirmation:** If your Edge Function is already deployed and working, Azure configuration is fine.

---

### 3. SUPABASE EDGE FUNCTION (Check Required)

**Location:** Managed by you externally (not in /app codebase)  
**Function Name:** `outlook-auth/callback` (based on handoff)

#### Check if Update Needed:

Review your Edge Function code for hardcoded URLs:

**Look for:**
```typescript
// Check if there are hardcoded redirects like:
const redirectUrl = 'https://warroom-strategic-ai.preview.emergentagent.com/integrations';

// Or if it uses dynamic state parameter:
const redirectUrl = state.redirect_url; // ✅ Good (no change needed)
```

**If using state parameter:** ✅ NO CHANGE REQUIRED  
**If hardcoded advisor-chat-1:** ⚠️ UPDATE to business-iq-1

**Most likely:** Your Edge Function uses the state parameter and is already dynamic. No change needed.

---

## SUMMARY OF REQUIRED CHANGES

### ✅ Definitely Required:
1. **Supabase Dashboard** — Add redirect URLs for business-iq-1

### ⚠️ Check and Update if Needed:
2. **Supabase Edge Function** — Only if URLs are hardcoded (likely fine)

### ✅ NOT Required:
3. **Azure App Registration** — Edge Function URL stays the same
4. **Frontend Code** — Already uses `window.location.origin` (dynamic)
5. **Backend Code** — Already uses env variables (dynamic)

---

## STEP-BY-STEP CONFIGURATION

### Step 1: Update Supabase (5 minutes)

1. Open Supabase Dashboard
2. Go to: **Authentication** → **URL Configuration**
3. Under **Redirect URLs**, add:
   ```
   https://warroom-strategic-ai.preview.emergentagent.com/auth/callback
   https://warroom-strategic-ai.preview.emergentagent.com/**
   ```
4. Under **Site URL**, change to:
   ```
   https://warroom-strategic-ai.preview.emergentagent.com
   ```
5. Click **Save**

**Wait:** 1-2 minutes for Supabase to propagate changes

---

### Step 2: Verify Edge Function (2 minutes)

1. Open your Supabase Edge Function code (wherever you manage it)
2. Search for: `advisor-chat-1` or hardcoded URLs
3. If found: Replace with `business-iq-1` or use dynamic state parameter
4. If NOT found: ✅ No action needed

**Most likely result:** No changes needed (using state parameter)

---

### Step 3: Test OAuth Flow (3 minutes)

1. Open: `https://warroom-strategic-ai.preview.emergentagent.com`
2. Click: **Sign in with Microsoft**
3. Complete OAuth
4. Should redirect back to: `business-iq-1/auth/callback` ✅
5. Should land on: Dashboard or Onboarding

---

## EDGE FUNCTION DYNAMIC PATTERN (Recommended)

If your Edge Function needs updating, use this pattern:

```typescript
// ✅ GOOD: Dynamic redirect
const redirectUrl = request.headers.get('referer') || 
                    state.frontend_url || 
                    'https://warroom-strategic-ai.preview.emergentagent.com';

// ❌ BAD: Hardcoded
const redirectUrl = 'https://warroom-strategic-ai.preview.emergentagent.com';
```

---

## WHAT DOES NOT NEED CHANGES

### ✅ Frontend Code (Already Dynamic)
```javascript
// Uses window.location.origin automatically
const redirectUrl = `${window.location.origin}/auth/callback`;
```

### ✅ Backend Code (Uses Env Variables)
```python
FRONTEND_URL = os.environ.get('FRONTEND_URL')
# Already set to business-iq-1
```

### ✅ Azure App Registration
```
Redirect URI: https://uxyqpdfftxpkzeppqtvk.supabase.co/functions/v1/outlook-auth/callback
# This is the Edge Function URL, NOT the frontend URL
# No change needed
```

---

## CONFIRMATION CHECKLIST

After updating Supabase:

- [ ] Supabase redirect URLs include business-iq-1/auth/callback
- [ ] Supabase site URL set to business-iq-1 (or both URLs listed)
- [ ] Edge Function checked for hardcoded URLs
- [ ] Tested Microsoft OAuth flow end-to-end
- [ ] Session persists after OAuth login

---

## EXPECTED BEHAVIOR AFTER UPDATE

### ✅ Should Work:
1. Navigate to: `https://warroom-strategic-ai.preview.emergentagent.com`
2. Click: "Sign in with Microsoft"
3. Redirect to: Microsoft login
4. Redirect to: Supabase
5. Redirect to: Edge Function callback
6. Redirect to: `business-iq-1/auth/callback` ✅
7. Redirect to: Dashboard/Onboarding

**No redirect loops. Clean OAuth flow.**

---

## NOTES

### If You Want to Support Both URLs:
You can keep BOTH URLs in Supabase redirect list:
```
https://warroom-strategic-ai.preview.emergentagent.com/auth/callback
https://warroom-strategic-ai.preview.emergentagent.com/**
https://warroom-strategic-ai.preview.emergentagent.com/auth/callback
https://warroom-strategic-ai.preview.emergentagent.com/**
```

This allows OAuth to work on both forks.

### Production Deployment:
When moving to production domain:
- Add production URL to Supabase
- Update site URL to production
- Remove preview URLs

---

**Action Required:** Update Supabase redirect URLs (5 minutes)  
**Code Changes:** NONE  
**Azure Changes:** NONE (Edge Function URL stays same)  
**Edge Function Changes:** Check for hardcoded URLs (likely NONE)

Let me know once you've updated Supabase and I'll help verify the OAuth flow works!
