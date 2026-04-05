# BIQc Azure Environment Variables - Setup Checklist
# Last updated: Apr 2026
#
# SECURITY NOTE:
# - This file must never contain live credentials.
# - Use your secret manager / CI secret store values only.
# - Use placeholder values below as a deployment checklist.
# - Canonical calibration secret map: docs/CALIBRATION_SECRET_MATRIX.md

# ============================================================
# biqc-api (BACKEND App Service) - required variables
# ============================================================

AZURE_TENANT_ID=<azure-tenant-id-or-common>
AZURE_TENANT_URL=https://login.microsoftonline.com/<azure-tenant-id-or-common>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
MERGE_API_KEY=<merge-api-key>
MERGE_REDIRECT_URI=https://<backend-host>/api/integrations/merge/callback
SERPER_API_KEY=<serper-api-key>

# ============================================================
# biqc-api - verify existing vars
# ============================================================

AZURE_CLIENT_ID=<azure-app-client-id>
AZURE_CLIENT_SECRET=<azure-app-client-secret>
AZURE_REDIRECT_URI=https://<backend-host>/api/auth/outlook/callback
FRONTEND_URL=https://<frontend-host>
BACKEND_URL=https://<backend-host>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<supabase-anon-jwt>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-jwt>
OPENAI_API_KEY=<openai-api-key>
JWT_SECRET_KEY=<jwt-secret-key>
CORS_ORIGINS=<comma-separated-origins-or-*>

# ============================================================
# biqc-web (FRONTEND App Service) - typo fix
# ============================================================

# DELETE old key: GOOGLE_CLIENT_SECRT
# ADD key:        GOOGLE_CLIENT_SECRET
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>

# ============================================================
# biqc-web - verify existing vars
# ============================================================

REACT_APP_SUPABASE_URL=https://<project-ref>.supabase.co
REACT_APP_SUPABASE_ANON_KEY=<supabase-anon-jwt>
REACT_APP_GOOGLE_CLIENT_ID=<google-oauth-client-id>
REACT_APP_AZURE_CLIENT_ID=<azure-app-client-id>
AZURE_TENANT_ID=<azure-tenant-id-or-common>
FRONTEND_URL=https://<frontend-host>
BACKEND_URL=https://<backend-host>

# ============================================================
# Supabase Edge Function secrets (separate from Azure)
# ============================================================

# Set via Supabase Dashboard -> Edge Functions -> Manage secrets
OPENAI_API_KEY=<openai-api-key>
SERPER_API_KEY=<serper-api-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-jwt>
MERGE_API_KEY=<merge-api-key>
SUPABASE_URL=https://<project-ref>.supabase.co

# ============================================================
# Notes
# ============================================================
# - Keep secrets only in Azure, GitHub Actions, and Supabase secret stores.
# - Do not commit any key values into markdown or source files.
# - For calibration-critical function-to-secret mapping, use:
#   docs/CALIBRATION_SECRET_MATRIX.md
