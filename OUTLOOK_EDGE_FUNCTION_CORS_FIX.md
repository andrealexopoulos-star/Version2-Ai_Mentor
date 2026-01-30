# OUTLOOK-AUTH CORS FIX + DEPLOYMENT GUIDE

## CRITICAL CORS ERROR FIXED

### Issue Identified
```
Access to fetch blocked by CORS policy
```

### Fix Applied
Updated `/app/supabase_edge_functions/outlook-auth/index.ts`:
- Added `Access-Control-Allow-Methods` header
- Added explicit `Content-Type` header
- Added status 200 to OPTIONS response

---

## YOU MUST REDEPLOY THE EDGE FUNCTION

**The CORS fix won't work until you redeploy!**

### Option A: Via Supabase CLI (Recommended)

```bash
# Navigate to project root
cd /app

# Deploy the updated function
supabase functions deploy outlook-auth

# Verify deployment
supabase functions list
```

### Option B: Via Supabase Dashboard

1. Go to: https://app.supabase.com/project/uxyqpdfftxpkzeppqtvk/functions
2. Click on `outlook-auth` function
3. Go to "Code" tab
4. Delete current deployment
5. Upload the updated `/app/supabase_edge_functions/outlook-auth/index.ts` file
6. Click "Deploy"

---

## AFTER REDEPLOYMENT

**Test the function:**

1. Login to BIQC
2. Navigate to /connect-email
3. Open console (F12)
4. **Expected:** No CORS errors
5. **Expected:** See "📊 Outlook Edge Function response: {...}"

**Verify in Network tab:**
- Filter for: `outlook-auth`
- **Expected:** 200 OK response (not CORS error)

---

## IF CORS ERROR PERSISTS

Check Supabase Edge Function secrets are configured:
1. Go to: Edge Functions → Edge Function Secrets
2. Verify all 6 secrets are present:
   - AZURE_CLIENT_ID
   - AZURE_CLIENT_SECRET
   - AZURE_TENANT_ID
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY

---

**PLEASE REDEPLOY THE FUNCTION AND TEST**

Then let me know if CORS is resolved!
