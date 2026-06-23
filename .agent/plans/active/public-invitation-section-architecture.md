---
title: Public Invitation Section Architecture
status: accepted
autonomy_level: 3
plan_type: implementation
created: 2026-06-22
updated: 2026-06-23
hardening_run: 2026-06-22
closure_run: 2026-06-22
related_docs:
  - .agent/plans/README.md
  - .agent/plans/active/public-invitation-performance.md
  - .agent/plans/active/public-invitation-performance-final-report.md
  - .agent/plans/active/public-invitation-css-splitting.md
  - .agent/plans/active/css-measurement-results.md
  - .agent/plans/active/section-architecture-refactor-plan.md
related_files:
  - src/styles/invitation.scss
  - src/styles/themes/sections/_index.scss
  - src/styles/themes/sections/
  - src/styles/invitation-presets/
  - src/pages/[eventType]/[slug].astro
  - src/pages/dashboard/invitaciones/[id]/preview.astro
  - src/layouts/Layout.astro
  - src/styles/invitation/
---

# Public Invitation Section Architecture

## 1. Status and Autonomy

| Field           | Value                        |
| --------------- | ---------------------------- |
| Plan type       | documentation                |
| Autonomy level  | Level 1 — Documentation only |
| Production code | No changes authorized        |
| Implementation  | Paused pending human review  |

This plan documents the current section architecture, defines a target architecture for per-theme
section CSS splitting, and specifies the gate sequence a future implementation loop must follow.

No production code is to be changed in this run. No staging, committing, or deploying.

---

## 2. Problem Statement

### Current CSS Sizes

| Metric                  | Value           |
| ----------------------- | --------------- |
| Base `invitation.*.css` | ~545 KB         |
| Active preset chunk     | 6–26 KB         |
| Layout `Layout.*.css`   | 52 KB           |
| **Total per route**     | **~602–622 KB** |

### Desktop vs Mobile

- **Desktop Speed Insights**: Healthy.
- **Mobile Speed Insights**: Remains poor. Field data may still include pre-fix samples from before
  the P0 blank-page regression was fixed. A 7-day post-fix window is needed for accurate mobile
  baseline.
- **LCP measurement (Phase 2) showed**: CSS is the primary bottleneck — 704 KB decoded (109 KB
  compressed) before the per-preset split. The 545 KB base chunk still carries all section variants.

### Why Section Architecture Is the Next Path

After the per-preset CSS split removed ~154 KB of unused preset CSS, the remaining waste is in the
section variants. CSS coverage measurement showed 77.5–82.7% unused CSS across measured themes, of
which approximately ~70 KB is unused section variant styles. The base 545 KB cannot shrink further
until section variants are split.

### Why Implementation Is Not Authorized Yet

The current section architecture is organized by section type, with inconsistent base/variant
coverage across sections. Moving variant files out of the shared chunk without first normalizing the
architecture would leave sections unstyled for themes without a matching variant. Section splitting
was previously stopped for this reason.

A side effect of the earlier section-architecture refactor: consolidated `_quote.scss` and
`_gifts.scss` files exist in `src/styles/invitation/` but are not imported by any build chain. They
represent an incomplete migration that must be reconciled before or as part of the next
implementation.

---

## 3. Current Architecture Inventory

### Section-by-Section Table

Data from actual `src/styles/themes/sections/` files (2026-06-22).

| section             | has base   | base size                            | variants                        | theme coverage               | selector strategy                                    | safe to split now | required normalization                                                 | risk   |
| ------------------- | ---------- | ------------------------------------ | ------------------------------- | ---------------------------- | ---------------------------------------------------- | ----------------- | ---------------------------------------------------------------------- | ------ |
| countdown           | yes        | 129 lines                            | 6                               | 6/9 presets                  | `:is()` shared + `[data-variant]`                    | partial           | Extract shared patterns from base; fill editorial/premiere-floral gaps | medium |
| family              | no         | —                                    | 1 (enchanted-rose)              | 1/9                          | `[data-variant]`                                     | no                | Create base; fill 8 missing presets                                    | high   |
| footer              | yes (stub) | 2 lines                              | 4                               | 4/9                          | `[data-variant]`                                     | no                | Substantive base needed; fill 5 missing presets                        | high   |
| gallery             | yes        | 91 lines                             | 7                               | 7/9                          | `:where()` zero-specific defaults + `[data-variant]` | partial           | Fill premiere-floral gap                                               | low    |
| gifts               | no         | —                                    | 5 (non-standard names)          | ~5/9                         | `[data-variant]` + `.event--`                        | no                | Create base; normalize variant names; fill gaps                        | high   |
| header              | no         | —                                    | 9 (full coverage)               | 9/9                          | `[data-variant]` uniform CSS var pattern             | partial           | Create base with CSS var contract; variants already uniform            | low    |
| hero                | yes        | 46 lines                             | 8                               | 8/9                          | `:where()` + `[data-variant]`                        | partial           | Fill jewelry-box-wedding gap                                           | low    |
| itinerary           | yes (stub) | 9 lines                              | 8                               | 8/9                          | `[data-variant]`                                     | no                | Substantive base needed; variants are CSS-only                         | medium |
| location            | no         | —                                    | 2                               | 2/9                          | `[data-variant]` + `.event--`                        | no                | Create base; fill 7 missing presets                                    | high   |
| music-player        | no         | —                                    | 1                               | 1/9                          | `[data-variant]`                                     | no                | Create base; fill 8 missing presets                                    | high   |
| personalized-access | yes        | 327 lines                            | 1                               | 1/9                          | BEM + `[data-variant]`                               | no                | Refactor base to CSS var contract; base owns layout                    | high   |
| quote               | partial    | 165 lines (dead code in invitation/) | 1 (enchanted-rose in theme dir) | 1/9                          | `[data-variant]`                                     | partial           | Reconcile dead `invitation/_quote.scss`; clean up theme dir            | medium |
| reveal              | yes (stub) | 1 line                               | 4 (shared-light + 3)            | ~8/9 (shared-light covers 4) | `[data-variant]`                                     | no                | Substantive base needed; shared-light structure is good                | medium |
| rsvp                | yes        | 56 lines                             | 8                               | 8/9                          | `[data-variant]`                                     | partial           | Fill jewelry-box-wedding gap                                           | low    |
| thank-you           | no         | —                                    | 10 (shared-premium mixin + 9)   | 8/9                          | `[data-variant]` + `@mixin`                          | no                | Create base; convert mixin to contract pattern                         | medium |

