---
title: Canonical Variant Consolidation and Invitation Remediation
status: active
created: 2026-08-12
updated: 2026-08-12
# Goal 2 code/contracts in progress; Local apply gated on dry-run authorization.
# Daniela Local plan currently BLOCKED (publication_after_baseline).
type: implementation
autonomy: 2
related_docs:
  - docs/domains/theme/variant-system.md
  - docs/domains/theme/gallery-variants.md
  - docs/domains/theme/variant-compatibility.md
  - docs/domains/theme/section-intersections.md
  - docs/domains/content/section-contracts.md
supersedes:
  - invitation-variant-canonicalization-goal-b.md
baseline_head: eaef622e8c5c0e6c5e0a581c626474d470ee170b
---

# Goal 1 — Remediation and Consolidation Specification

**Lifecycle:** Goal 1 complete → awaiting explicit Goal 2 implementation authorization  
**Branch / worktree:** `dev-local` @ `eaef622e` (same commit as `feat/invitation-variants`)  
**Working tree at Goal 1 close:** clean; no overlapping uncommitted work  
**Large Change Mode:** YES (≥25 files, structural `src/styles` / schemas / provision / tests / Local content)

This document is the authoritative Goal 1 specification for Goal 2. Historical audits under
`.agent/plans/archived/` and `docs/archive/reports/` are evidence only.

---

## 0. Task Contract (projection)

| Field | Value |
| --- | --- |
| Objective | Canonical section-variant ownership for five managed invitations; consolidate only structural equivalents; migrate versioned + Local content; visual parity |
| Authorized now | Read-only audit + this specification. **No Goal 2 implementation, no Git mutation, no Local DB apply** until separate explicit authorization |
| Scope | Contracts, normalizer, adapters/descriptors, renderers, section SCSS, composition, editor/intake/draft/publication mappings, five managed definitions, demos/templates/fixtures/tests/docs on affected paths, Local content migration for those five only |
| Non-goals | Visual redesign, copy/asset/event-data/identity changes, unrelated invitations, Preview/Production/Auth/Storage, schema DDL, new global framework |
| Invariants | `section.variant` sole structural authority post-normalize; profiles non-structural; fail-closed unknowns; typed dual-input conflicts; SCSS-only; no absolute paths; no Git without separate auth |
| Acceptance | User acceptance criteria §1–14 in the task prompt |
| Stop conditions | Overlapping unrelated diffs; visual difference without approval; guarded Local workflow cannot express migration; branch/HEAD drift invalidating baseline without re-baseline |

---

## 1. Baseline verification (executed)

| Check | Result |
| --- | --- |
| Current branch | `dev-local` (not checked out to `feat/invitation-variants`; same HEAD) |
| HEAD | `eaef622e8c5c0e6c5e0a581c626474d470ee170b` — matches reviewed reference |
| Intervening commits vs baseline | 0 |
| Working tree | clean |
| Related local refs | `feat/invitation-variants` @ same HEAD; `dev-extra` @ same HEAD |

**Decision:** Proceed on `dev-local` unless the owner authorizes a branch switch. Do not auto-switch.

---

## 2. Current architecture (live evidence)

Post-normalization dependency model already documented and partially implemented:

`Invitation configuration → section.variant → adapter/view-model → renderer + section-owned variant SCSS → shared primitives`

| Layer | Path |
| --- | --- |
| Vocabulary | `src/lib/invitation/structural-variants.ts` |
| Normalizer | `src/lib/invitation/variant-normalization.ts` |
| Schemas | `src/lib/schemas/content/*.schema.ts` |
| Adapter | `src/lib/adapters/event.ts` |
| CSS resolver | `src/lib/invitation/section-css-resolver-map.ts` |
| Composition | `src/lib/invitation/composition-contract.ts` |
| Docs SSOT | `docs/domains/theme/variant-system.md` |

### Contract gaps vs acceptance criteria (must fix in Goal 2)

