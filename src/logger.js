"use strict";

const { randomUUID } = require("node:crypto");
const pino = require("pino");

let rootLogger;

function resolveLogLevel() {
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL;
  }
  return process.env.ENABLE_DEBUG_LOGS === "true" ? "debug" : "info";
}

function getRootLogger() {
  if (!rootLogger) {
    rootLogger = pino({
      level: resolveLogLevel(),
      base: {
        service: "gcp-email-service"
      },
      transport:
        process.env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: {
                colorize: true
              }
            }
          : undefined
    });
  }
  return rootLogger;
}

function createLogger(bindings = {}) {
  return getRootLogger().child(bindings);
}

function generateCorrelationId(prefix = "email") {
  const id = randomUUID();
  return `${prefix}-${id}`;
}

module.exports = {
  getRootLogger,
  createLogger,
  generateCorrelationId
};
