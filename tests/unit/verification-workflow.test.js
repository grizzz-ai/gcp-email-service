const { createVerificationWorkflow } = require("../../workflows/verification-code/workflow");
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

describe("verification workflow", () => {
  const logger = createLogger({ test: true });

  const mockStorage = {
    bucket: jest.fn(() => ({
      file: jest.fn(() => ({
        getMetadata: jest.fn(() => Promise.resolve([{ size: "1024", contentType: "application/pdf" }])),
        download: jest.fn(() => Promise.resolve([Buffer.from("demo")]))
      }))
    }))
  };

  const workflow = createVerificationWorkflow({
    config: defaultConfig,
    storage: mockStorage,
    logger,
    retryWithBackoff: (operation) => operation(1),
    withTimeout: (operation) => (typeof operation === "function" ? operation() : operation)
  });

  it("renders email content and attachments", async () => {
    const result = await workflow.prepareEmail({
      template: "verification",
      payload: { code: "654321" },
      attachments: [
        {
          type: "gcs",
          bucket: "demo",
          path: "docs/file.pdf"
        }
      ]
    });

    expect(result.subject).toContain("verification");
    expect(result.attachments).toHaveLength(1);
    expect(mockStorage.bucket).toHaveBeenCalledWith("demo");
  });
});
