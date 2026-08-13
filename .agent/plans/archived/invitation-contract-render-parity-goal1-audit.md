---
title: Invitation Contract and Render-Parity Audit
status: final
created: 2026-08-12
updated: 2026-08-12
type: diagnostic
autonomy: 0
related_docs:
  - docs/domains/theme/variant-system.md
  - docs/domains/content/section-contracts.md
  - docs/core/content-parity-rsvp-isolation.md
---

# Goal 1 — Systemic Invitation Contract & Render-Parity Audit

**Lifecycle:** Goal 1 complete. Goal 2 must not start until the owner accepts this report. No `UNKNOWN_HUMAN_REVIEW` finding blocks the P0 itinerary/gallery correction.

**Mode:** read-only. No code, database, fixture, Preview, or Production mutations were performed.

**Reference failure pattern (not audit scope):** XV Xareni Iyarit itinerary rendered `ItineraryProgram` when `theme.preset=celestial-blue` implied the renderer, then rendered `TimelineList` / `standard` after that implication was removed and persisted Production content was not given an explicit structural value.

---

## 0. Task Contract (projection)

| Field | Value |
| --- | --- |
| Objective | Detect incomplete-migration regressions across persisted content → schema/canonicalization → adapter → resolver → renderer → CSS/profile |
| Authorized | Read-only inspection of git, definitions, fixtures, demos, Local/Preview/Production published JSON, and public Production HTML |
| Scope | Contract/render changes from Vercel `dpl_FxHFSPHCVVJXLUrLdvvsc94xH6FU` / `6f3c46bf` through `HEAD` `286f072d`. All five managed definitions plus corpus invitations sharing those contracts |
| Non-goals | Restoring theme-as-renderer aliases; slug-specific compatibility; Goal 2 implementation; visual redesign |
| Invariants | No writes. Fixture parity ≠ runtime parity. Appearance alone is not a regression. Do not treat removed legacy behavior as defective unless a legitimate consumer still depends on it |
| Stop | Goal 2 must not begin from this document until the owner accepts it |

### Identity of the audited range

| Ref | SHA / ID | Role |
| --- | --- | --- |
| Known-good Xareni Production deploy | `dpl_FxHFSPHCVVJXLUrLdvvsc94xH6FU` / `6f3c46bf5ba8f4df600647dce8277ff240001e42` (2026-07-30, `main`) | Xareni visual/renderer reference only — not universal truth |
| Current Production deploy | `dpl_4XvaLEeHCrwByQ3nkvCZjfg1XZ8L` / `8569e3e3b2f9ed67ffedfd2e734b7289cb69bca1` | Live `www.celebra-me.com` at audit time |
| Audit `HEAD` | `286f072dae9dced0248029cff7463788a0c45c60` | Local worktree; includes `45d4a731` + `91e42862` + `5af325b6` not yet in Production |

The known-good deployment HTML could not be re-fetched (Vercel SSO on the stale alias). Expected Xareni itinerary renderer is established from `Itinerary.astro` at `6f3c46bf` (`variant === 'timeline-paper' \|\| variant === 'celestial-blue'` → `ItineraryProgram`) plus persisted `theme.preset: celestial-blue`. That is sufficient; it does not change the P0 correction.

---

## 1. Runtime path (HEAD)

```text
published JSON / Astro collection
  → eventContentSchema.transform
      → normalizeInvitationVariantInput (silent fallbacks)
      → canonicalEventContentSchema
  → adaptEvent / adaptDbEvent
  → section render descriptors
  → Itinerary.astro / Gallery.astro / Hero.astro / …
  → resolveInvitationCssUrls (structural partials + preset bundle + profile)
```

Authoritative itinerary renderer at HEAD: `itinerary.variant`. `Itinerary.astro` selects `ItineraryProgram` only when `variant === 'timeline-paper'`; `standard` and `editorial-ledger` use `TimelineList`. Structural CSS loads only for `timeline-paper` and `editorial-ledger`.

At current Production (`8569e3e3`), the adapter comment is explicit: canonical authority is `itinerary.presentation.behavior` only; `sectionStyles.itinerary.variant` is not consulted. `resolveItineraryPresentation()` defaults omitted behavior to `'standard'`.

---

## 2. Findings table

