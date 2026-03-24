# Agent Entry Point — Celebra-me

This file is the **universal agent entrypoint** for the Celebra-me repository.

Any agent, regardless of provider or runtime, must start here before acting on the repository.

The documents in `.agent/` are **versioned, authoritative, and executable in intent**. They exist to
keep the project consistent, safe, and aligned with its current architecture.

---

## Universal Agent Protocol

Agents must follow this loading routine:

1. Read this file first.
2. Read `.agent/index.md` for the discovery index, available skills, workflows, and canonical docs.
3. Load mandatory rules before acting:
   - `.agent/README.md`
   - `.agent/GATEKEEPER_RULES.md`
4. Load only the smallest additional context required for the task:
   - relevant skill under `.agent/skills/*/SKILL.md`
   - relevant workflow under `.agent/workflows/*.md`
   - canonical docs under `docs/` when the task crosses architecture or domain boundaries
5. If documentation is missing or incomplete, apply the fallback rules in this file and report the
   assumption.

Agents must not require `.codex/`, global skills, or provider-specific bootstrapping to understand
this repository.

---

## Authority & Precedence

When making decisions, agents must follow this order of precedence:

1. **`.agent/*` documents** (highest authority)
2. **Explicit instructions from the repository owner** (conversation-level overrides)
3. **`docs/*` documentation** (architecture and context)

Generic best practices must **never override** rules defined in this folder.

## Missing or Incomplete Documentation

Agents may encounter branches or states where one or more referenced documents are missing.

In such cases, agents must:

- **Continue execution** using **conservative defaults** aligned with widely accepted Astro.js best
  practices.
- **Avoid making irreversible or large changes**.
- **Explicitly report** which document was missing and what assumptions were applied.
- Prefer **suggestions over actions** when uncertainty is high.

Agents must not silently invent rules.

---

## How Agents Should Use These Docs

Agents must:

1. Read this file first.
2. Use `.agent/index.md` to choose the minimal relevant context.
3. Load the relevant `.agent/*` documents before acting.
4. Apply rules conservatively and pragmatically.
5. Prefer small, safe fixes over large refactors.

Agents must not introduce new conventions or architectural rules.

### Selecting Skills

Skills are reusable capability guides under `.agent/skills/*/SKILL.md`.

Load a skill only when the task clearly matches its domain, for example:

- UI or visual changes: `frontend-design`, `theme-architecture`, `accessibility`
- Astro component or data-flow work: `astro-patterns`
- API, validation, or integrations: `backend-engineering`
- copy or UX text: `copywriting-es`
- tests: `testing`
- docs maintenance: `documentation-governance` (loads `system-doc-alignment`)

When multiple skills are relevant, load the smallest useful set and avoid broad context loading by
default.

### Selecting Workflows

Workflows are operational sequences under `.agent/workflows/*.md`.

Load a workflow when the task is process-heavy or governance-sensitive, for example:

- error recovery or failing checks: `error-remediation`
- commit planning: `plan-authoring`
- commit planning under governance: `plan-authoring`
- documentation resynchronization or Sync Contract enforcement: `system-doc-alignment`
- theme governance or section abstraction: `theme-architecture-governance`

---

## Documents Overview

### `GATEKEEPER_RULES.md`

**Mandatory operational contract for agent behavior.**

Defines:

- Hard guards (what must be blocked or fixed)
- Allowed auto-fixes and refactors
- Large Change Mode thresholds
- Verification strategy (type-check, lint, tests)
- Output format and commit message requirements

This document governs **how agents act**.

---

### `docs/core/project-conventions.md`

**Canonical project conventions.**

Defines:

- Folder structure and naming
- Styling system (SCSS only)
- Import and alias rules
- Public asset usage
- Language rules (UI vs code)

This document defines **how the project should look when healthy**.

---

## Architecture Context

High-level architectural decisions live outside this folder.

Agents may consult [`docs/core/architecture.md`](../docs/core/architecture.md) **only when needed**,
such as when:

- evaluating server/client boundaries,
- reasoning about refactors,
- handling structural or cross-cutting changes.

It should not be loaded by default for simple or local fixes.

---

## Minimal Load Matrix

Use this matrix to avoid overloading context:

| Task Type                         | Required Load                                                                                                  |
| :-------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| Visual or UI change               | `README` + `GATEKEEPER_RULES.md` + relevant skill(s): `frontend-design`, `theme-architecture`, `accessibility` |
| Backend, schema, or API work      | `README` + `GATEKEEPER_RULES.md` + `backend-engineering` or `astro-patterns` + relevant domain docs            |
| Documentation or governance drift | `README` + `GATEKEEPER_RULES.md` + `documentation-governance` + `system-doc-alignment`                         |
| Planning or commit governance     | `README` + `GATEKEEPER_RULES.md` + `plan-authoring` + governance docs                                          |
| Ambiguous task                    | `README` + `GATEKEEPER_RULES.md` + `docs/core/project-conventions.md`, then expand surgically                  |

If a task is still ambiguous after that minimum load, expand to the nearest relevant workflow or
domain doc rather than scanning the entire repository.

---

## Ambiguity Handling

When encountering ambiguity or conflicting signals, agents must:

- choose the **most conservative option**,
- avoid irreversible changes,
- report the ambiguity and the chosen approach.

Blocking is preferred over guessing.

---

## Missing or Provider-Specific Integration

This repository is intentionally **repo-portable**.

- `.agent/` is the only required in-repo agent contract.
- Provider-specific integrations are optional and external.
- Agents must not instruct users to mirror `.agent/` into `.codex/` or any other provider-specific
  directory as a repository requirement.

If a provider supports native skills or custom bootstrapping, that integration may be added outside
the repository without changing the repository contract.

---

## Output Expectations

Agent output should be:

- **Concise by default**
- More detailed only when:
  - fixing critical issues,
  - explaining non-obvious decisions,
  - reporting ambiguity or fallback behavior.

Clarity is preferred over verbosity.

---

## Use of External Knowledge

Agents may rely on **official documentation and well-established best practices** (e.g., Astro.js or
Vercel docs) **only if** they do not conflict with local rules.

Local documentation always takes precedence.

---

## Scope & Intent

The goal of these documents is to:

- prevent architecture drift,
- avoid over-engineering,
- catch real issues early,
- keep the repository deployable at all times.

They are **not** meant to:

- enforce dogmatic patterns,
- replace human judgment,
- lock the project into a fixed architecture.

---

## Evolution

These documents are expected to evolve.

When they no longer reflect the reality of the repository:

- update them first,
- then update agent behavior.

Silent workarounds are discouraged.

---

## Documentation Map

The current documentation taxonomy is:

- `docs/core/` for evergreen architecture and policy
- `docs/domains/` for domain- or feature-specific docs
- `docs/archive/` for historical reports, audits, and superseded notes

Historical logs may exist under `docs/archive/` and can retain legacy path references when clearly
marked as historical context.
