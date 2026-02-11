# Asset Registry Guide

## Overview

The **Universal Asset Registry** provides a deterministic way to access and optimize project assets.
It ensures type safety, centralized management, and consistency across all events in the Celebra-me
platform.

**Benefits**:

- **Type Safety**: Compile-time validation of asset existence and structure
- **Centralized Management**: Single source of truth for all event assets
- **Consistency**: Enforces standard asset schema across all events
- **Performance**: Enables build-time optimization and lazy loading strategies

## Event Asset Structure

All events must implement the standard asset schema defined in `src/lib/assets/AssetRegistry.ts`:

```typescript
interface EventAssets {
	hero: ImageAsset;
	portrait: ImageAsset;
	family?: ImageAsset; // Optional: Family portrait
	jardin: ImageAsset;
	signature: ImageAsset;
	gallery01: ImageAsset;
	gallery02: ImageAsset;
	gallery03: ImageAsset;
	gallery04: ImageAsset;
	gallery05: ImageAsset;
	gallery06: ImageAsset;
	gallery07: ImageAsset;
	gallery08: ImageAsset;
	gallery09: ImageAsset;
	gallery10: ImageAsset;
	gallery11: ImageAsset;
	gallery12?: ImageAsset; // Optional: Extra gallery image
}
```

The registry uses a mapping function that converts a simplified raw interface (`RawEventAssets`) to
the full `EventAssets` interface. This allows barrel files to export a cleaner structure.

## Adding a New Event - Step by Step

### Step 1: Create Event Directory

Create a new directory for your event under `src/assets/images/events/`:

```bash
mkdir -p src/assets/images/events/{event-slug}
```

Replace `{event-slug}` with the event identifier (must match the content collection slug, e.g.,
`mi-boda-2025`).

### Step 2: Add Required Images

Add the following images to your event directory. All images should be in `.webp` format for optimal
performance.

**Required images**:

- `hero.webp` - Main hero/cover image
- `portrait.webp` - Portrait of the person/people being celebrated
- `jardin.webp` - Location/venue image
- `signature.webp` - Signature or decorative element
- `gallery-01.webp` through `gallery-11.webp` - Gallery images (11 minimum)

**Optional images**:

- `family.webp` - Family portrait (if applicable)
- `gallery-12.webp` - Extra gallery image

**Naming convention**: Use kebab-case for filenames (e.g., `gallery-01.webp`, not `gallery01.webp`).

### Step 3: Create Barrel File

Create `src/assets/images/events/{event-slug}/index.ts` with the following pattern:

```typescript
import hero from './hero.webp';
import portrait from './portrait.webp';
import jardin from './jardin.webp';
import signature from './signature.webp';
// Import gallery images
import gallery01 from './gallery-01.webp';
import gallery02 from './gallery-02.webp';
// ... continue for gallery03 through gallery11
import gallery11 from './gallery-11.webp';
// Optional imports
import family from './family.webp'; // if exists
import gallery12 from './gallery-12.webp'; // if exists

export const assets = {
	hero,
	portrait,
	jardin,
	signature,
	// Include family only if the file exists
	...(family && { family }),
	gallery: [
		gallery01,
		gallery02,
		gallery03,
		gallery04,
		gallery05,
		gallery06,
		gallery07,
		gallery08,
		gallery09,
		gallery10,
		gallery11,
		...(gallery12 ? [gallery12] : []),
	],
};
```

**Note**: The barrel file exports a `gallery` array, which will be mapped to individual
`gallery01`-`gallery12` fields by the registry mapping function.

### Step 4: Register in AssetRegistry

Update `src/lib/assets/AssetRegistry.ts` to include your new event:

1. Import your event assets at the top of the file:

```typescript
import { assets as NewEventAssets } from '@/assets/images/events/{event-slug}';
```

2. Add your event to the `ImageRegistry.events` object:

```typescript
export const ImageRegistry: Registry = {
	events: {
		// ... existing events
		'{event-slug}': mapEventAssets(NewEventAssets, 'Event Display Name'),
	},
	// ... common assets
};
```

Replace:

- `{event-slug}` with the same slug used in directory name and content collection
- `'Event Display Name'` with a human-readable name for the event (used in alt text)

### Step 5: Verify Registration

After adding the event, verify that the registration works by:

1. Checking TypeScript compilation: `pnpm check` or `pnpm build`
2. Using the helper function in your code:

```typescript
import { getEventAsset } from '@/lib/assets/AssetRegistry';

const heroAsset = getEventAsset('{event-slug}', 'hero');
```

## Validation Checklist

Before considering an event fully integrated, verify:

- [ ] All required images present in the event directory
- [ ] Barrel file exports correctly with proper gallery array
- [ ] Event registered in `ImageRegistry.events`
- [ ] TypeScript compilation passes (`pnpm check`)
- [ ] Event renders correctly in invitation page
- [ ] Alt text is descriptive and appropriate for the event

## Common Patterns

### Using `getEventAsset()` Helper

The `getEventAsset()` function provides type-safe access to event assets:

```typescript
import { getEventAsset } from '@/lib/assets/AssetRegistry';

// Get a specific asset
const hero = getEventAsset('cumple-60-gerardo', 'hero');
const gallery03 = getEventAsset('demo-xv', 'gallery03');
```

// Use in Astro components

```astro
---
import { getEventAsset } from '@/lib/assets/AssetRegistry';

const eventSlug = 'cumple-60-gerardo';
const heroAsset = getEventAsset(eventSlug, 'hero');
---

<Image src={heroAsset.src} alt={heroAsset.alt} />
```

### Resolving Assets in Astro Pages

The main event page template (`src/pages/[eventType]/[slug].astro`) demonstrates how to resolve and
use event assets dynamically based on the current event slug.

### Handling Optional Family Image

The family image is optional. In your barrel file, conditionally include it using spread syntax:

```typescript
export const assets = {
	hero,
	portrait,
	jardin,
	signature,
	// Conditionally include family
	...(family && { family }),
	gallery: [
		/* ... */
	],
};
```

The registry mapping function will handle the optional field appropriately.

## Troubleshooting

### Common Issues

1. **TypeScript errors after adding new event**:
    - Verify import path is correct in `AssetRegistry.ts`
    - Check that barrel file exports match `RawEventAssets` interface
    - Ensure all required images are imported

2. **Missing gallery images**:
    - The gallery array must contain at least 11 images
    - Gallery images should be named `gallery-01.webp` through `gallery-11.webp`

3. **Build failures**:
    - Run `pnpm build` to see specific error messages
    - Check for missing image files or incorrect file extensions

### Reference Implementations

For working examples, see:

- `src/assets/images/events/demo-xv/` - Complete XV Años example
- `src/assets/images/events/cumple-60-gerardo/` - Birthday event example
- `src/pages/[eventType]/[slug].astro` - Asset consumption pattern

## Related Documentation

- [Asset Management Strategy](./ASSET_MANAGEMENT.md) - Overview of asset classification
- [Universal Asset System Workflow](../.agent/workflows/universal-asset-system.md) - Agent workflow
  for asset orchestration
- [Asset Management Workflow](../.agent/workflows/asset-management.md) - Low-level optimization and
  curation
