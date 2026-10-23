---
name: invitation-visual-iteration
description: |
  Run owner feedback rounds on an invitation's look: capture only the touched sections at mobile and
  desktop, group the owner's comments into one round per commit, and clear the visual guards before
  each push.
domain: workflow
version: 1.0.0
when_to_use:
  - The owner reviews an invitation or demo and asks for visual changes
  - Polishing sections of an invitation before its first proposal or after a rejected one
  - A shadowing, matrix-hash or visual parity guard fails after a styling change
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
  - Read docs/core/invitation-creation-contract.md
inputs:
  - Invitation route (`/<eventType>/<slug>`) or demo slug
  - The owner's feedback for the round
outputs:
  - Before/after captures of the touched sections at mobile and desktop
  - One commit per feedback round
  - Guard results (shadowing, hash baseline, affected visual parity)
related_skills:
  - design-reference-to-build
  - invitation-rhythm
  - theme-architecture
related_docs:
  - docs/core/invitation-creation-contract.md
  - docs/domains/theme/css-visual-parity.md
  - docs/domains/theme/architecture.md
  - scripts/screenshot/README.md
---

# Invitation Visual Iteration

The creation contract owns what an invitation must satisfy; this skill only sets the loop for
changing its look in rounds. It grants no Preview or Production authority.

## 1. Scope the round

1. Collect every comment the owner sent for this round before editing. Classify each one with the
   `creative-qa-report` correction register: defect, missed brief criterion, or new preference.
2. Name the sections the round touches by their registered section IDs (`hero`, `gifts`, …). A
   comment that moves the whole narrative (tonal band, cadence) goes through `invitation-rhythm`
   first.
3. One round is one commit. Do not mix comments from a later round into an open one.

## 2. Capture before editing

Capture only the touched sections, at one mobile and one desktop viewport:

```sh
pnpm screenshot --url=/xv/america --sections=hero,gifts --viewport=mobile-standard,desktop --clean
```

Keep the captures outside the repository; they are evidence, not tracked files.

## 3. Edit in the owned layer

- Profile values go in `src/styles/invitation-profiles/<slug>.scss` as tokens; layout specific to
  the slug goes in its `composition.scss` (contract §4).
- A variant token carries the variant prefix and is scoped under `[data-variant='<variant>']`, never
  on the invitation wrapper, so other invitations that inherit the base token keep their look.
- A base default belongs in the `var()` fallback at the point of use, not as a declaration on the
  section selector.

## 4. Capture after and present

Re-run the same command. Show the owner before/after pairs of the touched sections only, grouped by
section, at most about six cropped pairs per round. Record the owner's outcome per comment; a clean
render alone is not acceptance.

## 5. Checklist before each commit

- [ ] Variant tokens carry the variant prefix and sit under `[data-variant]`.
- [ ] `pnpm exec jest tests/unit/invitation-token-shadowing.test.ts` passes. A failure names the
      published pages that would change; fix the scope instead of extending the baseline.
- [ ] `pnpm invitation:hash-baseline -- --strict` prints «packageHash de invitaciones activas sin
      cambios.» for every invitation outside the task.
- [ ] `pnpm validate:changed` passes.

## 6. Visual parity before each push

- Only this page's own files changed: compare just the affected pages against the accepted
  references.

  ```sh
  pnpm visual:parity:affected:certified -- --sha <commit> --base-sha <base commit>
  ```

  Name pages explicitly with `--pages america,demo-brisa` when needed.

- Shared SCSS, components or tooling changed: the affected command refuses to scope the run; produce
  the full candidate instead (`pnpm visual:parity:candidate:certified -- --sha <commit>`).
- Matrix hash drift (`visual-coverage-lifecycle` fails): the message prints the accepted and current
  hashes. Commit the lifecycle change, run the full candidate for that commit, get the owner's
  review, then run the accept command the message prints with `--matrix-hash=<current>` and commit
  the references ([CSS visual parity](../../../docs/domains/theme/css-visual-parity.md)).