| Gap | Evidence | Required fix |
| --- | --- | --- |
| Dual canonical+legacy conflict silently prefers canonical | `canonicalOrLegacy()` returns canonical when defined; no conflict error | Emit typed actionable conflict when both present and normalize to different semantic values; accept only when equivalent |
| `single-keepsake` cardinality not enforced | `gallery.schema.ts` items array unconstrained by variant | Require exactly one item in schema + authoring/editor validation |
| Alba gallery structure owned by profile | `alba-rosa-quinonez.scss` redefines `.gallery-section .gallery-grid` geometry while content says `feature-mosaic` | New semantic gallery variant; move geometry to section SCSS; strip profile grid ownership |
| Abril gallery structure owned by profile | Profile forces 2×2 + full-width feature on `uniform-grid` | New semantic gallery variant; move geometry; strip profile structural rules |
| Daniela/Victoria location twin-plate duplicated in profiles | Both profiles own plate grid / card stack geometry under `location.variant=standard` | Shared semantic location variant + section SCSS |
| Victoria family geometry diverges from canonical `split-groups` | Profile overrides mirror/alignment/padrinos placement | Separate semantic family variant (do not merge with Daniela) |
| Victoria itinerary ledger on `standard` | Profile hides spine/line and imposes 2-col ledger | New itinerary semantic variant over `TimelineList` |
| Screenshot-only production styling | `daniela-y-martin.scss` `html[data-screenshot]` opacity interlock | Remove from product profile (move to screenshot tooling if still required) |
| Adapter theme-skin leakage | Location/Gifts descriptors still surface theme preset via `sectionStyles.*.variant` | Keep visual skin typed; stop treating theme names as structural authority |
| Stale active docs | `section-contracts.md`, `architecture.md`, `alba-rosa-quinonez.md` still cite legacy authorities / deleted `intersection-profiles` | Update active docs; keep aliases only in compatibility docs |
| Portability proof incomplete for new layouts | Existing e2e portability covers `split-cover` / `split-map` via DOM injection; task requires real content→CSS→page path for new/changed variants | Add non-origin consumers exercising full pipeline |

---

## 3. Per-section remediation matrix

### 3.1 Hero — Romina `split-cover` (regression baseline)

| Field | Current |
| --- | --- |
| Configuration | `hero.variant: 'split-cover'` (`romina-rios-chaparro.ts`) |
| Effective renderer | Shared `Hero.astro` + `_split-cover.scss` |
| Structural variant | `split-cover` |
| Legacy influence | Normalizer may still map omitted/`theme` → standard; Romina already canonical |
| Required data | Background image; standard hero fields |
| DOM / a11y / responsive | Shared hero DOM; desktop split plane+photo; mobile stack — section-owned |
| Profile role | Tokens only (`--hero-split-*`) — already compliant |
| Similar variants | `standard`, `editorial-cover` — retain separate (different renderers/DOM contracts) |
| Target | **Retain** `split-cover` unchanged |
| Migration | None for Romina hero |
| Visual evidence | Before/after mobile-standard (390×844) + desktop (existing standard desktop viewport) |
| Portability | Existing jewelry-box non-origin harness; keep and ensure it remains full-pipeline where required |

### 3.2 Gallery — Alba Rosa (profile-owned mosaic)

| Field | Current |
| --- | --- |
| Configuration | `gallery.variant: 'feature-mosaic'` |
| Effective renderer | `Gallery.astro` → `PhotoGallery.astro` |
| Structural reality | Canonical `_feature-mosaic.scss` is 12-col dense; Alba profile overrides to asymmetric 2-col (tall feature + stacked supports) |
| Other `feature-mosaic` consumers | `demo-xv-jewelry-box`, `demo-xv-enchanted-rose`, `demo-cumple-luxury-hacienda`, `event-templates/xv/master.json`, fixture `gerardo-sesenta` |
| Consolidation decision | **Do not merge into `feature-mosaic`** — different DOM geometry / column contract; changing canonical SCSS would regress other consumers |
| Target semantic variant | **`feature-stack`** (client-independent): primary feature column + stacked support cells |
| Required data | ≥3 items recommended for full composition; typed `layoutRole` support retained; exact min cardinality to be locked in schema refine during Goal 2 (propose `items.length >= 3`) |
| Section SCSS | New `src/styles/themes/sections/gallery/_feature-stack.scss` (+ resolver map entry) |
| Profile after | Tokens/crops/decoration only; delete structural grid rules |
| Non-origin consumer | Dedicated fixture or demo content path with no Alba profile/assets |
| Migration | Alba managed definition + Local published/draft content: `feature-mosaic` → `feature-stack` |

### 3.3 Gallery — Abril Michelle (hidden storyboard on `uniform-grid`)

