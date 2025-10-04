const { createStatusApi } = require("../../src/status-api");

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    set: jest.fn(function (key, value) {
      this.headers[key.toLowerCase()] = value;
      return this;
    }),
    status: jest.fn(function (code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function (payload) {
      this.body = payload;
      return this;
    })
  };
  return res;
}

describe("status API", () => {
  it("returns 503 when service disabled", async () => {
    const handler = createStatusApi({
      statusService: {
        isEnabled: () => false
      },
      logger: { error: jest.fn(), child: () => ({}) }
    });

    const req = { method: "GET", path: "/deliveries/test" };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.body).toEqual({ error: "status_tracking_disabled" });
  });

  it("returns delivery by id", async () => {
    const handler = createStatusApi({
      statusService: {
        isEnabled: () => true,
        getDeliveryById: jest.fn(async () => ({ deliveryId: "abc", status: "sent" }))
      },
      logger: { error: jest.fn(), child: () => ({}) }
    });

    const req = { method: "GET", path: "/deliveries/abc" };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ data: { deliveryId: "abc", status: "sent" } });
  });

  it("returns 404 when delivery missing", async () => {
    const handler = createStatusApi({
      statusService: {
        isEnabled: () => true,
        getDeliveryById: jest.fn(async () => null)
      },
      logger: { error: jest.fn(), child: () => ({}) }
    });

    const req = { method: "GET", path: "/deliveries/missing" };
    const res = createMockRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ error: "delivery_not_found" });
  });

  it("lists deliveries by recipient", async () => {
    const service = {
      isEnabled: () => true,
      getDeliveryById: jest.fn(),
      listRecipientDeliveries: jest.fn(async () => [{ deliveryId: "a" }, { deliveryId: "b" }]),
      listRecentDeliveries: jest.fn()
    };

    const handler = createStatusApi({
      statusService: service,
      logger: { error: jest.fn(), child: () => ({}) }
    });

    const req = { method: "GET", path: "/deliveries", query: { recipient: "user@example.com", limit: "5" } };
    const res = createMockRes();

    await handler(req, res);

    expect(service.listRecipientDeliveries).toHaveBeenCalledWith({ recipient: "user@example.com", limit: 5 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ data: [{ deliveryId: "a" }, { deliveryId: "b" }] });
  });
});

