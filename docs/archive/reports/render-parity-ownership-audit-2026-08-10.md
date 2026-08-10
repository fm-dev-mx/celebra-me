# Render Parity and Invitation-Agnostic Ownership Audit

**Date:** 2026-08-10  
**Scope:** P1 diagnostic and governance audit; no runtime, SCSS, content, or invitation-config
changes were made.

## Scope and evidence

The audit used the canonical managed registry, the Local Render Corpus registry, the sanitized
legacy fixtures, the render-plan/descriptor path, and the current section renderer/CSS entrypoints.
The corpus was **15 invitations**: 5 managed definitions (3 published and 2 `in_progress`) plus 10
supported legacy fixtures. The 13-entry Local Render Corpus remains the Production render SSOT: 3
published managed definitions and 10 legacy fixtures. `in_progress` definitions are intentionally
excluded from that Production corpus. Three demos (`jewelry-box`, `editorial-magazine`, and
`celestial-blue`) were used only as representative portability controls, not as client rows.

The semantic matrix below counts Hero plus every section emitted by the public render plan. The
`personalizedAccess` block, interludes, and music are auxiliary render blocks and are audited below,
not duplicated as semantic sections. Luna's configured Location is retained as a matrix row because
the policy intentionally removes it from the public plan; that is an intentional behavior
difference, not missing corpus data.

Trace shorthand:

- `C` = canonical definition or sanitized fixture content.
- `A` = adapter normalization and `buildInvitationRenderPlan`.
- `D` = `buildInvitationSectionRenderDescriptors` and the section component mapping.
- `R` = Astro renderer output (`data-structural-variant` where applicable) plus the delivered
  section/profile CSS entrypoint.

The matrix is a deterministic contract audit. It observes source values, adapter view-model values,
render-plan descriptors, renderer attributes, and CSS ownership; it is not a pixel-screenshot claim
or an environment/deployment parity result. The follow-up browser comparison is recorded in the
[P1.1 environment reconciliation addendum](render-parity-environment-reconciliation-2026-08-10.md).

## Parity matrix

Every row is one invitation × rendered semantic section. Statuses are mutually exclusive: `MATCH`,
`INTENTIONAL_CHANGE`, `KNOWN_DEFECT`, `REGRESSION`, or `INSUFFICIENT_EVIDENCE`.

