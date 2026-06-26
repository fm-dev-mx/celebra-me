---
title: Mobile Performance Baseline and Controlled Quick Wins
status: implemented
plan_type: implementation
autonomy_level: 2
created: 2026-06-25
updated: 2026-06-25
related_docs:
  - .agent/plans/active/public-invitation-performance.md
  - .agent/plans/active/public-invitation-performance-final-report.md
  - .agent/plans/active/public-invitation-section-architecture.md
  - .agent/plans/active/css-measurement-results.md
related_files:
  - src/components/home/Hero.astro
  - src/components/home/Services.astro
  - src/components/home/AboutUs.astro
  - src/components/invitation/Interlude.astro
---

# Mobile Performance Baseline and Controlled Quick Wins

## Scope

This pass follows the user's requested order:

1. Measure mobile baseline before code changes.
2. Implement only low-risk quick wins.
3. Produce a lightweight operational performance spec.
4. Do not commit, deploy, or implement major refactors.

## Prior Performance History Reviewed

Relevant commits/docs show that public invitation performance already had substantial work:

- `7fd518e3` / `cc4224d0` — per-preset CSS split.
- `fb252f2a` and `4e43a215` — section CSS split work.
- `a25830dc` — consolidated section CSS bundles.
- `12ba7d22` — documented consolidated split results.
- `fbb680ba` documented in performance reports — fixed a P0 blank public invitation route caused by
  passing `import.meta.glob(...?url)` module objects into stylesheet href attributes instead of
  using `.default`.

Important constraints from existing performance docs:

- Production/current build already uses a safer consolidated structure: Layout CSS + base invitation
  CSS + active preset CSS + active preset section bundle CSS.
- Avoid returning to the failed pattern where section splitting produced 5–13 render-blocking app
  stylesheets per route.
- Any future `import.meta.glob(...?url)` usage must use `Record<string, { default: string }>` and
  read `mod.default`.
- Full CSS architecture refactors are not part of this quick-win pass.

## Phase 0 — Mobile Baseline

Method:

- Tool: Playwright Chromium mobile emulation, 390x844 viewport, iPhone-like UA.
- Target: production `https://www.celebra-me.com` before local code changes.
- Evidence JSON: `.agent/tmp/performance-baseline/baseline.json`.
- Screenshots: `.agent/tmp/performance-baseline/*-mobile.png`.
- Caveat: `PerformanceResourceTiming.initiatorType` reported some font files as `css`; top-resource
  inspection was used to separate real CSS chunks from font files where relevant.

| Route                                     |    FCP |    LCP | LCP element/source                                     | CSS transfer / decoded | JS transfer | Image transfer | Screenshot                                                                  |
| ----------------------------------------- | -----: | -----: | ------------------------------------------------------ | ---------------------: | ----------: | -------------: | --------------------------------------------------------------------------- |
| `/`                                       | 3296ms | 3296ms | `IMG.logo--white` header logo via Vercel image `q=100` |           25KB / 116KB |        12KB |         1354KB | `.agent/tmp/performance-baseline/landing-mobile.png`                        |
| `/xv/xareni-iyarit`                       | 1080ms | 1080ms | `P`: “Toca para abrir mi invitación”                   |          132KB / 399KB |        12KB |          164KB | `.agent/tmp/performance-baseline/xv-xareni-iyarit-mobile.png`               |
| `/xv/demo-xv-editorial`                   | 1224ms | 1224ms | `A.event-header__title`: “V·N”                         |           96KB / 332KB |        12KB |          226KB | `.agent/tmp/performance-baseline/demo-xv-editorial-mobile.png`              |
| `/boda/demo-boda-jewelry-box-wedding`     | 1160ms | 1160ms | `P`: “Toca para abrir nuestra invitación”              |           87KB / 283KB |        12KB |          242KB | `.agent/tmp/performance-baseline/demo-boda-jewelry-box-wedding-mobile.png`  |
| `/bautizo/demo-bautismo-angelic-presence` | 1084ms | 1084ms | `P`: “Bautismo de María”                               |          127KB / 368KB |        12KB |          182KB | `.agent/tmp/performance-baseline/demo-bautismo-angelic-presence-mobile.png` |
| `/cumple/demo-cumple-luxury-hacienda`     | 1320ms | 1320ms | `P`: “Toca el sello para abrir la invitación”          |           97KB / 332KB |        12KB |          220KB | `.agent/tmp/performance-baseline/demo-cumple-luxury-hacienda-mobile.png`    |

