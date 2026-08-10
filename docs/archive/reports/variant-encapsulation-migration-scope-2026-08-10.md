# Goal 1 — Remaining Variant Encapsulation Migration Scope

**Date:** 2026-08-10  
**Mode:** diagnostic audit only — no runtime, SCSS, content, schema, or production mutation.  
**Authority:** current repository state. Historical Production commit
`e54c42160d486ed07d6f047fd1657056541692b9` was consulted only as optional design-intent context; it
does not override current contracts. Prior audits
(`render-parity-ownership-audit-2026-08-10.md`, Goal B canonicalization) are evidence, not policy.

## 1. Confirmed repository evidence

### 1.1 Canonical inventory (already present)

`docs/domains/theme/variant-system.md` and `src/lib/invitation/structural-variants.ts` already own
the structural inventory. Goal B closed and portability-validated:

| Section | Canonical mechanism | Renderer / CSS owner |
| --- | --- | --- |
| Hero | `hero.structuralVariant`: `standard`, `editorial-cover`, `split-cover` | `Hero.astro` (+ `EditorialMagazineHero.astro`); `_split-cover.scss`, `_editorial-magazine.scss` |
| Thank You | `sectionStyles.thankYou.structuralVariant`: `standard`, `editorial-back-cover`, `full-bleed-photo` | `ThankYou.astro` + section structural CSS |
| Gifts | `sectionStyles.gifts.structuralVariant`: `standard`, `editorial-catalog` | `Gifts.astro` |
| RSVP | `sectionStyles.rsvp.structuralVariant`: `standard`, `editorial-press-pass` | RSVP components |
| Personalized Access | `rsvp.personalizedAccess.structuralVariant`: `standard`, `ornamented`, `editorial-pass` | `PersonalizedAccess.astro` |
| Family | `family.structuralVariant`: `standard`, `split-groups` | `Family.astro` + `family/_split-groups.scss` |
| Location | `location.structuralVariant`: `standard`, `split-map` | `EventLocation.astro` / `VenueCard.astro` + `location/_split-map.scss` |
| Gallery layout | `gallery.variant` layout IDs (`uniform-grid`, `editorial-mosaic`, `magazine-spread`, `feature-mosaic`, `index-choreography`, `single-keepsake`) | `Gallery.astro` / `PhotoGallery.astro`; `single-keepsake` geometry in `invitation/_gallery.scss` |
| Itinerary behavior | `itinerary.presentation.behavior`: `standard`, `timeline-paper` | `Itinerary.astro` → `TimelineList` / `ItineraryProgram` |
| Envelope seal | `resolveSealPresentation` renderer types | reveal renderer |
| Quote, Countdown, Footer, Interludes | shared implementations; no independent structural variant | presentation/skin only |

Resolution path (confirmed): content schema → `adaptEvent()` resolvers →
`buildInvitationSectionRenderDescriptors` → Astro `data-structural-variant` / presentation attrs →
`section-css-resolver(-map)`.

### 1.2 Victoria current adapted contracts

Source: `scripts/provision/invitations/victoria-y-roberto.ts` + adapter rules.

| Section | Explicit content | Effective runtime contract |
| --- | --- | --- |
| Hero | `structuralVariant: 'standard'` | `standard` |
| Quote / Countdown | shared | shared + profile skin |
| Location | no structural; `showNavigationButtons: false`; pending map URL placeholders | `standard` |
| Itinerary | no `presentation.behavior` | adapter falls back to theme preset name `jewelry-box-wedding` on `TimelineList` (not `timeline-paper`) |
| Family | `structuralVariant: 'split-groups'`, `presentation: 'text-only'` | canonical split-groups + text-only |
| Gallery | `variant: 'single-keepsake'`, one feature item | canonical single-keepsake |
| Gifts | `sectionStyles.gifts.structuralVariant: 'standard'`, one cash item | `standard` / catalog |
| Personalized Access | `structuralVariant: 'ornamented'` | markup emits ornaments; profile CSS hides ornaments/seal |
| RSVP / Thank You | `structuralVariant: 'standard'` | `standard` + profile skin |
| Intersections | profile map in `intersection-profiles.ts` | composition metadata by `visualProfileId` |

