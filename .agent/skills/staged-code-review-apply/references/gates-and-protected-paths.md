# Staged Code Review Apply — Gates and Protected Paths

Load when classifying or applying fixes. Keep out of routine human report prose (use human-readable
skip reasons instead of “Gate A/B/C”).

## Protected paths (never auto-modify / never auto-delete)

| Path                                             | Action                                 |
| ------------------------------------------------ | -------------------------------------- |
| `src/content/**`, `src/pages/**`, `public/**`    | Skip auto-delete; mention as protected |
| `src/layouts/**`                                 | Manual review only                     |
| `.agent/rules/**`, `.agent/briefs/**`, `docs/**` | Never auto-modify                      |
| `supabase/migrations/**`                         | Never touch                            |
| `.env*`, `*.env.local`                           | Never touch                            |

Before deleting any `.scss` file, search for `@use` / `@forward` consumers. If any exist, flag for
manual review instead of deleting.

## Gates (all three must pass for auto-apply)

### Gate A — Simplification (aggressive)

Pass if the fix removes dead code, deletes a dead file (+ cascade import cleanup), replaces
hardcodes with existing tokens, or reduces maintenance surface with **net line reduction**.

Fail if the fix grows the codebase, adds indirection, adds unused CSS variables, or is a pure
rename/restructure without removal.

### Gate B — Over-engineering (relaxed)

Reject only if the fix introduces **new** abstractions for hypothetical reuse: generic interfaces,
factories, registries, new packages, or single-use config systems. Consolidation and deletion are
allowed.

### Gate C — Safety

| Fix type                              | Action                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `.scss` / `.css`                      | Auto-apply when gates A/B pass                                                              |
| `.ts` / `.tsx` / `.js` / `.astro`     | Auto-apply for dead code / unused imports / deprecated exports; complex logic → flag        |
| `.json` content                       | Auto-apply duplicate/dead-field cleanup                                                     |
| `.agent/**`, `docs/**`                | Never auto-apply — flag                                                                     |
| SQL / migrations / production patches | Never auto-apply — flag                                                                     |
| Config / CI / Docker                  | Never auto-apply — flag                                                                     |
| Entire file deletion                  | See deletion rules in `SKILL.md`; else flag                                                 |

Final human-facing tags match review vocabulary: `auto-safe` · `needs-confirm` · `manual`
(not “manual-only”).

User pre-approval of a specific fix approach in this conversation satisfies Gate C's manual-review
ask for that finding (still run Gates A/B).
