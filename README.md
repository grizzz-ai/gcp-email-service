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

## 🚀 **Deployment (Zero Setup Required)**

**✅ PRODUCTION READY**: M1 MVP completed! All infrastructure already exists!

### Automated Deployment
Deployments are fully automated through GitHub Actions:

```bash
# Staging deployment (automatic on main branch)
git push origin main

# Production deployment (tag-triggered)
git tag v0.1.0
git push origin v0.1.0
```

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