Correction to P1 parity matrix wording: Victoria Itinerary is **not** currently
`timeline-paper`. Absent canonical presentation, `buildItinerarySectionData` assigns
`variant = normalizedPreset` (`jewelry-box-wedding`) while still rendering `TimelineList`.

### 1.3 Identity / compatibility branches still active

| Mechanism | Location | Consumers |
| --- | --- | --- |
| Luna Location public-plan omission | `location-policy.ts` (`luna-y-estrella` + `primera-comunion`) | Luna legacy fixture |
| Leah navigation override | `canonical-navigation.ts` `NAV_ITEM_OVERRIDES` | `leah-lexa` |
| Xareni seal accent | `event.ts` `isXareniAssetSlug` + `invitation-profile-css.ts` `--xareni-*` names | `xareni-iyarit` |
| Leah / Luna / América / Xareni identity CSS under `themes/sections/**` | multiple partials with `.event--*` | legacy fixtures |
| Theme-named structural fallbacks | `structural-variants.ts` | demos + legacy payloads without explicit structural values |
| Gallery dual `data-variant` / `data-structural-variant` | `Gallery.astro`, gallery theme SCSS | all gallery consumers |
| Jewelry-box wedding nth-child storyboard | `gallery/_jewelry-box.scss` under `data-variant='jewelry-box-wedding'` | wedding gallery theme path |
| Abril local `uniform-grid` 2×2 | profile SCSS | Abril only (documented exception) |
| Intersection maps by profile id | `intersection-profiles.ts` | Abril, Alba, Daniela, Victoria, demo celestial |

### 1.4 Visual regression contract (must remain unchanged unless Goal 2 authorizes Victoria)

Preserve currently approved appearance/behavior for all published and fixture invitations. Goal 2 may
visually refine **only** `victoria-y-roberto`. Do not change Romina/Alba/Daniela/Abril/legacy
fixtures merely to simplify ownership.

---

## 2. Architectural conclusions

1. **Core structural encapsulation for Goal B variants is complete.** `split-cover`,
   `split-groups`, and `split-map` are section-owned, identity-free, and portability-tested.
   Family/Gallery single-keepsake geometry for Victoria/Daniela is already canonical.
2. **Remaining work is not “invent new variants.”** It is bounded cleanup of:
   - dual/legacy selection paths (Gallery, Itinerary theme-as-variant, theme structural fallbacks);
   - identity branches that still live in shared adapters/CSS;
   - profile geometry that is either a documented one-off exception or not yet proven reusable.
3. **High fan-in or large profile files alone do not justify splits.** Extraction requires a second
   reusable content contract or a proven identity leak into a shared structural owner.
4. **Presentation must not be promoted to structure without markup/renderer necessity.** Victoria’s
   itinerary ledger restyle and thank-you desktop grid are profile compositions over shared markup;
   `timeline-paper` / new thank-you variants are not justified by current evidence.
5. **Victoria’s only structural selection mismatch with desired visual outcome is Personalized
   Access `ornamented` while the profile suppresses ornaments.** Prefer `standard`.

---

## 3. Final migration matrix

Classification key (exactly one primary class per row):

- **Canonical** — correctly owned; no migration.
- **Needs extraction** — reusable structure remains outside the canonical variant.
- **Needs decoupling** — canonical/shared mechanism still depends on inappropriate identity/context.
- **Duplicate mechanism** — multiple active mechanisms implement the same responsibility.
- **Presentation concern** — should use presentation/layout-role/token/skin, not new structure.
- **Legitimate invitation-specific styling** — theme/profile visual ownership; keep.

