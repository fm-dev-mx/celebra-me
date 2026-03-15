---
description: Automated remediation for gatekeeper findings using workflow-owned autofix commands.
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-03-15
---

# Auto-Fix Routine

Execute this when the workflow report returns `workflowRoute: "auto_fix"`.

```bash
pnpm gatekeeper:workflow:autofix
```

## Rules

- Autofix command selection is owned by `gatekeeper.mjs`.
- Retry orchestration, strict final verification, and session cleanup are owned by
  `gatekeeper-workflow.mjs`.
- Do not re-implement fix selection logic in markdown.

## After Autofix

Run `pnpm gatekeeper:workflow:inspect` again. If `workflowRoute` is still
`architectural_intervention`, resolve the blocking findings manually.
