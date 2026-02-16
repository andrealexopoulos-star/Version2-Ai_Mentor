# BIQC DEPLOYMENT - COMPLETE URL/URI CHECKLIST

## YOUR PRODUCTION DOMAIN
```
https://www.beta.thestrategysquad.com
```

## 1. SUPABASE URLS

**Site URL:**
```
https://www.beta.thestrategysquad.com
```

**Redirect URLs:**
```
https://www.beta.thestrategysquad.com/**
https://www.beta.thestrategysquad.com/auth/callback
https://www.beta.thestrategysquad.com/auth-callback-supabase
```

## 2. AZURE AD REDIRECT URI

**App ID:** 5d6e3cbb-cd88-4694-aa19-9b7115666866

**Redirect URI:**
```
https://www.beta.thestrategysquad.com/api/auth/outlook/callback
```

## 3. GOOGLE CLOUD URIS

**JavaScript origin:**
```
https://www.beta.thestrategysquad.com
```

**Redirect URI:**
```
https://www.beta.thestrategysquad.com/api/auth/gmail/callback
```

## DEPLOYMENT STEPS

1. Update Supabase (above)
2. Update Azure AD (above)
3. Update Google Cloud (above)
4. Deploy in Emergent
5. Link domain
6. Test

Merge.dev errors will be fixed after deployment with correct URLs.