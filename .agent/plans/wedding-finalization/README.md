# Plan: Wedding Editorial Redesign Finalization

Platform: **Celebra-me**  
Role: **Senior Product Designer & Lead Frontend Engineer**  
Status: **Ready for Implementation**

## 1. Objective

The current wedding demo still reads as a light variation of the XV "Jewelry Box" system. The route
contract is already aligned to `/boda/demo-bodas`, but the visual system still shares too much of
the XV grammar: glass cards, gold glints, rounded premium blocks, and decorative density.

This updated plan replaces the previous "small differentiation" goal with a full **editorial wedding
redesign** while keeping the premium positioning and existing public URL contract intact.

## 2. Locked Product Decisions

- **Canonical wedding route:** `/boda/demo-bodas`
- **Active birthday route:** `/cumple/demo-cumple`
- **Wedding eventType remains:** `boda`
- **Wedding preset remains:** `jewelry-box-wedding`
- **Design direction:** editorial hacienda wedding, not princess/XV luxury
- **Visual principle:** photography leads, UI frames and typography support

## 3. New Creative Direction

### Design Name

**Editorial Hacienda Wedding**

### Emotional Reference

- Boutique wedding magazine
- Fine stationery
- Modern hacienda architecture
- Silent luxury, not ornamental sparkle

### Palette

| Token           | Hex       | Use                                |
| --------------- | --------- | ---------------------------------- |
| Warm Ivory      | `#F7F3EE` | Main section backgrounds           |
| Porcelain       | `#FBF8F4` | Elevated surfaces                  |
| Stone Beige     | `#DED6CC` | Rules, frames, structural contrast |
| Champagne Matte | `#C9A46A` | Accent, fine separators, emphasis  |
| Soft Olive      | `#6E7468` | Secondary editorial accents        |
| Charcoal Ink    | `#2A2927` | Primary text and contrast          |

### Typography

- **Display / headlines:** `Cinzel Variable`
- **Editorial serif / body:** `Cormorant Garamond`
- **UI / labels / nav:** `Montserrat`
- **Script accent only:** `Pinyon Script`

Script usage is intentionally limited to microcopy accents, not full section headlines.

### Shape Language

- Dominant form: **arch**
- Supporting forms: **oval medallions**, **vertical portrait frames**, **thin editorial rules**
- Avoid:
    - rounded glass cards as the dominant motif
    - thick jewel borders
    - overuse of shimmer, glints, foil gradients

## 4. Why the Current Wedding Demo Still Feels Like XV

- The hero still behaves like a floating premium card.
- Gallery, RSVP, gifts and thank-you still inherit the same card grammar as XV.
- Gold is still used as a luminous "jewelry" accent instead of a restrained editorial accent.
- Photography is not yet driving the layout strongly enough.
- Section proportions are still centered and symmetric in the same way XV is.

## 5. Asset Direction

### Required Wedding Photography

All wedding images must look like professional editorial photography, not generic AI decor stills.

1. **Hero**
    - Couple portrait, outdoor hacienda, golden hour
    - Wide cinematic composition
    - Ratio target: `16:9`

2. **Family**
    - Formal portrait or high-end detail shot
    - Options: couple portrait, bouquet close-up, rings on stationery
    - Ratio target: `4:5`

3. **Ceremony**
    - Real or editorial chapel / ceremony location image
    - Ratio target: `4:5`

4. **Reception**
    - Real or editorial reception setup image
    - Ratio target: `4:5`

5. **Gallery**
    - 6 to 8 images
    - Mix of: wide portrait, close-up hands/rings, architecture, bouquet, walking shot, evening
      light

6. **Thank You**
    - Intimate vertical portrait
    - Ratio target: `4:5`

### Asset System Decision

Wedding location photos will be first-class event assets, not external URLs.

This requires extending the wedding asset module and registry contract so `ceremony` and `reception`
can be optimized through the same image pipeline used elsewhere.

## 6. Section-by-Section Redesign Spec

### 6.1 Header

**Goal:** make the header feel like fine editorial navigation, not the XV luxury nav.

**Layout**

