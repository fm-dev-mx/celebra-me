---
title: Valentina Hernández XV — Editorial Accent Pass
status: active
plan_type: implementation
autonomy_level: 2
created: 2026-06-27
updated: 2026-06-27
related_skills:
  - frontend-design
  - theme-architecture
  - animation-motion
  - copywriting-es
related_plans:
  - .agent/plans/active/valentina-editorial-magazine-real-invitation.spec.md
  - .agent/plans/active/editorial-magazine-top-premium-polish.spec.md
  - .agent/plans/active/valentina-premium-reveal-transition.spec.md
related_rules:
  - .agent/rules/gatekeeper.md
  - .agent/rules/git-safety.md
  - .agent/rules/invitation-production.md
  - .agent/rules/dashboard-styling.md
related_docs:
  - docs/domains/theme/architecture.md
  - docs/domains/theme/typography.md
---

# Valentina Hernández XV — Editorial Accent Pass

## 1. Context / Current State

### What currently exists

The Valentina Hernández XV invitation (`/xv/valentina-hernandez`) is already on the
`editorial-magazine` theme preset with a pink/blush palette override scoped to
`.event--valentina-hernandez.theme-preset--editorial-magazine`. Significant prior work has been
done:

**Files already in place:**

| Layer                  | File                                                                      | Lines    | Purpose                                                                                |
| ---------------------- | ------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| Valentina overrides    | `src/styles/themes/sections/_xv-valentina-hernandez.scss`                 | 699      | Event-scoped palette, cover reveal, hero, family, itinerary, location, gifts overrides |
| Hero section           | `src/styles/themes/sections/hero/_editorial-magazine.scss`                | 563      | Full-screen editorial hero layout, reveal animations                                   |
| Family section         | `src/styles/themes/sections/family/_editorial-magazine.scss`              | 186      | Credits-column layout with thin dividers                                               |
| Gallery section        | `src/styles/themes/sections/gallery/_editorial-magazine.scss`             | 142      | Fig-counter captions, spread grid                                                      |
| Gifts section          | `src/styles/themes/sections/gifts/_editorial-magazine.scss`               | 133      | Flat catalog grid with border rules                                                    |
| RSVP section           | `src/styles/themes/sections/rsvp/_editorial-magazine.scss`                | 163      | Dark background, underline inputs, radio cards                                         |
| Quote section          | `src/styles/themes/sections/quote/_editorial-magazine.scss`               | 54       | Dark background, serif italic, red divider accent                                      |
| Countdown section      | `src/styles/themes/sections/countdown/_editorial-magazine.scss`           | 94       | Grid segments with thin ink borders                                                    |
| Location section       | `src/styles/themes/sections/location/_editorial-magazine.scss`            | 187      | Venue cards, NOTA counter for indications                                              |
| Thank-you section      | `src/styles/themes/sections/thank-you/_editorial-magazine.scss`           | 118      | Dark back-cover with signature block                                                   |
| Footer section         | `src/styles/themes/sections/footer/_editorial.scss`                       | 144      | Dark footer with WhatsApp CTA                                                          |
| Header section         | `src/styles/themes/sections/header/_editorial-magazine.scss`              | (exists) | Editorial header navigation                                                            |
| Personalized access    | `src/styles/themes/sections/personalized-access/_editorial-magazine.scss` | (exists) | VIP credential styling                                                                 |
| Cover reveal           | `src/styles/invitation/_editorial-cover.scss`                             | (exists) | Editorial cover reveal animations                                                      |
| Hero component         | `src/components/invitation/EditorialMagazineHero.astro`                   | 205      | Full editorial hero with folio, portrait, credits                                      |
| Cover reveal component | `src/components/invitation/EditorialCoverReveal.astro`                    | (exists) | Magazine cover reveal with masthead                                                    |

### What already feels editorial

- **Cover reveal**: Has a strong magazine-cover identity with masthead, headline, metadata.
- **Hero**: Has folio header rail, watermark, credits block, asymmetric grid — reads as an interior
  editorial spread.
- **Quote**: Dark background with serif italic text and red accent divider — clean editorial pull
  quote.
- **Thank-you**: Dark back-cover with calligraphic signature, drop-cap, editorial footer strip.
- **Countdown**: Grid-based segments with thin ink borders, no decorative chrome.

