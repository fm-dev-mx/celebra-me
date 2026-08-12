---
title: Invitation Contract Render-Parity Goal 2 Implementation
status: blocked
created: 2026-08-12
updated: 2026-08-12
type: implementation
autonomy: 3
related_docs:
  - .agent/plans/active/invitation-contract-render-parity-goal1-audit.md
  - docs/core/content-parity-rsvp-isolation.md
  - .agent/rules/invitation-production.md
---

# Goal 2 — Repair Persisted Invitation Contracts and Close P0 Render Regressions

**Lifecycle:** Implementation applied to Local (skip) and Preview (celestial P0). Production apply is owner-TTY only and has not been executed. Goal 3 must not treat Production as repaired until the owner apply below is verified.

**Authority:** `.agent/plans/active/invitation-contract-render-parity-goal1-audit.md` plus the Goal 2 task contract. Canonical persisted fields written:

```text
itinerary.variant = "timeline-paper"
itinerary.presentation.behavior = "timeline-paper"
gallery.variant = "index-choreography"   # celestial P0 only
```

`presentation.behavior` is required for the live Production runtime (`8569e3e3`). `itinerary.variant` is the HEAD durable field. Both were written together so current Production and HEAD resolve to `ItineraryProgram`.

P1 (Romina `split-cover`, Alba `split-map`, Abril gallery) was not touched.

---

## 0. Task Contract (projection)

| Field | Value |
| --- | --- |
| Objective | Persist the missing explicit structural contracts for the four P0 invitations and close the test blind spot that accepted schema-injected `standard` |
| Authorized | Local skip/repair; Preview mutation of celestial P0 slugs; author Production patch + dry-run lint; tests/fixtures; read-only Production probe. Not authorized: Production `--apply` (agent-rejected) |
| Scope | `xareni-iyarit`, `america-johana`, `ana-sofia-cota-guillen` (itinerary + gallery); `abril-michelle-becerra-rea` (itinerary only) |
| Non-goals | Restore `celestial-blue` renderer alias; slug-specific runtime branches; P1 promote; visual redesign; full managed package promote |
| Stop | Production remains unrepaired until owner `db:prod:patch --apply` |

HEAD at implementation: `286f072dae9dced0248029cff7463788a0c45c60` (`dev-local`). Same SHA as Goal 1.

---

## 1. Preflight (read-only, matches Goal 1)

No target contradicted Goal 1. None aborted.

| Invitation | Local | Preview | Production |
| --- | --- | --- | --- |
| xareni-iyarit | `behavior=timeline-paper`, `gallery=index-choreography` | omitted / omitted | omitted / omitted |
| america-johana | same as Xareni | omitted / omitted | omitted / omitted |
| ana-sofia-cota-guillen | same + leftover `sectionStyles.itinerary.variant=celestial-blue` | omitted + leftover `celestial-blue` styles | omitted + leftover `celestial-blue` styles |
| abril-michelle-becerra-rea | `itinerary.variant=timeline-paper`; gallery `paired-feature-band` (P1, ignored) | `behavior=timeline-paper`; gallery `uniform-grid` (P1, ignored) | `sectionStyles.itinerary.variant=timeline-paper` only; gallery `premiere-floral` (P1, ignored) |
| romina-rios-chaparro (control) | `itinerary.variant=standard` | `behavior=standard` | omitted → `standard` |

---

## 2. Mutation mechanism

These P0 consumers are **not** all managed definitions. Xareni / América / Ana Sofía are legacy corpus (`remoteParity: excluded`). Abril is managed, but a full `invitation:release` of the current definition would also promote P1 gallery `paired-feature-band`. Goal 2 forbids that.

| Environment | Mechanism | Why |
| --- | --- | --- |
| Local | **Skipped** | Already held the required contract. `invitation:local-corpus` would rewrite entire published JSON. |
| Preview celestial | Surgical `jsonb` merge on `published_invitation_content` (+ matching drafts if present), Preview write auth `CELEBRA_TASK_SCOPE=preview:<slug>:apply` | No managed release path for these slugs; no `db:preview:patch`. Same field merge as the Production patch. |
| Preview Abril | **Skipped** | Already `presentation.behavior=timeline-paper`. |
| Production | `pnpm db:prod:patch` file `scripts/manual/production-patches/20260812_p0_itinerary_gallery_structural_contracts.sql` | Canonical owner-authorized SQL repair for editor-native published JSON. Lint dry-run passed. `--apply` not executed (agent rejection / owner TTY). |

