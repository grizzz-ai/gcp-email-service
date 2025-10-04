# GCP Email Service

Node.js 22 Cloud Function for handling asynchronous email delivery events. This service uses **existing email infrastructure** from gcp-vc-analyst and consumes Pub/Sub messages, renders templates, and delivers emails via Gmail SMTP.

## Features

- Pub/Sub triggered function (Gen 2) written in Node.js 22
- **Uses existing Gmail SMTP infrastructure** from gcp-vc-analyst
- **Three production workflows**: verification-code, invite, password-reset
- **Handlebars template engine** with filesystem loading and caching
- Structured logging with correlation IDs
- GCS attachment support with size limits and retry logic
- Comprehensive error handling and timeout management
- Extensible workflow registry for easy addition of new email types

## 🔧 **Configuration (Auto-configured)**

**IMPORTANT**: This service uses existing SMTP infrastructure. No additional setup required!

### Existing Infrastructure
- **GSM Secrets**: `mail-pass-staging` and `mail-pass-prod` ✅ **Already exist**
- **Gmail SMTP**: Pre-configured with `timur.tazhbayev@grizz.miami`
- **Deployment Ready**: All secrets and configuration in place

### Automatically Configured Variables

| Variable | Value | Source |
|----------|-------|--------|
| `SMTP_HOST` | `smtp.gmail.com` | Hardcoded (Gmail) |
| `SMTP_PORT` | `587` | Hardcoded (Gmail TLS) |
| `SMTP_USERNAME` | `timur.tazhbayev@grizz.miami` | Hardcoded |
| `SMTP_PASSWORD` | *secret* | GSM: `mail-pass-{env}` |
| `MAIL_FROM` | `zzz@grizzz.ai` | Default (can be overridden) |

### Optional Tuning Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_DEBUG_LOGS` | Enable verbose logging | `false` |
| `MAX_ATTACHMENT_SIZE_BYTES` | Per-attachment size limit | 25MB |
| `MAX_TOTAL_EMAIL_SIZE_BYTES` | Total email size limit | 50MB |
| `SMTP_SEND_TIMEOUT_MS` | SMTP send timeout | 10000ms |
| `SMTP_MAX_RETRIES` | SMTP retry attempts | 3 |
| `ATTACHMENT_MAX_RETRIES` | Attachment download retries | 3 |

## 🎯 **Project Status: M1 & M2 Completed**

### **M1 MVP - Email Worker** ✅ **COMPLETED**
- ✅ Pub/Sub triggered Cloud Function (`email-delivery` topic)
- ✅ Gmail SMTP integration using existing infrastructure
- ✅ Structured logging with correlation IDs
- ✅ GCS attachment support with size limits and retry logic
- ✅ Comprehensive error handling and timeout management
- ✅ GitHub Actions CI/CD pipeline fully operational
- ✅ Workload Identity Federation (WIF) configured and tested
- ✅ Integration with existing `mail-pass-{env}` GSM secrets

### **M2 Workflow Registry** ✅ **COMPLETED**
- ✅ **Handlebars template engine** with filesystem loading and caching
- ✅ **Three production workflows**:
  - `verification-code` - Email verification codes for authentication
  - `invite` - Team/organization invitation emails
  - `password-reset` - Secure password reset links
- ✅ **JSON schemas** for payload validation (all workflows)
- ✅ **14 comprehensive unit tests** covering all workflows
- ✅ **Extensible architecture** - easy to add new workflows
- ✅ **Complete documentation** with examples and creation guide

### **Production Readiness**
- ✅ Function deployed and active: `email-worker-staging`
- ✅ All validation tests passing (14/14)
- ✅ Ready for immediate production deployment

## Local Development

```bash
npm install
npm run lint
npm run test
```

To emulate Pub/Sub events locally:

```bash
# Verification code workflow
npm run dev -- '{
  "data": {
    "workflow": "verification-code",
    "to": "user@example.com",
    "payload": {
      "code": "ABC123",
      "expires_at": "2025-10-10T12:00:00Z"
    }
  }
}'

# Invite workflow
npm run dev -- '{
  "data": {
    "workflow": "invite",
    "to": "newuser@example.com",
    "payload": {
      "inviter_name": "John Doe",
      "invite_url": "https://app.example.com/accept/TOKEN",
      "organization_name": "Acme Corp"
    }
  }
}'

# Password reset workflow
npm run dev -- '{
  "data": {
    "workflow": "password-reset",
    "to": "user@example.com",
    "payload": {
      "reset_url": "https://app.example.com/reset/TOKEN",
      "user_name": "Jane Smith"
    }
  }
}'
```

See [workflows/README.md](workflows/README.md) for complete workflow documentation and examples.

## 🚀 **Deployment Status**

**✅ M1 & M2 COMPLETED & PRODUCTION READY**: Successfully deployed to staging!

### **Current Status**
- **Staging Environment**: ✅ **ACTIVE** (`email-worker-staging`)
- **Workflows Available**: ✅ **3 workflows** (verification-code, invite, password-reset)
- **Template Engine**: ✅ **Handlebars** with filesystem loading and caching
- **All Tests**: ✅ **PASSING** (14/14 tests across all workflows)
- **SMTP Integration**: ✅ **CONFIGURED** with Gmail SMTP
- **Workload Identity Federation**: ✅ **FULLY CONFIGURED** and operational
- **CI/CD Pipeline**: ✅ **PASSING** (staging deployment successful)
- **Chat Notifications**: ✅ **CONFIGURED** with organizational standard format

### Automated Deployment
Deployments are fully automated through GitHub Actions:

```bash
# Staging deployment (automatic on main branch)
git push origin main

# Production deployment (ready for release)
git tag v1.0.0
git push origin v1.0.0
```

### **Ready for Production**
The email service is **fully functional** and ready for immediate production use:
- Email delivery via `email-delivery` Pub/Sub topic
- Verification code workflow with HTML/text templates
- GCS attachment support with size limits
- Comprehensive retry logic and error handling
- Integration with existing Gmail SMTP infrastructure

### What the Pipeline Does
- ✅ **Uses existing secrets**: `mail-pass-staging` and `mail-pass-prod`
- ✅ **Auto-configures Gmail SMTP**: No additional setup needed
- ✅ **Deploys to Cloud Functions**: Gen2 with Node.js 22
- ✅ **Runs comprehensive tests**: Validation + smoke tests
- ✅ **Sends notifications**: Chat webhooks for status updates

### Manual Deployment (if needed)
```bash
gcloud functions deploy email-worker-staging \
  --gen2 \
  --runtime=nodejs22 \
  --entry-point=handleEmailEvent \
  --trigger-topic=email-delivery \
  --region=us-central1 \
  --set-env-vars=SMTP_HOST=smtp.gmail.com,SMTP_PORT=587,SMTP_USERNAME=timur.tazhbayev@grizz.miami \
  --set-secrets=SMTP_PASSWORD=mail-pass-staging:latest
```

## Directory Structure

```
src/
  email-worker.js          # Pub/Sub handler
  config.js                # Config loading and validation
  logger.js                # Structured logger helper
  providers/
    smtp-provider.js       # Default SMTP provider implementation
  templates/
    index.js               # Template registry placeholder
function.json              # Deployment manifest for Cloud Functions
package.json
```

## Roadmap

- Delivery status persistence + callbacks
- Template rendering with MJML/Handlebars
- Provider fallbacks (SendGrid / SES)
- Dead-letter queue consumer for failed sends
- CLI tooling for ops runbooks
