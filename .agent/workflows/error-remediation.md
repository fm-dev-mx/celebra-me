---
description: Technical error diagnosis and surgical remediation.
lifecycle: evergreen
domain: governance
owner: workflow-governance
last_reviewed: 2026-03-15
---

# 🔎 Error-Diagnosis & Remediation

Execute this workflow when a terminal error, test failure, or gatekeeper block requires remediation.
This workflow enforces a strict 7-state machine with a hard cycle limit of 3 to prevent "fix-fail"
loops.

**Cycle Limit:** Maximum of 3 cycles per error. If VERIFY fails 3 times, escalate to user.

## Pre-flight

- Ensure the git working tree is clean. Run `git status` checking for uncommitted edits. If not
  clean, stash or commit them before opening this workflow.

## The 7-State Remediation Machine

### 1. CLASSIFY

Run the Error Classifier to extract structured diagnostic data. Do _not_ read raw terminal output.

```bash
# If capturing from terminal:
pnpm test > .agent/out.log 2>&1
node .agent/scripts/error-classifier.mjs .agent/out.log
```

_Trivial Error Fast-Path Bypass:_ If the resulting JSON has `complexity: "trivial"` and
`autoFixable: false`, skip the ROOT_CAUSE state. Proceed directly to EXTRACT_CONTEXT → DESIGN_FIX →
SNAPSHOT.

### 2. EXTRACT_CONTEXT

Use the `file` and `line` from the Classifier JSON to extract a surgical view of the code:

```bash
node .agent/scripts/context-extractor.mjs <file> <line> 15
```

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

### 5. SNAPSHOT

Capture the pre-fix state to guarantee safe rollback. The working tree **must** be clean.

```bash
git stash push -u -m "pre-fix-snapshot"
```

### 6. APPLY

Modify the files with the proposed atomic fix.

### 7. VERIFY

Re-run the exact failing command (e.g., `pnpm type-check` or `pnpm test`) to confirm the fix.

- **If VERIFY passes:**

    ```bash
    # Clean up the snapshot and proceed to ADU commit
    git stash drop stash@{0}
    ```

- **If VERIFY fails (ROLLBACK):**

    ```bash
    # Restore the exact pre-fix state
    git reset --hard
    git clean -fd
    git stash pop
    ```

    Increment cycle counter. Return to **CLASSIFY** state to analyze the new output. _(Note: If a
    Fast-Path bypass triggered the failure, default to the full 7-state loop for the next cycle)._
