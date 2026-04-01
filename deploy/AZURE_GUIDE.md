# BIQc Azure Deployment — Complete Step-by-Step Guide
## For First-Time Azure Users
## Written for: Andre @ The Strategy Squad

---

## WHAT WE'RE BUILDING

```
Your Computer → GitHub → Azure Container Registry → Azure App Service (Always-On)
                                                          ↓
                                                    biqc.ai
                                                          ↓
                                                    Supabase (Database stays as-is)
```

**Cost: ~$18/month. Zero cold starts. Professional grade.**

---

## PHASE 1: INSTALL TOOLS (One Time Only)

### 1.1 Install Azure CLI

**Mac:**
```bash
brew install azure-cli
```

**Windows:**
1. Download from: https://aka.ms/installazurecliwindows
2. Run the installer
3. Restart your terminal/PowerShell

**Verify it works:**
```bash
az --version
```
You should see something like `azure-cli 2.x.x`

### 1.2 Install Docker Desktop

1. Go to: https://www.docker.com/products/docker-desktop/
2. Download for your OS (Mac or Windows)
3. Install and open Docker Desktop
4. Wait for the whale icon in your taskbar to say "Docker Desktop is running"

**Verify it works:**
```bash
docker --version
```
You should see `Docker version 24.x.x` or similar

### 1.3 Install Git (if not already)

**Mac:** Already installed. Type `git --version` to confirm.

**Windows:** Download from https://git-scm.com/download/win

---

## PHASE 2: GET YOUR CODE FROM GITHUB

### 2.1 First, save your latest code
In the Emergent chat, click **"Save to GitHub"** to push the latest changes.

### 2.2 Clone your repo to your computer

Open Terminal (Mac) or PowerShell (Windows):

```bash
cd ~/Desktop
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

Replace `YOUR_USERNAME/YOUR_REPO_NAME` with your actual GitHub repo URL.

**You should see all the BIQc files in this folder.**

---

## PHASE 3: LOGIN TO AZURE

### 3.1 Login

```bash
az login
```

This opens your web browser. Sign in with the Microsoft account that has your Azure subscription.

After login, you'll see output like:
```json
[
  {
    "name": "Pay-As-You-Go",
    "id": "abc123-def456-...",
    "state": "Enabled"
  }
]
```

### 3.2 Set your subscription

```bash
az account list --output table
```

Find your subscription name, then:

```bash
az account set --subscription "YOUR_SUBSCRIPTION_NAME"
```

Example:
```bash
az account set --subscription "Pay-As-You-Go"
```

### 3.3 Verify

```bash
az account show --output table
```

You should see your subscription listed as the active one.

---

## PHASE 4: CREATE AZURE RESOURCES

We'll create each resource one at a time so you can see what's happening.

### 4.1 Create a Resource Group

A resource group is like a folder that holds all your Azure resources.

```bash
az group create --name biqc-production --location australiaeast
```

**Expected output:** JSON with `"provisioningState": "Succeeded"`

### 4.2 Create a Container Registry

This is where Docker images are stored (like a private Docker Hub).

```bash
az acr create --resource-group biqc-production --name biqcregistry --sku Basic --admin-enabled true
```

**Expected output:** JSON with registry details. This takes ~30 seconds.

### 4.3 Get Registry Credentials

```bash
az acr credential show --name biqcregistry --output table
```

**Save these values — you'll need them:**
- USERNAME (usually `biqcregistry`)
- PASSWORD (a long string)

### 4.4 Create App Service Plan

This is the "server" that runs your app. B1 = always-on, no cold starts.

```bash
az appservice plan create \
  --name biqc-plan \
  --resource-group biqc-production \
  --sku B1 \
  --is-linux
```

**Expected output:** JSON with plan details. This takes ~1 minute.

### 4.5 Create Backend Web App

```bash
az webapp create \
  --resource-group biqc-production \
  --plan biqc-plan \
  --name biqc-api \
  --deployment-container-image-name biqcregistry.azurecr.io/biqc-backend:latest
