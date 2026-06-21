---
title: Public Invitation Route Performance
status: draft
created: 2026-06-20
updated: 2026-06-20
related_skills:
  - supabase
related_docs:
  - src/pages/[eventType]/[slug].astro
  - src/pages/[eventType]/[slug]/i/[shortId].astro
  - src/pages/i/[shortId].astro
  - src/layouts/Layout.astro
  - src/lib/invitation/content-resolver.ts
  - src/lib/invitation/route-personalization.ts
  - src/lib/rsvp/repositories/supabase.ts
  - src/styles/invitation.scss
  - src/styles/global.scss
  - astro.config.mjs
  - vercel.json
  - .vercel/output/static/_astro/invitation.Dn6LPABC.css
  - .vercel/output/static/_astro/Layout.DjxAMGn1.css
supersedes: []
superseded_by: []
---

# Public Invitation Route Performance

## Status

Draft — not yet approved.

## Scope

Improve production performance (FCP, LCP, TTFB) for public invitation routes, specifically
`/[eventType]/[slug]`. Optimize for measurable impact via Vercel Speed Insights. Exclude dashboard,
editor, preview, API, and redirect routes unless they directly affect public route bundles or shared
runtime behavior.

## Safety Invariants

1. **No guest-specific HTML may ever be served with a public cache header.** Any response that
   includes guest name, RSVP state, personalized content, or invite-specific data must use
   `Cache-Control: no-store, private`.
2. **If cache safety is ambiguous for any request variant, the route must fall back to
   `no-store, private`.** Never optimize at the cost of data leakage.
3. **Later phases may not start until their required measurement gates produce evidence.** No
   speculative CSS splitting, font subsetting, or animation changes without measurements first.
4. **Every phase must pass `pnpm build` and `pnpm test`.** Production database commands are never
   part of this plan.

## Phases

### Phase 1 — Cache Headers on Anonymous Public Invitations

**Evidence required before starting**: None. This phase addresses a confirmed gap (no cache headers
on `/[eventType]/[slug]`) and is safe to execute immediately. The `max-age=0` prevents the browser
cache from stale HTML while `s-maxage=60` allows the Vercel edge cache to serve fresh copies for up
to 60 seconds.

**Scope**:

- Single file: `src/pages/[eventType]/[slug].astro`
- Add conditional `Cache-Control` headers based on the `invite` query parameter
- Anonymous requests (no `invite` param):
  `public, max-age=0, s-maxage=60, stale-while-revalidate=300`
- Personalized requests (any `invite` param present): `no-store, private`
- Keep existing `no-store` on `/i/[shortId]` and `/[eventType]/[slug]/i/[shortId]` — already set, no
  change needed
- Do not touch `astro.config.mjs`, `vercel.json`, or any other file

**Explicitly out of scope**:

- ISR, adapter-level config, Vercel route header rules
- Data-layer changes (Supabase queries, repository calls, adapters)
- CSS, fonts, images, or client-side JS
- Envelope, hero, or animation timing
- Any file outside `src/pages/[eventType]/[slug].astro`

**Discriminator rule**:

```
if (!Astro.url.searchParams.has('invite')) {
  // anonymous → cacheable
} else {
  // any request with invite param → no-store, private
}
```

Use `.has()` not truthiness of `.get()` to distinguish present-but-empty from absent. If the
`invite` param exists in any form — even empty or malformed — treat it as personalized and emit
`no-store, private`.

**Validation**:

```bash
pnpm build                        # must pass (type-check + build)
pnpm test                         # unit tests must pass
pnpm agent:git-safety:check       # git safety check
```

After Vercel Preview deploy:

```bash
curl -sI $PREVIEW_URL/boda/demo-boda-jewelry-box-wedding \
  | findstr /i "cache-control"
# Expected: public, max-age=0, s-maxage=60, stale-while-revalidate=300

curl -sI "$PREVIEW_URL/boda/demo-boda-jewelry-box-wedding?invite=abc" \
  | findstr /i "cache-control"
# Expected: no-store, private

curl -sI "$PREVIEW_URL/boda/demo-boda-jewelry-box-wedding?invite=" \
  | findstr /i "cache-control"
# Expected: no-store, private (empty invite still counts as personalized)

curl -sI $PREVIEW_URL/i/abc123 | findstr /i "cache-control"
# Expected: no-store (unchanged)

curl -sI $PREVIEW_URL/boda/demo-boda-jewelry-box-wedding \
  | findstr /i "x-vercel-cache"
# Expected: MISS on first request, HIT on repeated anonymous requests
```

**Decision gate for Phase 2**:

- Phase 1 is implemented, built, and deployed to a Vercel Preview AND
- Phase 1 cache headers are validated via curl against the Preview URL AND
- The 3-day production observation window for Speed Insights impact may run in parallel with Phase 2
  measurement — Phase 2 does not block on it

---

### Phase 2 — LCP Element Identification

**Evidence required before starting**: Phase 1 complete and stable.

**Scope**: Measurement only. No production code changes.

