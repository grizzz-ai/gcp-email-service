"use strict";

const { Pool } = require("pg");
const { resolveStatusDatabaseUrl } = require("./status-tracker");

function createNoopService(logger) {
  const serviceLogger = logger.child({ component: "status-service" });
  serviceLogger.info("Email status service disabled (no database connection configured)");

  const noop = async () => null;

  return {
    isEnabled: () => false,
    getDeliveryById: noop,
    listRecentDeliveries: async () => [],
    listRecipientDeliveries: async () => []
  };
}

function normaliseRow(row) {
  if (!row) return null;
  const {
    delivery_id: deliveryId,
    workflow,
    recipient,
    status,
    attempts,
    last_error_code: lastErrorCode,
    last_error_message: lastErrorMessage,
    queued_at: queuedAt,
    last_attempted_at: lastAttemptedAt,
    sent_at: sentAt,
    created_at: createdAt,
    updated_at: updatedAt,
    metadata
  } = row;

  return {
    deliveryId,
    workflow,
    recipient,
    status,
    attempts,
    lastErrorCode,
    lastErrorMessage,
    queuedAt,
    lastAttemptedAt,
    sentAt,
    createdAt,
    updatedAt,
    metadata
  };
}

function createStatusService({ config = {}, logger }) {
  const connectionString = resolveStatusDatabaseUrl(config);

  if (!connectionString) {
    return createNoopService(logger);
  }

  const serviceLogger = logger.child({ component: "status-service" });
  const pool = new Pool({ connectionString, max: 2 });

  const execute = async (text, params) => {
    try {
      const result = await pool.query(text, params);
      return result.rows;
    } catch (error) {
      serviceLogger.error({ error: error?.message }, "Failed to query email status database");
      if (error.code === "42P01" || error.code === "42704" || error.code === "3F000") {
        serviceLogger.warn("Email status schema unavailable - returning empty result");
        return [];
      }
      throw error;
    }
  };

  const getDeliveryById = async (deliveryId) => {
    if (!deliveryId) return null;
    const rows = await execute(
      `SELECT delivery_id, workflow, recipient, status, attempts,
              last_error_code, last_error_message,
              queued_at, last_attempted_at, sent_at,
              created_at, updated_at, metadata
         FROM email.deliveries
        WHERE delivery_id = $1`,
      [deliveryId]
    );
    return normaliseRow(rows[0]);
  };

  const listRecentDeliveries = async ({ limit = 20 } = {}) => {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const rows = await execute(
      `SELECT delivery_id, workflow, recipient, status, attempts,
              last_error_code, last_error_message,
              queued_at, last_attempted_at, sent_at,
              created_at, updated_at, metadata
         FROM email.deliveries
     ORDER BY updated_at DESC
        LIMIT $1`,
      [safeLimit]
    );
    return rows.map(normaliseRow);
  };

  const listRecipientDeliveries = async ({ recipient, limit = 20 } = {}) => {
    if (!recipient) return [];
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const rows = await execute(
      `SELECT delivery_id, workflow, recipient, status, attempts,
              last_error_code, last_error_message,
              queued_at, last_attempted_at, sent_at,
              created_at, updated_at, metadata
         FROM email.deliveries
        WHERE recipient = $1
     ORDER BY updated_at DESC
        LIMIT $2`,
      [recipient, safeLimit]
    );
    return rows.map(normaliseRow);
  };

  serviceLogger.info("Email status service enabled");

  return {
    isEnabled: () => true,
    getDeliveryById,
    listRecentDeliveries,
    listRecipientDeliveries
  };
}

module.exports = {
  createStatusService
};