| section | current mechanism | classification | confirmed issue | target canonical mechanism | ownership | required change | affected invitations | validation strategy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hero | `hero.structuralVariant` + theme fallback `editorial-magazine`→`editorial-cover` | Canonical | None for explicit path; theme fallback is documented compatibility only | Keep `hero.structuralVariant`; retain fallback until zero-consumer proof | section contract + `structural-variants.ts` | None for encapsulation; retire theme fallback only after repo-wide zero dependency | demos/legacy without explicit hero structural | existing structural-variants + portability suites |
| Hero (Luna identity geometry) | `.event--luna-y-estrella` hero grid in `themes/sections/_luna-y-estrella.scss` | Needs decoupling | Identity-owned hero geometry lives under shared theme sections, not profile boundary | Move selectors to invitation/profile override entrypoint; do **not** invent a Hero variant unless a second invitation proves the composition | profile/event override | Relocate CSS; keep visual result identical | `luna-y-estrella` | style-boundary + Luna content/route visual check |
| Hero (América identity geometry) | `_xv-america-johana.scss` rewrites celestial hero structure | Needs decoupling | Legacy profile-as-renderer under themes/sections | Profile/event override boundary only; no new structural variant without second reusable contract | profile/event override | Relocate/limit selectors; preserve appearance | `america-johana` | style-boundary + América fixture render |
| Thank You | `sectionStyles.thankYou.structuralVariant` + theme fallbacks | Canonical | None for encapsulation of existing variants | Keep contract; theme fallbacks remain compatibility | section contract | None unless retiring aliases after zero-consumer search | demos/legacy | structural-variants / resolver-map |
| Thank You (Victoria desktop grid) | Profile `grid-template-areas` photo/message/signature in `victoria-y-roberto.scss` | Legitimate invitation-specific styling | Local composition over shared thank-you markup; only one invitation proves this arrangement | Keep as profile skin/tokens; **do not** add a Victoria-only structural variant | invitation profile | Goal 2 may refine spacing/type/crop inside profile; no structural migration | `victoria-y-roberto` | Victoria payload + desktop/mobile visual QA |
| Gifts | `structuralVariant` + `gifts.presentation` (`catalog`/`legend-only`) | Canonical | None | Keep split of structure vs presentation | section contract | None | Alba (`legend-only`), others catalog | presentation-options + Alba payload |
| RSVP | `sectionStyles.rsvp.structuralVariant` | Canonical | None | Keep | section contract | None | editorial demos / explicit standard invitations | structural-variants |
| Personalized Access | `standard` / `ornamented` / `editorial-pass`; ornaments gated in Astro (`showOrnaments = structuralVariant !== 'standard'`) | Presentation concern | `ornamented` is primarily decorative markup; Victoria selects it then CSS-hides ornaments/seal | Prefer existing `standard` (or keep `ornamented` only where ornaments are desired). Do not invent a new variant | section contract + invitation content | Victoria Goal 2: set `personalizedAccess.structuralVariant: 'standard'`; leave broader demotion of `ornamented` out of scope unless zero-risk | Victoria now; optional later inventory of ornamented consumers | Victoria payload + PersonalizedAccess DOM assert (no ornaments) |
| Family | `family.structuralVariant` + `family.presentation` | Canonical | None — Goal B complete | Keep `split-groups` / `standard` + presentation | section contract + `family/_split-groups.scss` | None | Daniela, Victoria, others | structural-variants, portability, Daniela/Victoria payloads |
| Location | `location.structuralVariant` + presentation/options | Canonical | None for Alba/Daniela contracts | Keep `standard` / `split-map` + presentation options | section contract + `location/_split-map.scss` | None | Alba (`split-map`), Daniela map-preview options, others standard | structural-variants, venue contract, Alba/Daniela payloads |
| Location policy | slug/eventType branch in `location-policy.ts` | Needs decoupling | Shared policy hardcodes Luna route identity to omit Location from public plan | Explicit location visibility/capability metadata (existing `visibility: after-rsvp` generalized); remove slug/eventType branch after content migration | location policy + content | Migrate Luna content to explicit capability; then delete identity branch | `luna-y-estrella` | location-policy tests + Luna route plan assert |
| Gallery layout | `gallery.variant` dual-acting as layout + legacy visual; conditional `data-structural-variant` only when explicit | Duplicate mechanism | Structural and visual identities still share/alias the same field and dual CSS selectors | Always emit canonical layout on `data-structural-variant`; keep theme skin on `data-variant` / visualVariant; stop requiring dual selectors in new CSS | gallery contract + Gallery.astro + gallery SCSS | Decouple emission and migrate dual selectors gradually; no new layout IDs | all gallery invitations/demos | gallery suites, section-css-resolver-map, style-boundary |
| Gallery jewelry-box storyboard | nth-child geometry under `data-variant='jewelry-box-wedding'` | Needs extraction *(deferred)* | Reusable-looking multi-item storyboard still theme-skin owned, not a layout variant | Promote only when a second invitation requires the same semantic composition; until then keep documented compatibility exception | gallery structural CSS **or** retain exception | No Goal 2 action for Victoria (she uses `single-keepsake`) | jewelry-box-wedding multi-image consumers | gallery CSS + consumer inventory before any promotion |
| Gallery Abril 2×2 | profile rules under `uniform-grid` | Legitimate invitation-specific styling | Documented one-invitation exception | Keep exception; reevaluate only with second equivalent contract | Abril profile | None | `abril-michelle-becerra-rea` | Abril payload / gallery tests |
| Gallery single-keepsake | canonical geometry in `_gallery.scss`; profiles supply tokens | Canonical | None | Keep | invitation base CSS + profiles for tokens | None | Daniela, Victoria, Leah | Victoria/Daniela payloads; gallery SCSS ownership asserts |
| Itinerary | `presentation.behavior` vs legacy `sectionStyles.itinerary.variant` vs theme-preset fallback | Duplicate mechanism | Absent presentation → theme name becomes `data-variant` while renderer remains TimelineList | Explicit `itinerary.presentation.behavior: 'standard' \| 'timeline-paper'`; theme names only as skin compatibility, not renderer selection | itinerary presentation + adapter | Make presentation explicit on managed invitations that currently rely on theme fallback; keep `timeline-paper` as the only non-standard renderer | Victoria (theme fallback today), other theme-fallback itineraries, Abril (`timeline-paper` explicit) | itinerary-adapter-contract + per-invitation payload asserts |
| Countdown | `presentationOptions.visibleUnits` | Canonical | None | Keep | countdown presentation | None | Alba days-only; others default | Alba payload + presentation-options |
| Quote / Footer / Interlude | shared + skins | Canonical | None structural | Keep | shared sections | None | corpus | existing section suites |
| Envelope seal | seal presentation resolvers + aliases | Canonical | Bounded compatibility aliases remain | Keep; retire aliases only at zero consumers | reveal-card | None for encapsulation scope | seal consumers | reveal-card contract |
| Navigation (Leah) | slug override map | Needs decoupling | Invitation identity selects nav labels/targets in shared module | Content/profile navigation metadata | canonical-navigation + content | Move Leah overrides to content/profile; delete slug map when empty | `leah-lexa` | navigation unit tests + Leah route |
| Leah section polish in themes/sections | `.event--leah-lexa` in location/gifts/gallery/header/rhythm/thank-you | Needs decoupling | Invitation-only rules in shared section modules | Invitation profile / event override entrypoint | profile CSS ownership | Move selectors; preserve pixels | `leah-lexa` | style-boundary + Leah visual smoke |
| Xareni seal tokens | adapter identity + generic CSS var name map | Needs decoupling | Shared adapter/profile bridge knows Xareni token names | Semantic seal/profile input; token names only inside Xareni profile | adapter + Xareni profile | Replace `isXareniAssetSlug` with generic semantic field when content ready | `xareni-iyarit` | adapter/unit + Xareni seal visual |
| Intersections | `visualProfileId` → intersection family map | Presentation concern | Composition metadata selected by profile identity (intentional) | Keep as presentation/composition metadata; do not model as structural variants; avoid new geometry selected only by slug | intersection-profiles + render-plan | None required for encapsulation; optional later content-owned intersection fields | Abril, Alba, Daniela, Victoria, demo celestial | intersection-profiles tests + render-plan |
| Theme structural fallbacks (Hero/Gifts/RSVP/Access/ThankYou/Gallery) | `resolve*StructuralVariant(..., themePreset)` | Duplicate mechanism | Theme still selects structure when explicit value absent | Explicit structural values in managed content; theme fallback retained only as named compatibility with retirement condition | structural-variants + managed definitions | Inventory consumers; add explicit values where missing; do not add new theme fallbacks | demos + legacy without explicit structural | zero-dependency search + structural-variants tests |
| RSVP copy defaults by `eventType` | `rsvp-logic.ts` | Legitimate invitation-specific styling *(interaction/copy)* | Not a structural renderer dependency | Keep as copy/interaction policy | RSVP interaction | None for variant encapsulation | event-type defaults | do not reclassify as structural |