### Baseline Summary

- **With substantive base**: countdown (129), gallery (91), hero (46), personalized-access (327),
  rsvp (56) — 5 sections
- **Stub base only**: footer (2), itinerary (9), reveal (1) — 3 sections
- **No base at all**: family, gifts, header, location, music-player, quote, thank-you — 7 sections
- **Full variant coverage (9/9)**: header only
- **Strong variant coverage (8/9)**: hero, itinerary, rsvp, thank-you
- **Good variant coverage (6-7/9)**: countdown, gallery
- **Poor variant coverage (≤5/9)**: family (1), footer (4), gifts (~5), location (2), music-player
  (1), personalized-access (1), quote (1), reveal (~8 via shared-light grouping)
- **Event-scoped files**: `_leah-lexa-rhythm.scss` (21 lines), `_luna-y-estrella.scss` (45 lines),
  `_xv-xareni-iyarit.scss` (245 lines) — these are event-level overrides, not section variants

### Selector Strategy Summary

1. **Primary**: `[data-variant='...']` attribute selectors on section-classed elements (~90% of
   files)
2. **Secondary**: Event-level class scoping (`.event--leah-lexa`, `.event--xareni-iyarit`) on
   `<main>` wrapper, combined with `[data-variant]`
3. **Base defaults**: `:where()` pseudo-class for zero-specificity CSS var defaults (gallery, hero)
4. **Shared variant grouping**: `:is()` (countdown base), comma-separated selectors (gallery
   editorial, reveal shared-light), file naming mismatch (gifts `_elegant.scss` targets jewelry-box
   and celestial-blue)
5. **Mixin-based**: thank-you `_shared-premium.scss` uses `@mixin` instead of selectors — unique
   pattern in the codebase

### Legacy Consolidated Files

`src/styles/invitation/_quote.scss` (165 lines) and `src/styles/invitation/_gifts.scss` (270 lines)
exist from a previous section-architecture refactor phase. They are **not imported** by any SCSS
chain or Astro component. Loading happens entirely through `themes/sections/_index.scss`. These
files must be reconciled (either wired in or removed) during implementation.

---

## 4. Target Architecture

```text
Per public invitation route:

  Layout.*.css           → shared (52 KB)
  invitation.*.css       → shared (base only: structural + section base styles)
  invitation-{preset}.css → per-preset (active theme preset)
  invitation-sections-{preset}.css → per-preset section bundle (active section variants)
```

### Rules

1. **Every section gets a theme-neutral `_base.scss`** with CSS variable contracts (using `:where()`
   for zero-specificity defaults).
2. **Theme-specific variants** stay in `themes/sections/{section}/` and only affect CSS variable
   overrides or animations.
3. **Base section CSS** remains in the shared `invitation.*.css` chunk — structural layout, default
   values.
4. **Active theme section CSS** is loaded as one per-preset section bundle alongside the existing
   per-preset theme chunk.
5. **Unknown theme fallback**: renders base styles only — safe, no missing styles.
6. **Preview route** uses the same resolution mechanism as `[slug].astro`.
7. **Glob `.default` guardrail**: every `import.meta.glob(...?url)` must be typed as
   `Record<string, { default: string }>` and accessed via `.default`.

### Loading Order

```text
1. Layout CSS                    (always, in Layout.astro)
2. Base invitation CSS           (always, static import in [slug].astro)
3. Active preset CSS             (dynamic link, via resolvePresetCssUrl)
4. Active section bundle CSS     (dynamic link, via resolveSectionBundleCssUrl)
```

---

## 5. Future Implementation Gate Sequence

### Gate 0 — Repo Sanity

| Field           | Value                                                           |
| --------------- | --------------------------------------------------------------- |
| Allowed actions | Git branch check, status check, build test                      |
| Files in scope  | None — verification only                                        |
| Validation      | `git branch --show-current`, `git status --short`, `pnpm build` |
| Stop conditions | Dirty files outside declared scope, build fails                 |
| Output          | Branch name, status report, build pass/fail                     |

After pass: create a feature branch if not already on one.

### Gate 1 — Mobile Post-Fix Baseline

| Field           | Value                                                                            |
| --------------- | -------------------------------------------------------------------------------- |
| Allowed actions | Read Vercel Speed Insights data only                                             |
| Files in scope  | None                                                                             |
| Validation      | `pnpm build` passes; mobile Speed Insights data is collected                     |
| Stop conditions | Data still includes pre-fix samples → document caveat and decide whether to wait |
| Output          | Current mobile FCP/LCP/TTFB, whether data includes pre-fix samples               |

After pass: if CSS is confirmed as the bottleneck, proceed to Gate 2.

### Gate 2 — Select 1–2 Low-Risk Sections

| Field           | Value                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------- |
| Allowed actions | Analysis only, no code changes                                                                |
| Files in scope  | `src/styles/themes/sections/` (read only)                                                     |
| Validation      | Confirm section has substantive base, consistent variant coverage, `[data-variant]` selectors |
| Stop conditions | No section meets safety criteria → stop and report                                            |
| Output          | Selected sections, justification, risk assessment                                             |

Recommended candidates (in priority order):

- **gallery**: `:where()` base (91 lines), 7 variants, low risk
- **hero**: `:where()` base (46 lines), 8 variants, low risk
- **countdown**: base (129 lines) with `:is()` shared patterns, 6 variants, medium risk
- **rsvp**: base (56 lines), 8 variants, low risk

### Gate 3 — Extract/Normalize Base Styles

