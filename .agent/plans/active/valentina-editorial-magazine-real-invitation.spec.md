---
title: Valentina Hernández XV — Editorial-Magazine Real Invitation
status: draft
created: 2026-06-27
updated: 2026-06-27 (SQL continuation section added 2026-06-27)
supersedes:
  - .agent/plans/active/valentina-hernandez-xv-invitation.spec.md
related_plans:
  - .agent/plans/active/editorial-magazine-theme.spec.md
  - .agent/plans/active/xv-valentina-hernandez-asset-report.md
related_rules:
  - .agent/rules/invitation-production.md
  - .agent/rules/manual-sql-manifest.md
---

# Valentina Hernández XV — Editorial-Magazine Real Invitation

## Lane A — Client-Specific Invitation Completion

Real content updates, photo/asset mapping, copy. No fake placeholders, no new schema fields, no
hardcoded Valentina CSS selectors.

### 1. Content Payload (DB payload at `.agent/plans/active/xv-valentina-hernandez-db-payload.json`)

| Field                             | Current Value                                                                        | Proposed Value                                                                 | Reason                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `theme.preset`                    | `"celestial-blue"`                                                                   | `"editorial-magazine"`                                                         | Core switch to editorial-magazine theme                        |
| `_assetSlug`                      | `"xv-valentina-hernandez"`                                                           | `"xv-valentina-hernandez"`                                                     | ✓ Correct, keep                                                |
| `envelope.revealVariant`          | not set                                                                              | `"editorial-cover"`                                                            | Editorial-magazine needs editorial cover reveal                |
| `envelope.coverEdition`           | not set                                                                              | `"XV"`                                                                         | Required for editorial cover variant                           |
| `envelope.coverVolume`            | not set                                                                              | `"1"`                                                                          | Required for editorial cover variant                           |
| `envelope.coverIssue`             | not set                                                                              | `"2026"`                                                                       | Required for editorial cover variant                           |
| `sectionStyles.hero.variant`      | not set                                                                              | `"editorial-magazine"`                                                         | Uses editorial-magazine hero variant                           |
| `sectionStyles.quote.variant`     | not set                                                                              | `"editorial-magazine"`                                                         | Uses editorial-magazine quote variant                          |
| `sectionStyles.countdown.variant` | not set                                                                              | `"editorial-magazine"`                                                         | Uses editorial-magazine countdown variant                      |
| `sectionStyles.family.variant`    | not set                                                                              | `"editorial-magazine"`                                                         | Uses editorial-magazine family variant                         |
| `sectionStyles.location.variant`  | not set                                                                              | `"editorial-magazine"`                                                         | Uses editorial-magazine location variant                       |
| `sectionStyles.rsvp.variant`      | not set                                                                              | `"editorial-magazine"`                                                         | Uses editorial-magazine RSVP variant                           |
| `sectionStyles.gallery.variant`   | not set                                                                              | `"editorial-magazine"`                                                         | Uses editorial-magazine gallery variant                        |
| `sectionStyles.gifts.variant`     | not set                                                                              | `"editorial-magazine"`                                                         | Uses editorial-magazine gifts variant                          |
| `sectionStyles.thankYou.variant`  | not set                                                                              | `"editorial-magazine"`                                                         | Uses editorial-magazine thank-you variant                      |
| `hero.variant`                    | not set                                                                              | `"editorial-magazine"`                                                         | Enables editorial-magazine hero layout                         |
| `hero.label`                      | `"XV Edition"`                                                                       | `"XV Edition"`                                                                 | ✓ Good editorial label                                         |
| `envelope.microcopy`              | `"Toca para abrir mi invitación"`                                                    | `"Abrir edición XV"`                                                           | Match editorial-magazine demo style                            |
| `envelope.documentLabel`          | `"XV Edition"`                                                                       | `"Edición XV"`                                                                 | Spanish for editorial issue framing                            |
| `envelope.cardLabel`              | `"XV Edition"`                                                                       | `"Edición XV"`                                                                 | Consistent Spanish editorial                                   |
| `envelope.closedPalette`          | `{"primary":"surfacePrimary","accent":"actionAccent","background":"surfacePrimary"}` | `{"primary":"surfaceDark","accent":"actionAccent","background":"surfaceDark"}` | Match editorial-magazine dark seal palette for editorial-cover |
| `envelope.sealVariant`            | `"premium-rose"`                                                                     | `"premium-rose"`                                                               | ✓ Keep — rose matches pink editorial                           |

### 2. Family / People Data (confirmation needed from client/Paco)

