---
name: astro-patterns
description: Apply idiomatic Astro patterns to optimize performance, maintainability, and leverage framework features correctly. Covers Content Collections, partial hydration, image optimization, and SCSS integration.
---

> **Related skills**: [`frontend-design`](file://.agent/skills/frontend-design/SKILL.md) for SCSS design system.

This skill guides use of **Astro-specific patterns** in Celebra-me to maximize static generation benefits, optimize performance, and maintain clean architecture.

## Content Collections

### Schema Definition
Define schemas in `src/content/config.ts`:
```typescript
import { defineCollection, z } from 'astro:content';

const eventsCollection = defineCollection({
  type: 'data',
  schema: z.object({
    eventType: z.enum(['xv', 'boda', 'bautizo', 'cumpleanos']),
    slug: z.string(),
    title: z.string(),
    date: z.string(),
    venue: z.object({
      name: z.string(),
      address: z.string(),
      mapUrl: z.string().url().optional(),
    }),
    gallery: z.array(z.string()).optional(),
    rsvp: z.object({
      enabled: z.boolean(),
      deadline: z.string().optional(),
    }).optional(),
  }),
});

export const collections = {
  events: eventsCollection,
};
```

### Querying Content
```astro
---
import { getCollection, getEntry } from 'astro:content';

// Get all events
const allEvents = await getCollection('events');

// Get single event
const event = await getEntry('events', 'demo-xv');

// Filter by type
const xvEvents = await getCollection('events',
  ({ data }) => data.eventType === 'xv'
);
---
```

### File Organization
```
src/content/
├── config.ts          # Schema definitions
└── events/
    ├── demo-xv.json   # XV Años demo
    ├── demo-boda.json # Wedding demo
    └── ...
```

## Partial Hydration

### Client Directives Decision Tree

| Directive | When to Use | Example |
|-----------|-------------|---------|
| None (default) | Static content, no JS needed | Text, images, layout |
| `client:load` | Critical interactivity, above fold | RSVP form submit button |
| `client:visible` | Below fold interactivity | Gallery lightbox, modals |
| `client:idle` | Non-critical, can wait | Analytics, tracking |
| `client:only` | Client-only (no SSR) | Browser-specific features |

### Examples
```astro
<!-- Static - no directive needed -->
<EventHeader title={event.title} />

<!-- Interactive countdown - loads immediately -->
<Countdown client:load targetDate={event.date} />

<!-- Gallery below fold - loads when visible -->
<PhotoGallery client:visible images={event.gallery} />

<!-- Analytics - loads when idle -->
<Analytics client:idle eventId={event.id} />
```

### Anti-Pattern
```astro
<!-- ❌ Don't hydrate everything -->
<Header client:load />      <!-- Usually static! -->
<Footer client:load />      <!-- Usually static! -->

<!-- ✅ Keep static components static -->
<Header />
<Footer />
```

## Image Optimization

### Using astro:assets
```astro
---
import { Image } from 'astro:assets';
import heroImage from '@images/events/xv-hero.jpg';
---

<!-- Optimized with automatic format conversion -->
<Image
  src={heroImage}
  alt="Salón decorado para XV años"
  width={1200}
  height={800}
  loading="eager"  <!-- For above-fold images -->
/>

<!-- Below fold -->
<Image
  src={galleryImage}
  alt="..."
  loading="lazy"
  decoding="async"
/>
```

### Remote Images
```astro
---
import { Image } from 'astro:assets';
---

<Image
  src="https://example.com/image.jpg"
  alt="Description"
  width={800}
  height={600}
  inferSize  <!-- For unknown dimensions -->
/>
```

### Background Images (CSS)
For decorative backgrounds, use CSS:
```scss
.hero {
  background-image: url('/images/pattern.svg');
  background-size: cover;
}
```

## SCSS Integration

### Global Styles
Import in `src/layouts/BaseLayout.astro`:
```astro
---
import '@/styles/global.scss';
---
```

### Component Scoped Styles
```astro
<style lang="scss">
  @use '@/styles/variables' as *;

  .component {
    color: $text-primary;
    padding: $spacing-md;
  }
</style>
```

### Partial Imports
Organize SCSS with partials:
```
src/styles/
├── global.scss        # Entry point
├── _variables.scss    # Design tokens
├── _mixins.scss       # Reusable mixins
├── _typography.scss   # Font styles
├── _animations.scss   # Motion patterns
└── components/
    └── _buttons.scss  # Component styles
```

## Dynamic Routes

### Static Generation (SSG)
```astro
---
// src/pages/[eventType]/[slug].astro
import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  const events = await getCollection('events');

  return events.map(event => ({
    params: {
      eventType: event.data.eventType,
      slug: event.data.slug
    },
    props: { event },
  }));
}

const { event } = Astro.props;
---
```

### URL Structure
```
/xv/maria-elena      → XV Años invitation
/boda/ana-y-carlos   → Wedding invitation
/bautizo/sofia       → Baptism invitation
```

## View Transitions

Astro 3+ includes native View Transitions API for page transitions.

### Global Activation

```astro
---
// src/layouts/BaseLayout.astro
import { ViewTransitions } from 'astro:transitions';
---

<head>
  <ViewTransitions />
</head>
```

### Per-Element Transitions

```astro
<h1 transition:name="event-title">{event.title}</h1>
<img transition:name={`hero-${event.slug}`} src={heroImage} />
```

### Custom Animations

```astro
<div transition:animate="slide">Content</div>
<div transition:animate="fade">Content</div>
```

### When to Use

- ✅ Navigation between invitation pages
- ✅ Transition from event list to detail
- ❌ Don't use for animations within a single page (use CSS/JS)

### Accessibility

View Transitions automatically respects `prefers-reduced-motion`.

## Component Patterns

### Props Interface
```astro
---
interface Props {
  title: string;
  subtitle?: string;
  variant?: 'primary' | 'secondary';
}

const { title, subtitle, variant = 'primary' } = Astro.props;
---
```

### Slots
```astro
---
// Section.astro
interface Props {
  title: string;
}
const { title } = Astro.props;
---

<section>
  <h2>{title}</h2>
  <slot />                    <!-- Default slot -->
  <slot name="footer" />      <!-- Named slot -->
</section>

<!-- Usage -->
<Section title="Detalles">
  <p>Content goes here</p>
  <div slot="footer">Footer content</div>
</Section>
```

## Performance Checklist

- [ ] Static components have no `client:*` directive
- [ ] Images use `<Image />` from `astro:assets`
- [ ] Above-fold images have `loading="eager"`
- [ ] Below-fold content uses `client:visible` when interactive
- [ ] CSS is scoped or uses design system variables
- [ ] No unused JavaScript in production bundle
- [ ] Content Collections validate data at build time
