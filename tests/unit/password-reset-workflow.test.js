const { createPasswordResetWorkflow } = require("../../workflows/password-reset/workflow");
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

describe("password-reset workflow", () => {
  const logger = createLogger({ test: true });

  const mockStorage = {
    bucket: jest.fn(() => ({
      file: jest.fn(() => ({
        getMetadata: jest.fn(() => Promise.resolve([{ size: "1024", contentType: "application/pdf" }])),
        download: jest.fn(() => Promise.resolve([Buffer.from("demo")]))
      }))
    }))
  };

  const workflow = createPasswordResetWorkflow({
    config: defaultConfig,
    storage: mockStorage,
    logger,
    retryWithBackoff: (operation) => operation(1),
    withTimeout: (operation) => (typeof operation === "function" ? operation() : operation)
  });

  it("renders password reset email with required fields", async () => {
    const result = await workflow.prepareEmail({
      template: "password-reset",
      payload: {
        reset_url: "https://app.example.com/reset/SECURE_TOKEN"
      },
      attachments: []
    });

    expect(result.subject).toBe("Reset your password");
    expect(result.html).toContain("https://app.example.com/reset/SECURE_TOKEN");
    expect(result.text).toContain("https://app.example.com/reset/SECURE_TOKEN");
    expect(result.attachments).toHaveLength(0);
  });

  it("renders password reset email with user name", async () => {
    const result = await workflow.prepareEmail({
      template: "password-reset",
      payload: {
        reset_url: "https://app.example.com/reset/TOKEN123",
        user_name: "Alice Johnson"
      },
      attachments: []
    });

    expect(result.html).toContain("Hi Alice Johnson");
    expect(result.text).toContain("Hi Alice Johnson");
  });

  it("renders password reset email with expiration", async () => {
    const result = await workflow.prepareEmail({
      template: "password-reset",
      payload: {
        reset_url: "https://app.example.com/reset/TOKEN456",
        expires_at: "2025-10-04T18:00:00Z"
      },
      attachments: []
    });

    expect(result.html).toContain("2025-10-04T18:00:00Z");
    expect(result.text).toContain("2025-10-04T18:00:00Z");
  });

  it("supports custom subject override", async () => {
    const result = await workflow.prepareEmail({
      template: "password-reset",
      payload: {
        reset_url: "https://app.example.com/reset/CUSTOM",
        subject: "Your password reset request"
      },
      attachments: []
    });

    expect(result.subject).toBe("Your password reset request");
  });

  it("handles password_reset alias", async () => {
    const result = await workflow.prepareEmail({
      template: "password_reset",
      payload: {
        reset_url: "https://app.example.com/reset/ALIAS_TEST"
      },
      attachments: []
    });

    expect(result.html).toContain("https://app.example.com/reset/ALIAS_TEST");
  });
});
