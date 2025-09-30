"use strict";

const { z } = require("zod");

const AttachmentSchema = z.object({
  type: z.literal("gcs").default("gcs"),
  bucket: z.string().min(1, "bucket is required"),
  path: z.string().min(1, "path is required"),
  filename: z.string().optional(),
  content_type: z.string().optional()
});

const EmailEventSchema = z.object({
  delivery_id: z.string().min(1, "delivery_id is required"),
  type: z.string().optional(),
  recipient: z.string().email("recipient must be a valid email"),
  template: z.string().min(1, "template is required"),
  workflow: z.string().optional(),
  subject: z.string().optional(),
  headers: z.record(z.any()).optional(),
  payload: z.record(z.any()).default({}),
  attachments: z.array(AttachmentSchema).optional()
});

function parseEmailEvent(raw) {
  const result = EmailEventSchema.safeParse(raw);
  if (!result.success) {
    const message = result.error.errors.map((err) => `${err.path.join(".") || "payload"}: ${err.message}`).join(", ");
    const error = new Error(`Invalid email event payload: ${message}`);
    error.code = "INVALID_EMAIL_EVENT";
    throw error;
  }
  return result.data;
}

module.exports = {
  parseEmailEvent
};
