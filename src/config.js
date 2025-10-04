"use strict";

const { z } = require("zod");

const toNumber = (value) => (value === undefined || value === null || value === "" ? undefined : Number(value));

const ConfigSchema = z.object({
  mailFrom: z.string().trim().min(1).default("zzz@grizzz.ai"),
  smtpHost: z.string().trim().optional(),
  smtpPort: z.preprocess(toNumber, z.number().int().positive().optional()),
  smtpUsername: z.string().trim().optional(),
  smtpPassword: z.string().trim().optional(),
  enableDebugLogs: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((val) => val === "true" || val === "1" || val === true)
    .default(false)
    .pipe(z.boolean()),
  maxAttachmentSizeBytes: z.preprocess(toNumber, z.number().int().positive().optional()),
  maxTotalEmailSizeBytes: z.preprocess(toNumber, z.number().int().positive().optional()),
  smtpSendTimeoutMs: z.preprocess(toNumber, z.number().int().positive().optional()),
  smtpConnectionTimeoutMs: z.preprocess(toNumber, z.number().int().positive().optional()),
  smtpSocketTimeoutMs: z.preprocess(toNumber, z.number().int().positive().optional()),
  smtpMaxRetries: z.preprocess(toNumber, z.number().int().positive().optional()),
  smtpRetryBaseDelayMs: z.preprocess(toNumber, z.number().int().positive().optional()),
  smtpRetryMaxDelayMs: z.preprocess(toNumber, z.number().int().positive().optional()),
  attachmentDownloadTimeoutMs: z.preprocess(toNumber, z.number().int().positive().optional()),
  attachmentMaxRetries: z.preprocess(toNumber, z.number().int().positive().optional()),
  attachmentRetryBaseDelayMs: z.preprocess(toNumber, z.number().int().positive().optional()),
  attachmentRetryMaxDelayMs: z.preprocess(toNumber, z.number().int().positive().optional())
});

function loadConfig(env = process.env) {
  const result = ConfigSchema.safeParse({
    mailFrom: env.MAIL_FROM,
    smtpHost: env.SMTP_HOST,
    smtpPort: env.SMTP_PORT,
    smtpUsername: env.SMTP_USERNAME,
    smtpPassword: env.SMTP_PASSWORD,
    enableDebugLogs: env.ENABLE_DEBUG_LOGS,
    maxAttachmentSizeBytes: env.MAX_ATTACHMENT_SIZE_BYTES,
    maxTotalEmailSizeBytes: env.MAX_TOTAL_EMAIL_SIZE_BYTES,
    smtpSendTimeoutMs: env.SMTP_SEND_TIMEOUT_MS,
    smtpConnectionTimeoutMs: env.SMTP_CONNECTION_TIMEOUT_MS,
    smtpSocketTimeoutMs: env.SMTP_SOCKET_TIMEOUT_MS,
    smtpMaxRetries: env.SMTP_MAX_RETRIES,
    smtpRetryBaseDelayMs: env.SMTP_RETRY_BASE_DELAY_MS,
    smtpRetryMaxDelayMs: env.SMTP_RETRY_MAX_DELAY_MS,
    attachmentDownloadTimeoutMs: env.ATTACHMENT_DOWNLOAD_TIMEOUT_MS,
    attachmentMaxRetries: env.ATTACHMENT_MAX_RETRIES,
    attachmentRetryBaseDelayMs: env.ATTACHMENT_RETRY_BASE_DELAY_MS,
    attachmentRetryMaxDelayMs: env.ATTACHMENT_RETRY_MAX_DELAY_MS
  });

  if (!result.success) {
    const message = result.error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
    throw new Error(`Invalid email service configuration: ${message}`);
  }

  const config = result.data;

  if (!config.smtpHost || !config.smtpPort || !config.smtpUsername || !config.smtpPassword) {
    throw new Error("SMTP configuration incomplete. Set SMTP_HOST, SMTP_PORT, SMTP_USERNAME and SMTP_PASSWORD");
  }

  config.maxAttachmentSizeBytes ||= 25 * 1024 * 1024;
  config.maxTotalEmailSizeBytes ||= 50 * 1024 * 1024;
  config.smtpSendTimeoutMs ||= 10_000;
  config.smtpConnectionTimeoutMs ||= 5_000;
  config.smtpSocketTimeoutMs ||= 8_000;
  config.smtpMaxRetries ||= 3;
  config.smtpRetryBaseDelayMs ||= 250;
  config.smtpRetryMaxDelayMs ||= 2_000;
  config.attachmentDownloadTimeoutMs ||= 5_000;
  config.attachmentMaxRetries ||= 3;
  config.attachmentRetryBaseDelayMs ||= 200;
  config.attachmentRetryMaxDelayMs ||= 1_500;

  return config;
}

module.exports = {
  loadConfig
};