### What feels visually disconnected, flat, generic, or under-developed

- **Hero**: The composition is structurally solid but lacks subtle editorial micro-detail
  refinement. The `displayLabel` logic transforms "XV Edition" into "CAPÍTULO XV" which is good, but
  the folio header feels flat. The credits block is sparse. The deck text is generic. Mobile title
  wrapper (`backdrop-filter: blur(8px)`) works but the glass card effect is not fully editorial — it
  feels more like a UI component than a print detail.
- **Family**: Functionally correct editorial-column layout with group titles and thin dividers, but
  the section lacks a chapter-opening gesture. No eyebrow/section number. The header area doesn't
  distinguish itself from other sections. The message block is plain.
- **Gallery**: Has `Fig. 0X — ` counter captions and spread grid, which is the strongest editorial
  gesture, but the header (title/subtitle) lacks a distinguishing editorial treatment. No folio-like
  microcopy. The section feels like a grid with captions rather than a curated visual archive.
- **Gifts**: Flat catalog grid with ink borders — correct structure, but the header is identical in
  pattern to gallery/location (same large uppercase title + subtitle). No editorial differentiation.
  The card interiors are plain.
- **RSVP**: Dark background with underline inputs and radio cards — structurally solid, but the
  section header follows the same pattern as other sections. Lacks the premium "private confirmation
  card" feeling. The form area has no editorial framing.
- **Footer**: Has WhatsApp CTA with `border-radius: 0` for editorial-magazine, but the overall
  section still uses a pill-style rounded button (only overridden to 0 for editorial-magazine) and
  the "Powered by" text feels generic. No colophon-like closing treatment.
- **Location**: Has NOTA counter for indications and venue cards, but the venue cards lack editorial
  micro-detail. The section is functional but not curated.
- **Itinerary**: Valentina override adds CSS counters (`01`, `02`...) and grid layout — this is
  actually the most editorial-feeling section after quote/thank-you.

### Coherence diagnosis

The sections individually have editorial elements, but the connective tissue between them is weak.
Each section uses the same formula: large uppercase display title + optional eyebrow + subtitle.
There is no variation in rhythm, no chapter-numbering system across sections, no running folio. The
result feels like "sections with editorial typography" rather than "a curated editorial edition."

---

## 2. Problem Statement

The Valentina invitation has correct editorial-magazine structural foundations, but it reads as a
**themed template** rather than a **cohesive editorial publication**. The visual inconsistency lies
in three areas:

1. **Monotonous section openings**: Every section uses the same oversized uppercase display title
   pattern. There is no hierarchical variation between chapters.
2. **Missing editorial connective tissue**: No running folios, chapter marks, or microcopy that
   create the illusion of navigating a curated publication.
3. **Under-developed micro-details**: The hero credits, family header, gallery header, gifts header,
   RSVP framing, and footer colophon lack the small print-inspired details that distinguish premium
   editorial design from generic template styling.

The current result is not yet a fully coherent premium editorial invitation because the editorial
language is applied **section-by-section** as independent styling passes rather than as a **unified
editorial voice** distributed across the whole invitation.

---

## 3. Goals

1. Apply subtle editorial accents to key sections to create a sense of publication curation.
2. Increase visual cohesion by introducing restrained connective micro-details (eyebrows, folios,
   chapter marks) distributed across sections — each one different.
3. Preserve the existing high-end quality, pink/blush palette, and restrained editorial character.
4. Improve the hero's compositional clarity and editorial reading.
5. Make the family section feel like a gratitude chapter, not a data table.
6. Make the gallery feel like a curated visual archive.
7. Make gifts feel like a refined gift guide, not a retail widget.
8. Make RSVP feel like a premium private confirmation, not a generic form.
9. Make the footer close the invitation with editorial finality.

---

## 4. Non-Goals

- **No full redesign.** This is an accent pass, not a rebuild.
- **No architecture rewrite.** No new components, no route changes, no schema refactors.
- **No content model/schema changes** unless strictly required by a new data-driven detail.
- **No new dependencies.** No new fonts, no new packages, no new client-side JS.
- **No copying of any external magazine brand identity.** The reference screenshots are for
  editorial language extraction only.
- **No visual clutter, excessive doodles, or decorative overload.** Each accent must earn its place.
- **No database or SQL changes.**
- **No changes to the cover reveal.** The cover reveal has been refined in a separate spec and is
  considered stable.
