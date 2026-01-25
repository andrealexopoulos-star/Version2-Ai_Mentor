# EDGE FUNCTION SECRETS SETUP

## Required Secrets for `gmail_test` Edge Function

You MUST set these secrets in Supabase:

### 1. Navigate to Supabase Dashboard
- Go to: **Edge Functions** → **Secrets**

### 2. Add These Secrets

```bash
SUPABASE_URL=https://uxyqpdfftxpkzeppqtvk.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eXFwZGZmdHhwa3plcHBxdHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MzcwNDcsImV4cCI6MjA4NDAxMzA0N30.Xu9Wg5M638qJSgDpJKwFYlr9YZDiYPLv4Igh69KHJ0k
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4eXFwZGZmdHhwa3plcHBxdHZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQzNzA0NywiZXhwIjoyMDg0MDEzMDQ3fQ.Of8sBhmza-QMmtlQ-EN7kpqcDuiy512TlY2Gku9YuX4
GOOGLE_CLIENT_ID=903194754324-ife21qnmrokplbcu2ck5afce0kjd6j10.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
```

### 3. CLI Method (Alternative)

If using Supabase CLI:

```bash
supabase secrets set SUPABASE_URL=https://uxyqpdfftxpkzeppqtvk.supabase.co
supabase secrets set SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
supabase secrets set GOOGLE_CLIENT_ID=903194754324-ife21qnmrokplbcu2ck5afce0kjd6j10.apps.googleusercontent.com
supabase secrets set GOOGLE_CLIENT_SECRET=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
```

## Verification

After setting secrets, you can verify they're set:

```bash
supabase secrets list
```

Should show all 5 secrets (values will be hidden).

---

**IMPORTANT:** Never commit these secrets to git. They are managed separately by Supabase.
