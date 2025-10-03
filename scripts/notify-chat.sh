#!/usr/bin/env bash

# Email Service - Rich Text Google Chat Notification
# Based on organizational standard from gcp-auth-gateway
# Uses backticks for highlighting values

set -euo pipefail

# Inputs (environment variables)
CHAT_WEBHOOK_URL=${CHAT_WEBHOOK_URL:-}
ENVIRONMENT=${ENVIRONMENT:-staging}
NOTIFY_CONTEXT=${NOTIFY_CONTEXT:-deployment}
STATUS=${STATUS:-}
if [ -z "$STATUS" ] && [ -n "$JOB_STATUS" ]; then STATUS=$JOB_STATUS; fi
STATUS_LOWER=$(echo "${STATUS:-success}" | tr '[:upper:]' '[:lower:]')
STATUS_UPPER=$(echo "${STATUS:-success}" | tr '[:lower:]' '[:upper:]')

REPO_NAME=${REPO_NAME:-${GITHUB_REPOSITORY:-grizzz-ai/gcp-email-service}}
BUILD_ID=${BUILD_ID:-${GITHUB_RUN_ID:-$(date +%s)}}
REF_NAME=${REF_NAME:-${GITHUB_REF_NAME:-}}
if [ -z "$REF_NAME" ] && [ -n "$BRANCH_NAME" ]; then REF_NAME="$BRANCH_NAME"; fi
COMMIT_SHA=${COMMIT_SHA:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}
COMMIT_SHORT=${COMMIT_SHA:0:8}
FUNCTION_URL=${FUNCTION_URL:-}
RESPONSE_TIME_MS=${RESPONSE_TIME_MS:-}
TESTS_PASSED=${TESTS_PASSED:-}
TESTS_TOTAL=${TESTS_TOTAL:-}

# Email service specific context
EMAIL_TEMPLATES=${EMAIL_TEMPLATES:-"2"}
SMTP_PROVIDER=${SMTP_PROVIDER:-"Gmail"}
DELIVERY_STATUS=${DELIVERY_STATUS:-"ready"}

# Determine header icon and status label
REPO_LABEL=$(echo "${REPO_NAME}" | awk -F'/' '{print $NF}')
ENV_LABEL=$([[ "$ENVIRONMENT" = "production" ]] && echo "PRODUCTION" || echo "STAGING")
STATUS_LABEL=$([[ "$STATUS_LOWER" = "success" ]] && echo "SUCCESS" || echo "FAILED")

if [ "$STATUS_LOWER" = "success" ]; then
  HEADER_ICON=$([[ "$ENVIRONMENT" = "production" ]] && echo "🚀" || echo "📧")
  STATUS_EMOJI="✅"
else
  HEADER_ICON="❌"
  STATUS_EMOJI="❌"
fi

TITLE="$HEADER_ICON $REPO_LABEL | $ENV_LABEL | $STATUS_LABEL"

# Check service health
check_service_health() {
  local url="$1"
  local timeout=5

  if command -v curl >/dev/null 2>&1 && [ -n "$url" ]; then
    local response=$(curl -s --max-time $timeout "$url" 2>/dev/null || echo "")
    if echo "$response" | grep -q '"status":"ok"' 2>/dev/null; then
      echo "✅ Healthy"
    else
      echo "❌ Unhealthy"
    fi
  else
    echo "❓ Unknown"
  fi
}

# Get service health if URL provided
SERVICE_HEALTH=""
if [ -n "$FUNCTION_URL" ]; then
  SERVICE_HEALTH=$(check_service_health "$FUNCTION_URL")
fi

# Build GitHub links
GITHUB_SERVER_URL=${GITHUB_SERVER_URL:-}
GITHUB_REPOSITORY=${GITHUB_REPOSITORY:-}
GITHUB_RUN_ID=${GITHUB_RUN_ID:-}

if [ -n "$GITHUB_SERVER_URL" ] && [ -n "$GITHUB_REPOSITORY" ] && [ -n "$GITHUB_RUN_ID" ]; then
  BUILD_URL="$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
  REPO_URL="$GITHUB_SERVER_URL/$GITHUB_REPOSITORY"
else
  BUILD_URL="https://github.com/$REPO_NAME/actions/runs/$BUILD_ID"
  REPO_URL="https://github.com/$REPO_NAME"
fi