### Baseline Findings

1. Landing has the largest image transfer in mobile baseline: ~1.35MB images.
2. Landing hero background used the desktop Unsplash source through Vercel image optimization,
   ~352KB transferred in baseline.
3. Landing social avatars and service/about images were rendered through Vercel image optimization
   at `q=100`; they are photographs or raster images, not logos/icons.
4. Public invitation LCP in measured routes was usually text/reveal/header content, not
   hero/interlude images.
5. Public invitation interlude images were still being marked `eager` + `fetchpriority=high` when
   `interludeIndex === 1`, even though baseline showed the first interlude below the initial
   viewport (~2000–3200px). This can compete with actual above-the-fold content.
6. CSS is still a large structural concern for invitations, but existing docs show it already went
   through split/consolidation. Further CSS work belongs to a later refactor phase, not this
   quick-win pass.

## Phase 1 — Controlled Quick Wins Implemented

### Files Modified

- `src/components/home/Hero.astro`
- `src/components/home/Services.astro`
- `src/components/home/AboutUs.astro`
- `src/components/invitation/Interlude.astro`

### Changes

1. Landing hero now uses the existing `data.backgroundImage.mobileUrl` inside a mobile `<source>`.
   - This preserves the premium desktop image for desktop.
   - Mobile receives the already-curated `w=800&h=1200&q=80` image instead of the desktop crop.
   - Added `fetchpriority="high"`, `loading="eager"`, and `decoding="async"` to the hero image.

2. Landing social avatars now set explicit low-cost optimization parameters.
   - `quality={75}`
   - `widths={[40, 80]}`
   - `sizes="40px"`
   - `loading="lazy"`, `decoding="async"`

3. Landing service/about photographs now set quality and responsive constraints.
   - `quality={80}`
   - `widths={[320, 480, 640]}`
   - conservative `sizes` matching mobile/card layouts.

4. Invitation interlude images are no longer prioritized as initial LCP candidates.
   - `loading="lazy"`
   - `fetchpriority="low"`
   - `quality={80}`
   - Rationale: measured routes show interludes below the mobile fold and LCP is text/header/reveal,
     not interlude imagery.

### Explicit Non-Changes

- No global image quality reduction.
- No SVG/logo/icon quality changes.
- No font preloads added.
- No indiscriminate font removal.
- No CSS splitting or stylesheet architecture changes.
- No dashboard JS bundle changes.
- No `import.meta.glob` resolver changes.
- No commits and no deploy.

## Validation

### Build

Command:

```bash
pnpm build
```

Result: passed.

Notable output:

- `astro check`: 0 errors; existing deprecation hint for `ZodIssueCode`.
- Vercel adapter build completed successfully.
- Static prerender and server bundle completed successfully.

### Post-change Local Landing Measurement

Because `astro preview` is unsupported by the `@astrojs/vercel` adapter, `dist/client` was served
locally for the static landing route only.

Command evidence:

- `python -m http.server 4321 --bind 127.0.0.1 -d dist/client`
- `node .agent/tmp/perf-after-landing-local.mjs`

Local mobile landing result:

- Hero image current source:
  `https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=800&h=1200`
- Hero image transfer: ~68KB locally measured by browser.
- Baseline production hero image transfer: ~352KB.
- Estimated hero image transfer reduction: ~284KB.
- LCP in local static measurement remained header logo (`IMG.logo--white`) because the static local
  server has very different network/cache behavior than production; treat this as resource
  verification, not lab-score replacement.
- Post-change screenshot: `.agent/tmp/performance-baseline/landing-mobile-after-local.png`.

### Current Build Asset Notes

Largest build assets remain:

- CSS: `DashboardLayout.*.css` ~208KB, `invitation.*.css` ~185KB, plus per-theme chunks.
- JS: dashboard/editor/MFA bundles remain the largest, outside this phase.
- Source images: several original PNG/WebP assets remain large in `dist/client/_astro`; runtime
  Vercel image optimization reduces delivered variants where `Image`/`OptimizedImage` is used.

