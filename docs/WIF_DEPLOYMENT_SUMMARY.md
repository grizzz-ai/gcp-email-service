# ⚡ Quick Reference: WIF Deployment Setup

**Date**: 2025-10-03
**Status**: ✅ **COMPLETED** - Staging deployment successful
**Deployment ID**: 18230485029

---

## 🎯 What Was Achieved

Successfully configured Workload Identity Federation (WIF) for automated deployments of `gcp-email-service` Cloud Function.

**Result**: Email service now deploys automatically on every push to `main` branch.

---

## 🔧 Complete Configuration Steps

### **1. WIF Provider Configuration**

Repository не был добавлен в WIF attribute condition. Исправлено:

```bash
gcloud iam workload-identity-pools providers update-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-actions-pool \
  --attribute-condition="... || assertion.repository=='grizzz-ai/gcp-email-service'"
```

### **2. Service Account IAM Bindings**

**Principal Binding** (критически важно):
```bash
gcloud iam service-accounts add-iam-policy-binding github-actions-sa@vcapp-443523.iam.gserviceaccount.com \
  --member="principalSet://iam.googleapis.com/projects/788968930921/locations/global/workloadIdentityPools/github-actions-pool/attribute.repository/grizzz-ai/gcp-email-service" \
  --role="roles/iam.workloadIdentityUser"
```

**Self-Impersonation Roles** (для Cloud Functions deployment):
```bash
# Token Creator
gcloud iam service-accounts add-iam-policy-binding github-actions-sa@vcapp-443523.iam.gserviceaccount.com \
  --member="serviceAccount:github-actions-sa@vcapp-443523.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"

# Service Account User
gcloud iam service-accounts add-iam-policy-binding github-actions-sa@vcapp-443523.iam.gserviceaccount.com \
  --member="serviceAccount:github-actions-sa@vcapp-443523.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### **3. GitHub Actions Workflow**

**Критичный параметр** - `create_credentials_file: true`:

```yaml
- name: Authenticate with Google Cloud
  uses: google-github-actions/auth@v2
  with:
    workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
    service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}
    create_credentials_file: true  # ✅ БЕЗ ЭТОГО НЕ РАБОТАЕТ!
```

### **4. Deployment Script Configuration**

Используем `github-actions-sa` напрямую (без impersonation):

```bash
# scripts/deploy-staging.sh
SERVICE_ACCOUNT_DEFAULT="github-actions-sa@vcapp-443523.iam.gserviceaccount.com"
```

---

## 🚨 Основные Ошибки и Решения

### ❌ **Ошибка 1**: `Permission 'iam.serviceAccounts.getAccessToken' denied`

**Причина**: Репозиторий не был в WIF attribute condition
**Решение**: Добавить в attribute condition через `gcloud iam workload-identity-pools providers update-oidc`

### ❌ **Ошибка 2**: gcloud CLI не может использовать WIF credentials

**Причина**: Отсутствие `create_credentials_file: true`
**Решение**: Добавить параметр в `google-github-actions/auth@v2`

### ❌ **Ошибка 3**: `Caller is missing permission 'iam.serviceaccounts.actAs'`

**Причина**: Нет прав на self-impersonation
**Решение**: Добавить `serviceAccountUser` и `serviceAccountTokenCreator` на сам SA

### ❌ **Ошибка 4**: Repository не может аутентифицироваться

**Причина**: Нет WIF principal binding для репозитория
**Решение**: Добавить `workloadIdentityUser` binding с principalSet

---

## 📋 Checklist для Новых Репозиториев

### **Обязательные шаги**:

- [ ] Добавить репозиторий в WIF attribute condition
- [ ] Создать WIF principal binding (`workloadIdentityUser`)
- [ ] Добавить `create_credentials_file: true` в workflow
- [ ] Настроить GitHub Secrets:
  - `WIF_PROVIDER`: `projects/788968930921/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider`
  - `WIF_SERVICE_ACCOUNT`: `github-actions-sa@vcapp-443523.iam.gserviceaccount.com`

### **Для Cloud Functions**:

- [ ] Добавить self-impersonation роли на github-actions-sa:
  - `roles/iam.serviceAccountTokenCreator`
  - `roles/iam.serviceAccountUser`
- [ ] Использовать `github-actions-sa` как runtime SA (или настроить impersonation для custom SA)

### **Опционально**:

- [ ] Настроить chat webhook для нотификаций
- [ ] Добавить deployment artifacts
- [ ] Настроить monitoring и alerts

---

## 🔐 Final IAM Configuration

### **github-actions-sa Permissions**

**Project-Level Roles**:
- `roles/cloudfunctions.developer`
- `roles/run.admin`
- `roles/secretmanager.secretAccessor`

**Service Account-Level Roles** (на саму себя):
- `roles/iam.serviceAccountTokenCreator`
- `roles/iam.serviceAccountUser`

**WIF Bindings** (`workloadIdentityUser`):
- `principalSet://...attribute.repository/grizzz-ai/gcp-email-service`
- `principalSet://...attribute.repository/grizzz-ai/gcp-auth-gateway`
- `principalSet://...attribute.repository/grizzz-ai/gcr-vc-rag-ingestion`
- `principalSet://...attribute.repository/grizzz-ai/sgr-github-orchestrator`
- `principalSet://...attribute.repository/grizzz-ai/supabase-vc-analyst`

---

## 🎓 Key Learnings

### **WIF Authentication Chain**

1. GitHub Actions получает OIDC token
2. WIF Provider валидирует repository через attribute condition
3. Principal Set binding дает право на workloadIdentityUser
4. `create_credentials_file: true` создает credentials для gcloud CLI
5. Self-impersonation roles позволяют gcloud functions deploy с --service-account

### **Security Best Practices**

✅ **SA-level permissions** вместо project-wide (principle of least privilege)
✅ **Direct principal** вместо delegation chains (проще audit trail)
✅ **Repository-specific bindings** через principalSet (изоляция)
✅ **Short-lived credentials** через WIF (no static keys)

### **Why create_credentials_file is Critical**

Без этого параметра:
- WIF auth работает для `google-github-actions/*` actions
- Но gcloud CLI не имеет доступа к credentials
- `gcloud functions deploy` падает с ошибкой impersonation

С `create_credentials_file: true`:
- Создается JSON credentials file
- gcloud CLI может использовать WIF credentials
- Deployment работает корректно

---

## 📚 References

- **Full Audit**: [DEPLOYMENT_SUCCESS_AUDIT.md](./DEPLOYMENT_SUCCESS_AUDIT.md)
- **WIF Setup Guide**: [WIF_SETUP.md](./WIF_SETUP.md)
- **Deployment Template**: [DEPLOYMENT_TEMPLATE.md](./DEPLOYMENT_TEMPLATE.md)

---

## ✅ Verification Commands

```bash
# Check WIF provider configuration
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global \
  --workload-identity-pool=github-actions-pool

# Check github-actions-sa IAM policy
gcloud iam service-accounts get-iam-policy \
  github-actions-sa@vcapp-443523.iam.gserviceaccount.com

# Verify function deployment
gcloud functions describe email-worker-staging \
  --region=us-central1 \
  --format="table(name,status,serviceAccountEmail)"

# Check deployment logs
gh run list --repo grizzz-ai/gcp-email-service --limit 5
```

---

**Deployment Success**: ✅ Complete
**Production Ready**: ✅ Yes
**Reusable Pattern**: ✅ Documented
