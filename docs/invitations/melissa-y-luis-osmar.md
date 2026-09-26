# Canonical Invitation Preparation State — `melissa-y-luis-osmar`

> Schema owner: `docs/core/invitation-preparation-contract.md`  
> Executable evaluation: `src/lib/invitation-preparation/` (**prepReadiness SSOT**)  
> Scope: implementation and managed application in Local and Preview only, including the dedicated
> technical host identity created by the canonical release workflow. Production, guest creation and
> RSVP persistence remain outside the authorized boundary.

## Identity

| Parameter              | Value                      |
| ---------------------- | -------------------------- |
| **Slug**               | `melissa-y-luis-osmar`     |
| **Host Login Alias**   | `melissa_landell`          |
| **Event Type**         | `boda`                     |
| **Preparation Status** | `READY_FOR_IMPLEMENTATION` |

**Preparation Readiness (prepReadiness):** `READY_FOR_IMPLEMENTATION`

This state must remain aligned with `evaluatePreparationReadiness`. Technical Local, Preview, and
Production readiness (**envReadiness**) remains separately owned by the managed release workflow.

## Sources

| Source                      | Reference                        | Notes                                                                         |
| --------------------------- | -------------------------------- | ----------------------------------------------------------------------------- |
| WhatsApp / conversation     | `source:wa-export`               | Evidence only; the raw export and attachments are not committed               |
| Client reference sheet      | `source:client-reference-sheet`  | Event facts and visual direction; not reused as a production asset            |
| Generated architectural art | `source:generated-venue-art`     | Project-local masters and prepared derivatives; interpretive, not documentary |
| Public venue references     | `source:public-venue-references` | Address evidence; navigation links still require client confirmation          |
| Client map links            | `source:client-map-link`         | Google Maps pins supplied and confirmed for both venues                       |

## Fact Register

Classification is one of: `verified` | `inferred` | `ambiguous` | `missing` | `not_applicable` |
`requires_owner_decision`.

| field                 | value                                                                                    | classification | source                        | notes                                                         |
| --------------------- | ---------------------------------------------------------------------------------------- | -------------- | ----------------------------- | ------------------------------------------------------------- |
| slug                  | melissa-y-luis-osmar                                                                     | verified       | owner implementation plan     | Orthography and canonical route explicitly approved           |
| celebrantName         | Melissa Landell Osuna                                                                    | verified       | source:client-reference-sheet | Full name supplied by client                                  |
| secondaryName         | Luis Osmar Muñoz Rodríguez                                                               | verified       | source:client-reference-sheet | Full name supplied by client                                  |
| eventDate             | 2026-12-16                                                                               | verified       | source:client-reference-sheet | Wednesday, 16 December 2026                                   |
| eventTime             | 12:00                                                                                    | verified       | source:client-reference-sheet | Religious ceremony start                                      |
| timeZone              | America/Mazatlan                                                                         | inferred       | venue city + IANA zone        | Must be reconfirmed before publication                        |
| baseDemoId            | demo-boda-jewelry-box-wedding                                                            | verified       | source:wa-export              | Client selected the shared wedding demo direction             |
| sourceAssetPath       | src/assets/invitations/melissa-y-luis-osmar                                              | verified       | source:generated-venue-art    | Repository-relative root; no client filesystem path persisted |
| sectionOrder          | quote, countdown, family, location, itinerary, gifts, personalizedAccess, rsvp, thankYou | verified       | owner implementation plan     | Interludes are auxiliary narrative inserts                    |
| primaryVenueName      | Catedral Basílica de la Inmaculada Concepción                                            | verified       | source:client-reference-sheet | Ceremony venue                                                |
| primaryVenueAddress   | 21 de Marzo, Centro, 82000 Mazatlán, Sinaloa                                             | verified       | source:client-map-link        | Google Maps pin confirmed for the cathedral                   |
| receptionVenueName    | Belcanto Jardín                                                                          | verified       | source:client-reference-sheet | Reception and civil ceremony venue                            |
| receptionVenueAddress | Lib. 3 12100, Valle del Ejido, 82129 Mazatlán, Sinaloa                                   | verified       | source:client-map-link        | Google Maps pin confirmed for Belcanto Jardín                 |
| distinctVenues        | true                                                                                     | verified       | source:client-reference-sheet | Ceremony and reception use different venues                   |
| rsvpConfirmationMode  | api                                                                                      | verified       | owner implementation plan     | Canonical RSVP API                                            |
| rsvpAccessMode        | personalized-only                                                                        | verified       | owner implementation plan     | Assigned guest pass determines capacity                       |
| rsvpDeadline          | 2026-11-16                                                                               | verified       | owner implementation plan     | Thirty days before the event                                  |
| dressCode             | De etiqueta                                                                              | verified       | source:client-corrections     | Supersedes earlier "Gala formal" wording                      |
| childPolicy           | Celebración reservada para adultos                                                       | verified       | source:client-reference-sheet | Formal visible wording                                        |
| gifts                 | Liverpool event 60019030; Sobres                                                         | verified       | source:client-corrections     | Liverpool retained; remove "lluvia" from cash option          |
| musicUrl              | Cloudinary direct audio source                                                           | verified       | owner-provided source         | “A Thousand Years” by Christina Perri; autoplay enabled       |
| clientColors          | marfil, perla, taupe, cacao y champagne                                                  | verified       | owner implementation plan     | Champagne restricted to decorative emphasis                   |

### Family and godparents

