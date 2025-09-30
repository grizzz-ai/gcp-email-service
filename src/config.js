const Joi = require('joi');

// Configuration schema
const configSchema = Joi.object({
  smtp: Joi.object({
    host: Joi.string().required(),
    port: Joi.number().integer().min(1).max(65535).required(),
    user: Joi.string().required(),
    pass: Joi.string().required(),
    from: Joi.string().email().optional()
  }).required(),

  limits: Joi.object({
    maxAttachmentSize: Joi.number().integer().min(0).default(25 * 1024 * 1024), // 25MB
    maxTotalEmailSize: Joi.number().integer().min(0).default(50 * 1024 * 1024)  // 50MB
  }).default(),

  logging: Joi.object({
    level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info')
  }).default()
});

// Load and validate configuration
function loadConfig() {
  const config = {
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM
    },
    limits: {
      maxAttachmentSize: parseInt(process.env.MAX_ATTACHMENT_SIZE_BYTES, 10) || 25 * 1024 * 1024,
      maxTotalEmailSize: parseInt(process.env.MAX_TOTAL_EMAIL_SIZE_BYTES, 10) || 50 * 1024 * 1024
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info'
    }
  };

  const { error, value } = configSchema.validate(config);

  if (error) {
    throw new Error(`Configuration validation failed: ${error.message}`);
  }

  return value;
}

module.exports = loadConfig();