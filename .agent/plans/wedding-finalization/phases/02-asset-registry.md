# Phase 02: Editorial Asset Procurement & Registry Expansion

## Goals

- Preserve the landing page birthday mapping.
- Introduce professional wedding imagery as first-class event assets.
- Expand the wedding asset contract to support ceremony and reception photos.

## Tasks

1. **Landing Page Preservation**:
    - Keep `serviceCumple` registered in `src/lib/assets/asset-registry.ts`.
    - Keep `'Cumpleaños'` mapped to `serviceCumple` in `src/components/home/Services.astro`.
2. **Wedding Asset Procurement**:
    - Replace or regenerate the following professional editorial assets inside
      `src/assets/images/events/demo-wedding/`:
        - `hero.png`
        - `family.png`
        - `portrait.png`
        - `gallery-01.png` through `gallery-06.png`
    - Add two new assets:
        - `ceremony.png`
        - `reception.png`
3. **Wedding Asset Module Update**:
    - Update `src/assets/images/events/demo-wedding/index.ts` to export:
        - `ceremony`
        - `reception`
4. **Registry Expansion**:
    - Update `src/lib/assets/asset-registry.ts`:
        - Add `ceremony` and `reception` to `EVENT_KEYS`.
        - Extend `RawEventAssets`.
        - Map both keys in `mapEventAssets`.
5. **Content Wiring**:
    - Update `src/content/events/demo-bodas.json`:
        - `location.ceremony.image: "ceremony"`
        - `location.reception.image: "reception"`
        - Expand gallery to 6 or 8 editorial entries with refined captions.

## Verification

- Landing page "Nuestros Servicios" still shows a specific birthday image instead of the XV image.
- Wedding hero, family, location and thank-you sections all render professional photography through
  the local optimized asset pipeline.
- Ceremony and reception venue cards use dedicated images, not generic fallback visuals.
