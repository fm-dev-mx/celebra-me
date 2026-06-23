---
title: Public Invitation Performance — Final Closure Report
status: accepted, branch updated with full section split
created: 2026-06-21
branch: perf/public-invitation-css-splitting
supersedes: .agent/plans/active/public-invitation-performance.md (accepted slices only)
phase: 1–3 completed, 3b deferred, 4–5 roadmap
---

# Public Invitation Performance — Final Closure Report

## Phase Status Table

| Phase        | Description                                    | Status                                                                  |
| ------------ | ---------------------------------------------- | ----------------------------------------------------------------------- |
| **Phase 1**  | Cache-Control headers on `/[eventType]/[slug]` | ✅ **Done** — Preview-validated                                         |
| **Phase 2**  | LCP measurement across demo routes             | ✅ **Done**                                                             |
| **Phase 3a** | CSS waste measurement                          | ✅ **Done**                                                             |
| **Phase 3b** | Per-preset CSS split                           | ✅ **Implemented** (accepted slice)                                     |
| **Phase 3c** | Per-theme section split                        | ✅ **Full section split implemented on branch** — base CSS 545→184.6 KB |
| **Phase 3d** | Consolidated per-preset section bundles        | ✅ **Implemented locally** — request count 5–13→4 app stylesheets       |
| **Phase 4**  | Font measurement / optimization                | ⏳ **Deferred** — not a primary bottleneck                              |
| **Phase 5**  | Supabase query parallelization                 | ⏳ **Deferred** — phase 1 caching reduces impact                        |

---

## Accepted Code Changes

### Phase 1 — `src/pages/[eventType]/[slug].astro`

- Conditional `Cache-Control` based on `Astro.url.searchParams.has('invite')`
- Anonymous: `public, max-age=0, s-maxage=60, stale-while-revalidate=300`
- Personalized (any `?invite=`): `no-store, private`
- Vercel Preview: edge caching confirmed (HIT), header behavior correct

### Phase 3 — Per-Preset CSS Split

**Files changed:**

