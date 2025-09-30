# gcp-email-service Roadmap

## Goals

1. Provide reliable email delivery for authentication workflows (verification codes, invites).
2. Support future workflows such as reports, notifications, and transactional messages.
3. Offer extensible provider abstraction with fallback and monitoring.

## Milestones

### M1 - MVP (Verification emails) ✅ **COMPLETED**
- [x] **COMPLETED**: Implement Pub/Sub triggered worker (`email-delivery` topic).
- [x] **COMPLETED**: Support verification code workflow (HTML + text templates).
- [x] **COMPLETED**: Use SMTP provider (reuses existing gcp-vc-analyst Gmail infrastructure).
- [x] **COMPLETED**: Structured logging with correlation IDs.
- [x] **COMPLETED**: Comprehensive retry/backoff and error handling with timeouts.
- [x] **COMPLETED**: Documentation for publishing events and local testing.
- [x] **COMPLETED**: Support GCS attachments with size limits and retry logic.
- [x] **COMPLETED**: GitHub Actions CI/CD pipeline with staging/production deployment.
- [x] **COMPLETED**: Integration with existing `mail-pass-{env}` GSM secrets.
- [x] **COMPLETED**: Comprehensive test suite and validation scripts.

### M2 - Delivery Tracking
- [ ] Persist delivery status in database (e.g. Cloud SQL / Firestore).
- [ ] Add status API for querying delivery state.
- [ ] Implement dead-letter / retry policies.
- [ ] Add SendGrid provider implementation and fallback logic.
- [ ] Expose metrics (queue length, success rate, retry count).

### M3 - Workflow Expansion
- [ ] Template management system (MJML/Handlebars).
- [ ] Support report/notification workflows.
- [ ] Add CLI/admin tooling for ops.
- [ ] Webhook integration for provider delivery receipts.

### M4 - Messaging Extensions (Future)
- [ ] Evaluate SMS/WhatsApp workers using similar pattern.
- [ ] Add orchestration service for multi-channel notifications.

## Issues

1. **#1 Email Worker MVP** ✅ **COMPLETED** (Milestone M1)
   - [x] **COMPLETED**: Scaffold function deployment scripts with GitHub Actions.
   - [x] **COMPLETED**: Implement handler + SMTP provider + comprehensive tests.
   - [x] **COMPLETED**: Integration with existing Gmail infrastructure.

2. **#2 Workflow/TEMPLATE structure** ✅ **COMPLETED** (Milestone M1)
   - [x] **COMPLETED**: Build workflow registry with verification-code workflow.
   - [x] **COMPLETED**: Schema validation with Zod for email events.
   - [x] **COMPLETED**: Template rendering for HTML/text with payload substitution.

3. **#3 Infrastructure & Deployment** ✅ **COMPLETED** (Milestone M1)
   - [x] **COMPLETED**: GitHub Actions deployment pipeline for staging/production.
   - [x] **COMPLETED**: Integration with existing Pub/Sub topics and GSM secrets.
   - [x] **COMPLETED**: Service account configuration and IAM bindings.

4. **#4 Delivery tracking persistence** (Milestone M2)
   - Choose storage backend, implement persistence, add API.

5. **#5 Provider Fallback & Observability** (Milestone M2)
   - Add secondary provider, fallback logic, metrics, alerts.

## 🎯 **M1 MVP STATUS: COMPLETED & PRODUCTION READY**

**Completion Date**: January 2025
**Status**: ✅ **Ready for immediate production deployment**

### **Key Achievements**
- **Zero-setup deployment**: Integrated with existing gcp-vc-analyst email infrastructure
- **Enterprise-grade reliability**: Comprehensive retry logic, timeouts, and error handling
- **Production CI/CD**: GitHub Actions pipeline with staging/production gates
- **Comprehensive validation**: Post-deployment tests and runtime fail-safes
- **Existing infrastructure reuse**: Uses `mail-pass-{env}` GSM secrets and Gmail SMTP

### **Next Steps**
1. **Deploy to staging**: `git push origin main`
2. **Validate staging**: Verify email delivery and monitoring
3. **Deploy to production**: `git tag v1.0.0 && git push origin v1.0.0`
4. **Begin M2 planning**: Delivery tracking and provider fallbacks
