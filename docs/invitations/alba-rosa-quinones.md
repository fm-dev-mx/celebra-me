# Canonical Invitation Preparation State — `alba-rosa-quinones`

> Schema owner: `docs/core/invitation-preparation-contract.md`  
> Executable evaluation: `src/lib/invitation-preparation/`  
> Workflow: `.agent/workflows/invitation-preparation.md`

---

## Identity

| Parameter              | Value                                            |
| ---------------------- | ------------------------------------------------ |
| **Slug**               | `alba-rosa-quinones`                             |
| **Event Type**         | `cumple`                                         |
| **Preparation Status** | `READY_FOR_IMPLEMENTATION` (implemented locally) |

**Preparation Readiness:** `READY_FOR_IMPLEMENTATION`

Technical Local/Preview/Production readiness is **out of scope** for this document and remains owned
by `pnpm invitation:update --status` / `invitation-readiness.ts`.

---

## Sources

| Source                         | Reference                                                                                                                    | Notes                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| WhatsApp / conversation        | `C:\Users\fmdevmx\OneDrive\Documentos\Projects\celebra-me\Clientes\cumple alba-rosa\WhatsApp Chat - Lucero Ramirez Cliente\` | Facts/preferences only — never photo SoT |
| Photograph / assets root       | `C:\Users\fmdevmx\OneDrive\Documentos\Projects\celebra-me\Clientes\cumple alba-rosa\Fotos Sra Alba Rosa`                     | Authoritative photo source (8 JPEGs)     |
| Other authoritative references | Gift-legend screenshot `00000074-PHOTO-…jpg` in WA export                                                                    | Reference only; adapted copy below       |

---

## Fact Register

| field                 | value                                                                                                        | classification               | source                            | notes                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------- | --------------------------------- | -------------------------------------------------------------------------------- |
| slug                  | alba-rosa-quinones                                                                                           | verified                     | owner 2026-07-28                  | Confirmed                                                                        |
| celebrantName         | Alba Rosa Quiñones López                                                                                     | verified                     | WA 17/07/26                       |                                                                                  |
| eventLabel            | 70 Años                                                                                                      | inferred                     | age + demo pattern                |                                                                                  |
| eventDate             | 2026-09-11                                                                                                   | verified (+ year inferred)   | WA 17/07/26                       | “11 de septiembre”; year from chat chronology                                    |
| eventTime             | 20:00                                                                                                        | verified                     | WA 17/07/26                       |                                                                                  |
| timeZone              | America/Mexico_City                                                                                          | inferred                     | MX practice / Sinaloa             |                                                                                  |
| age                   | 70                                                                                                           | verified                     | WA 17/07/26                       |                                                                                  |
| hostContactName       | Lucero Ramírez                                                                                               | verified                     | WA                                | Contact / nuera                                                                  |
| primaryVenueName      | Canta Luna Campestre                                                                                         | verified                     | owner 2026-07-28                  |                                                                                  |
| primaryVenueAddress   | Supermanzana km 6, Los Mochis, Sinaloa                                                                       | verified                     | owner 2026-07-28                  |                                                                                  |
| dressCode             | Formal                                                                                                       | verified                     | WA 17/07/26                       |                                                                                  |
| giftsMode             | legend-only (no cofre / dinerito UI)                                                                         | verified                     | WA 17/07/26                       |                                                                                  |
| giftsLegend           | Mi mejor regalo es tu presencia, pero si deseas tener un detalle conmigo, puedes hacerlo dentro de un sobre. | verified (adapted per owner) | owner “Adaptar” + WA reference    | Adapted from wedding plural reference to singular birthday voice                 |
| baseDemoId            | demo-cumple-luxury-hacienda                                                                                  | verified                     | WA 13/07/26                       |                                                                                  |
| themePreset           | luxury-hacienda                                                                                              | inferred                     | catalog                           |                                                                                  |
| clientColors          | neutros: beige, cremita, blanco                                                                              | verified                     | WA 13/07/26                       |                                                                                  |
| stylePreference       | sencillo, sobrio, entendible (invitados mayores)                                                             | verified                     | WA                                |                                                                                  |
| sourceAssetPath       | `...\Fotos Sra Alba Rosa`                                                                                    | verified                     | owner                             |                                                                                  |
| primaryPhotoIntent    | Garden denim seated portrait (`d40988d8-…JPG`)                                                               | verified                     | WA + inventory                    |                                                                                  |
| photoPipelineDecision | Use folder sources; high-quality WebP via normalize (q84); exclude unusable                                  | verified                     | owner 2026-07-28                  | Preserve originals; no aggressive recompress                                     |
| familyNames           | —                                                                                                            | not_applicable               | —                                 | Names unverified; minimal family photo + phrase only                             |
| musicUrl              | —                                                                                                            | not_applicable               | —                                 | Music section omitted                                                            |
| itinerary             | —                                                                                                            | not_applicable               | —                                 | Itinerary omitted                                                                |
| rsvpConfirmationMode  | api                                                                                                          | verified                     | product standard (recent invites) | América, Xareni, Luna, Ayrin + intake default `api`; Valentina `both` is outlier |
| rsvpAccessMode        | hybrid                                                                                                       | verified                     | product standard (recent invites) | Matches América / Xareni / Luna / Ayrin                                          |
| rsvpGuestCap          | per-guest via dashboard                                                                                      | verified                     | WA 18/07/26                       | Payload guestCap follows demo/practice; passes assigned in dashboard             |
| sectionOrder          | hero, location, gallery, gifts, rsvp, thankYou, family                                                       | verified + owner goal        | owner “ok” + family close goal    | Family is the final emotional content section                                    |

---

## Event Completeness

Contract maturity for this event type: `undefined`

| requirement | fields                                                      | status        |
| ----------- | ----------------------------------------------------------- | ------------- |
| required    | slug, celebrantName, eventDate, baseDemoId, sourceAssetPath | all satisfied |
| conditional | —                                                           | —             |
| recommended | —                                                           | —             |
| optional    | —                                                           | —             |

### Missing blockers

- None for undefined `cumple` minima.

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
| slug                   | other-blocking        | Canonical slug          | owner                           | —       | `alba-rosa-quinones`                                          | **resolved**            |
| venueAddress           | missing-client-facts  | Venue name + address    | owner                           | —       | Canta Luna Campestre / Supermanzana km 6, Los Mochis, Sinaloa | **resolved**            |
| giftsLegendCopy        | ambiguous-data        | Adapt legend            | owner “Adaptar”                 | —       | Singular birthday adaptation applied                          | **resolved**            |
| sectionOrder           | demo-design-decisions | Sections                | owner “ok”                      | —       | hero → location → gallery → gifts → rsvp → thankYou           | **resolved**            |
| rsvpMode               | other-blocking        | N/A — product standard  | Recent invites + intake default | —       | `confirmationMode: api`, `accessMode: hybrid`                 | **resolved (standard)** |
| photoProvisionalAccept | photograph-acceptance | Use + high-quality WebP | owner 2026-07-28                | —       | Normalize WebP q84; preserve originals                        | **resolved**            |

---

## Agent Recommendations

| topic    | recommendation                                         | basis                                                     | status                       |
| -------- | ------------------------------------------------------ | --------------------------------------------------------- | ---------------------------- |
| demo     | `demo-cumple-luxury-hacienda` / `luxury-hacienda`      | Client selection                                          | accepted                     |
| palette  | Palette 1 Jardín Cobalto active for owner eval         | Photo-anchored cobalt + cream                             | **active — awaiting owner**  |
| rsvp     | `confirmationMode: "api"`, `accessMode: "hybrid"`      | América, Xareni, Luna, Ayrin; intake mapper default `api` | accepted as product standard |
| gifts UI | Single legend item only                                | Client constraint                                         | accepted                     |
| photos   | High-quality WebP; crop WhatsApp UI chrome; no upscale | owner + quality audit 2026-07-28                          | accepted                     |
| family   | Minimal photo + one phrase; no invented names          | owner goal                                                | implemented locally          |

---

## Sections

| bucket                 | section keys                                             |
| ---------------------- | -------------------------------------------------------- |
| requested / approved   | hero, location, gallery, gifts, rsvp, thankYou           |
| inferred / recommended | family (minimal emotional close — owner goal 2026-07-28) |
| omitted                | itinerary, music                                         |
| unresolved             | palette owner choice (1 of 3)                            |

---

## Design Direction

| decision                    | value                                                                                   | classification                     |
| --------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------- |
| Client-selected demo        | `demo-cumple-luxury-hacienda`                                                           | verified                           |
| Selected visual direction   | Simplify luxury-hacienda toward sobrio/neutral                                          | verified (style prefs)             |
| Client color requirements   | beige / cream / white                                                                   | verified                           |
| Active palette              | **Palette 1 — Jardín Cobalto**                                                          | agent recommendation pending owner |
| Hero composition            | Desktop landscape (subject right, type left); mobile portrait with localized UI removal | creative decision                  |
| Family section              | Existing `Family.astro` + profile minimalization (no new shared variant)                | creative decision                  |
| Unresolved visual decisions | Keep / try Palette 2 / targeted tweak                                                   | awaiting owner                     |

---

## Photograph Inventory

Source path:
`C:\Users\fmdevmx\OneDrive\Documentos\Projects\celebra-me\Clientes\cumple alba-rosa\Fotos Sra Alba Rosa`

### Final photo-role map (unique by section — 2026-07-28)

**Confirmed: no photograph is reused across semantic sections.** Desktop/mobile hero derivatives of
the same garden session count as one hero role.

| Role                    | Source                                                                    | Derivative                                                                  | Notes                                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero (desktop + mobile) | `d40988d8-…JPG` (965×2008)                                                | `hero-desktop.webp` 1672×941 / 270 KB; `hero-mobile.webp` 965×2008 / 178 KB | Mobile: localized upper-left foliage repair removes baked WhatsApp ✕ without touching subject pixels. Desktop: identity-preserving AI landscape recompose from the authoritative original, same person/wardrobe/garden |
| Gallery                 | `IMG_5317`, `3b20a415-…`, `4f40cbcf-…` (chrome top trimmed), `9d08b715-…` | `gallery-01-paris`, `02-london`, `03-nyc-holiday`, `05-albert`              | Cafe removed from gallery                                                                                                                                                                                              |
| Thank-you               | `IMG_5319.jpg` (cafe)                                                     | `thank-you.webp` 1171×2000 ~118 KB                                          | Was duplicate of hero garden — fixed. Top chrome bar cropped ~80px                                                                                                                                                     |
| Family                  | `00000059-PHOTO-2026-07-17-10-12-32.jpg` (994×1280)                       | `family.webp` 994×1280 ~228 KB                                              | Authoritative path; **no upscale**; composition preserved                                                                                                                                                              |
| Unused / excluded       | `11f42f9b-…` (Times Square), `IMG_5315.jpg`                               | —                                                                           | Skip / unusable                                                                                                                                                                                                        |

### Quality root-cause findings (owner feedback 2026-07-28)

| Symptom                         | Cause                                                                                                                                                   | Fix applied                                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile hero “button” upper-left | WhatsApp/UI close ✕ **baked into source JPEG** (bbox ~x0–90, y22–129), not CSS; the prior derivative also contained a blocky attempted repair           | Localized mirrored-foliage repair limited to the upper-left 120×160 px; full 965×2008 framing and all subject pixels preserved                                                      |
| Cafe thank-you chrome           | Black status bar + back arrow / ⋮ in source                                                                                                             | Top crop ~80px                                                                                                                                                                      |
| Over-cropping                   | Pipeline used `fit:'cover'` + `attention` / upscale (`withoutEnlargement:false`) on thank-you/family                                                    | Switched to `fit:'inside'` + `withoutEnlargement:true`                                                                                                                              |
| Blurriness (pipeline)           | Family was upscaled 994→1398; Hero `getImage` forced **mobile width 640 @ q80**, then re-encoded already-normalized remote WebPs and could enlarge them | Family native dims; managed remote Hero derivatives now bypass a second Astro encode; static images cap requested width at their native width; Family OptimizedImage 960×1280 @ q84 |
| Blurriness (ceiling)            | Sources are provisional WhatsApp ~0.5–2.6 MP                                                                                                            | Cannot invent detail; preserve source resolution                                                                                                                                    |
| Double encode risk              | Release WebP → `normalizeInvitationImage` q84 on Local apply → Astro `getImage`                                                                         | Managed remote Hero WebPs now render directly; Astro optimization remains only for static `ImageMetadata` and never requests beyond native width                                    |

### Hero asset mapping

| Viewport | Source                                                          | Generated           | Dims     | Encode            | Intent                                                                                   |
| -------- | --------------------------------------------------------------- | ------------------- | -------- | ----------------- | ---------------------------------------------------------------------------------------- |
| Desktop  | `d40988d8-…JPG` via built-in identity-preserving landscape edit | `hero-desktop.webp` | 1672×941 | WebP q93 / 270 KB | Native delivery size; subject right; negative space left for type; no downstream enlarge |
| Mobile   | same JPG, localized upper-left UI repair                        | `hero-mobile.webp`  | 965×2008 | WebP q90 / 178 KB | Original full-length portrait and subject pixels preserved; no enlargement               |

### Family asset mapping

| Field                | Value                                                                |
| -------------------- | -------------------------------------------------------------------- |
| Authoritative source | `…\Fotos Sra Alba Rosa\00000059-PHOTO-2026-07-17-10-12-32.jpg`       |
| Derivative           | `src/assets/invitations/alba-rosa-quinones/family.webp`              |
| Dims / weight        | 994×1280 / ~228 KB WebP q88                                          |
| Processing           | rotate + inside resize **without enlargement**; no AI reconstruction |

### Palette alternatives (3 of 3 documented; only Palette 1 implemented)

#### Palette 1 — Jardín Cobalto (**ACTIVE**)

| Token                | Value                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Primary background   | Ivory `#FCF9F4`                                                                                                    |
| Secondary background | Cream `#F4EEE4`                                                                                                    |
| Primary text         | Ink `#342E28`                                                                                                      |
| Secondary text       | Ink 78%                                                                                                            |
| Accent               | Cobalt `#244A8C` (hero dress)                                                                                      |
| Supporting           | Garden green / warm sand                                                                                           |
| Rationale            | Anchors the invitation to the hero photograph’s cobalt dress while keeping cream paper for older-guest readability |
| Photo relationship   | Cobalt ↔ dress; garden green ↔ foliage; cream ↔ neutrals requested by client                                       |
| Character            | Premium garden editorial, calm, adult birthday                                                                     |
| Trade-offs           | Cobalt is stronger than pure beige client note; still sobrio if used sparingly as accent                           |

