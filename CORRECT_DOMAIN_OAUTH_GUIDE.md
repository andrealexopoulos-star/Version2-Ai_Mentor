# BIQC OAUTH CONFIGURATION - CORRECT DOMAIN

## ✅ BACKEND & FRONTEND UPDATED

Your correct domain: **`https://beta.thestrategysquad.com.au`**

I've updated both .env files and restarted services.

---

## UPDATE THESE 3 PLATFORMS NOW

### 1. SUPABASE
**Dashboard → Authentication → URL Configuration**

**Site URL:**
```
https://beta.thestrategysquad.com.au
```

**Redirect URLs (add each):**
```
https://beta.thestrategysquad.com.au/**
https://beta.thestrategysquad.com.au/auth/callback
https://beta.thestrategysquad.com.au/auth-callback-supabase
```

---

### 2. AZURE AD
**Portal → App Registrations → App: `5d6e3cbb-cd88-4694-aa19-9b7115666866` → Authentication**

**Redirect URI (Web):**
```
https://beta.thestrategysquad.com.au/api/auth/outlook/callback
```

---

### 3. GOOGLE CLOUD
**Console → Credentials → OAuth Client**

**JavaScript origin:**
```
https://beta.thestrategysquad.com.au
```

**Redirect URI:**
```
https://beta.thestrategysquad.com.au/api/auth/gmail/callback
```

---

## TESTING

1. Clear browser cache
2. Go to: `https://beta.thestrategysquad.com.au`
3. Try login - should work without looping

**Looping will stop once you update all 3 platforms.**