Grouped by systemic cause. “Expected” is the justified contract, not “whatever Production currently shows.”

| Invitation | Section | Expected | Actual | Source / Environment | Root Cause | First Bad Commit / Range | Classification | Severity | Recommended Fix Owner |
|---|---|---|---|---|---|---|---|---|---|
| xareni-iyarit (legacy corpus; Production client) | Itinerary | `ItineraryProgram` / `timeline-paper` (known-good `celestial-blue` renderer; Local + corpus fixture `presentation.behavior: timeline-paper`) | Production HTML: `data-variant="standard"` + `.itinerary__items-wrapper`; no `.itinerary__program-*`. Production JSON: no `itinerary.variant`, no `presentation.behavior`, no `sectionStyles.itinerary.variant` | Production HTML `www.celebra-me.com/xv/xareni-iyarit`; Production `published_invitation_content`; Local JSON has `presentation.behavior: timeline-paper` | Theme-implied renderer removed; persisted Production never received explicit behavior; silent fallback `standard` | `e86ced849a142372aaff5c19da1e1c77eaa3be57` | `CONFIRMED_REGRESSION` | P0 | **persisted data** (Production, and Preview which matches Production). Fixture/test follow-through below. Not a slug-specific code fork |
| america-johana | Itinerary | Same as Xareni (`celestial-blue` → `ItineraryProgram`; Local/fixture `timeline-paper`) | Production HTML TimelineList `standard`. Production JSON: no itinerary structural fields | Production HTML `/xv/america-johana`; Production + Preview JSON | Same as Xareni | `e86ced84` | `CONFIRMED_REGRESSION` | P0 | **persisted data** |
| ana-sofia-cota-guillen | Itinerary | `timeline-paper` / `ItineraryProgram` (corpus fixture + `canonical-corpus-contracts` lock; known-good theme `celestial-blue`) | Production HTML TimelineList `standard`. Production/Preview JSON: `sectionStyles.itinerary.variant: celestial-blue` only (theme name, ignored). Local JSON has `presentation.behavior: timeline-paper` | Production HTML `/xv/ana-sofia-cota-guillen`; Local vs Production JSON | Theme-named `sectionStyles` is no longer itinerary authority; Local fixture migrated, Production did not | `e86ced84` | `CONFIRMED_REGRESSION` | P0 | **persisted data** (Production/Preview). Local already correct |
| abril-michelle-becerra-rea (managed, published) | Itinerary | `timeline-paper` / `ItineraryProgram` (definition at `8569e3e3` already has `presentation.behavior: timeline-paper`; Abril profile SCSS targets `.itinerary__program-*`; e2e `abril-audit.spec.ts`) | Production HTML TimelineList `standard`. Production JSON: `sectionStyles.itinerary.variant: timeline-paper` only — **no** `presentation.behavior`. Preview JSON **has** `presentation.behavior: timeline-paper`. Local JSON has canonical `itinerary.variant: timeline-paper` | Production HTML `/xv/abril-michelle-becerra-rea`; three-env JSON | Production code (`8569e3e3`) ignores `sectionStyles` entirely. Preview/Local were migrated; Production was not. HEAD normalizer **would** map structural `sectionStyles.itinerary.variant=timeline-paper` → `itinerary.variant` | `e86ced84` (ignore `sectionStyles`); content gap vs Preview | `CONFIRMED_REGRESSION` | P0 | **persisted data** (Production canonical `itinerary.variant`). Deploying HEAD without a backfill would incidentally restore Abril via legacy `sectionStyles`; still persist the canonical field so a later alias retirement cannot regress it |
| xareni-iyarit | Gallery | Celestial index choreography (`index-choreography` CSS on `data-structural-variant`). Local JSON already `gallery.variant: index-choreography`. Known-good used theme `celestial-blue` as gallery identity | Production HTML: `data-variant="celestial-blue"` + `data-structural-variant="uniform-grid"`. `_index-choreography.scss` never matches. Production JSON: `gallery.variant` omitted | Production HTML; Production JSON vs Local JSON | `resolveGalleryLayoutVariant` at `8569e3e3` returns `uniform-grid` unless the value is already a layout id. Theme names / omitted values are not layouts. Choreography CSS is layout-entrypoint-only | `e86ced84` (theme no longer structural); gallery CSS split `0066f784` | `CONFIRMED_REGRESSION` | P0 | **persisted data** for Production/Preview (`gallery.variant: index-choreography`). HEAD omitted-variant theme map would also restore Xareni; do not rely on that as the durable contract |
| america-johana | Gallery | `index-choreography` (Local JSON; same celestial path) | Production JSON omitted `gallery.variant`; same Production-code `uniform-grid` path as Xareni | Production + Preview JSON; Local JSON `index-choreography` | Same gallery fallback | `e86ced84` | `CONFIRMED_REGRESSION` | P0 | **persisted data** |
| ana-sofia-cota-guillen | Gallery | `index-choreography` (Local JSON) | Production/Preview omitted `gallery.variant` | Three-env JSON | Same gallery fallback | `e86ced84` | `CONFIRMED_REGRESSION` | P0 | **persisted data** |
| abril-michelle-becerra-rea | Gallery | At current Production code: premiere-floral mosaic skin as layout, not `uniform-grid`. At HEAD definition: `paired-feature-band` (intentional later layout, Local only) | Production HTML `data-structural-variant="uniform-grid"` with `data-variant="premiere-floral"`. Production JSON `gallery.variant: premiere-floral` (theme name). Preview JSON `uniform-grid`. Local JSON `paired-feature-band` | Production HTML; three-env JSON vs `abril-michelle-becerra-rea.ts` | Theme-named `gallery.variant` is not a layout id on Production code. HEAD would map `premiere-floral` → `editorial-mosaic`, which is still not `paired-feature-band` | `e86ced84` for uniform-grid; `5af325b6` for definition vs Preview/Prod | `CONFIRMED_REGRESSION` (uniform-grid vs theme mosaic) + `MIGRATION_GAP` (Local `paired-feature-band` not in Preview/Prod) | P1 | **persisted data** for Production/Preview. Promote `paired-feature-band` only via managed release after the uniform-grid regression is closed — do not treat the new Local layout as Production expected until promoted |
| romina-rios-chaparro (managed, published) | Gallery | HEAD/Local canonical `editorial-mosaic`. Known-good predates that layout id; Production/Preview still `uniform-grid` | Production HTML `uniform-grid`. Preview JSON `uniform-grid`. Local JSON `editorial-mosaic` | Production HTML `/xv/romina-rios-chaparro`; three-env JSON | Same theme→layout gap; Romina Production JSON omits `gallery.variant` | `e86ced84` + unpromoted Local definition | `MIGRATION_GAP` (and Production visual likely flatter than premiere-floral mosaic) | P1 | **persisted data** / managed promote. Confirm whether Production should receive `editorial-mosaic` in the same release as itinerary P0 |
| romina-rios-chaparro | Hero | Canonical + Preview + tests: `split-cover`. Known-good deploy predates `split-cover` | Production HTML `data-structural-variant="standard"`. Production JSON omits hero variant. Preview JSON `hero.structuralVariant: split-cover`. Local JSON `hero.variant: split-cover` | Production HTML; Preview vs Production JSON; `canonical-corpus-contracts.test.ts` | Definition/Preview migrated; Production published content did not | `0eb8ccc2` (introduce split-cover) through unpromoted Production | `PERSISTED_CONTENT_DIVERGENCE` | P1 | **persisted data** (Production promote). Not a Xareni-known-good regression |
| romina-rios-chaparro | Itinerary | `standard` / `TimelineList` (definition + tests) | Production/Local/Preview `standard` | All three envs | None — legitimate `standard` | — | `INTENTIONAL_CHANGE` / no defect | — | none |
| alba-rosa-quinonez (managed, published) | Location | Canonical + Local + Preview: `split-map` | Production JSON omits `location.variant` / `structuralVariant` → HEAD/Production fallback `standard`. Preview JSON `location.structuralVariant: split-map` | Three-env JSON | Preview/Local migrated; Production did not | `36e63b06` / `0eb8ccc2` through unpromoted Production | `PERSISTED_CONTENT_DIVERGENCE` | P1 | **persisted data** (Production promote) |
| alba-rosa-quinonez | Gallery | HEAD/Local: `feature-stack`. Preview: `feature-mosaic`. Production omitted → HEAD theme map `luxury-hacienda` → `feature-mosaic` | Local already `feature-stack`; Preview `feature-mosaic`; Production omitted | Three-env JSON; `5af325b6` | Local portable-layout migrate not promoted | `5af325b6` | `MIGRATION_GAP` | P2 | **persisted data** after P0. Preview still on pre-`feature-stack` contract |
| alba-rosa-quinonez | Hero / Thank You / Countdown | Structural `standard` + profile-owned luxury-hacienda / editorial-magazine visual (`sectionStyles.thankYou.variant`, days-only countdown). Tests lock this split | Matches definition. Profile still owns hero geometry under `data-variant='luxury-hacienda'` | Definition + `alba-rosa-quinonez.scss` + payload tests | Dual visual/structural channel left in place | `45d4a731` (not cleaned in `5af325b6`) | `LEGACY_COMPATIBILITY_RESIDUE` | P3 | **code** only if Goal 2 is authorized to finish encapsulation; not required to fix P0 |
| victoria-y-roberto (managed, `in_progress`) | Itinerary / Family / Location | HEAD/Local: `editorial-ledger`, `asymmetric-groups`, `stacked-venue-plates` | Production JSON: `itinerary.presentation.behavior: standard`, `family.structuralVariant: split-groups`, `location.structuralVariant: standard`. Local matches HEAD definition | Local vs Production JSON | Intentional Local portable-layout work not in Production; Victoria is `in_progress` | `91e42862` / `5af325b6` | `INTENTIONAL_CHANGE` | — | none for P0. Do not treat Production `standard` as a celestial-blue regression |
| daniela-y-martin (managed, `in_progress`) | Location / Family / Gallery | HEAD/Local: `stacked-venue-plates`, `split-groups`, `single-keepsake` | Production JSON: all structural fields omitted. Local matches HEAD | Local vs Production | `in_progress` row present in Production with pre-canonical payload | `5af325b6` | `INTENTIONAL_CHANGE` + lifecycle `UNKNOWN_HUMAN_REVIEW` (why an `in_progress` invitation is in Production) | — | none for P0. Lifecycle question does not change itinerary backfill |
| leah-lexa | Itinerary | Corpus fixture `presentation.behavior: timeline-paper` but `items: []` | Production HTML has no `.itinerary` section. Local/Preview/Production JSON omit itinerary behavior | Fixture vs persisted JSON vs Production HTML | Empty itinerary + unmigrated persisted row. No evidence of a visible known-good program renderer | `481dffe5` (fixture only) | `MIGRATION_GAP` (fixture-only) | P3 | **fixture/baseline** if Leah should keep an empty program contract; not a Production visual P0 |
| leah-lexa | Gallery | Fixture/persisted `gallery.variant: single` → HEAD alias `single-keepsake` | Production/Preview/Local JSON `single`. Runtime alias works at HEAD | Three-env JSON | Legacy alias still in persisted content | documented alias | `LEGACY_COMPATIBILITY_RESIDUE` | P3 | **persisted data** when retiring `single` |
| valentina-hernandez | Hero / Gifts / RSVP / Thank You | Editorial-magazine theme fallbacks (`editorial-cover`, `editorial-catalog`, `editorial-press-pass`, `editorial-back-cover`) | Production/Local `hero.variant: editorial-magazine` (theme name). Itinerary omitted → `standard`, which matches Valentina profile TimelineList selectors | Three-env JSON; profile SCSS | Theme-as-variant still accepted by normalizer; itinerary `standard` is the correct renderer for this invitation | `481dffe5` / `45d4a731` | `LEGACY_COMPATIBILITY_RESIDUE` (payload shape) — not an itinerary regression | P3 | **fixture/persisted data** to canonical field names; do not change itinerary renderer |
| luna-y-estrella, cesar-ramses, ayrin-samantha-lerma-castro | Gallery | Unknown: themes `angelic-presence` / `sacred-keepsake` / `enchanted-rose` are **not** in `LEGACY_GALLERY_THEME_LAYOUTS`, so omitted `gallery.variant` → `uniform-grid` | Production/Local/Preview omit gallery layout | Three-env JSON | Unmapped theme galleries have no HEAD restoration path | `e86ced84` | `UNKNOWN_HUMAN_REVIEW` | P2 | Human: compare known-good theme gallery vs `uniform-grid`. Does **not** block P0 itinerary |
| ximena-meza-trasvina, gerardo-sesenta | Gallery | HEAD theme map would yield `editorial-mosaic` / `feature-mosaic` if variant omitted | Persisted JSON omits `gallery.variant` | Three-env JSON | Same omitted-layout class; mapped themes | `e86ced84` | `MIGRATION_GAP` | P2 | **persisted data** after P0, or HEAD theme fallback if those rows are deployed on HEAD |
| demo-xv-celestial-blue | Itinerary | JSON `variant: timeline-paper`; demo SCSS animates `.itinerary__program-*` | Demo file is explicit. Not a persisted-Production consumer | `src/content/event-demos/xv/demo-xv-celestial-blue.json` | Demo migrated; Production clients were not | `481dffe5` / `45d4a731` | `INTENTIONAL_CHANGE` (demo) vs `CONFIRMED_REGRESSION` (clients) | — | none for demo |
| tests/fixtures/invitations/xv-xareni-iyarit-db-payload.json | Itinerary | Should represent the Production/DB payload that renders `timeline-paper` | Omits `variant` and `presentation.behavior` → schema/adapt → `standard`. `tests/content/xv-xareni-iyarit.test.ts` never asserts itinerary variant | Test fixture vs corpus fixture `xareni-iyarit.json` | Fixture split: corpus migrated in `481dffe5`; DB-payload artifact and its test did not | `481dffe5` (incomplete) | `MIGRATION_GAP` (fixture/test) | P0 companion | **fixture/baseline** + **test** |

