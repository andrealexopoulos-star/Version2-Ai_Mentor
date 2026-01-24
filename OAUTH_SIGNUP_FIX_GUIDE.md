# OAUTH SIGNUP DATABASE ERROR - COMPLETE FIX GUIDE

**Root Cause:** Missing database trigger causes race condition in OAuth signup  
**Impact:** ALL new OAuth signups fail  
**Status:** ⚠️ REQUIRES DATABASE + CODE FIXES

---

## ROOT CAUSE (Troubleshoot Agent Analysis)

### The Failure Sequence:
1. User signs up via OAuth (Microsoft/Google)
2. ✅ Supabase creates user in `auth.users` table
3. ❌ No automatic creation in `public.users` table (trigger missing)
4. Frontend calls `/api/auth/check-profile`
5. Backend queries `public.users` → user NOT FOUND
6. Backend tries manual creation → FAILS (RLS policy blocks)
7. Frontend retries infinitely → "[AUTH] Initializing..." loops forever

---

## REQUIRED FIXES

### PART 1: DATABASE (YOU MUST DO THIS)

**Go to Supabase SQL Editor and execute these commands:**

#### Step 1: Create Database Trigger (CRITICAL)
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name', 
      NEW.raw_user_meta_data->>'name', 
      split_part(NEW.email, '@', 1)
    ),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

#### Step 2: Fix RLS Policies
```sql
DROP POLICY IF EXISTS "Service role full access" ON public.users;
CREATE POLICY "Service role full access" ON public.users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON public.cognitive_profiles;
CREATE POLICY "Service role full access" ON public.cognitive_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

#### Step 3: Sync Orphaned Users (One-Time Cleanup)
```sql
INSERT INTO public.users (id, email, full_name, created_at)
SELECT 
  au.id, 
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'full_name', 
    au.raw_user_meta_data->>'name', 
    split_part(au.email, '@', 1)
  ),
  au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;
```

#### Step 4: Verify Fix Worked
```sql
-- Should show all users with ✅ OK status
SELECT 
  au.email, 
  au.id as auth_id, 
  pu.id as profile_id,
  CASE 
    WHEN pu.id IS NULL THEN '❌ MISSING' 
    ELSE '✅ OK' 
  END as status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id;
```

---

### PART 2: CODE FIX (I WILL DO THIS)

**Implementing frontend retry limit to prevent infinite loops...**