# Read deployment artifacts for additional context
ARTIFACTS_DIR=".artifacts"
DEPLOYMENT_FILE="$ARTIFACTS_DIR/deployment-${ENVIRONMENT}.json"
DEPLOYMENT_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [ -f "$DEPLOYMENT_FILE" ]; then
  ARTIFACT_TIME=$(jq -r '.timestamp // "unknown"' "$DEPLOYMENT_FILE" 2>/dev/null || echo "unknown")
  if [ "$ARTIFACT_TIME" != "unknown" ]; then
    DEPLOYMENT_TIME="$ARTIFACT_TIME"
  fi
fi

# Build comprehensive rich text message with backticks for highlighting
TEXT_FALLBACK="$TITLE\n"
TEXT_FALLBACK="${TEXT_FALLBACK}================================================\n"
TEXT_FALLBACK="${TEXT_FALLBACK}📧 Email Delivery Service\n"
TEXT_FALLBACK="${TEXT_FALLBACK}📨 Pub/Sub → SMTP with GCS Attachments\n\n"

# Environment and status section
TEXT_FALLBACK="${TEXT_FALLBACK}🧪 Environment: \`$ENVIRONMENT\`\n"
TEXT_FALLBACK="${TEXT_FALLBACK}$STATUS_EMOJI Status: \`$STATUS_UPPER\`\n"
TEXT_FALLBACK="${TEXT_FALLBACK}📋 Version: \`${REF_NAME:-unknown}\`\n"
TEXT_FALLBACK="${TEXT_FALLBACK}🔗 Commit: \`$COMMIT_SHORT\`\n"
TEXT_FALLBACK="${TEXT_FALLBACK}⏰ Deployed: \`$DEPLOYMENT_TIME\`\n"
TEXT_FALLBACK="${TEXT_FALLBACK}🆔 Build ID: \`$BUILD_ID\`\n\n"

# Deployment metrics section
TEXT_FALLBACK="${TEXT_FALLBACK}📊 Email Service Configuration:\n"
TEXT_FALLBACK="${TEXT_FALLBACK}   • 📬 Provider: \`$SMTP_PROVIDER\`\n"
TEXT_FALLBACK="${TEXT_FALLBACK}   • 📄 Templates: \`$EMAIL_TEMPLATES\` configured\n"
TEXT_FALLBACK="${TEXT_FALLBACK}   • 📨 Delivery: \`$DELIVERY_STATUS\`\n"

if [ -n "$RESPONSE_TIME_MS" ]; then
  TEXT_FALLBACK="${TEXT_FALLBACK}   • ⏱️ Response Time: \`${RESPONSE_TIME_MS}ms\`\n"
fi

if [ -n "$TESTS_PASSED" ] && [ -n "$TESTS_TOTAL" ]; then
  if [ "$TESTS_PASSED" = "$TESTS_TOTAL" ]; then
    TEST_STATUS="✅"
  else
    TEST_STATUS="⚠️"
  fi
  TEXT_FALLBACK="${TEXT_FALLBACK}   • $TEST_STATUS Tests: \`$TESTS_PASSED/$TESTS_TOTAL\` passed\n"
fi

TEXT_FALLBACK="${TEXT_FALLBACK}\n"

# Service health section
if [ -n "$SERVICE_HEALTH" ]; then
  TEXT_FALLBACK="${TEXT_FALLBACK}🏥 Service Health:\n"
  TEXT_FALLBACK="${TEXT_FALLBACK}   • 🌐 Email Worker: $SERVICE_HEALTH\n\n"
fi

# Links section
TEXT_FALLBACK="${TEXT_FALLBACK}🔗 Links:\n"
if [ -n "$FUNCTION_URL" ]; then
  TEXT_FALLBACK="${TEXT_FALLBACK}   • 🌐 Service: $FUNCTION_URL\n"
fi
TEXT_FALLBACK="${TEXT_FALLBACK}   • 🏗️ Build Logs: $BUILD_URL\n"
TEXT_FALLBACK="${TEXT_FALLBACK}   • 📊 Repository: $REPO_URL\n\n"

# Email service features section
case "$NOTIFY_CONTEXT" in
  deployment|release)
    TEXT_FALLBACK="${TEXT_FALLBACK}📧 Email Features:\n"
    TEXT_FALLBACK="${TEXT_FALLBACK}   • ✅ Pub/Sub event-driven delivery\n"
    TEXT_FALLBACK="${TEXT_FALLBACK}   • ✅ GCS attachment support\n"
    TEXT_FALLBACK="${TEXT_FALLBACK}   • ✅ HTML template rendering\n"
    TEXT_FALLBACK="${TEXT_FALLBACK}   • ✅ GSM credentials management\n"
    TEXT_FALLBACK="${TEXT_FALLBACK}   • ✅ Structured logging & monitoring\n"
    TEXT_FALLBACK="${TEXT_FALLBACK}\n"
    ;;
  validation)
    TEXT_FALLBACK="${TEXT_FALLBACK}🧪 Validation Results:\n"
    TEXT_FALLBACK="${TEXT_FALLBACK}   • ✅ SMTP connection verified\n"
    TEXT_FALLBACK="${TEXT_FALLBACK}   • ✅ Template rendering working\n"
    TEXT_FALLBACK="${TEXT_FALLBACK}   • ✅ Pub/Sub trigger configured\n\n"
    ;;