| Person        | Current in SQL Payload                         | Action                                                       | Risk                      |
| ------------- | ---------------------------------------------- | ------------------------------------------------------------ | ------------------------- |
| Father        | `Juan Carlos Hernández [confirmar apellido]`   | Confirm full surname (Hernández what?)                       | HIGH — displayed publicly |
| Mother        | `Nadia Estrella Almaguer [confirmar apellido]` | Confirm Almaguer is maternal surname or add paternal         | HIGH — displayed publicly |
| Godparent 1   | `Nayeli Almaguer [confirmar apellido]`         | Confirm full name                                            | HIGH                      |
| Godparent 2   | `César A. Pérez Monroy`                        | Confirm role (co-godparent with Nayeli?)                     | MEDIUM                    |
| Parents order | `"father-first"`                               | `"mother-first"` — editorial-magazine demo uses mother-first | LOW — reversible          |

### 3. Venues & Location (confirmation needed)

| Item             | Current                                             | Action                                                   | Risk                      |
| ---------------- | --------------------------------------------------- | -------------------------------------------------------- | ------------------------- |
| Ceremony venue   | `"PENDIENTE — Confirmar ubicación de la ceremonia"` | Ask client: is ceremony at Finca Las Palmas or a church? | HIGH — blocks publication |
| Ceremony address | `"PENDIENTE"`                                       | Confirm after venue                                      | HIGH                      |
| Ceremony mapUrl  | `"PENDIENTE"`                                       | Generate Google Maps link                                | HIGH                      |
| Reception mapUrl | `"PENDIENTE — Solicitar enlace de Google Maps"`     | Generate + add appleMapsUrl                              | MEDIUM                    |
| RSVP deadline    | `"PENDIENTE — definir fecha límite"`                | Get from client                                          | MEDIUM                    |

### 4. Gifts (confirmation needed)

| Item           | Current                       | Action                               | Risk                |
| -------------- | ----------------------------- | ------------------------------------ | ------------------- |
| Liverpool URL  | `"PENDIENTE — https://..."`   | Verify registry number 52020257 live | HIGH — must resolve |
| Registry title | `"Mesa de regalos Liverpool"` | Confirm "Valens Dream Team" name     | MEDIUM              |

### 5. Gallery Captions

All 8 gallery items currently say `"PENDIENTE"`. Replace with real Spanish captions once photos are
selected. This is pure content work — no code changes.

### 6. Music / Audio

No music asset has been received. The SQL payload does not include a music block. If received, add
`music` block to content payload. Until then, omit — the system handles absent music gracefully.

### 7. Image Assets

All 17 images in `src/assets/images/events/xv-valentina-hernandez/` are WhatsApp-compressed JPEGs
(~47–85 KB each, 853–1003 × 1280 px). Not production quality.

**Production requirement:** Replace with original high-resolution photos → crop → editorial grade
(editorial-magazine aesthetic) → WebP quality 86.

See `.agent/plans/active/xv-valentina-hernandez-asset-report.md` for full mapping.

### 8. Asset Directory Status

- **Path:** `src/assets/images/events/xv-valentina-hernandez/`
- **Format:** `.jpg` (all WhatsApp compressed)
- **Target format:** `.webp`
- **Registry:** `index.ts` with 17 imports — structure is correct, only files need upgrade
- **Key count:** 17 (hero, portrait, family, gallery01-08, interlude01-04, thankYouPortrait)
- **DB payload mapped to:** all keys use proper matching

### 9. RSVP Labels

`sectionStyles.rsvp.labels` are already in Spanish with good copy:

- name: "Tu nombre"
- guestCount: "Personas que asistirán"
- attendance: "¿Me acompañas?"
- confirmButton: "Confirmar asistencia"

✓ No changes needed.

### 10. Interludes

Current interludes use client photos with people in them. The editorial-magazine spec recommends
decorative no-people images. Since these are Valentina-specific images in her asset directory, no
theme change is needed — only asset replacement.

---

## Lane B — Reusable Editorial-Magazine Refinements

Allowed only when changes fix issues that affect both Valentina **and** the
`/xv/demo-xv-editorial-magazine` demo.

### B1. Palette Gap — Editorial-Magazine Uses Red/Black/White, Valentina Needs Pink/Silver/White

**Problem:** The editorial-magazine theme (`src/styles/themes/presets/_editorial-magazine.scss`)
uses ink (`#0d0d0f`), paper (`#f7f5f2`), red (`#d71920`). Valentina requires pink (`#F5D6D6`),
silver (`#D4D4D4`), white editorial.

**Options (in order of preference):**

1. **Client-specific SCSS override (recommended for $499 tier).** Create a
   `_xv-valentina-hernandez.scss` that scopes
   `.event--valentina-hernandez.theme-preset--editorial-magazine` and remaps editorial-magazine
   tokens to pink/silver. This file already exists at
   `src/styles/themes/sections/_xv-valentina-hernandez.scss` but was written for celestial-blue
   tokens — it needs to be rewritten for editorial-magazine tokens. Scope:
   `.event--valentina-hernandez.theme-preset--editorial-magazine`.

