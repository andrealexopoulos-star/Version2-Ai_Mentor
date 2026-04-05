# EDGE FUNCTION SECRETS SETUP

## Required Secrets for ALL Edge Functions

You MUST set these secrets in Supabase Dashboard → Edge Functions → Secrets.

### Core Secrets (ALL Edge Functions)
```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### deep-web-recon (SWOT + Social Intelligence)
```bash
OPENAI_API_KEY=<your-openai-key>
FIRECRAWL_API_KEY=<your-firecrawl-key>
```

### calibration-psych (Persona Calibration)
```bash
OPENAI_API_KEY=<your-openai-key>    # Same key
FIRECRAWL_API_KEY=<your-firecrawl-key>  # Same key
```

### Gmail OAuth (gmail_prod)
```bash
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

### Outlook OAuth (outlook-auth)
```bash
AZURE_CLIENT_ID=<azure-app-client-id>
AZURE_CLIENT_SECRET=<your-azure-secret>
BACKEND_URL=https://<backend-host>
```

## CLI Deployment

```bash
# Deploy deep-web-recon
supabase functions deploy deep-web-recon --no-verify-jwt

# Deploy all secrets at once
supabase secrets set \
  SUPABASE_URL=https://<project-ref>.supabase.co \
  SUPABASE_ANON_KEY=<key> \
  SUPABASE_SERVICE_ROLE_KEY=<key> \
  OPENAI_API_KEY=<key> \
  FIRECRAWL_API_KEY=<key>
```

## Edge Functions Inventory

| Function | Purpose | Tables Written |
|---|---|---|
| `deep-web-recon` | SWOT + social recon | `biqc_insights`, `intelligence_actions`, `observation_events`, `business_profiles` |
| `outlook-auth` | Outlook OAuth token storage | `outlook_oauth_tokens`, `email_connections` |
| `gmail_prod` | Gmail OAuth token storage | `gmail_connections`, `email_connections` |
| `email_priority` | Email triage + AI classification | `email_priority_analysis` |
| `integration-status` | Connection health check | (read-only) |
| `calibration-psych` | 9-step persona profiling | `user_operator_profile` |

**IMPORTANT:** Never commit secrets to git. They are managed separately by Supabase.

For calibration-critical function-to-secret mapping, use `docs/CALIBRATION_SECRET_MATRIX.md`.