**Artifact**: `.agent/plans/active/lcp-measurement-results.md`

**Method**:

1. Run `pnpm preview` (or deploy a preview with Phase 1)
2. Open `/[eventType]/[slug]` for each demo theme in Chrome
3. Use Chrome DevTools Performance panel with "Web Vitals" checked
4. Record for each theme:
   - LCP element (CSS selector, tag type, image vs text)
   - LCP timing in ms
   - Whether the envelope is visible at LCP time
   - Hero image dimensions, format, file size
   - FCP timing
   - Any visible layout shifts or text flashes
5. Run Lighthouse mobile simulation on the most representative demo page
6. Identify the single largest contributor to LCP delay

**Explicitly out of scope**:

- Animation timing changes
- Hero component refactors
- Envelope reveal behavior changes
- Image format or dimension changes

**Decision gates leading from Phase 2**:

- If the LCP element is **the hero image** and the primary delay is CSS render-blocking → Phase 3
  (CSS measurement) priority
- If the LCP element is **text** delayed by the envelope or animation timing → create a future
  sub-plan for animation timing adjustments _after_ CSS waste is measured (Phase 3)
- If the LCP element is **the envelope itself** → create a future sub-plan for envelope reveal
  timing _after_ CSS waste is measured (Phase 3)
- If the LCP element is **text** or **images** and fonts appear to delay it → Phase 4 (font
  measurement) priority

---

### Phase 3 — CSS Waste Measurement

**Evidence required before starting**: Phase 2 complete. Only start if Phase 2 indicates CSS size is
a meaningful contributor to LCP/FCP.

**Scope**: Measurement only. No production code changes.

**Artifact**: `.agent/plans/active/css-measurement-results.md`

**Method**:

1. Use Chrome DevTools Coverage tab on a single invitation page
2. Record for the invitation CSS chunk (`_astro/invitation.*.css`):
   - Total bytes
   - Bytes used by the current theme
   - Unused bytes (all other theme variants, unused section styles)
   - Percentage unused
3. Repeat for 3 themes with different presets
4. Identify the largest contributors to unused CSS: theme presets, section variants, or base layout

**Decision gate for CSS optimization**:

- If unused CSS > 60% for all measured themes → CSS splitting is justified
- If unused CSS < 30% → CSS is already efficient; skip CSS optimization and proceed to Phase 5
  (fonts) or close the plan
- If unused CSS 30-60% → evaluate cost vs benefit of splitting; may defer to a later cycle

**If gate passes**: Create a sub-plan with the smallest possible CSS split. Do not refactor all 106+
SCSS files at once. Options, in priority order:

1. Create one SCSS entry per theme preset that includes only the sections that theme actually uses
2. Keep shared structural CSS (`_event-wrapper.scss`, `_hero.scss` base) in a shared chunk
3. Load the correct theme CSS dynamically in `[slug].astro` based on `viewModel.theme.preset`

**Visual regression requirement**: Every demo theme must render identically before and after any CSS
change. Use manual review across all 9 demo themes.

---

### Phase 4 — Font Impact Measurement

**Evidence required before starting**: Phase 1 complete. Only start if Phase 2 or Speed Insights
data shows font loading as a meaningful contributor.

**Scope**: Measurement only. No production code changes.

**Artifact**: `.agent/plans/active/font-measurement-results.md`

**Method**:

1. From the same Lighthouse trace used in Phase 2:
   - Number of font files requested
   - Total font bytes transferred
   - Font bytes as % of total page weight
   - Time to first font download
   - Visible FOUT (flash of unstyled text) duration
2. Map each theme preset to its actually-used font families by inspecting the theme's SCSS variables
3. Determine whether 37 `@font-face` blocks are all needed or whether some families are never
   referenced by any theme

**Decision gate for font optimization**:

- If font bytes > 150 KB OR font count is using families that no theme references → optimization is
  justified
- If removing unused fonts would save < 30 KB → not worth the risk; close this phase

**If gate passes**: Create a sub-plan that:

- Removes unreferenced font families from `Layout.astro`
- Adds per-theme font loading in invitation routes only
- Preserves `font-display: swap` behavior
- Verifies every theme renders with identical typography

**Risk**: Dynamic CSS imports from `@fontsource` may not work in Astro SSR context. Verify with a
build test before committing to this approach. Alternative: use `<link rel="stylesheet">` to load
font CSS per theme.

---

### Phase 5 (Roadmap) — Supabase Query Optimization

**Evidence required before starting**: All previous phases complete AND Phase 1 caching is proven in
production AND TTFB is still a concern for anonymous pages (inspecting `x-vercel-cache: HIT` should
make this irrelevant for returning visitors).

**Deferred scope**:

- Parallelize `findPublishedBySlugAndEventType` with `findInvitationBySlug` in `content-resolver.ts`
  using `Promise.all()`

