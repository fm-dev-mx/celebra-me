# Goal 1 — Consumer Corpus Verification Delta (Implementation Scope Lock)

**Date:** 2026-08-10  
**Mode:** bounded consumer verification only — no runtime, CSS, content, Legacy removal, or
Production mutation.  
**Primary evidence:** current repository +
[`variant-encapsulation-migration-scope-2026-08-10.md`](variant-encapsulation-migration-scope-2026-08-10.md).  
**Method:** registry/fixture/demo inventory, adapter/resolver field traces, existing payload tests,
and targeted code search for confirmed risk patterns. No new scanner or permanent diagnostic
abstraction was added.

This delta **supplements** the completed architectural audit. It does not replace its migration
matrix or Victoria plan.

---

## 1. Active consumer corpus (accounted)

| Class | Consumers | Source |
| --- | --- | --- |
| Managed published | `alba-rosa-quinonez`, `abril-michelle-becerra-rea`, `romina-rios-chaparro` | `scripts/provision/invitations/registry.ts` |
| Managed in_progress | `daniela-y-martin`, `victoria-y-roberto` | same registry (outside Production render corpus by policy) |
| Legacy fixtures | `america-johana`, `valentina-hernandez`, `xareni-iyarit`, `leah-lexa`, `luna-y-estrella`, `cesar-ramses`, `ayrin-samantha-lerma-castro`, `ana-sofia-cota-guillen`, `ximena-meza-trasvina`, `gerardo-sesenta` | `local-render-corpus/registry.ts` (13-entry Production corpus = 3 published + 10 legacy) |
| Demos | 13 JSON under `src/content/event-demos/**` | content collection |
| Template | `src/content/event-templates/xv/master.json` | routable template; not a client invitation |

No obsolete consumers were excluded without proof. Daniela and Alba have **no itinerary block**; they
are not itinerary-fallback consumers.

---

## 2. Alba / Romina canonical divergence confirmation

These checks are architectural (declared → adapter → effective). Environment convergence is out of
scope. Focused payload tests passed in this verification run.

| Case | Declared source | Adapter / resolver | Effective contract | Produced by |
| --- | --- | --- | --- | --- |
| Alba Location `split-map` | `alba-rosa-quinonez.ts` `location.structuralVariant: 'split-map'` | `resolveLocationStructuralVariant` (explicit only; no theme fallback) | `split-map`, `structuralVariantExplicit: true` | **Canonical explicit content** + canonical `_split-map.scss` delivery |
| Alba Countdown days-only | same file `countdown.presentationOptions.visibleUnits: ['days']` | `resolveCountdownVisibleUnits` | `['days']` | **Canonical explicit presentation**; no theme inference |
| Romina Hero `split-cover` | `romina-rios-chaparro.ts` `hero.structuralVariant: 'split-cover'` | `resolveHeroStructuralVariant` (explicit wins; Romina theme is `premiere-floral`, so editorial theme fallback cannot invent `split-cover`) | `split-cover`, `structuralVariantExplicit: true` | **Canonical explicit content** + canonical `_split-cover.scss` |

Evidence already wired: `tests/content/alba-rosa-quinonez-payload.test.ts`,
`tests/content/romina-local-invitation.test.ts` (both green in this session).

---

## 3. Additional consumers of already-confirmed defect classes

Only additions that match defect classes from the completed audit are in scope.

| Defect class | Audit named | Additional active consumers confirmed now |
| --- | --- | --- |
| Itinerary theme-name fallback (missing `presentation.behavior`) | Victoria | **Romina** (effective `premiere-floral` on TimelineList); **all 10 legacy fixtures with itinerary**; demos without explicit behavior (most demos except celestial-blue + xareni-profile + Abril managed) |
| Itinerary legacy `sectionStyles.itinerary.variant: celestial-blue` → `timeline-paper` | documented alias | **Ana Sofía** fixture |
| Identity CSS under `themes/sections/**` (`.event--*`) | Luna, América, Leah, Xareni | **Valentina** (`_xv-valentina-hernandez.scss`, profile re-export) |
| Dead / wrong-field structural declarations that still resolve via theme fallback | theme fallbacks generally | Demos placing `gifts.structuralVariant` / `thankYou.structuralVariant` on **section roots** while adapter reads only `sectionStyles.*.structuralVariant` (schemas strip root keys). Effective values currently match theme fallbacks coincidentally for editorial/celestial demos |
| Gallery dual layout/skin authority | all gallery consumers | Concrete dual-path consumer: `demo-boda-jewelry-box-wedding` (`gallery.variant: 'jewelry-box-wedding'` → layout `uniform-grid`, visual `jewelry-box-wedding`) |
| Identity Location / nav / seal | Luna, Leah, Xareni | No new slug/eventType branches found beyond audit; Xareni also surfaces via `labels.ts` `supportsXareniPresentationOptions` using `isXareniAssetSlug` |

Not expanded into Goal 2: unrelated visual polish, Abril 2×2 exception, jewelry-box storyboard
promotion, new structural variants, template `master.json` redesign.