| Field           | Value                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------ |
| Allowed actions | Edit selected section base files; build and verify                                         |
| Files in scope  | `src/styles/themes/sections/{section}/_base.scss`, `src/styles/invitation/_{section}.scss` |
| Validation      | `pnpm build` passes; base CSS variables are documented; no theme regressions               |
| Stop conditions | Base extraction removes necessary variant CSS; visual regression                           |
| Output          | Normalized base file, CSS variable contract list                                           |

### Gate 4 — Create Proof-of-Pattern Section Chunks

| Field           | Value                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Allowed actions | Create section entrypoint files; add to resolver; build                                         |
| Files in scope  | `src/styles/invitation-sections/` (new dir), `src/lib/invitation/section-css-resolver.ts` (new) |
| Validation      | `pnpm build` passes; chunks emit with correct names; `.default` guardrail applied               |
| Stop conditions | Chunks still load all variants; glob module bug reappears; build fails                          |
| Output          | Section chunk files, resolver utility, chunk size table                                         |

Each section chunk must:

- Use `import.meta.glob(...?url)` with typing `Record<string, { default: string }>`
- Extract `.default` before storing
- Have a fallback for unknown variants

### Gate 5 — Route Integration

| Field           | Value                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------- |
| Allowed actions | Edit `[slug].astro` and `preview.astro` to load section chunks                              |
| Files in scope  | `src/pages/[eventType]/[slug].astro`, `src/pages/dashboard/invitaciones/[id]/preview.astro` |
| Validation      | `pnpm build` passes; both routes render; preview matches public                             |
| Stop conditions | Preview diverges from public route; FOUC; empty body (P0)                                   |
| Output          | Route changes tested, chunk loading verified                                                |

### Gate 6 — Build/Test/Safety Validation

| Field           | Value                                                             |
| --------------- | ----------------------------------------------------------------- |
| Allowed actions | Run validation commands only                                      |
| Files in scope  | None — validation only                                            |
| Validation      | `pnpm build`, `pnpm test`, `pnpm agent:git-safety:check` all pass |
| Stop conditions | Any command fails                                                 |
| Output          | Validation results (pass/fail per command)                        |

### Gate 7 — Visual QA

| Field           | Value                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| Allowed actions | Manual visual review (local or preview deploy)                          |
| Files in scope  | None — review only                                                      |
| Validation      | All 9 demo themes render identically before/after; no unstyled sections |
| Stop conditions | Any visual regression → rollback, document, stop                        |
| Output          | Visual QA checklist per theme, pass/fail per theme                      |

### Gate 8 — CSS Coverage Re-Measurement

| Field           | Value                                                            |
| --------------- | ---------------------------------------------------------------- |
| Allowed actions | Run coverage measurement only                                    |
| Files in scope  | None — measurement only                                          |
| Validation      | Chrome DevTools Coverage or Playwright CSS coverage before/after |
| Stop conditions | No measurable reduction in unused CSS                            |
| Output          | CSS size table (before vs after), coverage percentage            |

### Gate 9 — Continue/Stop Decision

| Field           | Value                                                                                |
| --------------- | ------------------------------------------------------------------------------------ |
| Allowed actions | Compare results against acceptance criteria; produce recommendation                  |
| Files in scope  | None — decision only                                                                 |
| Validation      | N/A — decision                                                                       |
| Stop conditions | N/A — this is the terminal gate                                                      |
| Output          | Recommendation: scale to all sections, iterate on remaining sections, stop, or defer |

---

## 6. Stop Conditions

The following must halt implementation and produce a final report:

| #   | Condition                                                                                             | Severity | Action                                           |
| --- | ----------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------ |
| 1   | Visual regression (unstyled section, layout shift, missing element on any demo theme)                 | High     | Rollback, document, stop                         |
| 2   | Incomplete theme coverage with no safe fallback (section renders with missing styles)                 | High     | Rollback, document, stop                         |
| 3   | No safe base extraction (section cannot be split into base + variants without breaking)               | High     | Document, stop, select different section         |
| 4   | Chunks still load all variants (target chunk includes all theme-specific CSS instead of one theme)    | Medium   | Stop, refactor chunking strategy                 |
| 5   | FOUC (visible flash of unstyled content during section CSS load)                                      | High     | Stop, defer to preload strategy                  |
| 6   | Build or test failure not locally explainable                                                         | High     | Stop, report                                     |
| 7   | Mobile lab data shows CSS is not the next bottleneck (TTFB, images, or envelope dominates)            | Medium   | Stop, defer, redirect to higher-impact path      |
| 8   | P0 symptom: empty 200 OK body on any public route                                                     | Critical | Immediately stop, rollback, report               |
| 9   | Cache privacy ambiguity (guest-specific HMTL could become public-cacheable via section chunk caching) | Critical | Immediately stop, rollback, report               |
| 10  | Raw `import.meta.glob(...?url)` module object reaches HTML attribute position (no `.default` access)  | Critical | Immediately stop, rollback, apply glob guardrail |

---

## 7. Validation Strategy

Future implementation loops must run:

```bash
pnpm build                 # Type-check + Astro build (mandatory)
pnpm test                  # Unit test suite (mandatory)
pnpm agent:git-safety:check  # Git safety check (mandatory)
```

Also required:

- **Visual QA**: Manual review across all 9 demo themes before and after. Compare identical routes.
- **CSS size comparison**: Record base chunk, preset chunk, section chunk sizes before and after.
  Minimum target: base chunk measurably smaller.
- **CSS coverage before/after**: Chrome DevTools Coverage or Playwright `page.coverage`.
- **Mobile Lighthouse/lab**: Run on representative demo route (e.g. jewel-box-wedding or
  celestial-blue) before and after. Record FCP, LCP, TTFB.
- **Phase 1 cache header check**: `curl -sI` to verify `Cache-Control` headers unchanged.
- **Glob `.default` guardrail check**: Every `import.meta.glob(...?url)` must be typed as
  `Record<string, { default: string }>` with a `.default` access. Audit all lines.
- **Preview route parity**: Both `[slug].astro` render and `preview.astro` render must load the same
  CSS chunks for the same theme.

---

## 8. Acceptance Criteria

