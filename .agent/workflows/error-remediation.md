---
description: Technical error diagnosis and surgical remediation.
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-03-15
---

# Error-Diagnosis & Remediation

Execute this workflow when a terminal error, test failure, or gatekeeper block requires remediation.
This workflow enforces a strict 7-state machine with a hard cycle limit of 3 to prevent "fix-fail"
loops.

**Cycle Limit:** Maximum of 3 cycles per error. If VERIFY fails 3 times, escalate to user.

## Pre-flight

- Inspect the git working tree first with `git status`.
- If unrelated edits are present, do **not** use destructive rollback commands. Work in the smallest
  safe scope, or pause and ask the repository owner how to proceed when edits overlap.

## The 7-State Remediation Machine

### 1. CLASSIFY

Capture the failing command's output and extract structured diagnostic data:

- **Error message** (exact text)
- **File path** and **line number**
- **Error category**: syntax, type, runtime, import, config, test assertion
- **Complexity**: trivial (single-line fix), moderate (multi-file), or complex (architectural)

_Trivial Error Fast-Path Bypass:_ If the error is trivially classifiable (e.g., a missing import,
typo, or unused variable), skip the ROOT_CAUSE state. Proceed directly to EXTRACT_CONTEXT →
DESIGN_FIX → APPLY → VERIFY.

### 2. EXTRACT_CONTEXT

Read the file at the reported line number with ±15 lines of surrounding context. Identify:

- The function or block containing the error
- Related imports and type definitions
- Any recent changes in the area (check `git diff` or `git log -1 -- <file>`)

### 3. ROOT_CAUSE

Explicitly state your hypothesis. If this is cycle 2 or 3, you **must** explain why this new
hypothesis differs from the previous failed attempt.

_BFF/Hydration Guards:_ Check for common failure patterns:

- Missing `client:*` directives on interactive TSX/Astro hooks.
- Server-only variables (`import.meta.env`) escaping into client code.
- Non-serializable objects (Date, Map, Set) being passed from BFF to client without serialization.
- `window` or `document` used directly during SSR without `onMount`/`useEffect`.

### 4. DESIGN_FIX

Propose the minimal atomic fix (Atomic Deployable Unit). _Pre-apply Validation Checks:_

- **WCAG:** Ensure fix doesn't remove `aria-*` or break semantic structure.
- **3-Layer Architecture:** Ensure `.scss` changes don't overwrite or bypass CSS tokens.

### 5. APPLY

Modify the files with the proposed atomic fix.

### 6. VERIFY

Re-run the exact failing command (e.g., `pnpm type-check` or `pnpm test`) to confirm the fix.

- **If VERIFY passes:** proceed with the task.

- **If VERIFY fails:** inspect the new output and decide whether a targeted follow-up edit is safe.
  If the worktree contains overlapping user changes or the rollback would be ambiguous, stop and
  escalate instead of forcing a reset.

Increment cycle counter when verification fails. Return to **CLASSIFY** to analyze the new output.