---

## 3. Systemic root causes

### SRC-1 — Theme-implied renderer replaced by explicit field + silent `standard`

**Symptom:** TimelineList / `uniform-grid` where known-good used `ItineraryProgram` / celestial choreography.

**Cause:** `e86ced84` removed `celestial-blue` from `Itinerary.astro` and stopped using `sectionStyles.itinerary.variant` + theme preset as itinerary authority. Gallery layout resolution at Production SHA returns `uniform-grid` for anything that is not already a layout id. `resolveItineraryPresentation()` and `normalizeItinerary()` default omissions to `'standard'`.

`docs/domains/theme/variant-system.md` says missing/unknown variants must fail closed. Runtime does the opposite: it succeeds as `standard`. Missing migrations therefore ship as looking “fine” to schema/tests.

**Consumers still depending on the removed implication:** Production (and Preview) Xareni, América, Ana Sofía; Production Abril (via leftover `sectionStyles`); Production celestial galleries.

**Not a defect in the new contract itself.** The defect is shipping the contract change without migrating those consumers.

### SRC-2 — Fixture/definition migration without persisted Production (and sometimes Preview)

`481dffe5` wrote `presentation.behavior` / `structuralVariant` into corpus fixtures and demos. `5af325b6` / `45d4a731` updated managed TypeScript definitions and Local published rows. Preview was partially migrated (Abril itinerary, Romina hero, Alba location). Production published JSON for the celestial clients and Abril itinerary was not.

