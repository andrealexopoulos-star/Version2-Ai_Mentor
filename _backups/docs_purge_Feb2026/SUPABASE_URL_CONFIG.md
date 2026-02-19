# 🟢 Supabase URL Configuration

## Authentication → URL Configuration

Go to: **Supabase Dashboard → Authentication → URL Configuration**

---

## 📍 Site URL

```
https://ai-strategic-hub.preview.emergentagent.com
```

**What it's for**: The main URL of your application

---

## 🔄 Redirect URLs (Allowed)

Add **ALL** of these to the "Redirect URLs" list:

### 1. Production Frontend
```
https://ai-strategic-hub.preview.emergentagent.com/**
```

### 2. Local Development (if needed)
```
http://localhost:3000/**
```

### 3. Specific Auth Callbacks
```
https://ai-strategic-hub.preview.emergentagent.com/auth/callback
```

```
https://ai-strategic-hub.preview.emergentagent.com/connect-email
```

```
https://ai-strategic-hub.preview.emergentagent.com/integrations
```

---

## 📋 Copy-Paste Format (one per line)

```
https://ai-strategic-hub.preview.emergentagent.com/**
http://localhost:3000/**
https://ai-strategic-hub.preview.emergentagent.com/auth/callback
https://ai-strategic-hub.preview.emergentagent.com/connect-email
https://ai-strategic-hub.preview.emergentagent.com/integrations
```

---

## 🔧 Additional URL Settings (optional)

### Additional Redirect URLs
If you have other pages that use Supabase Auth:
```
https://ai-strategic-hub.preview.emergentagent.com/dashboard
https://ai-strategic-hub.preview.emergentagent.com/login
https://ai-strategic-hub.preview.emergentagent.com/signup
```

---

## ⚙️ Configuration Screenshot Guide

1. **Go to**: Supabase Dashboard
2. **Click**: Authentication (left sidebar)
3. **Click**: URL Configuration (tab at top)
4. **Set Site URL**: `https://ai-strategic-hub.preview.emergentagent.com`
5. **Add Redirect URLs**: Paste each URL from above (one per line)
6. **Click**: Save

---

## 🎯 What Each URL Does

| URL | Purpose |
|-----|---------|
| `/**` wildcard | Allows redirects to any page on your domain |
| `/auth/callback` | Default Supabase Auth callback |
| `/connect-email` | OAuth callback for email integrations |
| `/integrations` | OAuth callback for other integrations |
| `localhost:3000/**` | Local development testing |

---

## ✅ Verification

After configuration, test:
1. Try logging in
2. Try connecting Outlook/Gmail
3. Check browser console for any redirect errors

---

## 🚨 Common Issues

### "Invalid redirect URL" error

**Cause**: URL not in allowed list

**Fix**: 
1. Check exact URL in browser address bar when error occurs
2. Add that exact URL to Supabase redirect URLs
3. The `/**` wildcard should catch most cases

### "Site URL mismatch" error

**Cause**: Site URL doesn't match your domain

**Fix**: Set Site URL to `https://ai-strategic-hub.preview.emergentagent.com`

---

**Where to configure**: Supabase Dashboard → Authentication → URL Configuration  
**Last Updated**: December 2025