| role                  | name                            | classification | source                        | publication note                                      |
| --------------------- | ------------------------------- | -------------- | ----------------------------- | ----------------------------------------------------- |
| Madre de Melissa      | Martha Elena Osuna Rubio        | verified       | source:client-reference-sheet | Confirm final accents before publication              |
| Padre de Melissa      | Rodrigo Landell Osuna           | inferred       | source:client-reference-sheet | Capitalization normalized; confirm before publication |
| Madre de Luis Osmar   | Martha Leticia Rodríguez Vargas | verified       | source:client-reference-sheet | Confirm final accents before publication              |
| Padre de Luis Osmar   | Jesús Gerardo Muñoz Silva       | verified       | source:client-corrections     | Fallecido; mostrar † junto al nombre                  |
| Padrino de matrimonio | Leonardo Campuzano              | verified       | source:client-reference-sheet | —                                                     |
| Madrina de matrimonio | María Laura Moraga              | verified       | source:client-reference-sheet | —                                                     |
| Madrina de velación   | Lucina Elsi Morán               | inferred       | source:client-reference-sheet | Accent normalized; confirm before publication         |
| Padrino de velación   | Darío Osuna Rubio               | inferred       | source:client-reference-sheet | Accent normalized; confirm before publication         |

## Event Completeness

Contract maturity for `boda`: `partial`.

- **requirement:** required
  - **fields:** slug, celebrantName, secondaryName, eventDate, baseDemoId, sourceAssetPath,
    sectionOrder, primaryVenueName, primaryVenueAddress, rsvpConfirmationMode
  - **status:** resolved
- **requirement:** conditional
  - **fields:** receptionVenueName, receptionVenueAddress
  - **status:** resolved; distinct venues
- **requirement:** contract gaps
  - **fields:** family, gifts, music, dress and palette are not standardized in the boda
    completeness matrix
  - **status:** captured as invitation facts

### Missing blockers

- None for Local and Preview implementation according to `evaluateEventCompleteness`.

### Non-blocking release dependencies

- Confirm the normalized capitalization and accents of family and godparent names.
- Obtain a client contact email and WhatsApp only if later required for a human handoff; the managed
  release uses the canonical technical identity derived from `hostLoginAlias`.

Deterministic question: **Is the available information sufficient to prepare this invitation?**
Answer: `yes`.

## Placeholders

No content placeholder tokens are used. Unverified operational details are omitted rather than
rendered as plausible navigation links.

| token | missing datum | blocking | reason | replacement requirement |
| ----- | ------------- | -------- | ------ | ----------------------- |

## Owner Decisions

| id       | category              | issue                                                    | evidence                               | options                                       | recommendation                                 |
| -------- | --------------------- | -------------------------------------------------------- | -------------------------------------- | --------------------------------------------- | ---------------------------------------------- |
| maps     | confirmed-client-link | Exact navigation pins confirmed via client links         | Client Google Maps links               | Use pins; keep buttons hidden in simple mode  | Keep navigation buttons hidden per simple mode |
| names    | ambiguous-data        | Three names received capitalization/accent normalization | Client reference sheet                 | Approve normalized forms / supply corrections | Confirm normalized forms before publication    |
| contact  | missing-client-facts  | Client handoff contact is absent                         | No authoritative contact supplied      | Supply email and WhatsApp before handoff      | Use only the canonical technical host identity |
| creative | photograph-acceptance | Generated venue art requires human review                | Six generated candidates; two selected | Accept / request bounded revision             | Review selected art in the complete invitation |

## Agent Recommendations

| topic     | recommendation                                                                   | basis                                                                  | status                                        |
| --------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| venue art | Use interpretive architectural editorials, not simulated documentary photographs | Sparse public Belcanto evidence and client request for premium visuals | approved for Local and Preview implementation |
| palette   | Warm ivory editorial-light arc with a cacao closing band                         | Client neutral preference plus Jewelry Box foundation                  | approved for Local and Preview implementation |
| media     | Keep the cathedral interlude only; omit landscape, Belcanto image and gallery    | Explicit client requirement and narrative restraint                    | approved for Local and Preview implementation |

## Sections

| bucket     | section keys                                                                             |
| ---------- | ---------------------------------------------------------------------------------------- |
| requested  | quote, countdown, family, location, itinerary, gifts, personalizedAccess, rsvp, thankYou |
| auxiliary  | cathedral interlude after family                                                         |
| omitted    | gallery                                                                                  |
| unresolved | none for Local and Preview implementation                                                |

## Design Direction

| decision                          | value                                                            | classification      |
| --------------------------------- | ---------------------------------------------------------------- | ------------------- |
| Client-selected demo              | `demo-boda-jewelry-box-wedding`                                  | verified            |
| Recommended demo alternatives     | —                                                                | not_applicable      |
| Selected variant / visual profile | `jewelry-box-wedding` / `melissa-y-luis-osmar`                   | verified            |
| Client color requirements         | neutral palette                                                  | verified            |
| Recommended palette               | `#F7F3ED`, `#FFFDF9`, `#302925`, `#75675E`, `#3A312C`, `#A9825A` | owner-approved plan |
| Unresolved visual decisions       | —                                                                | not_applicable      |

The reference collage informs materiality and hierarchy only. It is not copied and is not a
production asset. Lane A owns invitation data, assets and profile values. Lane B is limited to
optional stationery controls in the canonical itinerary, quote, formal-pass and formal-register SCSS
owners. Shared presets, schemas and renderers remain unchanged.

## Sistema tipográfico

