# GCP Email Service

Node.js 22 Cloud Function for handling asynchronous email delivery events. This service uses **existing email infrastructure** from gcp-vc-analyst and consumes Pub/Sub messages, renders templates, and delivers emails via Gmail SMTP.

## Features

- Pub/Sub triggered function (Gen 2) written in Node.js 22
- **Uses existing Gmail SMTP infrastructure** from gcp-vc-analyst
- Template rendering with verification code workflow
- Structured logging with correlation IDs
- GCS attachment support with size limits
- Comprehensive retry logic and timeout handling

## 🔧 **Configuration (Auto-configured)**

**IMPORTANT**: This service uses existing SMTP infrastructure. No additional setup required!

### Existing Infrastructure
- **GSM Secrets**: `mail-pass-staging` and `mail-pass-prod` ✅ **Already exist**
- **Gmail SMTP**: Pre-configured with `tzhb@grizzz.ai`
- **Deployment Ready**: All secrets and configuration in place

### Automatically Configured Variables

| Variable | Value | Source |
|----------|-------|--------|
| `SMTP_HOST` | `smtp.gmail.com` | Hardcoded (Gmail) |
| `SMTP_PORT` | `587` | Hardcoded (Gmail TLS) |
| `SMTP_USERNAME` | `tzhb@grizzz.ai` | Hardcoded |
| `SMTP_PASSWORD` | *secret* | GSM: `mail-pass-{env}` |
| `MAIL_FROM` | `tzhb@grizzz.ai` | Default |

### Optional Tuning Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_DEBUG_LOGS` | Enable verbose logging | `false` |
| `MAX_ATTACHMENT_SIZE_BYTES` | Per-attachment size limit | 25MB |
| `MAX_TOTAL_EMAIL_SIZE_BYTES` | Total email size limit | 50MB |
| `SMTP_SEND_TIMEOUT_MS` | SMTP send timeout | 10000ms |
| `SMTP_MAX_RETRIES` | SMTP retry attempts | 3 |
| `ATTACHMENT_MAX_RETRIES` | Attachment download retries | 3 |

## 🎯 **M1 MVP Achievements**

**All M1 requirements successfully implemented and validated:**

### **Core Features Delivered**
- ✅ Pub/Sub triggered Cloud Function (`email-delivery` topic)
- ✅ Verification code email workflow with HTML/text templates
- ✅ Gmail SMTP integration using existing infrastructure
- ✅ Structured logging with correlation IDs
- ✅ GCS attachment support with size limits and retry logic
- ✅ Comprehensive error handling and timeout management

### **DevOps & Infrastructure**
- ✅ GitHub Actions CI/CD pipeline (staging/production)
- ✅ Workload Identity Federation for secure deployments
- ✅ Integration with existing `mail-pass-{env}` GSM secrets
- ✅ Post-deployment validation and testing
- ✅ Complete documentation for other repositories

### **Production Readiness**
- ✅ Function deployed and active: `email-worker-staging`
- ✅ All validation tests passing
- ✅ Ready for immediate production deployment

## Local Development

```bash
npm install
npm run lint
npm run test
```

To emulate Pub/Sub events locally:

```bash
npm run dev -- '{
  "data": {
    "delivery_id": "test-123",
    "type": "verification_code",
    "recipient": "user@example.com",
    "template": "verification",
    "payload": { "code": "123456" },
    "attachments": [
      {
        "type": "gcs",
        "bucket": "my-bucket",
        "path": "reports/demo.pdf",
        "filename": "demo.pdf"
      }
    ]
  }
}'
```

## 🚀 **Deployment Status**

**✅ M1 MVP COMPLETED & PRODUCTION READY**: All infrastructure configured and validated!

### **Current Status**
- **Staging Environment**: ✅ **ACTIVE** (`email-worker-staging`)
- **Function State**: ✅ **DEPLOYED** and **VALIDATED**
- **All Tests**: ✅ **PASSING** (deployment, config, secrets)
- **SMTP Integration**: ✅ **CONFIGURED** with existing Gmail infrastructure
- **Workload Identity Federation**: ✅ **CONFIGURED** for automatic deployments

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
  --set-env-vars=SMTP_HOST=smtp.gmail.com,SMTP_PORT=587,SMTP_USERNAME=tzhb@grizzz.ai \
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