- **No changes to the itinerary.** The itinerary already has strong editorial treatment in the
  Valentina override file.
- **No changes to the countdown.** The countdown grid is structurally complete.
- **No changes to the personalized access pass.** This has its own editorial-magazine styling.

---

## 5. Visual Direction / Design Rules

### 5.1 Typography contrast

- **Display titles** use `--font-display` (sans-serif, heavy weight, tight leading).
- **Body/editorial prose** uses `--font-body` (serif, regular weight, generous leading).
- **Labels/eyebrows/folios** use `--font-label` (sans-serif, heavy weight, wide tracking).
- **Calligraphic accents** use `--font-calligraphy` sparingly for signatures/name highlights.
- Contrast between these families creates the editorial "spread page" feel.

### 5.2 Section title hierarchy — varied, not uniform

Instead of every section using the same oversized uppercase title:

- Some sections get a **chapter-number eyebrow** (e.g., `N.º 01` or `CAPÍTULO 01`).
- Some sections get a **running folio** (e.g., `PÁG. 15` style detail at the edge).
- Some sections get a **thin-rule + small-caps subtitle** instead of a large title.
- The variation creates rhythm. No two consecutive sections should open identically.

### 5.3 Fine dividers / framing / print-like structure

- Use `1px solid rgb(var(--v-ink-rgb) / 14–22%)` hairline rules as architectural elements.
- Use `::before` / `::after` pseudo-elements for framing borders, not decorative images.
- Keep framing minimal — a single rule or border is more editorial than a full box.

### 5.4 Premium spacing and restraint

- Generous padding-block values (`clamp(5rem, 12vw, 8rem)` range).
- Let whitespace do the work. More space = more premium.
- Never fill empty space with decoration. Empty space IS the decoration.

### 5.5 Selective dark contrast sections

- RSVP (already dark) and Thank-you (already dark) create editorial rhythm contrast.
- No additional sections should switch to dark. Two dark sections is the maximum.

### 5.6 Optional small accents

- Folio-like page references used **sparingly** (hero already has one; add at most 1–2 more).
- Chapter numbers or section marks used **sparingly** (2–3 sections maximum).
- Drop-cap or editorial-opening gesture used **once** maximum (family or thank-you).
- Signature-like or colophon detail used **once** (footer only).

### 5.7 Language and editorial voice

- All UI-visible text: **Spanish**.
- All code, variables, comments: **English**.
- Microcopy should feel curated, not costume-like. "COLECCIÓN XV" not "MAGAZINE EDITION."

### 5.8 The editorial language must feel curated, not costume-like

- No fake magazine logos, no brand parody, no fashion-magazine jargon.
- Editorial signals should be **structural** (typography, spacing, framing) not **verbal** (cover
  lines, trend alerts).
- The invitation should feel like it was designed by someone who reads editorial publications, not
  like it's pretending to be one.

---

## 6. Section-by-Section Plan

### 6.1 Hero

**Current issue:** The hero has strong editorial bones (folio rail, watermark, credits, portrait
grid) but the mobile title-wrapper glass card feels like a UI component rather than a print detail.
The credits block content is hardcoded in the component. The deck text is hardcoded. The folio
header is flat.

**Intended editorial effect:** The hero should read as the opening spread of the publication. The
transition from cover → hero should feel like turning a page from the jacket to the first interior
editorial spread.

**Concrete UI/styling changes:**

1. **Refine the mobile title-wrapper**: Replace the glass-card effect with a cleaner editorial
   treatment — thinner border, subtler background, no `backdrop-filter` blur (which feels like
   frosted glass UI). Use a solid semi-transparent paper tone instead.
2. **Add a subtle vertical rule to the folio header**: Between the folio label and page number, the
   existing hairline (`invitation-hero__folio-line`) could get a finer opacity adjustment.
3. **Improve the label styling**: The "CAPÍTULO XV" label above the title should have a finer, more
   editorial presence — slightly smaller, with a bottom margin that creates breathing room.
4. **Credits block spacing**: Increase bottom margin to create clear separation from the footer
   area.
5. **Details typography refinement**: Tighten the date/time/venue metadata typography.

**What should remain untouched:**