2. **No theme-level changes needed** — the existing client SCSS override pattern handles 100% of the
   palette requirement without changing any shared file. The editorial-magazine demo preserves its
   red/black identity; only Valentina gets pink.

**Recommendation:** Option 1/2 — client SCSS override only. **No theme-level change.** The pink
palette is client-specific and the existing override mechanism is proven.

### B2. Editorial-Magazine Cover Reveal Palette Flexibility

**Observation:** The editorial cover reveal (`EditorialCoverReveal.astro`) picks up CSS variables
from the preset. Since Valentina switches to `editorial-magazine` preset, the cover will inherit
editorial-magazine's dark/red palette. The `closedPalette` in the envelope config already controls
envelope accent colors but cover background/masthead colors come from preset CSS variables.

**Fix category:** Validated — the existing `closedPalette` mechanism + preset CSS variables handle
this. The client SCSS override (B1) will remap cover reveal colors. No theme-level change needed.

### B3. Section Variant Coverage Completeness

**Observation:** The editorial-magazine theme has section-level SCSS for:

- hero ✓
- quote ✓
- countdown ✓
- family ✓
- location ✓
- gallery ✓
- gifts ✓
- personalized-access ✓
- rsvp ✓
- thank-you ✓
- header ✓

All 11 section variants exist. **No theme-level change needed** — coverage is complete.

### B4. Envelope Config — Editorial-Cover Requires Additional Fields

**Observation:** Using `preset: "editorial-magazine"` with `revealVariant: "editorial-cover"`
requires `coverEdition`, `coverVolume`, `coverIssue` fields in the envelope. These are already
supported by the schema and adapter — confirmed by the editorial-magazine demo JSON which includes
them.

**Status:** No theme-level change needed. These are content payload fields.

### B5. Hero Variant — Editorial-Magazine Needs Portrait

**Observation:** The editorial-magazine hero variant uses a dual-image layout (background +
portrait). Valentina's `hero` payload already includes both `backgroundImage` and `portrait`. ✓

**Status:** No theme-level change needed.

### B6. Responsive / SCSS Polish Opportunities

**Observation:** If during implementation the Valentina route reveals visual bugs in the
editorial-magazine theme (broken layout, missing responsive behavior, typographic issues) that also
affect the demo, those fixes are **in scope** for Lane B.

**Current risk areas** (from editorial-magazine-theme.spec.md visual hardening pass):

- Cover CTA styling may need editorial refinement (but this was already polished)
- Gallery caption visibility
- The editorial-magazine theme is marked as "MVP" — some sections may have rough edges

These should be validated by rendering both routes during implementation and fixing only shared,
reusable issues.

### Potential Theme-Level Refinements (if validated against demo):

| Candidate                                                                    | Demo impact                         | Valentina impact      | Cost | Priority                |
| ---------------------------------------------------------------------------- | ----------------------------------- | --------------------- | ---- | ----------------------- |
| Fix any inherited broken responsive rules in editorial-magazine section SCSS | ✅ Demo improves                    | ✅ No regression risk | Low  | P1 — only if bugs found |
| Improve editorial-cover palette variable chain for envelope backgrounds      | ✅ Demo gets cleaner variable usage | ✅ Same               | Low  | P2 — nice-to-have       |
| Add missing `sectionStyles` variant checks that cause console errors         | ✅ Demo becomes cleaner             | ✅ Same               | Low  | P1 — if errors present  |

---

## 3. Section Audit

### Cover Reveal

| Aspect       | Current                                             | Assessment                                                                     |
| ------------ | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| Variant      | Currently wax seal (celestial-blue)                 | Must switch to `editorial-cover` with `revealVariant: "editorial-cover"`       |
| Palette      | preset tokens → celestial-blue (blue)               | Must use editorial-magazine tokens → overridden to pink/silver via client SCSS |
| Cover fields | missing `coverEdition`, `coverVolume`, `coverIssue` | Must add all three                                                             |
| Microcopy    | `"Toca para abrir mi invitación"`                   | Update to `"Abrir edición XV"`                                                 |
| Fix type     | Content + client SCSS                               |                                                                                |
| Risk         | Low                                                 |                                                                                |
| Priority     | P1                                                  |                                                                                |

### Header / Nav

| Aspect   | Current                    | Assessment                            |
| -------- | -------------------------- | ------------------------------------- |
| Variant  | Inherits celestial-blue    | editorial-magazine has header variant |
| Initials | `"V·H"` ✓                  | Good                                  |
| Fix type | Automatic via theme switch |                                       |
| Risk     | None                       |                                       |
| Priority | P0 (automatic)             |                                       |

### Hero