Fields changed per celestial row: `itinerary.variant`, `itinerary.presentation.behavior`, `gallery.variant`. Unrelated keys merged in place (`||`), including Ana Sofía `sectionStyles.itinerary.variant=celestial-blue`. Abril Production patch changes only the two itinerary fields.

Version: published `version = version + 1`, `published_at = now()`.

---

## 3. Before / after

### Preview (applied)

| Invitation | Before | After |
| --- | --- | --- |
| xareni-iyarit | itinerary omitted, gallery omitted | `variant=timeline-paper`, `behavior=timeline-paper`, `gallery=index-choreography` |
| america-johana | same | same repair |
| ana-sofia-cota-guillen | itinerary omitted, `sectionStyles=celestial-blue`, gallery omitted | same repair; `sectionStyles` preserved |
| abril-michelle-becerra-rea | already `behavior=timeline-paper` | unchanged |
| romina-rios-chaparro | `behavior=standard` | unchanged |

### Local (skipped)

Unchanged. HTML at `http://localhost:4321`:

| Invitation | `#itinerary` | `#galeria` | Renderer |
| --- | --- | --- | --- |
| xareni-iyarit | `data-structural-variant="timeline-paper"` | `index-choreography` | `itinerary__program` present |
| america-johana | `timeline-paper` | `index-choreography` | program |
| ana-sofia-cota-guillen | `timeline-paper` | `index-choreography` | program |
| abril-michelle-becerra-rea | `timeline-paper` | `paired-feature-band` (P1, not this repair) | program |
| romina-rios-chaparro | `standard` | `editorial-mosaic` | no program |

### Production (not mutated)

Still matches Goal 1. Live `www.celebra-me.com/xv/xareni-iyarit`: `data-variant="standard"`, `.itinerary__items-wrapper`, gallery `data-structural-variant="uniform-grid"`.

---

## 4. Tests and screenshots

### Tests (passed)

```text
pnpm exec jest tests/content/p0-structural-contract.test.ts \
  tests/content/xv-xareni-iyarit.test.ts \
  tests/content/canonical-corpus-contracts.test.ts \
  tests/unit/itinerary-adapter-contract.test.ts --no-coverage
# 4 suites, 22 tests, pass
```

Blind spot closed:

- `tests/fixtures/invitations/xv-xareni-iyarit-db-payload.json` now carries explicit `itinerary.presentation.behavior=timeline-paper` and `gallery.variant=index-choreography`.
- `tests/content/xv-xareni-iyarit.test.ts` asserts those raw fields **and** adapted `viewModel` variants.
- `tests/content/p0-structural-contract.test.ts` runs corpus/definition payloads through schema → `adaptDbEvent`/`adaptEvent` → renderer branch (`timeline-paper` ⇒ `ItineraryProgram`) → CSS entrypoints (`_timeline-paper`, `_index-choreography`).
- Same file locks Romina on `standard` / `TimelineList`, Abril itinerary on `ItineraryProgram` without requiring celestial gallery, and asserts `Itinerary.astro` still has no `celestial-blue` renderer alias.
- Omitted itinerary behavior still becomes `standard` (the post-`e86ced84` contract). Tests no longer pass by accepting that default on P0 consumers.

`pnpm db:prod:patch -- --dry-run --file scripts/manual/production-patches/20260812_p0_itinerary_gallery_structural_contracts.sql` passed lint. No database connection opened.

### Screenshots

`pnpm screenshot:invite` could not launch Playwright Chromium in this environment (missing browser binary). Visual verification used the Cursor browser against Local Xareni (`?skipEnvelope=true`):

- Itinerary shows the paper program cards (`ItineraryProgram`), not TimelineList.
- Gallery shows the celestial index-choreography feature layout, not `uniform-grid`.

Structural HTML dumps above are the reproducible renderer evidence for all four P0 slugs plus Romina.