The current direction follows the owner-approved September 22 correction and the client video as
evidence of stationery materiality, not operational instructions or reusable content. The opening
uses an open ivory composition with a curved tonal plane, an oversized calligraphic first name,
right-aligned secondary name and date, a small monogram, and a single botanical engraving. The
rectangular paper frame and drop shadow were removed after owner feedback; the owner accepted this
hero in the current task. No landscape artwork is rendered. Preserve the cathedral image and its
crop; join itinerary directly to gifts without the Belcanto image.

Quote and countdown form one visual chapter with a combined one-small-viewport minimum height
(42svh + 58svh). A short champagne hairline separates the quotation from the pearl countdown
surface. Days lead the timer, with hours, minutes, and seconds in a secondary row. Both sections
grow naturally for long copy and enlarged text, without clipping or nested scrolling. Family retains
its own one-small-viewport minimum height. A linen surface with an asymmetric curved top edge is
painted inside the family's reserved padding, without overlapping countdown content or changing the
canonical wrapper intersection. Below 768 px the parent groups alternate leading/trailing alignment
in one column; paired groups are reserved for larger screens. Godparents close centrally at a
smaller name scale. Family content grows beyond one viewport when this reading rhythm requires it.
Content and the accepted hero remain unchanged; this section refinement awaits visual acceptance.

| Role                               | Family                     | Treatment                                                             |
| ---------------------------------- | -------------------------- | --------------------------------------------------------------------- |
| Hero names / primary headings      | Pinyon Script / Cinzel     | Both names in cursive; reduced ampersand; restrained heading tracking |
| Family names and prose             | Cormorant Garamond         | Names above roles; 18–20 px body prose                                |
| Practical information and controls | Instrument Sans            | 16 px information; 12 px metadata                                     |
| Formal pass and RSVP chapter       | Canonical variant controls | Instrument Sans labels; reduced type scale and density                |

All fonts reuse installed dependencies. Dark taupe replaces ornamental gold for small text on paper.
Champagne remains available for borders and decoration. Countdown uses canonical grid reflow at 200%
text size; copy controls retain a 44 px minimum. Motion follows semantic timing and disables
decorative hover transforms for reduced motion.

Lane A scope: invitation data, profile, literal client copy and focused verification. Existing
shared responsive fixes and envelope geometry are preserved. Optional stationery tokens are
documented in the theme architecture contract. The reference's extra family intersection is omitted:
the existing canonical section flow remains.

## Creative Direction & Acceptance

**Human creative outcome:** `PENDING`

Client corrections received on 2026-09-23: show `†` beside Jesús Gerardo Muñoz Silva, give Luis
Osmar's opening name the same visual size as Melissa's, label the cash gift `Sobres` while retaining
Liverpool, and use `De etiqueta.` for dress code. These supersede the earlier dagger suppression and
copy decisions. Responsive review and human creative acceptance remain pending; no managed apply or
publication is implied.

| concern                     | decision / evidence                                                                                     | status     |
| --------------------------- | ------------------------------------------------------------------------------------------------------- | ---------- |
| Typography roles            | Cinzel headings, Cormorant names/prose, Instrument Sans practical information; canonical formal chapter | verified   |
| Vertical rhythm and density | Editorial-light flow with one cathedral pause and dark closing action band                              | verified   |
| Surface hierarchy           | Ivory ground, pearl opening sheet, taupe program and cocoa closing chapter                              | verified   |
| Photographic treatment      | Cathedral artwork retained; no hero landscape or Belcanto interlude                                     | verified   |
| Section-intersection intent | Family→cathedral overlap; cathedral→location blend; itinerary→gifts neutral; gifts→access arch          | verified   |
| Local exceptions            | `.event--melissa-y-luis-osmar` profile only                                                             | documented |

### Creative acceptance record

| field                                       | value                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| Mechanical render/capture result            | Critique corrections: 28 focused browser checks passed                           |
| Whole-invitation responsive inspection      | 320, 360, 390, 430, 768 and 1440 px; 200% text at 320/360/1440; 1440×600         |
| Section boundaries and narrative continuity | Local harness evidence complete; Preview route evidence still required           |
| Human creative outcome                      | `PENDING`                                                                        |
| Reviewer and date                           | —                                                                                |
| Blocking reason or owner follow-up          | Human review of typographic opening, literal quote and itinerary-to-gifts rhythm |

The reference transfer was validated locally on 2026-09-19. The comparison uses the reference
worktree's existing harness captures and equivalent local routes/viewports. Published-route and
Preview parity remain unverified; no managed content was applied.

Cleanup on 2026-09-25 removed `hero-landscape.webp` after confirming it was not declared in the
invitation asset package or referenced by generated published content. Belcanto source and
derivative remain retained-only and declared by the asset package; no remote object was deleted.

## Client Correction — 2026-09-22

Current-task authority permits source edits and local validation only. Earlier managed-application
scope statements do not grant persistence or publication authority for this correction.

- Preserve the religious ceremony at 12:00 (owner confirmed); reception / welcome cocktail at 14:00;
  civil ceremony at 15:00; add Fiesta at 17:00 without an invented description or venue.
- Keep event timing, venue information and calendar start unchanged.
- Render the following literal client quote as two paragraphs, with no attribution:

> Dicen que cuando encuentras a la persona correcta el corazón lo sabe,
>
> Nosotros lo supimos y por eso queremos celebrar nuestro amor rodeado de las personas más
> importantes de nuestras vidas

Suggested punctuation and agreement edits (a period after “sabe”, “rodeados”, and a final period)
are not applied. The approved literal text takes precedence.

