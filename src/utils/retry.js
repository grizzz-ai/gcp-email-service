"use strict";

const DEFAULT_OPTIONS = {
  maxRetries: 3,
  baseDelayMs: 200,
  maxDelayMs: 2000,
  jitter: true,
  shouldRetry: () => true,
  onRetry: () => {}
};

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getDelay(baseDelayMs, attempt, maxDelayMs, jitter) {
  const exponential = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
  if (!jitter) {
    return exponential;
  }
  const variance = Math.floor(exponential * 0.2);
  const min = Math.max(0, exponential - variance);
  const max = exponential + variance;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function retryWithBackoff(operation, options = {}) {
  const finalOptions = { ...DEFAULT_OPTIONS, ...options };
  const { maxRetries, baseDelayMs, maxDelayMs, jitter, shouldRetry, onRetry } = finalOptions;

  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await operation(attempt + 1);
    } catch (error) {
      attempt += 1;
      const retryAllowed = attempt < maxRetries && shouldRetry(error, attempt);
      if (!retryAllowed) {
        throw error;
      }

      const delay = getDelay(baseDelayMs, attempt, maxDelayMs, jitter);

      try {
        await onRetry(error, attempt, delay);
      } catch {
        // Intentionally swallow errors thrown by onRetry handler to avoid masking root cause
      }

      await sleep(delay);
    }
  }

  throw new Error("retryWithBackoff exhausted retries without returning a result");
}

module.exports = {
  retryWithBackoff
};
