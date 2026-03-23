# BIQc Platform — API Keys, Secrets & Dependencies Registry
# Last updated: 23 March 2026
#
# PURPOSE: Single reference for all external service credentials
# required to run BIQc in production. This file does NOT contain
# actual secret values — those go in .env files only.
#
# ══════════════════════════════════════════════════════════════

## ═══════════════════════════════════════
## 1. BACKEND ENVIRONMENT VARIABLES
##    File: /app/backend/.env
## ═══════════════════════════════════════

### OPENAI (AI Chat, Embeddings, Voice)
# Provider: OpenAI
# Dashboard: https://platform.openai.com/api-keys
# Used by: SoundBoard chat, voice advisor, calibration brain, file generation, embeddings
# Models: gpt-4o (chat), text-embedding-3-small (embeddings), gpt-4o-realtime (voice)
OPENAI_API_KEY=

### SUPABASE (Database, Auth, Edge Functions)
# Provider: Supabase
# Dashboard: https://supabase.com/dashboard/project/uxyqpdfftxpkzeppqtvk
# Used by: All data storage, user authentication, SQL cognition engine
SUPABASE_URL=https://uxyqpdfftxpkzeppqtvk.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

### STRIPE (Payments & Subscriptions)
# Provider: Stripe
# Dashboard: https://dashboard.stripe.com/apikeys
# Used by: Subscription checkout, payment status, webhooks
# SDK: stripe==14.1.0 (official Python SDK, no emergentintegrations)
STRIPE_API_KEY=

### MERGE (CRM, Accounting, Email Integrations)
# Provider: Merge.dev
# Dashboard: https://app.merge.dev
# Used by: HubSpot, Salesforce, Xero, QuickBooks, Outlook connections
# Powers: observation_events emission, deal/invoice/contact data
MERGE_API_KEY=
MERGE_WEBHOOK_SECRET=
MERGE_REDIRECT_URI=https://your-domain.com/api/integrations/merge/callback

### GOOGLE OAUTH (Social Login)
# Provider: Google Cloud Console
# Dashboard: https://console.cloud.google.com/apis/credentials
# Used by: "Sign in with Google" button on login/register
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

### GOOGLE reCAPTCHA (Auth Bot Protection)
# Provider: Google reCAPTCHA / reCAPTCHA Enterprise
# Used by: /api/auth/recaptcha/verify server-side validation
# Standard mode supports either RECAPTCHA_SECRET_KEY or RECAPTCHA_SECRET naming
# Enterprise mode uses assessments API with project+API key:
#   POST https://recaptchaenterprise.googleapis.com/v1/projects/{RECAPTCHA_ENTERPRISE_PROJECT_ID}/assessments?key={RECAPTCHA_ENTERPRISE_API_KEY}
# Provider can be: auto | standard | enterprise
RECAPTCHA_PROVIDER=auto
RECAPTCHA_SITE_KEY=
RECAPTCHA_ENTERPRISE_PROJECT_ID=
RECAPTCHA_ENTERPRISE_API_KEY=
RECAPTCHA_MIN_SCORE=0.3
RECAPTCHA_SECRET_KEY=
RECAPTCHA_SECRET=

### MICROSOFT AZURE (Outlook OAuth)
# Provider: Microsoft Azure Portal
# Dashboard: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps
# Used by: Outlook email integration, Microsoft OAuth login
AZURE_TENANT_ID=
AZURE_TENANT_URL=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=

### SERPER (Web Search)
# Provider: Serper.dev
# Dashboard: https://serper.dev/dashboard
# Used by: Market research, competitor analysis
SERPER_API_KEY=

### JWT (Internal Auth)
# Self-generated secret for JWT token signing
JWT_SECRET_KEY=

### APPLICATION URLS
BACKEND_URL=https://your-domain.com
FRONTEND_URL=https://your-domain.com
CORS_ORIGINS="*"

### MONGODB (Legacy — not used for primary data)
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database


## ═══════════════════════════════════════
## 2. FRONTEND ENVIRONMENT VARIABLES
##    File: /app/frontend/.env
## ═══════════════════════════════════════

REACT_APP_BACKEND_URL=https://your-domain.com
REACT_APP_GOOGLE_CLIENT_ID=
REACT_APP_SUPABASE_URL=https://uxyqpdfftxpkzeppqtvk.supabase.co
REACT_APP_SUPABASE_ANON_KEY=
REACT_APP_RECAPTCHA_SITE_KEY=
REACT_APP_RECAPTCHA_MODE=auto
REACT_APP_RECAPTCHA_PROVIDER=auto
REACT_APP_RECAPTCHA_STRICT=false
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false


## ═══════════════════════════════════════
## 3. SUPABASE EDGE FUNCTION SECRETS
##    Set via: Supabase Dashboard → Settings → Edge Functions → Secrets
##    Or CLI: supabase secrets set KEY=VALUE
## ═══════════════════════════════════════