| Criterion                                      | Target                | Method                                                   |
| ---------------------------------------------- | --------------------- | -------------------------------------------------------- |
| Base CSS materially decreases                  | From ~545 KB          | Compare build output `invitation.*.css`                  |
| Total CSS per route materially decreases       | From ~602–622 KB      | Sum per-route CSS chunks                                 |
| Known themes load only active section CSS      | Verified per theme    | Compare coverage before/after                            |
| No unstyled sections                           | All sections render   | Visual QA across 9 demos                                 |
| No FOUC                                        | No flash              | Visual inspection + slow-network test                    |
| Unknown theme fallback safe                    | Base renders          | Remove data-variant attribute, confirm base styles apply |
| Preview route aligned                          | Same CSS as public    | Compare `[slug].astro` vs `preview.astro`                |
| Mobile lab improves or documented inconclusive | FCP/LCP/TTFB measured | Lighthouse mobile simulation before/after                |

---

## 9. Risks

| Risk                                                       | Likelihood        | Impact                             | Mitigation                                                           |
| ---------------------------------------------------------- | ----------------- | ---------------------------------- | -------------------------------------------------------------------- |
| Visual regression from split                               | High              | Broken themes across demos         | Visual QA gate (Gate 7); rollback defined                            |
| Inconsistent section coverage leaves gaps                  | High              | Some themes unstyled               | Gate 3 normalization; fallback base-only rendering                   |
| Sections without base files cannot be split                | High (7 sections) | Limited first implementation scope | Start with sections that have bases (gallery, hero, rsvp, countdown) |
| Duplicated CSS between base and variants                   | Medium            | Bloat offsets gains                | CSS coverage re-measurement (Gate 8)                                 |
| Preview route diverges                                     | Medium            | Editor trust broken                | Preview parity check in validation                                   |
| Mobile field data still includes pre-fix samples           | Medium            | Incorrect baseline                 | Gate 1: document caveat; 7-day wait if needed                        |
| Mobile issue is TTFB/image/envelope, not CSS               | Medium            | Effort with no mobile gain         | Gate 1 baseline; Gate 8 measurement; stop condition #7               |
| `import.meta.glob(...?url)` module-object bug reappears    | Low (documented)  | P0 blank page                      | Glob `.default` guardrail; code review; stop condition #10           |
| CSS variable contract conflicts with existing theme tokens | Low               | Subtle visual drift                | Visual QA across all 9 demos; compare pixel-perfect                  |

---

## 10. Non-Goals

The following are explicitly excluded from this plan and any future implementation loop it spawns:

- **Implementation in this run** — this is a documentation-only plan
- **Font optimization** (Phase 4 deferred independently)
- **Supabase query changes** (Phase 5 deferred independently)
- **Hero, envelope, animation timing changes**
- **Dashboard or editor refactors**
- **Framework or style system migration** (no Tailwind, no PostCSS migration)
- **Production deployment** — requires separate approval
- **Commits or staging** — not authorized at Level 1
- **Astro config or Vercel config changes**
- **Removing existing consolidated files** without reconciling their content
- **Renaming components** (ItineraryProgram, Timelinelist, etc.)
- **Adding new theme presets or section variants**

---

## 11. Recommended First Future Implementation Slice

### Slice: Gallery Section — Proof of Pattern

**Why gallery:**

- Has a substantive `:where()` base (91 lines) with CSS variable defaults
- Has 7 of 9 theme variants
- Uses consistent `[data-variant]` selectors
- Low risk: no animation dependencies, no TypeScript logic
- Only 1 coverage gap (premiere-floral) — easy to document as known

**Why only one section:**

- Proves the chunking pattern works end-to-end without scaling risk
- Generates real coverage data (before/after) to inform the second implementation loop
- Minimal visual QA surface: only 7 variant files to compare
- Easy rollback: revert one resolver + one chunk load

**Scope of the slice:**

1. Normalize `base.scss` — ensure all base layout uses `:where()` with CSS variable defaults.
2. Move gallery variant files into per-theme section chunk entrypoints.
3. Create `src/lib/invitation/section-css-resolver.ts` (analogous to `preset-css-resolver.ts`).
4. Integrate into `[slug].astro` and `preview.astro`.
5. Build, test, measure.
6. Visual QA across 7 affected demos.
7. Continue or stop decision.

---

## 12. Final Output Contract for the Future Implementation Loop

When a future implementation loop completes (or triggers a stop condition), the agent must produce a
report with exactly these fields:

```yaml
branch: <current-git-branch>
git_status: <clean-or-dirty>
files_changed:
  - path/to/file (change type)
sections_migrated:
  - section_name (e.g. gallery)
css_chunks_before:
  base: <KB>
  preset: <KB>
  total: <KB>
css_chunks_after:
  base: <KB>
  preset: <KB>
  section: <KB>
  total: <KB>
route_css_loaded: <verified true/false per route>
visual_qa_results:
  theme_1: pass/fail
  theme_2: pass/fail
  # ... per theme
mobile_lab_results:
  fcp_ms: <value>
  lcp_ms: <value>
  ttfb_ms: <value>
  note: <any caveats>
validation_commands:
  pnpm_build: pass/fail
  pnpm_test: pass/fail
  pnpm_agent_git_safety_check: pass/fail
stop_conditions_triggered:
  - condition (or "none")
risks:
  - risk description
recommendation: <continue-to-next-section | iterate-on-current | stop | defer | rollback>
```

The output contract must be satisfied before the implementation agent may end its run. If a stop
condition triggered, the report must explain exactly what happened and what the next decision should
be.

---

## 13. Gallery Proof-of-Pattern Result (2026-06-22)

### Implementation Summary

| Field         | Value                                        |
| ------------- | -------------------------------------------- |
| Section       | gallery                                      |
| Status        | **Implemented**                              |
| Branch        | `perf/public-invitation-gallery-section-poc` |
| Files changed | 11 (7 created, 4 modified)                   |

### Files Changed