| Invitation                  | Section   | Trace                                            | Observed result          | Status             |
| --------------------------- | --------- | ------------------------------------------------ | ------------------------ | ------------------ |
| alba-rosa-quinonez          | Hero      | C.hero → A → R.Hero                              | standard contract        | MATCH              |
| alba-rosa-quinonez          | Countdown | C.presentationOptions → A → D → R.Countdown      | days only                | MATCH              |
| alba-rosa-quinonez          | Location  | C.structuralVariant → A → D → R.EventLocation    | split-map                | MATCH              |
| alba-rosa-quinonez          | Gallery   | C.gallery → A → D → R.Gallery                    | feature-mosaic           | MATCH              |
| alba-rosa-quinonez          | Gifts     | C.presentation → A → D → R.Gifts                 | legend-only              | MATCH              |
| alba-rosa-quinonez          | RSVP      | C.rsvp → A → D → R.RSVP                          | descriptor present       | MATCH              |
| alba-rosa-quinonez          | Family    | C.family → A → D → R.Family                      | descriptor present       | MATCH              |
| alba-rosa-quinonez          | Thank You | C.thankYou → A → D → R.ThankYou                  | descriptor present       | MATCH              |
| abril-michelle-becerra-rea  | Hero      | C.hero → A → R.Hero                              | standard contract        | MATCH              |
| abril-michelle-becerra-rea  | Quote     | C.quote → A → D → R.Quote                        | descriptor present       | MATCH              |
| abril-michelle-becerra-rea  | Family    | C.family → A → D → R.Family                      | descriptor present       | MATCH              |
| abril-michelle-becerra-rea  | Countdown | C.countdown → A → D → R.Countdown                | default units            | MATCH              |
| abril-michelle-becerra-rea  | Location  | C.location → A → D → R.EventLocation             | standard                 | MATCH              |
| abril-michelle-becerra-rea  | Itinerary | C.presentation → A → D → R.Itinerary             | timeline-paper           | MATCH              |
| abril-michelle-becerra-rea  | Gallery   | C.gallery → A → D → R.Gallery                    | uniform-grid             | MATCH              |
| abril-michelle-becerra-rea  | Gifts     | C.gifts → A → D → R.Gifts                        | catalog                  | MATCH              |
| abril-michelle-becerra-rea  | RSVP      | C.rsvp → A → D → R.RSVP                          | descriptor present       | MATCH              |
| abril-michelle-becerra-rea  | Thank You | C.thankYou → A → D → R.ThankYou                  | descriptor present       | MATCH              |
| daniela-y-martin            | Hero      | C.hero → A → R.Hero                              | standard contract        | MATCH              |
| daniela-y-martin            | Quote     | C.quote → A → D → R.Quote                        | descriptor present       | MATCH              |
| daniela-y-martin            | Countdown | C.countdown → A → D → R.Countdown                | default units            | MATCH              |
| daniela-y-martin            | Location  | C.presentation/options → A → D → R.EventLocation | map preview              | MATCH              |
| daniela-y-martin            | Family    | C.family → A → D → R.Family                      | descriptor present       | MATCH              |
| daniela-y-martin            | Gallery   | C.gallery → A → D → R.Gallery                    | single-keepsake          | MATCH              |
| daniela-y-martin            | Gifts     | C.gifts → A → D → R.Gifts                        | catalog                  | MATCH              |
| daniela-y-martin            | RSVP      | C.rsvp → A → D → R.RSVP                          | descriptor present       | MATCH              |
| daniela-y-martin            | Thank You | C.thankYou → A → D → R.ThankYou                  | descriptor present       | MATCH              |
| romina-rios-chaparro        | Hero      | C.structuralVariant → A → R.Hero                 | split-cover              | MATCH              |
| romina-rios-chaparro        | Quote     | C.quote → A → D → R.Quote                        | descriptor present       | MATCH              |
| romina-rios-chaparro        | Family    | C.family → A → D → R.Family                      | descriptor present       | MATCH              |
| romina-rios-chaparro        | Countdown | C.countdown → A → D → R.Countdown                | default units            | MATCH              |
| romina-rios-chaparro        | Location  | C.location → A → D → R.EventLocation             | standard                 | MATCH              |
| romina-rios-chaparro        | Itinerary | C.presentation → A → D → R.Itinerary             | timeline-paper           | MATCH              |
| romina-rios-chaparro        | Gallery   | C.gallery → A → D → R.Gallery                    | uniform-grid             | MATCH              |
| romina-rios-chaparro        | RSVP      | C.rsvp → A → D → R.RSVP                          | descriptor present       | MATCH              |
| romina-rios-chaparro        | Thank You | C.thankYou → A → D → R.ThankYou                  | descriptor present       | MATCH              |
| victoria-y-roberto          | Hero      | C.hero → A → R.Hero                              | standard contract        | MATCH              |
| victoria-y-roberto          | Quote     | C.quote → A → D → R.Quote                        | descriptor present       | MATCH              |
| victoria-y-roberto          | Countdown | C.countdown → A → D → R.Countdown                | default units            | MATCH              |
| victoria-y-roberto          | Location  | C.location → A → D → R.EventLocation             | standard                 | MATCH              |
| victoria-y-roberto          | Itinerary | C.presentation → A → D → R.Itinerary             | timeline-paper           | MATCH              |
| victoria-y-roberto          | Family    | C.family → A → D → R.Family                      | descriptor present       | MATCH              |
| victoria-y-roberto          | Gallery   | C.gallery → A → D → R.Gallery                    | single-keepsake          | MATCH              |
| victoria-y-roberto          | Gifts     | C.gifts → A → D → R.Gifts                        | catalog                  | MATCH              |
| victoria-y-roberto          | RSVP      | C.rsvp → A → D → R.RSVP                          | descriptor present       | MATCH              |
| victoria-y-roberto          | Thank You | C.thankYou → A → D → R.ThankYou                  | descriptor present       | MATCH              |
| america-johana              | Hero      | C.hero → A → R.Hero                              | standard contract        | MATCH              |
| america-johana              | Quote     | C.quote → A → D → R.Quote                        | descriptor present       | MATCH              |
| america-johana              | Family    | C.family → A → D → R.Family                      | descriptor present       | MATCH              |
| america-johana              | Countdown | C.countdown → A → D → R.Countdown                | default units            | MATCH              |
| america-johana              | Location  | C.location → A → D → R.EventLocation             | standard                 | MATCH              |
| america-johana              | Itinerary | C.itinerary → A → D → R.Itinerary                | descriptor present       | MATCH              |
| america-johana              | Gallery   | C.gallery → A → D → R.Gallery                    | descriptor present       | MATCH              |
| america-johana              | Gifts     | C.gifts → A → D → R.Gifts                        | catalog                  | MATCH              |
| america-johana              | RSVP      | C.rsvp → A → D → R.RSVP                          | descriptor present       | MATCH              |
| america-johana              | Thank You | C.thankYou → A → D → R.ThankYou                  | descriptor present       | MATCH              |
| valentina-hernandez         | Hero      | C.hero → A → R.Hero                              | standard contract        | MATCH              |
| valentina-hernandez         | Quote     | C.quote → A → D → R.Quote                        | descriptor present       | MATCH              |
| valentina-hernandez         | Family    | C.family → A → D → R.Family                      | descriptor present       | MATCH              |
| valentina-hernandez         | Countdown | C.countdown → A → D → R.Countdown                | default units            | MATCH              |
| valentina-hernandez         | Itinerary | C.itinerary → A → D → R.Itinerary                | descriptor present       | MATCH              |
| valentina-hernandez         | Location  | C.location → A → D → R.EventLocation             | standard                 | MATCH              |
| valentina-hernandez         | Gallery   | C.gallery → A → D → R.Gallery                    | descriptor present       | MATCH              |
| valentina-hernandez         | Gifts     | C.gifts → A → D → R.Gifts                        | catalog                  | MATCH              |
| valentina-hernandez         | RSVP      | C.rsvp → A → D → R.RSVP                          | descriptor present       | MATCH              |
| valentina-hernandez         | Thank You | C.thankYou → A → D → R.ThankYou                  | descriptor present       | MATCH              |
| xareni-iyarit               | Hero      | C.hero → A → R.Hero                              | standard contract        | MATCH              |
| xareni-iyarit               | Quote     | C.quote → A → D → R.Quote                        | descriptor present       | MATCH              |
| xareni-iyarit               | Family    | C.family → A → D → R.Family                      | descriptor present       | MATCH              |
| xareni-iyarit               | Countdown | C.countdown → A → D → R.Countdown                | default units            | MATCH              |
| xareni-iyarit               | Itinerary | C.itinerary → A → D → R.Itinerary                | descriptor present       | MATCH              |
| xareni-iyarit               | Location  | C.location → A → D → R.EventLocation             | standard                 | MATCH              |
| xareni-iyarit               | Gallery   | C.gallery → A → D → R.Gallery                    | descriptor present       | MATCH              |
| xareni-iyarit               | Gifts     | C.gifts → A → D → R.Gifts                        | catalog                  | MATCH              |
| xareni-iyarit               | RSVP      | C.rsvp → A → D → R.RSVP                          | descriptor present       | MATCH              |
| xareni-iyarit               | Thank You | C.thankYou → A → D → R.ThankYou                  | descriptor present       | MATCH              |
| leah-lexa                   | Hero      | C.hero → A → R.Hero                              | standard contract        | MATCH              |
| leah-lexa                   | Quote     | C.quote → A → D → R.Quote                        | descriptor present       | MATCH              |
| leah-lexa                   | Family    | C.family → A → D → R.Family                      | descriptor present       | MATCH              |
| leah-lexa                   | Location  | C.location → A → D → R.EventLocation             | standard                 | MATCH              |
| leah-lexa                   | Countdown | C.countdown → A → D → R.Countdown                | default units            | MATCH              |
| leah-lexa                   | Gifts     | C.gifts → A → D → R.Gifts                        | catalog                  | MATCH              |
| leah-lexa                   | RSVP      | C.rsvp → A → D → R.RSVP                          | descriptor present       | MATCH              |
| leah-lexa                   | Gallery   | C.gallery → A → D → R.Gallery                    | single-keepsake          | MATCH              |
| leah-lexa                   | Thank You | C.thankYou → A → D → R.ThankYou                  | descriptor present       | MATCH              |
| luna-y-estrella             | Hero      | C.hero → A → R.Hero                              | standard contract        | MATCH              |
| luna-y-estrella             | Quote     | C.quote → A → D → R.Quote                        | descriptor present       | MATCH              |
| luna-y-estrella             | Family    | C.family → A → D → R.Family                      | descriptor present       | MATCH              |
| luna-y-estrella             | Countdown | C.countdown → A → D → R.Countdown                | default units            | MATCH              |
| luna-y-estrella             | Location  | C.location + policy → A → D → R.EventLocation    | omitted from public plan | INTENTIONAL_CHANGE |
| luna-y-estrella             | RSVP      | C.rsvp → A → D → R.RSVP                          | descriptor present       | MATCH              |
| luna-y-estrella             | Thank You | C.thankYou → A → D → R.ThankYou                  | descriptor present       | MATCH              |
| cesar-ramses                | Hero      | C.hero → A → R.Hero                              | standard contract        | MATCH              |
| cesar-ramses                | Quote     | C.quote → A → D → R.Quote                        | descriptor present       | MATCH              |
| cesar-ramses                | Family    | C.family → A → D → R.Family                      | descriptor present       | MATCH              |
| cesar-ramses                | Gallery   | C.gallery → A → D → R.Gallery                    | descriptor present       | MATCH              |
| cesar-ramses                | Countdown | C.countdown → A → D → R.Countdown                | default units            | MATCH              |
| cesar-ramses                | Location  | C.location → A → D → R.EventLocation             | standard                 | MATCH              |
| cesar-ramses                | Itinerary | C.itinerary → A → D → R.Itinerary                | descriptor present       | MATCH              |
| cesar-ramses                | RSVP      | C.rsvp → A → D → R.RSVP                          | descriptor present       | MATCH              |
| cesar-ramses                | Thank You | C.thankYou → A → D → R.ThankYou                  | descriptor present       | MATCH              |
| ayrin-samantha-lerma-castro | Hero      | C.hero → A → R.Hero                              | standard contract        | MATCH              |
| ayrin-samantha-lerma-castro | Quote     | C.quote → A → D → R.Quote                        | descriptor present       | MATCH              |
| ayrin-samantha-lerma-castro | Location  | C.location → A → D → R.EventLocation             | standard                 | MATCH              |
| ayrin-samantha-lerma-castro | Countdown | C.countdown → A → D → R.Countdown                | default units            | MATCH              |
| ayrin-samantha-lerma-castro | Family    | C.family → A → D → R.Family                      | descriptor present       | MATCH              |
| ayrin-samantha-lerma-castro | Itinerary | C.itinerary → A → D → R.Itinerary                | descriptor present       | MATCH              |
| ayrin-samantha-lerma-castro | Gallery   | C.gallery → A → D → R.Gallery                    | descriptor present       | MATCH              |
| ayrin-samantha-lerma-castro | Gifts     | C.gifts → A → D → R.Gifts                        | catalog                  | MATCH              |
| ayrin-samantha-lerma-castro | RSVP      | C.rsvp → A → D → R.RSVP                          | descriptor present       | MATCH              |
| ayrin-samantha-lerma-castro | Thank You | C.thankYou → A → D → R.ThankYou                  | descriptor present       | MATCH              |
| ana-sofia-cota-guillen      | Hero      | C.hero → A → R.Hero                              | standard contract        | MATCH              |
| ana-sofia-cota-guillen      | Quote     | C.quote → A → D → R.Quote                        | descriptor present       | MATCH              |
| ana-sofia-cota-guillen      | Family    | C.family → A → D → R.Family                      | descriptor present       | MATCH              |
| ana-sofia-cota-guillen      | Countdown | C.countdown → A → D → R.Countdown                | default units            | MATCH              |
| ana-sofia-cota-guillen      | Location  | C.location → A → D → R.EventLocation             | standard                 | MATCH              |
| ana-sofia-cota-guillen      | Itinerary | C.itinerary → A → D → R.Itinerary                | descriptor present       | MATCH              |
| ana-sofia-cota-guillen      | Gallery   | C.gallery → A → D → R.Gallery                    | descriptor present       | MATCH              |
| ana-sofia-cota-guillen      | Gifts     | C.gifts → A → D → R.Gifts                        | catalog                  | MATCH              |
| ana-sofia-cota-guillen      | RSVP      | C.rsvp → A → D → R.RSVP                          | descriptor present       | MATCH              |
| ana-sofia-cota-guillen      | Thank You | C.thankYou → A → D → R.ThankYou                  | descriptor present       | MATCH              |
| ximena-meza-trasvina        | Hero      | C.hero → A → R.Hero                              | standard contract        | MATCH              |
| ximena-meza-trasvina        | Quote     | C.quote → A → D → R.Quote                        | descriptor present       | MATCH              |
| ximena-meza-trasvina        | Family    | C.family → A → D → R.Family                      | descriptor present       | MATCH              |
| ximena-meza-trasvina        | Countdown | C.countdown → A → D → R.Countdown                | default units            | MATCH              |
| ximena-meza-trasvina        | Location  | C.location → A → D → R.EventLocation             | standard                 | MATCH              |
| ximena-meza-trasvina        | Itinerary | C.itinerary → A → D → R.Itinerary                | descriptor present       | MATCH              |
| ximena-meza-trasvina        | Gallery   | C.gallery → A → D → R.Gallery                    | descriptor present       | MATCH              |
| ximena-meza-trasvina        | Gifts     | C.gifts → A → D → R.Gifts                        | catalog                  | MATCH              |
| ximena-meza-trasvina        | RSVP      | C.rsvp → A → D → R.RSVP                          | descriptor present       | MATCH              |
| ximena-meza-trasvina        | Thank You | C.thankYou → A → D → R.ThankYou                  | descriptor present       | MATCH              |
| gerardo-sesenta             | Hero      | C.hero → A → R.Hero                              | standard contract        | MATCH              |
| gerardo-sesenta             | Quote     | C.quote → A → D → R.Quote                        | descriptor present       | MATCH              |
| gerardo-sesenta             | Countdown | C.countdown → A → D → R.Countdown                | default units            | MATCH              |
| gerardo-sesenta             | Location  | C.location → A → D → R.EventLocation             | standard                 | MATCH              |
| gerardo-sesenta             | Itinerary | C.itinerary → A → D → R.Itinerary                | descriptor present       | MATCH              |
| gerardo-sesenta             | Gallery   | C.gallery → A → D → R.Gallery                    | descriptor present       | MATCH              |
| gerardo-sesenta             | Gifts     | C.gifts → A → D → R.Gifts                        | catalog                  | MATCH              |
| gerardo-sesenta             | RSVP      | C.rsvp → A → D → R.RSVP                          | descriptor present       | MATCH              |
| gerardo-sesenta             | Thank You | C.thankYou → A → D → R.ThankYou                  | descriptor present       | MATCH              |