- Keep the current component structure in
  [EventHeader.astro](../../../src/components/invitation/EventHeader.astro).
- Keep transparent-on-hero behavior.
- Reduce visual weight of the title.
- Make nav links feel like a printed program, not CTA chips.

**Visual Changes**

- Event title in `Cinzel Variable`, smaller and wider tracked.
- Non-CTA links become text-only with thin underline on hover.
- CTA becomes a slim bordered button, not a filled gold capsule.

**Files**

- [src/components/invitation/EventHeader.astro](../../../src/components/invitation/EventHeader.astro)
- [src/styles/invitation/\_event-header.scss](../../../src/styles/invitation/_event-header.scss)
- [src/styles/themes/sections/\_header-theme.scss](../../../src/styles/themes/sections/_header-theme.scss)

### 6.2 Hero

**Goal:** remove the XV floating card feel entirely.

**Layout**

- Full-bleed background image remains.
- Replace the central "glass card" composition with a **bottom-anchored editorial panel**.
- Desktop:
    - Names aligned in a vertical stack with strong breathing room.
    - Meta row below in a horizontal band: date, location, wedding label.
- Mobile:
    - Same structure, compressed vertically, still no floating jewel card.

**Typography**

- Primary names in `Cinzel Variable`.
- Ampersand in small `Pinyon Script`.
- Label and metadata in `Montserrat`.

**Visual Changes**

- Remove heavy glassmorphism as the dominant device.
- Replace with:
    - soft dark gradient over image
    - bottom editorial band
    - thin champagne rules
    - subtle ivory overlay

**Photo Direction**

- Wide professional portrait, not decor-first.

**Files**

- [src/components/invitation/Hero.astro](../../../src/components/invitation/Hero.astro)
- [src/styles/invitation/\_hero.scss](../../../src/styles/invitation/_hero.scss)
- [src/styles/themes/sections/\_hero-theme.scss](../../../src/styles/themes/sections/_hero-theme.scss)
- [src/styles/themes/presets/\_jewelry-box-wedding.scss](../../../src/styles/themes/presets/_jewelry-box-wedding.scss)

### 6.3 Quote

**Goal:** make the quote feel like a magazine interlude, not a romantic XV plaque.

**Layout**

- Full-width editorial text block.
- Large whitespace.
- No jewel divider top/bottom as primary motif.

**Visual Changes**

- Background in warm ivory with subtle paper texture.
- Oversized opening quotation mark as a background mark.
- Quote max width tighter than current version.
- Author small, uppercase, tracked, understated.

**Files**

- [src/components/invitation/Quote.astro](../../../src/components/invitation/Quote.astro)
- [src/styles/themes/sections/\_quote-theme.scss](../../../src/styles/themes/sections/_quote-theme.scss)

### 6.4 Family

**Goal:** make this the most recognizable "wedding-only" section.

**Layout**

- Two equal editorial columns for "Padres de la Novia" and "Padres del Novio".
- Godparents rendered in a narrower third block or separate lower strip.
- Featured image uses an **arched portrait frame**.

**Visual Changes**

- Replace decorative symmetry with structured printed-program rhythm.
- Use thin rules, muted olive/champagne accents.
- Keep arches here as the hero motif of the system.

**Files**

- [src/components/invitation/Family.astro](../../../src/components/invitation/Family.astro)
- [src/components/invitation/FamilyDecorations.astro](../../../src/components/invitation/FamilyDecorations.astro)
- [src/styles/invitation/\_family.scss](../../../src/styles/invitation/_family.scss)
- [src/styles/themes/sections/\_family-theme.scss](../../../src/styles/themes/sections/_family-theme.scss)
- [src/styles/themes/presets/\_jewelry-box-wedding.scss](../../../src/styles/themes/presets/_jewelry-box-wedding.scss)

### 6.5 Countdown

**Goal:** feel ceremonial, not playful or premium-XV.

**Layout**

- Four slim vertical number blocks.
- Title and date stay minimal.

**Visual Changes**

- Remove floating gem-card feeling.
- Number blocks become taller, cleaner, less rounded.
- Accent only on separators and labels.

