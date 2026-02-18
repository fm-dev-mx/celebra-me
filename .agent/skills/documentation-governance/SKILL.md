---
name: documentation-governance
description:
    Standardize the creation, maintenance, and structure of documentation in 'Celebra-me', ensuring
    alignment between code and docs.
---

> **Related skills**: [`backend-engineering`](../backend-engineering/SKILL.md) for documenting API
> patterns.

This skill governs the **lifecycle and structure of documentation**. Its primary goal is to prevent
"Documentation Drift" — the state where docs describe a system that no longer exists.

## Documentation Structure (`docs/`)

| Directory/File         | Content Type                                                          |
| :--------------------- | :-------------------------------------------------------------------- |
| `docs/architecture/`   | ADRs, High-level diagrams, Evolution plans.                           |
| `docs/audit/`          | Audit reports, Gap analysis, Remediation plans.                       |
| `docs/DOC_STATUS.md`   | **Source of Truth** for documentation health. Lists active workflows. |
| `docs/ARCHITECTURE.md` | The "Constitution" of the project. High-level boundaries.             |

## Workflow Metadata Standards

All workflows in `.agent/workflows/*.md` **MUST** include YAML frontmatter:

```yaml
---
description: "Short description of what this workflow does"
lifecycle: "evergreen" | "task-open" | "task-completed"
domain: "governance" | "feature" | "remediation"
owner: "system-agent" | "user"
last_reviewed: "YYYY-MM-DD"
---
```

## Anti-Drift Rules (The "Sync" Contract)

When modifying code, you **MUST** update the corresponding documentation in the same PR/Task.

1.  **Business Logic Change**:
    - _If_ it changes the behavior described in an ADR or the Architecture doc.
    - _Action_: Update `docs/architecture/*.md` or creating a new ADR.

2.  **File Structure Change**:
    - _If_ moving core modules (e.g., `src/lib/rsvp` -> `src/lib/rsvp`).
    - _Action_: Update `docs/ARCHITECTURE.md`.

3.  **New Feature**:
    - _Action_: Create a new specific doc in `docs/` (e.g., `docs/RSVP_V2_SPECS.md`) AND link it in
      `docs/DOC_STATUS.md`.

## Diagram Standards

Use **Mermaid** for all diagrams. Embedded directly in markdown files.

**Flowchart (Logic Flow):**

```mermaid
graph TD
    A[Start] --> B{Is Valid?}
    B -->|Yes| C[Process]
    B -->|No| D[Error]
```

**Sequence (Interaction):**

```mermaid
sequenceDiagram
    Client->>API: POST /rsvp
    API->>DB: Insert Guest
    DB-->>API: Success
    API-->>Client: 200 OK
```

## Artifact Governance

When using Agent Mode artifacts (`task.md`, `implementation_plan.md`):

1.  **task.md**: Keep it granular. Check off items as you go.
2.  **implementation_plan.md**: The "Contract" before Execution. Do not deviate without updating it.
3.  **walkthrough.md**: The "Proof". Must include what was tested.

## Verification Checklist

Before considering a documentation task "Done":

- [ ] Is the doc linked in `docs/DOC_STATUS.md`? (If new)
- [ ] Does it have a clear "Last Updated" date?
- [ ] Are code references (filenames, variable names) accurate to the current codebase?
