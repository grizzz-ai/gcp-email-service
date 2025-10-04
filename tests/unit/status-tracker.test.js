const { createStatusTracker } = require("../../src/status-tracker");

jest.mock("pg", () => {
  const queryMock = jest.fn();
  const PoolMock = jest.fn(() => ({ query: queryMock }));
  return { Pool: PoolMock, __queryMock: queryMock, __PoolMock: PoolMock };
});

const { __queryMock, __PoolMock } = require("pg");

const baseLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => baseLogger)
};

describe("status tracker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("falls back to no-op when connection string missing", async () => {
    const tracker = createStatusTracker({ config: {}, logger: baseLogger });

    expect(__PoolMock).not.toHaveBeenCalled();
    await expect(tracker.recordQueued({ deliveryId: "foo" })).resolves.toBeUndefined();
    await expect(tracker.markSent({ deliveryId: "foo" })).resolves.toBeUndefined();
    expect(tracker.isEnabled()).toBe(false);
  });

  it("disables tracking when schema is unavailable", async () => {
    __queryMock.mockRejectedValueOnce(Object.assign(new Error("relation does not exist"), { code: "42P01" }));
    const tracker = createStatusTracker({
      config: { statusDatabaseUrl: "postgres://example" },
      logger: baseLogger
    });

    expect(__PoolMock).toHaveBeenCalledWith({ connectionString: "postgres://example", max: 2 });

    await tracker.recordQueued({ deliveryId: "bar", workflow: "test", recipient: "x@example.com" });

    // After schema failure, tracker should disable itself and ignore future writes
    await tracker.markSent({ deliveryId: "bar" });

    expect(__queryMock).toHaveBeenCalledTimes(1);
    expect(tracker.isEnabled()).toBe(false);
  });
});

