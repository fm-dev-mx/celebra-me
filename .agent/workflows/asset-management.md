---
description: Asset Management & Optimization Workflow
---

# Asset Management Workflow

This workflow guides the transition of event image infrastructure to a structured **Atomic Asset Architecture**. It handles curation, semantic renaming, registry updates, and verification of event assets.

## 1. Context & Discovery

1.  **Source of Truth Check**
    - Verify the contents of `src/assets/images/events/_optimized/[event-slug]/`.
    - Ensure all images are in `.webp` format (output from `scripts/optimize-event-images.mjs`).
    - **Rule**: If raw images exist in non-optimized folders, run the optimization script first.

2.  **Inventory Scan**
    - Identify redundant or low-quality assets.
    - Flag any files that do not follow the naming convention.

## 2. Standardization (Semantic Renaming)

Refactor filenames to strictly follow the pattern: `[category]-[index].webp`
- **Categories**: `hero`, `portrait`, `gallery`, `preview`, `signature`.
- **Index**: 2-digit zero-padded numbers (e.g., `01`, `02`) for sortable collections.
- **Example**: `gallery-1.webp` -> `gallery-01.webp`.
- **Example**: `hero-banner.webp` -> `hero.webp` (Canonize core assets).

**Action**: Rename files in `src/assets/images/events/_optimized/[event-slug]/`.

## 3. Registry Architecture (The Barrel Pattern)

Create or update the TypeScript registry to allow strict, typed imports of assets.

1.  **Event-Level Registry** (`src/assets/images/events/[event-slug]/index.ts`)
    - Import all local `.webp` images.
    - Export them as named constants or structured objects.
    - Example:
      ```typescript
      import hero from './hero.webp';
      export const assets = { hero };
      ```

2.  **Global Registry** (`src/assets/images/events/index.ts`)
    - Re-export the event module.
    - Example: `export * as Cumple60Gerardo from './cumple-60-gerardo';`

## 4. Content Integration

Update the Event Content Collection (`src/content/events/[event-slug].json`) to reference the new architecture.
- **Deprecation**: Remove raw string paths (e.g., `"../../assets/..."`).
- **Adoption**: Use the registry keys or imports defined in the `[slug].astro` page logic (or intermediate mapping layer).

## 5. Verification & Safeguards

1.  **Static Analysis**
    - Run `pnpm build` to verify that all imports in the registry resolve correctly.
    - If the build fails, an image path is incorrect.

2.  **Visual QA**
    - Start the dev server: `pnpm dev`.
    - Navigate to the event page (e.g., `/cumple-60-gerardo`).
    - Verify that Critical Images (Hero, Portrait) load immediately.
    - Check the browser console for 404 errors.

3.  **Clean Up**
    - Once verified, delete any legacy raw images that are no longer referenced to keep the repo clean.
