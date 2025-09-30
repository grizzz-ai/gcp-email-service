"use strict";

const { createVerificationWorkflow } = require("../../workflows/verification-code/workflow");

function createWorkflowRegistry(dependencies) {
  const verificationWorkflow = createVerificationWorkflow(dependencies);

  const registry = new Map();
  registry.set("verification", verificationWorkflow);
  registry.set("verification-code", verificationWorkflow);
  registry.set("verification_code", verificationWorkflow);

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