| Aspect        | Current                                                                                     | Assessment                                                     |
| ------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Content       | `name: "Valentina Hernández Almaguer"`, `label: "XV Edition"`, date ✓, both hero+portrait ✓ | Good structure                                                 |
| Focal points  | `50% 38%` desktop, `50% 32%` mobile                                                         | Provisional — will need adjustment with real photos            |
| Variant       | None (celestial-blue default)                                                               | Must add `variant: "editorial-magazine"` to hero sectionStyles |
| Image quality | 926×1280, 78 KB, WhatsApp JPEG                                                              | Needs original for production                                  |
| Fix type      | Content payload (variant + focal) + asset (replace image)                                   |                                                                |
| Risk          | MEDIUM — portrait crop may need tweaking                                                    |                                                                |
| Priority      | P1                                                                                          |                                                                |

### Quote / Manifesto

| Aspect   | Current                                                              | Assessment                                                      |
| -------- | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| Content  | `"Dicen que la moda es temporal, pero los recuerdos son eternos..."` | ✓ Good editorial copy                                           |
| Author   | `Valentina Hernández Almaguer`                                       | ✓ Correct                                                       |
| Variant  | None                                                                 | Must add `variant: "editorial-magazine"` to quote sectionStyles |
| Fix type | Content (sectionStyles variant)                                      |                                                                 |
| Risk     | Low                                                                  |                                                                 |
| Priority | P1                                                                   |                                                                 |

### Access Pass (Personalized Access)

| Aspect   | Current                                                   | Assessment                            |
| -------- | --------------------------------------------------------- | ------------------------------------- |
| Content  | In `sectionOrder` as `"personalizedAccess"`               | ✓ Already in payload                  |
| Variant  | editorial-magazine has `personalized-access` section SCSS | Should work automatically with preset |
| Fix type | Automatic (content payload already has it)                |                                       |
| Risk     | Low                                                       |                                       |
| Priority | P2                                                        |                                       |

### Family / Credits

| Aspect     | Current                                      | Assessment                                                       |
| ---------- | -------------------------------------------- | ---------------------------------------------------------------- |
| Parents    | Both have `"PENDIENTE"` surname gaps         | CRITICAL — must resolve before publication                       |
| Godparents | One confirmed, one has surname gap           | CRITICAL                                                         |
| Labels     | `"Mi familia"`, `"Con amor y gratitud"`      | Good Spanish copy                                                |
| Variant    | None                                         | Must add `variant: "editorial-magazine"` to family sectionStyles |
| Image      | Provisional single portrait used as "family" | Needs real family group photo or remove featuredImage            |
| Fix type   | Content (names) + content (variant) + asset  |                                                                  |
| Risk       | HIGH (names) / LOW (variant)                 |                                                                  |
| Priority   | P1                                           |                                                                  |

### Gallery

| Aspect        | Current                                                   | Assessment                                                        |
| ------------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| Items         | 8 items, all `"PENDIENTE"` captions                       | Must replace with real captions                                   |
| Image quality | 8 WhatsApp JPEGs, 47–85 KB each                           | Replace with originals → WebP                                     |
| Variant       | None                                                      | Must add `variant: "editorial-magazine"` to gallery sectionStyles |
| Fix type      | Content (captions + variant) + asset (replacement images) |                                                                   |
| Risk          | MEDIUM — image ordering decisions                         |                                                                   |
| Priority      | P2                                                        |                                                                   |

### Countdown

| Aspect   | Current                                                  | Assessment                                                          |
| -------- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| Content  | Date ✓, title `"La celebración comienza en"` ✓, footer ✓ | Good                                                                |
| Variant  | None                                                     | Must add `variant: "editorial-magazine"` to countdown sectionStyles |
| Fix type | Content (variant)                                        |                                                                     |
| Risk     | Low                                                      |                                                                     |
| Priority | P1                                                       |                                                                     |

### Locations

| Aspect           | Current                                               | Assessment                                                                                                                     |
| ---------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Ceremony venue   | `"PENDIENTE"`                                         | CRITICAL — must resolve                                                                                                        |
| Ceremony address | `"PENDIENTE"`                                         | CRITICAL                                                                                                                       |
| Ceremony mapUrl  | `"PENDIENTE"`                                         | CRITICAL                                                                                                                       |
| Reception        | `"Finca Las Palmas"` with address ✓, mapUrl PENDIENTE | MEDIUM                                                                                                                         |
| Indications      | Dress code ✓, RSVP deadline PENDIENTE, punctuality ✓  | MEDIUM                                                                                                                         |
| Variant          | `showFlourishes: true`                                | Must add `variant: "editorial-magazine"` to location sectionStyles. `showFlourishes` may need to be `false` for editorial look |
| Fix type         | Content (venue data) + variant config                 |                                                                                                                                |
| Risk             | HIGH (venue) / LOW (variant)                          |                                                                                                                                |
| Priority         | P1                                                    |                                                                                                                                |

