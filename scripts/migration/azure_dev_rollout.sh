#!/usr/bin/env bash
set -euo pipefail

# Usage:
# RG=biqc-production WEB_APP=biqc-web-dev API_APP=biqc-api-dev ACR=biqcregistry \
# FRONTEND_TAG=dev-askbiqc-YYYYMMDD-HHMMSS BACKEND_TAG=dev-askbiqc-YYYYMMDD-HHMMSS \
# bash scripts/migration/azure_dev_rollout.sh

: "${RG:?RG is required}"
: "${WEB_APP:?WEB_APP is required}"
: "${API_APP:?API_APP is required}"
: "${ACR:?ACR is required}"
: "${FRONTEND_TAG:?FRONTEND_TAG is required}"
: "${BACKEND_TAG:?BACKEND_TAG is required}"

echo "Deploying frontend image to ${WEB_APP}"
az webapp config container set \
  --resource-group "${RG}" \
  --name "${WEB_APP}" \
  --container-image-name "${ACR}.azurecr.io/biqc-frontend:${FRONTEND_TAG}"

echo "Deploying backend image to ${API_APP}"
az webapp config container set \
  --resource-group "${RG}" \
  --name "${API_APP}" \
  --container-image-name "${ACR}.azurecr.io/biqc-api:${BACKEND_TAG}"

echo "Restarting apps"
az webapp restart --resource-group "${RG}" --name "${WEB_APP}"
az webapp restart --resource-group "${RG}" --name "${API_APP}"

echo "Post-deploy checks"
echo "Frontend health:"
curl -fsS "https://${WEB_APP}.azurewebsites.net/api/health" && echo
echo "Backend health:"
curl -fsS "https://${API_APP}.azurewebsites.net/api/health" && echo

echo "Done."
