#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# BIQc Azure Deployment Script
# Creates: Resource Group, App Service Plan, Web App, Container Registry
# Region: Australia East (Sydney)
# ═══════════════════════════════════════════════════════════════

set -e

# ═══ CONFIGURATION — UPDATE THESE ═══
RESOURCE_GROUP="biqc-production"
LOCATION="australiaeast"
APP_SERVICE_PLAN="biqc-plan"
BACKEND_APP="biqc-api"
FRONTEND_APP="biqc-web"
REGISTRY_NAME="biqcregistry"
SKU="B1"  # B1 = $13/mo (always-on, no cold starts)

echo "═══════════════════════════════════════════"
echo "BIQc Azure Deployment"
echo "Region: $LOCATION (Sydney)"
echo "Plan: $SKU"
echo "═══════════════════════════════════════════"

# Step 1: Create Resource Group
echo ""
echo "▸ Step 1: Creating Resource Group..."
az group create --name $RESOURCE_GROUP --location $LOCATION

# Step 2: Create Container Registry
echo ""
echo "▸ Step 2: Creating Container Registry..."
az acr create --resource-group $RESOURCE_GROUP --name $REGISTRY_NAME --sku Basic --admin-enabled true

# Get registry credentials
REGISTRY_URL=$(az acr show --name $REGISTRY_NAME --query loginServer --output tsv)
REGISTRY_USER=$(az acr credential show --name $REGISTRY_NAME --query username --output tsv)
REGISTRY_PASS=$(az acr credential show --name $REGISTRY_NAME --query passwords[0].value --output tsv)
echo "  Registry: $REGISTRY_URL"

# Step 3: Build and push Docker images
echo ""
echo "▸ Step 3: Building Docker images..."
az acr login --name $REGISTRY_NAME

docker build -f Dockerfile.backend -t $REGISTRY_URL/biqc-backend:latest .
docker push $REGISTRY_URL/biqc-backend:latest

docker build -f Dockerfile.frontend \
  --build-arg REACT_APP_BACKEND_URL=https://${FRONTEND_APP}.azurewebsites.net \
  -t $REGISTRY_URL/biqc-frontend:latest .
docker push $REGISTRY_URL/biqc-frontend:latest

# Step 4: Create App Service Plan (Always-On)
echo ""
echo "▸ Step 4: Creating App Service Plan (Always-On)..."
az appservice plan create \
  --name $APP_SERVICE_PLAN \
  --resource-group $RESOURCE_GROUP \
  --sku $SKU \
  --is-linux

# Step 5: Create Backend Web App
echo ""
echo "▸ Step 5: Creating Backend Web App..."
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --name $BACKEND_APP \
  --deployment-container-image-name $REGISTRY_URL/biqc-backend:latest

# Configure backend
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $BACKEND_APP \
  --settings \
  WEBSITES_PORT=8001 \
  CORS_ORIGINS="*"

echo "  → Add your Supabase keys via Azure Portal > $BACKEND_APP > Configuration"

# Step 6: Create Frontend Web App
echo ""
echo "▸ Step 6: Creating Frontend Web App..."
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --name $FRONTEND_APP \
  --deployment-container-image-name $REGISTRY_URL/biqc-frontend:latest

# Step 7: Enable Always On
echo ""
echo "▸ Step 7: Enabling Always-On (no cold starts)..."
az webapp config set --resource-group $RESOURCE_GROUP --name $BACKEND_APP --always-on true
az webapp config set --resource-group $RESOURCE_GROUP --name $FRONTEND_APP --always-on true

# Step 8: Configure custom domain (optional)
echo ""
echo "▸ Step 8: Custom domain setup..."
echo "  To add biqc.ai:"
echo "  1. Go to Azure Portal > $FRONTEND_APP > Custom domains"
echo "  2. Add custom domain: biqc.ai"
echo "  3. Add CNAME record in your DNS: biqc → ${FRONTEND_APP}.azurewebsites.net"
echo "  4. Enable free SSL certificate"

# Summary
echo ""
echo "═══════════════════════════════════════════"
echo "DEPLOYMENT COMPLETE"
echo "═══════════════════════════════════════════"
echo ""
echo "Backend:  https://${BACKEND_APP}.azurewebsites.net"
echo "Frontend: https://${FRONTEND_APP}.azurewebsites.net"
echo "Registry: $REGISTRY_URL"
echo ""
echo "NEXT STEPS:"
echo "1. Add env variables to backend via Azure Portal:"
echo "   - SUPABASE_URL"
echo "   - SUPABASE_ANON_KEY"
echo "   - SUPABASE_SERVICE_ROLE_KEY"
echo "   - OPENAI_API_KEY (or EMERGENT_LLM_KEY)"
echo "   - SERPER_API_KEY"
echo "   - JWT_SECRET"
echo "   - STRIPE_API_KEY"
echo ""
echo "2. Update DNS: CNAME biqc → ${FRONTEND_APP}.azurewebsites.net"
echo "3. Enable SSL in Azure Portal > Custom domains"
echo ""
echo "Cost: ~\$13/mo (B1 plan, always-on, no cold starts)"
echo "═══════════════════════════════════════════"
