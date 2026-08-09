# Canonical Invitation Preparation State — `alba-rosa-quinonez`

> Schema owner: `docs/core/invitation-preparation-contract.md` Executable evaluation:
> `src/lib/invitation-preparation/` Workflow: `.agent/workflows/invitation-preparation.md`

---

## Identity

| Parameter              | Value                                                                          |
| ---------------------- | ------------------------------------------------------------------------------ |
| **Slug**               | `alba-rosa-quinonez`                                                           |
| **Host Login Alias**   | `alba_quinonez`                                                                |
| **Event Type**         | `cumple`                                                                       |
| **Preparation Status** | `READY_WITH_PLACEHOLDERS` (implemented locally; provisional source resolution) |

**Preparation Readiness:** `READY_WITH_PLACEHOLDERS`

> Helper alignment (`evaluatePreparationReadiness` / `summarizeAssetQuality`): assigned roles remain
> `provisional-whatsapp` / non-production ceiling — must not be documented as
> `READY_FOR_IMPLEMENTATION` until production-ready assets exist.

Technical Local/Preview/Production readiness is **out of scope** for this document and remains owned
by `pnpm invitation:release -- --status` / `invitation-readiness.ts`.

---

## Sources

| Source                         | Reference                                              | Notes                                    |
| ------------------------------ | ------------------------------------------------------ | ---------------------------------------- |
| WhatsApp / conversation        | `source:wa-export` (opaque; session holds real path)   | Facts/preferences only — never photo SoT |
| Photograph / assets root       | `source:hr-photos` (opaque; session holds real path)   | Authoritative photo source (8 JPEGs)     |
| Other authoritative references | Gift-legend screenshot filename in WA export (session) | Reference only; adapted copy below       |

---

## Fact Register

| field                 | value                                                                                                        | classification | source                               | notes                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------ | -------------- | ------------------------------------ | -------------------------------------------------------------------------------- |
| slug                  | alba-rosa-quinonez                                                                                           | verified       | owner 2026-07-28                     | Confirmed                                                                        |
| hostLoginAlias        | alba_quinonez                                                                                                | verified       | owner 2026-07-28                     | Host login alias                                                                 |
| celebrantName         | Alba Rosa Quiñónez López                                                                                     | verified       | client correction 2026-07-29         | Corrected from WhatsApp source per client request (con Z)                        |
| eventLabel            | 70 Años                                                                                                      | inferred       | age + demo pattern                   | —                                                                                |
| eventDate             | 2026-09-12                                                                                                   | verified       | client correction 2026-07-29         | Client corrected from 2026-09-11; earlier WhatsApp source superseded             |
| eventTime             | 20:00                                                                                                        | verified       | WA 17/07/26                          | —                                                                                |
| timeZone              | America/Mexico_City                                                                                          | inferred       | MX practice / Sinaloa                | —                                                                                |
| age                   | 70                                                                                                           | verified       | WA 17/07/26                          | —                                                                                |
| hostContactName       | Lucero Ramírez                                                                                               | verified       | WA                                   | Contact / nuera                                                                  |
| primaryVenueName      | Canta Luna Campestre                                                                                         | verified       | owner 2026-07-28                     | —                                                                                |
| primaryVenueAddress   | Supermanzana km 6, Los Mochis, Sinaloa                                                                       | verified       | owner 2026-07-28                     | —                                                                                |
| dressCode             | Formal                                                                                                       | verified       | WA 17/07/26                          | —                                                                                |
| giftsMode             | legend-only                                                                                                  | verified       | WA 17/07/26                          | No cofre / dinerito UI                                                           |
| giftsLegend           | Mi mejor regalo es tu presencia, pero si deseas tener un detalle conmigo, puedes hacerlo dentro de un sobre. | verified       | owner “Adaptar” + WA reference       | Adapted from wedding plural reference to singular birthday voice                 |
| baseDemoId            | demo-cumple-luxury-hacienda                                                                                  | verified       | WA 13/07/26                          | —                                                                                |
| themePreset           | luxury-hacienda                                                                                              | inferred       | catalog                              | —                                                                                |
| clientColors          | neutros: beige, cremita, blanco                                                                              | verified       | WA 13/07/26                          | —                                                                                |
| stylePreference       | sencillo, sobrio, entendible (invitados mayores)                                                             | verified       | WA                                   | —                                                                                |
| sourceAssetPath       | source:hr-photos                                                                                             | verified       | owner                                | Opaque label; session holds real path                                            |
| primaryPhotoIntent    | Garden denim seated portrait (`d40988d8-…JPG`)                                                               | verified       | WA + inventory                       | —                                                                                |
| photoPipelineDecision | Use folder sources; high-quality WebP via normalize (q84); exclude unusable                                  | verified       | owner 2026-07-28                     | Preserve originals; no aggressive recompress                                     |
| familyNames           | —                                                                                                            | not_applicable | —                                    | Names unverified; minimal family photo + phrase only                             |
| musicUrl              | —                                                                                                            | not_applicable | —                                    | Music section omitted                                                            |
| itinerary             | —                                                                                                            | not_applicable | —                                    | Itinerary omitted                                                                |
| rsvpConfirmationMode  | api                                                                                                          | verified       | product standard                     | América, Xareni, Luna, Ayrin + intake default `api`; Valentina `both` is outlier |
| rsvpAccessMode        | hybrid                                                                                                       | verified       | product standard                     | Matches América / Xareni / Luna / Ayrin                                          |
| rsvpGuestCap          | per-guest via dashboard                                                                                      | verified       | WA 18/07/26                          | Payload guestCap follows demo/practice; passes assigned in dashboard             |
| sectionOrder          | hero, location, interlude(Paris), gallery, gifts, personalizedAccess, rsvp, family, thankYou                 | verified       | owner “ok” + Family before Thank You | Thank You is the final content section                                           |

