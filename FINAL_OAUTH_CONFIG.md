# BIQC OAUTH - FINAL CORRECT CONFIGURATION

## ✅ YOUR ACTUAL DOMAIN (FINAL)

```
https://www.beta.thestrategysquad.com
```

**Backend & Frontend updated and restarted successfully.**

---

## UPDATE THESE 3 PLATFORMS WITH CORRECT URLs

### 1. SUPABASE
**Dashboard → Authentication → URL Configuration**

**Site URL:**
```
https://www.beta.thestrategysquad.com
```

**Redirect URLs (add each):**
```
https://www.beta.thestrategysquad.com/**
https://www.beta.thestrategysquad.com/auth/callback
https://www.beta.thestrategysquad.com/auth-callback-supabase
```

---

### 2. AZURE AD
**Portal → App Registrations → `5d6e3cbb-cd88-4694-aa19-9b7115666866` → Authentication**

**Redirect URI (Web platform):**
```
https://www.beta.thestrategysquad.com/api/auth/outlook/callback
```

**API Permissions:** `User.Read`, `Mail.Read`, `Calendars.Read`, `offline_access`

---

### 3. GOOGLE CLOUD
**Console → Credentials → OAuth Client `903194754324-ife21qnmrokplbcu2ck5afce0kjd6j10`**

**JavaScript origin:**
```
https://www.beta.thestrategysquad.com
```

**Redirect URI:**
```
https://www.beta.thestrategysquad.com/api/auth/gmail/callback
```

---

## TESTING

After updating all 3 platforms:

1. **Clear browser cache completely**
2. Go to: `https://www.beta.thestrategysquad.com`
3. Click "Log In"
4. Should authenticate without looping

**Your OAuth looping will stop once all 3 platforms have the correct domain configured.**
