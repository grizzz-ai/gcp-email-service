const { retryWithBackoff } = require("../../src/utils/retry");

describe("retryWithBackoff", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("retries failing operation until it succeeds", async () => {
    let attempts = 0;
    const operation = jest.fn(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw Object.assign(new Error("temporary failure"), { code: "ETIMEDOUT" });
      }
      return "success";
    });

    const promise = retryWithBackoff(operation, {
      maxRetries: 5,
      baseDelayMs: 0,
      maxDelayMs: 0,
      shouldRetry: () => true,
      jitter: false
    });

    await expect(promise).resolves.toBe("success");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("throws when retries exhausted", async () => {
    const operation = jest.fn(async () => {
      throw new Error("fatal");
    });

    const promise = retryWithBackoff(operation, {
      maxRetries: 2,
      baseDelayMs: 0,
      maxDelayMs: 0,
      shouldRetry: () => true,
      jitter: false
    });

    await expect(promise).rejects.toThrow("fatal");
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