---

## Event Completeness

Contract maturity for this event type: `partial`

- **required**
  - Fields: slug, celebrantName, eventDate, eventTime, baseDemoId, sourceAssetPath, sectionOrder,
    primaryVenueName, primaryVenueAddress, rsvpConfirmationMode
  - Status: all satisfied
- **conditional**
  - Fields: —
  - Status: —
- **recommended**
  - Fields: eventLabel, timeZone
  - Status: satisfied / inferred
- **optional**
  - Fields: dressCode, gifts, musicUrl, clientColors
  - Status: resolved / N/A

### Missing blockers

- None for partial `cumple` contract.

### Non-blocking gaps

- Optional Maps pin precision for Canta Luna Campestre.
- Source photos are client-approved provisional-resolution originals; delivery WebPs preserve their
  available detail without enlarging deterministic derivatives.

Deterministic question: **Is the available information sufficient to prepare this invitation?**
Answer: `yes`.

---

## Placeholders

| token | missing datum | blocking | reason                 | replacement requirement |
| ----- | ------------- | -------- | ---------------------- | ----------------------- |
| —     | —             | —        | No placeholders remain | —                       |

---

## Owner Decisions

| id                     | category              | issue                   | evidence                        | options | recommendation                                                | status                  |
| ---------------------- | --------------------- | ----------------------- | ------------------------------- | ------- | ------------------------------------------------------------- | ----------------------- |
| slug                   | other-blocking        | Canonical slug          | owner                           | —       | `alba-rosa-quinonez`                                          | **resolved**            |
| venueAddress           | missing-client-facts  | Venue name + address    | owner                           | —       | Canta Luna Campestre / Supermanzana km 6, Los Mochis, Sinaloa | **resolved**            |
| giftsLegendCopy        | ambiguous-data        | Adapt legend            | owner “Adaptar”                 | —       | Singular birthday adaptation applied                          | **resolved**            |
| sectionOrder           | demo-design-decisions | Sections                | owner “ok”                      | —       | hero → location → gallery → gifts → rsvp → thankYou           | **resolved**            |
| rsvpMode               | other-blocking        | N/A — product standard  | Recent invites + intake default | —       | `confirmationMode: api`, `accessMode: hybrid`                 | **resolved (standard)** |
| photoProvisionalAccept | photograph-acceptance | Use + high-quality WebP | owner 2026-07-28                | —       | Normalize WebP q84; preserve originals                        | **resolved**            |

---

## Agent Recommendations

| topic    | recommendation                                         | basis                                                      | status                       |
| -------- | ------------------------------------------------------ | ---------------------------------------------------------- | ---------------------------- |
| demo     | `demo-cumple-luxury-hacienda` / `luxury-hacienda`      | Client selection                                           | accepted                     |
| palette  | Neutral editorial palette                              | Client-requested beige, cream and white; photos hold color | **implemented locally**      |
| rsvp     | `confirmationMode: "api"`, `accessMode: "hybrid"`      | América, Xareni, Luna, Ayrin; intake mapper default `api`  | accepted as product standard |
| gifts UI | Single legend item only                                | Client constraint                                          | accepted                     |
| photos   | High-quality WebP; crop WhatsApp UI chrome; no upscale | owner + quality audit 2026-07-28                           | accepted                     |
| family   | Minimal photo + one phrase; no invented names          | owner goal                                                 | implemented locally          |

---

## Sections

| bucket                 | section keys                                             |
| ---------------------- | -------------------------------------------------------- |
| requested / approved   | hero, location, gallery, gifts, rsvp, thankYou           |
| inferred / recommended | family (minimal emotional close — owner goal 2026-07-28) |
| omitted                | itinerary, music                                         |
| unresolved             | —                                                        |

---

## Design Direction