| File                                                  | Change                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/styles/invitation.scss`                          | Removed preset barrel import; keeps sections in base                   |
| `src/styles/invitation-presets/*.scss` (9 files)      | Per-theme entrypoints, each imports exactly one preset                 |
| `src/layouts/Layout.astro`                            | Added `headLinks` prop, renders extra `<link>` in `<head>`             |
| `src/pages/[eventType]/[slug].astro`                  | `import.meta.glob` → preset URL map → fallback → `headLinks` on Layout |
| `src/pages/dashboard/invitaciones/[id]/preview.astro` | Same preset resolution for preview parity                              |

**Key mechanism:**

```ts
const presetNameMap: Record<string, string> = {};
const presetModules = import.meta.glob('/src/styles/invitation-presets/*.scss', {
  query: '?url',
  eager: true,
}) as Record<string, { default: string }>;
for (const [path, mod] of Object.entries(presetModules)) {
  const name =
    path
      .split('/')
      .pop()
      ?.replace(/\.scss$/, '') ?? '';
  presetNameMap[name] = mod.default;
}
const FALLBACK_PRESET = 'jewelry-box';
const activePresetUrl = viewModel?.theme?.preset
  ? (presetNameMap[viewModel.theme.preset] ?? presetNameMap[FALLBACK_PRESET])
  : undefined;
```

---

## Performance Impact Summary

### Phase 1 — Cache Headers

- **Anonymous responses**: cached at Vercel edge for 60s (s-maxage), stale-while-revalidate 300s
- **Repeat anonymous requests**: `X-Vercel-Cache: HIT` (confirmed in Preview)
- **Estimated TTFB improvement**: from ~2.13s (origin) to <50ms (edge HIT)

### Phase 3 — CSS Split

See `.agent/plans/active/public-invitation-css-splitting.md` for detailed impact table and
per-preset sizes.

**Summary**: Base invitation CSS reduced from 704 KB to 545 KB (−23%). Active preset loaded as
separate 6–26 KB chunk per route. Total CSS per route ~611 KB (−19%).

### Section CSS

Production on 2026-06-23 still serves the per-preset-only state: anonymous public routes return
non-empty `200` responses, invite requests return `no-store, private`, and `invitation.CLuf74H_.css`
is ~558 KB decoded. The current branch additionally splits all listed theme-section variants,
reducing local build base CSS to **184.6 KB**. These branch changes are not deployed.

All section `_index.scss` files forward only `_base.scss`; concrete variants are loaded from
`src/styles/invitation-sections/<section>/`. Missing preset variants fall back to base/component
styles. The base chunk still contains some component-level and event-specific `[data-variant]`
selectors, which were outside this phase and are not `themes/sections` variant barrel imports.

### Section Bundle Consolidation

The production diagnosis after the full split found a real architecture risk: bytes improved, but
public routes loaded 5–13 render-blocking CSS files. The current branch consolidates section
entrypoints into `src/styles/invitation-sections-by-preset/<preset>.scss` and routes load one active
section bundle through `resolveSectionBundleCssUrl(themePreset)`.

Local build output:

| Metric                  | Before consolidation | After consolidation |
| ----------------------- | -------------------- | ------------------- |
| Base invitation CSS     | 184.6 KB             | 184.6 KB            |
| Total CSS per route     | 245–409 KB           | ~244.6–367.0 KB     |
| CSS request count       | 5–13                 | 4 app stylesheets   |
| Section CSS link count  | 3–11                 | 1                   |
| Production field caveat | Yes                  | Yes                 |

Preview validation was attempted at
`https://celebra-rhewiuu99-francisco-mendoza-s-projects.vercel.app`, but Vercel kept the deployment
status at `Building` and unauthenticated fetches returned a protected shell. Production was not
deployed.

---

## Explicit Non-Goals (this pass)

- No production deploy
- Local commits allowed after final validation
- No section architecture refactor
- No font implementation
- No Supabase query changes
- No animation, hero, or envelope changes
- No changes to `astro.config.mjs` or `vercel.json`
- No Tailwind or framework migrations

---

## Risks

| Risk                                  | Likelihood | Impact                         | Mitigation                                                  |
| ------------------------------------- | ---------- | ------------------------------ | ----------------------------------------------------------- |
| Remaining component/event variant CSS | Medium     | Additional performance ceiling | Deferred — requires narrower component/event override audit |
| Visual regression after split         | Low        | Broken themes                  | Manual review across 7 demo routes                          |
| Unknown preset not in map             | Low        | Fallback to `jewelry-box`      | Implemented fallback + type-safe                            |
| Preview route out of sync             | Low        | Broken preview                 | Preview uses same preset resolution                         |
| Production edge cache differs         | Low        | Different cache behavior       | Validate after production deploy                            |

---

## Deferred Work

1. **Component/event override audit** — remaining `[data-variant]` selectors in the base chunk
   should be assessed separately from `themes/sections` splitting.
2. **Font measurement (Phase 4)** — not a primary bottleneck (69 KB vs 704 KB CSS baseline)
3. **Supabase query optimization (Phase 5)** — cache headers already reduce anonymous repeat-request
   impact
4. **Preview validation retry** — rerun route, CSS, mobile lab, and cache checks once Vercel serves
   the actual Preview app instead of the protected shell

---

## Next Recommended Sequence (after human review)

1. ✅ **Build and measure local CSS output** — full section split branch base CSS is 184.6 KB.
2. ✅ **Complete local visual QA** — target public routes render with preset and active section
   chunks.
3. ⬜ **Commit after validation** if approved by the current task scope.
4. ⬜ **Deploy to Vercel Preview** — validate headers, CSS chunks, rendering, and no empty `200`.
5. ⬜ **Production deploy** — requires explicit approval.
6. ⬜ **Monitor Speed Insights** — compare mobile field data after deployment window.

---

## Supporting Artifacts

| Artifact                                                 | Content                                  |
| -------------------------------------------------------- | ---------------------------------------- |
| `.agent/plans/active/public-invitation-performance.md`   | Master plan, updated with final statuses |
| `.agent/plans/active/lcp-measurement-results.md`         | Phase 2 LCP measurements                 |
| `.agent/plans/active/css-measurement-results.md`         | Phase 3 CSS coverage measurements        |
| `.agent/plans/active/public-invitation-css-splitting.md` | Per-preset split implementation plan     |

## Post-Deploy P0 RCA / Guardrail

**Commit**: `fbb680ba fix(invitation): restore public route SSR rendering` **Date**: 2026-06-22
**Status**: Deployed to production, rendering confirmed restored.

### Root Cause

1. `import.meta.glob('/src/styles/invitation-presets/*.scss', { query: '?url', eager: true })`
   returns Vite module objects shaped like `{ default: string }` with `__proto__: null`.
2. The TypeScript assertion `as Record<string, string>` was incorrect — the runtime values are not
   raw strings but frozen module objects lacking `toString()`/`valueOf()` (null-prototype).
3. The resolver stored the raw module object (`url` from `Object.entries()`) instead of
   `mod.default`.
4. That module object reached the Layout.astro `href` attribute on a `<link>` element.
5. Astro SSR failed with `TypeError: Cannot convert object to primitive value` because `String()` on
   a null-prototype object throws.
6. The SSR function produced a 200 OK response with zero-length body — blank white page.

### Guardrails Applied

| File                                              | Fix                                                                                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/invitation/preset-css-resolver.ts`       | Changed type from `as Record<string, string>` to `as Record<string, { default: string }>`; uses `mod.default` instead of raw `url` |
| `src/layouts/Layout.astro`                        | Replaced `{...link}` object spread with explicit `rel={l.rel} href={l.href}` to avoid Astro spread-attribute ambiguity             |
| `src/components/invitation/InvitationError.astro` | Removed `#a0a0a0` hex fallback that violated style-boundary tests                                                                  |

### Lessons

- `import.meta.glob(..., { query: '?url' })` glob modules must always be accessed via `.default`.
- Null-prototype objects (`__proto__: null`) lack `toString()` — do not pass them to HTML attributes
  or `String()` calls.
- Avoid Astro template object spread (`{...x}`) for critical attributes on stylesheet `<link>`
  elements. Use explicit attributes.
- Production blank-page events can result from SSR exceptions that produce 200 with empty body —
  always check response `Content-Length` or `Transfer-Encoding: chunked` with zero body.
