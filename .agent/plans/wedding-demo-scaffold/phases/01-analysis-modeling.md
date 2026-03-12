# Phase 01: Data Modeling & Schema Extension

## Objectives

- Define the source of truth for the Wedding Demo (`demo-wedding.json`).
- Ensure the Astro Content Collection schema supports asymmetrical wedding data.

## Tasks

1. **Schema Audit**:
    - Review `src/content/config.ts`.
    - Add/Verify support for `secondaryName` or `groomName`/`brideName` if `Hero.astro` needs
      specific splitting. (Preferred: use a combined string in `name` but allow a `splitTitle` flag
      for styling).
    - Add support for `familyGroups` in the `family` object to allow multiple parent blocks (e.g.,
      "Padres de la Novia", "Padres del Novio").
2. **Drafting `demo-wedding.json`**:
    - Event: "Nuestra Boda: Sofía & Alejandro".
    - Venue: "Ex Hacienda de Mendocinas, Puebla".
    - Itinerary: Civil Ceremony, Cocktail Hour, Grand Reception.
    - RSVP: Enabled with dietary restrictions (allergies, vegan option).

3. **Data Integrity Check**:
    - Validate the draft JSON against existing Zod schemas.
    - Ensure all assets (images) are referenced correctly using `AssetSchema`.

## Deliverables

- [ ] Updated `src/content/config.ts` (backwards compatible).
- [ ] Initial `src/content/events/demo-wedding.json`.