The hero uses content-driven height and an in-flow scroll cue. Quote width is capped at 42ch with
1.5 line height. Hero gutters and the decorative monogram are viewport-bounded to avoid splitting
the name or initials at 200% text size. Itinerary has no bottom padding; gifts owns the single
standard section interval. No shared component, schema, API, asset file, persisted content or
accepted baseline changes.

Before evidence: `.tmp/visual-review/melissa-correction-before/` (320×800, 390×844, 1440×900), from
the complete local presentation harness at HEAD `9f1706fce`, before source edits. Candidate captures
use `.tmp/visual-review/melissa-y-luis-osmar/`. Harness evidence does not certify persisted Local,
Preview or Production content. Human creative acceptance remains **PENDING**.

Validation for this correction:

- `pnpm test --runInBand tests/content/melissa-y-luis-osmar-payload.test.ts`: 7 passed.
- `pnpm type-check`: 0 errors, 0 warnings, 4 existing hints.
- `pnpm validate:changed`: local checks passed; 975 related tests and 26 corpus tests passed. Five
  advisory table-width warnings remain in this preparation record.
- `pnpm test:e2e tests/e2e/melissa-y-luis-osmar.spec.ts --workers=1`: final run 20 passed. The first
  run had four RSVP hydration/module-load failures; a fresh-server repeat passed without changing
  RSVP. Its cause is not proven; retained diagnostic report:
  `.tmp/visual-review/melissa-correction-diagnostics/first-browser-run.json`.
- Visual inspection covered complete mobile/desktop captures, opening and program/gifts details,
  plus enlarged text. The 320 px enlarged-text inspection led to bounded hero gutters and monogram
  sizing; the final focused browser suite passed after that adjustment.
- Full CI and accepted-baseline comparison/acceptance were not run. This is an intentional visual
  change, not a claim of unchanged pixels; baseline approval and public-route verification remain
  separate release gates. No database apply, Git write or publication occurred.

## Stationery Candidate — 2026-09-22

This owner-authorized second pass supersedes the plain-opening treatment above. Client copy,
schedule, cathedral, venue information, gift data and RSVP behavior remain unchanged. The video
informs physical stationery, restrained relief and tonal contrast; its contents are not imported.

- Pearl opening sheet: bounded width, fine inset frame, contact shadow, subtle paper grain,
  letterpress-style monogram and names on separate lines. Height follows content.
- Open dedication with a single closing ornament; quote wording and lack of attribution retained.
- Taupe program sheet with dark ink, contained line icons, spaced rows and an inset paper edge.
  Gifts remains on open ivory after the existing single section interval.
- Existing hero profile exceptions are refined in place. New program geometry and quote ornament
  controls live in their canonical SCSS owners with opt-in tokens and unchanged default behavior. No
  schema, renderer, content definition or asset changes are required for this pass.
- Before captures: `.tmp/visual-review/melissa-stationery-before/`; candidate captures:
  `.tmp/visual-review/melissa-y-luis-osmar/`. Both are diagnostic local harness evidence.
- `pnpm test:e2e tests/e2e/melissa-y-luis-osmar.spec.ts --workers=1`: 21 passed in the final
  stationery run, including default-style isolation across two presets, icon containment,
  single-line times, text contrast, 200% text, envelope and non-persistent RSVP. Earlier runs
  exposed inherited icon offsets and excessive icon gutters at text zoom; both were corrected. One
  intermediate run was interrupted by a development-server reload; no assertions or tolerances were
  weakened.
- Before captures are reused from the preceding correction, preserved separately. Source changes
  staged before this pass remain in the user's index; this pass adds only unstaged changes.
- Human creative acceptance: **PENDING** for this candidate. Earlier technical checks do not
  constitute approval of this composition. No persisted apply, baseline acceptance or publication.

## Final Section Refinement — 2026-09-22

The owner confirmed the stationery direction and authorized refinement, not redesign. All prior
changes were staged at session start; that index is preserved. Content, variants, typography,
surfaces, cathedral artwork and section order are unchanged.

Confirmed findings and invitation-local corrections:

- Countdown: inherited paragraph margins and footer spacing separated date and city excessively.
  Remove the paragraph margins and use one 1.5rem footer interval.
- Family: inherited group padding, grid gap and godparent margin compounded into an oversized pause.
  Use one grid row interval and align godparent columns with the parent columns.
- RSVP: the notes label had 3.64:1 contrast on cocoa. Use the existing pearl ink for that label.
- Controls: the music button covered date text at 320 px with 200% text. On narrow screens it now
  occupies the header area with space reserved for the menu. The nearly white menu toggle uses
  cocoa; the monogram link uses the existing 44 px minimum control token.

Section review: envelope/keyboard opening, portrait opening, literal quote, live countdown,
family/padrinos, cathedral/crop, both venue cards/considerations, program, both gift cards,
synthetic personalized passes, RSVP states and closing were inspected. Sections without confirmed
defects retain their previous styling. The shared pass subtitle still uses the informal phrase "Este
pase te identifica"; this pre-existing editorial discrepancy is reported, not rewritten.

The local harness now has an opt-in `music=1` flag using the production player component. It changes
no production API or renderer. Audio playback is stubbed; remote audio availability and sound
quality are not certified. Map and gift destinations are checked as links without external
navigation; clipboard contents are exercised. RSVP submission is demo-only, with unexpected API
writes blocked.

Before evidence: `.tmp/visual-review/melissa-final-before/`. Final captures:
`.tmp/visual-review/melissa-y-luis-osmar/`, including 320/390/768/1440 px, short desktop, 200% text,
controls and simulated RSVP. Final validation:

- Focused Melissa browser suite: **27 passed**, including live three-digit countdown values, aligned
  family columns, clipboard data, keyboard opening, menu, music UI and demo RSVP states.
