---
title: Editorial Magazine Theme Rescue and Visual Leakage Fixes
status: active
plan_type: implementation
autonomy_level: 2
created: 2026-06-26
updated: 2026-06-26
related_skills:
  - theme-architecture
  - frontend-design
  - animation-motion
related_docs:
  - docs/domains/theme/architecture.md
  - docs/domains/theme/typography.md
---

# Phase 1 — Editorial Theme Rescue / Visual Leakage Fixes

This specification outlines the Spec-Driven Development (SDD) pass to perform an editorial theme
rescue and eliminate default-theme styling leaks in the `editorial-magazine` digital invitation
preset.

---

## 1. Problem Statement

While the theme has improved layout styling, default/standard UI elements still leak into the
experience, breaking the print-magazine illusion. Specifically:

1. **Selector and class mismatches** in the location card content and indications list cause
   elements to fall back to generic/standard web layouts.
2. **Footer branding and header components** fall back to standard web presentation because they
   check only for `variant === 'editorial'` and do not support `editorial-magazine`.
3. **The VIP Access Pass and RSVP elements** look like generic web forms and modal boxes rather than
   premium printed credentials and limited-edition RSVP cards.
4. **Photographic desaturation** is applied inconsistently and can damage skins/atmosphere if
   applied globally without visual verification.

---

## 2. Current-State Audit

### Cover Reveal

- **Current Strengths**: Photographic cover background with grayscale and film-grain effect is
  supported.
- **Incomplete/Generic Feel**: Animation transitions can cause layout shifts on some mobile
  viewports.
