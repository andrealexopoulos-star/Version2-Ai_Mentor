# BIQc Azure Deployment Guide

## Prerequisites
1. Azure CLI installed: `brew install azure-cli` (Mac) or [download](https://aka.ms/installazurecliwindows) (Windows)
2. Docker Desktop installed and running
3. Azure subscription active
4. GitHub repo saved (use "Save to GitHub" in Emergent)

## Quick Start (5 Steps)

### Step 1: Login to Azure
```bash
az login
```
This opens a browser — sign in with your Azure account.

### Step 2: Set your subscription
```bash
az account list --output table
az account set --subscription "YOUR_SUBSCRIPTION_NAME"
```

### Step 3: Run the deployment script
```bash
cd /path/to/biqc
chmod +x deploy/azure-deploy.sh
./deploy/azure-deploy.sh
```
This creates everything: resource group, container registry, app service, web apps.

### Step 4: Add environment variables
Go to Azure Portal → `biqc-api` → Configuration → Application Settings

Add these:
```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...
SERPER_API_KEY=5b47...
JWT_SECRET=your-jwt-secret
STRIPE_API_KEY=sk_test_...
EMERGENT_LLM_KEY=sk-emergent-...
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
```

### Step 5: Configure custom domain
1. Azure Portal → `biqc-web` → Custom domains
2. Add: `biqc.thestrategysquad.com`
3. In your DNS provider, add CNAME: `biqc` → `biqc-web.azurewebsites.net`
4. Enable free managed SSL certificate

## Architecture
```
Users → Azure Front Door (CDN)
         ↓
    biqc-web (Nginx + React)
         ↓ /api/
    biqc-api (FastAPI, always-on)
         ↓
    Supabase (Postgres + Auth + Edge Functions)
```

## Costs
| Resource | SKU | Cost |
|----------|-----|------|
| App Service Plan | B1 (Linux) | $13/mo |
| Container Registry | Basic | $5/mo |
| Bandwidth | 5GB included | $0 |
| **Total** | | **~$18/mo** |

## Updating
After code changes, rebuild and push:
```bash
az acr login --name biqcregistry
docker build -f Dockerfile.backend -t biqcregistry.azurecr.io/biqc-backend:latest .
docker push biqcregistry.azurecr.io/biqc-backend:latest
az webapp restart --name biqc-api --resource-group biqc-production
```

## Why Always-On Matters
- B1 plan with `always-on: true` = **zero cold starts**
- Your FastAPI backend never sleeps
- First page load: <1 second (no "Establishing connection..." screen)
- This is how ChatGPT, Slack, and every production SaaS operates