- `pnpm type-check`: **PASS**, 0 errors and 4 existing deprecation hints.
- `pnpm validate:changed`: **PASS**, 975 related Jest tests and 26 local corpus tests; 5 existing
  advisory Markdown table-width warnings remain.
- Explicit Melissa payload suite: **7 passed**; no content-definition edits in this pass.

These are diagnostic source renders, not evidence of persisted or published content parity.
Intermediate browser failures were corrected in test setup: screenshot mode deliberately holds the
letter, keyboard interaction must wait for enabled controls, RSVP interaction must wait for island
hydration, and date occlusion must measure rendered text rather than its full-width paragraph. One
intermediate run encountered a development-server reload. Final runs passed without widening
timeouts or accepting visual baselines. Full CI and published-route verification were not run.

Final human creative acceptance remains **PENDING**. No baseline acceptance, Git staging/commit,
persisted apply or publication is included.

## Visual Critique Corrections — 2026-09-22

This candidate supersedes the preceding refinement's visual decisions where listed below. Source
content, image assets, variants, envelope behavior and section order remain unchanged. The supplied
critique authorized local corrections; it did not authorize persisted writes or publication.

- Opening: natural-case Cormorant names now lead the sheet; the smaller Cinzel initials support
  them. Remove the secondary frame and decorative twig, retaining the pearl sheet and shadow.
- Venues: suppress generic architectural preview graphics, grid and pin; preserve both map links,
  venue text and address-copy controls. Replace enclosed elevated cards with open hairline entries.
- Gifts: remove icon medallions, card fill and number-pill treatment. Center each entry and use a
  compact underlined Liverpool action; retain its touch target and legible hover/focus states.
- Program: retain the taupe sheet and four rows; remove the inset frame, icon gutter and spine.
- Family/countdown: use mixed-case role labels and suppress the countdown's duplicate date; the date
  remains in the opening and locations. Remove the inherited half-screen minimum height and give the
  timer a full-width grid track. Temporal behavior and event start are unchanged.
- Pass/RSVP: use flat square pearl paper, smaller guest/count typography and no seal or diamond;
  reduce and center the register's measure, padding and title through optional canonical controls.
- Quote, cathedral and closing retain their established presentation.

Before evidence: `.tmp/visual-review/melissa-editorial-before/`. Candidate evidence:
`.tmp/visual-review/melissa-y-luis-osmar/`. These are local diagnostic captures, not accepted
baselines or evidence of published-route parity. Human creative acceptance remains **PENDING**. The
inherited informal pass subtitle remains an explicitly reported editorial discrepancy.

Validation: `pnpm validate:changed` passed (975 related tests and 26 local corpus tests),
`pnpm type-check` passed (0 errors, 4 existing deprecation hints), the explicit payload suite passed
7 tests, and the final Melissa browser suite passed 28 tests. The latter includes unconfigured
formal-chapter defaults across two presets, 320/390/768/1440 px, short desktop, enlarged text,
clipboard, keyboard, motion and simulated RSVP. Five existing advisory Markdown table warnings
remain. The updated browser assertion also passed focused ESLint and formatting checks.

Intermediate failures exposed countdown shrink-to-content after the repeated date was hidden; the
explicit grid track corrects that defect. The browser assertion now counts nonzero auto-fit tracks,
excluding collapsed tracks. A development reload interrupted one intermediate navigation. No
baseline was accepted and no production route, live RSVP write or remote audio playback was tested.

## Haute Papeterie Elevación a Calidad Tope de Gama — 2026-09-22

Esta iteración concluye la elevación editorial y de alta papelería digital para erradicar cualquier
percepción de plantilla comercial o de consumo masivo, cumpliendo los 5 requerimientos directivos:

1. **Hero a viewport completo (`100svh`):** La sección de apertura ahora ocupa exactamente el alto
   de la pantalla en móviles y desktop
   (`min-height: 100svh; height: 100svh; display: flex; flex-direction: column; justify-content: space-between`),
   con el pliego de papel perlado centrado verticalmente (`margin: auto;`), nombres a escala
   generosa (`clamp(2.5rem, 6.5vw, 4rem)`) y el indicador de desplazamiento «DESLIZA» anclado a la
   base.
2. **Separadores de sección asimétricos:** Se configuró una cadencia con transiciones asimétricas en
   la mayoría de las secciones:
   - _Hero → Cita:_ Fusión atmosférica radial con foco excéntrico (`at 72% 0%`).
   - _Familia → Catedral:_ Corte poligonal diagonal arquitectónico
     (`clip-path: polygon(0 clamp(1.25rem, 2.5vw, 2.25rem), 100% 0, 100% 100%, 0 100%)`) con
     solapamiento orgánico.
   - _Catedral → Locaciones:_ Fusión atmosférica radial asimétrica (`at 32% 0%`).
   - _Locaciones → Itinerario:_ Fusión atmosférica suave con centro desplazado (`at 68% 0%`).
   - _Regalos → Acceso personal:_ Arco editorial asimétrico con ápice al 64%
     (`--intersection-arch-mask`).
   - _RSVP → Cierre ceremonial:_ Fusión atmosférica con gradiente excéntrico (`at 40% 0%`).
3. **Ritmo armónico de tamaños, posiciones y colores:**
   - Arco tonal coherente de alta papelería: marfil cálido (`#F7F3ED`) → pliego perlado (`#FFFDF9`)
     → pliego de programa en taupe cálido (`#D0C7BD`) → bloque solemne de RSVP en cacao profundo
     (`#302925`) → cierre ceremonial en marfil.
   - Tamaños tipográficos escalonados armónicamente entre títulos Cinzel, nombres y prosa en
     Cormorant Garamond, y datos prácticos en Instrument Sans.
