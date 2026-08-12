---
title: Invitation Contract Render-Parity Goal 3 Final Audit
status: active
created: 2026-08-12
updated: 2026-08-12
type: diagnostic
autonomy: 3
related_docs:
  - .agent/plans/active/invitation-contract-render-parity-goal1-audit.md
  - .agent/plans/active/invitation-contract-render-parity-goal2-implementation.md
  - docs/domains/theme/variant-system.md
  - docs/core/content-parity-rsvp-isolation.md
---

# Goal 3 — Final Render-Parity Audit, Local/Preview Repair, and Regression Closure

**Lifecycle:** Goal 3 complete for Local and Preview. Production remained read-only. Owner-authorized Production content apply and HEAD deploy remain a later step.

**Mode:** Audit first. Confirmed Thank You regressions were repaired in Local and Preview only. No Production mutation, patch apply, promotion, or indirect Production write was executed.

HEAD at audit/repair: `286f072dae9dced0248029cff7463788a0c45c60` (`dev-local`), plus uncommitted Goal 2/3 working-tree files. Pre-existing staged Goal 2 files were preserved.

---

## 0. Task Contract (projection)

| Field | Value |
| --- | --- |
| Objective | Prove Xareni Thank You root cause, second-pass every managed/corpus invitation on the same structural paths, repair confirmed regressions in Local and Preview, lock tests |
| Authorized | Read-only three-env probe; Local content repair; Preview content repair; tests/fixtures/CSS ownership correction; author (not apply) a future Production patch |
| Forbidden | Any Production write, `db:prod:* --apply`, Production SQL execution, Production promotion |
| Non-goals | Restore `celestial-blue` as a renderer alias; slug-specific branches; visual redesign; P1 Romina/Alba promotion; Goal 2 Production itinerary/gallery apply |

---

## 1. Xareni Thank You root cause

The mismatch is the same incomplete-migration class as Itinerary/Gallery, plus a second CSS-authority defect that only appears once the explicit contract is present.

### Intended contract (not derived from current Production appearance)

Known-good renderer at `6f3c46bf` selected editorial Thank You markup from the **visual** variant:

```text
EDITORIAL_THANK_YOU_VARIANTS = celestial-blue | enchanted-rose | editorial-magazine
usesEditorialLayout = EDITORIAL_THANK_YOU_VARIANTS.includes(variant)
```

Canonical HEAD contract:

```text
thankYou.variant = "editorial-back-cover"     # selects .thank-you-editorial DOM
data-variant = theme preset                   # celestial-blue / enchanted-rose / editorial-magazine skin
```

Demos already author `thankYou.variant: editorial-back-cover`. Corpus fixtures for Xareni / América / Ana Sofía / Leah / Ayrin stored the same value only in the legacy field `sectionStyles.thankYou.structuralVariant`.

### What actually rendered

| Environment | Persisted contract | Markup | Visual |
| --- | --- | --- | --- |
| Known-good `6f3c46bf` | theme `celestial-blue` implied editorial DOM | `.thank-you-editorial` | celestial light editorial (theme SCSS) |
| Production live (`8569e3e3`) | omitted `thankYou.variant` and omitted `sectionStyles.thankYou.structuralVariant` | `.thank-you-content` + `data-structural-variant="standard"` | standard stacked layout; celestial editorial geometry never matches |
| Local before Goal 3 CSS fix | legacy `sectionStyles.thankYou.structuralVariant=editorial-back-cover` | `.thank-you-editorial` | **magazine dark back-cover** (structural CSS overrode celestial) |
| Local after Goal 3 | canonical `thankYou.variant` + legacy field | `.thank-you-editorial` | celestial light editorial restored |
| Preview before Goal 3 | omitted (same as Production) | would be `standard` on current hosted SHA | standard |
| Preview after Goal 3 | both fields written | editorial DOM on HEAD; Production SHA also reads the legacy field | HEAD celestial; hosted Preview SHA may still load magazine structural CSS until HEAD deploys |

Production HTML evidence (`www.celebra-me.com/xv/xareni-iyarit`):

```text
data-variant="celestial-blue"
data-structural-variant="standard"
.thank-you-content
image still 800×1000 via IMAGE_CONFIGS['celestial-blue']
```

Local computed styles **before** CSS isolation: `background rgb(58,42,46)`, on-dark text, `max-width: 440px`. **After:** dark text `rgb(58,42,46)`, no 440px magazine cap, large drop-cap/signature, peach/ivory celestial composition.

### First bad commit / range

| Layer | Commit | What changed |
| --- | --- | --- |
| Renderer | `c26ab498` | `ThankYou.astro` stopped treating `celestial-blue` / `enchanted-rose` as editorial markup. Only `structuralVariant === 'editorial-back-cover'` selects `.thank-you-editorial`. |
| Normalizer | `45d4a731` | Theme fallback for omitted Thank You is `editorial-magazine → editorial-back-cover`, else **`standard`**. Celestial/enchanted-rose implication was not preserved. |
| CSS | `45d4a731` / HEAD resolver | `_editorial-back-cover.scss` (magazine dark geometry) was loaded as a **global structural entrypoint**. Equal specificity + later load order beat `_celestial-blue.scss`. |