| decision                    | value                                                                                   | classification                                      |
| --------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Client-selected demo        | `demo-cumple-luxury-hacienda`                                                           | verified                                            |
| Selected visual direction   | Simplify luxury-hacienda toward sobrio/neutral                                          | verified (style prefs)                              |
| Client color requirements   | beige / cream / white                                                                   | verified                                            |
| Active palette              | **Neutral editorial** — ivory, stone, mushroom, graphite and restrained champagne       | creative implementation of verified client neutrals |
| Hero composition            | Desktop landscape (subject right, type left); mobile portrait with localized UI removal | creative decision                                   |
| Family section              | Existing `Family.astro` + profile minimalization (no new shared variant)                | creative decision                                   |
| Unresolved visual decisions | Envelope closed-palette remains outside the Hero/profile scope                          | non-blocking                                        |

---

## Photograph Inventory

Source label: `source:hr-photos` (opaque; absolute client path is session-only per prep
info-hygiene)

### Final photo-role map (unique by section — 2026-07-28)

**Confirmed: no photograph is reused across semantic sections.** Desktop/mobile hero derivatives of
the same garden session count as one hero role.

- **Hero (desktop + mobile)**
  - Source: `d40988d8-…JPG` (965×2008)
  - Derivative: `hero-desktop.webp` 1672×941 / 270 KB; `hero-mobile.webp` 965×2008 / 178 KB
  - Notes: Mobile: localized upper-left foliage repair removes baked WhatsApp ✕ without touching
    subject pixels. Desktop: identity-preserving AI landscape recompose from the authoritative
    original, same person/wardrobe/garden
- **Gallery**
  - Source: `IMG_5317`, `3b20a415-…`, `4f40cbcf-…` (chrome top trimmed), `9d08b715-…`
  - Derivative: `gallery-01-paris`, `02-london`, `03-nyc-holiday`, `05-albert`
  - Notes: Cafe removed from gallery
- **Thank-you**
  - Source: `IMG_5319.jpg` (cafe)
  - Derivative: `thank-you.webp` 1171×2000 ~118 KB
  - Notes: Was duplicate of hero garden — fixed. Top chrome bar cropped ~80px
- **Family**
  - Source: `00000059-PHOTO-2026-07-17-10-12-32.jpg` (994×1280)
  - Derivative: `family.webp` 994×1280 ~228 KB
  - Notes: Authoritative path; **no upscale**; composition preserved
- **Unused / excluded**
  - Source: `11f42f9b-…` (Times Square), `IMG_5315.jpg`
  - Derivative: —
  - Notes: Skip / unusable

### Quality root-cause findings (owner feedback 2026-07-28)

- **Mobile hero “button” upper-left**
  - Cause: WhatsApp/UI close ✕ **baked into source JPEG** (bbox ~x0–90, y22–129), not CSS; the prior
    derivative also contained a blocky attempted repair
  - Fix applied: Localized mirrored-foliage repair limited to the upper-left 120×160 px; full
    965×2008 framing and all subject pixels preserved
- **Cafe thank-you chrome**
  - Cause: Black status bar + back arrow / ⋮ in source
  - Fix applied: Top crop ~80px
- **Over-cropping**
  - Cause: Pipeline used `fit:'cover'` + `attention` / upscale (`withoutEnlargement:false`) on
    thank-you/family
  - Fix applied: Switched to `fit:'inside'` + `withoutEnlargement:true`
- **Blurriness (pipeline)**
  - Cause: Family was upscaled 994→1398; Hero `getImage` forced **mobile width 640 @ q80**, then
    re-encoded already-normalized remote WebPs and could enlarge them
  - Fix applied: Family native dims; managed remote Hero derivatives now bypass a second Astro
    encode; static images cap requested width at their native width; Family OptimizedImage 960×1280
    @ q84
- **Blurriness (ceiling)**
  - Cause: Sources are provisional WhatsApp ~0.5–2.6 MP
  - Fix applied: Cannot invent detail; preserve source resolution
- **Double encode risk**
  - Cause: Release WebP → `normalizeInvitationImage` q84 on Local apply → Astro `getImage`
  - Fix applied: Managed remote Hero WebPs now render directly; Astro optimization remains only for
    static `ImageMetadata` and never requests beyond native width

### Hero asset mapping

| Viewport | Source                                                          | Generated           | Dims     | Encode            | Intent                                                                                   |
| -------- | --------------------------------------------------------------- | ------------------- | -------- | ----------------- | ---------------------------------------------------------------------------------------- |
| Desktop  | `d40988d8-…JPG` via built-in identity-preserving landscape edit | `hero-desktop.webp` | 1672×941 | WebP q93 / 270 KB | Native delivery size; subject right; negative space left for type; no downstream enlarge |
| Mobile   | same JPG, localized upper-left UI repair                        | `hero-mobile.webp`  | 965×2008 | WebP q90 / 178 KB | Original full-length portrait and subject pixels preserved; no enlargement               |

### Family asset mapping

| Field                | Value                                                                        |
| -------------------- | ---------------------------------------------------------------------------- |
| Authoritative source | `source:hr-photos` / `00000059-PHOTO-2026-07-17-10-12-32.jpg` (session path) |
| Derivative           | `src/assets/invitations/alba-rosa-quinonez/family.webp`                      |
| Dims / weight        | 994×1280 / ~228 KB WebP q88                                                  |
| Processing           | rotate + inside resize **without enlargement**; no AI reconstruction         |

