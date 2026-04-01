# Azure Beta/Dev Environment Setup

## What You're Creating
```
beta.thestrategysquad.com → Azure App Service (biqc-beta)
                          → Same Supabase database as prod
                          → Separate from biqc.ai (prod)
```

## Steps (10 minutes)

### 1. Create Beta Web App (uses your existing App Service Plan — no extra cost)
```bash
az login
az webapp create \
  --resource-group biqc-production \
  --plan biqc-plan \
  --name biqc-beta \
  --deployment-container-image-name biqcregistry.azurecr.io/biqc-backend:latest

az webapp config set --resource-group biqc-production --name biqc-beta --always-on true
az webapp config appsettings set --resource-group biqc-production --name biqc-beta --settings WEBSITES_PORT=8001
```

### 2. Copy env variables from prod
Azure Portal → biqc-beta → Configuration → copy all settings from biqc-api

### 3. DNS (GoDaddy)
Add CNAME record:
- Name: `beta`
- Value: `biqc-beta.azurewebsites.net`

### 4. Custom domain + SSL
```bash
az webapp config hostname add --resource-group biqc-production --webapp-name biqc-beta --hostname beta.thestrategysquad.com
```
Then Azure Portal → biqc-beta → Custom domains → Add binding → Free managed certificate

### 5. Deploy code to beta
```bash
az acr login --name biqcregistry
docker build -f Dockerfile.backend -t biqcregistry.azurecr.io/biqc-backend:beta .
docker push biqcregistry.azurecr.io/biqc-backend:beta
az webapp config container set --resource-group biqc-production --name biqc-beta \
  --container-image-name biqcregistry.azurecr.io/biqc-backend:beta \
  --container-registry-url https://biqcregistry.azurecr.io
az webapp restart --name biqc-beta --resource-group biqc-production
```

### 6. Supabase — Add beta redirect URL
Dashboard → Authentication → URL Configuration → Add:
- `https://beta.thestrategysquad.com`
- `https://beta.thestrategysquad.com/auth/callback`

### Result
```
PRODUCTION: biqc.ai    → biqc-api    (stable, :latest tag)
BETA/DEV:   beta.thestrategysquad.com    → biqc-beta   (testing, :beta tag)
DATABASE:   Same Supabase instance       → shared data for testing
```

### Cost: $0 extra
Both apps run on the same B1 App Service Plan. You only pay once ($13/mo total).
The plan supports multiple web apps.