4. **Jerarquía y espaciado refinado entre elementos:**
   - Cita textual con ortotipografía impecable: puntuación equilibrada y concordancia («rodeados» en
     plural con punto final).
   - Supresión de la cruz latina solitaria (`†`), estilización de etiquetas de parentesco en serif
     itálica cálida (_Madre_, _Padre_, _Padrinos_).
   - Eliminación de la numeración ordinal artificial (`01`, `02`) y textos redundantes en
     «Consideraciones».
   - Segundero del contador atenuado al 60% de opacidad para evitar sensación de urgencia comercial.
   - Unificación del registro formal de cortesía en el pase personal («Este pase le identifica como
     invitado...»).
5. **Conservación de las ilustraciones originales de locación:**
   - Se restauró y preservó el arte arquitectónico original
     (`.event-location__card-map-preview-art`) tanto para la Catedral Basílica de la Inmaculada
     Concepción como para Belcanto Jardín.
   - Integradas dentro de tarjetas de papelería refinada con fondo reticulado arquitectónico sutil,
     horizonte fino de champán, pin de localización y enlace de navegación directo («VER MAPA →»).

Validación técnica:

- `pnpm test tests/content/melissa-y-luis-osmar-payload.test.ts`: 7 pasados.
- `pnpm type-check`: 0 errores, 0 advertencias, 4 avisos existentes.
- `pnpm validate:changed`: 76 suites Jest (975 pruebas) y 26 pruebas del corpus de regresión
  pasadas.
- `pnpm test:e2e tests/e2e/melissa-y-luis-osmar.spec.ts --workers=1`: 28 pruebas pasadas en todos
  los viewports (320, 360, 390, 430, 768, 1440 px), texto al 200%, teclado, RSVP y modo sin
  JavaScript.

Aceptación creativa humana: **PENDING**.

## Editorial Polish Evidence — 2026-09-19

This pass is presentation-only and local-only. It does not extend earlier release permissions.
Content, section order, artwork and existing shared corrections are frozen. SHA-256 checks of the
payload and local image assets match the pre-polish baseline. Interlude dimensions and object
positions match at all five measured viewports.

### Implementation and cleanup

- Necessary configuration: palette, typography roles, section rhythm, artwork geometry, envelope
  material tokens and the formal chapter's chromatic remap remain local.
- Public location/gift variables replace equivalent direct rules. The legacy elegant gifts bundle
  hardcodes padding, radius, hover and shadows, so a small documented local bridge remains; no
  shared component or new API was introduced.
- Local exceptions: landscape hero composition, centered family introduction, balanced godparent
  columns, readable itinerary typography, gift-code reflow and the blocked RSVP card treatment.
- Removed duplicate card styles, formal-pass/register geometry and type-scale overrides, repeated
  diamonds/dividers, closing watermark, extra artwork masks, card blur/lifts, the location cue's
  continuous pulse and the unused `--env-ink` assignment (no consumer in `src`).
- EB Garamond and Montserrat imports were removed from this profile. Installed packages remain:
  other project consumers exist. No image asset became unused in this pass.
- The fixed outer gift gutters and bounded card padding preserve reading width at 200% text size.
  The hero reserves landscape space and grows instead of overlapping its date.

### Before/after measurements

These are historical measurements from the saved `before-full/after-full` reports, not a current
HEAD benchmark. The September 19 comparative audit found 875 lines / 25,436 bytes in the
then-current profile versus 886 lines / 25,783 bytes in the saved after-report. Keep the recorded
snapshot intact; remeasure an explicitly identified source before claiming current performance or
size.

| Metric                                 | Before  | After   | Change    |
| -------------------------------------- | ------- | ------- | --------- |
| Profile source bytes                   | 45,660  | 25,783  | −43.5%    |
| Profile source lines                   | 1,710   | 886     | −48.2%    |
| Compressed Sass output bytes           | 63,181  | 35,079  | −44.5%    |
| Profile declarations observed in CSSOM | 1,040   | 489     | −53.0%    |
| Complete harness CSSOM bytes           | 614,897 | 583,389 | −5.1%     |
| Requested font files                   | 6       | 6       | unchanged |
| Requested WOFF2 file bytes             | 199,636 | 192,516 | −3.6%     |

Measurements use the same local full-invitation harness with `presentation=1` (global/base CSS),
animations disabled, fresh Chromium contexts, device scale 1, UTC and the same viewport sizes. CSSOM
bytes measure the parsed styles delivered to the harness, not compressed production transfer size.
Sass output includes font-face imports. Font bytes are the summed local files matching observed font
requests, excluding headers. The before baseline is reconstructed by intercepting only the profile
stylesheet with Sass output from its saved pre-edit source; no worktree file is reverted. Earlier
captures without `presentation=1` omitted base styles and are superseded by these measurements. The
restored Bodoni formal chapter and Cormorant extended subset explain the unchanged request count; EB
Garamond and Montserrat are no longer requested by this invitation.

Evidence resides in ignored `.tmp/visual-review/melissa-polish/{before-full,after-full}/`: complete
screenshots and `metrics.json`. Reference captures are in `.tmp/visual-review/melissa-transfer/`.
The reference worktree's recorded HEAD, index entries and scoped file hashes remain unchanged.

### Validation scope and limits

