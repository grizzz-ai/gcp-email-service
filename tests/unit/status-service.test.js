const { createStatusService } = require("../../src/status-service");

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

describe("status service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DELIVERY_STATUS_DATABASE_URL;
  });

  it("returns no-op implementation when config missing", async () => {
    const service = createStatusService({ logger: baseLogger });

    expect(__PoolMock).not.toHaveBeenCalled();
    expect(service.isEnabled()).toBe(false);
    await expect(service.getDeliveryById("foo")).resolves.toBeNull();
    await expect(service.listRecentDeliveries()).resolves.toEqual([]);
  });

  it("fetches delivery by id when database configured", async () => {
    process.env.DELIVERY_STATUS_DATABASE_URL = "postgres://example";
    __queryMock.mockResolvedValueOnce({
      rows: [
        {
          delivery_id: "abc",
          workflow: "invite",
          recipient: "user@example.com",
          status: "sent",
          attempts: 1,
          last_error_code: null,
          last_error_message: null,
          queued_at: "2025-10-03T00:00:00Z",
          last_attempted_at: "2025-10-03T00:00:01Z",
          sent_at: "2025-10-03T00:00:02Z",
          created_at: "2025-10-03T00:00:00Z",
          updated_at: "2025-10-03T00:00:02Z",
          metadata: { foo: "bar" }
        }
      ]
    });

    const service = createStatusService({ logger: baseLogger });
    expect(service.isEnabled()).toBe(true);

    const record = await service.getDeliveryById("abc");
    expect(__PoolMock).toHaveBeenCalledWith({ connectionString: "postgres://example", max: 2 });
    expect(__queryMock).toHaveBeenCalledWith(expect.stringContaining("FROM email.deliveries"), ["abc"]);
    expect(record).toMatchObject({ deliveryId: "abc", workflow: "invite", status: "sent" });
  });
});