## Phase 2 — Lightweight Performance Spec

### Critical Routes

Public mobile performance should be tracked on:

1. `/` landing.
2. `/xv/xareni-iyarit` real invitation.
3. `/xv/demo-xv-editorial`.
4. `/boda/demo-boda-jewelry-box-wedding`.
5. `/bautizo/demo-bautismo-angelic-presence`.
6. `/cumple/demo-cumple-luxury-hacienda`.

### Budgets / Targets

Recommended mobile budgets per public route:

| Resource               |                 Landing target |                        Invitation target | Notes                                                                                      |
| ---------------------- | -----------------------------: | ---------------------------------------: | ------------------------------------------------------------------------------------------ |
| Initial image transfer |                        < 500KB |                    < 300KB before reveal | Hero/LCP image must be individually measured.                                              |
| LCP image              | < 150KB preferred, < 250KB max | Only prioritize if actual LCP/above-fold | Premium hero exceptions require visual review.                                             |
| CSS transfer           |                         < 80KB |                                  < 140KB | Invitations may exceed landing because of theme chunks; avoid increasing stylesheet count. |
| CSS decoded            |                        < 180KB |    < 420KB current ceiling; reduce later | Big reductions belong to CSS refactor phase.                                               |
| JS transfer            |                  < 40KB public |                 < 40KB public invitation | Dashboard/editor budgets are separate.                                                     |
| Fonts transfer         |           < 120KB public route |                                  < 120KB | Preload max 1–2 critical fonts only with evidence.                                         |
| CLS                    |                          < 0.1 |                                    < 0.1 | Current measured CLS is 0.                                                                 |
| Mobile LCP             |                  < 2.5s target |                            < 2.5s target | Use Speed Insights P75 when enough data exists.                                            |

### Rules for Future Invitations/Themes/Sections

1. Above-the-fold images:
   - Identify the actual LCP element before adding preload/fetchpriority.
   - Use `fetchpriority="high"` only for the actual or likely LCP image.
   - Do not mark below-the-fold interludes/galleries as eager/high.

2. Photographic assets:
   - Default runtime quality should generally be 75–80 for non-hero photos.
   - Premium hero portraits/backgrounds may use 80–90 only after visual check.
   - Never apply raster image quality rules to SVGs/logos/icons.

3. Fonts:
   - `@fontsource` includes `font-display: swap`; verify before adding custom declarations.
   - Do not preload all fonts. Consider only 1–2 above-the-fold font files for a specific critical
     route.
   - Any per-theme font loading change needs visual QA across all themes.

4. CSS:
   - Keep the consolidated public invitation stylesheet pattern: shared base + active preset +
     active section bundle.
   - Avoid increasing render-blocking stylesheet count.
   - Any future section split must preserve `.default` glob guardrails and check for empty-body SSR
     failures.

5. Vercel/Astro risks:
   - `@astrojs/vercel` does not support `astro preview`; use production/preview deployments for full
     SSR performance verification.
   - Vercel Image Optimization URLs and local static serving differ; local static measurement
     validates markup/resource selection, not exact production byte costs.
   - `import.meta.glob(...?url)` returns module objects, not strings.

## Phase 3 — Deferred Refactors Only

Do not implement without explicit approval:

1. CSS splitting by preset/section beyond current consolidation.
2. Dead CSS reduction/component override audit.
3. Separation of public styles from dashboard/admin styles.
4. Dashboard JS bundle review (`MfaSetupBehavior`, `client`, `InvitationEditor`,
   `use-reduced-motion`).
5. Per-theme/per-section asset optimization pipeline.
6. Font loading architecture changes.

## Open Risks / Trade-offs

- The landing mobile hero visual should be reviewed because mobile now uses the curated mobile crop
  (`w=800&h=1200&q=80`) instead of the desktop crop. This is intended but should be visually
  approved.
- Interlude images now load lazy/low priority. This is correct for measured routes, but if a future
  theme places an interlude immediately after a very short above-fold section, priority may need
  route-specific handling.
- Full post-change SSR route performance must be verified on a Vercel Preview/Production deployment
  because local `astro preview` is unavailable with the Vercel adapter.
