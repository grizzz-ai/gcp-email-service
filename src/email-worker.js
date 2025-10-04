"use strict";

const { Buffer } = require("node:buffer");
const { getEmailServiceContext } = require("./clients");
const { generateCorrelationId } = require("./logger");
const { parseEmailEvent } = require("./schemas/email-event");

function decodeMessage(message) {
  if (!message || !message.data) {
    const error = new Error("Missing Pub/Sub message data");
    error.code = "MISSING_DATA";
    throw error;
  }

  try {
    const decoded = Buffer.from(message.data, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch (error) {
    const parseError = new Error("Unable to decode Pub/Sub message payload");
    parseError.code = "INVALID_MESSAGE_FORMAT";
    parseError.cause = error;
    throw parseError;
  }
}

exports.handleEmailEvent = async (message, context) => {
  const serviceContext = getEmailServiceContext();
  const { logger, provider, workflows, statusTracker } = serviceContext;

  const eventId = context?.eventId || `email-${Date.now()}`;
  const correlationId = generateCorrelationId();
  const eventLog = logger.child({ eventId, correlationId });

  let payload;
  let workflowKey;

  try {
    const decoded = decodeMessage(message);
    payload = parseEmailEvent(decoded);

    eventLog.debug({ payload }, "Received email event");

    workflowKey = payload.workflow || payload.template;
    const workflow = workflows.get(workflowKey);
    if (!workflow) {
      const error = new Error(`Unsupported workflow/template: ${workflowKey}`);
      error.code = "UNKNOWN_WORKFLOW";
      throw error;
    }
    await statusTracker.recordQueued?.({
      deliveryId: payload.delivery_id,
      workflow: workflowKey,
      recipient: payload.recipient,
      metadata: {
        template: payload.template,
        workflow: workflowKey,
        has_attachments: Array.isArray(payload.attachments) && payload.attachments.length > 0,
        payload_keys: Object.keys(payload.payload || {})
      }
    });

    const prepared = await workflow.prepareEmail({
      template: payload.template,
      payload: payload.payload,
      attachments: payload.attachments,
      correlationId
    });

    await provider.send({
      deliveryId: payload.delivery_id,
      recipient: payload.recipient,
      subject: payload.subject || prepared.subject,
      html: prepared.html,
      text: prepared.text,
      headers: payload.headers,
      attachments: prepared.attachments,
      correlationId
    });

    eventLog.info(
      {
        deliveryId: payload.delivery_id,
        recipient: payload.recipient,
        workflow: workflowKey
      },
      "Email processed successfully"
    );
  } catch (error) {
      eventLog.error(
        {
          error: error.message,
          code: error.code,
          eventId,
          correlationId,
          stack: error.stack
        },
        "Email event processing failed"
      );
      await statusTracker.markFailed?.({
        deliveryId: payload?.delivery_id,
        error
      });
    throw error;
  }
};