**Matrix totals:** 140 rows: 139 `MATCH`, 1 `INTENTIONAL_CHANGE` (Luna Location), and zero
`KNOWN_DEFECT`, `REGRESSION`, or `INSUFFICIENT_EVIDENCE` parity rows. The intentional Alba days-only
countdown and Alba split-map location are explicit content contracts, not drift. The Romina
split-cover Hero is also explicit and survives adapter/page assembly.

## Required traces

### Alba Countdown

`scripts/provision/invitations/alba-rosa-quinonez.ts` publishes
`countdown.presentationOptions.visibleUnits: ['days']`. `buildCountdownSectionData` passes that
through `resolveCountdownVisibleUnits`; `CountdownTimer.astro` copies the resolved list and renders
only those units. When the option is absent, the resolver returns the default four-unit list. The
days-only result is therefore a deliberate content presentation option, not a renderer or CSS
defect. The source-to-page assertion is in `tests/content/alba-rosa-quinonez-payload.test.ts`.

### Alba Location

The published content explicitly sets `location.structuralVariant: 'split-map'` and its presentation
options. `buildLocationSectionData` resolves the structural value and carries media/venue data and
presentation options to the view model. `EventLocation.astro` emits the structural data attribute;
`VenueCard.astro` resolves media mode and navigation; the split-map entrypoint is delivered by the
section CSS resolver. The observed composition is therefore the split-map contract, not a theme-name
or slug branch. The same source-to-page test asserts the explicit value and render-plan inclusion.

