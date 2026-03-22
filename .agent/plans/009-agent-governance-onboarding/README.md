# Plan 009 — Agent Governance Onboarding

## Objective

Establish the `.agent/` governance system as a self-describing, repository-portable agent contract.
This includes the universal entrypoint, discovery index, structured metadata for all capabilities,
and documentation status alignment.

## Scope

- `.agent/README.md` — universal agent entrypoint with loading protocol, precedence, and fallback
  rules
- `.agent/index.md` — neutral discovery index for skills, workflows, and canonical docs
- `.agent/skills/*/SKILL.md` — structured metadata registration for all 10 skills
- `.agent/workflows/*.md` — structured metadata registration for all 5 workflows
- `docs/DOC_STATUS.md` — status alignment and governance rule updates

## Status

Archived on 2026-03-22 after retroactive plan capture and documentation inventory alignment.

## Commit Strategy

Three commit units, each mapping to a single dominant implementation intent:

| Unit                             | Phase | Intent                                 |
| :------------------------------- | :---- | :------------------------------------- |
| `establish-universal-entrypoint` | 01    | README restructure + index.md creation |
| `register-capability-metadata`   | 02    | Skills + workflows metadata            |
| `align-documentation-status`     | 03    | DOC_STATUS.md update                   |

## Constraints

- All code and internal documentation in English (already compliant)
- Spanish reserved for user-facing copy (no UI changes in this plan)
- No new units beyond what reduces real ambiguity
