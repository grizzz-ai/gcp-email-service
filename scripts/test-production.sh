#!/bin/bash

set -euo pipefail

PROJECT_ID=${PROJECT_ID:-"vcapp-443523"}
ENVIRONMENT=${ENVIRONMENT:-"production"}
REGION=${REGION:-"us-central1"}
FUNCTION_NAME=${FUNCTION_NAME:-"email-worker"}

DEPLOYMENT_NAME="${FUNCTION_NAME}-${ENVIRONMENT}"

mkdir -p .artifacts

echo "🧪 Running production smoke tests for ${DEPLOYMENT_NAME}"

# Production smoke tests - more conservative than staging
FUNCTION_URL=$(gcloud functions describe "${DEPLOYMENT_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(serviceConfig.uri)" 2>/dev/null || echo "")

if [[ -z "${FUNCTION_URL}" ]]; then
  echo "❌ Production function ${DEPLOYMENT_NAME} not found or not accessible"
  exit 1
fi

START_TIME=$(date +%s%3N)

# Test 1: Function health and state
echo "🔍 Test 1: Production function health check"
FUNCTION_STATUS=$(gcloud functions describe "${DEPLOYMENT_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(state)" 2>/dev/null || echo "UNKNOWN")

if [[ "${FUNCTION_STATUS}" != "ACTIVE" ]]; then
  echo "❌ Production function is not in ACTIVE state: ${FUNCTION_STATUS}"
  exit 1
fi

# Test 2: Check for critical errors in recent logs
echo "🔍 Test 2: Checking for critical errors in production logs"
CRITICAL_ERRORS=$(gcloud logging read "resource.type=\"cloud_function\" AND resource.labels.function_name=\"${DEPLOYMENT_NAME}\" AND severity>=ERROR" \
  --limit=10 \
  --format="value(timestamp,textPayload)" \
  --project="${PROJECT_ID}" \
  --freshness=10m 2>/dev/null || echo "")

if [[ -n "${CRITICAL_ERRORS}" ]]; then
  echo "❌ Critical errors found in production function logs:"
  echo "${CRITICAL_ERRORS}"
  echo "   Production deployment may have issues"
  exit 1
fi

# Test 3: Validate production configuration
echo "🔍 Test 3: Production configuration validation"
FUNCTION_ENV=$(gcloud functions describe "${DEPLOYMENT_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(serviceConfig.environmentVariables)" 2>/dev/null || echo "")

# Verify production environment is set correctly
if [[ "${FUNCTION_ENV}" != *"ENVIRONMENT=production"* ]]; then
  echo "❌ Function environment is not set to production"
  exit 1
fi

# Test 4: Verify production SMTP configuration (optimized approach)
echo "🔍 Test 4: Production SMTP configuration validation"

# Check SMTP environment variables (non-sensitive)
FUNCTION_ENV=$(gcloud functions describe "${DEPLOYMENT_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(serviceConfig.environmentVariables)" 2>/dev/null || echo "")

SMTP_ENV_VARS=("SMTP_HOST" "SMTP_PORT" "SMTP_USERNAME")
MISSING_SMTP_ENV=()
for var in "${SMTP_ENV_VARS[@]}"; do
  if [[ "${FUNCTION_ENV}" != *"${var}"* ]]; then
    MISSING_SMTP_ENV+=("${var}")
  fi
done

if [[ ${#MISSING_SMTP_ENV[@]} -gt 0 ]]; then
  echo "❌ Production deployment missing critical SMTP environment variables: ${MISSING_SMTP_ENV[*]}"
  echo "   Function will fail at startup"
  exit 1
fi

# Check SMTP password secret (sensitive)
FUNCTION_SECRETS=$(gcloud functions describe "${DEPLOYMENT_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(serviceConfig.secretEnvironmentVariables)" 2>/dev/null || echo "")

if [[ "${FUNCTION_SECRETS}" != *"SMTP_PASSWORD"* ]]; then
  echo "❌ Production deployment missing critical SMTP_PASSWORD secret"
  echo "   Function will fail at startup"
  exit 1
fi

echo "✅ All production SMTP configuration verified (3 env vars + 1 secret)"

# Test 5: Verify function resources for production load
echo "🔍 Test 5: Production resource configuration"
FUNCTION_MEMORY=$(gcloud functions describe "${DEPLOYMENT_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(serviceConfig.availableMemory)" 2>/dev/null || echo "")

FUNCTION_TIMEOUT=$(gcloud functions describe "${DEPLOYMENT_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(serviceConfig.timeoutSeconds)" 2>/dev/null || echo "")

if [[ -n "${FUNCTION_MEMORY}" ]]; then
  MEMORY_VALUE=$(echo "${FUNCTION_MEMORY}" | grep -o '[0-9]*')
  if [[ "${MEMORY_VALUE}" -lt 512 ]]; then
    echo "⚠️  Production function memory (${FUNCTION_MEMORY}) may be insufficient for production load"
  fi
fi

END_TIME=$(date +%s%3N)
TOTAL_TIME=$((END_TIME - START_TIME))

# Generate production test results
cat > .artifacts/production-test-results.json <<EOF_RESULTS
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "${ENVIRONMENT}",
  "function_name": "${DEPLOYMENT_NAME}",
  "function_url": "${FUNCTION_URL}",
  "response_time_ms": ${TOTAL_TIME},
  "tests_passed": true,
  "version": "$(git rev-parse HEAD)",
  "test_mode": "production_smoke",
  "tests": [
    {"name": "function_health", "status": "passed", "state": "${FUNCTION_STATUS}"},
    {"name": "critical_errors", "status": "passed", "errors_found": $([ -n "${CRITICAL_ERRORS}" ] && echo "true" || echo "false")},
    {"name": "production_config", "status": "passed", "environment_correct": true},
    {"name": "secret_config", "status": "passed", "required_secrets_found": $((${#REQUIRED_SECRETS[@]} - ${#MISSING_SECRETS[@]}))},
    {"name": "resource_config", "status": "passed", "memory": "${FUNCTION_MEMORY:-unknown}", "timeout": "${FUNCTION_TIMEOUT:-unknown}"}
  ]
}
EOF_RESULTS

echo "✅ All production smoke tests passed"
echo "⏱️  Total validation time: ${TOTAL_TIME}ms"
echo "📋 Function status: ${FUNCTION_STATUS}"
echo "🔐 Secrets configured: $((${#REQUIRED_SECRETS[@]} - ${#MISSING_SECRETS[@]}))/${#REQUIRED_SECRETS[@]}"
echo "💾 Memory allocation: ${FUNCTION_MEMORY:-unknown}"
echo "⏰ Timeout: ${FUNCTION_TIMEOUT:-unknown}s"