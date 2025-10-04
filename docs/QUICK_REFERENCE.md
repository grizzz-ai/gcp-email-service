# Quick Reference Card

## WIF Setup for New Repository (2 minutes)

### 1. Add Repository to WIF
```bash
gcloud iam workload-identity-pools providers update-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-actions-pool \
  --attribute-condition="[EXISTING_CONDITION] || assertion.repository=='grizzz-ai/YOUR-REPO'"
```

### 2. Set GitHub Secrets
```bash
gh secret set WIF_PROVIDER --body "projects/788968930921/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider"
gh secret set WIF_SERVICE_ACCOUNT --body "github-actions-sa@vcapp-443523.iam.gserviceaccount.com"
```

### 3. Workflow Auth Block
```yaml
- name: Authenticate to Google Cloud
  uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
    service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}
    access_token_lifetime: 3600s
    access_token_scopes: https://www.googleapis.com/auth/cloud-platform
```

## Available Secrets

| Secret | Usage | Value |
|--------|-------|-------|
| `project-id-staging` | PROJECT_ID for staging | `vcapp-443523` |
| `project-id-production` | PROJECT_ID for production | `vcapp-443523` |
| `mail-pass-staging` | Gmail password for staging | App password |
| `mail-pass-prod` | Gmail password for production | App password |

## Gmail SMTP Settings
- **Host**: `smtp.gmail.com`
- **Port**: `587`
- **Username**: `timur.tazhbayev@grizz.miami`
- **Password**: From GSM secret

## Common Commands

### Get Current WIF Condition
```bash
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global \
  --workload-identity-pool=github-actions-pool \
  --format="value(attributeCondition)"
```

### Test Secret Access
```bash
gcloud secrets versions access latest --secret="project-id-staging"
```

### Check GitHub Secrets
```bash
gh secret list
```

### Deployment Script Pattern
```bash
# GSM with fallback
PROJECT_ID=${PROJECT_ID:-$(gcloud secrets versions access latest --secret="project-id-staging" 2>/dev/null || echo "vcapp-443523")}

# Environment variables (non-sensitive)
ENV_VARS=("ENVIRONMENT=${ENVIRONMENT}")

# Secret mappings (sensitive)
SECRET_MAPPINGS=("PROJECT_ID=project-id-staging:latest")
```

## Troubleshooting

| Error | Solution |
|-------|----------|
| `invalid_target` | Wrong project number in WIF_PROVIDER |
| `unauthorized_client` | Repository not in attribute condition |
| `permission denied` | Service account missing IAM roles |

## File Templates

- **Full Documentation**: [`docs/WIF_SETUP.md`](./WIF_SETUP.md)
- **Copy-Paste Template**: [`docs/DEPLOYMENT_TEMPLATE.md`](./DEPLOYMENT_TEMPLATE.md)