---

## 5. Unrelated content preservation

- Merge used `jsonb ||` on the existing `itinerary` / `gallery` objects only.
- Ana Sofía leftover `sectionStyles.itinerary.variant=celestial-blue` kept.
- Abril gallery not written in any environment.
- Romina itinerary remained `standard`.
- Local published JSON not rewritten.
- No renderer fallback, theme alias, or slug-specific branch was added.

---

## 6. Skipped targets

| Target | Reason |
| --- | --- |
| Local all four | Already correct vs Goal 1 |
| Preview Abril itinerary | Already `presentation.behavior=timeline-paper` |
| Preview/Production Romina, Alba, Victoria, Daniela | Out of P0 scope |
| Production all four | Owner-only `db:prod:patch --apply`; agent must not execute it |

---

## 7. Final P0 status

| Invitation | Local | Preview | Production |
| --- | --- | --- | --- |
| xareni-iyarit | **OK** (pre-existing) | **OK** (applied) | **OPEN** — still omitted |
| america-johana | **OK** (pre-existing) | **OK** (applied) | **OPEN** — still omitted |
| ana-sofia-cota-guillen | **OK** (pre-existing) | **OK** (applied) | **OPEN** — still omitted |
| abril-michelle-becerra-rea | **OK** (pre-existing) | **OK** (pre-existing behavior) | **OPEN** — `sectionStyles` only |

---

## 8. Owner Production apply (required to finish Goal 2)

```powershell
pnpm db:prod:patch -- --dry-run --file scripts/manual/production-patches/20260812_p0_itinerary_gallery_structural_contracts.sql
pnpm db:prod:patch -- --apply --owner-user-id <PRODUCTION_OWNER_UUID> --file scripts/manual/production-patches/20260812_p0_itinerary_gallery_structural_contracts.sql
```

`--apply` requires interactive TTY (`PATCH <8-hex>`), Production project identity, and `pnpm release-check` evidence. After apply, re-probe:

```text
itinerary.variant = timeline-paper
itinerary.presentation.behavior = timeline-paper
gallery.variant = index-choreography   # not Abril
```

Live HTML must show `#itinerary[data-structural-variant=timeline-paper]` (or current Production `data-variant` once HEAD is deployed), `.itinerary__program-*`, and gallery `data-structural-variant=index-choreography`. Current Production code reads `presentation.behavior`; writing that field repairs the live site before HEAD is deployed.

---

## 9. Handoff to Goal 3

| Field | Value |
| --- | --- |
| Current state | Preview celestial P0 repaired. Tests/fixtures hardened. Production patch ready, not applied |
| Completed | Preflight; Preview apply for three celestial slugs; Local skip; fixture/test lock; Production SQL authored + linted; Local HTML + visual confirm of intended renderer |
| Validation passed | Jest 22/22 listed above; Production patch dry-run lint; three-env probe after Preview apply |
| Validation failed | `pnpm screenshot:invite` (Playwright Chromium missing) |
| Not run | Production `--apply`; full `pnpm test` / `pnpm run ci`; Preview hosted HTML (Preview DB repaired; hosted Preview app SHA may still be `8569e3e3` until deploy, but `presentation.behavior` is the live authority) |
| Residual risk | Production still ships TimelineList / uniform-grid until owner apply. Stale drafts republishing could revert Preview if a draft row was absent and a later editor publish omits the fields. CDN may cache Production HTML after apply until version/cache bust |
| Authorization | Preview apply used current-task Goal 2 grant + `CELEBRA_TASK_SCOPE=preview:<slug>:apply`. Production apply still requires owner TTY |
| Branch | `dev-local` @ `286f072d` plus uncommitted test/fixture/SQL files listed below |
| Next | Owner applies Production patch, then Goal 3 independent post-fix audit |

### Uncommitted implementation files

- `tests/fixtures/invitations/xv-xareni-iyarit-db-payload.json`
- `tests/content/xv-xareni-iyarit.test.ts`
- `tests/content/p0-structural-contract.test.ts`
- `scripts/manual/production-patches/20260812_p0_itinerary_gallery_structural_contracts.sql`

No Git writes were performed.
