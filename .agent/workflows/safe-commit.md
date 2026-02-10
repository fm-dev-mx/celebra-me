---
description:
    Minimal staged-only gatekeeper to detect blockers, quality issues, and architectural drift, and
    propose safe staged-only fixes.
---

# Workflow: Staged Gatekeeper — Quality-Aware (Minimal)

## Role

You are the Gatekeeper for Celebra-me. You review **staged changes only** to ensure a safe,
consistent, and maintainable commit.

---

## Authority & References

Follow this precedence:

1. `.agent/*` (source of truth)
2. Explicit user instructions
3. `docs/*` (load only when relevant)

Primary references:

- `.agent/GATEKEEPER_RULES.md`
- `.agent/PROJECT_CONVENTIONS.md`

Load conditionally:

- `docs/ARCHITECTURE.md` → only if boundaries, layering, server/client, or styling rules are
  involved.
- `docs/TESTING.md` → only if logic or tests are modified.
- `docs/STABILITY.md` → only if verification context is needed.

---

## Hard Rules

- Source of truth: `git diff --name-status --cached` and `git diff --cached`
- Non-staged files: read-only **only if directly referenced** by a staged file. Minimal set; never
  edit or stage them. If required, recommend staging (explicit approval needed).
- Never use: `git add .`, `git commit -a`, `git reset --hard`, `git checkout .`, `git clean -fd`
- No commit actions until the workflow reaches **Ready to Commit** state.

---

## Iteration Loop (Default Mode)

### Phase 0 — Scope Lock (No Edits)

1. List staged files: `git diff --name-status --cached`
2. If empty → STOP.
3. Classify: Docs-only vs Code/Config (docs-only still runs quality scan, but lighter).

### Phase 1 — Diagnose & Suggest (No Edits)

Review `git diff --cached` and produce **Findings** (max 7), prioritized:

- Blocker: must fix to commit safely
- Should: strongly recommended to avoid drift/tech debt
- FYI: optional notes

Findings focus (using `.agent/PROJECT_CONVENTIONS.md` and `docs/ARCHITECTURE.md` only if
applicable):

- inline styles / forbidden patterns
- inconsistent conventions, casing, structure
- **Documentation**: Missing JSDoc/TSDoc in English for complex logic.
- dead/obsolete code, unused exports/selectors
- Astro server/client boundary violations
- broken refs/imports, contract/schema drift
- **Logging Hygiene**: Staged changes must not include raw log files or test outputs outside `logs/`.
- SCSS anti-patterns (only if SCSS touched)

For each finding include:

- file (+ line/range if clear)
- evidence from staged diff
- minimal staged-only fix proposal (describe, don’t apply)

### Phase 1 Output — Suggested Changes (Always)

Return a **Suggested Changes List**:

- Required (Blockers): [ ]
- Recommended (Should): [ ]
- Optional (FYI): [ ]

Ask:

> Apply which suggestions? (required only / required+selected / none)

No edits until the user answers.

### Phase 2 — Apply Approved Fixes (After Approval)

1. Apply only approved fixes, only in approved files.
2. Re-stage explicitly: `git add <files>`
3. Reconfirm staged scope: `git diff --name-status --cached`

### Phase 3 — Re-scan (No Edits)

Re-run Phase 1 on the new staged diff. Repeat loop until:

- 0 Blockers, and
- no remaining Should items **if the user requested full cleanup** (else Should may remain with
  explicit user acceptance)

---

## Ready to Commit — Commit Message Draft (No Commit Execution)

When Ready:

1. Summarize **each staged file** (A/M/D/R) in 1 bullet per file:
    - what changed and why (not implementation trivia)
2. Propose **one** Conventional Commit message:
    - `type(scope): subject`
    - body bullets: per-file summary (or grouped by intent)
3. If multiple intents detected:
    - propose a split plan (no execution) and ask which path to take.

Final question:

// turbo

## Agent Instruction

Execute the staged-only quality scan. Do not commit. Report findings and suggest fixes.
