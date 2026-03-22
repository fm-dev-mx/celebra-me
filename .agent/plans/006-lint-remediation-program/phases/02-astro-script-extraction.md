# Phase 02: Astro Script Extraction

## Objective

Remove all inline client scripts forbidden by repository lint rules and replace them with
module-based or idiomatic Astro-compatible client behavior.

## Target Areas

- `src/components/common/`
- `src/components/home/`
- `src/components/invitation/`
- `src/layouts/`
- `src/pages/`

## Planned Actions

- Define a reusable pattern for client-side initialization modules.
- Extract inline behavior from high-risk shared entry points first.
- Preserve runtime timing semantics such as `DOMContentLoaded`, hydration order, and optional DOM
  guards.

## Exit Criteria

- No `no-restricted-syntax` failures remain for inline `<script>` tags.
