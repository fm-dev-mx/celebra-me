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
`.agent/tmp/reports/2026-10-19-auditoria-post-migracion.md` (Integration checkout), measured on
`main` `dd758333c`. Finding ids (H*, P*) refer to that report.

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
| 11    | In progress | This plan lands with it                                     |
| 12–19 | Pending     | —                                                           |

Owner decisions: the `/privacidad` text needs only the owner's approval, no legal review; full
visual parity runs nightly on `develop` instead of on every pull request into `develop`. Questions 1
and 3 below are asked when phase C starts.

## Goal

1. Remove what only existed for Vercel or Cloudinary, and lock it out with a guard.
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

## Phase A: remove code with no risk

| PR                                                 | Removes or changes                                                                                                                                                                                                                                                                                                                                                                                           | Approx. lines | Protected by                                                                                              | Rollback                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------: | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **1. `chore/retire-cloudinary-demo-republish`**    | `scripts/provision/preview-demo-republish.ts`, `-cli.ts`, its test and the `invitation:preview-demo` script (H2). Unexport `SOCIAL_CARD` and `buildSocialCard`. **Precondition:** a read-only `invitation:media:verify` on the Preview demos shows 0 `res.cloudinary.com`                                                                                                                                    |          −760 | `tests/provision/*` still green; `production-image-audit` (Production has 285 R2 images and 0 Cloudinary) | revert                                                                    |
| **2. `chore/no-vercel-cloudinary-guard`**          | Add `validateNoVercelReferences` and the Cloudinary rule to `scripts/validate-structure.mjs` (H3). The allow-list covers `supabase/migrations/**`, `CHANGELOG.md`, the two migration plans and the guard tests (`layout-web-analytics`, `validate-structure-script`, `hostname-validation`). Run it in warn mode until PR 3 lands, then switch it to error                                                   |           +80 | Its own unit test in `tests/unit/validate-structure-script.test.ts`                                       | revert                                                                    |
| **3. `docs/retire-vercel-cloudinary-mentions`**    | Rewrite **`src/pages/privacidad.astro:55`** (Vercel → Cloudflare hosting and Web Analytics; copy approved by the owner) (H1). Rewrite `docs/env-workflow.md`, `performance-metrics.md`, `release-execution.md`, `architecture.md`, `payment-access-and-preview.md:98` (Vercel Firewall → AI Crawl Control) and the other `.md` files the guard flags. Clean `.env.example:17,31,39` (H4)                     |   −400 / +150 | The guard from PR 2 switches to error mode                                                                | revert                                                                    |
| **4. `chore/knip-unused-exports`**                 | Remove or unexport the 15 exports and 6 types that knip flags (H8). Delete the `cloudflare:*:dry-run` scripts (H9). Review the 32 docs-only scripts and delete the ones whose doc is also obsolete                                                                                                                                                                                                           |          −150 | `pnpm lint:dead-code`; after the PR, raise `exports`/`types` from `warn` to `error` in `knip.json`        | revert                                                                    |
| **5. `chore/sharp-dev-only`**                      | Move `sharp` to `devDependencies`. Keep `external: ['sharp']` only if the Worker build still needs it (H6). Drop the Vercel rules in `validate-deploy-identity-reads.mjs` (H12)                                                                                                                                                                                                                              |           ±10 | `workerd` tier + `pnpm build` + the wrangler log shows no `sharp`                                         | revert                                                                    |
| **6. `feat/db-contract-drop-cloudinary-provider`** | Contract migration: the provider check becomes `('supabase','r2')`; rename `invitation_assets_cloudinary_fields_complete` to `…_remote_fields_complete`; fix the column comments (H5). **Precondition:** 0 `provider='cloudinary'` rows in Preview and Production (guarded read). It ships through the migration flow, never in the same release as a newly published invitation                             |       +40 SQL | `supabase/tests/invitation_assets_*.test.sql` + DB contract job                                           | A forward migration that restores the old check (no destructive rollback) |
| **7. `docs/close-migration-plans`**                | Move what is durable from `cloudflare-workers-migration.md` and `vercel-cloudflare-closeout.md` into `docs/`, then delete both plans (H11). Owner items stay listed in the PR description: close the Vercel project, close Cloudinary after F9 + 30 days, remove the `*.vercel.app` URLs in Supabase Auth, delete local `.vercel/`; afterwards drop `.vercel` from `.gitignore` and `validate-structure.mjs` |        −1,100 | The guard from PR 2                                                                                       | revert                                                                    |

**First PR to do: PR 1.** It is the largest removal with the lowest risk, and its only precondition
is a read-only check.

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

## Open questions for the owner

1. Is QR check-in at arrival a planned feature? It does not exist today, and nothing tests it.
2. The new `/privacidad` text (PR 3): does it need legal review?
3. Can the twin presets `jewelry-box` / `jewelry-box-wedding` and `editorial` / `editorial-magazine`
   merge? This needs a token diff first.
4. Should full visual parity run nightly instead of on every PR (PR 11)?

## Expected result

- Code: about −2.5k lines in phase A, +1k test lines in phase B and −1.5k lines in phase C. After
  the legacy invitations expire, about −20k more SCSS lines.
- Vercel and Cloudinary mentions: 0 outside the allow-list, locked by a guard.
- CI: PR median under 6 min; Preview deploy of 3–4 min with real flow checks.
- Worker: about −1 MiB uploaded.
