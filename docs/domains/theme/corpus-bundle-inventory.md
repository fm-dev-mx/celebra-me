# Invitation CSS ownership — full inventory

**Date:** 2026-08-17  
**Scope:** Every invitation identity (canonical, Local Render Corpus, legacy fixtures, demos) and
every invitation `ThemePreset`.  
**Contract:** [`architecture.md`](architecture.md#invitation-css-ownership-normative)  
**LAYOUT gate:** [`css-visual-parity.md`](css-visual-parity.md)

This inventory supersedes “corpus-only” narrowing. Deferred canons (`renata`, `leslie-perez`) and
demo-only presets (`editorial`, `editorial-rose`, `jewelry-box`) are in scope.

## Identities (all)

| slug / id                         | render preset       | profile SCSS  | source                  |
| --------------------------------- | ------------------- | ------------- | ----------------------- |
| alba-rosa-quinonez                | luxury-hacienda     | yes           | canonical + corpus      |
| abril-michelle-becerra-rea        | premiere-floral     | yes           | canonical + corpus      |
| romina-rios-chaparro              | premiere-floral     | yes           | canonical + corpus      |
| daniela-y-martin                  | jewelry-box-wedding | yes           | canonical + corpus      |
| victoria-y-roberto                | jewelry-box-wedding | yes           | canonical + corpus      |
| renata                            | editorial           | yes           | canonical `in_progress` |
| leslie-perez                      | celestial-blue      | yes           | canonical `in_progress` |
| america-johana                    | celestial-blue      | yes           | corpus legacy           |
| valentina-hernandez               | editorial-magazine  | yes           | corpus legacy           |
| xareni-iyarit                     | celestial-blue      | yes           | corpus legacy           |
| leah-lexa                         | celestial-blue      | yes           | corpus legacy           |
| luna-y-estrella                   | angelic-presence    | yes           | corpus legacy           |
| cesar-ramses                      | sacred-keepsake     | no            | corpus legacy           |
| ayrin-samantha-lerma-castro       | enchanted-rose      | no            | corpus legacy           |
| ana-sofia-cota-guillen            | celestial-blue      | no            | corpus legacy           |
| ximena-meza-trasvina              | premiere-floral     | no            | corpus legacy           |
| gerardo-sesenta                   | luxury-hacienda     | no            | corpus legacy           |
| demo-xv-celestial-blue            | celestial-blue      | yes           | demo                    |
| demo-xv-xareni-profile            | celestial-blue      | via xareni    | demo                    |
| demo-baby-shower-celestial        | celestial-blue      | no            | demo                    |
| demo-xv-editorial                 | editorial           | no            | demo                    |
| demo-xv-editorial-rose            | editorial-rose      | no            | demo                    |
| demo-xv-editorial-magazine        | editorial-magazine  | no            | demo                    |
| demo-xv-valentina-profile         | editorial-magazine  | via valentina | demo                    |
| demo-xv-jewelry-box               | jewelry-box         | no            | demo                    |
| demo-boda-jewelry-box-wedding     | jewelry-box-wedding | no            | demo                    |
| demo-cumple-luxury-hacienda       | luxury-hacienda     | no            | demo                    |
| demo-xv-enchanted-rose            | enchanted-rose      | no            | demo                    |
| demo-bautismo-angelic-presence    | angelic-presence    | no            | demo                    |
| demo-primera-comunion-illustrated | angelic-presence    | no            | demo                    |

## Preset → consumers

### celestial-blue

- leslie-perez
- america-johana
- xareni-iyarit
- leah-lexa
- ana-sofia-cota-guillen
- demo-xv-celestial-blue
- demo-xv-xareni-profile
- demo-baby-shower-celestial

### premiere-floral

- abril-michelle-becerra-rea
- romina-rios-chaparro
- ximena-meza-trasvina

### jewelry-box-wedding

- daniela-y-martin
- victoria-y-roberto
- demo-boda-jewelry-box-wedding

### jewelry-box

- demo-xv-jewelry-box

### luxury-hacienda

- alba-rosa-quinonez
- gerardo-sesenta
- demo-cumple-luxury-hacienda

### editorial-magazine

- valentina-hernandez
- demo-xv-editorial-magazine
- demo-xv-valentina-profile

### editorial

- renata
- demo-xv-editorial

### editorial-rose

- demo-xv-editorial-rose

### angelic-presence

- luna-y-estrella
- demo-bautismo-angelic-presence
- demo-primera-comunion-illustrated

### sacred-keepsake

- cesar-ramses

### enchanted-rose

- ayrin-samantha-lerma-castro
- demo-xv-enchanted-rose

## Bundle classification (actionable)

| preset              | theme-base           | countdown surface                                | notes                                 |
| ------------------- | -------------------- | ------------------------------------------------ | ------------------------------------- |
| celestial-blue      | merged (removed)     | `--countdown-section-*` + RSVP/PA/thank-you/hero | section module geometry remains       |
| jewelry-box         | merged (removed)     | `--countdown-section-background`                 | jeweled-panel                         |
| jewelry-box-wedding | none                 | same jeweled-panel tokens                        | mega LAYOUT retained                  |
| premiere-floral     | none                 | `--countdown-bg` / `--section-padding-block`     | romina countdown via `--countdown-bg` |
| editorial           | absorbed into preset | `--countdown-bg` / `--section-padding-block`     | includes renata                       |
| editorial-magazine  | none                 | `--countdown-bg` already                         | mega LAYOUT retained                  |
| editorial-rose      | none                 | n/a                                              | gallery bg on preset only             |
| luxury-hacienda     | absorbed into preset | `--countdown-section-*`                          | mega LAYOUT retained                  |
| angelic-presence    | none                 | `--countdown-section-*`                          |                                       |
| sacred-keepsake     | none                 | `--countdown-section-*`                          | no profile SCSS                       |
| enchanted-rose      | none                 | `--countdown-section-*`                          | no profile SCSS                       |

## LAYOUT deletion policy

Profile LAYOUT removal (geometry / direct section `background` / `font-family` paint) requires
`pnpm screenshot:css-parity` for that slug. Token-only remaps and dead-selector removal do not.

### Progress (2026-08-17)

- `leah-lexa`: thank-you section padding moved to `--thank-you-section-padding`; css-parity
  baseline+compare **passed**. Remaining child LAYOUT (gifts CTA, thank-you editorial chrome,
  location map max-height) still retained.
- `theme-base/_editorial.scss` and `theme-base/_luxury-hacienda.scss`: fully absorbed into presets;
  `theme-base/` directory empty/removed.
- Baselines captured under `.tmp/css-visual-parity/<slug>/baseline/` (local artifacts, not
  committed) for: `leah-lexa`, `america-johana`, `abril-michelle-becerra-rea`,
  `alba-rosa-quinonez`, `daniela-y-martin`, `victoria-y-roberto`, `valentina-hernandez`,
  `luna-y-estrella`, `demo-xv-celestial-blue`, `renata`.

### Still LAYOUT-retained (needs per-slug promote + compare)

`daniela-y-martin`, `victoria-y-roberto`, `alba-rosa-quinonez`, `valentina-hernandez`,
`abril-michelle-becerra-rea`, `america-johana`, `demo-xv-celestial-blue`, `renata`.
