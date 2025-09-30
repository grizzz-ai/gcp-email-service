const fs = require('fs');
const path = require('path');

/**
 * Email workflow registry
 * Each workflow contains templates and business logic for specific email types
 */

const workflows = {};

// Dynamically load all workflows
const workflowsDir = path.join(__dirname, '../../workflows');

if (fs.existsSync(workflowsDir)) {
  const workflowNames = fs.readdirSync(workflowsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const workflowName of workflowNames) {
    try {
      const workflowPath = path.join(workflowsDir, workflowName, 'workflow.js');
      if (fs.existsSync(workflowPath)) {
        workflows[workflowName] = require(workflowPath);
      }
    } catch (error) {
      console.warn(`Failed to load workflow ${workflowName}:`, error.message);
    }
  }
}

module.exports = workflows;