### Final palette — Neutral Editorial

| Token                    | Value / role                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| Primary background       | Pearl gray `#F3F2EE`                                                                                     |
| Secondary background     | Mineral stone `#DCD8D0`                                                                                  |
| Tonal surface            | Muted mushroom `#C7C0B5`                                                                                 |
| Primary / secondary text | Graphite `#2D2D2B` / gray taupe `#706C65`                                                                |
| Micro-accent             | Richer gold `--alba-gold`                                                                                |
| Functional accent        | Sage-gray `#7C8179`, confined to functional state feedback                                               |
| Dark surface             | Graphite `#202328`                                                                                       |
| Rationale                | Implements the verified beige, cream and white requirement; photographic color remains visually dominant |

### Hero design decisions

- Reuse `luxury-hacienda` hero variant; Lane A profile softens overlays and left-aligns desktop type
  into negative space.
- Avoid heavy black crush that previously hid photographic detail.
- Focal points favor subject on the right for desktop (`~72% 42%`).

### Family-section decision

- Reused existing `Family.astro` with `presentation: 'with-photo'`, no named relatives (unverified).
- Profile hides eyebrow/title/divider/name lists; shows photo + phrase: «El corazón de esta
  celebración es mi familia.»
- Section order: `… → rsvp → family → thankYou` (Thank You is the final content section).

### Local visual-validation state

| Check                  | State                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| Photo uniqueness       | Mapped — no cross-section duplicates                                                     |
| Mobile chrome ✕        | Removed with localized background repair; full framing retained                          |
| Desktop hero           | 1672×941 dedicated native derivative present; direct delivery prevents upscale/re-encode |
| Family source          | Authoritative `00000059-…`                                                               |
| Active palette         | Neutral Editorial only                                                                   |
| Mobile proof           | 390×844: native 965×2008 Hero source, `50% 28%` focal, no horizontal overflow            |
| Desktop proof          | 1440×900: native 1672×941 Hero source, `72% 42%` focal, no horizontal overflow           |
| Section coverage       | 28/28 captures produced across 360, 390, 768, and 1440 px widths; 7/7 sections each      |
| Local managed state    | Public v3; readiness `READY`; final verify dry-run reports zero operations               |
| Preview / Production   | Untouched                                                                                |
| Owner palette decision | Client neutral requirement implemented locally                                           |

The screenshot tool produced every requested artifact successfully but its manifest reported a known
task-ID bookkeeping failure (empty required task IDs). Direct Playwright measurements and element
captures independently verified the Hero, Family, section order, image sources, palette, and
overflow state.

### Optimization verdict (2026-07-28)

**Usar estas fotos como fuente** y **optimizar a WebP de alta calidad** en el pipeline. No esperar
otro lote.

- **Source of truth:** `source:hr-photos` folder (not WhatsApp chat attachments)
- **Quality class:** `provisional-whatsapp` / mobile-compressed — max ~2.6 MP; most files 95–309 KB
- **Owner directive:** Optimize to WebP **without perceptible quality loss**
- **What “optimize” means here:** Preserve JPEG originals untouched; repair baked UI only outside
  the subject; WebP without enlargement; avoid cover/attention crops unless art-directed
- **What not to do:** Upscale beyond source; aggressive recompress; invent facial detail
- **Exclude:** `IMG_5315.jpg` (364×640, unusable for gallery/hero)
- **Optional skip:** `11f42f9b-…JPG` (busy Times Square / low res)
- **Production note:** Source resolution is the ceiling

Role-aware WebP transfer-weight **targets** (guidance):

| Role         |     Target |
| ------------ | ---------: |
| Hero desktop | 250–500 KB |
| Hero mobile  | 180–350 KB |
| Gallery      |  80–180 KB |
| Family       | 150–300 KB |

---

## Implementation Constraints

- Preparation readiness is `READY_WITH_PLACEHOLDERS` (provisional source resolution remains;
  helper-aligned — not `READY_FOR_IMPLEMENTATION`).
- Lane A: client neutrals with muted sage/champagne micro-accents, legend-only gifts, family minimal
  close on luxury-hacienda.
- Lane B: only if a change also improves `demo-cumple-luxury-hacienda`.
- Music / itinerary: omit.
- RSVP product standard: `confirmationMode: "api"`, `accessMode: "hybrid"`.
- Assets: preserve originals; remove baked UI without altering the subject; no deterministic
  upscale.

### Implementation record (2026-07-28)

- **Managed definition:** `scripts/provision/invitations/alba-rosa-quinonez.ts` (registered).
- **Release assets:** `src/assets/invitations/alba-rosa-quinonez/*.webp` (hero×2, thank-you, family,
  gallery×4).
- **Lane A profile:** `src/styles/invitation-profiles/alba-rosa-quinonez.scss` — Neutral Editorial.
- **Shared quality fixes:** `Hero.astro` / `EditorialMagazineHero.astro` direct-deliver managed
  WebPs and cap static optimization at native width; `Family.astro` OptimizedImage 960×1280@q84.
