"use strict";

const { Pool } = require("pg");

function createNoopTracker(logger) {
  const trackerLogger = logger.child({ component: "status-tracker" });
  trackerLogger.info("Email status tracking disabled (no database connection configured)");

  const noop = async () => {};

  return {
    isEnabled: () => false,
    recordQueued: noop,
    markInProgress: noop,
    markRetrying: noop,
    markSent: noop,
    markFailed: noop,
    markDeadLetter: noop
  };
}

function truncateMessage(message) {
  if (!message) return null;
  const normalised = String(message);
  return normalised.length > 512 ? `${normalised.slice(0, 509)}...` : normalised;
}

function extractErrorDetails(error) {
  if (!error) {
    return { code: null, message: null };
  }
  const code = error.code || error.responseCode || error.status || null;
  return {
    code: code ? String(code) : null,
    message: truncateMessage(error.message || error.response || error.toString())
  };
}

function createStatusTracker({ config, logger }) {
  const connectionString = config.statusDatabaseUrl || process.env.DELIVERY_STATUS_DATABASE_URL;

  if (!connectionString) {
    return createNoopTracker(logger);
  }

  const trackerLogger = logger.child({ component: "status-tracker" });
  const pool = new Pool({ connectionString, max: 2 });

  let disabled = false;
  let schemaMissingNotified = false;

  const disableTracking = (reason) => {
    if (disabled) return;
    disabled = true;
    trackerLogger.warn({ reason }, "Disabling email status tracking due to repeated failures");
  };

  const handleQueryError = (error, context) => {
    if (error && (error.code === "42P01" || error.code === "42704" || error.code === "3F000")) {
      if (!schemaMissingNotified) {
        trackerLogger.warn({ error: error.message }, "Email status schema unavailable (likely migration pending)");
        schemaMissingNotified = true;
      }
      disableTracking("schema_unavailable");
      return;
    }

    trackerLogger.error({ error: error?.message, context }, "Failed to persist email delivery status");
  };

  const execute = async (text, params, context) => {
    if (disabled) return;
    try {
      await pool.query(text, params);
    } catch (error) {
      handleQueryError(error, context);
    }
  };

  const recordQueued = async ({ deliveryId, workflow, recipient, metadata }) => {
    await execute(
      `INSERT INTO email.deliveries (delivery_id, workflow, recipient, status, attempts, queued_at, metadata)
       VALUES ($1, $2, $3, 'queued', 0, now(), $4)
       ON CONFLICT (delivery_id) DO NOTHING`,
      [deliveryId, workflow, recipient, metadata ? JSON.stringify(metadata) : null],
      { action: "recordQueued", deliveryId }
    );
  };

  const markInProgress = async ({ deliveryId, attempt }) => {
    await execute(
      `UPDATE email.deliveries
         SET status = 'in_progress',
             attempts = GREATEST(COALESCE(attempts, 0), $2),
             last_attempted_at = now(),
             last_error_code = NULL,
             last_error_message = NULL
       WHERE delivery_id = $1`,
      [deliveryId, attempt || 1],
      { action: "markInProgress", deliveryId, attempt }
    );
  };

  const markRetrying = async ({ deliveryId, attempt, error }) => {
    const details = extractErrorDetails(error);
    await execute(
      `UPDATE email.deliveries
         SET status = 'retrying',
             attempts = GREATEST(COALESCE(attempts, 0), $2),
             last_attempted_at = now(),
             last_error_code = $3,
             last_error_message = $4
       WHERE delivery_id = $1`,
      [deliveryId, attempt || 1, details.code, details.message],
      { action: "markRetrying", deliveryId, attempt }
    );
  };

  const markSent = async ({ deliveryId, attempt }) => {
    await execute(
      `UPDATE email.deliveries
         SET status = 'sent',
             attempts = GREATEST(COALESCE(attempts, 0), $2),
             sent_at = COALESCE(sent_at, now()),
             last_attempted_at = now(),
             last_error_code = NULL,
             last_error_message = NULL
       WHERE delivery_id = $1`,
      [deliveryId, attempt || 1],
      { action: "markSent", deliveryId, attempt }
    );
  };

  const markFailed = async ({ deliveryId, attempt, error }) => {
    const details = extractErrorDetails(error);
    await execute(
      `UPDATE email.deliveries
         SET status = 'failed',
             attempts = GREATEST(COALESCE(attempts, 0), $2),
             last_attempted_at = now(),
             last_error_code = $3,
             last_error_message = $4
       WHERE delivery_id = $1`,
      [deliveryId, attempt || 1, details.code, details.message],
      { action: "markFailed", deliveryId, attempt }
    );
  };

  const markDeadLetter = async ({ deliveryId, attempt, error, metadata }) => {
    const details = extractErrorDetails(error);
    await execute(
      `UPDATE email.deliveries
         SET status = 'dead_letter',
             attempts = GREATEST(COALESCE(attempts, 0), $2),
             last_attempted_at = now(),
             last_error_code = $3,
             last_error_message = $4,
             metadata = COALESCE($5, metadata)
       WHERE delivery_id = $1`,
      [deliveryId, attempt || 1, details.code, details.message, metadata ? JSON.stringify(metadata) : null],
      { action: "markDeadLetter", deliveryId, attempt }
    );
  };

  trackerLogger.info("Email status tracking enabled");

  return {
    isEnabled: () => !disabled,
    recordQueued,
    markInProgress,
    markRetrying,
    markSent,
    markFailed,
    markDeadLetter
  };
}

module.exports = {
  createStatusTracker
};

