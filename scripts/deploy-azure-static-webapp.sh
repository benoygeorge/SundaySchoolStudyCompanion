#!/usr/bin/env bash
set -euo pipefail

# Publish this repo to Azure Static Web Apps.
#
# Required tools: az, aws (only for optional DNS update), npm, npx.
# Required auth: az login (and aws auth only if updating Route53).
#
# Defaults are set for this repository's current Azure setup.
RG_NAME="${RG_NAME:-rg-sundayschool-studycompanion-central}"
SWA_NAME="${SWA_NAME:-sundayschool-studycompanion}"
SWA_ENV="${SWA_ENV:-production}"

# Optional custom-domain automation.
DOMAIN="${DOMAIN:-}"
ROUTE53_ZONE_ID="${ROUTE53_ZONE_ID:-}"
UPDATE_DNS="${UPDATE_DNS:-false}"
ATTACH_CUSTOM_DOMAIN="${ATTACH_CUSTOM_DOMAIN:-false}"

if ! command -v az >/dev/null 2>&1; then
  echo "Error: Azure CLI (az) is required." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required." >&2
  exit 1
fi

echo "Using RG_NAME=$RG_NAME"
echo "Using SWA_NAME=$SWA_NAME"
echo "Using SWA_ENV=$SWA_ENV"

SWA_HOST="$(az staticwebapp show --name "$SWA_NAME" --resource-group "$RG_NAME" --query defaultHostname -o tsv)"
if [[ -z "$SWA_HOST" ]]; then
  echo "Error: Could not resolve Static Web App hostname. Check RG_NAME/SWA_NAME." >&2
  exit 1
fi

echo "Building app..."
npm run build

echo "Building API..."
npm run --prefix api build

echo "Fetching deployment token..."
DEPLOY_TOKEN="$(az staticwebapp secrets list --name "$SWA_NAME" --resource-group "$RG_NAME" --query properties.apiKey -o tsv)"
if [[ -z "$DEPLOY_TOKEN" ]]; then
  echo "Error: Could not get deployment token." >&2
  exit 1
fi

echo "Deploying dist/ and api/ to https://$SWA_HOST"
npx --yes @azure/static-web-apps-cli deploy ./dist --api-location ./api --api-language node --api-version 20 --deployment-token "$DEPLOY_TOKEN" --env "$SWA_ENV"

if [[ "$UPDATE_DNS" == "true" ]]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "Error: aws CLI is required when UPDATE_DNS=true." >&2
    exit 1
  fi
  if [[ -z "$DOMAIN" || -z "$ROUTE53_ZONE_ID" ]]; then
    echo "Error: DOMAIN and ROUTE53_ZONE_ID are required when UPDATE_DNS=true." >&2
    exit 1
  fi

  echo "Updating Route53 CNAME: $DOMAIN -> $SWA_HOST"
  aws route53 change-resource-record-sets \
    --hosted-zone-id "$ROUTE53_ZONE_ID" \
    --change-batch "{\"Comment\":\"Point domain to Azure Static Web Apps\",\"Changes\":[{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{\"Name\":\"$DOMAIN\",\"Type\":\"CNAME\",\"TTL\":300,\"ResourceRecords\":[{\"Value\":\"$SWA_HOST.\"}]}}]}" \
    --output json >/dev/null

  echo "Route53 update submitted."
fi

if [[ "$ATTACH_CUSTOM_DOMAIN" == "true" ]]; then
  if [[ -z "$DOMAIN" ]]; then
    echo "Error: DOMAIN is required when ATTACH_CUSTOM_DOMAIN=true." >&2
    exit 1
  fi

  echo "Requesting SWA custom domain attach for $DOMAIN"
  set +e
  az staticwebapp hostname set --name "$SWA_NAME" --resource-group "$RG_NAME" --hostname "$DOMAIN" --output none
  rc=$?
  set -e
  if [[ $rc -ne 0 ]]; then
    echo "Domain attach is pending or failed validation. Re-run this step after DNS propagation."
  fi
fi

echo "Done. Default URL: https://$SWA_HOST"
if [[ -n "$DOMAIN" ]]; then
  echo "Custom domain target: https://$DOMAIN"
fi
