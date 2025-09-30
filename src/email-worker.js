const functions = require('@google-cloud/functions-framework');
const { Storage } = require('@google-cloud/storage');
const nodemailer = require('nodemailer');
const config = require('./config');
const logger = require('./logger');
const workflows = require('./workflows');

const storage = new Storage();

// Register Cloud Function
functions.cloudEvent('handleEmailEvent', handleEmailEvent);

/**
 * Handle email delivery events from Pub/Sub
 * @param {object} cloudEvent - Cloud Event from Pub/Sub
 */
async function handleEmailEvent(cloudEvent) {
  const startTime = Date.now();
  let deliveryId = 'unknown';

  try {
    // Parse Pub/Sub message
    const eventData = cloudEvent.data;
    const messageData = JSON.parse(Buffer.from(eventData.message.data, 'base64').toString());

    deliveryId = messageData.delivery_id || `auto-${Date.now()}`;

    logger.info('Processing email event', {
      delivery_id: deliveryId,
      type: messageData.type,
      recipient: messageData.recipient,
      correlation_id: messageData.metadata?.correlation_id
    });

    // Validate event data
    await validateEventData(messageData);

    // Process email
    await processEmail(messageData);

    const processingTime = Date.now() - startTime;
    logger.info('Email processed successfully', {
      delivery_id: deliveryId,
      processing_time_ms: processingTime
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('Email processing failed', {
      delivery_id: deliveryId,
      error: error.message,
      stack: error.stack,
      processing_time_ms: processingTime
    });

    // Don't throw - let Pub/Sub handle retries
    // In production, would update delivery status table
  }
}

/**
 * Validate incoming event data
 * @param {object} eventData - Email event data
 */
async function validateEventData(eventData) {
  const required = ['delivery_id', 'type', 'recipient', 'template'];
  for (const field of required) {
    if (!eventData[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(eventData.recipient)) {
    throw new Error(`Invalid email format: ${eventData.recipient}`);
  }

  // Validate workflow exists
  if (!workflows[eventData.template]) {
    throw new Error(`Unknown email template: ${eventData.template}`);
  }
}

/**
 * Process email delivery
 * @param {object} eventData - Email event data
 */
async function processEmail(eventData) {
  const workflow = workflows[eventData.template];

  // Render email content
  const emailContent = await workflow.render(eventData.payload);

  // Process attachments if present
  const attachments = [];
  if (eventData.attachments && eventData.attachments.length > 0) {
    for (const attachment of eventData.attachments) {
      const attachmentData = await processAttachment(attachment);
      attachments.push(attachmentData);
    }
  }

  // Create transporter
  const transporter = nodemailer.createTransporter({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass
    }
  });

  // Send email
  const mailOptions = {
    from: config.smtp.from || config.smtp.user,
    to: eventData.recipient,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
    attachments: attachments
  };

  const result = await transporter.sendMail(mailOptions);

  logger.info('Email sent successfully', {
    delivery_id: eventData.delivery_id,
    message_id: result.messageId,
    recipient: eventData.recipient,
    attachment_count: attachments.length
  });
}

/**
 * Process GCS attachment
 * @param {object} attachment - Attachment configuration
 * @returns {object} Nodemailer attachment object
 */
async function processAttachment(attachment) {
  if (attachment.type !== 'gcs') {
    throw new Error(`Unsupported attachment type: ${attachment.type}`);
  }

  const { bucket, path, filename } = attachment;

  // Validate file size before download
  const file = storage.bucket(bucket).file(path);
  const [metadata] = await file.getMetadata();

  if (metadata.size > config.limits.maxAttachmentSize) {
    throw new Error(`Attachment too large: ${metadata.size} bytes (max: ${config.limits.maxAttachmentSize})`);
  }

  // Download file content
  const [content] = await file.download();

  return {
    filename: filename || path.split('/').pop(),
    content: content,
    contentType: metadata.contentType || 'application/octet-stream'
  };
}

module.exports = { handleEmailEvent };