"use strict";

function renderTemplate({ template, payload }) {
  switch (template) {
    case "verification":
    case "verification_code": {
      const code = payload?.code || "";
      const expiresAt = payload?.expires_at || payload?.expiresAt;
      const subject = payload?.subject || "Your verification code";
      const html = payload?.rendered_html || `<p>Your verification code is <strong>${code}</strong>.</p>${
        expiresAt ? `<p>This code expires at ${expiresAt}.</p>` : ""
      }<p>If you did not request this code, please contact support immediately.</p>`;
      const text = payload?.rendered_text || `Your verification code is ${code}${
        expiresAt ? ` (expires at ${expiresAt})` : ""
      }. If you did not request this code, please contact support immediately.`;
      return { subject, html, text };
    }
    default:
      throw new Error(`Unknown email template: ${template}`);
  }
}

module.exports = {
  renderTemplate
};