### Romina Hero

Romina's published content explicitly sets `hero.structuralVariant: 'split-cover'`. The adapter's
`resolveHeroStructuralVariant` honors that value for every theme and marks it explicit. `Hero.astro`
emits `data-structural-variant="split-cover"`; `_split-cover.scss` owns the two-plane geometry
(content/image split at large widths). `editorial-cover` / `_editorial-magazine.scss` is the
separate full-bleed compatibility fallback only when the explicit value is absent and the theme
preset is `editorial-magazine`. The explicit Romina value therefore survives configuration, adapter,
page view-model, renderer attribute, CSS delivery, and profile precedence. The page-level assertion
is in `tests/content/romina-local-invitation.test.ts`; portability is covered by
`tests/unit/structural-variant-portability.test.ts`.

## Ownership-hygiene matrix

| Area                                    | Evidence                                                                               | Classification     | Correct owner / action                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------- |
| `structural-variants.ts`                | No corpus slug, event type, or profile identity; explicit values win                   | MATCH              | Keep canonical section resolver generic                                            |
| `section-css-resolver-map.ts`           | Structural entrypoints are keyed by canonical variant IDs                              | MATCH              | Keep renderer/CSS delivery boundary                                                |
| `intersection-profiles.ts`              | Profile identity selects composition-root intersections                                | INTENTIONAL_CHANGE | Legitimate profile composition root; do not generalize prematurely                 |
| `location-policy.ts`                    | `luna-y-estrella` and `primera-comunion` remove public Location and gate it after RSVP | KNOWN_DEFECT       | Compatibility policy boundary; migrate to explicit capability/visibility metadata  |
| `canonical-navigation.ts`               | `NAV_ITEM_OVERRIDES` changes labels/targets for `leah-lexa`                            | KNOWN_DEFECT       | Move navigation metadata to content/profile compatibility boundary                 |
| `event.ts` Xareni branch                | `isXareniAssetSlug` selects a seal accent in the shared adapter                        | KNOWN_DEFECT       | Keep only as a named legacy adapter exception; replace with semantic profile input |
| `invitation-profile-css.ts`             | Generic TS maps `roseGold`/seal values to `--xareni-*` CSS names                       | KNOWN_DEFECT       | Move token-name knowledge into the Xareni profile bridge/SCSS                      |
| `themes/sections/**` Leah overrides     | `event--leah-lexa` selectors in location, gifts, gallery, header, rhythm, thank-you    | KNOWN_DEFECT       | Move invitation-only rules to the profile/event override entrypoint                |
| `themes/sections/_luna-y-estrella.scss` | Invitation identity owns Hero layout rules in a shared theme sections folder           | KNOWN_DEFECT       | Move to the invitation/profile override boundary                                   |
| `rsvp-logic.ts`                         | `eventType` selects semantic copy defaults, not renderer structure                     | INTENTIONAL_CHANGE | Keep as copy/interaction policy; do not classify as structural leakage             |
| Legacy theme aliases                    | Theme names map only at adapter/schema compatibility boundaries                        | INTENTIONAL_CHANGE | Retain until zero-consumer proof and document removal blocker                      |

