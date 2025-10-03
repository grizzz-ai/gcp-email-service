# Workload Identity Federation Setup Guide

## Overview

This guide describes how to configure Workload Identity Federation (WIF) for GitHub Actions to authenticate with Google Cloud Platform without storing service account keys.

## Prerequisites

- GCP project with billing enabled
- GitHub repository under `grizzz-ai` organization
- `gcloud` CLI installed and authenticated

## WIF Infrastructure (Already Configured)

The following infrastructure is already set up in project `vcapp-443523`:

### Workload Identity Pool
- **Pool ID**: `github-actions-pool`
- **Provider ID**: `github-provider`
- **Provider Resource Name**: `projects/788968930921/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider`

### Service Account
- **Email**: `github-actions-sa@vcapp-443523.iam.gserviceaccount.com`
- **Project-level Roles**:
  - `roles/cloudfunctions.developer`
  - `roles/run.admin`
  - `roles/secretmanager.secretAccessor`
- **Service Account Impersonation**:
  - `roles/iam.serviceAccountUser` on `email-worker-runtime@vcapp-443523.iam.gserviceaccount.com`

## Adding New Repository

### 1. Update WIF Provider Attribute Condition

Add your repository to the allowed list:

```bash
# Get current condition
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global \
  --workload-identity-pool=github-actions-pool \
  --format="value(attributeCondition)"

# Update condition to include new repository
gcloud iam workload-identity-pools providers update-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-actions-pool \
  --attribute-condition="assertion.repository=='grizzz-ai/sgr-github-orchestrator' || assertion.repository=='grizzz-ai/gcp-auth-gateway' || assertion.repository=='grizzz-ai/gcr-vc-rag-ingestion' || assertion.repository=='grizzz-ai/gcr-vc-rag-api' || assertion.repository=='grizzz-ai/gcr-vc-agent-orchestrator' || assertion.repository=='grizzz-ai/vc-rag-agent-ui' || assertion.repository=='grizzz-ai/supabase-vc-analyst' || assertion.repository=='grizzz-ai/gcp-email-service' || assertion.repository=='grizzz-ai/YOUR-NEW-REPO'"
```

### 2. Grant Service Account Impersonation (if using custom runtime SA)

If your Cloud Function uses a custom runtime service account (not `github-actions-sa`), grant impersonation rights:

```bash
# Grant github-actions-sa permission to impersonate your runtime SA
gcloud iam service-accounts add-iam-policy-binding YOUR-RUNTIME-SA@vcapp-443523.iam.gserviceaccount.com \
  --member="serviceAccount:github-actions-sa@vcapp-443523.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --project=vcapp-443523

# Example: for email-worker-runtime SA
gcloud iam service-accounts add-iam-policy-binding email-worker-runtime@vcapp-443523.iam.gserviceaccount.com \
  --member="serviceAccount:github-actions-sa@vcapp-443523.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" \
  --project=vcapp-443523
```

**Note**: Skip this step if using `github-actions-sa` as the runtime service account directly.

### 3. Configure GitHub Repository Secrets

Add the following secrets to your GitHub repository:

```bash
# Set WIF provider
gh secret set WIF_PROVIDER --body "projects/788968930921/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider"

# Set service account email
gh secret set WIF_SERVICE_ACCOUNT --body "github-actions-sa@vcapp-443523.iam.gserviceaccount.com"
```

### 4. GitHub Actions Workflow Configuration

Add the authentication step to your workflow:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write  # Required for OIDC

    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}
          access_token_lifetime: 3600s
          access_token_scopes: https://www.googleapis.com/auth/cloud-platform

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      # Your deployment steps here
```

## Secret Management Pattern

### Environment Variables vs GSM Secrets

Use this hybrid approach for configuration:

**Environment Variables (non-sensitive)**:
- SMTP_HOST
- SMTP_PORT
- SMTP_USERNAME
- ENVIRONMENT
- REGION

**GSM Secrets (sensitive)**:
- PROJECT_ID → `project-id-staging` / `project-id-production`
- SMTP_PASSWORD → `mail-pass-staging` / `mail-pass-prod`

### Deployment Script Pattern

```bash
# Get PROJECT_ID from GSM with fallback
PROJECT_ID=${PROJECT_ID:-$(gcloud secrets versions access latest --secret="project-id-staging" 2>/dev/null || echo "vcapp-443523")}

# Environment variables (non-sensitive)
ENV_VARS=(
  "ENVIRONMENT=${ENVIRONMENT}"
  "PUBSUB_TOPIC=${PUBSUB_TOPIC}"
)

# GSM secret mappings (sensitive)
SECRET_MAPPINGS=(
  "PROJECT_ID=project-id-staging:latest"
  "SMTP_PASSWORD=${SMTP_PASSWORD_SECRET}:latest"
)
```

## Available GSM Secrets

The following secrets are available for reuse:

### Project IDs
- `project-id-staging` → `vcapp-443523`
- `project-id-production` → `vcapp-443523`

### Email Configuration
- `mail-pass-staging` → Gmail app password for staging
- `mail-pass-prod` → Gmail app password for production

### Database Configuration (if needed)
- `auth-supabase-project-staging`
- `auth-supabase-project-production`
- `supabase-project-staging`
- `supabase-project-production`

## Troubleshooting

### Common Errors

**"invalid_target" error**:
- Check WIF_PROVIDER secret has correct project number (`788968930921`)
- Verify provider exists: `gcloud iam workload-identity-pools providers list --location=global --workload-identity-pool=github-actions-pool`

**"unauthorized_client" error**:
- Repository not in attribute condition
- Add repository using the command in step 1

**"permission denied" errors**:
- Service account missing required IAM roles
- Check roles: `gcloud projects get-iam-policy vcapp-443523 --flatten="bindings[].members" --filter="bindings.members:github-actions-sa@vcapp-443523.iam.gserviceaccount.com"`

### Verification Commands

```bash
# Check WIF provider configuration
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global \
  --workload-identity-pool=github-actions-pool

# Test secret access
gcloud secrets versions access latest --secret="project-id-staging"

# List available secrets
gcloud secrets list --format="table(name)"
```

## Security Best Practices

1. **Principle of Least Privilege**: Only grant minimum required IAM roles
2. **Repository Restrictions**: Use attribute conditions to limit repository access
3. **Secret Separation**: Keep sensitive data in GSM, non-sensitive in environment variables
4. **Token Lifecycle**: Use short-lived access tokens (3600s max)
5. **Audit Trail**: Monitor WIF usage in Cloud Logging

## References

- [Google Cloud Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [google-github-actions/auth](https://github.com/google-github-actions/auth)