This is **not** an intentional design change. The celestial thank-you partial, Xareni profile tokens, and known-good renderer all describe the light editorial composition. Magazine back-cover geometry belongs to editorial-magazine.

Classification: `CONFIRMED_REGRESSION` (missing explicit contract on Preview/Production) + `CONFIRMED_REGRESSION` (structural CSS encoded magazine geometry for a shared DOM id).

---

## 2. Systemic second-pass findings

Every registry managed invitation and the corpus invitations sharing itinerary/gallery/thank-you paths were re-probed in Local, Preview, and Production.

| Invitation | Section | Expected | Actual (pre-Goal 3) | Classification | Severity | Goal 3 action |
|---|---|---|---|---|---|---|
| xareni-iyarit, america-johana, ana-sofia-cota-guillen | Thank You | `editorial-back-cover` DOM + celestial skin | Local: editorial DOM + magazine CSS. Preview/Prod: `standard` | `CONFIRMED_REGRESSION` | P0 | Local+Preview content + CSS isolation |
| leah-lexa | Thank You | editorial DOM (celestial + Leah profile `.thank-you-editorial`) | All three envs omitted → `standard`. Fixture had only legacy `sectionStyles` | `CONFIRMED_REGRESSION` | P0 companion | Local+Preview content |
| ayrin-samantha-lerma-castro | Thank You | editorial DOM + enchanted-rose skin | All three envs omitted → `standard`. Fixture had only legacy field | `CONFIRMED_REGRESSION` | P0 companion | Local+Preview content |
| valentina-hernandez | Thank You | `editorial-back-cover` via editorial-magazine theme fallback | omitted explicit field; HEAD/Production SHA fallback still maps magazine → editorial-back-cover | `INTENTIONAL_CHANGE` / compatibility fallback | — | none (fallback still valid) |
| abril, romina, daniela, victoria | Thank You | `standard` | Local explicit `standard`; Preview Romina/Abril `sectionStyles.thankYou.structuralVariant=standard` | `INTENTIONAL_CHANGE` | — | none |
| alba-rosa-quinonez | Thank You | `standard` markup + magazine visual skin (profile comment) | Local `thankYou.variant=standard`, `sectionStyles.thankYou.variant=editorial-magazine` | `INTENTIONAL_CHANGE` | — | none |
| xareni / america / ana-sofia | Itinerary + Gallery | Goal 2 P0 | Local/Preview already `timeline-paper` + `index-choreography`. Production still omitted | Goal 2 status unchanged | P0 Production | **not applied** (Production read-only) |
| romina | Hero / Gallery | P1 `split-cover` / `editorial-mosaic` | Local has them; Preview/Prod lag | `PERSISTED_CONTENT_DIVERGENCE` | P1 | untouched |
| alba | Location / Gallery | P1 `split-map` / Local `feature-stack` | Preview has `split-map`; Production omits | `PERSISTED_CONTENT_DIVERGENCE` / `MIGRATION_GAP` | P1/P2 | untouched |
| luna / cesar / ximena / gerardo | Gallery | Goal 1 H3/P2 | omitted layouts unchanged | `UNKNOWN_HUMAN_REVIEW` / `MIGRATION_GAP` | P2 | untouched |
| Hero / Family / Location / Gifts / RSVP / Access (celestial) | — | no evidence these used a removed theme→structure implication equivalent to Thank You | América `gifts.variant=celestial-blue` is a leftover theme name; Gifts renderer is `editorial-catalog` only | `LEGACY_COMPATIBILITY_RESIDUE` | P3 | none |

No slug-specific renderer, `celestial-blue` itinerary alias, or new theme fallback was added.

---

## 3. Exact Local and Preview changes

### CSS ownership (code)

`editorial-back-cover` still selects `.thank-you-editorial` in `ThankYou.astro`. Magazine geometry in `_editorial-back-cover.scss` is now imported only by the editorial-magazine **theme bundle**. It is no longer a global structural CSS entrypoint.

That is the minimum correction that keeps one shared DOM contract without restoring theme names as renderer aliases and without inventing a new variant.

### Persisted fields written (Local + Preview)

```text
thankYou.variant = "editorial-back-cover"                          # HEAD canonical
sectionStyles.thankYou.structuralVariant = "editorial-back-cover"  # Production SHA 8569e3e3 adapter
```

Surgical `jsonb ||` merge on `published_invitation_content` and matching drafts. Unrelated keys preserved (including Ana Sofía `sectionStyles.thankYou.variant=celestial-blue`).

| Invitation | Local before → after | Preview before → after |
|---|---|---|
| xareni-iyarit | styles only → both fields | omitted → both fields |
| america-johana | styles only → both fields | omitted → both fields |
| ana-sofia-cota-guillen | styles only + leftover celestial visual → both fields, visual leftover kept | omitted + leftover celestial visual → both fields |
| leah-lexa | omitted → both fields | omitted → both fields |
| ayrin-samantha-lerma-castro | omitted → both fields | omitted → both fields |
| romina (control) | `thankYou.variant=standard` | `styles.structuralVariant=standard` |

