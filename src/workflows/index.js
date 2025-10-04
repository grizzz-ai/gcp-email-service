"use strict";

const { createVerificationWorkflow } = require("../../workflows/verification-code/workflow");
const { createInviteWorkflow } = require("../../workflows/invite/workflow");
const { createPasswordResetWorkflow } = require("../../workflows/password-reset/workflow");

function createWorkflowRegistry(dependencies) {
  const verificationWorkflow = createVerificationWorkflow(dependencies);
  const inviteWorkflow = createInviteWorkflow(dependencies);
  const passwordResetWorkflow = createPasswordResetWorkflow(dependencies);

  const registry = new Map();

  // Verification workflow aliases
  registry.set("verification", verificationWorkflow);
  registry.set("verification-code", verificationWorkflow);
  registry.set("verification_code", verificationWorkflow);

  // Invite workflow aliases
  registry.set("invite", inviteWorkflow);

  // Password reset workflow aliases
  registry.set("password-reset", passwordResetWorkflow);
  registry.set("password_reset", passwordResetWorkflow);

  return {
    get(name) {
      if (!name) return undefined;
      return registry.get(name);
    },
    has(name) {
      return registry.has(name);
    },
    entries() {
      return registry.entries();
    }
  };
}

module.exports = {
  createWorkflowRegistry
};
