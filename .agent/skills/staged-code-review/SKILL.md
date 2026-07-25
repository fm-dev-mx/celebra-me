---
name: staged-code-review
description: |
  Analyze staged git changes with a simplification-first mindset. Find dead code, redundant
  abstractions, orphaned files, and removable surface; secondarily catch bugs and anti-patterns.
  Read-only — no edits, staging, or commits.
domain: quality
version: 1.0.0
when_to_use:
  - User asks to review staged changes before committing
  - User asks to analyze staged work for over-engineering or dead code
  - Phrases like "revisa lo staged", "analiza lo staged", or "staged code review"
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
  - Read .agent/rules/git-safety.md
  - Staged changes exist (`git diff --cached` non-empty)
related_skills:
  - staged-code-review-apply
  - commit-planner
  - celebra-delegation-patterns
related_docs:
  - docs/core/git-governance.md
  - docs/core/project-conventions.md
---

# Staged Code Review

Analyze files currently staged in git with a **simplification-first** mindset. Every staged change
is an opportunity to remove dead imports, unused exports, orphaned components, redundant
abstractions, and stale comments the change touches but does not clean up.

**Primary mission:** find what can be safely deleted or simplified.  
**Secondary mission:** catch bugs, regressions, and anti-patterns.

Produces a structured, actionable plan only. No code changes. No commits. No staging changes.

## Preconditions

1. Confirm a git repository at the working directory.
2. Run `git diff --cached --stat` and `git diff --cached`.
3. If nothing is staged, stop and tell the user to stage first. Do **not** analyze unstaged-only
   work.
4. Do not run this skill autonomously — only when the user asked for staged analysis/review.

## Mode selection

| Condition               | Mode                                                                             |
| ----------------------- | -------------------------------------------------------------------------------- |
| ≤20 files AND ≤25K diff | Sequential (one agent)                                                           |
| >20 files OR >25K diff  | Parallel groups if the runtime supports subagents; otherwise sequential per-file |

For parallel work, follow [`celebra-delegation-patterns`](../celebra-delegation-patterns/SKILL.md).
Do not assume Hermes `delegate_task` or `/skill` APIs.

**Independent groups** (same wave when parallel):

| Group                             | File types                                                         | Focus                                                                                |
| --------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| A — Components, styles, templates | `.astro`, `.tsx`, `.jsx`, `.scss`, `.css`, layouts, theme partials | Prop surface, SSR/CSR consistency, import hygiene, selector vs template, token drift |
| B — Scripts, utilities, tests     | tooling `.ts`/`.js`, configs, `*.test.ts`, `*.spec.ts`             | Over-engineering, brittle tests, hardcoded paths, redundant abstractions             |
| C — Content data                  | content JSON, YAML/TOML config                                     | Duplicate keys, dead fields, format inconsistencies                                  |

After groups finish, consolidate: dedupe, re-prioritize globally, cross-check content fields against
adapters/viewmodels. Optional false-positive filter when ≥10 findings.

## Sequential analysis

For each staged file:

1. Read the full file (diff alone misses context).
2. Check naming, pattern consistency with neighbors, and Celebra conventions (`@/*` in TSX, Spanish
   UI copy, English identifiers, SCSS not Tailwind, Astro server/client boundaries).
3. Prefer deletion opportunities before improvement suggestions.

### Simplification checklist (priority)

- Unused imports, exports, variables, types
- Orphaned components / files with zero consumers
- Dead CSS selectors vs rendered class names (cross-check `.scss` against `.astro`/`.tsx`)
- Declared but unconsumed component props
- SSR vs client script contradictions (e.g. countdown overrides date text)
- Duplicate animation blocks that should share a mixin/placeholder
- Stale comments, commented-out blocks without TODO intent
- Dead conditionals (`true`/`false` guards)
- Redundant abstractions introduced by the staged change

### Celebra-specific checks

- Client islands must not import server-only code
- Path casing (Vercel/Linux sensitive)
- Do not invent slug equality (`previewSlug` / `_assetSlug` / route slug can differ)
- Governance paths (`.agent/rules/**`, `docs/**`) are findings only — never propose auto-edit here
  as required; flag for human review in apply

## Priorities

| Priority | Criteria                                                                 |
| -------- | ------------------------------------------------------------------------ |
| HIGH     | Safe dead-code removal; orphaned files; real bugs; security; regressions |
| MEDIUM   | Partial deletion; convention drift; maintainability debt                 |
| LOW      | Cosmetic naming; AI-slop comments; tiny cleanups                         |

## Report format

```md
# Staged Change Analysis — celebra-me

## Summary

<X files, +Y/−Z — brief characterization>

## HIGH Priority

### 1. `path/file.ts:line` — Short title

**Issue:** ... **Why it matters:** ... **Fix:** actionable change (code or steps) **Estimated line
reduction:** ~N (if deletion)

---

## MEDIUM Priority

...

## LOW Priority

...

## Summary of Recommendations

- High: <count>
- Medium: <count>
- Low: <count>
- Potential line reduction: ~N

**Next step:** Load `staged-code-review-apply` after the user approves proceeding.
```

Every finding must include file, line, issue, why it matters, and a concrete fix.

## Hard constraints

- Read-only: no edits, no stash, no stage/unstage, no commit.
- Do not run lint/test/build unless the user asks.
- If staged + unstaged (MM) files exist, prefer staged content and note MM risk for false positives.
- Language: respond in the same language as the user request.