- **Likely Source Files**:
  - [EditorialCoverReveal.astro](file:///d:/code/celebra-me/src/components/invitation/EditorialCoverReveal.astro)
  - [\_editorial-cover.scss](file:///d:/code/celebra-me/src/styles/invitation/_editorial-cover.scss)
- **Proposed Correction**: Clean up entrance and exit animations to prevent any layout shifts.
  Ensure the CTA remains accessible and the no-JS fallback functions.
- **Risk Level**: Low
- **Expected Visual Impact**: High

### Sticky/Header Navigation

- **Current Strengths**: Minimal design tokens are set.
- **Incomplete/Generic Feel**: The brand logo and mobile action drawer fall back to standard web
  layouts because header logic only checks `variant === 'editorial'`.
- **Likely Source Files**:
  - [EventHeader.astro](file:///d:/code/celebra-me/src/components/invitation/EventHeader.astro)
  - [HeaderBase.astro](file:///d:/code/celebra-me/src/components/common/HeaderBase.astro)
  - [\_editorial-magazine.scss (header)](file:///d:/code/celebra-me/src/styles/themes/sections/header/_editorial-magazine.scss)
- **Proposed Correction**: Ensure that checks for `variant === 'editorial'` are expanded to also
  cover `variant === 'editorial-magazine'`.
- **Risk Level**: Low
- **Expected Visual Impact**: High

### Hero / Editorial Opener

- **Current Strengths**: Asymmetric desktop grid is defined.
- **Incomplete/Generic Feel**: Mobile layout vertically stacks but has padding and spacing
  inconsistencies.
- **Likely Source Files**:
  - [\_editorial-magazine.scss (hero)](file:///d:/code/celebra-me/src/styles/themes/sections/hero/_editorial-magazine.scss)
- **Proposed Correction**: Refine mobile layout padding to match the strict editorial margins.
- **Risk Level**: Low
- **Expected Visual Impact**: Medium

### Personalized Access Pass

- **Current Strengths**: Barcode decoration and serial number look print-inspired.
- **Incomplete/Generic Feel**: Renders as a default card with rounded corners and drop shadows.
- **Likely Source Files**:
  - [PersonalizedAccess.astro](file:///d:/code/celebra-me/src/components/invitation/PersonalizedAccess.astro)
  - [\_editorial-magazine.scss (personalized-access)](file:///d:/code/celebra-me/src/styles/themes/sections/personalized-access/_editorial-magazine.scss)
- **Proposed Correction**: Redesign as a **VIP VIP Credential / Archival Access Card** rather than a
  perforated coupon. Use a sharp monochrome layout, thin hairlines, and serial metadata. Remove all
  shadows and border-radius.
- **Risk Level**: Low
- **Expected Visual Impact**: High

### Family / Credits

- **Current Strengths**: Asymmetric credits column layout on desktop.
- **Incomplete/Generic Feel**: Outer cards feel default.
- **Likely Source Files**:
  - [\_editorial-magazine.scss (family)](file:///d:/code/celebra-me/src/styles/themes/sections/family/_editorial-magazine.scss)
- **Proposed Correction**: Lighten the border rules to thin hairlines
  (`rgb(var(--editorial-magazine-ink-rgb) / 10%)`).
- **Risk Level**: Low
- **Expected Visual Impact**: Medium

### Gallery

- **Current Strengths**: Double-page spread spans (`WIDE` and `FEATURE`) are configured.
- **Incomplete/Generic Feel**: Captions are permanently visible, but images have variable
  desaturation.
- **Likely Source Files**:
  - [\_editorial-magazine.scss (gallery)](file:///d:/code/celebra-me/src/styles/themes/sections/gallery/_editorial-magazine.scss)
- **Proposed Correction**: Ensure captions use high-contrast monospace lettering and apply
  desaturation filters carefully per image type.
- **Risk Level**: Low
- **Expected Visual Impact**: Medium

### Location / Ceremony / Reception

- **Current Strengths**: Custom button classes are defined in SCSS.
- **Incomplete/Generic Feel**: **Severe selector mismatch**. CSS rules target `.venue-card__name`
  etc. which do not exist in `VenueCard.astro`. Also, indications styling targets
  `.event-location__indication` instead of `.event-location__indication-item`.
- **Likely Source Files**:
  - [VenueCard.astro](file:///d:/code/celebra-me/src/components/invitation/components/VenueCard.astro)
  - [EventLocation.astro](file:///d:/code/celebra-me/src/components/invitation/EventLocation.astro)
  - [\_editorial-magazine.scss (location)](file:///d:/code/celebra-me/src/styles/themes/sections/location/_editorial-magazine.scss)
- **Proposed Correction**:
  1. Map location text selectors in `_editorial-magazine.scss` to target
     `.event-location__card-content-place`, `.event-location__card-content-date`,
     `.event-location__card-content-hour`, and `.event-location__card-content-address`.
  2. Fix indications selector to target `.event-location__indication-item`.
  3. Hide indication icons and replace them with auto-incrementing flat notes
     (`NOTA 01 / Código de vestimenta`) via CSS counters.
- **Risk Level**: Medium
- **Expected Visual Impact**: Very High

### RSVP

- **Current Strengths**: Underline inputs are applied.
- **Incomplete/Generic Feel**: Submit buttons, disabled/loading states, success/error views, and
  radio/options fall back to standard web layouts.
- **Likely Source Files**:
  - [RSVP.tsx](file:///d:/code/celebra-me/src/components/invitation/RSVP.tsx)
  - [\_editorial-magazine.scss (rsvp)](file:///d:/code/celebra-me/src/styles/themes/sections/rsvp/_editorial-magazine.scss)
- **Proposed Correction**: Redesign RSVP input options as flat monochrome tiles. Ensure all states
  (disabled, loading, success/error) follow the strict black-and-white editorial system.
- **Risk Level**: Low
- **Expected Visual Impact**: High

### Gifts

- **Current Strengths**: Card shadows are removed.
- **Incomplete/Generic Feel**: Standard boxy grid borders.
- **Likely Source Files**:
  - [\_editorial-magazine.scss (gifts)](file:///d:/code/celebra-me/src/styles/themes/sections/gifts/_editorial-magazine.scss)
- **Proposed Correction**: Simplify border rules to look like a clean catalog guide.
- **Risk Level**: Low
- **Expected Visual Impact**: Medium

### Thank-You / Closing

- **Current Strengths**: Side-by-side grid split is active.
- **Incomplete/Generic Feel**: Small signature font.
- **Likely Source Files**:
  - [\_editorial-magazine.scss (thank-you)](file:///d:/code/celebra-me/src/styles/themes/sections/thank-you/_editorial-magazine.scss)
- **Proposed Correction**: Enlarge the calligraphy signature (`.closing-name`) to make a strong
  back-cover statement.
- **Risk Level**: Low
- **Expected Visual Impact**: High

### Footer / Celebra-me Branding

- **Current Strengths**: Replay animations are integrated.
- **Incomplete/Generic Feel**: **Branding and action elements fall back to generic styling**.
  1. `Footer.astro` checks `variant === 'editorial'` for the brand logo, rendering the default
     colored logo.
  2. `_editorial.scss` only styles `.invitation-footer[data-variant='editorial']`, leaving
     `editorial-magazine` to fall back to default rounded/colored buttons.
- **Likely Source Files**:
  - [Footer.astro](file:///d:/code/celebra-me/src/components/invitation/Footer.astro)
  - [\_editorial.scss (footer)](file:///d:/code/celebra-me/src/styles/themes/sections/footer/_editorial.scss)
- **Proposed Correction**:
  1. Map `editorial-magazine` to `editorial` in `Footer.astro` logic.
  2. Extend selectors in `_editorial.scss` to target both `[data-variant='editorial']` and
     `[data-variant='editorial-magazine']`.
  3. Ensure the WhatsApp/contact CTA is flat, restrained, and consistent with editorial buttons (no
     rounded pill borders).
- **Risk Level**: Low
- **Expected Visual Impact**: High

---

## 3. Design Direction

We define the following visual guardrails for the `editorial-magazine` theme:

1. **Palette Discipline**: Flat paper background (`#f7f5f2`), deep carbon ink (`#0d0d0f`), and pure
   white. Red (`#d71920`) is used strictly as a single typographic accent or key hairline.
2. **Banish Gold Accents**: Any default gold stars or decorative overlays are hidden or replaced
   with clean monochromatic alternatives.
3. **Controlled Image Filters**: Define a uniform desaturation filter variable
   (`--editorial-image-filter`) in preset tokens, but apply it section-by-section with visual
   verification. Do not blindly apply filters that damage skin tones or venue details. Document
   asset quality issues as blockers where CSS filters fall short.
4. **Minimalist Print Details**:
   - Use CSS counters to render semantic folios and note numbers.
   - Hide icons in event details, replacing them with typewriter-like folios (`NOTA 01 / `,
     `Fig. 01 — `).
   - Use thin border dividers (`1px solid rgb(var(--editorial-magazine-ink-rgb) / 14%)`) instead of
     standard boxes.
5. **Language Consistency**: Visual text in Spanish; code, variables, and comments in English.

---

## 4. Scope

All modifications will be contained within:

- SCSS stylesheets scoped to `[data-variant="editorial-magazine"]` and `[data-variant="editorial"]`.
- Minor logic updates in `Footer.astro` and `EventHeader.astro` to map `editorial-magazine` to
  editorial styling rules.
- Theme presets under `src/styles/themes/presets/_editorial-magazine.scss`.
- **No new assets, dependencies, schema changes, or database migrations**.

---

## 5. Proposed Implementation Phases

### Phase 1 — Selector fixes + footer/header variant support

- Fix the location card content text and note selectors in `_editorial-magazine.scss` (location).
- Fix the footer brand logo check and the styling selectors in `_editorial.scss` (footer) to prevent
  default theme leak.
- Update `Footer.astro` to map `editorial-magazine` to the `editorial` logo variant.
- Update `EventHeader.astro` checks to correctly handle `editorial-magazine`.

### Phase 2 — Notes/counters + button/link normalization

- Style dress code and indications as flat notes (`NOTA 01 / `, etc.) by hiding icons and utilizing
  CSS counters.
- Normalize all buttons and links in locations, gifts, and RSVP sections to be flat, rectangular
  borders with zero border-radius.

### Phase 3 — RSVP and access pass polish

- Redesign the Personalized Access Pass to resemble a VIP Credential / Archival Access Card. Use a
  sharp monochrome layout, thin hairlines, and serial metadata. Remove all shadows and
  border-radius.
- Style RSVP inputs, radio/options, submit/disabled/loading states, and success/error views to
  follow the strict black-and-white editorial system.

### Phase 4 — Image filter token and visual tuning

- Introduce the `--editorial-image-filter` token.
- Apply and verify it section-by-section. Document any assets that remain inconsistent as
  asset-direction blockers.
- Clean up Cover entrance/exit transitions on mobile and desktop (ensuring zero layout shifts and
  that the CTA remains accessible).

### Phase 5 — Validation and screenshot/walkthrough report

- Run mobile viewport testing using local preview.
- Run full CI verification checks.
- Document visual QA deliverables list.

---

## 6. Acceptance Criteria

- **Branding Integrity**: The footer brand logo and WhatsApp contact link display in desaturated
  black/white without glowing animations.
- **No leaking default styling**: Venue details, dress code items, and countdown segments no longer
  fall back to default fonts/colors.
- **VIP Access Pass**: Renders without heavy shadows or coupon perforations, using a VIP credential
  layout with thin rules and serial metadata.
- **Cover Reveal**: No layout shift during reveal; no janky transitions at 430x932 viewport; CTA
  remains accessible; no-JS fallback functions; focal point remains visually acceptable.
- **RSVP States**: RSVP inputs, options, submit states, loading states, success states, and error
  states follow the editorial system.
- **Valid Builds**: The code compiles and builds cleanly on Vercel/Linux.

---

## 7. Validation Checklist

Commands to execute:

- `pnpm type-check`
- `pnpm lint`
- `pnpm lint:styles:changed`
- `pnpm validate:ui-governance`
- `pnpm validate:event-parity`
- `pnpm validate:no-pii`
- `pnpm test`
- `pnpm build`
- `pnpm agent:git-safety:check`