---

## 4. Goal 2 implementation delta

### 4.1 Actions (mechanism → consumers → authority → class → target → Legacy → migration → regression)

| mechanism | active consumers | current authority | defect class | canonical target | Legacy dependency | required migration | regression evidence required |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Victoria Personalized Access `ornamented` + CSS-hidden ornaments | `victoria-y-roberto` | content `rsvp.personalizedAccess.structuralVariant` + profile hide | Presentation concern / incorrect selection | `structuralVariant: 'standard'` | none for this row | Content change only | Victoria payload + DOM (no ornament nodes) + mobile/desktop pass skin QA |
| Victoria itinerary theme-name `data-variant` | `victoria-y-roberto` | adapter theme fallback (`jewelry-box-wedding`) | Duplicate mechanism | `itinerary.presentation.behavior: 'standard'` (TimelineList) | theme-name fallback retained for others | Explicit presentation in managed definition | Victoria payload/adapter assert `variant === 'standard'`; visual ledger remains profile-owned |
| Romina itinerary theme-name `data-variant` | `romina-rios-chaparro` | adapter theme fallback (`premiere-floral`) | Duplicate mechanism (same class) | `itinerary.presentation.behavior: 'standard'` | theme-name fallback retained for legacy/demos | Explicit presentation in managed definition | Romina payload/adapter; **no intentional visual change** |
| Victoria visual refinement (profile/tokens only) | `victoria-y-roberto` | invitation profile SCSS | Legitimate invitation-specific styling (authorized Goal 2) | Keep existing structural contracts from audit §5 | n/a | Profile/token/crop/spacing only; no new structural variant | Desktop/mobile visual QA for touched sections |
| Luna Location identity policy | `luna-y-estrella` | `location-policy.ts` slug+eventType | Needs decoupling | Explicit location visibility/capability in content; delete identity branch after migration | Identity branch until Luna migrated | Fixture content capability + remove branch when tests green | location-policy unit + Luna public render-plan (Location omitted/gated as today) |
| Leah navigation override | `leah-lexa` | `canonical-navigation.ts` slug map | Needs decoupling | Content/profile nav metadata | Slug map until empty | Move override data out of shared map | Leah nav unit + route smoke |
| Leah / Luna / América / Xareni / **Valentina** identity CSS in `themes/sections` | those five fixtures (+ profile re-exports) | shared theme-section ownership | Needs decoupling | Invitation profile / event override boundary | Shared partials until relocated | Relocate `.event--*` rules; preserve pixels | style-boundary tests + targeted desktop/mobile screenshots per relocated invitation |
| Xareni seal / presentation identity | `xareni-iyarit` (`_assetSlug: xv-xareni-iyarit`); demo xareni-profile paths | `event.ts` + `invitation-profile-css.ts` + `labels.ts` | Needs decoupling | Semantic seal/profile input; token names only in Xareni profile | Identity helpers until zero consumers | Replace identity branches after semantic field present | Xareni seal/unit + envelope smoke |
| Demo root `gifts`/`thankYou.structuralVariant` ignored | editorial-magazine, valentina-profile, celestial, xareni-profile, enchanted-rose, editorial, editorial-rose, boda (as applicable) | Zod strips root; adapter uses `sectionStyles` or theme fallback | Duplicate / wrong-field authority | Move values into `sectionStyles.*.structuralVariant` (or delete dead keys and keep explicit sectionStyles) | Theme fallback until demos explicit | Demo JSON field relocation only when touching those demos | Demo schema parse + adapter `structuralVariantExplicit` asserts; no visual redesign |
| Gallery structural/visual dual emission | all gallery consumers; dual-path exemplar wedding demo | `Gallery.astro` + `resolveGalleryLayoutVariant` / `resolveGalleryVisualVariant` | Duplicate mechanism | Always emit layout on `data-structural-variant`; skin on `data-variant` | Dual selectors until CSS migrated | Only if Goal 2 edits gallery CSS/emit path; otherwise defer | gallery resolver-map + wedding demo layout/skin attrs |

### 4.2 Final list — must migrate to explicit canonical contracts in Goal 2

1. **`victoria-y-roberto`** — Personalized Access → `standard`; Itinerary → `presentation.behavior: 'standard'`; profile visual refinement per audit §5.  
2. **`romina-rios-chaparro`** — Itinerary → `presentation.behavior: 'standard'` (contract hygiene only; preserve appearance).  
3. **Identity-bound fixtures when ownership work is executed:** `luna-y-estrella`, `leah-lexa`, `america-johana`, `xareni-iyarit`, **`valentina-hernandez`** (CSS boundary), with Luna policy + Leah nav + Xareni seal as named shared-code migrations.  
4. **Demos with dead root structural fields** — only when Goal 2 touches those demo files or retires a fallback they coincidentally rely on; minimum is relocate declarations into `sectionStyles`.

Already explicit / no Goal 2 contract migration required:

- Alba Location/Countdown/Gifts presentation; Romina Hero; Abril itinerary `timeline-paper`; Daniela/Victoria Family `split-groups` + Gallery `single-keepsake`; managed gifts/rsvp/thankYou `sectionStyles` structural values where already set.

