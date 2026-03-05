# Asset Management & Registry Guide

## 1. Universal Asset Registry

All invitation-specific and shared assets MUST be accessed via the **Universal Asset Registry**
(`src/lib/assets/asset-registry.ts`) to ensure type safety, consistency, and centralized management.

- `getEventAsset(eventSlug: string, assetKey: string): ImageAsset | undefined`
- `getCommonAsset(assetKey: string): ImageAsset | undefined`

### Event Asset Schema Requirement

Events must implement the strict schema ensuring no missing assets at runtime:

```typescript
interface EventAssets {
	hero: ImageAsset;
	portrait: ImageAsset;
	family?: ImageAsset; // Optional
	jardin: ImageAsset;
	signature: ImageAsset;
	gallery01: ImageAsset;
	// ... gallery01 to gallery11 required
	gallery12?: ImageAsset;
}
```

## 2. Asset Classification & Paths

### Processed Assets (`src/assets`)

Processed by Vite/Astro (optimization, hashing, bundling).

- **Event Specific:** `src/assets/images/events/[event-slug]/`
- **Common:** `src/assets/images/common/`
- **Icons:** `src/assets/icons/` (SVG sources)

### Static Assets (`/public`)

For files served directly without processing (`favicon.ico`, `robots.txt`).

## 3. Adding a New Event - Step by Step

### Step 1: Create Directory & Add Images

```bash
mkdir -p src/assets/images/events/{event-slug}
```

Add images in `.webp` format (e.g. `hero.webp`, `portrait.webp`, `gallery-01.webp`).

### Step 2: Create Barrel File

Create `src/assets/images/events/{event-slug}/index.ts`:

```typescript
import hero from './hero.webp';
import portrait from './portrait.webp';
// ... imports ...
import gallery01 from './gallery-01.webp';

export const assets = {
	hero,
	portrait,
	// Include all mapping
	gallery: [gallery01 /*...*/],
};
```

### Step 3: Register in AssetRegistry

Update `src/lib/assets/asset-registry.ts`:

```typescript
import { assets as NewEventAssets } from '@/assets/images/events/{event-slug}';

export const ImageRegistry: Registry = {
	events: {
		'{event-slug}': mapEventAssets(NewEventAssets, 'Event Display Name'),
	},
};
```

### Step 4: Validate Build

Run `pnpm check`. TypeScript compilation will fail if the structure exported lacks required fields,
ensuring complete certainty of asset presence during SSR rendering.
