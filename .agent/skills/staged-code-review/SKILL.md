---
name: staged-code-review
description: |
  Analyze staged git changes with a simplification-first mindset. Full-file hygiene on each staged
  path (not diff-only): dead code, redundant abstractions, orphaned files; secondarily bugs and
  anti-patterns. Read-only — no edits, staging, or commits. Emits apply-tags for staged-code-review-apply.
domain: quality
version: 1.3.0
when_to_use:
  - User asks to review staged changes before committing
  - User asks to analyze staged work for over-engineering or dead code
  - Phrases like "revisa lo staged", "analiza lo staged", or "staged code review"
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
  - Read .agent/rules/git-safety.md
  - Read .agent/templates/agent-report-contract.md
  - Staged changes exist (`git diff --cached` non-empty)
related_skills:
  - staged-code-review-apply
  - commit-planner
related_docs:
  - docs/core/git-governance.md
  - docs/core/project-conventions.md
  - .agent/templates/agent-report-samples.md
---

# Staged Code Review

## Mission

Two jobs on the **staged** set only:

1. **Staged quality** — simplification-first; then obvious bugs/regressions.
2. **Continuous hygiene** — for every staged path, read the **entire file** (the diff is not enough)
   and propose cleanup coupled to that touch. Read neighbors only when a finding needs proof
   (consumers, CSS↔template, imports). Do not audit non-staged modules opportunistically.

Produces a structured plan with apply-tags for [`staged-code-review-apply`](../staged-code-review-apply/SKILL.md).
No edits, staging, or commits.

**Report contract:** [`.agent/templates/agent-report-contract.md`](../../templates/agent-report-contract.md)
(samples: [`agent-report-samples.md`](../../templates/agent-report-samples.md)).

**Large diffs:** [`references/parallel-mode.md`](./references/parallel-mode.md).

## Hard constraints

- Read-only: no edits, stash, stage/unstage, or commit.
- Never run `git add`, `git restore --staged`, `git reset` (staging), or any index mutation.
  Staging and unstaging are **user-owned** so the owner can visualize diffs in the working tree.
- Do not run lint/test/build unless the user asks.
- Do not analyze unstaged-only work; stop if `git diff --cached` is empty.
- Do not run autonomously — only when the user asked for staged analysis/review.
- Language: same as the user request.
- Governance / protected docs are findings only with apply-tag `manual` — never imply auto-edit:
  `docs/**`, `.agent/**` (includes rules, briefs, skills, templates, workflows).

## Flight order

1. **Inspect** — confirm git repo; `git status --short`; `git diff --cached --stat` and
   `git diff --cached`; stop if empty; note MM paths.
2. **Analyze** — per staged path: read the **full file**; run checklists below; focused neighbor
   reads only as needed. Prefer deletion opportunities before improvement suggestions.
3. **Classify** — each finding: priority; HIGH → **Clase** `risk`|`cleanup`; apply-tag; `MM` if
   applicable.
4. **Consolidate** — always:
   1. Dedupe (mandatory if ≥10 findings; still recommended below that).
   2. **Cleanup uplift** — see Priorities.
   3. **Tag honesty** — downgrade any `auto-safe` that fails the allowlist before the report ships.
   4. Recompute `~N` from cleanup-class findings in HIGH+MEDIUM only.
5. **Report** — Verdict → Body → Decision (contract order).

If >20 files or >25K diff, load [`references/parallel-mode.md`](./references/parallel-mode.md).
Otherwise stay sequential.

## Full-file rule

- **Diff** = what changed. **Full file** = what else is wrong in what we already touched.
- Scope: every staged path, complete. Neighbors only for proof. No repo-wide fishing.

## Apply-tags

Required on every expanded finding (and on LOW when actionable):

| Tag | When |
| --- | --- |
| `auto-safe` | Only if **all** allowlist conditions hold (below); not protected; not MM-blocked |
| `needs-confirm` | File delete, doubtful consumers, doubtful SCSS `@use`, mixed safe/unsafe scope, or deny-list items |
| `manual` | Governance/protected paths, complex bug/security, MM overlap that blocks safe apply |

Review **labels only**; apply revalidates gates.

Meta line example: `src/lib/guests.ts:42 · ~12 lines · TS · apply: auto-safe`

### `auto-safe` allowlist

Tag `auto-safe` only when **all** hold:

- Proven unused import/export/variable/type **or** single-line dead assignment **or** obsolete
  comment with zero behavior change
