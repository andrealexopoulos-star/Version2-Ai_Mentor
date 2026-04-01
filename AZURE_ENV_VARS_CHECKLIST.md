# BIQc Azure Environment Variables — Setup Checklist
# Last updated: Mar 2026
# ============================================================
# IMPORTANT: Values in [brackets] need to be filled by you
# Values already shown are correct values from the codebase
# ============================================================


# ============================================================
# biqc-api (BACKEND App Service) — ADD THESE MISSING VARS
# ============================================================

AZURE_TENANT_ID=common
AZURE_TENANT_URL=https://login.microsoftonline.com/common
GOOGLE_CLIENT_ID=615649358168-hhjgi93he0nt7tvvo6f8tas4aojm4n82.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
MERGE_API_KEY=[your Merge.dev API key — get from app.merge.dev → Settings → API Keys]
MERGE_REDIRECT_URI=https://biqc.ai/api/integrations/merge/callback
SERPER_API_KEY=5b4733e54463108c9b410ef3d38074f667ee3e46

# ============================================================
# biqc-api — VERIFY THESE EXISTING VARS ARE CORRECT
# ============================================================

AZURE_CLIENT_ID=cognition-sme
AZURE_CLIENT_SECRET=[must be real Azure App Registration client secret]
AZURE_REDIRECT_URI=https://biqc.ai/api/auth/outlook/callback
FRONTEND_URL=https://biqc.ai
BACKEND_URL=https://biqc.ai
SUPABASE_URL=https://vwwandhoydemcybltoxz.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3d2FuZGhveWRlbWN5Ymx0b3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjU4MzEsImV4cCI6MjA4ODQwMTgzMX0.KzFEpKDiHtDx6EjsZscdvwY9vyakitlUJ4SOMekWEys
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3d2FuZGhveWRlbWN5Ymx0b3h6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgyNTgzMSwiZXhwIjoyMDg4NDAxODMxfQ.Dg-q4oFgXDaRrxXgzEofxkQ6h6EjB9Pc4fNv-MX5i04
OPENAI_API_KEY=[your OpenAI key — already set, just verify it is correct]
JWT_SECRET_KEY=[already set — do not change]
CORS_ORIGINS=*


# ============================================================
# biqc-web (FRONTEND App Service) — FIX THIS TYPO
# ============================================================

# DELETE the existing key named:   GOOGLE_CLIENT_SECRT   (missing E)
# ADD a new key named:             GOOGLE_CLIENT_SECRET
GOOGLE_CLIENT_SECRET=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

# ============================================================
# biqc-web — VERIFY THESE EXISTING VARS ARE CORRECT
# ============================================================

REACT_APP_SUPABASE_URL=https://vwwandhoydemcybltoxz.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3d2FuZGhveWRlbWN5Ymx0b3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MjU4MzEsImV4cCI6MjA4ODQwMTgzMX0.KzFEpKDiHtDx6EjsZscdvwY9vyakitlUJ4SOMekWEys
REACT_APP_GOOGLE_CLIENT_ID=615649358168-hhjgi93he0nt7tvvo6f8tas4aojm4n82.apps.googleusercontent.com
REACT_APP_AZURE_CLIENT_ID=[your real Azure App Registration client ID]
AZURE_TENANT_ID=common
FRONTEND_URL=https://biqc.ai
BACKEND_URL=https://biqc.ai


# ============================================================
# SUPABASE EDGE FUNCTION SECRETS (separate from Azure)
# Supabase Dashboard → vwwandhoydemcybltoxz → Edge Functions → Manage secrets
# ============================================================

OPENAI_API_KEY=[your OpenAI key]
SERPER_API_KEY=5b4733e54463108c9b410ef3d38074f667ee3e46
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3d2FuZGhveWRlbWN5Ymx0b3h6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjgyNTgzMSwiZXhwIjoyMDg4NDAxODMxfQ.Dg-q4oFgXDaRrxXgzEofxkQ6h6EjB9Pc4fNv-MX5i04
MERGE_API_KEY=[your Merge.dev API key]
SUPABASE_URL=https://vwwandhoydemcybltoxz.supabase.co


# ============================================================
# WHAT IS SERPER?
# ============================================================
# Serper (serper.dev) is a Google Search API.
# BIQc uses it for:
#   - Competitive Benchmark: searching competitors online
#   - Digital Footprint scoring: finding your business mentions
#   - Market intelligence: scanning industry news and trends
#   - Web reconnaissance: finding public data about businesses
#
# Without it: Competitive Benchmark and web search features
# will return empty or fallback results.
#
# Your key (5b4733e54463108c9b410ef3d38074f667ee3e46) is
# already in the codebase — just add it to Azure and Supabase.
# ============================================================