- `pnpm validate:changed`: ESLint, Stylelint and formatting checks; 76 related Jest suites (968
  tests) and the local corpus regression suite (26 tests) passed. Five advisory warnings concern
  pre-existing wide Markdown tables.
- `pnpm test:e2e tests/e2e/melissa-y-luis-osmar.spec.ts --workers=1`: 19 checks, using the existing
  local harness server through `PLAYWRIGHT_REUSE_EXISTING_SERVER` and `PLAYWRIGHT_WEB_SERVER_URL`.
- Tier A: no shared contract or executable application code changed. Full CI/build/type-check are
  not rerun for this presentation pass.

The initial full-presentation run exposed a 360 px countdown label wrap and a shared,
higher-specificity ambient animation overriding the local media arrival. Both were corrected in the
profile; the latter also removed capture stability timeouts. Focused regression assertions now cover
both findings.

The focused browser suite covers the complete invitation, short desktop, text zoom, landscape/date
separation, countdown columns, unbroken countdown labels, stationary information cards, 44 px copy
controls, visible focus, envelope, synthetic passes for 1/2/6 seats, non-persistent RSVP states, a
single media arrival (no inherited ambient loop), reduced motion and no-JavaScript content. Visual
inspection additionally reviews hierarchy, section transitions and artwork framing. The taupe
metadata on paper has a 4.92:1 contrast ratio; quote attribution and the scroll cue no longer reduce
that contrast through opacity.

The formal chapter intentionally retains its canonical typography, including its 10.88 px eyebrow;
changing that shared contract is outside this presentation pass. Production transfer size and Core
Web Vitals are not measured. Published and Preview routes are not exercised. Human creative
acceptance remains **PENDING**, independently of technical checks.

## Comparative Audit and First-Proposal Baseline

Audit date: 2026-09-19. Sources: repository history, existing local captures, the original visual
reference and recovered invitation/refinement task conversations. No new render was produced by that
audit. The first versioned implementation is `535216506`; it is not proven to be the first proposal
the user saw. `0a2487044` records early refinement. The later reference consisted of that commit
plus staged and unstaged work, not an independently committed design. `4af293ad0` records the
transferred and simplified local presentation after the shared responsive work in `8f98a111a`.

The evidence supports a gap between the approved direction and its rendered realization, not a claim
that the initial brief lacked detail. Early captures show a large script quote, stacked ornamental
boundaries and a terracotta formal chapter despite the neutral palette. The later reference improved
the opening through monogram, restrained type and landscape, but retained small metadata and
repeated decoration. Subsequent polishing improved legibility and simplified styles. These visual
judgments do not establish that every later choice is objectively superior.

Evidence inventory (ignored, local-only):

- `.tmp/visual-review/melissa-transfer/`: saved pre-transfer profile, before/reference images and
  `reference-state.json` with HEAD, index and scoped file hashes. Copies at 390 and 1440 px matched
  their source captures during the audit.
- `.tmp/visual-review/melissa-polish/{before-full,after-full}/`: captures and metrics at 320×800,
  390×844, 768×1024, 1440×900 and 1440×600. Content and three artwork hashes match across the pair.
  The old profile was intercepted over the later shared environment; this is not an exact old build.
- `output/playwright/melissa-refined/report.json`: historical public-route section evidence at
  390×844, DPR 2. It must not be compared pixel-for-pixel with DPR 1 harness captures.

Earlier harness references omitted global/base CSS. Captures with unrevealed blank areas are not
valid complete-composition evidence. Clock/browser-version and per-glyph font provenance are not
fully recorded. A complete causal history of the reference worktree was not recovered. The text of
the quote, itinerary labels and gifts subtitle also changed across the historical transfer, so that
comparison cannot isolate styling alone. Current published-route parity remains unverified.

First-proposal evidence identity, exact correction count and rework duration: `UNVERIFIED`. Human
acceptance: `PENDING`. Use the existing creative QA correction register for future proposals; do not
manufacture retrospective counts from commits or task duration.

## Photograph Inventory

Source label: `source:generated-venue-art`. Masters are preserved. The assets are explicitly
interpretive architectural artwork and must not be described as documentary venue photographs.

| source filename                | dims      | format | orientation | weight    | quality          | role          | duplicate | processing                               | derivative               |
| ------------------------------ | --------- | ------ | ----------- | --------- | ---------------- | ------------- | --------- | ---------------------------------------- | ------------------------ |
| source/cathedral-editorial.png | 1024×1536 | png    | portrait    | 3023047 B | production-ready | interlude01   | no        | selected from three candidates; WebP q84 | cathedral-editorial.webp |
| source/belcanto-editorial.png  | 1024×1536 | png    | portrait    | 2807452 B | production-ready | retained-only | no        | selected from three candidates; WebP q84 | belcanto-editorial.webp  |

### Uniqueness table

| role          | source                         | derivative               | intentional multi-role? |
| ------------- | ------------------------------ | ------------------------ | ----------------------- |
| interlude01   | source/cathedral-editorial.png | cathedral-editorial.webp | no                      |
| retained-only | source/belcanto-editorial.png  | belcanto-editorial.webp  | no                      |

Prepared derivative sizes:

- `cathedral-editorial.webp`: 298834 B (`editorial-featured`).
- `belcanto-editorial.webp`: 288264 B (`editorial-featured`).

Generated with the built-in ImageGen workflow. Prompts required portrait 2:3 composition,
architectural editorial interpretation, believable materials, natural light, no people, no text, no
logos, no signage and no watermark.

## Implementation Constraints