- Hero component markup (`EditorialMagazineHero.astro`) — no HTML changes.
- Desktop layout grid (50/50 split).
- Reveal animations.
- Watermark.
- Portrait framing.

---

### 6.2 Family

**Current issue:** The family section is a data-table-like column layout with group titles and thin
dividers. It lacks a chapter-opening gesture. The header has the standard eyebrow + large title
pattern. No editorial warmth.

**Intended editorial effect:** The family section should feel like a "gratitude chapter" — a formal
editorial page that presents the hosting family with respect and warmth.

**Concrete UI/styling changes:**

1. **Add an editorial chapter mark** to the Valentina override: Use a `::before` pseudo-element on
   the section header to render a small chapter mark (e.g., `N.º 02` or a thin decorative rule)
   above the eyebrow. This differentiates it from other sections.
2. **Refine the message block**: Add slight left-border or indent to the family message text to
   create a pull-quote or editorial-note feel. Use `border-left: 2px solid` with the accent color.
3. **Add subtle bottom folio**: A small folio-like detail at the bottom of the family section (e.g.,
   `— Familia Hernández Almaguer —`) using `::after` on the panel, in muted small-caps.
4. **Refine group title spacing**: Increase margin-bottom slightly for better breathing room.

**What should remain untouched:**

- Family component markup (`Family.astro`) — no HTML changes.
- Group/column layout structure.
- Name display and meta label styling.

---

### 6.3 Gallery

**Current issue:** The gallery has `Fig. 0X — ` counter captions and a spread grid — strong
editorial gesture. But the header (title/subtitle) uses the same pattern as every other section. No
editorial curation detail.

**Intended editorial effect:** The gallery should feel like a curated visual archive or lookbook — a
photographic portfolio within the editorial publication.

**Concrete UI/styling changes:**

1. **Add an "ARCHIVO VISUAL" or similar small-caps eyebrow** to the gallery header area. This is
   already supported by the `.gallery-section__eyebrow` class but may need Valentina-scoped styling
   refinement.
2. **Add a subtle folio-like detail** to the gallery section: A small `::after` on the gallery
   section with a muted folio reference (e.g., `SELECCIÓN FOTOGRÁFICA — EDICIÓN XV`).
3. **Refine caption typography**: The monospace `Fig. 0X — ` captions are strong but could benefit
   from slightly warmer color in the Valentina context (less muted, slightly more visible).

**What should remain untouched:**

- Gallery component markup — no HTML changes.
- Image grid layout and spans.
- Counter logic.

---

### 6.4 Gifts

**Current issue:** Flat catalog grid with ink borders. Correct structure but generic. The header
follows the same pattern as other sections. The card interiors lack editorial refinement.

**Intended editorial effect:** The gifts section should feel like a refined gift guide page — a
curated recommendation, not a shopping widget.

**Concrete UI/styling changes:**

1. **Differentiate the section opening**: Instead of the standard large title, add a thin top-rule
   and a smaller, more intimate editorial title treatment. The gifts title doesn't need to be as
   large as the hero or gallery title — it should feel like a sidebar recommendation.
2. **Refine card inner spacing**: Add more generous padding within gift cards for a more premium
   card feel.
3. **Add a small editorial note** below the subtitle: A muted small-caps line like
   `GUÍA DE OBSEQUIOS — N.º 05` to create the editorial curation frame.
4. **Refine the button**: The CTA button styling is correct (flat, uppercase, tracked) but could
   benefit from slightly more padding.

**What should remain untouched:**

- Gifts component markup — no HTML changes.
- Grid border structure.
- Bank details styling.

---

### 6.5 RSVP

**Current issue:** Dark background with underline inputs and flat buttons — structurally correct but
reads as a generic dark form UI. The section header follows the same oversize title pattern. No
editorial framing.

**Intended editorial effect:** The RSVP should feel like a premium private confirmation card — an
exclusive editorial insert within the publication.

**Concrete UI/styling changes:**

1. **Add a thin framing border** around the RSVP content area using `::before` on the section:
   `inset: clamp(1rem, 3vw, 2rem); border: 1px solid rgb(var(--editorial-magazine-white-rgb) / 14%)`.
   This mirrors the hero's editorial frame and creates visual continuity.
