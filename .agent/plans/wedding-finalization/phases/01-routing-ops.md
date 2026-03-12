# Phase 01: Routing Standardization & File Operations

## Goals

- Align physical file names with logical slugs used in the platform.
- Standardize the Wedding URL path to `/boda/`.

## Tasks

1. **Rename Files**:
    - Preserve `src/content/events/demo-bodas.json` as the public wedding demo slug.
    - Preserve `src/content/events/demo-cumple.json` as the active public birthday demo.
2. **Update JSON Metadata**:
    - In `demo-bodas.json`: Set `eventType` to `"boda"` so it matches the content schema and
      canonical route contract.
    - In `demo-cumple.json`: Keep `eventType` as `"cumple"`.
3. **Sync Landing Data**:
    - Update `src/data/landing-page.data.ts`:
        - Bodas path: `/boda/demo-bodas`
        - Cumpleaños path: `/cumple/demo-cumple`

## Verification

- Accessing `localhost:4321/boda/demo-bodas` should render the wedding invitation without redirect.
- Accessing `localhost:4321/bodas/demo-bodas` should redirect to the canonical wedding route.
- Accessing `localhost:4321/cumple/demo-cumple` should render the Alberto invitation.