### RSVP

| Aspect   | Current                                                                             | Assessment                                                     |
| -------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Content  | Good Spanish copy, `accessMode: "hybrid"`, `guestCap: 4`, `confirmationMode: "api"` | ✓ Ready                                                        |
| Labels   | Custom labels for name/guestCount/attendance/confirmButton                          | ✓ Good                                                         |
| Variant  | None                                                                                | Must add `variant: "editorial-magazine"` to rsvp sectionStyles |
| Fix type | Content (variant)                                                                   |                                                                |
| Risk     | Low                                                                                 |                                                                |
| Priority | P1                                                                                  |                                                                |

### Gifts

| Aspect   | Current                                | Assessment                                                      |
| -------- | -------------------------------------- | --------------------------------------------------------------- |
| Store    | Liverpool link is `"PENDIENTE"`        | HIGH — must verify registry                                     |
| Cash     | `"Lluvia de sobres"` copy ✓            | Ready                                                           |
| Copy     | `"Su presencia es mi mejor regalo..."` | ✓ Good                                                          |
| Variant  | None                                   | Must add `variant: "editorial-magazine"` to gifts sectionStyles |
| Fix type | Content (URL + variant)                |                                                                 |
| Risk     | MEDIUM (URL) / LOW (variant)           |                                                                 |
| Priority | P1                                     |                                                                 |

### Thank-You

| Aspect      | Current                            | Assessment                                                         |
| ----------- | ---------------------------------- | ------------------------------------------------------------------ |
| Content     | Message ✓, closing name ✓, image ✓ | Good                                                               |
| Focal point | `50% 36%`                          | Provisional                                                        |
| Variant     | None                               | Must add `variant: "editorial-magazine"` to thankYou sectionStyles |
| Fix type    | Content (variant)                  |                                                                    |
| Risk        | Low                                |                                                                    |
| Priority    | P1                                 |                                                                    |

### Footer

| Aspect   | Current             | Assessment                                   |
| -------- | ------------------- | -------------------------------------------- |
| Content  | `'Con cariño'`      | ✓ Standard Celebra-me footer                 |
| Variant  | Derived from preset | editorial-magazine has footer/header variant |
| Fix type | Automatic           |                                              |
| Risk     | None                |                                              |
| Priority | P0 (automatic)      |                                              |

### Music

| Aspect       | Current                                      | Assessment                          |
| ------------ | -------------------------------------------- | ----------------------------------- |
| Content      | Not present in payload                       | Omitted until usable asset received |
| Theme impact | editorial-magazine has music variant support | Works when added                    |
| Fix type     | Content (add block when received)            |                                     |
| Risk         | None (omitted = safe)                        |                                     |
| Priority     | P3 (deferred)                                |                                     |

---

## 4. Asset Audit

### Asset Classification

| Key                | Source File              | Current Dims     | Quality                 | Classification               | Recommendation                                                                                       |
| ------------------ | ------------------------ | ---------------- | ----------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `hero`             | `hero.jpg`               | 926×1280, 78 KB  | ⚠️ Provisional WhatsApp | **Cover candidate**          | Replace with original, 9:16 crop, editorial pink/silver grade                                        |
| `portrait`         | `portrait.jpg`           | 1003×1280, 61 KB | ⚠️ Provisional WhatsApp | **Hero portrait + OG image** | Widest photo, best candidate. Needs original                                                         |
| `family`           | `family.jpg`             | 854×1280, 54 KB  | ⚠️ Provisional WhatsApp | **Family placeholder**       | This is a solo portrait, not a family group. Replace with actual family photo or remove from payload |
| `thankYouPortrait` | `thank-you-portrait.jpg` | 901×1280, 76 KB  | ⚠️ Provisional WhatsApp | **Thank-you/closing**        | Replace with original                                                                                |
| `gallery01`        | `gallery-01.jpg`         | 918×1280, 47 KB  | ⚠️ Provisional          | **Gallery feature**          | Replace with original                                                                                |
| `gallery02`        | `gallery-02.jpg`         | 884×1280, 53 KB  | ⚠️ Provisional          | **Gallery secondary**        | Replace with original                                                                                |
| `gallery03`        | `gallery-03.jpg`         | 879×1280, 61 KB  | ⚠️ Provisional          | **Gallery secondary**        | Replace with original                                                                                |
| `gallery04`        | `gallery-04.jpg`         | 945×1280, 85 KB  | ⚠️ Provisional          | **Gallery secondary**        | Replace with original                                                                                |
| `gallery05`        | `gallery-05.jpg`         | 853×1280, 50 KB  | ⚠️ Provisional          | **Gallery secondary**        | Replace with original                                                                                |
| `gallery06`        | `gallery-06.jpg`         | 949×1280, 55 KB  | ⚠️ Provisional          | **Gallery secondary**        | Replace with original                                                                                |
| `gallery07`        | `gallery-07.jpg`         | 868×1280, 50 KB  | ⚠️ Provisional          | **Gallery secondary**        | Replace with original                                                                                |
| `gallery08`        | `gallery-08.jpg`         | 871×1280, 60 KB  | ⚠️ Provisional          | **Gallery secondary**        | Replace with original                                                                                |
| `interlude01`      | `interlude-01.jpg`       | 919×1280, 47 KB  | ⚠️ Provisional          | **Decorative break**         | Replace with no-people decorative editorial image                                                    |
| `interlude02`      | `interlude-02.jpg`       | 871×1280, 76 KB  | ⚠️ Provisional          | **Decorative break**         | Same                                                                                                 |
| `interlude03`      | `interlude-03.jpg`       | 907×1280, 51 KB  | ⚠️ Provisional          | **Decorative break**         | Same                                                                                                 |
| `interlude04`      | `interlude-04.jpg`       | 875×1280, 73 KB  | ⚠️ Provisional          | **Decorative break**         | Same                                                                                                 |