#### Palette 2 — Pergamino Neutro (not implemented)

| Token               | Value                                                   |
| ------------------- | ------------------------------------------------------- |
| Primary / secondary | Warm ivory / soft beige                                 |
| Text                | Charcoal / warm stone                                   |
| Accent              | Warm stone / taupe (no cobalt)                          |
| Rationale           | Closest to verified client neutrals (beige/cream/white) |
| Trade-offs          | Safer but less distinctive; weaker tie to dress color   |

#### Palette 3 — Arcada Terracota (not implemented)

| Token               | Value                                             |
| ------------------- | ------------------------------------------------- |
| Primary / secondary | Warm parchment / blush sand                       |
| Text                | Deep espresso                                     |
| Accent              | Terracotta / rose from family courtyard walls     |
| Rationale           | Anchors to family photograph architecture         |
| Trade-offs          | May fight cobalt hero dress; warmer/more dramatic |

### Hero design decisions

- Reuse `luxury-hacienda` hero variant; Lane A profile softens overlays and left-aligns desktop type
  into negative space.
- Avoid heavy black crush that previously hid photographic detail.
- Focal points favor subject on the right for desktop (`~72% 42%`).

### Family-section decision

- Reused existing `Family.astro` with `presentation: 'with-photo'`, no named relatives (unverified).
- Profile hides eyebrow/title/divider/name lists; shows photo + phrase: «El corazón de esta
  celebración es mi familia.»