- `prepReadiness` must remain helper-aligned before payload or profile work.
- Reuse canonical variants; no slug or profile branching in shared renderers.
- Invitation-specific styling remains under `.event--melissa-y-luis-osmar`.
- Generated art is decorative/atmospheric; essential venue information remains real text.
- Navigation buttons remain hidden per simple variant presentation.
- RSVP uses `confirmationMode: api` and `accessMode: personalized-only`; no guest records are
  seeded.
- Gallery remains omitted; music uses owner-provided audio source.
- Managed application is authorized only through `invitation:release` for the exact slug in Local
  and Preview, after dry-run and environment identity checks.
- The canonical release may create the dedicated `host_client` technical identity derived from
  `hostLoginAlias` in Local and Preview; it must not provision any guest or client-contact data.
- Synthetic pass and RSVP fixtures remain test-only and never create accounts, guests or responses.
- Production writes, Production dry-run promotion, schema migration and Preview content mirror are
  outside scope.

## Preparation Readiness History

| date       | readiness                  | helper basis                   | notes                                                                                                         |
| ---------- | -------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 2026-09-18 | `READY_FOR_IMPLEMENTATION` | `evaluatePreparationReadiness` | Required boda fields resolved; two unique production-ready generated assets; design selected; no placeholders |

## Client Correction Verification — 2026-09-23

- Source harness: inspected the complete invitation at 320, 390 and 1440 px. The groom's opening
  name stays on one line without document overflow; `†` follows the final surname, with a
  screen-reader-only explanation. Focused captures are under
  `.tmp/visual-review/melissa-client-corrections/` (ignored diagnostic evidence).
- Source content: `De etiqueta.`, `Sobres`, and the Liverpool event remain in the managed
  definition. Preparation validation, the seven Melissa content tests, `validate:changed`, and
  `type-check` passed. The focused browser checks passed at 320, 360, 390, 430, 440, 768 and 1440 px
  after a transient development-server reload on the first 320 px attempt.
- Public Local route `/boda/melissa-y-luis-osmar?skipEnvelope=true` returned HTTP 200 but still
  rendered `Gala formal.` and lacked the deceased marker. Persisted content is therefore behind the
  source changes; Preview and Production were not checked or modified.
- Client follow-up: all four parent names stay on one line at standard 320–1440 px viewports. At
  200% text size they may wrap to preserve legibility without horizontal overflow.
- Human creative outcome: `PENDING`. The source candidate and any later managed apply need separate
  visual acceptance.

## Client Correction — 2026-09-25

Current-task authority permits source edits, local validation, and the managed Local/Preview release
for this slug. Production remains outside scope.

- Hero: both celebrant names render in cursive at exactly the same size. Both name spans now use
  Pinyon Script (the profile's established calligraphic identity, also used by the monogram and the
  closing) with an identical `min(1.75em, 15.2vw)` scale, verified equal computed font size at 320,
  390, and 1440 px while the groom's name stays on one line. The ampersand is reduced through
  `::first-letter`. Profile-local only.
- Gifts: the cash card renders the existing canonical catalog envelope icon (`Enveloped` —
  `src/components/common/icons/invitation/Enveloped.tsx`) through the shared `Icon.astro` registry.
  A minimal optional `iconName` field was added to the canonical cash gift schema and to
  `Gifts.astro` (title glyph + `sr-only` accessible title). No duplicated inline SVG remains; the
  envelope uses the section's mineral-olive icon color, centered at ~2.75–3.25rem. Other invitations
  are unaffected because they never set `iconName`.
- Itinerary: the 17:00 label changes from `Fiesta` to `Primer baile y brindis` in the managed
  definition (`scripts/provision/invitations/melissa-y-luis-osmar.ts`); time and `iconName` are
  unchanged. This is a content change and requires the managed Local/Preview release to become
  visible on persisted routes. The first release also carried the still-unapplied 2026-09-23
  corrections (`De etiqueta.`, the `†` marker, and the `Sobres` label), which persisted Local
  content had not received.

Validation for this correction:

- `pnpm test --runInBand tests/content/melissa-y-luis-osmar-payload.test.ts`: 7 passed.
- `pnpm test:e2e tests/e2e/melissa-y-luis-osmar.spec.ts --workers=1`: 29 passed, including the
  one-line groom-name and no-overflow checks at 320–1440 px, identical computed font size for both
  name spans, the visible catalog envelope title icon with its `sr-only` accessible title, and the
  updated itinerary label.
- Focused captures: `.tmp/visual-review/melissa-client-corrections/` (hero/gifts/itinerary at 390
  and 1440 px; ignored diagnostic evidence).
- Managed release: `invitation:release --slug melissa-y-luis-osmar --targets local,preview` dry-run
  followed by apply. The content correction (itinerary label) applied as published v11 on both
  targets. After the envelope-icon correction added `iconName` to the cash gift, a second release
  applied published content v12 (Local: 1 insertion, 2 updates; Preview: 3 updates; 0 storage;
  Preview required the task-scoped automation assertion
  `CELEBRA_TASK_SCOPE="preview:melissa-y-luis-osmar:apply"`). Persisted Local route
  `/boda/melissa-y-luis-osmar?skipEnvelope=true` verified: renders `Primer baile y brindis`, the
  catalog envelope `<svg>` with the `sr-only` `Sobres` title, and `De etiqueta.` Captures:
  `.tmp/visual-review/melissa-client-corrections/` (`persisted-gift-v12-390.png`, `reuse-*.png`).
  Production was not touched (owner path: `pnpm prod:apply`).
- Human creative outcome: `PENDING`. Visual acceptance of the cursive opening and envelope glyph
  remains with the client.