- Zero new/changed call sites outside the staged path set
- Not an API/signature change (exported param, public helper arity, re-export surface)
- Not control-flow, test-behavior, or mock/spy lifecycle
- Not protected / MM-blocked

### Never `auto-safe` (deny list)

Use `needs-confirm`, or keep as LOW **without** implying apply will take it:

- Wrapper renames / thin `failGate`→`failOperator` indirection
- Unused params on **exported** functions (call-site cascade)
- Test spy restore / `afterEach` hygiene that can flake if wrong
- “Quiet mode”, UX copy, or operator-message tweaks
- Any fix that needs a non-staged neighbor edit

## Priorities

| Priority | Criteria |
| --- | --- |
| HIGH | Real bugs, security, regressions, **or** clearly safe cleanup with material impact |
| MEDIUM | Partial deletion, convention drift, maintainability debt |
| LOW | Cosmetic, AI-slop comments, tiny nits |

Every HIGH card includes **Clase:** `risk` | `cleanup`.

### Cleanup uplift

After checklists / classify, run a **cleanup uplift pass**:

- Any proven dead export/import/type with ≥3 removable lines, **or** any orphan file candidate,
  MUST be a HIGH card with `Clase: cleanup` — not buried as LOW.
- The verdict must not show `0 cleanup` when such findings exist (ops diffs may still be
  risk-heavy; cleanup cards still appear when material).

## MM

For staged paths that are also unstaged (MM):

1. Use **staged** content as the source of truth for the finding.
2. Mark `MM` on the meta line.
3. Apply-tag `needs-confirm` or `manual` — never `auto-safe` if the fix depends on unclean
   working-tree state.
4. State MM file count under Alcance.

## `~N` line estimate

Sum approximate removable lines from **cleanup-class** findings in HIGH+MEDIUM only (integers per
finding → one total). If none: `~0`.

## Checklists

### Simplification (priority)

- Unused imports, exports, variables, types
- Orphaned components / files with zero consumers
- Dead CSS selectors vs rendered class names (cross-check `.scss` against `.astro`/`.tsx`)
- Declared but unconsumed component props
- SSR vs client script contradictions (e.g. countdown overrides date text)
- Duplicate animation blocks that should share a mixin/placeholder
- Stale comments, commented-out blocks without TODO intent
- Dead conditionals (`true`/`false` guards)
- Redundant abstractions introduced by the staged change

### Risk (secondary, keep short)

- Client islands importing server-only code
- Non-serializable values passed from server/BFF to client without serialization
- Path casing (Vercel/Linux sensitive)
- Invented slug equality (`previewSlug` / `_assetSlug` / route slug can differ)
- Secrets or server env reaching client bundles

Also check naming and Celebra conventions when relevant (`@/*` in TSX, Spanish UI copy, English
identifiers, SCSS not Tailwind).

## Report template

```md
# Staged review

**Veredicto:** <H> HIGH (<R> risk · <C> cleanup) · <M> MEDIUM · <L> LOW · ~<N> líneas
**Alcance:** <files>, +Y/−Z — <one sentence>; MM: <count or 0>

## HIGH

### <Short symptom title>

`<path>:<line>` · ~<N> lines · <type> · apply: <tag> · [MM]

**Clase:** risk | cleanup
**Qué pasa:** ...
**Por qué importa:** ...
**Fix:** ...

## MEDIUM

… (same card shape; omit Clase)

## LOW

- `<path>:<line>` — short title · apply: <tag>

## Decisión

<CTA if all actionable findings are auto-safe; else one a/b/c MCQ>
```

Omit empty priority sections. Every expanded finding: file, line, issue, why, concrete fix, apply-tag.

**Decision rules:**

- All actionable findings `auto-safe`, none `needs-confirm` → CTA to run `staged-code-review-apply`.
- Any `needs-confirm`, mixed scope, or material MM → one MCQ (`a`/`b`/`c`); see contract (action +
  scope + brief example per option).
- When option `a` is “auto-safe only” (or equivalent), the lead sentence must state that **only
  allowlisted cleanups** will apply; `needs-confirm` / risk stay out unless the chosen option
  includes them.
- Manual / governance fix options: say **edit working tree and leave unstaged** — never “re-stage”,
  never ask the agent to `git add` / unstage. The user stages when they want to review the index.
- No duplicate end summary that repeats the verdict.