There is no batch SQL/content rewrite. The only durable write path is managed release / corpus bootstrap. Read-time normalization is not a substitute for Production content.

### SRC-3 — Dual field names across environments

| Env | Typical itinerary field |
| --- | --- |
| HEAD Local managed | `itinerary.variant` |
| Preview Abril | `itinerary.presentation.behavior` |
| Production Abril | `sectionStyles.itinerary.variant` |
| Production Xareni/América | *(none)* |
| Production Ana Sofía | `sectionStyles.itinerary.variant: celestial-blue` (ignored) |

HEAD `normalizeItinerary` accepts canonical `variant`, `presentation.behavior`, and **structural** `sectionStyles` ids. It ignores theme names. Deploying HEAD without a data backfill therefore fixes Abril and does **not** fix Xareni / América / Ana Sofía.

### SRC-4 — Tests lock the new default, not the real consumer

`tests/unit/itinerary-adapter-contract.test.ts` asserts that omitted behavior and `sectionStyles.itinerary.variant: celestial-blue` become `standard`. That is the post-`e86ced84` contract. It does not fail when Production Xareni still needs `ItineraryProgram`.

`tests/content/xv-xareni-iyarit.test.ts` validates a DB-payload fixture that omits itinerary structure and never asserts `viewModel.sections.itinerary.variant`.