**Trade-off documented**: Running fallback queries in parallel reduces latency for the worst case
(published content not found) but increases unnecessary database traffic for the common case
(published content found, but the parallel fallback still fires). Mitigation: only parallelize when
the published query is still pending, and abort fallback if published result arrives first. In
practice, this optimization is unlikely to matter for anonymous requests once Phase 1 caching is in
place — cached responses skip the database entirely. It mainly helps the first uncached anonymous
request and personalized requests (which cannot be cached).

## Non-Goals

- No changes to `astro.config.mjs` or `vercel.json` in the first slice
- No ISR at the adapter level (cannot differentiate query params)
- No database schema changes or new migrations
- No dashboard, editor, preview, or API route changes
- No envelope reveal animation changes before LCP measurement (Phase 2)
- No hero image optimization before LCP identification (Phase 2)
- No Tailwind, framework migrations, or dependency upgrades
- No broad SCSS refactors; only targeted CSS changes if Phase 3 gate passes
- No font changes before Phase 4 gate passes
- No Supabase query changes before Phase 5
- No cleanup, code reorganisation, or renaming outside the documented scope
- No commits to `main` or `develop`; use a feature branch

## Risks

| Risk                                                 | Likelihood | Mitigation                                                                                                                                           |
| ---------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cache leakage: guest data served with public headers | Low        | Use `.has()` discriminator; always set `no-store, private` if `invite` param exists in any form; safety invariant #1 is the first check in the route |
| Vercel ignores `Cache-Control` from SSR functions    | Very low   | Vercel edge respects `Cache-Control` from serverless functions; verified in production by thousands of Astro + Vercel deployments                    |
| CSS split breaks a theme variant                     | Medium     | Visual regression check across all 9 demo themes; start with smallest split possible; easy rollback to single CSS import                             |
| Dynamic font loading fails in Astro SSR              | Medium     | Test with `pnpm build` before committing; fallback to `<link rel="stylesheet">` approach                                                             |
| Empty `?invite=` param treated as anonymous          | Low        | `.has()` catches this; only `.get()` would return empty string and be falsy                                                                          |

## Rollback Strategy

| Change                      | Rollback                                                                  |
| --------------------------- | ------------------------------------------------------------------------- |
| Phase 1 — cache headers     | Remove the two `Astro.response.headers.set()` lines; revert and re-deploy |
| Phase 3 — CSS split         | Restore single `import '@/styles/invitation.scss'`                        |
| Phase 4 — font optimization | Restore removed `@fontsource` imports in `Layout.astro`                   |

All Phase 1 changes are in a single file. Rollback is a one-line revert.

## Acceptance Criteria (plan-level)

1. Plan follows `.agent/plans/README.md` format with metadata, scope, phases, dependencies, decision
   gates, validation, rollback, non-goals, risks, and acceptance criteria.
2. Every phase is independently executable and has clear evidence gates before the next phase can
   start.
3. The first implementation slice is a single-file change with conditional `Cache-Control` headers
   only — no config, no styling, no data-layer changes.
4. Cache privacy risk is explicitly mitigated by the discriminator rule and safety invariants.
5. Later phases (CSS, fonts, Supabase queries) cannot start without their measurement gates passing.
6. Non-goals prevent broad cleanup, dashboard/editor refactors, and speculative optimizations.
7. Validation is testable via `pnpm build`, `pnpm test`, and curl against a Vercel Preview
   deployment.

## Acceptance Criteria (production)

1. **FCP mobile** < 5.0 s (measured in Vercel Speed Insights 7 days after Phase 1)
2. **LCP mobile** < 6.0 s
3. **TTFB mobile** < 1.2 s
4. **Real Experience Score mobile** > 70
5. No regressions on dashboard, editor, preview, or API routes
6. `pnpm build` and `pnpm test` pass at every phase

## First Implementation Slice

**File**: `src/pages/[eventType]/[slug].astro`

**Change**: Insert conditional `Cache-Control` headers immediately after the `inviteId` variable is
assigned (~line 22).

Logic in pseudocode:

```
if (!Astro.url.searchParams.has('invite')) {
  Astro.response.headers.set(
    'Cache-Control',
    'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
  );
} else {
  Astro.response.headers.set('Cache-Control', 'no-store, private');
}
```

**Verification**: Build passes, deploy to Vercel Preview, run curl header checks as documented in
Phase 1 validation.

**Expected impact**: Anonymous TTFB from ~2.13s (mobile) to < 0.5s on repeat visits. FCP/LCP
indirect improvement from faster HTML delivery. No change for personalized (`?invite=`) requests,
redirects, or API routes.

## Open Questions

1. Does Vercel Preview respect `stale-while-revalidate` the same way as production? The curl
   validation is simpler on Preview, but the `stale-while-revalidate` behavior may differ in
   production edge. Mitigation: validate `cache-control` header is correct in Preview; verify
   `x-vercel-cache: HIT` behavior in production after deploy.

2. Should the plan adjust the `s-maxage` or `stale-while-revalidate` values based on observed cache
   hit rate? Currently using conservative values (60s / 300s). These can be tuned after production
   data is available, but that tuning should be a separate minor revision to this plan, not a new
   plan.
