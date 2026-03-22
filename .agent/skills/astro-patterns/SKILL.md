---
name: astro-patterns
description:
    Apply idiomatic Astro patterns to optimize performance, maintainability, and leverage framework
    features correctly. Covers Content Collections, BFF data fetching, and Image Optimization.
domain: frontend-platform
when_to_use:
    - Editing Astro pages, components, collections, or client boundaries
    - Reviewing SSR, hydration, and content-loading patterns
preconditions:
    - Read .agent/README.md
    - Read .agent/GATEKEEPER_RULES.md
inputs:
    - Astro pages, components, content collections, and rendering constraints
outputs:
    - Framework-aligned architecture guidance and implementation constraints
related_docs:
    - docs/core/architecture.md
    - docs/core/project-conventions.md
---

# Astro Patterns

> **Related skills**: [`backend-engineering`](../backend-engineering/SKILL.md) for API routes.

This skill governs **Astro Component Architecture** in Celebra-me. It focuses on how components
render, fetch data, and interact with the client.

## Data Fetching Strategies

### 1. Static Content (Build Time)

Use **Content Collections** for data that doesn't change between builds (event details, themes).

```astro
---
import { getEntry } from 'astro:content';
const event = await getEntry('events', 'my-event');
---

<h1>{event.data.title}</h1>
```

### 2. Dynamic Content (Runtime - BFF Pattern)

For user-specific data (RSVP status, guest counts), use a **Backend-for-Frontend (BFF)** pattern. Do
NOT fetch directly from the DB in `.astro` components if it prevents static caching of the shell.

#### Preferred: Server Islands (Astro 5+)

```astro
<EventHeader />
<!-- Static -->
<server-island-guest-status>
	<GuestStatus server:defer />
	<!-- Dynamic, loads later -->
</server-island-guest-status>
```

#### Alternative: Client Fetch

```astro
---
// Wrapper component
---

<GuestDashboard client:load eventId={id} />
```

## Partial Hydration Rules

| Directive        | Use Case                          | Example               |
| :--------------- | :-------------------------------- | :-------------------- |
| `client:load`    | Critical interactivity above fold | RSVP Form, Main Nav   |
| `client:visible` | Heavy components below fold       | Image Gallery, Maps   |
| `client:idle`    | Low priority background tasks     | Analytics, Preloading |
| `client:media`   | Device-specific features          | Mobile-only effects   |

## Image Optimization

Always use `astro:assets`.

```astro
---
import { Image } from 'astro:assets';
import heroImg from '../assets/hero.jpg';
---

<Image src={heroImg} alt="Hero" w={1200} format="webp" />
```

## Component Architecture

### The "Islands" Mental Model

Think of your page as a static ocean (HTML) with dynamic islands (React/Preact).

- **Static Ocean**: Layouts, Typography, SEO, Images.
- **Dynamic Islands**: Forms, Interactive Maps, Audio Players.

### Props Interface

Start every component with a typed interface.

```astro
---
interface Props {
	title: string;
	variant?: 'primary' | 'secondary';
}
const { title, variant = 'primary' } = Astro.props;
---
```
