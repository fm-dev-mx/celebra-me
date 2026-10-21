---
title: Lighter codebase, one invitation format, flow tests
status: active
created: 2026-10-19
updated: 2026-10-20
type: implementation
autonomy: 2
related_docs:
  - docs/core/invitation-creation-contract.md
  - docs/core/architecture.md
  - docs/core/validation-procedures.md
  - docs/env-workflow.md
  - .agent/rules/gatekeeper.md
---

# Lighter codebase, one invitation format, flow tests

Approved by the owner on 2026-10-20: run phases A, B and C in order, one pull request per row into
`develop`, merged when every check is green. The evidence lives in the point-in-time report
`2026-10-19-auditoria-post-migracion.md`, kept outside Git in the Integration checkout's ignored
reports folder (`.agent/tmp/reports/`), measured on `main` `dd758333c`. Finding ids (H*, P*) refer
to that report.

## Progress

| Row   | State       | Evidence                                                    |
| ----- | ----------- | ----------------------------------------------------------- |
| 1     | Done        | `c5ebacae3` on `develop`                                    |
| 2     | Done        | #329                                                        |
| 3     | Done        | #343                                                        |
| 4     | Done        | #330                                                        |
| 5     | Done        | #331                                                        |
| 6     | Done        | #347 (contract migration; ships through the migration flow) |
| 7     | Done        | #344                                                        |
| 8     | Done        | #332                                                        |
| 9     | Done        | #360                                                        |
| 10    | Done        | #333                                                        |
| 11    | Done        | #400                                                        |
| 12    | Done        | #402                                                        |
| 13–19 | Pending     | —                                                           |
| 20    | Done        | #406                                                        |
| 21    | Done        | #408                                                        |
| 22    | Done        | #410                                                        |
| 23    | Done        | #412                                                        |
| 24    | Done        | #413                                                        |
| 25    | In progress | This pull request                                           |

Owner decisions: the `/privacidad` text needs only the owner's approval, no legal review; full
visual parity runs nightly on `develop` instead of on every pull request into `develop`. Questions 1
and 3 below are asked when phase C starts.

## Goal

1. Remove what only existed for the retired hosting and image providers, and lock it out with a
   guard.
2. Add the missing flow tests, while keeping each PR under 6 minutes of CI.
3. Move invitations toward one format (contract vs theme) without changing any published
   `sourceHash`.

## Order and rules

- Small PRs to `develop`, one concern each. The order is: removals with no risk, then tests, then
  architecture.
- Every PR passes `pnpm validate:changed` → `pnpm type-check` → `pnpm run ci` (gatekeeper tiers).
- Rollback for any code-only PR is `git revert <merge>` on `develop`. Only PR 6 (database) and PR 9
  (deploy workflow) have a different rollback, written in their rows.
- Never touch published invitation definitions, legacy profiles frozen by digest, or `sourceHash`.

## Phase A: remove code with no risk (done)

Rows 1–7 removed the code, docs, package scripts, database check values and migration plans that
only served the retired hosting and image providers, and added the retired-provider guard in
`scripts/validate-structure.mjs` (`scripts/validate-retired-provider-references.mjs`). Pull requests
and commits are listed under Progress; their descriptions keep the detail.

## Phase B: missing tests (each PR stays under 6 min of CI)