- **Focused test:** `tests/content/alba-rosa-quinonez-payload.test.ts` — **content golden** (exact
  Spanish / soft-match intentional). Editor schema, section-save, publish, and provision contract
  suites must not assert this wording; see `.agent/skills/testing/SKILL.md` → Invitation Copy
  Assertions.
- **Local apply:** Public v4 applied and verified; final content-and-assets dry-run is
  `SIN CAMBIOS`.
- **Validation:** `validate:changed`, `type-check`, `validate:structure`, and
  `validate:event-parity` pass (35 test suites / 292 tests).
- **Preview / Production:** Untouched — see
  [alba-rosa-quinonez-merge-conflicts.md](./alba-rosa-quinonez-merge-conflicts.md) for
  merge-conflict resolution when promoting.
- **Route:** `/cumple/alba-rosa-quinonez` (local).

### Editorial Redesign Record (2026-07-28 — final responsive Local pass)

- **Hero hierarchy:** Dominant age lockup → name → date: large stacked `70` / `AÑOS` (champagne,
  display + label fonts), then `Alba Rosa Quiñónez López` (Cormorant Garamond headline), then
  `12 DE SEPTIEMBRE DE 2026`. Logistics duplicated in Hero (time/venue) hidden via profile CSS as
  Location owns logistics.
- **Hero responsiveness & face safety:** Explicit aspect-ratio and breakpoint composition modes:
  Mobile (< 640px) uses `hero-mobile.webp` with `50% 24%` focal point and dark bottom gradient veil;
  Tablet/Intermediate (640–991px, near-square ~906×870, 768×1024) uses `72% 28%` focal point with
  left dark gradient veil and constrained `max-width: min(32rem, 58vw)` text container to guarantee
  zero face collision; Wide Desktop (≥ 992px) uses `hero-desktop.webp` with `72% 42%` focal point
  and left negative-space text column.
- **Neutral palette & tonal rhythm:** Neutral Editorial palette: Pearl gray (`#F3F2EE`), warm stone
  (`#DCD8D0`), muted sand (`#C7C0B5`), taupe (`#706C65`), graphite (`#2D2D2B`), ink (`#202328`), and
  muted gold (`--alba-gold`). Progression: Hero (dark ink/photo) → Location (warm ivory/stone) →
  Paris (photo color reset) → Gallery (mineral greige) → Gifts (quiet ivory) → RSVP/Access (graphite
  ink) → Family (warm stone) → Thank You (graphite dark finale).
- **Valentina intersection audit:** Evaluated Valentina's asymmetric section-intersection system.
  Adopted structural tonal overlap and architectural cut ideas while rejecting Valentina's
  blush/pink palette and heavy clip-path shapes. Applied atmospheric blends across Hero→Location,
  Gallery→Gifts, RSVP→Family, and Family→Thank You, with arch cut for Location→Paris.
- **Location redesign:** Recomposed Location into an asymmetric editorial section on wide viewports
  (`grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr)`). Left column (~58%) presents venue
  name (`Canta Luna Campestre`), event date, and time (`20:00 HRS`). Right column (~42%) presents
  address, formal dress code, and high-contrast navigation action. Generic card clutter removed in
  favor of warm stone borders and hairline rules.
- **Paris Interlude responsiveness:** Mobile is an immersive full-bleed photo reset. Tablet and
  Desktop (≥ 768px) use a constrained editorial container
  (`max-width: min(68rem, calc(100% - 4rem))`, `max-height: min(78vh, 46rem)`) with
  `object-fit: cover` centered at `50% 40%` to preserve sharpness and natural composition without
  destructive zoom. Paris photo remains strictly unique to Interlude.
- **RSVP surface & contrast:** Multiple nested dark rectangles flattened into a single dominant
  graphite ink surface (`--color-surface-dark: #202328`). Radio cards (`.rsvp__radio-card`) feature
  AA/AAA compliant text contrast across default, hover, selected
  (`background: rgb(var(--alba-sage-rgb) / 35%)`, `border-color: var(--alba-gold)`), keyboard focus
  (`outline: 2px solid var(--alba-gold)`), and disabled states. Submit button updated to
  high-contrast warm ivory background with navy bold text.
- **Family arch treatment:** Retained real courtyard arch in `family.webp`. Applied a soft arch-echo
  vignette overlay (`radial-gradient` + `linear-gradient`) on `.family__media-frame` that preserves
  100% visibility of all family members without cropping any head or body across mobile, tablet, and
  desktop viewports. Phrase: «El corazón de esta celebración es mi familia.»
- **Thank You optimization:** Split 2-column grid on tablet/desktop
  (`grid-template-columns: minmax(0, 0.78fr) minmax(0, 1.1fr)`). Photo frame constrained to
  `max-width: min(15.5rem, 100%)` with `4:5` aspect ratio. Single gratitude message rendered with
  Cormorant Garamond drop-cap, Pinyon Script signature (`Alba Rosa`), and closing date. Strict CSS
  guard (`.thank-you-message + .thank-you-message { display: none; }`) prevents duplicate rendering.
