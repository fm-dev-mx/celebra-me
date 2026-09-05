---
name: astro-patterns
description:
  Implement or review Astro SSR, hydration, content loading, and image delivery while preserving
  Celebra-me rendering, cache, managed-content, and server/client contracts.
domain: frontend
version: 1.1.0
when_to_use:
  - Editing Astro pages, components, collections, or client boundaries
  - Reviewing SSR, hydration, and content-loading patterns
preconditions:
  - Read AGENTS.md
  - Read .agent/rules/gatekeeper.md
inputs:
  - Astro pages, components, content collections, and rendering constraints
outputs:
  - Framework-aligned architecture guidance and implementation constraints
related_skills:
  - backend-engineering
related_docs:
  - docs/core/architecture.md
  - docs/core/project-conventions.md
---

# Astro Patterns

Use for SSR, hydration, content loading, and image-delivery changes. The execution model is owned by
[architecture](../../../docs/core/architecture.md) and astro.config.mjs; do not impose a static
shell or server-island migration on an unrelated task.

## Rendering and data

- Trace the actual route, content resolver, layout, and hydrated consumer. Preserve the current SSR
  and cache contract, including
  [public/private invitation responses](../../../docs/domains/invitations/public-response-cache-policy.md).
- Content collections are sources where the active resolver uses them; real client invitations use
  the managed published-content pipeline. Do not replace it with static event examples.
- Keep database access, secrets, and Node APIs on the server. Pass only the intended serialized
  client data to islands; use the existing service/API boundary for authenticated interactions.
- Choose hydration according to when the interaction is needed and verify the affected behavior. Do
  not add client directives to static content or change a working directive by category alone.

## Assets and components

- Inspect the existing image owner: bundled assets, managed remote media, social metadata, and
  dynamic lightbox images do not all use the same delivery path. Reuse astro:assets or the managed
  normalization/delivery helpers appropriate to that source. Preserve dimensions, responsive
  sources, focal points, loading priority, and alternative text.
- Public assets are URL resources, not module imports. Reuse existing component Props and aliases;
  do not copy illustrative APIs or introduce duplicate interfaces for unchanged components.
- Validate SSR/client separation and the affected route or component with the Gatekeeper tier. Add
  browser evidence only when the changed rendering or interaction requires it.

For uncertain Astro APIs, use official docs for the versions pinned in package.json. Current source
and the architectural contract take precedence over generic framework examples.
