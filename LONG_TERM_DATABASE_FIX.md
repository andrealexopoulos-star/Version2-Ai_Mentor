# BIQC Database & Auth Long-Term Fix Guide

## Problem Summary
When users sign up via OAuth (Microsoft/Google), their profile isn't always created in the `users` table, causing:
- Email sync failures (foreign key constraint)
- Account merge conflicts
- Inconsistent user states

---

## LONG-TERM FIX: Run these SQL commands in Supabase SQL Editor

### Step 1: Create Auto-User Trigger
This ensures a user profile is ALWAYS created when someone signs up via Supabase Auth:

```sql
-- Create function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Step 2: Fix RLS Policies for All Tables
Allow service_role full access to all critical tables:

```sql
-- Users table
DROP POLICY IF EXISTS "Service role full access" ON public.users;
CREATE POLICY "Service role full access" ON public.users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Outlook OAuth tokens
DROP POLICY IF EXISTS "Service role full access" ON public.outlook_oauth_tokens;
CREATE POLICY "Service role full access" ON public.outlook_oauth_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Outlook emails
DROP POLICY IF EXISTS "Service role full access" ON public.outlook_emails;
CREATE POLICY "Service role full access" ON public.outlook_emails
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Onboarding
DROP POLICY IF EXISTS "Service role full access" ON public.onboarding;
CREATE POLICY "Service role full access" ON public.onboarding
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Chat history
DROP POLICY IF EXISTS "Service role full access" ON public.chat_history;
CREATE POLICY "Service role full access" ON public.chat_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Cognitive profiles
DROP POLICY IF EXISTS "Service role full access" ON public.cognitive_profiles;
CREATE POLICY "Service role full access" ON public.cognitive_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Business profiles
DROP POLICY IF EXISTS "Service role full access" ON public.business_profiles;
CREATE POLICY "Service role full access" ON public.business_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### Step 3: Fix Missing Users (One-Time Cleanup)
Sync any existing auth users that don't have profiles:

```sql
-- Create user profiles for all auth.users that don't have one
INSERT INTO public.users (id, email, full_name, created_at)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)),
  au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;
```

### Step 4: Clean Up Orphaned Data (Optional)
Remove data pointing to non-existent users:

```sql
-- Delete orphaned outlook tokens
DELETE FROM outlook_oauth_tokens 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Delete orphaned emails
DELETE FROM outlook_emails 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Delete orphaned chat history
DELETE FROM chat_history 
WHERE user_id NOT IN (SELECT id FROM auth.users);
```

---

## VERIFICATION

After running the above, verify with:

```sql
-- Check all auth users have profiles
SELECT 
  au.email,
  au.id as auth_id,
  pu.id as profile_id,
  CASE WHEN pu.id IS NULL THEN '❌ MISSING' ELSE '✅ OK' END as status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id;

-- Check outlook tokens have valid users
SELECT 
  ot.user_id,
  ot.account_email,
  CASE WHEN pu.id IS NULL THEN '❌ ORPHANED' ELSE '✅ OK' END as status
FROM outlook_oauth_tokens ot
LEFT JOIN public.users pu ON ot.user_id = pu.id;
```

---

## What This Fixes

| Issue | Solution |
|-------|----------|
| OAuth signup doesn't create user profile | Database trigger auto-creates profile |
| RLS blocking backend operations | Service role policies allow all operations |
| Email sync foreign key errors | User profiles guaranteed to exist |
| Orphaned data causing conflicts | Cleanup removes stale records |

---

## Future-Proof Architecture

The trigger ensures that ANY new signup (OAuth or email/password) will:
1. Automatically create a `public.users` record
2. Use the same ID as `auth.users`
3. Never have missing user profiles again

This is the **Supabase recommended pattern** for syncing auth.users with a public profiles table.