### Grayscale Filter Assessment

The editorial-magazine theme may apply grayscale/desaturation treatments to certain images (cover
background, interludes). Since Valentina's images are pink-toned editorial portraits, a heavy
grayscale filter would wash out the pink editorial identity.

**Recommendation:** Validate image filters by rendering both the demo and Valentina routes during
implementation. If the editorial-magazine hero uses grayscale on the background image and the effect
harms Valentina's pink palette, expose a CSS variable for grayscale intensity. This is a
**theme-level fix** (Lane B) only if `rgba()`/filter variables are missing from the preset and the
demo would also benefit from configurable intensity.

### Missing Assets

- **No music/audio file** — deferred until received
- **No OG image** — uses same as portrait, so OK structurally
- **No venue/location photos** — editorial-magazine doesn't require them; locations section uses
  cards

### Weak Photos

All 17 photos are WhatsApp-compressed (47–85 KB). At ~900×1280 px they will look soft/blurry on
retina displays. Production is blocked until originals arrive.

---

## 5. Files Changed From Previous Spec Approach

The old approach (`valentina-hernandez-xv-invitation.spec.md`) planned:

- `theme.preset: "celestial-blue"` + extensive SCSS token remapping (celestial-blue → pink)
- Standard wax seal envelope

The new approach (`editorial-magazine` theme) changes:

- `theme.preset: "editorial-magazine"` + lighter SCSS remapping (editorial-magazine → pink)
- Editorial-cover reveal with cover metadata
- All `sectionStyles.*.variant: "editorial-magazine"`
- Reuse of editorial-magazine hero layout, quote spread, countdown module, family cards, etc.

**Impact on existing files:**

