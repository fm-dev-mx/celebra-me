# Architectural Refactor Proposal

> **Current status:** Historical document. The original proposal was partially implemented, and the
> `presenters/` layer no longer reflects the active architecture after consolidation into
> `src/lib/invitation/page-data.ts`.

**Status**: Proposal **Date**: February 14, 2026 **Objective**: Improve type safety,
responsibility separation, and maintainability across the event system.

---

## 1. The Problem: "The God Component" (`[slug].astro`)

At the time of this proposal, `src/pages/[eventType]/[slug].astro` (350+ lines) was responsible for
too many concerns:

1. **Data Transformation**: Converting DB/content strings into asset objects.
2. **View Logic**: Deciding which components to render based on complex flags.
3. **Client Hydration**: Injecting inline scripts to unlock the envelope interaction.

This violated the single-responsibility principle and made new feature work, such as introducing a
new section type, unnecessarily risky.

## 2. The Safety Gap: Untyped Assets

Even with a robust `AssetRegistry.ts`, safety was lost at the CMS boundary (Content Collections):

- **Safe Code**: `getEventAsset(id, 'hero')` (strictly typed)
- **Real CMS Input**: `data.hero.backgroundImage` (just a `string`)

If an editor entered `"hero-bg.jpg"` in JSON while the real key was `"heroBg"`, the failure would
happen at runtime or render as a broken image instead of failing the build.

---

## 3. The Solution: "Typed View Models"

The proposal introduced an **adapter/presenter layer** that transformed raw CMS data into strictly
typed view models ready for rendering.

### A. Event Adapter (`src/lib/adapters/event.ts`)

```typescript
// Transform CollectionEntry<'events'> -> InvitationViewModel
export function adaptEvent(entry: CollectionEntry<'events'>): InvitationViewModel {
	const { data } = entry;
	// Centralized asset resolution and fallback logic
	return {
		hero: {
			// Validate against the registry during transformation
			image: resolveRegistryAsset(entry.id, data.hero.backgroundImage),
			title: data.hero.name,
		},
		// ...
	};
}
```

### B. View Model Interface

```typescript
interface InvitationViewModel {
	theme: ThemeConfig;
	hero: HeroViewModel;
	// Polymorphic ordered section array
	sections: Array<QuoteSection | GallerySection | RSVPSection>;
}
```

### C. `[slug].astro` Refactor

The route file would shrink from roughly 350 lines to about 50:

```astro
---
const eventWrapper = await getEntry('events', slug);
const viewModel = adaptEvent(eventWrapper);
---

<Layout theme={viewModel.theme}>
	<Hero {...viewModel.hero} />

	{viewModel.sections.map((section) => <SectionRenderer section={section} />)}
</Layout>
```

---

## 4. Additional Improvement: "Asset Keys as Config"

The proposal also recommended updating `src/content/config.ts` so Zod could validate asset keys
directly against the registry:

```typescript
import { AssetKeys } from '@/lib/assets/AssetRegistry';

// In Zod
backgroundImage: z.enum(AssetKeys), // Build error if the key does not exist
```

That required exporting registry keys as a tuple-compatible string array that Zod could consume.

---

## 5. Benefits

1. **Build Safety**: Invalid asset names break the build instead of production UI.
2. **Testability**: `adaptEvent` can be unit-tested without mounting Astro components.
3. **Developer Experience**: Real prop autocomplete replaces manual access patterns like
   `data.sectionStyles?.quote?.variant`.

## Immediate Recommendation

Implement the **Event Adapter** (`src/lib/adapters/event.ts`) before adding more complexity to RSVP
v2.