| Field | Current |
| --- | --- |
| Configuration | `gallery.variant: 'uniform-grid'` |
| Structural reality | Profile owns portrait pairs + full-width feature band (`layoutRole=feature` / confetti key) |
| Consolidation decision | **Do not reuse `uniform-grid`, `feature-mosaic`, or `magazine-spread`** — distinct responsive pairing + full-bleed feature band contract |
| Target semantic variant | **`paired-feature-band`** |
| Required data | Items supporting pair/feature choreography; feature item via `layoutRole: 'feature'` (not image-key coupling); propose refine validating at least one feature role when variant selected |
| Section SCSS | New `_paired-feature-band.scss` |
| Naming | Must not include `abril` / client identity |
| Non-origin consumer | Required (new fixture/demo) |
| Migration | Abril definition + Local: `uniform-grid` → `paired-feature-band`; remove profile structural selectors |
| Docs | Retire “unresolved invitation-specific extension” language in `gallery-variants.md` |

### 3.4 Gallery — `single-keepsake` (Daniela, Victoria, others)

| Field | Current |
| --- | --- |
| Gap | No executable exactly-one-item rule |
| Target | Discriminated/refined schema: `variant=single-keepsake` ⇒ `items.length === 1` in published schema + intake/editor |
| Consumers | Daniela, Victoria, Leah pet-keepsake paths — verify item counts before enforce |
| Portability | Existing jewelry-box / corpus coverage; add schema invalid cases |

### 3.5 Location — Alba `split-map`

| Field | Current |
| --- | --- |
| Configuration | `location.variant: 'split-map'` |
| Status | Already canonical with section SCSS; portability harness exists |
| Goal 2 work | Confirm no Alba profile geometry ownership remains; keep portable; no identity coupling in renderer/`GoogleMap` for structure |

### 3.6 Location — Daniela + Victoria twin venue plates

| Field | Current |
| --- | --- |
| Configuration | Both: `location.variant: 'standard'`, `presentation: 'simple'` |
| Structural reality | Near-identical profile-owned plate grid, stacked venue chapters, indications panel (~shared composition) |
| Differences | Pin placement / token values — non-structural |
| Consolidation decision | **Merge to one semantic location variant** |
| Target | **`stacked-venue-plates`** |
| Renderer | Existing `EventLocation` + `VenueCard` DOM; section SCSS owns plate geometry |
| Required data | ≥2 venues; illustration/plate media as already authored |
| Non-origin consumer | One of the two is origin; the other counts as second consumer **only if** after extraction neither profile owns geometry. Prefer an additional jewelry-box fixture without either profile for strict portability proof |
| Migration | Both definitions + Local → `stacked-venue-plates` |

### 3.7 Family — Daniela vs Victoria

| Invitation | Current variant | Structural reality |
| --- | --- | --- |
| Daniela | `split-groups` | Matches canonical `_split-groups.scss` (mirrored groups); profile tokens OK |
| Victoria | `split-groups` | Profile rewrites to left-read asymmetric groups + padrinos placement |

| Decision | Rationale |
| --- | --- |
| **Retain Daniela on `split-groups`** | Contract match |
| **New Victoria variant `asymmetric-groups`** | Different alignment/order/responsive contract — not token-only |
| Share | Common group list schema primitives / mixins where safe; not a boolean soup on one variant |

### 3.8 Itinerary — Victoria ledger vs Abril `timeline-paper`

| Variant | Renderer | Structure |
| --- | --- | --- |
| Abril `timeline-paper` | `ItineraryProgram` | Paper panel rows |
| Victoria profile on `standard` | `TimelineList` | Flat time\|label ledger; spine/line hidden |

| Decision | **New `editorial-ledger`** selecting `TimelineList` + `_editorial-ledger.scss`. **Do not merge** with `timeline-paper`. |
| Migration | Victoria itinerary `standard` → `editorial-ledger` |
| Non-origin consumer | Required |

### 3.9 Gifts — Daniela vs Victoria

| Observation | Vertical twin cards (Daniela) vs horizontal single/cash (Victoria) under `gifts.variant=standard` |
| Decision | **Retain separate presentations as profile/token or typed presentation options** if differences are card skin/orientation only; **do not invent a combinatorial gifts mega-component**. Promote a gifts structural variant only if Goal 2 CSS audit shows distinct required DOM/order/a11y contracts that cannot stay as tokens |
| Default Goal 2 stance | Prefer presentation option / tokens; escalate to semantic gifts variant only with structural-equivalence failure evidence |

### 3.10 Composition / intersections

| Field | Current |
| --- | --- |
| Canonical | `composition.intersections` content-owned |
| Deleted path | `intersection-profiles.ts` (confirmed absent) |
| Legacy | `LEGACY_INTERSECTION_PROFILES` keyed by `visualProfileId` when `composition` missing |

