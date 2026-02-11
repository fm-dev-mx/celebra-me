# Architecture — Celebra-me

This document describes the **current architectural model** of Celebra-me.

It defines **clear boundaries and decision criteria** aligned with Astro.js best practices and
Vercel deployment constraints. It is intentionally pragmatic and expected to evolve with the
project.

---

## 1) Architectural Principles

Celebra-me follows these guiding principles:

- **Hybrid by default** Static generation (SSG) is preferred. Server-side rendering (SSR) is used
  only when required by the feature.

- **Pragmatism over theory** Design patterns are tools, not goals. They are applied only when they
  reduce real complexity.

- **Explicit boundaries** Especially between server-only logic and UI/client code.

- **Deploy safety first** All decisions must remain compatible with Astro and Vercel constraints.

---

## 2) Astro Execution Model

### Default Strategy

- Pages are rendered at **build time** whenever possible.
- Runtime server execution is reserved for:
  - user input,
  - side effects,
  - protected operations,
  - integrations requiring secrets.

This aligns with Astro’s recommended hybrid model.

---

## 3) Pages, Layouts, and Components

### 3.1 Pages (`src/pages/**`)

- Define routes using Astro’s file-based routing.
- May load data at build time or runtime.
- API routes live under `src/pages/api/**`.

### 3.2 Layouts (`src/layouts/**`)

- Define shared page structure.
- Handle layout concerns only (no business logic).

### 3.3 Components (`src/components/**`)

- Presentation-focused UI components.
- Must not access secrets, environment variables, or server-only APIs.
- Should remain framework-agnostic when possible.

---

## 4) Client Islands (`client:*`)

Client-side JavaScript is **opt-in and intentional**.

### Rules

- Use islands only when real interactivity is required.
- Avoid moving logic to the client by default.
- Keep islands small, isolated, and purpose-driven.

Unnecessary client-side code is considered architectural debt.

---

## 5) Server-Side Logic

### 5.1 API Routes

API routes (`src/pages/api/**`) are the **only entry point** for:

- handling user input,
- performing side effects,
- accessing secrets,
- integrating with external services.

They act as the boundary between client and server concerns.

---

### 5.2 Server-Only Modules

External integrations (e.g., databases, email services, queues) must live in **server-only modules**
used by API routes.

Recommended locations:

- `src/utils/server/**`, or
- co-located under `src/pages/api/_lib/**`.

These modules must never be imported by UI components or client islands.

---

## 6) Client → Server Communication

Astro-recommended mechanisms are preferred:

- `fetch()` calls to `/api/*` endpoints.
- Progressive enhancement using native HTML forms:

```html
<form action="/api/endpoint" method="post"></form>
```

These approaches preserve accessibility and minimize client-side JavaScript.

---

## 7) Content Collections

Astro content collections (`src/content/**`) are used for:

- declarative, structured, static content,
- invitations, events, and templates.

### Rules for Content Collections

- Content must remain **logic-free**.
- Validation and typing are encouraged.
- Runtime behavior must not depend on content collections.

This aligns with Astro’s content-first model.

---

## 8) Styling Architecture

- **SCSS only**: All style files MUST be `.scss`. Remaining legacy `.css` files have been removed.
- **BEM methodology**: Strict enforcement of Block-Element-Modifier for class names. Avoid nesting
  beyond three levels.
- **Naming Convention**: Use kebab-case for all style files. Prefix partials with an underscore
  (e.g., `_button.scss`).
- **Module-based imports**: Use `@use` for variables, mixins, and functions. Avoid legacy `@import`.
- **Logic-Based structure**:
  - `src/styles/tokens/`: Primitive and semantic design tokens.
  - `src/styles/themes/`: Aesthetic presets (e.g., `presets/`).
  - `src/styles/components/`: Shared/reusable UI component styles.
  - `src/styles/invitation/`: Invitation-specific layouts and utilities.
- **No Tailwind**: Inline styles and Tailwind CSS are prohibited to maintain the premium custom
  aesthetic.

### 8.1 Aesthetic Presets Architecture

Celebra-me uses a **Preset-based** styling architecture to support multiple aesthetic themes (e.g.,
"Jewelry Box", "Luxury Hacienda") without code duplication.

- **Presets Directory**: `src/styles/themes/presets/` contains the entry points for each aesthetic.
- **Scoping**: Each preset file wraps its styles in a `.theme-preset--{name}` class.
- **Integration**:
  - The `preset` is defined in the content collection (`src/content/config.ts`).
  - The `[slug].astro` route applies the corresponding class to the `main` wrapper.
  - Components use **CSS Variables** (e.g., `--color-primary`) which are redefined by the active
    preset. See [THEME_SYSTEM.md](file:///c:/Code/celebra-me/docs/THEME_SYSTEM.md) for variant details.

---

## 9) Environment & Deployment (Vercel)

### Environment Variables

- Defined in Vercel.
- Typed in `src/env.d.ts`.
- Never exposed to client code.

### Platform Constraints

Architectural decisions must account for:

- Linux case sensitivity,
- build-time vs runtime execution,
- filesystem limitations,
- server vs edge execution contexts.

---

## 10) Refactor Criteria

Architectural refactors are justified only when they:

- reduce real complexity,
- eliminate bugs or boundary leaks,
- improve clarity or maintainability.

When possible, **simple design patterns** may be applied **only** if they:

- make the code easier to reason about,
- do not introduce additional layers,
- avoid over-engineering.

Refactors driven by aesthetics or pattern adherence alone should be avoided.

---

## 11) Evolution

This architecture is not static.

When the implementation diverges from this document:

- update the document first,
- then align the code.

Silent divergence is discouraged.

---

## 12) Universal Asset Registry

To ensure deterministic asset consumption and optimized delivery, all invitation-specific assets
MUST be registered in the **Universal Asset Registry**.

- **Location**: `src/lib/assets/AssetRegistry.ts`.
- **Documentation**: See `docs/ASSET_MANAGEMENT.md` for detailed classification and usage strategies.
- **Mechanism**: Components consume assets via semantic keys using `getEventAsset()` or
  `getCommonAsset()`.
- **Benefit**: Decouples component logic from raw filesystem paths, ensures strict type safety, and
  guarantees only optimized assets are referenced.
