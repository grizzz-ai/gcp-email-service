#!/bin/bash

set -euo pipefail

PROJECT_ID=${PROJECT_ID:-$(gcloud secrets versions access latest --secret="project-id-production" 2>/dev/null || echo "vcapp-443523")}
ENVIRONMENT=${ENVIRONMENT:-"production"}
REGION=${REGION:-"us-central1"}
FUNCTION_NAME=${FUNCTION_NAME:-"email-worker"}
PUBSUB_TOPIC=${PUBSUB_TOPIC:-"email-delivery"}
BUILD_ID=${BUILD_ID:-$(date +%s)}
TAG_NAME=${TAG_NAME:-$(git describe --tags --exact-match 2>/dev/null || echo "unknown")}

DEPLOYMENT_NAME="${FUNCTION_NAME}-${ENVIRONMENT}"

mkdir -p .artifacts

echo "🚀 Starting ${DEPLOYMENT_NAME} production deployment"
echo "📋 Configuration"
echo "  Project:       ${PROJECT_ID}"
echo "  Environment:   ${ENVIRONMENT}"
echo "  Region:        ${REGION}"
echo "  Pub/Sub Topic: ${PUBSUB_TOPIC}"
echo "  Build ID:      ${BUILD_ID}"
echo "  Tag:           ${TAG_NAME}"

# OPTIMIZED: Verify SMTP configuration is provided (password via secret, others via env vars)
if [[ -z "${SMTP_PASSWORD_SECRET:-}" ]]; then
  echo "❌ PRODUCTION DEPLOYMENT BLOCKED: Missing SMTP password secret environment variable"
  echo "   Required: SMTP_PASSWORD_SECRET"
  exit 1
fi

if [[ -z "${SMTP_HOST_VALUE:-}" ]] || [[ -z "${SMTP_PORT_VALUE:-}" ]] || [[ -z "${SMTP_USERNAME_VALUE:-}" ]]; then
  echo "❌ PRODUCTION DEPLOYMENT BLOCKED: Missing SMTP configuration environment variables"
  echo "   Required: SMTP_HOST_VALUE, SMTP_PORT_VALUE, SMTP_USERNAME_VALUE"
  exit 1
fi

# Verify GCP authentication
if ! command -v gcloud >/dev/null 2>&1; then
  echo "❌ gcloud CLI not available"
  exit 1
fi

if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1 >/dev/null 2>&1; then
  echo "❌ No active GCP authentication"
  exit 1
fi

# Environment variables for the function
ENV_VARS=(
  "ENVIRONMENT=${ENVIRONMENT}"
  "PUBSUB_TOPIC=${PUBSUB_TOPIC}"
)

# Optional environment variables
if [[ -n "${MAIL_FROM_VALUE:-}" ]]; then
  ENV_VARS+=("MAIL_FROM=${MAIL_FROM_VALUE}")
fi
if [[ -n "${LOG_LEVEL:-}" ]]; then
  ENV_VARS+=("LOG_LEVEL=${LOG_LEVEL}")
fi

# OPTIMIZED: SMTP host/port/username via environment variables (non-sensitive)
ENV_VARS+=("SMTP_HOST=${SMTP_HOST_VALUE}")
ENV_VARS+=("SMTP_PORT=${SMTP_PORT_VALUE}")
ENV_VARS+=("SMTP_USERNAME=${SMTP_USERNAME_VALUE}")

# OPTIMIZED: PROJECT_ID and SMTP password via GSM secrets (sensitive)
SECRET_MAPPINGS=(
  "PROJECT_ID=project-id-production:latest"
  "SMTP_PASSWORD=${SMTP_PASSWORD_SECRET}:latest"
)

# Optional secrets
if [[ -n "${MAIL_FROM_SECRET:-}" ]]; then
  SECRET_MAPPINGS+=("MAIL_FROM=${MAIL_FROM_SECRET}:latest")
fi

SERVICE_ACCOUNT_DEFAULT="email-worker-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
SERVICE_ACCOUNT=${SERVICE_ACCOUNT:-${SERVICE_ACCOUNT_DEFAULT}}

echo "🔐 Secrets configured: ${#SECRET_MAPPINGS[@]}"
echo "🌐 Service Account: ${SERVICE_ACCOUNT}"

echo "📦 Deploying Cloud Function ${DEPLOYMENT_NAME} to production"

COMMAND_ARGS=(
  "--gen2"
  "--runtime=nodejs22"
  "--region=${REGION}"
  "--source=."
  "--entry-point=handleEmailEvent"
  "--trigger-topic=${PUBSUB_TOPIC}"
  "--memory=512MiB"
  "--timeout=120s"
  "--max-instances=100"
  "--min-instances=1"
  "--service-account=${SERVICE_ACCOUNT}"
  "--project=${PROJECT_ID}"
  "--quiet"
  "--set-env-vars" "$(IFS=,; echo "${ENV_VARS[*]}")"
  "--set-secrets" "$(IFS=,; echo "${SECRET_MAPPINGS[*]}")"
)

# Deploy the function
gcloud functions deploy "${DEPLOYMENT_NAME}" "${COMMAND_ARGS[@]}"

# Get function URL
FUNCTION_URL=$(gcloud functions describe "${DEPLOYMENT_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(serviceConfig.uri)" || echo "")

# Save deployment artifacts
cat > .artifacts/deployment-${ENVIRONMENT}.json <<EOF_REPORT
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "build_id": "${BUILD_ID}",
  "environment": "${ENVIRONMENT}",
  "project_id": "${PROJECT_ID}",
  "region": "${REGION}",
  "function_name": "${DEPLOYMENT_NAME}",
  "function_url": "${FUNCTION_URL}",
  "pubsub_topic": "${PUBSUB_TOPIC}",
  "version": "$(git rev-parse HEAD)",
  "tag": "${TAG_NAME}",
  "secrets_mapped": ${#SECRET_MAPPINGS[@]}
}
EOF_REPORT

echo "✅ Production deployment completed"
echo "🔗 Function URL: ${FUNCTION_URL:-unavailable}"
echo "📊 Secrets mapped: ${#SECRET_MAPPINGS[@]}/4 required SMTP secrets"