The `KNOWN_DEFECT` entries are ownership findings, not parity regressions. No runtime or SCSS fix is
part of P1.

## Compatibility exceptions and retirement conditions

| Exception                      | Current owner                      | Active consumer                         | Removal condition                                                                                         |
| ------------------------------ | ---------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Xareni seal accent             | adapter + profile CSS bridge       | `xareni-iyarit` legacy asset path       | All seal colors supplied as generic semantic roles; zero `isXareniAssetSlug` consumers                    |
| Luna public Location policy    | `location-policy.ts`               | `luna-y-estrella` first-communion route | Explicit content visibility/capability replaces slug/eventType branch; policy tests migrate               |
| Leah section polish            | theme section partials             | `leah-lexa` legacy fixture              | Profile/event override entrypoint owns all selectors; no `.event--leah-lexa` under shared section modules |
| Leah navigation override       | `canonical-navigation.ts`          | `leah-lexa` legacy route                | Navigation labels/targets are content/profile metadata; override map reaches zero                         |
| Gallery wedding storyboard     | profile/intersection compatibility | `jewelry-box-wedding`                   | Reusable equivalent nth-child behavior and zero legacy consumers                                          |
| Theme-named structural aliases | adapter/schema resolvers           | legacy stored payloads and demos        | Repository-wide zero-dependency search across content, tests, preview, publishing, and docs               |

