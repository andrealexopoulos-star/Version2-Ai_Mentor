# ✅ AZURE CLIENT SECRET UPDATED - COMPLETE SETUP CHECKLIST

## Backend - DONE ✅

Your backend `.env` has been updated with the new secret:
```
AZURE_CLIENT_SECRET=3co8Q~PnscNo_dvuAw~HnlhhJzJsP~7sj3X3tc0E
```

Backend restarted ✅

---

## Supabase Edge Function - YOU MUST UPDATE

### Navigate to Supabase Dashboard

**Go to**: Edge Functions → **outlook-auth** → Settings → **Secrets**

### Update These Secrets:

**Secret Name**: `AZURE_CLIENT_SECRET`  
**Secret Value**: 
```
3co8Q~PnscNo_dvuAw~HnlhhJzJsP~7sj3X3tc0E
```

**ALSO VERIFY THESE SECRETS ARE CORRECT**:

**Secret Name**: `AZURE_CLIENT_ID`  
**Secret Value**:
```
5d6e3cbb-cd88-4694-aa19-9b7115666866
```

**Secret Name**: `BACKEND_URL`  
**Secret Value**:
```
https://biqc-performance-hub.preview.emergentagent.com
```

### After Updating Secrets

Click **"Deploy"** button to redeploy the Edge Function with new secrets.

---

## COMPLETE CREDENTIALS - COPY/PASTE REFERENCE

### Azure Portal (Your App Registration)
```
Application (client) ID: 5d6e3cbb-cd88-4694-aa19-9b7115666866
Directory (tenant) ID: af75a808f-8c78-46dd-bda8-faa925d316d9
Client Secret VALUE: 3co8Q~PnscNo_dvuAw~HnlhhJzJsP~7sj3X3tc0E
```

### Backend .env (Already Updated ✅)
```
AZURE_TENANT_ID=af75a808f-8c78-46dd-bda8-faa925d316d9
AZURE_CLIENT_ID=biqc-advisor
AZURE_CLIENT_SECRET=3co8Q~PnscNo_dvuAw~HnlhhJzJsP~7sj3X3tc0E
```

### Supabase Edge Function: outlook-auth (You Must Update)
```
AZURE_CLIENT_ID=biqc-advisor
AZURE_CLIENT_SECRET=3co8Q~PnscNo_dvuAw~HnlhhJzJsP~7sj3X3tc0E
BACKEND_URL=https://biqc-performance-hub.preview.emergentagent.com
```

---

## Test After Updating Supabase

1. Update Supabase Edge Function secrets
2. Redeploy the Edge Function
3. Wait 1 minute
4. Go to `/connect-email`
5. Click "Connect Outlook"
6. Should work immediately

---

**Status**: Backend updated ✅ | Supabase Edge Function update pending ⏳