`canonical-corpus-contracts.test.ts` locks Ana Sofía from the **corpus fixture**, Abril/Romina/Victoria from **provision builders**, not from live Production JSON.

`tests/e2e/abril-audit.spec.ts` locks `.itinerary__program-*` against Local. Local Abril is already `timeline-paper`. Production is not in that path.

Gallery/hero portability e2e injects `data-structural-variant` on the DOM; it does not prove content → adapter → CSS.

---

## 4. Persisted content vs fixtures/tests

| Artifact | Itinerary | Gallery | Notes |
| --- | --- | --- | --- |
| Corpus `fixtures/xareni-iyarit.json` | `presentation.behavior: timeline-paper` | `index-choreography` | Migrated; Local published matches |
| `tests/fixtures/invitations/xv-xareni-iyarit-db-payload.json` | omitted → `standard` | not locked | Claims to be the DB payload; diverges from corpus and from needed Production |
| Production Xareni JSON | omitted | omitted | Live HTML confirms `standard` + `uniform-grid` |
| Corpus América / Ana Sofía | `timeline-paper` behavior | `index-choreography` | Local matches; Production does not |
| Abril definition HEAD | `itinerary.variant: timeline-paper` | `paired-feature-band` | Local applied |
| Abril Production JSON | `sectionStyles.itinerary.variant: timeline-paper` | `gallery.variant: premiere-floral` | Ignored / treated as non-layout on current Production code |
| Romina definition HEAD | `standard` | `editorial-mosaic` | Local applied; Production gallery/hero not promoted |