- Section order: `… → rsvp → thankYou → family` (Family is the final emotional content section).

### Local visual-validation state

| Check                  | State                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| Photo uniqueness       | Mapped — no cross-section duplicates                                                     |
| Mobile chrome ✕        | Removed with localized background repair; full framing retained                          |
| Desktop hero           | 1672×941 dedicated native derivative present; direct delivery prevents upscale/re-encode |
| Family source          | Authoritative `00000059-…`                                                               |
| Active palette         | Palette 1 only                                                                           |
| Mobile proof           | 390×844: native 965×2008 Hero source, `50% 28%` focal, no horizontal overflow            |
| Desktop proof          | 1440×900: native 1672×941 Hero source, `72% 42%` focal, no horizontal overflow           |
| Section coverage       | 28/28 captures produced across 360, 390, 768, and 1440 px widths; 7/7 sections each      |
| Local managed state    | Public v3; readiness `READY`; final verify dry-run reports zero operations               |
| Preview / Production   | Untouched                                                                                |
| Owner palette decision | **Awaiting** keep / try Palette 2 / tweak                                                |

The screenshot tool produced every requested artifact successfully but its manifest reported a known
task-ID bookkeeping failure (empty required task IDs). Direct Playwright measurements and element
captures independently verified the Hero, Family, section order, image sources, palette, and
overflow state.