2. **Add an editorial eyebrow detail**: A small `CONFIRMACIÓN PRIVADA` or `R.S.V.P.` in tracked
   small-caps above the title, with a muted color.
3. **Refine button padding and tracking**: Slightly more generous letter-spacing and padding on the
   submit button for a more editorial feel.
4. **Add a subtle section-closing rule**: A thin horizontal rule below the form area, above any
   footer text.

**What should remain untouched:**

- RSVP component markup (`RSVP.tsx`, `RSVPComponents.tsx`) — no HTML changes.
- Input styling (underline pattern is correct).
- Radio card structure.
- All interactive states (disabled, loading, success, error).
- Dark background color.

---

### 6.6 Footer

**Current issue:** The footer has a dark background and WhatsApp CTA, but the "Powered by" text and
button styling feel generic. No editorial closing treatment. The `border-radius: 0` override is
correct but the overall section lacks colophon-like finality.

**Intended editorial effect:** The footer should feel like a closing editorial note or colophon —
the back page of the publication.

**Concrete UI/styling changes:**

1. **Refine the WhatsApp CTA button**: Add tighter letter-spacing and slightly reduced font-size to
   feel more like a discreet editorial action link than a prominent CTA.
2. **Add a subtle colophon-like detail**: A very muted line at the bottom of the footer like
   `EDICIÓN XV — MMXXVI` in tiny small-caps, using `::after` on the footer.
3. **Reduce the box-shadow intensity**: The current `0 -10px 40px rgb(0 0 0 / 50%)` is heavy for an
   editorial treatment. Reduce to a subtler shadow.
4. **Refine the accent border-top**: The
   `border-top: 1px solid rgb(var(--color-action-accent-rgb) / 40%)` is correct but could be thinner
   or more muted for the Valentina pink context.

**What should remain untouched:**

- Footer component markup (`Footer.astro`) — no HTML changes.
- Logo variant logic (already maps `editorial-magazine` to `footer`).
- Replay link functionality.

---

### 6.7 Location (light touch)

**Current issue:** Location has NOTA counters and venue cards — already editorial. Could benefit
from a minor hierarchy refinement.

**Intended editorial effect:** Reinforce the editorial continuity without major changes.

**Concrete UI/styling changes:**

1. **Add a section-level folio detail**: A small `::after` on the section with a muted
   `LUGARES — EDICIÓN XV` in micro-text.
2. **Venue card heading refinement**: Slightly tighten the venue card heading hierarchy.

**What should remain untouched:**

- All existing NOTA counter logic.
- Venue card structure.
- Indication items.

---

### 6.8 Quote (no changes)

The quote section already has strong editorial treatment: dark background, serif italic text, red
accent divider. No changes needed.

### 6.9 Countdown (no changes)

The countdown grid is structurally complete. No changes needed.

### 6.10 Itinerary (no changes)

The itinerary already has strong editorial treatment in the Valentina override file (CSS counters,
grid layout). No changes needed.

### 6.11 Thank-you (light touch)

**Current issue:** The thank-you section is strong (dark back-cover with signature block and
drop-cap) but the footer metadata strip could be refined.

**Intended editorial effect:** Reinforce the editorial closing.

**Concrete UI/styling changes:**

1. **Refine the footer strip text**: The `.thank-you-footer` could use a slightly different tracking
   or content to reinforce the colophon feeling.

**What should remain untouched:**

- All existing dark back-cover styling.
- Signature block.
- Drop-cap.

---

## 7. Scope / Files Likely Impacted

Based on inspection of the real repository:

### Primary file — Valentina-scoped overrides

All accent-pass changes should be implemented in:

| File                                                      | Purpose                                 |
| --------------------------------------------------------- | --------------------------------------- |
| `src/styles/themes/sections/_xv-valentina-hernandez.scss` | Event-scoped overrides for all sections |

This is the correct location for Valentina-specific editorial accents because:

- The changes are specific to the Valentina invitation's visual refinement.
- The editorial-magazine base theme files should remain reusable for other invitations.
- Valentina-scoped overrides have higher specificity and only apply to her invitation.

### Secondary files — editorial-magazine base refinements

Only if a change clearly benefits ALL editorial-magazine invitations:

| File                                                       | Potential change                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| `src/styles/themes/sections/rsvp/_editorial-magazine.scss` | RSVP framing border (benefits all editorial-magazine RSVPs) |
| `src/styles/themes/sections/footer/_editorial.scss`        | Footer shadow reduction (benefits all editorial footers)    |

