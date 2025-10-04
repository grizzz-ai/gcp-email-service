# Issue Proposal: Email Delivery Status Tracking Schema

**Repository:** supabase-vc-analyst
**Component:** Business database (PostgreSQL)
**Related Service:** gcp-email-service (Cloud Function email worker)

---

## 1. Background & Motivation

The new email worker (gcp-email-service) now sends production-ready emails for the following workflows:
- Verification code delivery
- Team/organization invites
- Password reset links

The service already provides structured logging, retry logic, and dead-letter handling. However, there is **no persistent storage** for delivery state. We cannot currently:
- Query delivery status by `delivery_id`
- Audit delivery attempts or errors
- Expose analytics across workflows (success rate, retry count, latency)
- Power future features from the roadmap (delivery tracking dashboards, webhooks, API endpoints)

To unlock Milestone M3 (Delivery Status Tracking) we need a dedicated schema inside the business database that the email worker can write to. supabase-vc-analyst is the canonical location for business data and already contains the “primary” Supabase project. All downstream services will read/write via that database.

---

## 2. Goals

1. Provide a durable **source of truth** for email delivery attempts and states.
2. Enable deterministic reconciliation between Pub/Sub events and downstream systems.
3. Allow internal tools (CLI, dashboards, support ops) to query delivery history.
4. Provide the base needed for M3/M4 roadmap items (status API, dead-letter handling, provider fallback metrics).

---

## 3. High-Level Requirements

- Schema lives under a new dedicated namespace: `email` (e.g. `email.deliveries`).
- Records lifecycle events for each `delivery_id` coming from gcp-email-service.
- Supports multiple workflows (`verification-code`, `invite`, `password-reset`; future-safe for more).
- Stores status transitions, attempt counters, error payloads, timestamps.
- Offers optional audit trail (`email.delivery_events`) if we need a detailed log per transition.
- Stays compatible with pgvector/other extensions already active in the business database.
- Enforces permissions (RLS) consistent with our internal tooling (read-only for dashboards, write for the worker).

---

## 4. Proposed Schema Changes

### 4.1 `email.deliveries`
Main table that tracks the latest status per delivery.

| Column | Type | Description |
|--------|------|-------------|
| `delivery_id` | `text` (PK) | Unique identifier from the Pub/Sub event (provided by upstream service). |
| `workflow` | `text` | Workflow key (`verification-code`, `invite`, `password-reset`, future values). |
| `recipient` | `text` | Email address target. |
| `status` | `text` | Current status enum. Proposed values: `queued`, `in_progress`, `sent`, `retrying`, `failed`, `dead_letter`. |
| `attempts` | `integer` | Total send attempts performed by worker. |
| `last_error_code` | `text` | Optional short code derived from provider error (`SMTP_535`, etc.). |
| `last_error_message` | `text` | Sanitised message for debugging. |
| `last_attempted_at` | `timestamptz` | Timestamp of the latest attempt (success or failure). |
| `queued_at` | `timestamptz` | Timestamp when delivery was first enqueued. |
| `sent_at` | `timestamptz` | Timestamp when email successfully delivered (null otherwise). |
| `metadata` | `jsonb` | Arbitrary workflow metadata (e.g. hashed invite token, link expiry). |
| `created_at` | `timestamptz` | Default `now()`. |
| `updated_at` | `timestamptz` | Auto-updated trigger on each change. |

**Indexes & Constraints**
- Primary key: `(delivery_id)`
- Index on `(status, updated_at)` for querying pending deliveries
- Index on `(recipient, updated_at)` for support tooling
- CHECK constraint restricting `status` to allowed values

### 4.2 `email.delivery_events` (optional but recommended)
Audit log capturing every status transition.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `bigserial` (PK) | Event ID |
| `delivery_id` | `text` | FK → `email.deliveries.delivery_id` |
| `status` | `text` | Status after this event |
| `attempt` | `integer` | Attempt number associated with the event |
| `error_code` | `text` | Optional error code |
| `error_message` | `text` | Optional error detail |
| `payload` | `jsonb` | Snapshot of relevant data (e.g., SMTP response, workflow payload summary) |
| `created_at` | `timestamptz` | Event timestamp |

Use a simple FK (`ON DELETE CASCADE`) so when a delivery is purged, its events are removed.

### 4.3 Supporting Objects
- Enum type `email.delivery_status` for allowed status values.
- Trigger function to keep `updated_at` in sync in `email.deliveries`.
- Trigger on `email.deliveries` that optionally writes to `email.delivery_events` when status changes.

---

## 5. Data Flow Integration Expectations

1. **Queueing**: When gcp-email-service receives a Pub/Sub event, it will upsert into `email.deliveries` with status `queued` (or `in_progress`) before sending.
2. **Send Attempt**: Each attempt increments `attempts`, updates `last_attempted_at`, optionally records `last_error_*` on failure.
3. **Success**: On successful SMTP send, set `status = 'sent'`, populate `sent_at`, clear error fields.
4. **Retries**: While attempts remain, use `status = 'retrying'`. Once retries exhausted, set `status = 'dead_letter'`.
5. **Dead-Letter**: Publish payload to separate Pub/Sub topic (`email-delivery-dead-letter` planned in M3), store reference in `metadata` or `delivery_events`.

The worker will use application-level logic; the database schema just needs to support the operations listed above.

---

## 6. Security & Access Control

- Email worker (Cloud Function) will authenticate via existing service account using Postgres credentials managed in Secret Manager.
- Proposed RLS policy pattern:
  - Service role used by the worker → INSERT/UPDATE on `email.deliveries`, INSERT on `email.delivery_events`.
  - Analytics/read roles → SELECT on both tables.
  - Future dashboards (Supabase) → SELECT filtered by tenant if multi-tenant context is introduced.

---

## 7. Deliverables (for supabase-vc-analyst team)

1. SQL migration creating schema `email`, types, tables, triggers, indexes, and optional RLS policies.
2. Documentation (README or schema notes) describing table purpose and sample queries.
3. Example SQL snippets (insert/update) to help the email worker integration (optional but helpful).
4. Confirmation that migrations run on staging + production branches.

---

## 8. Timeline & Dependencies

- gcp-email-service implementation of M3 will begin immediately once schema exists.
- No other services currently depend on this data, but future analytics dashboards will.
- Please coordinate with infrastructure to ensure secrets/DB credentials are available (already in place for Supabase business DB).

---

## 9. Questions / Open Items

- Should we store full email payloads or only metadata references (size considerations)? Recommendation: store minimal metadata; let Cloud Storage or Pub/Sub hold large payloads.
- Do we need multi-tenant isolation today? Not yet, but schema leaves room for a `tenant_id` column if needed later.
- Retention policy: we can add a scheduled job later to archive/prune entries older than N days.

---

### Contacts
- **Email Service Owner**: gcp-email-service team (current repo)
- **Database Maintainers**: supabase-vc-analyst maintainers

Please create the migration in `supabase-vc-analyst` and let the email-service team know once the schema is available so we can integrate M3.

