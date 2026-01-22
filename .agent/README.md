# Agent Entry Point — Celebra-me

This folder defines the **operational rules and conventions** used by automated agents (and humans) working on the Celebra-me repository.

The documents in `.agent/` are **versioned, authoritative, and executable in intent**.
They exist to keep the project consistent, safe, and aligned with its current architecture.

---

## Authority & Precedence

When making decisions, agents must follow this order of precedence:

1. **`.agent/*` documents** (highest authority)
2. **Explicit instructions from the repository owner** (conversation-level overrides)
3. **`docs/*` documentation** (architecture and context)

Generic best practices must **never override** rules defined in this folder.

---

## Missing or Incomplete Documentation

Agents may encounter branches or states where one or more referenced documents are missing.

In such cases, agents must:

- **Continue execution** using **conservative defaults** aligned with widely accepted Astro.js best practices.
- **Avoid making irreversible or large changes**.
- **Explicitly report** which document was missing and what assumptions were applied.
- Prefer **suggestions over actions** when uncertainty is high.

Agents must not silently invent rules.

---

## How Agents Should Use These Docs

Agents must:

1. Read this file first.
2. Load the relevant `.agent/*` documents before acting.
3. Apply rules conservatively and pragmatically.
4. Prefer small, safe fixes over large refactors.

Agents must not introduce new conventions or architectural rules.

---

## Documents Overview

### `GATEKEEPER_RULES.md`

**Operational contract for agent behavior.**

Defines:

- Hard guards (what must be blocked or fixed)
- Allowed auto-fixes and refactors
- Large Change Mode thresholds
- Verification strategy (type-check, lint, tests)
- Output format and commit message requirements

This document governs **how agents act**.

---

### `PROJECT_CONVENTIONS.md`

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

Agents may consult `docs/ARCHITECTURE.md` **only when needed**, such as when:

- evaluating server/client boundaries,
- reasoning about refactors,
- handling structural or cross-cutting changes.

It should not be loaded by default for simple or local fixes.

---

## Ambiguity Handling

When encountering ambiguity or conflicting signals, agents must:

- choose the **most conservative option**,
- avoid irreversible changes,
- report the ambiguity and the chosen approach.

Blocking is preferred over guessing.

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

Agents may rely on **official documentation and well-established best practices**
(e.g., Astro.js or Vercel docs) **only if** they do not conflict with local rules.

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