| PR                                  | Adds                                                                                                                                                                                                                                                                                                                                                                                                                     | Approx. lines | Where it runs                                                              | Rollback                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------: | -------------------------------------------------------------------------- | ------------------------------------------------------ |
| **8. `test/cheap-flow-units`**      | P1: extend `style-scale-literals.test.ts` to invitation styles and presets, with their own baseline. P2: countdown with a fake clock. P3: the `wa.me` send link. P4: the QR URL matches the environment's memories route. P5: the `wrangler.jsonc` crons match `scheduled()`                                                                                                                                             |          +300 | Every PR (+≈ 10 s)                                                         | revert                                                 |
| **9. `ci/post-deploy-flow-checks`** | P8: an invitation probe that checks content, one per event type. P9: a synthetic RSVP on Preview, with cleanup. P10: `authenticated-preview.spec.ts` after the Preview smoke. P11: `canary:memories` after the Production upload, before traffic moves                                                                                                                                                                   |          +250 | `deploy.yml` / `deploy-production.yml` (+1–2 min per deploy, 0 per PR)     | Revert the workflow; the deploy works as it did before |
| **10. `ci/scheduled-monitors`**     | P12: cleanup-cron heartbeat and offsite-backup freshness, next to `production-uptime`                                                                                                                                                                                                                                                                                                                                    |          +150 | Schedule                                                                   | revert                                                 |
| **11. `ci/pr-under-six-minutes`**   | Build `build:app` once and share it between `static` and `workerd`. Full visual parity moves to nightly on `develop` and to develop → main PRs without reused evidence. Memories E2E runs only when memories paths change. P6: add `rsvp-v2.e2e.test.ts` to `test:e2e:ci`. P7: music play/pause. P14: sort the orphan specs into CI, nightly or delete (H10). Coordinate with the in-flight `perf/ci-browser-split` work |          ±200 | Measure the PR median before and after with `gh run list` (target < 6 min) | revert                                                 |
| **12. `test/guest-import-e2e`**     | P13: guest import end to end, as a nightly spec                                                                                                                                                                                                                                                                                                                                                                          |          +150 | Nightly                                                                    | revert                                                 |

## Phase C: invitation architecture

Rule for every PR in this phase: the published `sourceHash` of every real invitation stays
byte-identical. Prove it with `pnpm invitation:hash-baseline` before and after.

| PR                                          | Change                                                                                                                                                                                                                                                                                 | Approx. lines | Protected by                                                                                | Rollback                         |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------: | ------------------------------------------------------------------------------------------- | -------------------------------- |
| **13. `refactor/preset-metadata-table`**    | One preset metadata table that replaces `THEME_PRESETS`, `PORTRAIT_SUPPORTED_THEMES` and the preset lists in `event-type-contract.ts`. Generate the `invitation-presets/` shims and the `invitation-sections-by-preset/` bundles from it, then delete both directories                 |          −250 | `style-boundaries.test.ts`, CSS parity (`screenshot:css-parity`), visual baselines          | revert                           |
| **14. `refactor/worker-bundle-diet`**       | Keep `@zip.js/zip.js` (memories export, client code) out of the server chunk, and check why `InvitationDeferredCssPromotion` ships 703 KiB inside the Worker (H7). Target: −1 MiB uploaded                                                                                             |          ±100 | `workerd` tier, the wrangler size in the deploy log, invitation visual baselines            | revert                           |
| **15. `refactor/drop-db-event-adapter`**    | `adaptEvent` receives the document directly; delete `db-event-adapter.ts`. Make the static fallback explicit: demos, or no DB configured                                                                                                                                               |           −60 | `invitation-route-personalization`, `canonical-invitation-page-parity`, demo routing parity | revert                           |
| **16. `feat/invitation-document-demos`**    | Introduce `InvitationDocument` (one directory per invitation: `invitation.ts`, an optional token-only `profile.scss`, an asset manifest). Migrate the 7 demos first: they carry no client hash. `demo-showroom.data.ts` gets absorbed. The `event-demos` collection reads the new tree |          ±600 | Demo routing parity, `premium-demo-quality-gate`, visual baselines of the demos             | revert                           |
| **17. `feat/invitation-document-new-only`** | New real invitations use `InvitationDocument`. `registry.ts` is generated by glob. The 13 legacy definitions stay frozen                                                                                                                                                               |          ±300 | `invitation-profile-boundary` digests unchanged, `hash-baseline`                            | revert                           |
| **18. `refactor/r2-only-runtime-assets`**   | Once Production has no `supabase` rows outside Local, `provider` stops being a branch in `asset-delivery.ts`, `storage-provider.ts` and `remote-media-hosting.ts`. Binaries move from `src/assets/invitations/` (62 MB) to R2 with a hash manifest                                     |  −400, −62 MB | `image-delivery-contract.spec`, `production-image-audit`                                    | revert, plus keep the R2 objects |
| **19. `refactor/drop-location-compat`**     | Remove `normalizeLegacyLocationInContent` and `location-presentation-compatibility.ts`, after a contract release that migrates the published data                                                                                                                                      |          −200 | Contract tests + a published-content audit                                                  | A forward fix                    |

