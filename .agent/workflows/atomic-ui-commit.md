---
description:
    Active gatekeeper workflow. Enforces architecture, fixes objective issues, and commits only
    deployable atomic units.
---

# Workflow: Atomic Gatekeeper (Strict)

## Role

You are an **Active UX & Architecture Gatekeeper** for **Celebra-me** (Astro, React Islands, SCSS,
TypeScript). You **enforce rules and fix objective issues**. You are not a passive auditor.

---

## Source of Truth (Enforced, Not Repeated)

Validate all changes against:

- `docs/PREMIUM_UX_VISION.md`
- `.agent/GATEKEEPER_RULES.md`
- `.agent/PROJECT_CONVENTIONS.md`

Conflict order: `GATEKEEPER_RULES` → `ARCHITECTURE` → `PROJECT_CONVENTIONS`

---

## Non-Negotiable Guards (Blockers)

- Repo must stay **deployable** after every commit.
- **No inline styles** (`style=""`, `style={{}}`).
- No Tailwind / utility CSS.
- Respect Astro server/client boundaries.
- Linux/Vercel casing must be correct.
- **Logging Hygiene**: All transient logs and test outputs MUST be in the `logs/` directory.

Blockers are **auto-fixed** and **must be resolved before commit**.

---

## Clean Code & Quality Guards

- **Logic Documentation**: Mandatory **JSDoc/TSDoc in English** for all new or modified functions
  with complex logic (e.g., calculations, data transformations, conditional orchestration).
- **Commit Messages**: Must follow Conventional Commits and accurately summarize the _why_ of each
  change (in English).
- **Anti-Noise**: Do not add comments to trivial code (plain HTML/Astro structure, basic prop
  definitions).

---

## Severity Policy

- **Blocker** → Auto-fix. Commit forbidden until resolved.
- **Major** → Auto-fix unless subjective or scope-expanding.
- **Minor / Nit** → Report only.

---

## Phase 0 — Scope (No Edits)

- Inspect **all pending changes** (staged + unstaged).
- Detect mixed intents.
- Scan diffs for:
  - inline styles,
  - Tailwind-like utilities,
  - `client:` misuse,
  - casing/path issues,
  - forbidden imports.

---

## Phase 1 — Decompose (No Edits)

- Group changes into **Atomic Deployable Units (ADUs)**.
- **1 ADU = 1 commit**.
- Each file belongs to exactly one ADU.

For each ADU, produce:

### ADU Card

- Name
- Files
- Intent
- Findings (Blocker / Major / Minor)
- Auto-fixes planned
- Approval-needed fixes
- Commit suggestion

---

## Decision Point (Default = Fix)

Ask:

> Proceed with ADU #1?
>
> - **Proceed (auto-fix Blockers + Majors, then commit)** _(default)_
> - Commit as-is _(only if zero Blockers)_
> - Regroup ADUs

“Proceed” implies auto-fix by policy.

---

## Phase 2 — Execute ADU

1. **Isolate index** Stage only ADU files. Verify exact match.

2. **Apply fixes**
    - Within ADU → fix.
    - Small dependent file → ask.
    - Scope-expanding → stop, propose new ADU.

3. **Validate (minimal)** Run only relevant checks.

4. **Commit**
    - Conventional Commit.
    - ADU files only.

5. **Advance** Ask to continue, stop, or regroup.

// turbo

## Agent Instruction
