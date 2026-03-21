# Phase 04: Differentiation Audit & QA

## Goals

- Confirm that the wedding demo no longer reads as a variation of XV.
- Preserve all public route and content contracts.
- Catch regressions in XV and birthday demos before final handoff.

## Tasks

1. **Canonical Route Verification**:
   - Confirm `/boda/demo-bodas` is the canonical wedding route.
   - Confirm `/bodas/demo-bodas` redirects to `/boda/demo-bodas`.
2. **Visual Differentiation Audit**:
   - Compare wedding against XV in:
     - hero silhouette
     - dominant color story
     - card geometry
     - photo direction
     - typography hierarchy
     - section rhythm
3. **Section QA Checklist**:
   - Hero uses bottom-anchored editorial composition.
   - Family uses arch-driven framing.
   - Location uses ceremony and reception photography.
   - Gallery uses editorial rhythm.
   - RSVP reads as stationery rather than a glass card.
   - Thank-you uses an editorial portrait treatment.
4. **Regression Audit**:
   - Verify `demo-xv` still renders as the original jewelry-box experience.
   - Verify `demo-cumple` still renders as luxury-hacienda.
   - Verify landing-page service mappings still resolve to the correct images and routes.
5. **Tooling Verification**:
   - Run `pnpm astro check`
   - Run `pnpm lint`
   - Run `pnpm lint:scss`
   - Run focused tests for schema/content and adapter behavior
   - Run `pnpm build`

## Acceptance Criteria

- Wedding is visually distinct from XV at first glance.
- Wedding remains premium without sharing the same dominant UI grammar as XV.
- No route, schema or build regressions are introduced.
- Other demos remain visually and functionally intact.