**Files**

- [src/styles/themes/sections/\_countdown-theme.scss](../../../src/styles/themes/sections/_countdown-theme.scss)
- [src/styles/themes/presets/\_jewelry-box-wedding.scss](../../../src/styles/themes/presets/_jewelry-box-wedding.scss)

### 6.6 Location

**Goal:** feel architectural and venue-led.

**Layout**

- Ceremony and reception remain separate cards structurally, but visually shift to **architectural
  editorial panels**.
- The venue image becomes dominant.
- Map links remain, but visually secondary.

**Visual Changes**

- Cards become taller and less jewel-like.
- Venue photos move to the top as a true feature.
- CTA buttons become rectangular fine-stationery controls.
- Flourish markers become thin rules and tiny arch motifs instead of diamonds.

**Photo Direction**

- Real chapel image for ceremony.
- Real reception setup or hacienda courtyard image for reception.

**Implementation Decision**

- Extend event assets to support `ceremony` and `reception`.
- Use these keys in `demo-bodas.json` under `location.ceremony.image` and
  `location.reception.image`.

**Files**

- [src/components/invitation/EventLocation.astro](../../../src/components/invitation/EventLocation.astro)
- [src/components/invitation/components/VenueCard.astro](../../../src/components/invitation/components/VenueCard.astro)
- [src/styles/invitation/\_event-location.scss](../../../src/styles/invitation/_event-location.scss)
- [src/styles/themes/sections/\_location-theme.scss](../../../src/styles/themes/sections/_location-theme.scss)
- [src/lib/assets/asset-registry.ts](../../../src/lib/assets/asset-registry.ts)
- [src/assets/images/events/demo-wedding/index.ts](../../../src/assets/images/events/demo-wedding/index.ts)
- [src/content/events/demo-bodas.json](../../../src/content/events/demo-bodas.json)

### 6.7 Itinerary

**Goal:** make it read like a wedding program timeline.

**Layout**

- Vertical line timeline stays, but should feel more like printed sequence than glowing luxury.

**Visual Changes**

- Fine line, restrained icon treatment, stronger typography hierarchy.
- Labels in `Cinzel`.
- Descriptions in `Cormorant Garamond`.

**Files**

- [src/styles/themes/sections/\_itinerary-theme.scss](../../../src/styles/themes/sections/_itinerary-theme.scss)

### 6.8 Gallery

**Goal:** feel like editorial storytelling, not a reusable premium grid.

**Layout Decision**

- Keep `PhotoGallery.tsx`, but change its wedding layout logic.
- For `jewelry-box-wedding`, use a fixed editorial rhythm:
    - item 0: feature wide
    - item 1: vertical
    - item 2: vertical
    - item 3: wide
    - item 4: standard
    - item 5: standard
    - item 6+: standard or wide alternating

**Visual Changes**

- Captions become small editorial labels.
- Overlay is subtler.
- More whitespace in section header.
- Less “card” feeling around each image.

**Files**

- [src/components/invitation/Gallery.astro](../../../src/components/invitation/Gallery.astro)
- [src/components/invitation/PhotoGallery.tsx](../../../src/components/invitation/PhotoGallery.tsx)
- [src/styles/invitation/\_gallery.scss](../../../src/styles/invitation/_gallery.scss)
- [src/styles/themes/sections/\_gallery-theme.scss](../../../src/styles/themes/sections/_gallery-theme.scss)

### 6.9 Gifts

**Goal:** make gifts feel like premium stationery, not premium product cards.

**Layout**

- Keep current semantic structure.
- Visual shell becomes flatter, cleaner, more card-stock than glass.

**Visual Changes**

- Remove heavy glass look.
- Use ivory blocks with thin borders and inset rules.
- Buttons become bordered controls.

**Files**

- [src/styles/themes/sections/\_gifts-theme.scss](../../../src/styles/themes/sections/_gifts-theme.scss)

### 6.10 RSVP

**Goal:** make RSVP feel like a formal response card.

**Layout**

- Keep current React form and validation logic.
- Change visual shell from glass card to **reply card / stationery form**.

