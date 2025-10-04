const { createInviteWorkflow } = require("../../workflows/invite/workflow");
const { createLogger } = require("../../src/logger");

const defaultConfig = {
  maxAttachmentSizeBytes: 10 * 1024 * 1024,
  maxTotalEmailSizeBytes: 20 * 1024 * 1024,
  attachmentMaxRetries: 2,
  attachmentRetryBaseDelayMs: 10,
  attachmentRetryMaxDelayMs: 20,
  attachmentDownloadTimeoutMs: 100,
  mailFrom: "no-reply@example.com"
};

describe("invite workflow", () => {
  const logger = createLogger({ test: true });

  const mockStorage = {
    bucket: jest.fn(() => ({
      file: jest.fn(() => ({
        getMetadata: jest.fn(() => Promise.resolve([{ size: "1024", contentType: "application/pdf" }])),
        download: jest.fn(() => Promise.resolve([Buffer.from("demo")]))
      }))
    }))
  };

  const workflow = createInviteWorkflow({
    config: defaultConfig,
    storage: mockStorage,
    logger,
    retryWithBackoff: (operation) => operation(1),
    withTimeout: (operation) => (typeof operation === "function" ? operation() : operation)
  });

  it("renders invite email with required fields", async () => {
    const result = await workflow.prepareEmail({
      template: "invite",
      payload: {
        inviter_name: "John Doe",
        invite_url: "https://app.example.com/accept/TOKEN123"
      },
      attachments: []
    });

    expect(result.subject).toBe("You've been invited");
    expect(result.html).toContain("John Doe");
    expect(result.html).toContain("https://app.example.com/accept/TOKEN123");
    expect(result.text).toContain("John Doe");
    expect(result.text).toContain("https://app.example.com/accept/TOKEN123");
    expect(result.attachments).toHaveLength(0);
  });

  it("renders invite email with optional organization", async () => {
    const result = await workflow.prepareEmail({
      template: "invite",
      payload: {
        inviter_name: "Jane Smith",
        invite_url: "https://app.example.com/accept/TOKEN456",
        organization_name: "Acme Corp"
      },
      attachments: []
    });

    expect(result.html).toContain("Acme Corp");
    expect(result.text).toContain("Acme Corp");
  });

  it("renders invite email with expiration", async () => {
    const result = await workflow.prepareEmail({
      template: "invite",
      payload: {
        inviter_name: "Bob Johnson",
        invite_url: "https://app.example.com/accept/TOKEN789",
        expires_at: "2025-10-10T12:00:00Z"
      },
      attachments: []
    });

    expect(result.html).toContain("2025-10-10T12:00:00Z");
    expect(result.text).toContain("2025-10-10T12:00:00Z");
  });

  it("supports custom subject override", async () => {
    const result = await workflow.prepareEmail({
      template: "invite",
      payload: {
        inviter_name: "Alice Cooper",
        invite_url: "https://app.example.com/accept/CUSTOM",
        subject: "Join our awesome team!"
      },
      attachments: []
    });

    expect(result.subject).toBe("Join our awesome team!");
  });
});
