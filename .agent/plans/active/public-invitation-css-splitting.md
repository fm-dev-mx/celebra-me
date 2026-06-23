---
title: Public Invitation CSS Splitting — Accepted Slice
status: accepted
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

**Per-preset chunks**: theme preset CSS + section variant CSS. Loaded dynamically via
`import.meta.glob('?url')` with a `<link>` tag, based on `viewModel.theme.preset`.

## Files to change

### 1. `src/styles/invitation.scss` — remove preset barrel import only

Remove:

- `@use 'themes/presets/invitation';`

Keep:

- `@use 'layout/event-wrapper';`
- `@use 'invitation/envelope-reveal';`
- `@use 'invitation/reveal-card';`
- `@use 'themes/sections';` (kept — section splitting deferred)

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

| Item                      | Reason                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Section splitting**     | **Gallery POC implemented.** 7 of 15 sections have no `_base.scss`; gallery was chosen as the proof-of-pattern because it has a substantive `:where()` base. Base CSS reduced from ~545 KB to ~483 KB. See `.agent/plans/active/public-invitation-section-architecture.md`. Remaining sections still require dedicated architecture work before splitting. |
| **Phase 1 cache headers** | **Unchanged.** Logic remains identical.                                                                                                                                                                                                                                                                                                                    |

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