### Optimization verdict (2026-07-28)

**Usar estas fotos como fuente** y **optimizar a WebP de alta calidad** en el pipeline. No esperar
otro lote.

| Decision                   | Detail                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source of truth            | Folder `Fotos Sra Alba Rosa` (not WhatsApp chat attachments)                                                                                           |
| Quality class              | `provisional-whatsapp` / mobile-compressed — max ~2.6 MP; most files 95–309 KB                                                                         |
| Owner directive            | Optimize to WebP **without perceptible quality loss**                                                                                                  |
| What “optimize” means here | Preserve JPEG originals untouched; repair baked UI only outside the subject; WebP without enlargement; avoid cover/attention crops unless art-directed |
| What not to do             | Upscale beyond source; aggressive recompress; invent facial detail                                                                                     |
| Exclude                    | `IMG_5315.jpg` (364×640, unusable for gallery/hero)                                                                                                    |
| Optional skip              | `11f42f9b-…JPG` (busy Times Square / low res)                                                                                                          |
| Production note            | Source resolution is the ceiling                                                                                                                       |

Role-aware WebP transfer-weight **targets** (guidance):

| Role         |     Target |
| ------------ | ---------: |
| Hero desktop | 250–500 KB |
| Hero mobile  | 180–350 KB |
| Gallery      |  80–180 KB |
| Family       | 150–300 KB |