---

## 4. What must remain unchanged (regression contract)

- Romina `split-cover` Hero, Alba `split-map` Location + days-only Countdown, Daniela
  `split-groups` / map-preview / `single-keepsake`, Abril `timeline-paper` + local uniform-grid
  exception, and all approved legacy fixture appearances.
- Canonical structural CSS ownership already extracted for Goal B variants and single-keepsake.
- Client content for Victoria: couple names, quote reference, venues/times, family/godparents,
  gifts mode (lluvia de sobres), RSVP hybrid/api, five photo roles, no family photo, documented
  placeholders (`CEREMONY_MAP_URL`, `RECEPTION_MAP_URL`, dinner/toast/closing times).
- No invitation-specific structural CSS or Victoria-only structural variant may be introduced.

---

## 5. Victoria y Roberto — Goal 2 variant / presentation plan

Prefer existing canonical mechanisms. No new structural variant.

| Section | Preferred mechanism | Reason | Deficiency origin | Content constraints |
| --- | --- | --- | --- | --- |
| Hero | **Keep `standard`** | Full-bleed couple cover; `split-cover` would force a lateral contained photo incompatible with current approved composition (Goal B already rejected) | typography, spacing, focal/crop, veil/chrome tokens in profile | Preserve assigned hero assets + focals |
| Quote | Shared + profile skin | No structural variant exists or is needed | type/spacing/separators | Keep Eclesiastés 4:9–12 meaning; wording may refine only if already allowed by prep docs |
| Countdown | Shared default units | No structural alternative; days-only is Alba-specific presentation | spacing/type tokens | Keep footer geography copy |
| Location | **Keep `standard`** + current presentationOptions | Two venues; map URLs still placeholders; `split-map` needs map/media materiality Victoria does not have | content placeholders + profile polish, not wrong variant | Do not invent maps/coords; keep `showNavigationButtons: false` until real URLs exist |
| Itinerary | **Keep TimelineList via explicit `presentation.behavior: 'standard'`** (or equivalent explicit standard); **do not switch to `timeline-paper`** | Profile already composes a ledger on TimelineList; `timeline-paper` swaps in `ItineraryProgram` markup and would redesign, not refine | presentation/spacing + pending time placeholders; also stop theme-name variant leakage | Preserve five planned items and placeholder times |
| Family | **Keep `split-groups` + `text-only`** | Exact match to two parent groups + padrinos without photo; geometry already canonical | profile tokens only | No family photograph (OD7) |
| Gallery | **Keep `single-keepsake`** | One feature portrait; multi-grid / jewelry-box storyboard would invent fill images | crop/focal/label tokens | One item; `layoutRole: feature` |
| Gifts | **Keep `standard` / catalog** with single cash item | `legend-only` would omit the item card Victoria uses for lluvia de sobres | low-chrome skin tokens | No registry URLs |
| Personalized Access | **Switch to `standard`** | Current `ornamented` is contradicted by profile hiding ornaments/seal; `standard` matches desired low-chrome pass | incorrect structural selection for desired presentation | Preserve noteText placeholders `{count}` / `{personWord}` |
| RSVP | **Keep `standard`** | No editorial press-pass content/theme requirement | surface/type/button tokens | Keep hybrid + api |
| Thank You | **Keep `standard`** | Desktop photo/message grid is profile composition; `editorial-back-cover` / `full-bleed-photo` would change structure without client need | typography, spacing, imagery/crop, local grid polish | Preserve thank-you asset + closing names/date |
| Interludes / intersections | Keep current afterSection + overlap/atmospheric map | Composition metadata, not structural variants | optional Goal 2 pacing polish only inside existing families | Keep two interludes; do not invent slug-specific structural CSS |