| File                                                                    | Action                | Reason                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/styles/themes/sections/_xv-valentina-hernandez.scss`               | **Rewrite**           | Currently remaps celestial-blue tokens. Must remap editorial-magazine tokens instead. Scope changes from `.event--valentina-hernandez.theme-preset--celestial-blue` to `.event--valentina-hernandez.theme-preset--editorial-magazine` |
| `.agent/plans/active/xv-valentina-hernandez-db-payload.json`            | **Update**            | Change `theme.preset`, add envelope cover fields, add section variant mappings, update envelope config                                                                                                                                |
| `scripts/manual/production-patches/20260626_valentina_hernandez_xv.sql` | **Rewrite**           | Content payload embedded in the SQL must match updated DB payload                                                                                                                                                                     |
| `src/assets/images/events/xv-valentina-hernandez/index.ts`              | **Update**            | Change `.jpg` imports to `.webp` when originals arrive                                                                                                                                                                                |
| `.agent/plans/active/valentina-hernandez-xv-invitation.spec.md`         | **Archive/supersede** | Replaced by this spec                                                                                                                                                                                                                 |
| `scripts/manual/production-patches/20260626_valentina_hernandez_xv.sql` | **Rewrite (phase 2)** | Changed from insert-only to idempotent continuation-safe upsert — see 5.1                                                                                                                                                             |

### 5.1 SQL Patch: Insert-Only → State-Aware Continuation/Upsert

**Problem:** The original SQL patch assumed 0 active rows existed for
`slug = 'valentina-hernandez'`. When executed against the real Supabase production DB, the preflight
check aborted with:

```
PREFLIGHT_ABORT: Found 1 existing invitation_projects row(s) for
slug valentina-hernandez. Expected 0.
```

This is expected — a previous draft/creation step left an active `invitation_projects` row. The
downstream tables (`published_invitation_content`, `events`, `event_memberships`) may also have
partial or outdated state.

**Solution:** Convert the patch from strict insert-only to a state-aware continuation patch that:

- Accepts 0 or 1 active rows per table as valid states
- Aborts only on ambiguous states (>1 row), conflicting owner memberships, or unresolvable owner
- Uses explicit DO blocks (no `ON CONFLICT`) — constraint-independent, handles soft-delete correctly
- Supports three states per table: INSERT (no row), UPDATE (active row), RESURRECT (soft-deleted
  row)
- Preserves fields that carry intent from a previous run (`created_by`, `published_at`)
- Increments `version` on every published content update for cache invalidation (NOT idempotent)
- Does not create duplicate rows under any execution path

**Design decisions:**

|| Decision | Rationale | ||----------|-----------| || All 4 tables use explicit `SELECT ... INTO` +
`IF/ELSIF/ELSE` DO blocks | Every table has a nullable `deleted_at` (soft-delete) column. Unique
constraints (`(event_type, slug)` on published_content, `slug` on events, `(event_id, user_id)` on
memberships) do NOT include `deleted_at`, so `ON CONFLICT` would fail on soft-deleted rows or update
the wrong row. Explicit DO blocks handle active, soft-deleted, and missing rows independently. | ||
Resurrect pattern: soft-deleted rows get `deleted_at = NULL` | If a previous archival/deletion left
a row with `deleted_at` set, re-running the patch restores it rather than crashing on a unique
constraint violation. | || `COALESCE(published_at, now())` on updates | Preserves an intentionally
set `published_at` from a prior run. Only sets it now if it was null. | ||
`COALESCE(created_by, owner)` on project update | Preserves the original creator if one was already
recorded. Only backfills if null. | || `version + 1` on every content update | Each re-application
of the patch bumps the content version, enabling cache invalidation downstream. The patch is NOT
strictly idempotent because reruns intentionally bump version. | || Preflight check for conflicting
event_membership owner | If the event already exists, aborts if any active owner membership on that
event points to a different user_id than the configured owner. Manual resolution is required before
the patch can proceed. |

**State handling matrix (per table, per slug 'valentina-hernandez'):**

| Table                          | No row (INSERT)                            | Active row exists (UPDATE)                                                                                | Soft-deleted row only (RESURRECT)                                       | >1 active rows (ABORT)                                          |
| ------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| `invitation_projects`          | Full INSERT with all fields                | UPDATE title, status, theme, snapshot, client fields, created_by (if null), updated_at + clear deleted_at | Promote to UPDATE (clear deleted_at + set all fields)                   | Ambiguity — cannot determine correct row                        |
| `published_invitation_content` | Full INSERT, version=1, published_at=now() | UPDATE content, version+1, published_at preserved, updated_at                                             | Clear deleted_at + UPDATE all fields, version+1, published_at preserved | Ambiguity                                                       |
| `events`                       | Full INSERT, published_at=now()            | UPDATE owner, title, status, invitation_project_id, published_at preserved, updated_at                    | Clear deleted_at + UPDATE all fields, published_at preserved            | Ambiguity                                                       |
| `event_memberships`            | INSERT owner membership                    | PRESERVE existing row                                                                                     | Clear deleted_at + preserve                                             | Preflight check: abort if different owner exists for same event |

---

## 6. Implementation Order

| Phase | Task                                                                                                                                    | Lane                                                                                                                                                                                                                              | Dependency                              |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------- |
| 0     | Resolve PENDIENTE items: parent names, godparent names, ceremony venue, Liverpool URL, RSVP deadline                                    | Client/Paco                                                                                                                                                                                                                       | None — must precede publication         |
| 1     | **Rewrite DB payload** (`.agent/plans/active/xv-valentina-hernandez-db-payload.json`): change preset, add variants, add envelope fields | A                                                                                                                                                                                                                                 | Phase 0 data                            |
| 2     | **Rewrite client SCSS** (`_xv-valentina-hernandez.scss`): switch from celestial-blue override to editorial-magazine override            | A                                                                                                                                                                                                                                 | Phase 1 (know which tokens to override) |
| 3     | **Update sectionStyles** in content payload: all sections to `variant: "editorial-magazine"`                                            | A                                                                                                                                                                                                                                 | Phase 1                                 |
|       | 4                                                                                                                                       | **Rewrite SQL patch**: continuation-safe upsert per section 5.1. Replaces insert-only preflight and DML with state-aware DO blocks (UPDATE/INSERT/resurrect). NOT strictly idempotent — reruns bump version on published content. | A                                       | Phase 1, Phase 3          |
|       | 5                                                                                                                                       | **Asset replacement**: when originals arrive, crop → editorial grade → WebP → update `index.ts`                                                                                                                                   | A                                       | Client provides originals |
| 6     | **Validate demo** (`/xv/demo-xv-editorial-magazine`): confirm no regression                                                             | B                                                                                                                                                                                                                                 | Phase 2 (after SCSS changes)            |
| 7     | **Validate Valentina route** (`/xv/valentina-hernandez`): all sections, mobile/desktop, RSVP                                            | A+B                                                                                                                                                                                                                               | Phase 4+6                               |
| 8     | **Theme-level polish**: fix any shared issues found in validation                                                                       | B                                                                                                                                                                                                                                 | Phase 6-7                               |
| 9     | **Local/staging validation** + build verification                                                                                       | A                                                                                                                                                                                                                                 | Phase 4                                 |
| 10    | Production execution (Paco approval required)                                                                                           | A                                                                                                                                                                                                                                 | Phase 5+9                               |

---

## 7. Verification Plan

| Check                 | Command / Method                                            | When                                                                                   |
| --------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------- |
| Type-check            | `pnpm type-check`                                           | After every code change                                                                |
| Lint                  | `pnpm lint`                                                 | After every code change                                                                |
| Build                 | `pnpm build`                                                | Before staging, before production                                                      |
|                       | Schema validate                                             | `pnpm ops validate-schema`                                                             | After DB payload change     |
|                       | SQL manifest compliance                                     | Verify `@operation`, `@expected-rows-min`, `@expected-rows-max` match upsert semantics | After SQL patch change      |
|                       | SQL dry-run                                                 | Run `pg_dump` or dry-run query from SQL manifest to preview target rows                | Before production execution |
|                       | Git safety                                                  | `pnpm agent:git-safety:check`                                                          | Before any commit           |
| Vercel deploy         | Push to branch → Vercel preview                             | Before production                                                                      |
| Route: Valentina      | `/xv/valentina-hernandez` returns 200                       | After staging deploy                                                                   |
| Route: Demo           | `/xv/demo-xv-editorial-magazine` returns 200, no regression | After staging deploy                                                                   |
| Route: Editorial-rose | `/xv/demo-xv-editorial-rose` — no regression                | After staging deploy                                                                   |
| RSVP API              | Submit test RSVP                                            | After staging deploy                                                                   |
| Mobile                | 360px / 390px / 430px                                       | Visual QA                                                                              |
| Desktop               | 1440px                                                      | Visual QA                                                                              |
| Cover reveal          | editorial-cover variant renders correctly                   | Visual QA                                                                              |
| Zero blue leakage     | All sections use pink/silver/white palette                  | Visual QA (if palette override used)                                                   |

---

## 8. Risks & Blockers

| #   | Risk                                                                                                       | Impact                                                                                                                | Likelihood         | Mitigation                                                              |
| --- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Parent/godparent names not confirmed before publication                                                    | **BLOCKER**                                                                                                           | HIGH               | Ask Paco immediately                                                    |
| R2  | Ceremony venue unknown                                                                                     | **BLOCKER**                                                                                                           | HIGH               | Ask Paco immediately                                                    |
| R3  | Liverpool registry URL invalid                                                                             | MEDIUM (gifts section broken)                                                                                         | MEDIUM             | Verify URL; fallback to cash-only gift option                           |
| R4  | Original photos not received                                                                               | **BLOCKER for production**                                                                                            | HIGH               | WhatsApp JPEGs work for preview but not for production delivery         |
| R5  | Editorial-magazine palette (red/black) clashes with Valentina's pink editorial vision                      | MEDIUM                                                                                                                | MEDIUM             | Client SCSS override remaps tokens; test thoroughly                     |
| R6  | Editorial-cover reveal uses editorial-magazine tokens that don't match pink palette on first render        | MEDIUM                                                                                                                | MEDIUM             | client SCSS must include cover-specific variable overrides              |
| R7  | Section variant conflicts: some editorial-magazine sections may not render perfectly with Valentina's data | LOW                                                                                                                   | LOW                | Validate all 11 sections during implementation; most are content-driven |
| R8  | `sectionStyles.hero.variant` may conflict with `hero.variant` — two ways to specify variant                | LOW                                                                                                                   | LOW                | Check adapter code; use both for safety                                 |
|     | R9                                                                                                         | SQL patch embedded content payload goes out of sync with DB payload JSON                                              | MEDIUM             | MEDIUM                                                                  | Keep both in sync during implementation; cross-reference before production                                                      |
|     | R10                                                                                                        | Pre-existing invitation_projects row has stale fields that the UPDATE does not correct (fields not in the update set) | LOW (non-breaking) | LOW                                                                     | The UPDATE targets all intended fields. Unintended fields like `slug`, `id`, `deleted_at` are structural and should not change. |