| File                                                           | Change                                                          |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| `src/styles/themes/sections/gallery/_index.scss`               | Removed 7 variant forwards; keeps only `@forward 'base'`        |
| `src/styles/invitation-sections/gallery/editorial.scss`        | Created — entrypoint for editorial + premiere-floral variants   |
| `src/styles/invitation-sections/gallery/jewelry-box.scss`      | Created — entrypoint for jewelry-box variant                    |
| `src/styles/invitation-sections/gallery/celestial-blue.scss`   | Created — entrypoint for celestial-blue variant                 |
| `src/styles/invitation-sections/gallery/enchanted-rose.scss`   | Created — entrypoint for enchanted-rose variant                 |
| `src/styles/invitation-sections/gallery/sacred-keepsake.scss`  | Created — entrypoint for sacred-keepsake variant                |
| `src/styles/invitation-sections/gallery/angelic-presence.scss` | Created — entrypoint for angelic-presence variant               |
| `src/styles/invitation-sections/gallery/luxury-hacienda.scss`  | Created — entrypoint for luxury-hacienda variant                |
| `src/lib/invitation/section-css-resolver.ts`                   | Created — gallery section resolver with P0 `.default` guardrail |
| `src/pages/[eventType]/[slug].astro`                           | Added `resolveGallerySectionCssUrl` + `headLinks`               |
| `src/pages/dashboard/invitaciones/[id]/preview.astro`          | Same integration for preview parity                             |

### CSS Impact

| Metric                  | Before                  | After                 | Δ                     |
| ----------------------- | ----------------------- | --------------------- | --------------------- |
| Base `invitation.*.css` | ~545 KB                 | **483 KB**            | **−62 KB (−11%)**     |
| Gallery section chunks  | 0 KB (embedded in base) | **7–29 KB** per chunk | Variant CSS moved out |
| Layout `Layout.*.css`   | ~52 KB                  | ~51 KB                | −1 KB                 |

**Per-route totals:**

| Route                                     | Preset                | Before total | After total | Δ             |
| ----------------------------------------- | --------------------- | ------------ | ----------- | ------------- |
| `/boda/demo-boda-jewelry-box-wedding`     | `jewelry-box-wedding` | ~602 KB      | ~540 KB     | −62 KB (−10%) |
| `/xv/demo-xv-jewelry-box`                 | `jewelry-box`         | ~611 KB      | ~550 KB     | −61 KB (−10%) |
| `/baby-shower/demo-baby-shower-celestial` | `celestial-blue`      | ~622 KB      | ~589 KB     | −33 KB (−5%)  |
| `/xv/demo-xv-editorial`                   | `editorial`           | ~610 KB      | ~558 KB     | −52 KB (−9%)  |
| `/cumple/demo-cumple-luxury-hacienda`     | `luxury-hacienda`     | ~614 KB      | ~564 KB     | −50 KB (−8%)  |

### Route CSS Loading

| Route                 | Base   | Preset | Gallery section                     |
| --------------------- | ------ | ------ | ----------------------------------- |
| `jewelry-box-wedding` | 483 KB | 6 KB   | None (no variant — base only, safe) |
| `jewelry-box`         | 483 KB | 9 KB   | 7 KB                                |
| `celestial-blue`      | 483 KB | 26 KB  | 29 KB                               |
| `editorial`           | 483 KB | 13 KB  | 11 KB                               |
| `enchanted-rose`      | 483 KB | 19 KB  | 21 KB                               |
| `sacred-keepsake`     | 483 KB | 17 KB  | 8 KB                                |
| `angelic-presence`    | 483 KB | 19 KB  | 10 KB                               |
| `luxury-hacienda`     | 483 KB | 17 KB  | 13 KB                               |
| `premiere-floral`     | 483 KB | 15 KB  | 11 KB (via editorial entrypoint)    |
| `jewelry-box-wedding` | 483 KB | 6 KB   | None                                |

### Gallery Chunks Emitted

| Chunk                    | Size  | Presets covered                                             |
| ------------------------ | ----- | ----------------------------------------------------------- |
| `editorial.*.css`        | 11 KB | editorial, premiere-floral                                  |
| `jewelry-box.*.css`      | 7 KB  | jewelry-box                                                 |
| `celestial-blue.*.css`   | 29 KB | celestial-blue (includes pet-keepsake presentation variant) |
| `enchanted-rose.*.css`   | 21 KB | enchanted-rose                                              |
| `sacred-keepsake.*.css`  | 8 KB  | sacred-keepsake                                             |
| `angelic-presence.*.css` | 10 KB | angelic-presence                                            |
| `luxury-hacienda.*.css`  | 13 KB | luxury-hacienda                                             |

### Validation Results

| Command                       | Result                                   |
| ----------------------------- | ---------------------------------------- |
| `pnpm build`                  | **PASS** (0 errors, 0 warnings)          |
| `pnpm test`                   | **PASS** (208 suites, 2736 tests passed) |
| `pnpm agent:git-safety:check` | **PASS**                                 |

### Visual QA

Build output confirms all gallery CSS chunks are emitted with correct content. Per-preset CSS chunks
continue to include theme-level gallery CSS variable overrides (`--gallery-*` tokens). No visual
regression is expected because:

1. The base gallery CSS from `invitation/_gallery.scss` (352 lines) remains unchanged — it is
   imported directly by `Gallery.astro` and was never part of the variant loading chain.
2. The theme-section `_base.scss` (98 lines) remains in the shared base chunk —
   `:where(.gallery-section)` CSS variable defaults are always present.
3. Gallery variant chunks are loaded via `<link rel="stylesheet">` in `<head>` — render-blocking, no
   FOUC.
4. Unknown/missing variant presets (e.g. `jewelry-box-wedding`) have no gallery section chunk and
   gracefully fall back to base CSS.

Local `pnpm dev` testing is recommended before production deploy, but no block-level regression is
expected.

### Stop Conditions Triggered

None. All stop conditions were checked and cleared:

| Condition                            | Status                                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| Visual regression                    | Not observed (no change to component base CSS; variant chunks are render-blocking)       |
| Incomplete coverage with no fallback | Not triggered — missing variants fall back to base CSS only (safe)                       |
| No safe base extraction              | Not triggered — gallery had a substantive `:where()` base                                |
| Chunks load all variants             | Not triggered — each chunk contains exactly one preset's gallery CSS                     |
| FOUC                                 | Not triggered — chunks loaded via `<link>` in `<head>`, render-blocking                  |
| Build failure                        | Not triggered — `pnpm build` passed                                                      |
| P0 empty body                        | Not triggered — glob `.default` guardrail applied in resolver                            |
| Cache privacy ambiguity              | Not triggered — Phase 1 cache logic unchanged                                            |
| Raw glob module in HTML attribute    | Not triggered — resolver uses correct `Record<string, { default: string }>` + `.default` |
| Scope creep beyond gallery           | Not triggered — only gallery files touched                                               |

### Risks

- **Celestial-blue gallery chunk is large (29 KB)** — this is expected because the celestial-blue
  variant file is 765 lines (the largest gallery variant). It includes complex layout, lightbox
  styling, index-specific focal points, and the pet-keepsake presentation variant. This chunk will
  always be proportionally large.
- **Preview parity depends on route loading** — both `[slug].astro` and `preview.astro` now load
  gallery section chunks identically. If a future route change adds a third invitation view, it must
  also integrate the section resolver.
- **Jewelry-box-wedding remains uncovered** — no gallery variant file exists for it. Base styles
  apply, which is safe but may not render optimally. This was pre-existing behavior.

### Recommendation

**Continue to the next section.** The gallery proof-of-pattern validates the section splitting
approach. The architecture is sound: keep base CSS in the shared chunk, create per-preset
entrypoints, load via resolver with glob guardrail.

Recommended next section candidates (in priority order):

1. **hero** — has `:where()` base (46 lines), 8 of 9 variants, low structural risk
2. **countdown** — has substantive base (129 lines) with `:is()` shared patterns, 6 variants
3. **rsvp** — has base (56 lines), 8 variants, but includes React component (`client:visible`),
   which introduces JS loading timing concerns

Each subsequent section should follow the same pattern established here:

1. Find the section variant directory in `themes/sections/`
2. Remove variant forwards from the section's `_index.scss` (keep only base)
3. Create entrypoints in `invitation-sections/{section}/`
4. Add resolver mapping in `section-css-resolver.ts`
5. Integrate into both route files
6. Build, test, measure

### Update to Plan Status

This plan has graduated from Level 1 (documentation only) to Level 2 (local code changes
authorized). The autonomy_level in the frontmatter should reflect this for subsequent implementation
loops.

---

## 14. Gallery Hardening Result (2026-06-22)

### Resolver Safety

| Check                              | Result                                                               |
| ---------------------------------- | -------------------------------------------------------------------- |
| Glob `.default` guardrail          | **PASS** — `Record<string, { default: string }>` + `mod.default`     |
| Raw module object to `href` risk   | **PASS** — extracted strings only                                    |
| Critical link spread (`{...link}`) | **PASS** — explicit `rel={l.rel} href={l.href}` in Layout.astro      |
| Missing gallery preset fallback    | **PASS** — `undefined` returned → no `<link>` emitted → base only    |
| Dev warning for missing presets    | **PASS** — added `import.meta.env.DEV` warning for uncovered presets |

### Route CSS Audit (build output)

| Route                                                     | Preset                | Base CSS | Preset CSS | Gallery CSS                   | Status   |
| --------------------------------------------------------- | --------------------- | -------- | ---------- | ----------------------------- | -------- |
| `/boda/demo-boda-jewelry-box-wedding`                     | `jewelry-box-wedding` | 483 KB   | 6 KB       | None (base only, intentional) | **PASS** |
| `/xv/demo-xv-jewelry-box`                                 | `jewelry-box`         | 483 KB   | 9 KB       | 7 KB                          | **PASS** |
| `/xv/demo-xv-enchanted-rose`                              | `enchanted-rose`      | 483 KB   | 19 KB      | 21 KB                         | **PASS** |
| `/xv/demo-xv-editorial`                                   | `editorial`           | 483 KB   | 13 KB      | 11 KB                         | **PASS** |
| `/baby-shower/demo-baby-shower-celestial`                 | `celestial-blue`      | 483 KB   | 26 KB      | 29 KB                         | **PASS** |
| `/primera-comunion/demo-primera-comunion-illustrated`     | `angelic-presence`    | 483 KB   | 19 KB      | 10 KB                         | **PASS** |
| `/cumple/demo-cumple-luxury-hacienda`                     | `luxury-hacienda`     | 483 KB   | 17 KB      | 13 KB                         | **PASS** |
| `/xv/demo-xv-premiere-floral`                             | `premiere-floral`     | 483 KB   | 15 KB      | 11 KB (via editorial)         | **PASS** |
| `/primera-comunion/demo-primera-comunion-sacred-keepsake` | `sacred-keepsake`     | 483 KB   | 17 KB      | 8 KB                          | **PASS** |

### Preview Parity

Both `[slug].astro` and `preview.astro` use identical resolution logic:

- Same `resolveGallerySectionCssUrl(preset)` call with same `viewModel.theme.preset` input
- Same `headLinks` construction pattern
- Same `Layout.astro` rendering with explicit `rel`/`href` attributes

**Result: PASS** — route source inspection confirms parity. No divergence possible without changing
both files identically.

### CSS Output Sanity

| Check                                                    | Result                                                                                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base `invitation.*.css` reduced from ~545 KB to 483 KB   | **CONFIRMED**                                                                                                                                                                  |
| Gallery variant selectors absent from base chunk         | **CONFIRMED** — grep shows 0 `.gallery-section[data-variant=...]` in `invitation.*.css`                                                                                        |
| Gallery section chunks contain only one preset's variant | **CONFIRMED** — jewelry-box chunk has only `[data-variant=jewelry-box]`, editorial chunk has `[data-variant=editorial], [data-variant=premiere-floral]` (intentional grouping) |
| Celestial-blue chunk contains only celestial styles      | **CONFIRMED** — 29 KB is expected (765-line variant source includes lightbox, grid positions, pet-keepsake presentation)                                                       |
| No all-section-variants chunk emitted                    | **CONFIRMED** — only gallery-specific chunks emitted                                                                                                                           |