- **Unique photo roles:** Strictly enforced single-role photo map: Hero → `hero-desktop.webp` /
  `hero-mobile.webp`; Paris Interlude → `gallery-01-paris`; Gallery → `gallery-02-london`,
  `03-nyc-holiday`, `05-albert`; Family → `family.webp`; Thank You → `thank-you.webp`. Zero
  cross-section duplicates.
- **Responsive validation results:** Validated across the full viewport matrix (320×568, 360×800,
  390×844, 430×932, 768×1024, 906×870 near-square, 1024×768, 1440×900, 1920×1080). Verified zero
  face cropping in Hero, AAA RSVP text contrast, sharp Paris Interlude framing, 2-column Location
  layout, full family group visibility, split Thank You grid, and zero horizontal overflow.
- **Automated validation:** `pnpm validate:changed` passed (35 test suites / 292 tests pass),
  `pnpm type-check` passed (0 errors), `pnpm validate:event-parity` passed, and
  `pnpm agent:git-safety:check` passed baseline.
- **Unresolved issues:** Closed envelope animation background retains legacy warm brown tone
  (outside invitation profile scope) — **resolved by the Neutral TOP PREMIUM refinement below**.
  Provisional WhatsApp source photo resolution remains the underlying detail ceiling.

### Neutral TOP PREMIUM Refinement (2026-07-28 — implemented final state)

Implemented in `src/styles/invitation-profiles/alba-rosa-quinonez.scss` and
`src/lib/invitation/intersection-profiles.ts` only. No shared components, presets, or other
invitations were modified.

- **Café/brown removal:** All inherited luxury-hacienda café tones neutralized inside the profile
  scope: reveal/envelope/seal tokens (`--env-*`, `--reveal-card-*`), header + mobile drawer hooks
  (`.header-base[data-variant]` element-level overrides), music player, personalized-access chrome
  (`--pa-*`), surface tokens (`--color-surface-secondary/elevated/canvas`), and all sepia image
  filters (`--theme-image-filter-*`, `--interlude-image-filter`) replaced with neutral
  contrast/saturation curves.
- **Reveal & seal:** Deep graphite radial stage (`rgb(44 47 52) → ink`), warm-ivory envelope paper,
  charcoal/ivory typography, satin champagne seal (`--alba-champagne: rgb(201 184 148)`, no
  gold/bronze). Reveal card is fully opaque ivory; the letter stage is `visibility: hidden` while
  the envelope is closed, so only one identity hierarchy shows at a time (closed = envelope, opened
  = letter).
- **Hero fixes:** `<br>` separators between title lines suppressed (removes the blank-line hole in
  the name). Aspect-aware focals: 640–991px `72% 22%`, near-square (≥ 9/10 ratio) `62% 14%` — full
  face verified at 906×870 and 768×1024. Desktop content gets `padding-block` reserve so the date
  never clips or collides with DESLIZA at 1440×900.
- **Location editorial:** Card UI removed entirely (no background, border, shadow, pills, boxed copy
  icon, or "CELEBRACIÓN" heading). Hierarchy: date eyebrow → LOS ESPERAMOS with extending hairline →
  venue display serif → time meta → address with ghost copy icon → stacked text actions
  (`APPLE MAPS ↗`, `ABRIR EN GOOGLE MAPS ↗` with champagne hairline underlines, left rule column) →
  dress code as hairline metadata line. Asymmetric 1.15fr/0.85fr composition ≥ 768px.
- **Paris Interlude:** Tablet/desktop renders the photograph at natural proportions (`height: auto`,
  no `object-fit: cover` box) as an off-center editorial plate (`width: min(38rem, 54vw)`,
  asymmetric left margin) on graphite — Eiffel tip, Alba, and sharpness fully preserved. Mobile
  keeps full-bleed with focal `34% 30%` so Alba is not half-cut.
- **Gallery:** Light limestone surface (`rgb(228 224 216) → rgb(222 218 209)`) declared at element
  level to outrank the preset's dark café band. Charcoal `MOMENTOS` heading (strong contrast), sepia
  filters removed, featured + support asymmetric grid preserved, Albert Memorial crop corrected
  (`60% 84%`).
- **Gifts:** Quiet ivory pause: heading + single champagne hairline + verified message in Cormorant
  italic. Extra bottom clearance hosts the descending graphite diagonal.
- **RSVP flattening:** One graphite surface painted once by the outer section; nested
  `.rsvp-section` shell and `.rsvp` panel are transparent (no nested rectangles or seams).
  `min-block-size: auto` removes idle viewport dead space. Label legibility root cause fixed:
  `--color-text-primary-rgb` now maps to ivory channels inside the RSVP scope (the hacienda theme
  derives `--rsvp-label-color` from it); placeholder/muted tokens set explicitly. All control states
  verified legible.
