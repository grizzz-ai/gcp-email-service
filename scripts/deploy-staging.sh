#!/bin/bash

set -euo pipefail

PROJECT_ID=${PROJECT_ID:-$(gcloud secrets versions access latest --secret="project-id-staging" 2>/dev/null || echo "vcapp-443523")}
ENVIRONMENT=${ENVIRONMENT:-"staging"}
REGION=${REGION:-"us-central1"}
FUNCTION_NAME=${FUNCTION_NAME:-"email-worker"}
PUBSUB_TOPIC=${PUBSUB_TOPIC:-"email-delivery"}
BUILD_ID=${BUILD_ID:-$(date +%s)}
BRANCH_NAME=${BRANCH_NAME:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")}
DRY_RUN=${DRY_RUN:-"false"}

DEPLOYMENT_NAME="${FUNCTION_NAME}-${ENVIRONMENT}"

mkdir -p .artifacts

echo "🚀 Starting ${DEPLOYMENT_NAME} deployment"
echo "📋 Configuration"
echo "  Project:       ${PROJECT_ID}"
echo "  Environment:   ${ENVIRONMENT}"
echo "  Region:        ${REGION}"
echo "  Pub/Sub Topic: ${PUBSUB_TOPIC}"
echo "  Build ID:      ${BUILD_ID}"
echo "  Branch:        ${BRANCH_NAME}"

should_simulate() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    return 0
  fi
  if ! command -v gcloud >/dev/null 2>&1; then
    return 0
  fi
  if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1 >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

if should_simulate; then
  echo "⚠️  GCP authentication unavailable or dry-run requested — running in simulation mode"
  cat > .artifacts/deployment-${ENVIRONMENT}.json <<EOF_SIM
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "build_id": "${BUILD_ID}",
  "environment": "${ENVIRONMENT}",
  "project_id": "${PROJECT_ID}",
  "region": "${REGION}",
  "function_name": "${DEPLOYMENT_NAME}",
  "pubsub_topic": "${PUBSUB_TOPIC}",
  "version": "$(git rev-parse HEAD 2>/dev/null || echo \"unknown\")",
  "branch": "${BRANCH_NAME}",
  "deployment_mode": "simulation"
}
EOF_SIM
  echo "✅ Deployment simulation completed"
  exit 0
fi

ENV_VARS=(
  "ENVIRONMENT=${ENVIRONMENT}"
  "PUBSUB_TOPIC=${PUBSUB_TOPIC}"
)

# Optional environment variables
if [[ -n "${MAIL_FROM_VALUE:-}" ]]; then
  ENV_VARS+=("MAIL_FROM=${MAIL_FROM_VALUE}")
fi
if [[ -n "${ENABLE_DEBUG_LOGS:-}" ]]; then
  ENV_VARS+=("ENABLE_DEBUG_LOGS=${ENABLE_DEBUG_LOGS}")
fi
if [[ -n "${LOG_LEVEL:-}" ]]; then
  ENV_VARS+=("LOG_LEVEL=${LOG_LEVEL}")
fi

# HARDCODED: Gmail SMTP settings (non-sensitive, never change)
ENV_VARS+=("SMTP_HOST=smtp.gmail.com")
ENV_VARS+=("SMTP_PORT=587")
ENV_VARS+=("SMTP_USERNAME=tzhb@grizzz.ai")

# OPTIMIZED: PROJECT_ID and SMTP password via GSM secrets (sensitive)
SECRET_MAPPINGS=(
  "PROJECT_ID=project-id-staging:latest"
  "SMTP_PASSWORD=mail-pass-staging:latest"
)
if [[ -n "${MAIL_FROM_SECRET:-}" ]]; then
  SECRET_MAPPINGS+=("MAIL_FROM=${MAIL_FROM_SECRET}:latest")
fi

ENV_FLAGS=("--set-env-vars" "$(IFS=,; echo "${ENV_VARS[*]}")")
SECRET_FLAGS=()
if [[ ${#SECRET_MAPPINGS[@]} -gt 0 ]]; then
  SECRET_FLAGS=("--set-secrets" "$(IFS=,; echo "${SECRET_MAPPINGS[*]}")")
fi

SERVICE_ACCOUNT_DEFAULT="github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com"
SERVICE_ACCOUNT=${SERVICE_ACCOUNT:-${SERVICE_ACCOUNT_DEFAULT}}

log_env_summary() {
  echo "🔐 Secrets configured: ${#SECRET_MAPPINGS[@]}"
  echo "🌐 Service Account: ${SERVICE_ACCOUNT}"
}

log_env_summary

echo "📦 Deploying Cloud Function ${DEPLOYMENT_NAME}"

COMMAND_ARGS=(
  "--gen2"
  "--runtime=nodejs22"
  "--region=${REGION}"
  "--source=."
  "--entry-point=handleEmailEvent"
  "--trigger-topic=${PUBSUB_TOPIC}"
  "--memory=256MiB"
  "--timeout=120s"
  "--max-instances=50"
  "--min-instances=0"
  "--service-account=${SERVICE_ACCOUNT}"
  "--project=${PROJECT_ID}"
  "--quiet"
)

COMMAND_ARGS+=("${ENV_FLAGS[@]}")
if [[ ${#SECRET_FLAGS[@]} -gt 0 ]]; then
  COMMAND_ARGS+=("${SECRET_FLAGS[@]}")
fi

gcloud functions deploy "${DEPLOYMENT_NAME}" "${COMMAND_ARGS[@]}"

FUNCTION_URL=$(gcloud functions describe "${DEPLOYMENT_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(serviceConfig.uri)" || echo "")

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
  "branch": "${BRANCH_NAME}"
}
EOF_REPORT

echo "✅ Deployment completed"
echo "🔗 Function URL: ${FUNCTION_URL:-unavailable}"