### Used by calibration-business-dna edge function
OPENAI_API_KEY=
PERPLEXITY_API_KEY=
FIRECRAWL_API_KEY=

### Used by business-identity-lookup edge function
ABR_GUID=

### Used by intelligence-bridge, query-integrations-data
MERGE_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

### Used by calibration-psych
# (Uses a separate key named "Calibration-Psych" in Supabase secrets)
Calibration-Psych=
PERPLEXITY_API_KEY=


## ═══════════════════════════════════════
## 4. EXTERNAL API DEPENDENCIES
## ═══════════════════════════════════════

### CRITICAL (Platform won't function without these)
#
# | Service       | Purpose                              | Free Tier? | Dashboard URL                           |
# |---------------|--------------------------------------|------------|-----------------------------------------|
# | OpenAI        | AI chat, embeddings, voice           | No         | https://platform.openai.com             |
# | Supabase      | Database, auth, edge functions       | Yes (free) | https://supabase.com/dashboard          |
# | Merge.dev     | CRM/Accounting/Email integrations    | Yes (free) | https://app.merge.dev                   |
#
### IMPORTANT (Needed for full functionality)
#
# | Service       | Purpose                              | Free Tier? | Dashboard URL                           |
# |---------------|--------------------------------------|------------|-----------------------------------------|
# | Stripe        | Payment processing                   | Yes (test) | https://dashboard.stripe.com            |
# | Google Cloud  | OAuth social login                   | Yes        | https://console.cloud.google.com        |
# | Perplexity    | Market research (calibration)        | Limited    | https://www.perplexity.ai               |
# | Firecrawl     | Website scraping (calibration)       | Limited    | https://www.firecrawl.dev               |
# | Serper        | Web search API                       | Limited    | https://serper.dev                      |
# | ABR (ATO)     | Australian Business Register lookup  | Yes        | https://abr.business.gov.au             |
#
### OPTIONAL (Not currently active)
#
# | Service       | Purpose                              | Dashboard URL                           |
# |---------------|--------------------------------------|-----------------------------------------|
# | Microsoft     | Outlook OAuth (email integration)    | https://portal.azure.com                |
# | Mixpanel      | UX analytics (instrumented, no key)  | https://mixpanel.com                    |
# | Amplitude     | UX analytics (instrumented, no key)  | https://amplitude.com                   |
# | PostHog       | UX analytics (instrumented, no key)  | https://posthog.com                     |
# | Datadog       | Observability (config ready, no key) | https://www.datadoghq.com               |


## ═══════════════════════════════════════
## 5. PYTHON BACKEND DEPENDENCIES
##    File: /app/backend/requirements.txt
## ═══════════════════════════════════════

### Core Framework
# fastapi
# uvicorn[standard]
# pydantic

### Database
# supabase (Supabase Python client)
# motor (MongoDB async — legacy)
# pymongo

### AI / LLM
# httpx (Direct OpenAI API calls via llm_router.py)
# openai (NOT used directly — all calls via httpx in llm_router)

### Payments
# stripe==14.1.0 (Official Stripe Python SDK)

### Integrations
# merge-python-client (Merge.dev SDK for CRM/accounting)

### Auth
# python-jose[cryptography] (JWT)
# passlib[bcrypt]

### Utilities
# python-dotenv
# aiohttp
# requests
# python-multipart

### REMOVED
# emergentintegrations — FULLY REMOVED (was used for LLM + Stripe, now direct)


## ═══════════════════════════════════════
## 6. FRONTEND DEPENDENCIES (key packages)
##    File: /app/frontend/package.json
## ═══════════════════════════════════════

### Core
# react, react-dom, react-router-dom

### UI
# tailwindcss, @shadcn/ui components, lucide-react

### Supabase
# @supabase/supabase-js

### Charts
# recharts

### Utilities
# axios, sonner (toasts), date-fns


## ═══════════════════════════════════════
## 7. INFRASTRUCTURE
## ═══════════════════════════════════════

### Hosting (Production)
# Frontend: Azure / Vercel / Netlify (deploy from /app/frontend/build/)
# Backend: Azure App Service / Railway / Any Docker host
# Database: Supabase (managed PostgreSQL)
# Edge Functions: Supabase Edge Functions (Deno runtime)

### Hosting (Development)
# Emergent preview pod (strategy-platform-1.preview.emergentagent.com)

### DNS
# Domain: thestrategysquad.com (GoDaddy)
# CDN: Cloudflare (beta.thestrategysquad.com → 172.66.2.113)

### Mobile
# Expo / React Native (not yet deployed to App Store)
# Push: expo-notifications (device tokens stored in push_devices table)


## ═══════════════════════════════════════
## 8. DEPRECATED / TO REMOVE
## ═══════════════════════════════════════

# EMERGENT_LLM_KEY — No longer used. Remove from backend/.env
# sk_test_emergent — Placeholder Stripe key. Replace with real key.
# MONGO_URL — MongoDB not used for primary data (Supabase is primary)
# emergentintegrations — Removed from requirements.txt and all imports