### Victoria Goal 2 implementation checklist (derived; no audit rework)

1. Content: set Personalized Access structural variant to `standard`.
2. Content: set explicit `itinerary.presentation.behavior: 'standard'` to remove theme-fallback
   ambiguity (renderer stays TimelineList).
3. Profile/token refinement only for Hero, Quote, Countdown, Location, Itinerary ledger skin,
   Gallery keepsake tokens, Gifts/RSVP chrome, Thank You composition — without new structural
   variants or slug-specific structural CSS in shared modules.
4. Do not apply `split-cover`, `split-map`, or `timeline-paper`.
5. Validate with Victoria payload tests, focused desktop/mobile visual QA, and
   `pnpm validate:changed` (escalate per gatekeeper if shared contracts change).

---

## 6. Goal 2 scope boundary (from this audit)

### In scope for encapsulation / decoupling follow-through

1. Victoria optimization per §5 (authorized visual refinement invitation).
2. Bounded ownership migrations already confirmed by P1 and reconfirmed here: Luna policy, Leah
   nav/SCSS, Xareni seal-token knowledge, identity CSS relocation out of shared `themes/sections`
   when touched.
3. Optional but evidence-backed hygiene: explicit itinerary presentation on managed invitations that
   currently inherit theme-named variants; Gallery structural/visual attribute decoupling when
   editing gallery CSS.

