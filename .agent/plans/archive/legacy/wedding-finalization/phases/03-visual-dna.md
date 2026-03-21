# Phase 03: Wedding Editorial System Redesign

## Goals

- Establish a wedding identity that no longer reads as a variant of XV.
- Make photography, editorial typography, and architectural forms the primary differentiators.
- Keep the experience premium without relying on the same jewelry/glass language as XV.

## Tasks

1. **Preset Repositioning**:
   - Rebuild `src/styles/themes/presets/_jewelry-box-wedding.scss` around:
     - ivory / porcelain / stone / champagne / charcoal
     - `Cinzel Variable` for display
     - `Cormorant Garamond` for editorial serif copy
     - `Montserrat` for UI labels
     - `Pinyon Script` only for micro accents
2. **Hero Redesign**:
   - Update `src/components/invitation/Hero.astro` and
     `src/styles/themes/sections/_hero-theme.scss`.
   - Remove the floating XV-style premium card.
   - Use a full-bleed photograph with a bottom-anchored editorial information band.
   - Stack the couple names with restrained ampersand treatment and stronger whitespace.
3. **Header Repositioning**:
   - Update `src/styles/invitation/_event-header.scss` and
     `src/styles/themes/sections/_header-theme.scss`.
   - Move non-CTA links to text-led editorial navigation.
   - Replace filled CTA behavior with a fine-stationery button style.
4. **Quote Redesign**:
   - Update `src/styles/themes/sections/_quote-theme.scss`.
   - Replace jewelry-style dividers with an editorial interlude treatment, larger whitespace and
     quieter ornamentation.
5. **Family Redesign**:
   - Update `src/components/invitation/Family.astro`,
     `src/components/invitation/FamilyDecorations.astro`, `src/styles/invitation/_family.scss`, and
     `src/styles/themes/sections/_family-theme.scss`.
   - Use arches as the dominant structural motif.
   - Render bride and groom families as formal editorial columns.
6. **Location Redesign**:
   - Update `src/components/invitation/EventLocation.astro`,
     `src/components/invitation/components/VenueCard.astro`,
     `src/styles/invitation/_event-location.scss`, and
     `src/styles/themes/sections/_location-theme.scss`.
   - Make venue photography lead the composition.
   - Replace jewel-card language with taller architectural panels and thinner controls.
7. **Gallery Redesign**:
   - Update `src/components/invitation/PhotoGallery.tsx`, `src/styles/invitation/_gallery.scss`, and
     `src/styles/themes/sections/_gallery-theme.scss`.
   - Introduce a fixed editorial layout rhythm for `jewelry-box-wedding`.
   - Reduce card heaviness and caption overlays.
8. **RSVP Redesign**:
   - Update `src/styles/invitation/_rsvp.scss` and `src/styles/themes/sections/_rsvp-theme.scss`.
   - Make the RSVP section feel like a response card on premium stationery rather than a translucent
     luxury widget.
9. **Thank You Redesign**:
   - Update `src/components/invitation/ThankYou.astro`, `src/styles/invitation/_thank-you.scss`, and
     `src/styles/themes/sections/_thank-you-theme.scss`.
   - Replace circular portrait framing with a vertical arch or editorial portrait treatment.
10. **Secondary Section Alignment**:

- Update `src/styles/themes/sections/_countdown-theme.scss`,
  `src/styles/themes/sections/_itinerary-theme.scss`,
  `src/styles/themes/sections/_gifts-theme.scss`, and
  `src/styles/themes/sections/_music-theme.scss`.
- Ensure supporting sections align with the editorial wedding language and not the XV jewelry
  system.

## Verification

- Wedding hero no longer reads as a floating XV premium card.
- Family and thank-you sections use arch-driven framing.
- Location uses architectural venue imagery with a clearly different card language from XV.
- Gallery reads as editorial storytelling, not a reusable premium grid.
- RSVP reads like a formal printed response card.
- Across the full page, wedding is recognizably premium but no longer visually adjacent to XV.