### 4.3 Legacy / compatibility — removal eligibility

| Mechanism | Active consumers | Canonical replacement | Migrate in Goal 2? | Removable immediately after Goal 2 validation? | Retention reason if not |
| --- | --- | --- | --- | --- | --- |
| Itinerary theme-name fallback | Romina+Victoria (pre-migration), all itinerary legacy fixtures, most demos | `itinerary.presentation.behavior` | Managed Romina+Victoria only | **No** — legacy/demo consumers remain | Named legacy/demo consumers |
| `celestial-blue` → `timeline-paper` alias | Ana Sofía (+ any remaining celestial legacy style) | explicit `timeline-paper` | Optional fixture hygiene | **No** until Ana Sofía (+ others) migrated | Ana Sofía |
| Theme structural fallbacks (Hero/Gifts/RSVP/Access/ThankYou/Gallery) | Valentina + most legacy/demos without explicit structural | explicit `structuralVariant` / gallery layout | Not whole-corpus in Goal 2 | **No** | Broad legacy/demo set |
| Gallery dual `data-variant` / structural attr | all gallery consumers | always-on structural attr + visual skin | Only if gallery emit/CSS touched | **No** until dual CSS selectors gone | Broad corpus |
| Jewelry-box wedding nth-child storyboard | wedding demo / jewelry-box-wedding gallery path | future layout variant only with second consumer | **No** (deferred) | **No** | Active wedding demo consumer |
| Luna slug Location policy | Luna | content capability | Yes (bounded) | **Yes, only after** Luna content+tests prove zero identity branch use | — |
| Leah nav slug map | Leah | content/profile nav | Yes (bounded) | **Yes, only after** map empty | — |
| Xareni `isXareniAssetSlug` / `--xareni-*` bridge | Xareni fixture (+ label helper / demo asset slug paths) | semantic seal/profile input | Yes (bounded) | **Yes, only after** zero `isXareniAssetSlug` consumers | — |
| Abril profile `uniform-grid` 2×2 | Abril only | documented exception | **No** | n/a retain | Single-invitation exception |

No zero-consumer Legacy path was found among the audited mechanisms. Nothing is recommended for
removal “just in case,” and **nothing is removed in this goal**.

### 4.4 Legitimate invitation/profile styling that must remain unchanged

- Abril local `uniform-grid` 2×2 composition/crops.  
- Daniela/Victoria/Romina/Alba profile tokens that do not own canonical structural geometry.  
- Victoria thank-you desktop grid and itinerary ledger skin (profile-owned; refine only for Victoria).  
- Intersection maps keyed by `visualProfileId` (composition metadata, not structural variants).  
- Approved appearances of all non-Victoria invitations during Goal 2 (Romina itinerary explicitness
  must be visually neutral).

---

## 5. Validation strategy for Goal 2

**Contract-level (required for every migration row):**

- Managed/demo/fixture payload or adapter asserts for declared → effective contracts.  
- Existing suites: Alba/Romina payloads, itinerary-adapter-contract, structural-variants,
  section-css-resolver-map, location-policy, style-boundaries, variant governance.  
- `pnpm validate:changed` on touched surfaces; escalate per gatekeeper if shared resolvers/CSS move.

**Visual (only where risk is material):**

- Victoria refined sections (desktop + mobile).  
- Any invitation whose CSS ownership relocates (Luna, Leah, América, Xareni, Valentina).  
- Any resolver/fallback change that alters emitted `data-*` for a consumer whose profile CSS keys
  off the old attribute.  
- Not required for Romina/Victoria itinerary explicit-`standard` if renderer remains TimelineList and
  profile/theme skins still apply equivalently — prove with adapter/DOM attrs first; screenshot only
  if attrs or cascade diverge.

---

## 6. Goal 2 proceed / stop conditions

Goal 2 may proceed directly from this delta + the prior audit when implementing only:

1. Victoria contract fixes + authorized visual refinement;  
2. Romina explicit itinerary `standard`;  
3. Bounded identity ownership migrations for the named fixtures (including Valentina as the extra
   same-class CSS consumer);  
4. Demo `sectionStyles` field corrections if those demos are touched.

Stop and re-open discovery only if implementation evidence shows a **new** defect class, a
second-invitation reusable structural composition requiring a new variant, or a consumer of an
identity branch not listed above.

### Completion criteria mapping

1. Active consumers of affected shared mechanisms accounted — **yes** (§1).  
2. Alba/Romina divergences traced declared→effective — **yes** (§2).  
3. Additional in-scope findings are same defect classes — **yes** (§3).  
4. Every Goal 2 migration has target + consumers — **yes** (§4.1–4.2).  
5. Every Legacy path has migrate/remove path or named retainer — **yes** (§4.3).  
6. Legitimate profile styling separated — **yes** (§4.4).  
7. No new infrastructure/variant/abstraction proposed — **yes**.  
8. Goal 2 can start without further architecture discovery — **yes**.