### No changes expected to:

- Any `.astro` or `.tsx` component files (pure CSS accent pass).
- Any schema, content, or data files.
- Any build configuration files.
- Any other theme preset files.

---

## 8. Acceptance Criteria

### Desktop (≥ 992px)

- [ ] Hero reads as a premium editorial opening spread with clear hierarchy.
- [ ] Family feels like an editorial gratitude chapter with a distinguishing chapter gesture.
- [ ] Gallery feels like a curated visual lookbook/archive with editorial curation details.
- [ ] Gifts feels refined and like a gift guide, not transactional retail UI.
- [ ] RSVP feels like a premium private confirmation with editorial framing.
- [ ] Footer closes the invitation with editorial finality (colophon feel).
- [ ] Sections feel related without repeating the same accent everywhere.
- [ ] No section feels overloaded or gimmicky.

### Mobile (≤ 768px)

- [ ] All text remains readable and balanced.
- [ ] Editorial micro-details scale appropriately or gracefully hide.
- [ ] No horizontal overflow or layout break.
- [ ] Touch targets remain accessible.

### Cross-section coherence

- [ ] No two consecutive sections open with identical editorial gestures.
- [ ] The invitation feels like navigating a curated publication, not a themed template.
- [ ] Editorial accents are distributed, not concentrated.
- [ ] Pink/blush palette is preserved throughout.

### Technical

- [ ] Build passes (`pnpm build`).
- [ ] Type-check passes (`pnpm type-check`).
- [ ] No new component markup changes (pure SCSS pass).
- [ ] All changes are Valentina-scoped or clearly benefit all editorial-magazine invitations.

---

## 9. Validation Plan

### Visual review

- [ ] Visual review at mobile width (430px): Check all sections for readability, spacing, overflow.
- [ ] Visual review at desktop width (1440px): Check all sections for hierarchy, spacing, coherence.

### Automated validation

```bash
pnpm type-check          # Astro type validation
pnpm lint                # ESLint
pnpm build               # Full build verification
pnpm agent:git-safety:check  # Git safety
pnpm agent:git-safety:end    # Close session
```

### Manual verification

- Review each section in the dev server at mobile and desktop widths.
- Confirm no horizontal overflow.
- Confirm text readability.
- Confirm editorial micro-details are visible but not distracting.

---

## 10. Rollback Notes / Risk Assessment

### Main styling risks

1. **Specificity conflicts**: Valentina overrides have high specificity
   (`.event--valentina-hernandez.theme-preset--editorial-magazine .section[data-variant]`). All new
   overrides must use the same scope to avoid specificity wars.
2. **Mobile overflow**: Any `::before`/`::after` pseudo-elements with fixed dimensions could cause
   horizontal overflow on narrow screens. Use `clamp()` and relative units.
3. **Pseudo-element stacking**: Adding `::before`/`::after` content to sections that already use
   pseudo-elements requires careful position/z-index management.
4. **Print-like microcopy accessibility**: Decorative `content: '...'` in pseudo-elements should not
   be semantically meaningful. Use `aria-hidden` where applicable (CSS pseudo-elements are
   automatically excluded from the accessibility tree, so this is inherently safe).

### Reversibility

All changes are **CSS-only** within the Valentina override file. To roll back:

1. Revert changes to `_xv-valentina-hernandez.scss`.
2. Revert any changes to RSVP or footer base theme files (if made).
3. No database, schema, or component changes to revert.

### Stop conditions

- If any section visually breaks on mobile (horizontal overflow, unreadable text).
- If the build fails after changes.
- If changes require component markup modifications (scope creep — stop and reassess).
- If more than 3 files outside the declared scope need modification.

---

## Gates

### Gate 1 — Repo state

- Correct branch
- No unintended modifications
- `_xv-valentina-hernandez.scss` is accessible and editable

### Gate 2 — Implementation

- All SCSS changes compile without errors
- No new selector conflicts

### Gate 3 — Validation

- `pnpm type-check` passes
- `pnpm build` passes
- Visual review confirms no regressions

### Gate 4 — Final report

- Files changed are listed
- Validation results are reported
- `git status --short` is reported
- No staging or commits made