**Visual Changes**

- Narrower width.
- Less blur.
- More solid paper surface.
- Labels in `Montserrat`.
- Title in `Cinzel`, not script.
- Radios styled like formal response options.

**Files**

- [src/components/invitation/RSVP.tsx](../../../src/components/invitation/RSVP.tsx)
- [src/styles/invitation/\_rsvp.scss](../../../src/styles/invitation/_rsvp.scss)
- [src/styles/themes/sections/\_rsvp-theme.scss](../../../src/styles/themes/sections/_rsvp-theme.scss)

### 6.11 Thank You

**Goal:** make the final screen feel like the closing page of a wedding editorial.

**Layout**

- Switch from circular portrait to **vertical arch portrait**.
- Message sits beside or below as a letter block depending on viewport.
- Signature oversized but restrained.

**Visual Changes**

- Remove glimmer wheel and circular jewelry portrait frame.
- Use ivory panel, thin border, arch silhouette.
- Make the closing name feel like a magazine signature, not a fairy-tale flourish.

**Files**

- [src/components/invitation/ThankYou.astro](../../../src/components/invitation/ThankYou.astro)
- [src/styles/invitation/\_thank-you.scss](../../../src/styles/invitation/_thank-you.scss)
- [src/styles/themes/sections/\_thank-you-theme.scss](../../../src/styles/themes/sections/_thank-you-theme.scss)

### 6.12 Music Player

**Goal:** turn it into a subtle concierge detail, not a shiny accent.

**Visual Changes**

- Reduce glow.
- Softer prompt styling.
- Match stationery and ivory/champagne finish.

**Files**

- [src/styles/themes/sections/\_music-theme.scss](../../../src/styles/themes/sections/_music-theme.scss)

## 7. Required Asset and Data Contract Updates

### 7.1 Wedding Asset Module

Update
[src/assets/images/events/demo-wedding/index.ts](../../../src/assets/images/events/demo-wedding/index.ts)
to export:

- `ceremony`
- `reception`

### 7.2 Asset Registry

Update [src/lib/assets/asset-registry.ts](../../../src/lib/assets/asset-registry.ts):

- add `ceremony` and `reception` to `EVENT_KEYS`
- extend `RawEventAssets`
- map these keys in `mapEventAssets`

### 7.3 Event Content

Update [src/content/events/demo-bodas.json](../../../src/content/events/demo-bodas.json):

- set `location.ceremony.image` to `ceremony`
- set `location.reception.image` to `reception`
- expand gallery from 2 items to 6 or 8 curated editorial captions

## 8. Implementation Phases

### Phase 1: Platform Contract Stabilization

- Keep routes and eventType as already aligned.
- Keep birthday landing mapping intact.

### Phase 2: Editorial Asset Procurement

- Replace or regenerate wedding images to match the editorial direction.
- Add ceremony and reception venue photos.
- Curate a full gallery set.

### Phase 3: Wedding System Redesign

- Rebuild the preset token layer.
- Redesign hero, family, location, gallery, RSVP and thank-you.
- Reduce XV overlap in all wedding section themes.

### Phase 4: QA and Differentiation Audit

- Confirm wedding no longer reads as XV.
- Confirm route and content contracts remain valid.
- Confirm no regressions to XV or birthday demos.

## 9. Constraints

- Do not change the canonical public contract: `/boda/demo-bodas`
- Do not pluralize `eventType`
- Do not break `demo-xv` or `demo-cumple`
- Keep wedding changes scoped to `jewelry-box-wedding` and wedding-specific selectors
- All new wedding photos should use the optimized asset pipeline where possible

## 10. Acceptance Criteria

- The hero no longer looks like a floating XV premium card.
- The wedding palette reads as ivory / stone / champagne, not pink-gold jewelry luxury.
- Family and thank-you use arch-driven frames.
- Location uses professional venue imagery as a first-class design element.
- Gallery has an editorial rhythm distinct from XV.
- RSVP reads like a formal response card.
- Wedding is recognizably premium, but no longer visually adjacent to XV.