---

## 5. Test blind spots that allowed the regression

1. Adapter unit tests **require** omitted celestial itinerary to become `standard`.
2. Xareni content test uses an unmigrated DB-payload fixture and does not assert renderer/variant.
3. Canonical corpus tests adapt builders/fixtures, never `published_invitation_content` from Production.
4. Abril e2e is Local-only.
5. Gallery CSS tests mock URL maps; they do not load Production JSON and assert `index-choreography` vs `uniform-grid`.
6. `structural-variant-portability` e2e mutates DOM attributes rather than running persisted content through `adaptDbEvent`.
7. Schema validation is not fail-closed: the normalizer injects `standard` before Zod, so “valid payload” ≠ “intended renderer.”

---

## 6. Findings requiring human judgment

These do **not** change the P0 itinerary/gallery correction.

| ID | Question | Why it does not block P0 |
| --- | --- | --- |
| H1 | Should Production receive Romina `split-cover`, Alba `split-map`, Abril `paired-feature-band`, Alba `feature-stack` in the same Goal 2 as itinerary? | Separate managed-promote scope. P0 is the celestial/theme-implied renderer/layout loss |
| H2 | Why are `in_progress` Daniela and Victoria present in Production? | Lifecycle/inventory; their Local portable layouts are intentional and not the Xareni pattern |
| H3 | Did luna / cesar / ayrin galleries rely on theme geometry now lost to `uniform-grid`? | Unmapped themes; needs visual compare. Not celestial itinerary |
| H4 | Stale known-good alias was SSO-gated | Code at `6f3c46bf` is enough for Xareni itinerary expected renderer |

---

## 7. Correction backlog (severity and dependency)

Goal 2 must implement only what this section authorizes. Do **not** restore `celestial-blue` as an `Itinerary.astro` renderer alias. Do **not** add slug-specific branches.

### P0 — restore legitimate `ItineraryProgram` + celestial gallery layout on persisted consumers

**Owner:** persisted Production (and Preview where it matches Production). Then fixture/test.

**Intended fix (authority for Goal 2):**

1. Write canonical HEAD fields on persisted published content for the celestial itinerary consumers:
   - `itinerary.variant: 'timeline-paper'` (preferred at HEAD; `presentation.behavior` is legacy input only).
   - `gallery.variant: 'index-choreography'`.
   - Invitations: **xareni-iyarit**, **america-johana**, **ana-sofia-cota-guillen**.
