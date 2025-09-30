# Workflows

Each workflow represents a specific email use case (verification code, report notification, etc.).

Directory structure:

```
workflows/
  <workflow-name>/
    schema.json       # JSON schema describing payload
    template.html     # HTML template (Handlebars-compatible)
    template.txt      # Plain text fallback
    workflow.js       # Optional custom rendering logic (future)
```

Current workflows:
- `verification-code/` – basic verification code email used by authentication flows.

Future tasks:
- Add schema validation wiring in `templates/index.js`.
- Support per-tenant overrides.
- Implement additional workflows (invites, reports, notifications).
