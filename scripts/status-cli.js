#!/usr/bin/env node

"use strict";

const util = require("node:util");
const { createLogger } = require("../src/logger");
const { createStatusService } = require("../src/status-service");

async function main() {
  const [deliveryId] = process.argv.slice(2);
  if (!deliveryId) {
    console.error("Usage: npm run status -- <delivery_id>");
    process.exit(1);
  }

  const logger = createLogger({ component: "status-cli" });
  const service = createStatusService({ logger });

  if (!service.isEnabled()) {
    console.error(
      "Email status tracking database is not configured. Set DELIVERY_STATUS_DATABASE_URL and retry."
    );
    process.exit(1);
  }

  try {
    const record = await service.getDeliveryById(deliveryId);
    if (!record) {
      console.log(`No delivery found for ID: ${deliveryId}`);
      process.exit(0);
    }

    console.log(`Delivery status for ${deliveryId}:`);
    console.log(util.inspect(record, { depth: null, colors: true }));
  } catch (error) {
    console.error("Failed to fetch delivery status:", error.message);
    process.exit(1);
  }
}

main();