2. Write canonical `itinerary.variant: 'timeline-paper'` on Production **abril-michelle-becerra-rea** (Preview already has behavior; Local already has variant). Optionally persist an explicit gallery layout once H1 is decided; the uniform-grid regression can be closed by persisting a real layout id (`editorial-mosaic` as the pre-`5af325b6` mosaic, or `paired-feature-band` if the owner accepts the newer Local layout for Production).
3. Align `tests/fixtures/invitations/xv-xareni-iyarit-db-payload.json` with the corpus itinerary/gallery contract.
4. Add tests that adapt **that** payload (and/or a Production-shaped fixture) and assert `viewModel.sections.itinerary.variant === 'timeline-paper'` and gallery `index-choreography`. Do not treat builder-only locks as sufficient.
5. Keep `itinerary-adapter-contract` tests for “theme names are not authority,” but add a sibling that persisted celestial **clients** carry an explicit structural value.

**HEAD deploy without data:** restores Abril itinerary via `sectionStyles` mapping; does **not** restore Xareni/América/Ana Sofía itinerary; may restore omitted celestial galleries via theme map. Data backfill is still required so alias retirement cannot regress them.

**Verification:** Production HTML `#itinerary` has `data-structural-variant="timeline-paper"` and `.itinerary__program-*`; gallery has `data-structural-variant="index-choreography"`. Compare against the known-good renderer, not against current Production.

### P1 — managed Production lag (depends on H1)

Romina hero `split-cover` + gallery `editorial-mosaic`; Alba location `split-map`. Preview already has several of these. Use the normal managed promote path. Not slug-specific CSS.

### P2 — remaining omitted gallery layouts

ximena / gerardo (mapped themes); luna / cesar / ayrin after H3. Persist explicit `gallery.variant` rather than expanding theme maps.

### P3 — residue (not P0)

Alba profile-owned hero geometry; Valentina/América legacy `sectionStyles` / theme-named fields; Leah `single` alias; `ornamented` access without a structural CSS partial; documented fail-closed vs silent `standard` (code invariant repair — only if separately authorized).

---

## 8. Managed-invitation evaluation checklist

Every registry invitation was evaluated. Corpus invitations sharing the changed itinerary/gallery contracts were evaluated. Demos/templates were inspected only where they claim those contracts.

| Slug | Lifecycle | Evaluated | P0 issue? |
| --- | --- | --- | --- |
| abril-michelle-becerra-rea | published | yes | Yes — itinerary (Production); gallery uniform-grid |
| alba-rosa-quinonez | published | yes | No itinerary. P1 location/gallery promote |
| romina-rios-chaparro | published | yes | Itinerary OK. P1 hero/gallery promote |
| daniela-y-martin | in_progress | yes | No P0. Local already on portable layouts |
| victoria-y-roberto | in_progress | yes | No P0. Local `editorial-ledger` is intentional |
| xareni-iyarit | legacy corpus | yes (reference pattern + Production) | Yes |
| america-johana | legacy corpus | yes | Yes |
| ana-sofia-cota-guillen | legacy corpus | yes | Yes |
| leah-lexa | legacy corpus | yes | Fixture-only / empty items |
| valentina-hernandez | legacy corpus | yes | No itinerary renderer defect |
| luna-y-estrella, cesar-ramses, ayrin-samantha-lerma-castro, ximena-meza-trasvina, gerardo-sesenta | legacy corpus | yes | Gallery H3/P2 only |

---

## 9. Handoff to Goal 2

| Field | Value |
| --- | --- |
| Current state | Goal 1 audit complete; no mutations |
| Evidence | Production HTML dumps; three-env `published_invitation_content` field extract; git `6f3c46bf` vs `e86ced84` vs `8569e3e3` vs `HEAD`; definitions; corpus vs DB-payload fixtures |
| Validation run | Read-only `loadSemanticParitySnapshot` for local/preview/production; Vercel `web_fetch` of public Production pages; git show of adapter/Itinerary |
| Validation not run | Visual screenshot compare vs known-good alias (SSO); Local browser render |
| Unresolved | H1–H4 above; none alter P0 |
| Residual risk | Deploying HEAD without Production backfill leaves Xareni/América/Ana Sofía itinerary on `standard` |
| Authorization | Goal 2 needs a **separate** explicit grant. This Goal 1 did not authorize writes |
| Branch / commit | `dev-local` @ `286f072d` |
| Next | Owner accepts this report, resolves H1 if the first Goal 2 slice should include managed promotes, then Goal 2 implements P0 exactly as §7 |

No write operations were performed. A temporary read-only extractor under `.agent/tmp/` was deleted after use.