## Auxiliary render blocks

`personalizedAccess` is a gated descriptor: it is available from guest context or demo preview and
is not a public semantic section without that context. Interludes are inserted after their
configured section by the render plan. Music is rendered by `MusicPlayer` outside
`InvitationSections.astro`, so it is not a section parity row. The 10 legacy fixtures contain music
in 9 cases and 27 configured interludes in total; these were checked as auxiliary blocks, not
structural renderer variants.

## Governance and follow-up

Added or updated governance coverage:

- Alba source → adapter → page assertions for days-only Countdown and split-map Location.
- Romina page-level assertion for explicit split-cover Hero.
- Variant governance tests that prevent invitation identities from entering the canonical structural
  resolver, keep legacy normalization out of section renderers, and keep this audit discoverable.
- Canonical architecture and workflow guidance now link this report and require the same ownership
  and source-to-render checks.

P2 is intentionally bounded to the confirmed ownership findings above: migrate Luna policy, Leah
navigation/SCSS, and Xareni seal-token knowledge behind explicit compatibility/profile boundaries;
add focused regression tests at each migration seam; then re-run this matrix. It does not authorize
visual redesign, content changes, renderer rewrites, or unrelated intake coupling work.

## Validation evidence

The focused contract set passed before and after the P1 assertions: local corpus regression, Alba
and Romina content contracts, family rendering, structural variant portability, structural
resolver/CSS parity, location policy, invitation architecture boundaries, and variant governance.
Final changed file validation and repository CI are recorded in the task handoff.
