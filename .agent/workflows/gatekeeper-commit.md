---
description: Deterministic Gatekeeper commit workflow with Domain Mapping and ADU splits.
---

# Gatekeeper Commit Routine

Execute this workflow when ready to commit changes. It ensures deterministic governance, ADU-safe
domain splits, and high-precision commit messages.

## Pre-flight

// turbo-all

## Routine

1. **Analyze Staged Changes** Run the deterministic report to receive the complete route, check
   matrix, and suggested splits:

    ```bash
    pnpm gatekeeper:report
    ```

2. **Evaluate Route** Based on the JSON `route` property:
    - **`route: "architectural_intervention"`**: Manual fix required for `severity: "block"`
      findings.
    - **`route: "auto_fix"`**: Jump to `.agent/workflows/evergreen/auto-fix.md`.
    - **`route: "proceed_adu"`**: Proceed using `adu.suggestedSplits` when
      `adu.splitConfidence >= 0.6`.

3. **Atomic Domain Split** For each entry in `adu.suggestedSplits`: a. Stage ONLY the files
   belonging to that domain split. b. Unstage everything else: `git reset HEAD -- <other-files>`. c.
   Validate no scope drift: `pnpm gatekeeper:report` must still return `proceed_adu`.

4. **Compose High-Precision Commit Message** For each split, generate a message following this exact
   template:

    ```text
    type(scope): concise imperative technical intent

    - path/to/file.ext: precise description of what changed and why
    - path/to/other.ext: precise description of what changed and why
    ```

    **Rules:**
    - **type**: Infer from files (`docs/` → docs, `tests/` → test, `scripts/` → chore, `src/styles/`
      → style, else → feat or fix based on intent).
    - **scope**: Use the domain `id` from `suggestedSplits` (kebab-case).
    - **subject**: Must be specific and imperative. NEVER use vague terms (update, fix stuff,
      changes, cleanup, tweaks, improvements, misc).
    - **body**: REQUIRED for 2+ files. Each bullet must start with the file path followed by a colon
      and a technical description. Minimum 30 characters total.
    - **Language**: English only. No Spanish words or accented characters.

5. **Commit and Verify** After each domain commit:

    ```bash
    git commit -m "<generated message>"
    ```

    The `commit-msg` hook will run `commitlint` automatically to validate the message.

6. **Repeat** Return to step 3 for the next domain split until all splits are committed.

## Scope Drift Prevention

- If `s0Drift.hasDrift` is true, stop and restage intentionally.
- If `adu.unmappedFiles` is non-empty, treat as architectural intervention.
- Never mix domains in a single commit. Use `git add -p` for surgical staging.

## Quick Reference: Banned Subject Words

```regex
wip|update|fix stuff|changes|misc|various|tmp|temp|quick fix|
refactor scripts|minor changes|small fix|cleanup|tweaks|
improvements|adjustments|stuff|things
```

- [git-governance.md](../../docs/core/git-governance.md) - Complete commit message standard.
- [gatekeeper:report] - Run for ADU splits and JSON results.
