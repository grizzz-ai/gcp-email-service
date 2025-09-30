"use strict";

class TimeoutError extends Error {
  constructor(message, metadata = {}) {
    super(message);
    this.name = "TimeoutError";
    this.code = "ETIMEDOUT";
    this.metadata = metadata;
  }
}

async function withTimeout(operation, timeoutMs, { message, metadata } = {}) {
  const errorMessage = message || `Operation timed out after ${timeoutMs}ms`;
  const context = metadata || {};

  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new TimeoutError(errorMessage, context));
    }, timeoutMs);

    Promise.resolve()
      .then(() => (typeof operation === "function" ? operation() : operation))
      .then((result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
  });
}

module.exports = {
  TimeoutError,
  withTimeout
};
