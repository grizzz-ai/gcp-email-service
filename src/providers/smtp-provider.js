"use strict";

const nodemailer = require("nodemailer");
const { TimeoutError } = require("../utils/timeout");

const RETRYABLE_SMTP_CODES = new Set([
  "ETIMEDOUT",
  "ESOCKET",
  "ECONNECTION",
  "ECONNRESET",
  "EPIPE",
  "EAI_AGAIN"
]);

function isRetryableSmtpError(error) {
  if (!error) return false;
  if (error instanceof TimeoutError) return true;
  if (error.code && RETRYABLE_SMTP_CODES.has(error.code)) return true;
  if (typeof error.responseCode === "number" && error.responseCode >= 500) return true;
  if (typeof error.status === "number" && error.status >= 500) return true;
  return false;
}

function createSmtpProvider({ config, logger, retryWithBackoff, withTimeout }) {
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUsername,
      pass: config.smtpPassword
    },
    connectionTimeout: config.smtpConnectionTimeoutMs,
    socketTimeout: config.smtpSocketTimeoutMs
  });

  const providerLogger = logger.child({ provider: "smtp" });

  return {
    async send({ deliveryId, recipient, subject, html, text, headers, attachments, correlationId }) {
      const metadata = { deliveryId, recipient, correlationId };

      const attemptSend = async (attempt) => {
        const start = Date.now();
        providerLogger.debug({ ...metadata, attempt }, "Sending email via SMTP");

        const mailOptions = {
          from: config.mailFrom,
          to: recipient,
          subject,
          html,
          text,
          headers,
          attachments
        };

        try {
          const response = await withTimeout(
            () => transporter.sendMail(mailOptions),
            config.smtpSendTimeoutMs,
            {
              message: "SMTP send timed out",
              metadata
            }
          );

          const latencyMs = Date.now() - start;
          providerLogger.info({ ...metadata, latencyMs, attempt }, "Email delivered successfully");
          return response;
        } catch (error) {
          providerLogger.warn({ ...metadata, attempt, error: error.message }, "SMTP send attempt failed");
          throw error;
        }
      };

      return retryWithBackoff(attemptSend, {
        maxRetries: config.smtpMaxRetries,
        baseDelayMs: config.smtpRetryBaseDelayMs,
        maxDelayMs: config.smtpRetryMaxDelayMs,
        shouldRetry: (error, attempt) => {
          const retryable = isRetryableSmtpError(error);
          if (!retryable) {
            providerLogger.error({ ...metadata, attempt, error: error.message }, "SMTP error is not retryable");
          }
          return retryable;
        },
        onRetry: (error, attempt, delay) => {
          providerLogger.warn({ ...metadata, attempt, delayMs: delay, error: error.message }, "Retrying email delivery");
        }
      });
    }
  };
}

module.exports = {
  createSmtpProvider
};
