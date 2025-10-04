"use strict";

const { createLogger } = require("./logger");
const { createStatusService } = require("./status-service");

function createStatusApi({ logger, statusService } = {}) {
  const apiLogger = logger || createLogger({ component: "status-api" });
  const service = statusService || createStatusService({ logger: apiLogger });

  const sendJson = (res, statusCode, payload) => {
    if (typeof res.set === "function") {
      res.set("Content-Type", "application/json");
    } else if (typeof res.setHeader === "function") {
      res.setHeader("Content-Type", "application/json");
    }

    if (typeof res.status === "function") {
      const responder = res.status(statusCode);
      if (responder && typeof responder.json === "function") {
        responder.json(payload);
        return;
      }
      if (responder && typeof responder.send === "function") {
        responder.send(JSON.stringify(payload));
        return;
      }
    }

    if (typeof res.json === "function") {
      res.json(payload);
      return;
    }

    if (typeof res.send === "function") {
      res.send(JSON.stringify(payload));
      return;
    }

    throw new Error("Response object does not support JSON output");
  };

  const normalizePath = (path = "") => {
    const trimmed = path.replace(/\/+$/, "");
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  };

  const handler = async (req, res) => {
    try {
      if (req.method !== "GET") {
        sendJson(res, 405, { error: "method_not_allowed" });
        return;
      }

      if (!service.isEnabled()) {
        sendJson(res, 503, { error: "status_tracking_disabled" });
        return;
      }

      const path = normalizePath(req.path || req.url || "/");
      const segments = path.split("/").filter(Boolean);

      if (segments.length === 0) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }

      if (segments[0] !== "deliveries") {
        sendJson(res, 404, { error: "not_found" });
        return;
      }

      if (segments.length === 1) {
        const limit = req.query?.limit ? parseInt(req.query.limit, 10) : undefined;
        if (req.query?.recipient) {
          const deliveries = await service.listRecipientDeliveries({
            recipient: req.query.recipient,
            limit
          });
          sendJson(res, 200, { data: deliveries });
          return;
        }

        const deliveries = await service.listRecentDeliveries({ limit });
        sendJson(res, 200, { data: deliveries });
        return;
      }

      if (segments.length === 2) {
        const deliveryId = decodeURIComponent(segments[1]);
        const record = await service.getDeliveryById(deliveryId);
        if (!record) {
          sendJson(res, 404, { error: "delivery_not_found" });
          return;
        }
        sendJson(res, 200, { data: record });
        return;
      }

      sendJson(res, 404, { error: "not_found" });
    } catch (error) {
      apiLogger.error({ error: error?.message }, "Status API request failed");
      sendJson(res, 500, { error: "internal_error" });
    }
  };

  return handler;
}

const statusApi = createStatusApi();

module.exports = {
  createStatusApi,
  statusApi
};

