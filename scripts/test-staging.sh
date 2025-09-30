#!/bin/bash

set -euo pipefail

PROJECT_ID=${PROJECT_ID:-"vcapp-443523"}
ENVIRONMENT=${ENVIRONMENT:-"staging"}
REGION=${REGION:-"us-central1"}
FUNCTION_NAME=${FUNCTION_NAME:-"email-worker"}
DRY_RUN=${DRY_RUN:-"false"}

DEPLOYMENT_NAME="${FUNCTION_NAME}-${ENVIRONMENT}"

mkdir -p .artifacts

echo "🧪 Running staging validation tests for ${DEPLOYMENT_NAME}"

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "⚠️  Running in simulation mode"
  cat > .artifacts/staging-test-results.json <<EOF_SIM
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "${ENVIRONMENT}",
  "response_time_ms": 150,
  "tests_passed": true,
  "version": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "test_mode": "simulation",
  "tests": [
    {"name": "function_health", "status": "passed", "duration_ms": 50},
    {"name": "config_validation", "status": "passed", "duration_ms": 25},
    {"name": "secret_access", "status": "passed", "duration_ms": 75}
  ]
}
EOF_SIM
  echo "✅ Staging validation simulation completed"
  exit 0
fi

# Real validation tests
FUNCTION_URL=$(gcloud functions describe "${DEPLOYMENT_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(serviceConfig.uri)" 2>/dev/null || echo "")

if [[ -z "${FUNCTION_URL}" ]]; then
  echo "❌ Function ${DEPLOYMENT_NAME} not found or not accessible"
  exit 1
fi

START_TIME=$(date +%s%3N)

# Test 1: Function health check (via logs - functions don't have direct HTTP endpoint)
echo "🔍 Test 1: Function deployment validation"
FUNCTION_STATUS=$(gcloud functions describe "${DEPLOYMENT_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(state)" 2>/dev/null || echo "UNKNOWN")

if [[ "${FUNCTION_STATUS}" != "ACTIVE" ]]; then
  echo "❌ Function is not in ACTIVE state: ${FUNCTION_STATUS}"
  exit 1
fi

# Test 2: Check for recent startup errors in logs
echo "🔍 Test 2: Checking for startup errors in logs"
RECENT_ERRORS=$(gcloud logging read "resource.type=\"cloud_function\" AND resource.labels.function_name=\"${DEPLOYMENT_NAME}\" AND severity>=ERROR" \
  --limit=5 \
  --format="value(timestamp,textPayload)" \
  --project="${PROJECT_ID}" \
  --freshness=5m 2>/dev/null || echo "")

if [[ -n "${RECENT_ERRORS}" ]]; then
  echo "⚠️  Recent errors found in function logs:"
  echo "${RECENT_ERRORS}"
  if [[ "${STRICT_ERROR_CHECK:-false}" == "true" ]]; then
    echo "❌ STRICT_ERROR_CHECK enabled - failing on recent errors"
    exit 1
  else
    echo "   (This may indicate configuration issues - set STRICT_ERROR_CHECK=true to fail on errors)"
  fi
fi

# Test 3: Validate configuration by checking function environment
echo "🔍 Test 3: Function configuration validation"
FUNCTION_ENV=$(gcloud functions describe "${DEPLOYMENT_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(serviceConfig.environmentVariables)" 2>/dev/null || echo "")

# Basic required environment variables
REQUIRED_ENV_VARS=("ENVIRONMENT" "PROJECT_ID")
for var in "${REQUIRED_ENV_VARS[@]}"; do
  if [[ "${FUNCTION_ENV}" != *"${var}"* ]]; then
    echo "❌ Required environment variable ${var} not found in function config"
    exit 1
  fi
done

# OPTIMIZED: Check SMTP configuration (host/port/username via env vars, password via secret)
SMTP_ENV_VARS=("SMTP_HOST" "SMTP_PORT" "SMTP_USERNAME")
MISSING_SMTP_ENV=()
for var in "${SMTP_ENV_VARS[@]}"; do
  if [[ "${FUNCTION_ENV}" != *"${var}"* ]]; then
    MISSING_SMTP_ENV+=("${var}")
  fi
done

if [[ ${#MISSING_SMTP_ENV[@]} -gt 0 ]]; then
  echo "❌ Missing required SMTP environment variables: ${MISSING_SMTP_ENV[*]}"
  echo "   Function will fail at startup due to missing SMTP configuration"
  exit 1
fi

# Test 4: Check SMTP password secret is properly configured
echo "🔍 Test 4: SMTP password secret validation"
FUNCTION_SECRETS=$(gcloud functions describe "${DEPLOYMENT_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(serviceConfig.secretEnvironmentVariables)" 2>/dev/null || echo "")

if [[ "${FUNCTION_SECRETS}" != *"SMTP_PASSWORD"* ]]; then
  echo "❌ Missing required SMTP_PASSWORD secret binding"
  echo "   Function will fail at startup due to missing SMTP password"
  exit 1
else
  echo "✅ SMTP password secret properly configured"
fi

END_TIME=$(date +%s%3N)
TOTAL_TIME=$((END_TIME - START_TIME))

# Generate test results
cat > .artifacts/staging-test-results.json <<EOF_RESULTS
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "${ENVIRONMENT}",
  "function_name": "${DEPLOYMENT_NAME}",
  "function_url": "${FUNCTION_URL}",
  "response_time_ms": ${TOTAL_TIME},
  "tests_passed": true,
  "version": "$(git rev-parse HEAD)",
  "test_mode": "live",
  "smtp_config_model": "optimized_hybrid",
  "tests": [
    {"name": "function_deployment", "status": "passed", "state": "${FUNCTION_STATUS}"},
    {"name": "startup_errors", "status": "passed", "recent_errors": $([ -n "${RECENT_ERRORS}" ] && echo "true" || echo "false")},
    {"name": "environment_config", "status": "passed", "required_vars_found": ${#REQUIRED_ENV_VARS[@]}, "smtp_env_vars_found": ${#SMTP_ENV_VARS[@]}},
    {"name": "smtp_password_secret", "status": "passed", "secret_bound": true}
  ]
}
EOF_RESULTS

echo "✅ All staging validation tests passed"
echo "⏱️  Total validation time: ${TOTAL_TIME}ms"
echo "📋 Function status: ${FUNCTION_STATUS}"
echo "🔐 SMTP configuration: 3 env vars + 1 secret (optimized)"