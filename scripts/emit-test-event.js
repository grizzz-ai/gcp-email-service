#!/usr/bin/env node

const { Buffer } = require("node:buffer");

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npm run dev -- '<json message>'");
    process.exit(1);
  }

  const message = JSON.parse(arg);

  const handler = require("../src/email-worker").handleEmailEvent;

  const pubsubMessage = {
    data: Buffer.from(JSON.stringify(message)).toString("base64")
  };

  handler(pubsubMessage, { eventId: `test-${Date.now()}` })
    .then(() => {
      console.log("Test event processed");
    })
    .catch((err) => {
      console.error("Handler failed", err);
      process.exit(1);
    });
}

if (require.main === module) {
  main();
}