---

## Implementation Constraints

- Preparation readiness is `READY_FOR_IMPLEMENTATION`.
- Lane A: client neutrals + cobalt accent (Palette 1), legend-only gifts, family minimal close on
  luxury-hacienda.
- Lane B: only if a change also improves `demo-cumple-luxury-hacienda`.
- Music / itinerary: omit.
- RSVP product standard: `confirmationMode: "api"`, `accessMode: "hybrid"`.
- Assets: preserve originals; remove baked UI without altering the subject; no deterministic
  upscale.

### Implementation record (2026-07-28)

| Area                 | State                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Managed definition   | `scripts/provision/invitations/alba-rosa-quinones.ts` (registered)                                                                                                |
| Release assets       | `src/assets/invitations/alba-rosa-quinones/*.webp` (hero×2, thank-you, family, gallery×4)                                                                         |
| Lane A profile       | `src/styles/invitation-profiles/alba-rosa-quinones.scss` — Palette 1                                                                                              |
| Shared quality fixes | `Hero.astro` / `EditorialMagazineHero.astro` direct-deliver managed WebPs and cap static optimization at native width; `Family.astro` OptimizedImage 960×1280@q84 |
| Focused test         | `tests/content/alba-rosa-quinones-payload.test.ts`                                                                                                                |
| Local apply          | Public v3 applied and verified; final content-and-assets dry-run is `SIN CAMBIOS`                                                                                 |
| Validation           | `validate:changed` (20 suites / 135 tests), `type-check`, `validate:structure`, and `validate:event-parity` pass                                                  |
| Preview / Production | Not applied                                                                                                                                                       |
| Route                | `/cumple/alba-rosa-quinones` (local)                                                                                                                              |

---

## Preparation Readiness History

| date       | readiness                  | notes                                                                                      |
| ---------- | -------------------------- | ------------------------------------------------------------------------------------------ |
| 2026-07-28 | `NOT_READY`                | Initial prep; blocked on slug                                                              |
| 2026-07-28 | `READY_WITH_PLACEHOLDERS`  | Owner resolved facts; RSVP locked to `api`+`hybrid`                                        |
| 2026-07-28 | `READY_WITH_PLACEHOLDERS`  | Implemented locally; provisional source resolution remains                                 |
| 2026-07-28 | `READY_WITH_PLACEHOLDERS`  | Quality audit: chrome crop, no-upscale, Palette 1 for owner eval                           |
| 2026-07-28 | `READY_FOR_IMPLEMENTATION` | No placeholders remain; dedicated Hero and Family assets verified for Local implementation |