### Explicitly out of scope

- New structural variants (including Victoria-specific).
- Promoting Abril 2×2 or jewelry-box wedding storyboard without a second reusable consumer.
- Production/content mutation for published invitations except where a separate guarded release task
  authorizes it.
- Visual redesign of non-Victoria invitations.
- Speculative registries/factories/services.

---

## 7. Evidence vs conclusions vs recommendations

| Kind | Contents |
| --- | --- |
| **Confirmed evidence** | §1 inventory, adapter/resolver paths, Victoria provision fields, profile selectors, identity branch file paths, Goal B completion record, itinerary theme-fallback behavior |
| **Conclusions** | §2 — Goal B encapsulation complete; remaining work is decoupling/duplication/ownership; Victoria needs presentation/selection fixes, not new structure |
| **Goal 2 recommendations** | §3 actionable rows + §5 Victoria plan + §6 scope boundary |

## Completion checklist

1. Every relevant active structural/presentation mechanism classified — **yes** (§3).
2. Every remaining encapsulation/decoupling/duplication/ownership issue has an evidence-backed
   target — **yes** (§3).
3. No proposed migration depends on invitation identity/theme/profile/eventType/fixed order unless
   marked as legitimate non-structural or named compatibility — **yes**.
4. Existing visual behavior to preserve identified — **yes** (§4).
5. Victoria plan uses existing canonical mechanisms and preserves client constraints — **yes** (§5).
6. Goal 2 can implement from this report without repeating the architectural audit — **yes**.
