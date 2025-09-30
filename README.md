# 📧 GCP Email Service

Enterprise email service with Pub/Sub integration, template system, and GCS attachment support for the GRIZZ AI platform.

## Features

- 🚀 **Pub/Sub Integration** - Event-driven email processing
- 📋 **Template System** - Workflow-based email templates
- 📎 **GCS Attachments** - Secure file attachment support
- 🔄 **Provider Abstraction** - SMTP/SendGrid/SES support
- 📊 **Structured Logging** - Comprehensive operational visibility
- ⚡ **Cloud Functions Gen2** - Scalable serverless architecture

## Architecture

```
gcp-auth-gateway → email-delivery (Pub/Sub) → gcp-email-service
gcp-billing     → email-delivery (Pub/Sub) → gcp-email-service
gcp-reports     → email-delivery (Pub/Sub) → gcp-email-service
```

## Event Schema

```json
{
  "delivery_id": "uuid",
  "type": "verification_code",
  "recipient": "user@example.com",
  "template": "verification-code",
  "payload": {
    "verification_code": "123456",
    "expires_at": "2025-09-30T12:00:00Z"
  },
  "attachments": [
    {
      "type": "gcs",
      "bucket": "reports-bucket",
      "path": "reports/2024/q3-analysis.pdf",
      "filename": "Q3_Report.pdf"
    }
  ],
  "metadata": {
    "correlation_id": "auth-123",
    "priority": "high"
  }
}
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SMTP_HOST` | SMTP server hostname | Yes |
| `SMTP_PORT` | SMTP server port | Yes |
| `SMTP_USER` | SMTP username | Yes |
| `SMTP_PASS` | SMTP password | Yes |
| `MAX_ATTACHMENT_SIZE_BYTES` | Max single attachment size | No (25MB) |
| `MAX_TOTAL_EMAIL_SIZE_BYTES` | Max total email size | No (50MB) |
| `LOG_LEVEL` | Logging level | No (info) |

## Local Development

```bash
# Install dependencies
npm install

# Set environment variables
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your-email@gmail.com
export SMTP_PASS=your-password

# Test email event
npm run dev
```

## Deployment

```bash
# Deploy to Cloud Functions
npm run deploy

# Or with specific configuration
gcloud functions deploy email-worker \
  --gen2 \
  --runtime=nodejs22 \
  --source=. \
  --entry-point=handleEmailEvent \
  --trigger-topic=email-delivery
```

## Roadmap

### M1: MVP Implementation
- [ ] Basic email worker with SMTP support
- [ ] Verification code workflow
- [ ] Pub/Sub topic setup and IAM

### M2: Template System
- [ ] Workflow registry and validation
- [ ] Multi-format templates (HTML/text)
- [ ] Template testing framework

### M3: Delivery Tracking
- [ ] Delivery status persistence
- [ ] Webhook callbacks for status updates
- [ ] Analytics dashboard

### M4: Provider Fallback
- [ ] SendGrid/SES provider support
- [ ] Automatic provider failover
- [ ] Retry policies and dead letter queues

### M5: Advanced Features
- [ ] Email scheduling and batching
- [ ] A/B testing for templates
- [ ] Monitoring and alerting

## Contributing

1. Create feature branch
2. Implement changes with tests
3. Update documentation
4. Submit pull request

## License

MIT License - see LICENSE file for details.