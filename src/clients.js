"use strict";

const { Storage } = require("@google-cloud/storage");
const { loadConfig } = require("./config");
const { createLogger } = require("./logger");
const { createSmtpProvider } = require("./providers/smtp-provider");
const { createWorkflowRegistry } = require("./workflows");
const { retryWithBackoff } = require("./utils/retry");
const { withTimeout } = require("./utils/timeout");

let cachedContext;

function initialiseEmailService() {
  if (cachedContext) {
    return cachedContext;
  }

  const config = loadConfig();
  const logger = createLogger({ component: "email-service" });
  const storage = new Storage();

  const dependencies = {
    config,
    logger,
    storage,
    retryWithBackoff,
    withTimeout
  };

  const provider = createSmtpProvider(dependencies);
  const workflows = createWorkflowRegistry(dependencies);

  logger.info(
    {
      mailFrom: config.mailFrom,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort
    },
    "Email service initialised"
  );

  cachedContext = {
    config,
    logger,
    storage,
    provider,
    workflows,
    retryWithBackoff,
    withTimeout
  };

  return cachedContext;
}

function getEmailServiceContext() {
  return cachedContext || initialiseEmailService();
}

module.exports = {
  initialiseEmailService,
  getEmailServiceContext
};
