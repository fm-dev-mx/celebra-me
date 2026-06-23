---
title: Public Invitation CSS Splitting — Accepted Slice
status: accepted, updated for full section split branch
created: 2026-06-21
branch: perf/public-invitation-css-splitting
supersedes: []
phase: 3 (implementation)
---

# Public Invitation CSS Splitting Plan

## Strategy

Split `invitation.*.css` (704 KB) into a shared base chunk + per-preset theme chunks.

**Shared base** (`invitation.scss`): structural layout, envelope/reveal, component base styles.
Imported statically via `import '@/styles/invitation.scss'`.

**Per-preset chunks**: theme preset CSS. Loaded dynamically via `import.meta.glob('?url')` with a
`<link>` tag, based on `viewModel.theme.preset`.

**Per-section chunks**: migrated theme-section variants under
`src/styles/invitation-sections/<section>/`. Loaded dynamically by
`resolveInvitationSectionCssUrls(viewModel.theme.preset)`.

## Files to change

### 1. `src/styles/invitation.scss` — remove preset barrel import only

Remove:

- `@use 'themes/presets/invitation';`

Keep:

- `@use 'layout/event-wrapper';`
- `@use 'invitation/envelope-reveal';`
- `@use 'invitation/reveal-card';`
- `@use 'themes/sections';` (kept for shared section base styles and unsplit sections)

Component styles (`_hero.scss`, `_gallery.scss`, etc.) are already imported by their respective
`.astro` components — they stay in the page bundle automatically. No change needed.

### 2. `src/styles/invitation-presets/*.scss` — 9 per-preset entrypoints

Each preset gets its own entrypoint file under `src/styles/invitation-presets/`, importing exactly
one theme preset:

```
src/styles/invitation-presets/jewelry-box.scss        → @use '../themes/presets/jewelry-box'
src/styles/invitation-presets/jewelry-box-wedding.scss → @use '../themes/presets/jewelry-box-wedding'
src/styles/invitation-presets/luxury-hacienda.scss     → @use '../themes/presets/luxury-hacienda'
src/styles/invitation-presets/premiere-floral.scss     → @use '../themes/presets/premiere-floral'
src/styles/invitation-presets/editorial.scss           → @use '../themes/presets/editorial'
src/styles/invitation-presets/celestial-blue.scss      → @use '../themes/presets/celestial-blue'
src/styles/invitation-presets/enchanted-rose.scss      → @use '../themes/presets/enchanted-rose'
src/styles/invitation-presets/sacred-keepsake.scss     → @use '../themes/presets/sacred-keepsake'
src/styles/invitation-presets/angelic-presence.scss    → @use '../themes/presets/angelic-presence'
```

These are discovered at build time via `import.meta.glob` with `?url` query and loaded dynamically
as separate CSS chunks.

### 3. `src/lib/invitation/preset-css-resolver.ts` — shared utility

```ts
import { THEME_PRESETS } from '@/lib/theme/theme-contract';

const presetModules = import.meta.glob('/src/styles/invitation-presets/*.scss', {
  query: '?url',
  eager: true,
}) as Record<string, string>;

const presetUrlMap: Record<string, string> = {};
for (const [path, url] of Object.entries(presetModules)) {
  const name =
    path
      .split('/')
      .pop()
      ?.replace(/\.scss$/, '') ?? '';
  presetUrlMap[name] = url;
}

export function resolvePresetCssUrl(preset: string): string | undefined {
  return presetUrlMap[preset] ?? presetUrlMap['jewelry-box'];
}
```

### 4. `src/pages/[eventType]/[slug].astro` and `src/pages/dashboard/invitaciones/[id]/preview.astro` — use shared utility

Both pages call:

```astro
const activePresetUrl = viewModel?.theme?.preset ? resolvePresetCssUrl(viewModel.theme.preset) :
undefined;
```

And pass it as `headLinks` to `Layout.astro`.

## Actual impact (final — per-preset split accepted)

| Metric                  | Baseline (original)             | Per-preset split             | Δ                           |
| ----------------------- | ------------------------------- | ---------------------------- | --------------------------- |
| Base `invitation.*.css` | 704 KB (all presets + sections) | **545 KB** (sections only)   | **−23%**                    |
| Active preset chunk     | 0 KB (embedded in base)         | **6–26 KB** (one per preset) | **−100% of unused presets** |
| Layout `Layout.*.css`   | 52 KB                           | 52 KB                        | unchanged                   |
| **Total CSS per route** | **756 KB**                      | **~602–622 KB**              | **−19%**                    |

## Section Split Result (2026-06-23)