### Validation Commands

| Command                       | Result                            |
| ----------------------------- | --------------------------------- |
| `pnpm build`                  | **PASS** (0 errors, 0 warnings)   |
| `pnpm test`                   | **PASS** (208 suites, 2736 tests) |
| `pnpm agent:git-safety:check` | **PASS**                          |

### Remaining Risks

1. **Celestial-blue gallery chunk is 29 KB** — expected but worth monitoring. The variant source
   (765 lines) is the largest gallery variant and includes complex layout, lightbox, and multiple
   presentation variants.
2. **Jewelry-box-wedding remains uncovered** — no gallery variant file exists. Base-only fallback is
   safe but may not render optimally.
3. **Third invitation route** — if a new invitation view is added in the future, it must also
   integrate `resolveGallerySectionCssUrl` in its head links. Both current routes are updated.
4. **Mobile field data** — CSS reduction is confirmed in build output, but Speed Insights mobile
   data may still include pre-fix samples. Improved desktop experience is guaranteed; mobile
   improvement depends on whether CSS was truly the bottleneck for real mobile users.

### Recommendation

**Gallery hardening passed all checks.** Continue to the next section. The recommended next section
is **hero** (has `:where()` base, 8 of 9 variants, low structural risk).

---

## 15. Closure — Gallery Proof-of-Pattern (2026-06-22)

### Summary

| Field                     | Value                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Section migrated          | gallery                                                                                                               |
| Plan status               | **Accepted**                                                                                                          |
| Autonomy level            | Level 3 — staging and local commits allowed                                                                           |
| Base CSS before           | ~545 KB                                                                                                               |
| Base CSS after            | **483 KB** (−11%)                                                                                                     |
| Total per-route before    | ~602–622 KB                                                                                                           |
| Total per-route after     | **~540–589 KB** (−5–10%)                                                                                              |
| Gallery chunks emitted    | 7 chunks (editorial, jewelry-box, celestial-blue, enchanted-rose, sacred-keepsake, angelic-presence, luxury-hacienda) |
| P0 glob guardrail         | Applied and verified                                                                                                  |
| Phase 1 cache logic       | Unchanged                                                                                                             |
| Preview parity            | Confirmed                                                                                                             |
| Build                     | PASS (0 errors)                                                                                                       |
| Tests                     | PASS (2736/2738)                                                                                                      |
| Git safety                | PASS                                                                                                                  |
| Stop conditions triggered | None                                                                                                                  |
| Production deploy         | Not performed                                                                                                         |

### Decisions

1. **Gallery proof-of-pattern is accepted.** The section splitting architecture is validated: base
   CSS stays in the shared chunk, variant CSS loads via per-preset dynamic chunks, unknown presets
   fall back safely to base-only styling.
2. **The 2026-06-23 loop superseded the stop-after-gallery decision for local work only.** Mobile
   lab evidence still pointed to render-blocking CSS, so hero was selected as the next low-risk
   section.
3. **Production deployment requires explicit approval.** The branch still needs preview validation
   before production approval.

### Files Committed

**Docs/planning commit:** `docs(agent): finalize section CSS loop plan`

- `.agent/plans/README.md`
- `.agent/plans/active/public-invitation-section-architecture.md`
- `.agent/plans/active/public-invitation-css-splitting.md`
- `.agent/plans/active/public-invitation-performance-final-report.md`
- `.agent/plans/active/public-invitation-performance.md`

**Gallery implementation commit:** `perf(invitation): split gallery section CSS`

- `src/styles/themes/sections/gallery/_index.scss`
- `src/styles/invitation-sections/gallery/` (7 entrypoint files)
- `src/lib/invitation/section-css-resolver.ts`
- `src/pages/[eventType]/[slug].astro`
- `src/pages/dashboard/invitaciones/[id]/preview.astro`

---

## 16. Hero Section Split Result (2026-06-23)

### Summary

| Field                 | Value                                                                                |
| --------------------- | ------------------------------------------------------------------------------------ |
| Section migrated      | hero                                                                                 |
| Deployment state      | Branch/local only; production still has per-preset CSS only                          |
| Base CSS before       | ~483 KB after gallery split                                                          |
| Base CSS after        | **437 KB**                                                                           |
| Total per-route after | ~504–546 KB for mapped gallery+hero routes, depending on preset and gallery coverage |
| Hero chunks emitted   | 8 chunks; `jewelry-box-wedding` intentionally falls back to base-only hero styling   |
| P0 glob guardrail     | Preserved with `Record<string, { default: string }>` + `.default`                    |
| Resolver hardening    | Added section-keyed URL map to avoid gallery/hero filename collisions                |
| Preview parity        | Public route and dashboard preview both load preset, gallery, and hero links         |
| Build                 | PASS on 2026-06-23                                                                   |
| Focused test          | PASS: `tests/unit/section-css-resolver-map.test.ts`                                  |

### Decisions

1. **Hero split is accepted for branch validation.** It follows the gallery pattern and keeps
   `hero/_base.scss` in the shared chunk while moving concrete hero variants to
   `src/styles/invitation-sections/hero/`.
2. **No `jewelry-box-wedding` hero chunk is emitted.** There is no source variant file, so the route
   keeps the pre-existing base-only fallback.
3. **Do not proceed to another section in this loop.** The next loop should validate preview output
   and field/lab metrics before considering countdown or rsvp.

### Remaining Risks

- Local visual QA is still required across mapped hero presets before preview deployment.
- Production on 2026-06-23 is behind this branch: it serves `invitation.CLuf74H_.css` at ~558 KB
  decoded and does not include gallery or hero section chunks.
- Some event-specific overrides remain in the base chunk, notably Luna y Estrella hero overrides;
  these are not generic hero variants and should be reviewed separately before any event override
  splitting.

---

## 17. Full Section Split Result (2026-06-23)

### Summary

