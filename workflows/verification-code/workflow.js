"use strict";

const path = require("node:path");
const { renderTemplate } = require("../../src/templates");
const { TimeoutError } = require("../../src/utils/timeout");

const TRANSIENT_GCS_CODES = new Set(["ETIMEDOUT", "ESOCKETTIMEDOUT", "ECONNRESET", "EAI_AGAIN"]);

function createVerificationWorkflow({ config, storage, logger, retryWithBackoff, withTimeout }) {
  if (!storage) {
    throw new Error("Storage client is required for verification workflow");
  }

  const workflowLogger = logger.child({ workflow: "verification-code" });

  const limits = {
    maxAttachmentSizeBytes: config.maxAttachmentSizeBytes,
    maxTotalEmailSizeBytes: config.maxTotalEmailSizeBytes
  };

  function buildAttachmentLogger(metadata = {}) {
    return workflowLogger.child({ ...metadata, component: "attachment" });
  }

  function shouldRetryAttachment(error) {
    if (!error) return false;
    if (error instanceof TimeoutError) return true;
    if (TRANSIENT_GCS_CODES.has(error.code)) return true;
    if (error.errors && Array.isArray(error.errors)) {
      return error.errors.some((err) => err.reason === "internalError" || err.reason === "backendError");
    }
    return false;
  }

  async function fetchGcsAttachment(attachment, correlationId) {
    const bucket = storage.bucket(attachment.bucket);
    const file = bucket.file(attachment.path);
    const attachmentLogger = buildAttachmentLogger({ correlationId, bucket: attachment.bucket, path: attachment.path });

    const { maxAttachmentSizeBytes } = limits;

    const operation = async () => {
      attachmentLogger.debug("Fetching attachment metadata");
      const [metadata] = await withTimeout(() => file.getMetadata(), config.attachmentDownloadTimeoutMs, {
        message: "Timeout while fetching attachment metadata",
        metadata: { attachment: attachment.path, bucket: attachment.bucket }
      });

      const size = Number(metadata.size || 0);
      if (maxAttachmentSizeBytes && size > maxAttachmentSizeBytes) {
        const error = new Error(`Attachment exceeds max size (${size} bytes > ${maxAttachmentSizeBytes})`);
        error.code = "ATTACHMENT_TOO_LARGE";
        throw error;
      }

      attachmentLogger.debug("Downloading attachment content");
      const [content] = await withTimeout(() => file.download(), config.attachmentDownloadTimeoutMs, {
        message: "Timeout while downloading attachment content",
        metadata: { attachment: attachment.path, bucket: attachment.bucket }
      });

      return {
        filename: attachment.filename || path.basename(attachment.path),
        content,
        contentType: attachment.content_type || metadata.contentType || "application/octet-stream",
        size
      };
    };

    return retryWithBackoff(operation, {
      maxRetries: config.attachmentMaxRetries,
      baseDelayMs: config.attachmentRetryBaseDelayMs,
      maxDelayMs: config.attachmentRetryMaxDelayMs,
      shouldRetry: shouldRetryAttachment,
      onRetry: (error, attempt, delay) => {
        attachmentLogger.warn("Retrying attachment fetch", {
          attempt,
          delayMs: delay,
          correlationId,
          error: error.message
        });
      }
    });
  }

  async function buildEmail({ template, payload, attachments, correlationId }) {
    const rendered = renderTemplate({ template, payload });

    let totalSize = Buffer.byteLength(rendered.html || "") + Buffer.byteLength(rendered.text || "");
    const processedAttachments = [];

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      for (const attachment of attachments) {
        if (attachment.type !== "gcs") {
          throw new Error(`Unsupported attachment type: ${attachment.type}`);
        }
        const fetched = await fetchGcsAttachment(attachment, correlationId);
        totalSize += fetched.size;
        if (limits.maxTotalEmailSizeBytes && totalSize > limits.maxTotalEmailSizeBytes) {
          throw new Error("Email total size exceeds limit");
        }
        processedAttachments.push({
          filename: fetched.filename,
          content: fetched.content,
          contentType: fetched.contentType
        });
      }
    }

    return {
      subject: payload.subject || rendered.subject || "Your verification code",
      html: rendered.html,
      text: rendered.text,
      attachments: processedAttachments
    };
  }

  return {
    async prepareEmail(eventPayload) {
      const correlationId = eventPayload.correlationId;
      return buildEmail({
        template: eventPayload.template,
        payload: eventPayload.payload || {},
        attachments: eventPayload.attachments || [],
        correlationId
      });
    }
  };
}

module.exports = {
  createVerificationWorkflow
};