Mechanism: `.agent/tmp/apply-goal3-thankyou-contracts.mts` with `--env=local|preview --apply`. Preview used `CELEBRA_TASK_SCOPE=preview:<slug>:apply`. Production URL classification aborts.

### Fixtures

Canonical `thankYou.variant: editorial-back-cover` added to:

- `tests/fixtures/invitations/xv-xareni-iyarit-db-payload.json`
- corpus fixtures for Xareni, América, Ana Sofía, Leah, Ayrin

Existing legacy `sectionStyles.thankYou.structuralVariant` left in place where already present.

---

## 4. Tests executed

```text
pnpm exec jest tests/content/p0-structural-contract.test.ts \
  tests/content/xv-xareni-iyarit.test.ts \
  tests/content/canonical-corpus-contracts.test.ts \
  tests/unit/itinerary-adapter-contract.test.ts \
  tests/unit/section-css-resolver-map.test.ts \
  tests/unit/variant-governance.test.ts --no-coverage
# 6 suites, 54 tests, pass
```

New/extended locks:

- Xareni DB payload and view-model require `thankYou.variant` / `structuralVariant=editorial-back-cover` and visual `celestial-blue`.
- Corpus fixtures for the five Thank You consumers must carry an explicit editorial-back-cover contract; schema/adapt must not inject `standard`.
- Removing the explicit Thank You contract from the Xareni payload still resolves to `standard` (post-`c26ab498` default). That default is no longer an acceptable stand-in for these invitations.
- Romina Thank You remains `standard`.
- `ThankYou.astro` still has no `EDITORIAL_THANK_YOU_VARIANTS` theme alias.
- Celestial + `editorial-back-cover` does **not** load magazine thank-you CSS as a structural override.

---

## 5. Visual verification (Local)

Xareni `#thank-you-section` after repair:

- `data-variant="celestial-blue"`
- `data-structural-variant="editorial-back-cover"`
- `.thank-you-editorial` present (not `.thank-you-content`)
- Light peach/ivory celestial composition, large drop-cap, calligraphy signature, portrait in editorial frame
- Not the magazine dark back-cover seen immediately before the CSS isolation

Local HTML attributes after repair:

| Invitation | `data-variant` | `data-structural-variant` |
|---|---|---|
| xareni-iyarit | celestial-blue | editorial-back-cover |
| america-johana | celestial-blue | editorial-back-cover |
| ana-sofia-cota-guillen | celestial-blue | editorial-back-cover |
| leah-lexa | celestial-blue | editorial-back-cover |
| ayrin-samantha-lerma-castro | enchanted-rose | editorial-back-cover |
| romina-rios-chaparro | premiere-floral | **standard** |

Preview hosted visual was not screenshot-QA'd: Preview DB now has the contract, but the live Preview app SHA is still `8569e3e3`, which maps `editorial-back-cover` → magazine thank-you CSS as a structural entrypoint. HEAD must be deployed for Preview/Production celestial visual parity. Content is ready.

---

## 6. Production read-only observations

Production was probed, never written. Live Xareni HTML remains `data-structural-variant="standard"`. Published JSON for the five Thank You consumers still omits both fields. Goal 2 itinerary/gallery Production patch is still unapplied.

A future owner patch was **authored only**:

`scripts/manual/production-patches/20260812_thankyou_editorial_back_cover_structural_contracts.sql`

It was not linted via `db:prod:patch` and not applied. Combine with the Goal 2 itinerary/gallery patch in a later owner-TTY step, then deploy HEAD so celestial Thank You does not pick up magazine structural CSS.

---

## 7. Residual risks and `UNKNOWN_HUMAN_REVIEW`

| ID | Item |
| --- | --- |
| R1 | Production Thank You + Goal 2 itinerary/gallery still omitted until owner apply |
| R2 | Hosted Preview/Production at `8569e3e3` will load magazine thank-you CSS for `editorial-back-cover` until HEAD deploys |
| R3 | Stale drafts republishing without the new fields could revert Preview (drafts were merged when present) |
| H1 | Romina `split-cover` / Alba `split-map` / Abril gallery remain P1 promotion lag |
| H3 | luna / cesar / ximena / gerardo omitted gallery layouts unchanged |
| H2 | Daniela/Victoria `in_progress` Production rows unchanged |

---

## 8. Final status

| Invitation | Local | Preview | Production |
|---|---|---|---|
| xareni-iyarit Thank You | **OK** | **content OK** (HEAD visual after deploy) | **OPEN** |
| america-johana Thank You | **OK** | **content OK** | **OPEN** |
| ana-sofia-cota-guillen Thank You | **OK** | **content OK** | **OPEN** |
| leah-lexa Thank You | **OK** | **content OK** | **OPEN** |
| ayrin-samantha-lerma-castro Thank You | **OK** | **content OK** | **OPEN** |
| Goal 2 itinerary/gallery P0 | OK | OK | **OPEN** (unchanged) |
| Romina itinerary/Thank You `standard` | unchanged | unchanged | unchanged |

Production remained strictly read-only throughout Goal 3.