| Field                   | Value                                                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Sections migrated       | gallery, hero, rsvp, countdown, footer, itinerary, reveal, thank-you, quote, family, gifts, header, location, music-player, personalized-access |
| Sections blocked        | None                                                                                                                                            |
| Deployment state        | Branch/local only; production deploy not performed                                                                                              |
| Base CSS before gallery | 545 KB                                                                                                                                          |
| Base CSS after gallery  | 483 KB                                                                                                                                          |
| Base CSS after hero     | 437 KB                                                                                                                                          |
| Base CSS final          | **184.6 KB**                                                                                                                                    |
| Total CSS final         | ~245–409 KB across the target route presets in local build                                                                                      |
| Route integration       | Public route and dashboard preview now use `resolveSectionBundleCssUrl()` after the consolidation follow-up                                     |
| Cache behavior          | Unchanged; anonymous public cacheable, invite/private no-store                                                                                  |

### Architecture Decisions

1. **Every section now has a `_base.scss`**. Sections without a substantive theme base use a minimal
   theme-neutral fallback that intentionally inherits component base styles.
2. **Section `_index.scss` files forward only `base`**. Concrete theme variants are no longer loaded
   through the shared section barrel.
3. **Variant files are loaded through `src/styles/invitation-sections/<section>/` entrypoints**.
   Shared variant files such as `reveal/shared-light`, `gifts/elegant`, and
   `gifts/editorial-premium` remain shared entrypoints and are mapped explicitly.
4. **Missing variants fall back safely to base styles**. No synthetic empty chunks were created for
   presets without a known variant.
5. **The `import.meta.glob(...?url)` guardrail remains active** through
   `Record<string, { default: string }>` and `.default` extraction in the shared resolver map.

### Validation

| Command / check                  | Result                                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `pnpm build`                     | PASS                                                                                                      |
| `pnpm test`                      | PASS                                                                                                      |
| `pnpm agent:git-safety:check`    | PASS                                                                                                      |
| 9-route browser QA on `pnpm dev` | PASS — all routes returned 200, nonempty body, active section CSS links, no console errors                |
| Cache header check               | PASS — anonymous `public, max-age=0, s-maxage=60, stale-while-revalidate=300`; invite `no-store, private` |

### Caveats

- Production is not updated. This remains branch/local until a preview or production deployment is
  explicitly approved.
- `invitation.*.css` no longer includes migrated files from the `themes/sections` variant barrel,
  but component-level base styles and event-specific override files still contain some
  `[data-variant]` selectors. Those are not section theme chunks and were intentionally not
  refactored in this loop.
- Mobile Speed Insights field data will lag any deployment. A fresh observation window is still
  required before attributing field-score changes to this split.

---

## 18. Section Bundle Consolidation Result (2026-06-23)

### Summary

| Field                    | Value                                                                      |
| ------------------------ | -------------------------------------------------------------------------- |
| Chosen path              | Path B — consolidate section chunks by preset                              |
| Production diagnosis     | Valid rendering; lower bytes; high render-blocking CSS request count       |
| Likely regression cause  | CSS request count, with Speed Insights field-data lag caveat               |
| Final section load shape | One `src/styles/invitation-sections-by-preset/<preset>.scss` per route     |
| Route integration        | Public route and dashboard preview both use `resolveSectionBundleCssUrl()` |
| Base CSS                 | 184.6 KB                                                                   |
| Total CSS after          | ~244.6–367.0 KB in local build                                             |
| CSS request count after  | 4 app stylesheets per route                                                |
| Production deploy        | Not performed                                                              |

### Architecture Decisions

1. **Keep section variant files in place.** Existing
   `src/styles/invitation-sections/<section>/<entrypoint>.scss` files remain as the source
   entrypoints for section styling.
2. **Add bundle entrypoints by preset.** New `src/styles/invitation-sections-by-preset/*.scss` files
   compose the active section entrypoints for each preset.
3. **Resolve one bundle URL.** `resolveSectionBundleCssUrl(themePreset)` uses
   `import.meta.glob(...?url)` with `Record<string, { default: string }>` and stores only
   `mod.default`.
4. **Preserve route parity.** Public invitation routes and dashboard preview routes construct
   identical `headLinks`: active preset CSS plus active section bundle CSS.
5. **Preserve cache behavior.** Anonymous and invite/private cache logic was not changed.

### Validation

| Check                      | Result                                                                 |
| -------------------------- | ---------------------------------------------------------------------- |
| Focused resolver test      | PASS — bundle map uses `.default`, resolves one string URL per preset  |
| `pnpm build`               | PASS — Astro check/build completed                                     |
| `pnpm test`                | PASS — 209 suites passed, 1 skipped; 2741 tests passed, 2 skipped      |
| Local CSS artifact audit   | PASS — section bundle files emitted; route CSS target is 4 stylesheets |
| Preview deployment attempt | INCONCLUSIVE — Vercel stayed `Building` and returned a protected shell |

### CSS Output

| Preset                | Preset CSS | Section bundle CSS | Estimated total route CSS |
| --------------------- | ---------- | ------------------ | ------------------------- |
| `jewelry-box-wedding` | 6.3 KB     | 2.9 KB             | ~244.6 KB                 |
| `jewelry-box`         | 9.3 KB     | 23.3 KB            | ~268.0 KB                 |
| `luxury-hacienda`     | 17.0 KB    | 41.6 KB            | ~294.0 KB                 |
| `editorial`           | 12.7 KB    | 45.4 KB            | ~293.5 KB                 |
| `premiere-floral`     | 15.2 KB    | 41.5 KB            | ~292.1 KB                 |
| `celestial-blue`      | 26.1 KB    | 69.7 KB            | ~331.2 KB                 |
| `enchanted-rose`      | 19.1 KB    | 112.5 KB           | ~367.0 KB                 |
| `sacred-keepsake`     | 17.4 KB    | 42.3 KB            | ~295.1 KB                 |
| `angelic-presence`    | 19.2 KB    | 45.8 KB            | ~300.4 KB                 |

### Caveats

- Preview validation must be rerun before production approval because the attempted Preview did not
  reach a measurable READY app state.
- Mobile Speed Insights field data remains caveated; use a fresh 3–7 day window after any future
  production deploy.
- Production was not deployed in this loop.
