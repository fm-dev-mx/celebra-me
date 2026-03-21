# Phase 03: Component Evolution & Adaptation

## Objectives

- Evolve core components to support wedding-specific needs without breaking existing demos.

## Tasks

1. **`Family.astro` Refactor**:
    - Update `Props` to accept an optional `groups` array of objects (title, mother, father, etc.).
    - If `groups` is provided, render multiple family blocks.
    - If legacy `parents` prop is provided, keep original behavior.
    - Improve "Godparents" (Padrinos) layout for a more "Jewelry Box" feel.

2. **`Hero.astro` Optimization**:
    - Add animation for dual names (fade-in sequence).
    - Support for a "split layout" if the background image allows.

3. **`EventLocation.astro` / `VenueCard.astro`**:
    - Ensure the distinction between "Ceremonia Religiosa" and "Recepción" is visually clear using
      icons and distinct labels.
    - Ensure "Dress Code" indications are prominent.

4. **`Itinerary.astro` Icons**:
    - Verify icons for: `rings`, `church`, `waltz`, `bouquet`, `cake`.

## Deliverables

- [ ] Refactored `Family.astro`.
- [ ] Refined `Hero.astro` for wedding variants.
- [ ] Updated icon set for itineraries.
