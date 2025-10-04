"use strict";

const fs = require("node:fs");
const path = require("node:path");
const Handlebars = require("handlebars");

const WORKFLOWS_DIR = path.join(__dirname, "../../workflows");

const templateCache = new Map();

function loadTemplate(workflowName) {
  if (templateCache.has(workflowName)) {
    return templateCache.get(workflowName);
  }

  const workflowDir = path.join(WORKFLOWS_DIR, workflowName);

  if (!fs.existsSync(workflowDir)) {
    throw new Error(`Workflow directory not found: ${workflowName}`);
  }

  const htmlPath = path.join(workflowDir, "template.html");
  const txtPath = path.join(workflowDir, "template.txt");

  if (!fs.existsSync(htmlPath) || !fs.existsSync(txtPath)) {
    throw new Error(`Template files missing for workflow: ${workflowName}`);
  }

  const htmlSource = fs.readFileSync(htmlPath, "utf-8");
  const txtSource = fs.readFileSync(txtPath, "utf-8");

  const compiled = {
    html: Handlebars.compile(htmlSource),
    text: Handlebars.compile(txtSource)
  };

  templateCache.set(workflowName, compiled);
  return compiled;
}

function normalizeWorkflowName(template) {
  // Map workflow aliases to actual directory names
  const aliases = {
    "verification": "verification-code",
    "verification_code": "verification-code",
    "password_reset": "password-reset"
  };

  const normalized = template.replace(/_/g, "-");
  return aliases[template] || aliases[normalized] || normalized;
}

function renderTemplate({ template, payload }) {
  const workflowName = normalizeWorkflowName(template);

  const compiled = loadTemplate(workflowName);

  const html = compiled.html(payload);
  const text = compiled.text(payload);
  const subject = payload?.subject;

  return { subject, html, text };
}

module.exports = {
  renderTemplate
};
