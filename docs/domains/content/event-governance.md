# Event Content Governance

**Last Updated:** 2026-03-13

This document defines how invitation content is organized and governed across live events, demos,
and internal templates.

## Collection Roles

- `src/content/events/`
    - Client-ready or production-linked routable events only.
    - Keep files flat while public routes resolve by bare slug.
- `src/content/event-demos/`
    - Public showcase invitations.
    - Nested by `eventType` for editorial clarity.
    - Must remain premium, polished, and safe for public sharing.
- `src/content/event-templates/`
    - Internal master templates for onboarding and content operations.
    - Never resolve from public routes.
- `archive/event-content/`
    - Historical or retired content kept outside Astro collections.

## Naming Rules

- Live event slugs should be semantic and client-specific: `xv-maria-2026`.
- Demo slugs should clearly identify showcase purpose: `demo-xv`, `demo-bodas`.
- Template files should use stable editorial names such as `master.json`.
- Do not keep duplicate public demos that express the same concept with different slugs.

## Premium Content Rules

- Maintain the platform's luxury positioning in all placeholder and demo copy.
- Prefer concise, editorial Spanish copy over generic or casual placeholders.
- Demos should feel complete and aspirational, not like unfinished QA fixtures.
- Templates should be clean enough for onboarding, but still reflect premium structure and tone.

## Theme Governance

- All content must comply with the 3-Layer Color Architecture in
  `docs/domains/theme/architecture.md`.
- Presets and section variants must come from `src/lib/theme/theme-contract.ts`.
- `jewelry-box`, `jewelry-box-wedding`, and `luxury-hacienda` remain the only supported presets
  unless the contract is extended first.
- Do not introduce ad-hoc colors or theme literals directly in content without contract support.

## Schema Discipline

- Shared schema stays authoritative in `src/content/config.ts`.
- When UI/runtime supports a field, the content schema and adapter types must support it too.
- Event-specific requirements should be additive and optional, not separate schema forks by default.
- New event types require:
    - At least one master template.
    - At least one premium demo if the type will be sold publicly.
    - Asset coverage or URL-based fallbacks that render without broken media.

## Event Type Roadmap

- `bautizo`
    - Backend-compatible but content-incomplete until a premium master template and demo exist.
- `graduacion`
    - Deferred from runtime support.
    - When activated, start with shared schema plus additive fields such as `institutionName`,
      `degreeOrProgram`, `generationYear`, and optional `honors`.
