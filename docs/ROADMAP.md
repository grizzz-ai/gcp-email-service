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

### M2 - Workflow Registry and Template System ✅ **COMPLETED**
- [x] **COMPLETED**: Handlebars template engine with filesystem loading and caching.
- [x] **COMPLETED**: Workflow registry with dynamic template resolution.
- [x] **COMPLETED**: Three production workflows: verification-code, invite, password-reset.
- [x] **COMPLETED**: JSON schemas for payload validation (all workflows).
- [x] **COMPLETED**: Comprehensive unit tests for all workflows (14 tests).
- [x] **COMPLETED**: Documentation with examples and workflow creation guide.

### M3 - Delivery Status Tracking and Persistence
- [ ] Persist delivery status in database (e.g. Cloud SQL / Firestore).
- [ ] Add status API for querying delivery state.
- [ ] Implement dead-letter queue and retry policies.
- [ ] Add delivery webhook callbacks for status updates.
- [ ] Expose delivery metrics (success rate, latency, retry count).

### M4 - Provider Fallback and Observability
- [ ] Add SendGrid provider implementation.
- [ ] Implement provider fallback logic (Gmail → SendGrid).
- [ ] Add provider-specific retry policies.
- [ ] Expose metrics (queue length, provider health, costs).
- [ ] Configure alerts for delivery failures and provider issues.

### M5 - Workflow Expansion (Future)
- [ ] MJML support for advanced email layouts.
- [ ] Template versioning and A/B testing.
- [ ] Support report/notification workflows.
- [ ] Add CLI/admin tooling for ops.
- [ ] Per-tenant template overrides.

### M6 - Messaging Extensions (Future)
- [ ] Evaluate SMS/WhatsApp workers using similar pattern.
- [ ] Add orchestration service for multi-channel notifications.

## Issues

1. **#1 Email Worker MVP** ✅ **COMPLETED** (Milestone M1)
   - [x] **COMPLETED**: Scaffold function deployment scripts with GitHub Actions.
   - [x] **COMPLETED**: Implement handler + SMTP provider + comprehensive tests.
   - [x] **COMPLETED**: Integration with existing Gmail infrastructure.

2. **#2 Workflow Registry and Template System** ✅ **COMPLETED** (Milestone M2)
   - [x] **COMPLETED**: Handlebars template engine with filesystem loading.
   - [x] **COMPLETED**: Three workflows: verification-code, invite, password-reset.
   - [x] **COMPLETED**: JSON schemas for all workflow payloads.
   - [x] **COMPLETED**: 14 unit tests covering all workflows.

3. **#3 Delivery Status Tracking** (Milestone M3)
   - Choose storage backend, implement persistence, add status API.
   - Implement dead-letter queue and retry policies.

4. **#4 Provider Fallback** (Milestone M4)
   - Add SendGrid provider implementation.
   - Implement fallback logic, metrics, and alerts.

5. **#5 Infrastructure Setup** ✅ **COMPLETED** (Milestone M1)
   - [x] **COMPLETED**: GitHub Actions deployment pipeline for staging/production.
   - [x] **COMPLETED**: Integration with existing Pub/Sub topics and GSM secrets.
   - [x] **COMPLETED**: Service account configuration and IAM bindings.

## 🎯 **M1 & M2 STATUS: COMPLETED & PRODUCTION READY**

**M1 Completion Date**: January 2025
**M2 Completion Date**: October 2025
**Status**: ✅ **Ready for immediate production deployment**

### **M1 Key Achievements**
- **Zero-setup deployment**: Integrated with existing gcp-vc-analyst email infrastructure
- **Enterprise-grade reliability**: Comprehensive retry logic, timeouts, and error handling
- **Production CI/CD**: GitHub Actions pipeline with staging/production gates
- **Comprehensive validation**: Post-deployment tests and runtime fail-safes
- **Existing infrastructure reuse**: Uses `mail-pass-{env}` GSM secrets and Gmail SMTP

### **M2 Key Achievements**
- **Handlebars template engine**: Filesystem-based loading with compiled template caching
- **Three production workflows**: verification-code, invite, password-reset
- **Extensible architecture**: Easy to add new workflows with schema + templates
- **14 comprehensive tests**: Full coverage for all workflow rendering paths
- **Complete documentation**: Examples, schemas, and workflow creation guide

### **Next Steps**
1. **Production deployment**: Tag and deploy all workflows to production
2. **Monitor usage**: Track email delivery metrics for all three workflows
3. **Begin M3 planning**: Delivery status tracking and persistence layer
4. **Begin M4 planning**: Provider fallback (SendGrid) and observability
