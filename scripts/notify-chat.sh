#!/bin/bash

set -euo pipefail

CHAT_WEBHOOK_URL=${CHAT_WEBHOOK_URL:-""}
JOB_STATUS=${JOB_STATUS:-"unknown"}
ENVIRONMENT=${ENVIRONMENT:-"staging"}
BUILD_ID=${BUILD_ID:-$(date +%s)}
REPO_NAME=${REPO_NAME:-$(git config --get remote.origin.url 2>/dev/null || echo "unknown-repo")}
BRANCH_NAME=${BRANCH_NAME:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")}
TAG_NAME=${TAG_NAME:-""}
NOTIFY_CONTEXT=${NOTIFY_CONTEXT:-"deployment"}

if [[ -z "${CHAT_WEBHOOK_URL}" ]]; then
  echo "ℹ️  CHAT_WEBHOOK_URL not set — skipping notification"
  exit 0
fi

STATUS_ICON="✅"
if [[ "${JOB_STATUS}" != "success" ]]; then
  STATUS_ICON="❌"
fi

MESSAGE_TITLE="${STATUS_ICON} ${NOTIFY_CONTEXT^} ${JOB_STATUS}"

mkdir -p .artifacts

cat <<EOF_PAYLOAD > .artifacts/chat-payload-${ENVIRONMENT}.json
{
  "text": "${MESSAGE_TITLE}\nRepository: ${REPO_NAME}\nEnvironment: ${ENVIRONMENT}\nBranch: ${BRANCH_NAME}\nTag: ${TAG_NAME}\nBuild: ${BUILD_ID}"
}
EOF_PAYLOAD

curl -sS -X POST "${CHAT_WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d @.artifacts/chat-payload-${ENVIRONMENT}.json || true

echo "📨 Notification sent (${JOB_STATUS})"
