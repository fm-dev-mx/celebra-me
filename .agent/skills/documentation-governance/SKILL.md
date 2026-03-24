---
name: documentation-governance
description:
    Standardize the creation, maintenance, and structure of documentation in 'Celebra-me', ensuring
    alignment between code and docs.
domain: governance
when_to_use:
    - Creating, reorganizing, or updating project documentation
    - Preventing documentation drift between docs, code, and plans
preconditions:
    - Read .agent/README.md
    - Read .agent/GATEKEEPER_RULES.md
inputs:
    - Markdown source-of-truth files, dashboards, and governance references
outputs:
    - Documentation structure guidance and alignment rules
related_docs:
    - .agent/index.md
    - docs/core/project-conventions.md
---

# Documentation Governance

> **Related skills**: [`backend-engineering`](../backend-engineering/SKILL.md) for documenting API
> patterns.

This skill governs the **lifecycle and structure of documentation**. Its primary goal is to prevent
"Documentation Drift" — the state where docs describe a system that no longer exists.

## Documentation Structure (`docs/`)

| Directory/File      | Content Type                                                                       |
| :------------------ | :--------------------------------------------------------------------------------- |
| `docs/core/`        | Evergreen architecture and cross-cutting policy docs.                              |
| `docs/domains/`     | Domain docs for RSVP, theme, content, and similar bounded areas.                   |
| `docs/archive/`     | Historical reports, superseded audits, and archived notes.                         |
| `.agent/index.md`   | Active discovery index for workflows, skills, and canonical document entrypoints.  |
| `.agent/plans/**`   | Active and archived executable plan records.                                       |

## Workflow Metadata Standards

All workflows in `.agent/workflows/*.md` **MUST** include YAML frontmatter:

```yaml
---
description: "Short description of what this workflow does"
lifecycle: "evergreen" | "task-open" | "task-completed"
domain: "governance" | "feature" | "remediation"
owner: "workflow-governance" | "system-agent" | "user"
last_reviewed: "YYYY-MM-DD"
---
```

## Anti-Drift Rules (The "Sync" Contract)

When modifying code, you **MUST** update the corresponding documentation in the same PR/Task.

1. **Business Logic Change**:
    - _If_ it changes the behavior described in an ADR or the Architecture doc.
    - _Action_: Update `docs/core/architecture.md` and the matching `docs/domains/**` doc.

2. **File Structure Change**:
    - _If_ moving core modules (e.g., `src/lib/rsvp` -> `src/lib/rsvp`).
    - _Action_: Update `docs/core/architecture.md`, `.agent/index.md`, and any affected active
      plan record under `.agent/plans/`.

3. **New Feature**:
    - _Action_: Create the doc under the correct subtree (`docs/domains/` for feature docs,
      `docs/core/` for cross-cutting policy, `docs/archive/` for historical reports) and link it
      from `.agent/index.md` when it becomes an active source of truth.

## Diagram Standards

Use **Mermaid** for all diagrams. Embedded directly in markdown files.

### Flowchart (Logic Flow)

```mermaid
graph TD
    A[Start] --> B{Is Valid?}
    B -->|Yes| C[Process]
    B -->|No| D[Error]
```

### Sequence (Interaction)

```mermaid
sequenceDiagram
    Client->>API: POST /rsvp
    API->>DB: Insert Guest
    DB-->>API: Success
    API-->>Client: 200 OK
```

## Artifact Governance

When using Agent Mode artifacts (`task.md`, `implementation_plan.md`):

1. **task.md**: Keep it granular. Check off items as you go.
2. **implementation_plan.md**: The "Contract" before Execution. Do not deviate without updating it.
3. **walkthrough.md**: The "Proof". Must include what was tested.

## Verification Checklist

Before considering a documentation task "Done":

- [ ] Is the doc linked from `.agent/index.md` or the relevant active source-of-truth doc? (If new)
- [ ] Does it have a clear "Last Updated" date?
- [ ] Are code references (filenames, variable names) accurate to the current codebase?
- [ ] Is the doc stored in the correct subtree (`core`, `domains`, `archive`, or `.agent/`)?
