# Workflows

Each workflow represents a specific email use case with its own schema, templates, and rendering logic.

## Directory Structure

```
workflows/
  <workflow-name>/
    schema.json       # JSON schema describing payload validation
    template.html     # HTML template (Handlebars-compatible)
    template.txt      # Plain text fallback
    workflow.js       # Workflow implementation with prepareEmail() method
```

## Available Workflows

### `verification-code/`
Email verification codes for authentication flows.

**Required fields:**
- `code` - Verification code string (min 4 characters)

**Optional fields:**
- `expires_at` - ISO timestamp for code expiration
- `subject` - Custom email subject

**Example payload:**
```json
{
  "workflow": "verification-code",
  "to": "user@example.com",
  "payload": {
    "code": "ABC123",
    "expires_at": "2025-10-04T12:00:00Z"
  }
}
```

### `invite/`
User invitation emails for team/organization invites.

**Required fields:**
- `inviter_name` - Name of person sending invite
- `invite_url` - URL to accept invitation

**Optional fields:**
- `organization_name` - Organization name
- `expires_at` - ISO timestamp for invite expiration
- `subject` - Custom email subject

**Example payload:**
```json
{
  "workflow": "invite",
  "to": "newuser@example.com",
  "payload": {
    "inviter_name": "John Doe",
    "invite_url": "https://app.example.com/accept/TOKEN",
    "organization_name": "Acme Corp"
  }
}
```

### `password-reset/`
Password reset emails with secure reset links.

**Required fields:**
- `reset_url` - URL for password reset

**Optional fields:**
- `user_name` - User name for personalization
- `expires_at` - ISO timestamp for link expiration
- `subject` - Custom email subject

**Example payload:**
```json
{
  "workflow": "password-reset",
  "to": "user@example.com",
  "payload": {
    "reset_url": "https://app.example.com/reset/TOKEN",
    "user_name": "Jane Smith",
    "expires_at": "2025-10-03T22:00:00Z"
  }
}
```

## Adding New Workflows

1. **Create workflow directory:**
   ```bash
   mkdir workflows/new-workflow
   ```

2. **Create schema.json:**
   Define JSON schema for payload validation.
   ```json
   {
     "$schema": "https://json-schema.org/draft/2020-12/schema",
     "$id": "https://schemas.grizz.ai/workflows/new-workflow.json",
     "title": "New Workflow Email Payload",
     "type": "object",
     "required": ["field1"],
     "properties": {
       "field1": {
         "type": "string",
         "description": "Required field"
       }
     }
   }
   ```

3. **Create templates:**
   - `template.html` - HTML email content (Handlebars syntax)
   - `template.txt` - Plain text version

4. **Create workflow.js:**
   Copy from existing workflow and modify:
   ```javascript
   const { createVerificationWorkflow } = require("../verification-code/workflow");
   // Customize default subject and logic as needed
   ```

5. **Register workflow:**
   Edit `src/workflows/index.js` to add your workflow:
   ```javascript
   const { createNewWorkflow } = require("../../workflows/new-workflow/workflow");
   // ...
   const newWorkflow = createNewWorkflow(dependencies);
   registry.set("new-workflow", newWorkflow);
   ```

6. **Test workflow:**
   ```bash
   npm test
   npm run lint
   ```

## Workflow Implementation

Each workflow must implement:

```javascript
{
  async prepareEmail(eventPayload) {
    // Returns: { subject, html, text, attachments }
  }
}
```

All workflows support:
- **GCS attachments** - Download from Google Cloud Storage
- **Size limits** - Configurable attachment and total email size
- **Retry logic** - Automatic retries for transient failures
- **Timeout handling** - Configurable timeouts for all operations

## Future Enhancements

- Schema validation enforcement at runtime
- Per-tenant template overrides
- Template versioning and A/B testing
- MJML support for advanced layouts
- Workflow-specific delivery tracking
