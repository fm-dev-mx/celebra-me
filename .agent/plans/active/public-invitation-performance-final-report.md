---
title: Public Invitation Performance — Final Closure Report
status: accepted, pending commit and production deploy
created: 2026-06-21
branch: perf/public-invitation-css-splitting
supersedes: .agent/plans/active/public-invitation-performance.md (accepted slices only)
phase: 1–3 completed, 3b deferred, 4–5 roadmap
---

# Public Invitation Performance — Final Closure Report

## Phase Status Table

| Phase        | Description                                    | Status                                           |
| ------------ | ---------------------------------------------- | ------------------------------------------------ |
| **Phase 1**  | Cache-Control headers on `/[eventType]/[slug]` | ✅ **Done** — Preview-validated                  |
| **Phase 2**  | LCP measurement across demo routes             | ✅ **Done**                                      |
| **Phase 3a** | CSS waste measurement                          | ✅ **Done**                                      |
| **Phase 3b** | Per-preset CSS split                           | ✅ **Implemented** (accepted slice)              |
| **Phase 3c** | Per-theme section split                        | 🛑 **Deferred** — architecture too interwoven    |
| **Phase 4**  | Font measurement / optimization                | ⏳ **Deferred** — not a primary bottleneck       |
| **Phase 5**  | Supabase query parallelization                 | ⏳ **Deferred** — phase 1 caching reduces impact |

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

### Remaining Section CSS

The 545 KB base chunk still includes all section variants from `themes/sections/_index.scss`. 7 of
15 sections lack `_base.scss` (header, gifts, family, location, music-player, quote, thank-you are
100% theme-specific), making them unsafe to split without a dedicated section architecture refactor.
See the CSS splitting plan for details.

---

## Explicit Non-Goals (this pass)

- No production deploy
- No commit
- No section architecture refactor
- No font implementation
- No Supabase query changes
- No animation, hero, or envelope changes
- No changes to `astro.config.mjs` or `vercel.json`
- No Tailwind or framework migrations

---

## Risks

| Risk                              | Likelihood | Impact                    | Mitigation                                        |
| --------------------------------- | ---------- | ------------------------- | ------------------------------------------------- |
| Remaining 545 KB base section CSS | High       | Performance ceiling       | Deferred — requires section architecture refactor |
| Visual regression after split     | Low        | Broken themes             | Manual review across 7 demo routes                |
| Unknown preset not in map         | Low        | Fallback to `jewelry-box` | Implemented fallback + type-safe                  |
| Preview route out of sync         | Low        | Broken preview            | Preview uses same preset resolution               |
| Production edge cache differs     | Low        | Different cache behavior  | Validate after production deploy                  |

---

## Deferred Work

1. **Section splitting** — requires dedicated section architecture refactor (sections organized by
   section type, not preset; inconsistent theme coverage; 7 sections with no base styles)
2. **Font measurement (Phase 4)** — not a primary bottleneck (69 KB vs 704 KB CSS baseline)
3. **Supabase query optimization (Phase 5)** — cache headers already reduce anonymous repeat-request
   impact
4. **Per-preset section chunk splitting** — follow-up after section architecture refactor

---

## Next Recommended Sequence (after human review)

1. ✅ **Perform final visual QA** — 7 demo routes checked (this report)
2. ⬜ **Commit** the current accepted slice on `perf/public-invitation-css-splitting`
3. ⬜ **Deploy to Vercel Preview** — validate headers, CSS chunks, and rendering
4. ⬜ **Production deploy** — after approval
5. ⬜ **Monitor Speed Insights** — Phase 1 cache impact on TTFB, FCP, LCP
6. ⬜ **Plan section refactor** — separate plan for section architecture

---

## Supporting Artifacts

| Artifact                                                 | Content                                  |
| -------------------------------------------------------- | ---------------------------------------- |
| `.agent/plans/active/public-invitation-performance.md`   | Master plan, updated with final statuses |
| `.agent/plans/active/lcp-measurement-results.md`         | Phase 2 LCP measurements                 |
| `.agent/plans/active/css-measurement-results.md`         | Phase 3 CSS coverage measurements        |
| `.agent/plans/active/public-invitation-css-splitting.md` | Per-preset split implementation plan     |
