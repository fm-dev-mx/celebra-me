# Staged Code Review Apply — Parallel Mode

Load only when apply volume exceeds the sequential thresholds in `SKILL.md`. Prefer sequential
otherwise. Follow [`celebra-delegation-patterns`](../../celebra-delegation-patterns/SKILL.md) when
the runtime supports subagents; otherwise apply sequentially. Do not assume provider-specific
delegation APIs.

## Thresholds

| Condition                      | Mode                                                           |
| ------------------------------ | -------------------------------------------------------------- |
| <6 findings or all in ≤2 files | Sequential — do not use this reference                         |
| ≥6 findings across ≥3 files    | Parallel validation/apply groups if runtime supports subagents |

## Guidance

- Keep co-dependent edits (e.g. delete file + cascade import cleanup) in the same agent.
- Revalidate gates per finding before edit; do not trust review tags as a bypass.
- Consolidate one deletion manifest and at most one pre-apply MCQ before any parallel apply wave.
- After parallel work: merge Applied / Omitido / Manual lists; single verify pass; one final report.