All named section theme variant files have been moved out of the shared `themes/sections` barrel.
Each section `_index.scss` now forwards only `_base.scss`, and per-section/per-entrypoint chunks are
loaded from `src/styles/invitation-sections/**`.

Migrated sections:

```txt
gallery
hero
rsvp
countdown
footer
itinerary
reveal
thank-you
quote
family
gifts
header
location
music-player
personalized-access
```

No sections are blocked in the current branch. Sections with previously missing bases use a minimal
theme-neutral `_base.scss` and fall back to component base styles when a preset has no variant
entrypoint.

Current local build output:

| Metric                                     | Size / result |
| ------------------------------------------ | ------------- |
| Base invitation CSS before gallery         | 545 KB        |
| Base invitation CSS after gallery          | 483 KB        |
| Base invitation CSS after hero             | 437 KB        |
| Base invitation CSS after remaining split  | **184.6 KB**  |
| Layout CSS                                 | 50.8 KB       |
| Total CSS per validated route, local build | ~245–409 KB   |

Validation:

| Check                         | Result                                                                  |
| ----------------------------- | ----------------------------------------------------------------------- |
| `pnpm build`                  | PASS                                                                    |
| `pnpm test`                   | PASS                                                                    |
| `pnpm agent:git-safety:check` | PASS                                                                    |
| Route QA, 9 target routes     | PASS — 200, nonempty body, no console errors, active section CSS loaded |
| Cache privacy                 | PASS — anonymous cacheable, `?invite=debug` private/no-store            |

Base chunk caveat: `invitation.*.css` no longer receives migrated theme-section variant files from
`themes/sections/_index.scss`, but it still contains some `[data-variant]` selectors from
component-level base styles and event-specific overrides. Those were outside this loop's allowed
scope and should not be described as migrated theme-section chunks.

### Per-preset files emitted

| Preset                | Size    | Route                                                                    |
| --------------------- | ------- | ------------------------------------------------------------------------ |
| `jewelry-box-wedding` | 6.3 KB  | `/boda/demo-boda-jewelry-box-wedding`                                    |
| `jewelry-box`         | 9.3 KB  | `/xv/demo-xv-jewelry-box`                                                |
| `celestial-blue`      | 26.1 KB | `/baby-shower/demo-baby-shower-celestial` + `/xv/demo-xv-celestial-blue` |
| `angelic-presence`    | 19.2 KB | `/primera-comunion/demo-primera-comunion-illustrated`                    |
| `enchanted-rose`      | 19.1 KB | `/xv/demo-xv-enchanted-rose`                                             |
| `editorial`           | 12.7 KB | `/xv/demo-xv-editorial`                                                  |
| `luxury-hacienda`     | 17.0 KB | `/cumple/demo-cumple-luxury-hacienda`                                    |
| `premiere-floral`     | 15.2 KB | template only (no public demo)                                           |
| `sacred-keepsake`     | 17.4 KB | template only (no public demo)                                           |

### Known deferred work

| Item                      | Reason                                                                                                                                                                                                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Section splitting**     | **All listed section theme variants implemented on branch.** Base CSS reduced from ~545 KB before gallery to **184.6 KB** after full section split. Production/preview deployment still requires explicit approval. See `.agent/plans/active/public-invitation-section-architecture.md`. |
| **Phase 1 cache headers** | **Unchanged.** Logic remains identical.                                                                                                                                                                                                                                                  |

## Risk mitigation

- Visual regression: all 9 demo themes must render identically. Manual review after build.
- Loading delay: the separate CSS chunk is loaded via `<link>` in `<head>`. It blocks render the
  same as before — no regression.
- Cache behavior: the base chunk is cacheable; the preset chunk is cacheable. Repeat visits use both
  from Vercel edge cache.

## Post-Deploy P0 RCA / Guardrail

**Commit**: `fbb680ba fix(invitation): restore public route SSR rendering`

The per-preset CSS split caused a P0 blank-page regression in production. Root cause:

1. `import.meta.glob(...{ query: '?url' })` returns module objects `{ default: string }` with
   `__proto__: null`.
2. The resolver stored the raw module object instead of `mod.default`.
3. The null-prototype object reached `<link href={...}>` — `String()` threw because the object has
   no `toString()`/`valueOf()`.
4. Astro SSR produced 200 OK with empty body.

**Fix**:

- `preset-css-resolver.ts`: extract `.default` from glob modules; correct TypeScript type.
- `Layout.astro`: use explicit `rel` and `href` instead of object spread on `<link>`.
- Both the shared resolver and the Layout change are required for correct rendering.