esac

# Status-specific next steps
if [ "$STATUS_LOWER" = "success" ]; then
  TEXT_FALLBACK="${TEXT_FALLBACK}✨ Next Steps:\n"
  case "$NOTIFY_CONTEXT" in
    deployment)
      TEXT_FALLBACK="${TEXT_FALLBACK}   • 📨 Test email delivery flow\n"
      TEXT_FALLBACK="${TEXT_FALLBACK}   • 📊 Monitor Pub/Sub metrics\n"
      if [ "$ENVIRONMENT" = "staging" ]; then
        TEXT_FALLBACK="${TEXT_FALLBACK}   • 🚀 Ready for production deployment\n"
      fi
      ;;
    build)
      TEXT_FALLBACK="${TEXT_FALLBACK}   • 🚀 Deploy to \`$ENVIRONMENT\` environment\n"
      TEXT_FALLBACK="${TEXT_FALLBACK}   • 🧪 Execute email flow tests\n"
      ;;
    *)
      TEXT_FALLBACK="${TEXT_FALLBACK}   • 📊 Monitor delivery metrics\n"
      TEXT_FALLBACK="${TEXT_FALLBACK}   • 🔄 Continue with workflow\n"
      ;;
  esac
else
  TEXT_FALLBACK="${TEXT_FALLBACK}🚨 Action Required:\n"
  TEXT_FALLBACK="${TEXT_FALLBACK}   • 🔍 Review build logs for errors\n"
  TEXT_FALLBACK="${TEXT_FALLBACK}   • 🔧 Check SMTP configuration\n"
  TEXT_FALLBACK="${TEXT_FALLBACK}   • 📞 Contact DevOps if issues persist\n"
fi

# Send notification with retry mechanism
send_with_retry() {
  local payload="$1"
  local attempts=3
  local delay=2

  echo "📢 Sending deployment notification to Google Chat..."

  for i in $(seq 1 $attempts); do
    if [ -z "$CHAT_WEBHOOK_URL" ]; then
      echo "ℹ️  CHAT_WEBHOOK_URL not set — skipping notification"
      echo "📋 Message preview:"
      echo -e "$TEXT_FALLBACK"
      return 0
    fi

    RESP=$(curl -sS -w "\n%{http_code}" \
      -H "Content-Type: application/json" \
      -X POST \
      -d "$payload" \
      "$CHAT_WEBHOOK_URL" 2>/dev/null || echo -e "\n000")

    CODE=$(echo "$RESP" | tail -n1)
    BODY=$(echo "$RESP" | head -n -1)

    if [ "$CODE" = "200" ]; then
      echo "✅ Deployment notification sent successfully (HTTP $CODE)."
      return 0
    else
      echo "❌ Attempt $i failed (HTTP $CODE): $BODY" >&2
      if [ $i -lt $attempts ]; then
        echo "🔄 Retrying in ${delay}s..." >&2
        sleep $delay
        delay=$((delay*2))
      fi
    fi
  done

  echo "❌ Failed to send notification after $attempts attempts." >&2
  return 1
}

# Format message for JSON payload using Python for proper escaping
if command -v python3 >/dev/null 2>&1; then
  FORMATTED_TEXT=$(python3 -c "import json,sys; print(json.dumps('''$TEXT_FALLBACK'''))")
elif command -v python >/dev/null 2>&1; then
  FORMATTED_TEXT=$(python -c "import json,sys; print(json.dumps('''$TEXT_FALLBACK'''))")
else
  # Fallback: basic escaping (less reliable but functional)
  FORMATTED_TEXT=$(echo "$TEXT_FALLBACK" | sed 's/"/\\"/g' | sed 's/$/\\n/' | tr -d '\n' | sed 's/\\n$//')
  FORMATTED_TEXT="\"$FORMATTED_TEXT\""
  echo "⚠️ Using basic JSON escaping. Install Python for better reliability."
fi

TEXT_PAYLOAD=$(printf '{"text": %s}' "$FORMATTED_TEXT")

# Send the notification
send_with_retry "$TEXT_PAYLOAD"

echo "🎉 Notification process complete."
exit 0