- **Family:** Flat `rgb(233 229 222)` stone surface; diagonal pattern texture disabled
  (`--family-texture-image: none`). Real courtyard arch echoed by an arch-top border-radius mask
  (`50% 50% 0 0 / 22% 22% 0 0`) that trims only wall/sky — all six people intact at every viewport.
  Quote anchored to the photo with a champagne hairline; on desktop it sits against the photo's
  lower third.
- **Asymmetric intersections:** Three strategies, two axis-breaking diagonals: (1) Paris → Gallery —
  `overlap` family + limestone diagonal clip rising left-deep → right
  (`polygon(0 7rem, 58% …, 100% 0, …)`); (2) Gifts → RSVP — mirrored graphite diagonal descending
  left → right-deep; (3) Family → Thank You — photographic bleed: the ivory-framed memory photo
  crosses the boundary via negative margin (wrapper z-index 2, section `overflow: visible`).
  Location → Paris keeps the arch crown. Configured in `intersection-profiles.ts`
  (`gallery: overlap`, `rsvp: overlap source gifts`); personalized-access reverted to a neutral
  blend because the render plan repositions it near the top on guest links.
- **Thank You:** Broken floated drop cap neutralized — the gratitude message reads as one continuous
  paragraph; single message guard retained; polaroid ivory frame added for the bleed treatment.
- **Verification:** Full matrix re-captured post-implementation: 320×568, 390×844, 430×932,
  768×1024, 906×870, 1024×768, 1440×900, 1920×1080 — `document.scrollWidth === innerWidth` at all
  eight (zero horizontal overflow). Verified: no brown anywhere (reveal closed/letter, scrolled
  header, mobile drawer, gallery, RSVP), single identity hierarchy in the closed reveal, editorial
  Location, natural-proportion sharp Paris, light integrated Gallery, flat RSVP with legible states
  (open form checked at 390 and 1440), flat Family with safe arch mask, both diagonals plus the
  photo bleed clearly visible, coherent light/dark rhythm end to end.
- **Validations:** Focused tests (7/7), `pnpm validate:changed` (16 suites / 158 tests + ESLint +
  Stylelint + Prettier), `pnpm type-check` (0 errors), `pnpm validate:structure`,
  `pnpm validate:event-parity` — all pass. Managed Local: readiness `READY`; dry-run completes; it
  reports one pending gifts-items content diff originating from the pre-existing working-tree
  provision script edit (not applied; Local DB, Preview, and Production untouched).

### Final Reveal, 70th Anniversary & Senior-Friendly Refinement Record (2026-07-28 — final state)

Implemented focused visual, leitmotif, hierarchy, and senior-friendly usability refinements for
local invitation `/cumple/alba-rosa-quinonez` only. The shared Location renderer now retains an
eyebrow-only header and uses the concise `Google Maps` label; no presets or unrelated invitation
profiles were modified.

- **70 AÑOS Leitmotif:** Primary: Hero stacked age lockup. Secondary (4): (A) Closed envelope
  occasion under name, (B) Reveal letter `cardLabel`, (C) Location `introEyebrow`
  `70 AÑOS · 12 DE SEPTIEMBRE DE 2026` (metadata only), (D) Thank You copy column tiny champagne
  `70` accent at the Family → Thank You close. Never a repeated heading.
- **Reveal Hierarchy (Closed):** Closed envelope presents seal monogram (`A·R`) → given name
  (`Alba Rosa`) → occasion (`70 AÑOS`) → date (`12 · SEP · 2026`). The envelope is enlarged within a
  height-aware constraint; the occasion, date, CTA, and guest label all meet the 14px practical
  metadata floor with moderated tracking. Personalized guest information sits outside the envelope
  before the sole external `ABRIR LA INVITACIÓN` action; a simulated long name wraps to two lines at
  320×568 without overflow and leaves immediately as opening begins.
- **Reveal Hierarchy (Letter):** The letter contains only occasion (`70 AÑOS`) → honoree
  (`ALBA ROSA QUIÑÓNEZ LÓPEZ`) → date (`12 · SEP · 2026`). It has no guest block or second opening
  CTA. Letter paper is opaque ivory (`#F6F4F0`) with charcoal typography (`#2D2D2B`) and
  satin-champagne accents.
- **Hero 70 AÑOS Treatment:** Dominant age lockup: stacked `70` (display,
  ~`clamp(8.35rem, 15vw, 10.15rem)`) + `AÑOS` unit label; champagne tones; name remains the primary
  identity headline beneath. Not a small eyebrow.
- **Senior Readability & Touch Safety:** Essential metadata is 14px+ where practical, functional
  copy is 16px+ where practical, weights are 600+ for key controls, tracking is moderated, and the
  existing ≥44px controls, high-contrast focus outline, and reduced-motion behavior remain in force.
- **Local Managed Application:** Applied only to the Local managed invitation (public version v11).
  The final dry-run reports `0 operations / SIN CAMBIOS`; Preview and Production remain untouched.
