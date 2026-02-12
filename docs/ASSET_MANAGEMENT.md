# Asset Management Strategy

## 1. Asset Classification

### 1.1 Static Assets (`/public`)

Assets in this directory are served directly without processing by Vite/Astro. Use this **only** for
files that must remain at a fixed URL or cannot be processed.

- **Examples:** `favicon.ico`, `robots.txt`, `sitemap.xml`, `manifest.json`.
- **Constraint:** Do not use `public/` for images or icons that should be optimized, hashed, or
  bundled.

### 1.2 Processed Assets (`src/assets`)

Assets in this directory are processed by Vite/Astro (optimization, hashing, bundling). This is the
default location for all project assets.

#### Images (`src/assets/images`)

- **Event Specific:** `src/assets/images/events/[event-slug]/`
    - Contains all images specific to a single event.
    - **Requirement:** Must be registered in `AssetRegistry.ts`.
- **Common:** `src/assets/images/common/`
    - Shared images used across multiple events (e.g., default backgrounds, placeholders).
    - **Requirement:** Must be registered in `AssetRegistry.ts` under `common`.

#### Icons (`src/assets/icons`)

- **Purpose:** SVG source files for icons.
- **Consumption:** Should be imported as React components or used via an Icon component to allow
  styling control (color, size, animation).
- **Structure:** customizable (flat or categorized by feature).

## 2. Universal Asset Registry

All invitation-specific and shared assets MUST be accessed via the **Universal Asset Registry** to
ensure type safety and centralized management.

- **File:** `src/lib/assets/AssetRegistry.ts`
- **Helper Functions:**
    - `getEventAsset(eventSlug: string, assetKey: string): ImageAsset | undefined`
    - `getCommonAsset(assetKey: string): ImageAsset | undefined`

### 2.1 Schema Enforcement

The registry ensures that every event implements the required asset schema (e.g., `hero`,
`portrait`, `gallery01`...`gallery11`). This prevents runtime errors where a component expects an
image that doesn't exist for a specific event.

## 3. Reference Implementation

The `demo-xv` event (`src/assets/images/events/demo-xv`) serves as a reference implementation. It
contains placeholder assets to validate the multi-event support of the registry and components.