| Decision | Keep legacy map **only** while inventory shows consumers without `composition`; document + test. All five managed invitations already author `composition` — after Local migration, re-inventory; remove keys with zero repo+Local consumers |

---

## 4. Consolidation decision register

| Candidates | Structural-equivalence? | Decision | Target ID |
| --- | --- | --- | --- |
| Alba gallery vs `feature-mosaic` | No (2-col stack vs 12-col dense) | Separate | `feature-stack` |
| Abril gallery vs `uniform-grid` / mosaics | No | Separate | `paired-feature-band` |
| Daniela + Victoria location plates | Yes (same DOM/order/responsive contract; token diffs only) | Consolidate | `stacked-venue-plates` |
| Daniela + Victoria family | No | Separate | `split-groups` + `asymmetric-groups` |
| Victoria ledger vs `timeline-paper` | No (different renderer) | Separate | `editorial-ledger` |
| Daniela + Victoria gifts | Likely tokens/options | Defer structural ID | `standard` + options/tokens |
| Romina `split-cover` peers | N/A | Retain | `split-cover` |

Visual similarity alone never merges IDs (enforced above).

---

## 5. Normalizer and schema enforcement plan

1. Replace silent preference with:
   - equivalent dual-input → single canonical value;
   - conflicting dual-input → typed error (Zod custom issue or normalizer throw caught into schema), preserving both inputs in the message;
   - legacy-only → map;
   - canonical-only → keep;
   - unknown → preserve → schema reject.
2. Enforce `single-keepsake` cardinality = 1 in published + draft/editor schemas.
3. Add closed enum members for new variants; fail-closed unknowns.
4. Exhaustive adapter/descriptor maps (TypeScript `Record` / satisfies) for every canonical ID.
5. Gallery layout vs `visualVariant` remains separate.

---

## 6. Content and Local migration plan

### 6.1 Versioned producers (before removing readers)

| Producer | Change |
| --- | --- |
| `scripts/provision/invitations/alba-rosa-quinonez.ts` | gallery → `feature-stack` |
| `scripts/provision/invitations/abril-michelle-becerra-rea.ts` | gallery → `paired-feature-band` |
| `scripts/provision/invitations/daniela-y-martin.ts` | location → `stacked-venue-plates` |
| `scripts/provision/invitations/victoria-y-roberto.ts` | location → `stacked-venue-plates`; family → `asymmetric-groups`; itinerary → `editorial-ledger` |
| `scripts/provision/invitations/romina-rios-chaparro.ts` | No structural change (regression anchor) |
| Demos/templates/fixtures/tests | Add non-origin consumers; update expectations; migrate only affected aliases |

### 6.2 Compatibility retirement register (template for Goal 2)

For each alias/path considered for removal, record:

| Legacy input | Canonical replacement | Repo consumers | Local consumers | Migration result | Zero-consumer evidence |
| --- | --- | --- | --- | --- | --- |

Remove only with zero consumers in **both** repository and Local. Otherwise retain isolated, documented, tested.

### 6.3 Persistent Local database (Goal 2 gated)

Permitted mutation: idempotent content migration for the **five** invitation records only via guarded workflow (`apply-local-invitation` / `invitation:release` / `dbs` — package.json authority).

Pre-apply checklist:

1. Confirm env + DB identity (`persistent-local`, `127.0.0.1:54322`)
2. Classify protected persistent Local
3. `tsx scripts/db/sentinel-check.ts check`
4. Read-only inventory + dry-run before/after fields
5. Verify UUIDs, ownership, publication state, RSVP, assets, unrelated rows unchanged
6. **Separate explicit apply authorization** for the exact slug/UUID set

Post-apply: reread, schema validate, render parity, idempotent re-apply, sentinel recheck.

**Blocked:** resets, `db push`, destructive DDL, Preview/Production/Auth/Storage, ad hoc SQL when workflow cannot express the change.

---

## 7. Portability and visual evidence plan

### 7.1 Non-origin consumers (required for each new/changed structural variant)