- **Countdown & Location:** Countdown is a live compact editorial unit: `FALTAN` → `{n} DÍAS` →
  `PARA CELEBRAR`, days only, no date/footer/frame, normal wrapping, and a sensible
  `La celebración ya comenzó` state. Location suppresses the competing `Los esperamos` heading but
  preserves the eyebrow. It explicitly groups Event, Location, Navigation, and Protocol; mobile
  flows event/address → map → navigation → dress code, while tablet/desktop uses a 55/45
  left-information/right-map-and-actions composition.
- **Map & legibility:** The existing map uses verified Canta Luna coordinates at zoom 15 with venue
  pin and Carto street context. Its neutral filter and border are eased to retain road/street-label
  clarity without commercial clutter or card-like shadow. Address copy and each map action have a
  44px target; functional/address text remains 15.2px+ on mobile and 17.28px at tablet/desktop.
- **Automated Verification:** `pnpm validate:changed` passed (68 suites / 847 tests, ESLint and
  Stylelint; Prettier remains advisory for pre-existing changed-file debt), `pnpm type-check`
  passed, and `pnpm validate:event-parity` passed. Browser checks at 320×568, 390×844, 430×932,
  768×1024, 906×870, 1024×768, and 1440×900 confirmed document-level zero horizontal overflow, the
  single-column/55–45 Location geometry, available map tiles, 44px controls, and a 141px mobile /
  172–189px larger-screen countdown with no clipped supporting line.

---

### High-Impact Visual Refinement (2026-07-30 — implemented)

Lane A only: `src/styles/invitation-profiles/alba-rosa-quinonez.scss`, Location `introEyebrow` in
`scripts/provision/invitations/alba-rosa-quinonez.ts`, focused content test, and this document. No
shared presets, components, intersection-profile map changes, or new abstractions.

- **Secondary typography:** Stronger Thank You date/footer, RSVP labels/placeholder/subcopy/eyebrow,
  Location address/copy/nav secondary, gallery subtitle, reveal secondary — still subordinate to
  headings
- **Vertical rhythm:** Tighter clamps on countdown, location, gallery, gifts, pass, family,
  thank-you; RSVP host clearance no longer double-counts a full content band on top of cut depth
- **Interactive hierarchy:** Location map actions: opaque ivory fill, charcoal border, weight 700,
  clear hover/focus; RSVP radios: stronger resting fill/border and label contrast; submit unchanged
- **Photographic language:** Shared `--alba-photo-filter` + `--alba-photo-shadow` across hero,
  interlude, gallery, family, thank-you; role framing preserved (bleed / plate / grid / arch /
  polaroid)
- **Intersections:** Families unchanged. Refined Hero→Countdown→Location atmospherics (shallower
  asymmetric radials), Pass/Gifts→RSVP overlap clearance, Family→Thank You blend + bleed math.
  Arch + Paris→Gallery structure intact
- **70 años motif:** Hero lockup (primary); envelope; letter label; Location eyebrow
  `70 AÑOS · 12 DE SEPTIEMBRE DE 2026`; Thank You copy `::before` tiny `70`
- **Shared blast radius:** Contained — other invitations untouched
- **Local content apply:** Provision SoT includes Location eyebrow; live Local DB still needs apply
  when provenance allows (`legacy_provenance` currently blocks `invitation:release --targets local`)
- **Follow-up polish:** Countdown mineral plate differentiated from Location ivory; map CTAs
  charcoal primary + Apple outline; gallery overlap `padding-block-start` re-asserted so eyebrow
  clears Paris clip; payload tests are structural contracts (not editable-copy golden)
- **Vertical spacing:** Section shells raised toward ~4rem editorial minimum (`clamp` 3.25–6.25rem
  by band); internal gaps opened; gallery header `margin-top: 7rem` removed in favor of overlap
  `padding-top` that overrides `[data-after-interlude]` collapse so the eyebrow clears the Paris
  cut; RSVP host clearance + Thank You bleed retuned without double-counting cut depth

---

## Preparation Readiness History

| date       | readiness                  | notes                                                                                 |
| ---------- | -------------------------- | ------------------------------------------------------------------------------------- |
| 2026-07-28 | `NOT_READY`                | Initial prep; blocked on slug                                                         |
| 2026-07-28 | `READY_WITH_PLACEHOLDERS`  | Owner resolved facts; RSVP locked to `api`+`hybrid`                                   |
| 2026-07-28 | `READY_WITH_PLACEHOLDERS`  | Implemented locally; provisional source resolution remains                            |
| 2026-07-28 | `READY_WITH_PLACEHOLDERS`  | Quality audit: chrome crop, no-upscale, Palette 1 for owner eval                      |
| 2026-07-28 | `READY_FOR_IMPLEMENTATION` | **Invalid (corrected 2026-07-31):** provisional inventory cannot clear full readiness |
| 2026-07-31 | `READY_WITH_PLACEHOLDERS`  | Goal 2 hygiene + helper alignment; opaque Sources; provisional ceiling restored       |
