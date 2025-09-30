const fs = require('fs');
const path = require('path');

/**
 * Verification Code Email Workflow
 * Handles OAuth account linking verification emails
 */

const templateDir = __dirname;

/**
 * Render verification code email
 * @param {object} payload - Email payload data
 * @returns {object} Rendered email content
 */
async function render(payload) {
  const { verification_code, provider, expires_at } = payload;

  if (!verification_code) {
    throw new Error('Verification code is required');
  }

  // Load templates
  const htmlTemplate = fs.readFileSync(path.join(templateDir, 'template.html'), 'utf8');
  const textTemplate = fs.readFileSync(path.join(templateDir, 'template.txt'), 'utf8');

  // Simple template substitution (in production, use a proper template engine)
  const substitutions = {
    '{{verification_code}}': verification_code,
    '{{provider}}': provider || 'account',
    '{{expires_at}}': expires_at ? new Date(expires_at).toLocaleString() : '15 minutes'
  };

  let html = htmlTemplate;
  let text = textTemplate;

  for (const [placeholder, value] of Object.entries(substitutions)) {
    html = html.replace(new RegExp(placeholder, 'g'), value);
    text = text.replace(new RegExp(placeholder, 'g'), value);
  }

  return {
    subject: `Your verification code: ${verification_code}`,
    html,
    text
  };
}

module.exports = {
  render
};