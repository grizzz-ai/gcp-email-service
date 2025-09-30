const { parseEmailEvent } = require("../../src/schemas/email-event");

describe("EmailEventSchema", () => {
  it("parses a valid payload", () => {
    const payload = parseEmailEvent({
      delivery_id: "abc-123",
      recipient: "user@example.com",
      template: "verification",
      payload: { code: "123456" },
      attachments: [
        {
          type: "gcs",
          bucket: "demo",
          path: "reports/demo.pdf"
        }
      ]
    });

    expect(payload.delivery_id).toBe("abc-123");
    expect(payload.attachments).toHaveLength(1);
  });

  it("throws for invalid payloads", () => {
    expect(() => parseEmailEvent({})).toThrow(/Invalid email event payload/);
  });
});
