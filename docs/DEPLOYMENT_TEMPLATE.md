# Deployment Template for New Repositories

## Quick Setup Checklist

- [ ] Add repository to WIF provider attribute condition
- [ ] Set GitHub repository secrets
- [ ] Copy workflow template
- [ ] Configure deployment scripts
- [ ] Test deployment

## 1. Add Repository to WIF (Required)

```bash
# Replace YOUR-NEW-REPO with actual repository name
gcloud iam workload-identity-pools providers update-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-actions-pool \
  --attribute-condition="assertion.repository=='grizzz-ai/sgr-github-orchestrator' || assertion.repository=='grizzz-ai/gcp-auth-gateway' || assertion.repository=='grizzz-ai/gcr-vc-rag-ingestion' || assertion.repository=='grizzz-ai/gcr-vc-rag-api' || assertion.repository=='grizzz-ai/gcr-vc-agent-orchestrator' || assertion.repository=='grizzz-ai/vc-rag-agent-ui' || assertion.repository=='grizzz-ai/supabase-vc-analyst' || assertion.repository=='grizzz-ai/gcp-email-service' || assertion.repository=='grizzz-ai/YOUR-NEW-REPO'"
```

## 2. GitHub Repository Secrets

```bash
gh secret set WIF_PROVIDER --body "projects/788968930921/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider"
gh secret set WIF_SERVICE_ACCOUNT --body "github-actions-sa@vcapp-443523.iam.gserviceaccount.com"
```

## 3. GitHub Actions Workflow Template

Save as `.github/workflows/deploy.yml`:

```yaml
name: Deploy Pipeline
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test

  deploy-staging:
    needs: validate
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}
          access_token_lifetime: 3600s
          access_token_scopes: https://www.googleapis.com/auth/cloud-platform

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Deploy to Staging
        env:
          BUILD_ID: ${{ github.run_number }}
          BRANCH_NAME: ${{ github.ref_name }}
          # Add your specific environment variables here
          SMTP_HOST_VALUE: "smtp.gmail.com"
          SMTP_PORT_VALUE: "587"
          SMTP_USERNAME_VALUE: "tzhb@grizzz.ai"
          SMTP_PASSWORD_SECRET: "mail-pass-staging"
        run: ./scripts/deploy-staging.sh

      - name: Upload deployment artifacts
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: deployment-artifacts-staging-${{ github.run_number }}
          path: .artifacts/
          retention-days: 7
```

## 4. Deployment Script Template

Save as `scripts/deploy-staging.sh`:

```bash
#!/bin/bash
set -euo pipefail

# Configuration with GSM fallback
PROJECT_ID=${PROJECT_ID:-$(gcloud secrets versions access latest --secret="project-id-staging" 2>/dev/null || echo "vcapp-443523")}
ENVIRONMENT=${ENVIRONMENT:-"staging"}
REGION=${REGION:-"us-central1"}
FUNCTION_NAME=${FUNCTION_NAME:-"your-function-name"}
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
echo "  Build ID:      ${BUILD_ID}"
echo "  Branch:        ${BRANCH_NAME}"

# Simulation check
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
  cat > .artifacts/deployment-${ENVIRONMENT}.json <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "build_id": "${BUILD_ID}",
  "environment": "${ENVIRONMENT}",
  "project_id": "${PROJECT_ID}",
  "deployment_mode": "simulation"
}
EOF
  echo "✅ Deployment simulation completed"
  exit 0
fi

# Environment variables (non-sensitive)
ENV_VARS=(
  "ENVIRONMENT=${ENVIRONMENT}"
  # Add your environment variables here
)

# GSM secret mappings (sensitive)
SECRET_MAPPINGS=(
  "PROJECT_ID=project-id-staging:latest"
  # Add your secret mappings here
  # "API_KEY=your-api-key-secret:latest"
)

# Service account
SERVICE_ACCOUNT_DEFAULT="github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com"
SERVICE_ACCOUNT=${SERVICE_ACCOUNT:-${SERVICE_ACCOUNT_DEFAULT}}

echo "🔐 Secrets configured: ${#SECRET_MAPPINGS[@]}"
echo "🌐 Service Account: ${SERVICE_ACCOUNT}"

# Deploy Cloud Function
gcloud functions deploy "${DEPLOYMENT_NAME}" \
  --gen2 \
  --runtime=nodejs22 \
  --region="${REGION}" \
  --source=. \
  --entry-point=yourEntryPoint \
  --trigger-topic=your-topic \
  --memory=256MiB \
  --timeout=120s \
  --max-instances=50 \
  --min-instances=0 \
  --service-account="${SERVICE_ACCOUNT}" \
  --project="${PROJECT_ID}" \
  --set-env-vars="$(IFS=,; echo "${ENV_VARS[*]}")" \
  --set-secrets="$(IFS=,; echo "${SECRET_MAPPINGS[*]}")" \
  --quiet

# Save deployment report
FUNCTION_URL=$(gcloud functions describe "${DEPLOYMENT_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(serviceConfig.uri)" || echo "")

cat > .artifacts/deployment-${ENVIRONMENT}.json <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "build_id": "${BUILD_ID}",
  "environment": "${ENVIRONMENT}",
  "project_id": "${PROJECT_ID}",
  "region": "${REGION}",
  "function_name": "${DEPLOYMENT_NAME}",
  "function_url": "${FUNCTION_URL}",
  "version": "$(git rev-parse HEAD)",
  "branch": "${BRANCH_NAME}"
}
EOF

echo "✅ Deployment completed"
echo "🔗 Function URL: ${FUNCTION_URL:-unavailable}"
```

## 5. Make Script Executable

```bash
chmod +x scripts/deploy-staging.sh
```

## 6. Available Reusable Secrets

### Project Configuration
- `project-id-staging` → `vcapp-443523`
- `project-id-production` → `vcapp-443523`

### Email Service (Gmail)
- `mail-pass-staging` → Gmail app password for staging
- `mail-pass-prod` → Gmail app password for production
- SMTP settings:
  - Host: `smtp.gmail.com`
  - Port: `587`
  - Username: `tzhb@grizzz.ai`

### Database (Supabase)
- `auth-supabase-project-staging`
- `auth-supabase-project-production`
- `supabase-project-staging`
- `supabase-project-production`

## 7. Customization Points

### For Cloud Functions
- Update `FUNCTION_NAME`
- Set correct `--entry-point`
- Configure `--trigger-topic` or `--trigger-http`
- Adjust memory and timeout limits

### For Cloud Run
- Replace `gcloud functions deploy` with `gcloud run deploy`
- Use `--source=.` or `--image=gcr.io/PROJECT/IMAGE`
- Configure `--port` and `--allow-unauthenticated` as needed

### For other services
- Adapt the `gcloud` deployment command
- Keep the WIF authentication and secret management pattern

## 8. Testing

```bash
# Test locally with simulation
DRY_RUN=true ./scripts/deploy-staging.sh

# Test secret access
gcloud secrets versions access latest --secret="project-id-staging"

# Verify function deployment
gcloud functions describe your-function-staging --region=us-central1
```

## 9. Production Deployment

Create `scripts/deploy-production.sh` with:
- `ENVIRONMENT="production"`
- `project-id-production` secret
- Production-specific secrets
- Stricter validation requirements
- Tag-based triggers instead of branch-based