The 13 legacy definitions and their profiles (≈ 20k SCSS lines) are not migrated. Each one leaves
when its invitation expires (the first on 2027-02-21; `sacred-keepsake` on 2027-06-20) in a deletion
PR: definition, profile, assets and digest together.

## Phase D: cleanup and invitation standards

Added by the owner on 2026-10-20 after an audit of `develop` `e490a2fae`: what is left to remove is
small. Rows 20–24 run after row 12 and before phase C; row 25 follows them.

| PR                                  | Change                                                                                                                                                                                                                                                                                                      | Protected by                                                        | Rollback |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------- |
| **20. `chore/drop-unused-exports`** | Unexport the symbols knip reports, delete the dead static-assets binding module, the `lint:styles:changed` and `invitation:media:variants` scripts, and the archived-plans validator (that directory no longer exists). The three `worker:memories:dry-run:*` scripts stay as manual tools (owner decision) | `pnpm lint:dead-code` with no unused exports, unit tests, `workerd` | revert   |
| **21. `chore/remove-dead-scss`**    | Unused mixins, functions and dashboard classes. Classes under `themes/sections/*` only with `invitation:hash-baseline` unchanged and a clean visual diff                                                                                                                                                    | `hash-baseline`, visual baselines                                   | revert   |
| **22. `refactor/dedupe-clones`**    | Copied blocks of 15 or more lines in TypeScript and dashboard SCSS (jscpd). Preset clones wait for row 13                                                                                                                                                                                                   | Unit tests, visual baselines                                        | revert   |
| **23. `docs/align-with-code`**      | Fix docs, skills and templates that name files or behavior the code no longer has; delete finished plans. No invitation note is deleted; `naydelin-paredes.md` is reduced to its delivered state                                                                                                            | `validate:structure`, `validate:invitation-preparation`             | revert   |
| **24. `docs/merge-duplicates`**     | Merge duplicated database, release-tag and rule docs and the two Supabase skills into one owner each                                                                                                                                                                                                        | `validate:structure` (links and ownership)                          | revert   |
| **25. `docs/invitation-standards`** | One standards document with "Repeat" and "Avoid" lists (example invitation, date, evidence), a retro step before an invitation note leaves, and a guard that fails a pull request deleting a note without its standards entry. The aesthetic brief reads the standards first                                | A unit test for the guard                                           | revert   |

Invitation notes (`docs/invitations/<slug>.md`) stay while their invitation is online: some tests
read them. About a month after the event, a retro records what worked, what looks dated or generic
and what took the most review rounds; the note leaves with the invitation's definition, profile and
assets when it expires.

## Open questions for the owner

1. Is QR check-in at arrival a planned feature? It does not exist today, and nothing tests it.
2. The new `/privacidad` text (PR 3): does it need legal review?
3. Can the twin presets `jewelry-box` / `jewelry-box-wedding` and `editorial` / `editorial-magazine`
   merge? This needs a token diff first.
4. Should full visual parity run nightly instead of on every PR (PR 11)?

## Expected result

- Code: about −2.5k lines in phase A, +1k test lines in phase B and −1.5k lines in phase C. After
  the legacy invitations expire, about −20k more SCSS lines.
- Retired provider mentions: 0 outside the allow-list, locked by a guard.
- CI: PR median under 6 min; Preview deploy of 3–4 min with real flow checks.
- Worker: about −1 MiB uploaded.