```

**Note:** If the name `biqc-api` is taken, try `biqc-api-tss` or similar.

### 4.6 Create Frontend Web App

```bash
az webapp create \
  --resource-group biqc-production \
  --plan biqc-plan \
  --name biqc-web \
  --deployment-container-image-name biqcregistry.azurecr.io/biqc-frontend:latest
```

### 4.7 Enable Always-On (Critical!)

```bash
az webapp config set --resource-group biqc-production --name biqc-api --always-on true
az webapp config set --resource-group biqc-production --name biqc-web --always-on true
```

### 4.8 Set Backend Port

```bash
az webapp config appsettings set \
  --resource-group biqc-production \
  --name biqc-api \
  --settings WEBSITES_PORT=8001
```

---

## PHASE 5: BUILD AND PUSH DOCKER IMAGES

### 5.1 Login to your container registry

```bash
az acr login --name biqcregistry
```

**Expected:** `Login Succeeded`

### 5.2 Build the backend image

Make sure you're in the root of your BIQc project folder:

```bash
docker build -f Dockerfile.backend -t biqcregistry.azurecr.io/biqc-backend:latest .
```

**This takes 3-5 minutes** the first time (downloads Python, installs packages, Playwright, etc.)

### 5.3 Push backend to Azure

```bash
docker push biqcregistry.azurecr.io/biqc-backend:latest
```

**This takes 2-3 minutes** (uploads ~1GB image).

### 5.4 Build the frontend image

```bash
docker build -f Dockerfile.frontend \
  --build-arg REACT_APP_BACKEND_URL=https://biqc-web.azurewebsites.net \
  --build-arg REACT_APP_SUPABASE_URL=YOUR_SUPABASE_URL \
  --build-arg REACT_APP_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY \
  -t biqcregistry.azurecr.io/biqc-frontend:latest .
```

**Replace:**
- `YOUR_SUPABASE_URL` with your actual Supabase project URL
- `YOUR_SUPABASE_ANON_KEY` with your actual Supabase anon key

### 5.5 Push frontend to Azure

```bash
docker push biqcregistry.azurecr.io/biqc-frontend:latest
```

---

## PHASE 6: CONFIGURE ENVIRONMENT VARIABLES

### 6.1 Via Azure Portal (Easiest)

1. Go to https://portal.azure.com
2. Search for `biqc-api` in the top search bar
3. Click on your backend App Service
4. In the left menu, click **Configuration**
5. Click **+ New application setting** for each of these:

| Name | Value | Where to find it |
|------|-------|-------------------|
| `SUPABASE_URL` | `https://xxx.supabase.co` | Supabase Dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | `eyJ...` | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase Dashboard → Settings → API |
| `JWT_SECRET` | Your JWT secret | Same as your current backend/.env |
| `OPENAI_API_KEY` | `sk-...` | Your OpenAI API key |
| `EMERGENT_LLM_KEY` | `sk-emergent-...` | Your Emergent key |
| `SERPER_API_KEY` | `5b47...` | Your Serper key |
| `STRIPE_API_KEY` | `sk_test_...` | Your Stripe key |
| `CORS_ORIGINS` | `*` | Just type * |
| `MONGO_URL` | `mongodb://localhost:27017` | Keep same |
| `DB_NAME` | `test_database` | Keep same |
| `WEBSITES_PORT` | `8001` | Just type 8001 |

6. Click **Save** at the top
7. Click **Continue** when prompted to restart

### 6.2 Via Command Line (Alternative)

```bash
az webapp config appsettings set \
  --resource-group biqc-production \
  --name biqc-api \
  --settings \
  SUPABASE_URL="https://xxx.supabase.co" \
  SUPABASE_ANON_KEY="eyJ..." \
  SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
  JWT_SECRET="your-secret" \
  SERPER_API_KEY="5b47..." \
  CORS_ORIGINS="*"
```

---

## PHASE 7: CONNECT REGISTRY TO WEB APPS

Tell Azure where to find your Docker images:

```bash
# Backend
az webapp config container set \
  --resource-group biqc-production \
  --name biqc-api \
  --container-image-name biqcregistry.azurecr.io/biqc-backend:latest \
  --container-registry-url https://biqcregistry.azurecr.io \
  --container-registry-user biqcregistry \
  --container-registry-password YOUR_REGISTRY_PASSWORD

# Frontend
az webapp config container set \
  --resource-group biqc-production \
  --name biqc-web \
  --container-image-name biqcregistry.azurecr.io/biqc-frontend:latest \
  --container-registry-url https://biqcregistry.azurecr.io \
  --container-registry-user biqcregistry \
  --container-registry-password YOUR_REGISTRY_PASSWORD
```

Replace `YOUR_REGISTRY_PASSWORD` with the password from Step 4.3.

---

## PHASE 8: RESTART AND VERIFY

### 8.1 Restart both apps

```bash
az webapp restart --name biqc-api --resource-group biqc-production
az webapp restart --name biqc-web --resource-group biqc-production
```

### 8.2 Wait 2-3 minutes, then check

**Backend health check:**
```bash
curl https://biqc-api.azurewebsites.net/api/health
```
Expected: `{"status": "ok"}`

**Frontend:**
Open in browser: `https://biqc-web.azurewebsites.net`
You should see the BIQc homepage.

### 8.3 Check logs if something goes wrong

```bash
az webapp log tail --name biqc-api --resource-group biqc-production
```

Press Ctrl+C to stop watching logs.

---

## PHASE 9: CUSTOM DOMAIN (biqc.ai)

### 9.1 Add DNS Record

Go to your DNS provider (where thestrategysquad.com is managed — likely GoDaddy):

1. Add a **CNAME record**:
   - **Name:** `biqc`
   - **Value:** `biqc-web.azurewebsites.net`
   - **TTL:** 3600

### 9.2 Add Custom Domain in Azure

```bash
az webapp config hostname add \
  --resource-group biqc-production \
  --webapp-name biqc-web \
  --hostname biqc.ai
```

### 9.3 Enable Free SSL Certificate

1. Azure Portal → `biqc-web` → **Custom domains**
2. Click on `biqc.ai`
3. Click **Add binding**
4. Select **App Service Managed Certificate (Free)**
5. Click **Create**

After 5-10 minutes, your site will be live at `https://biqc.ai` with SSL.

---

## PHASE 10: VERIFY EVERYTHING WORKS

Open these URLs and check:

| URL | Expected |
|-----|----------|
| `https://biqc-web.azurewebsites.net` | BIQc homepage loads |
| `https://biqc-api.azurewebsites.net/api/health` | `{"status": "ok"}` |
| `https://biqc.ai` | BIQc homepage (after DNS) |
| `https://biqc.ai/login-supabase` | Login page |

---

## UPDATING YOUR APP (After Code Changes)

Whenever you make changes in Emergent and save to GitHub:

```bash
cd ~/Desktop/YOUR_REPO_NAME
git pull origin main
az acr login --name biqcregistry
docker build -f Dockerfile.backend -t biqcregistry.azurecr.io/biqc-backend:latest .
docker push biqcregistry.azurecr.io/biqc-backend:latest
az webapp restart --name biqc-api --resource-group biqc-production
```

---

## TROUBLESHOOTING

### "Login Succeeded" but push fails
```bash
az acr login --name biqcregistry
```
Try again.

### App shows "Application Error"
Check logs:
```bash
az webapp log tail --name biqc-api --resource-group biqc-production
```
Usually means environment variables are missing.

### "Name already taken"
Azure app names must be globally unique. Try:
- `biqc-api-tss` instead of `biqc-api`
- `biqc-web-tss` instead of `biqc-web`

### Docker build fails
Make sure Docker Desktop is running (whale icon in taskbar).

### Costs unexpected
Go to Azure Portal → **Cost Management + Billing** → **Cost analysis**
B1 plan should be ~$13/month. Delete unused resources if you see more.

---

## TOTAL TIME: ~45 minutes first time
## COST: ~$18/month
## RESULT: Always-on, zero cold starts, production-grade