| Variant | Origin | Non-origin proof vehicle |
| --- | --- | --- |
| `feature-stack` | Alba | Fixture/demo without Alba profile |
| `paired-feature-band` | Abril | Fixture/demo without Abril profile |
| `stacked-venue-plates` | Daniela/Victoria | Fixture without either profile (or cross-consumer after profile strip + third fixture) |
| `asymmetric-groups` | Victoria | Fixture without Victoria profile |
| `editorial-ledger` | Victoria | Fixture without Victoria profile |
| `split-cover` / `split-map` | Romina / Alba | Strengthen existing jewelry-box path to full content→normalize→schema→adapter→renderer→CSS→page |

Each proof must verify: no origin identity/assets; automatic variant CSS load; mobile+desktop; coexistence with another variant in same build; no style leakage.

### 7.2 Visual parity viewports

Repository-standard captures (record exact dimensions in evidence):

- **mobile-standard:** 390×844 @2x
- **desktop:** use repository desktop viewport from screenshot CLI (capture exact px in report)

Cover: Romina, Alba, Abril, Daniela, Victoria, and every non-origin portability consumer. Unexplained visual delta → stop for approval.

---

## 8. Documentation and hygiene (Goal 2 / Goal 3)

Update active docs to match implemented contracts:

- `docs/domains/theme/variant-system.md`
- `docs/domains/theme/gallery-variants.md`
- `docs/domains/theme/variant-compatibility.md`
- `docs/domains/theme/section-intersections.md`
- `docs/domains/content/section-contracts.md`
- `docs/domains/theme/architecture.md` (remove canonical `presentation.behavior` guidance)
- Affected `docs/invitations/*` for the five clients

Remove stale active references to:

- `hero.structuralVariant` as canonical authority
- `sectionStyles.*.structuralVariant` as canonical authority
- `itinerary.presentation.behavior` as canonical authority
- deleted `intersection-profiles` paths
- renamed renderer components (if any)

Fix whitespace/formatting on touched files including known trailing whitespace in `Itinerary.astro`.

---

## 9. Verification strategy (ordered)

1. Focused unit: normalizer cases (valid/invalid/unknown/legacy-only/equivalent dual/conflicting dual); `single-keepsake` cardinality; exhaustive adapters/descriptors; CSS resolver; governance (no identity coupling)
2. Content contracts for five managed definitions + affected corpus
3. Editor/intake/draft/publication round trips
4. Non-origin portability unit + e2e (real pipeline)
5. Local dry-run → (authorized) apply → reread → idempotency → sentinel
6. Visual before/after evidence
7. `pnpm validate:changed` → type-check / styles → build → full `pnpm run ci`
8. Clean final diff + `pnpm agent:git-safety:finish` when session closes (no commit unless separately authorized)

Do not claim a check passed unless run against final relevant state.

---

## 10. Implementation workstreams (Goal 2 sequencing)

Authorized only after human approval of this spec:

1. **Contracts** — vocabularies, schema refines, conflict-aware normalizer, adapter/descriptor exhaustiveness
2. **Section SCSS + resolvers** — new partials; strip profile structural geometry
3. **Managed definitions + non-origin fixtures**
4. **Tests** — schema, governance, portability, corpus
5. **Docs**
6. **Local migration** — inventory/dry-run; stop for apply auth; apply; prove
7. **Visual parity capture**
8. **Full CI + hygiene**

Projected size: Large Change Mode. Do **not** fragment into artificial sub-PRs that evade the gate; one authorized Goal 2 implementation pass covering the coupled surface.

---

## 11. Authorization gate (required before Goal 2)

Implementation must not start until the repository owner explicitly authorizes Goal 2 for this specification, including:

1. Approval of consolidation decisions and proposed IDs (`feature-stack`, `paired-feature-band`, `stacked-venue-plates`, `asymmetric-groups`, `editorial-ledger`)
2. Approval to implement on `dev-local` (or instruction to switch to `feat/invitation-variants`)
3. Acknowledgement that Local DB apply remains a **second**, exact-set authorization after dry-run evidence
4. Acknowledgement that Git commit/push/PR remain unauthorized unless separately requested

### Open naming alternatives (owner may rename before Goal 2)

| Proposed | Alternatives |
| --- | --- |
| `feature-stack` | `support-stack-mosaic`, `asymmetric-triptych` |
| `paired-feature-band` | `portrait-pair-feature`, `storyboard-band` |
| `stacked-venue-plates` | `twin-venue-plates` |
| `asymmetric-groups` | `split-groups-editorial` |
| `editorial-ledger` | `flat-ledger` |

---

## 12. Goal 1 status

**Goal 1 — Audit + Specification: COMPLETE (draft pending owner authorization).**

No Goal 2 code, content, or database mutations were performed in this phase.
