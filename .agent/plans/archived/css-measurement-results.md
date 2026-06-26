---
title: CSS Waste Measurement Results — Phase 3
status: archived
archived_date: 2026-06-25
created: 2026-06-21
source_deployment: celebra-areapmyow-francisco-mendoza-s-projects.vercel.app
measurement_method: Playwright CSS Coverage API
phase: 3
reason: historical measurement data, work completed
---

# CSS Waste Measurement Results

## Methodology

- **Tool**: Playwright `page.coverage.startCSSCoverage()` / `stopCSSCoverage()`
- **Target**: Vercel Preview deployment (production SSR build)
- **Measurement per route**: Two states — initial (after load, before interaction) and post-reveal
  (after envelope/open interaction)
- **CSS chunk**: `invitation.Bui4brD9.css` (shared across all routes)
- **Secondary chunk**: `Layout.DjxAMGn1.css` (shared)

One route substitution: `/primera-comunion/demo-primera-comunion-illustrated` replaces the
non-existent `demo-primera-comunion-luna-estrella`.

---

## Measured Routes

### 1. `/boda/demo-boda-jewelry-box-wedding` — Preset: `jewelry-box-wedding`

| State       | File                      | Total (B) | Used (B) | Unused (B) | Unused %  |
| ----------- | ------------------------- | --------- | -------- | ---------- | --------- |
| Initial     | `invitation.Bui4brD9.css` | 704,200   | 121,600  | 582,600    | **82.7%** |
| Initial     | `Layout.DjxAMGn1.css`     | 51,972    | 13,066   | 38,906     | **74.9%** |
| Post-reveal | `invitation.Bui4brD9.css` | 704,200   | 122,202  | 581,998    | **82.6%** |
| Post-reveal | `Layout.DjxAMGn1.css`     | 51,972    | 13,066   | 38,906     | **74.9%** |

### 2. `/xv/demo-xv-jewelry-box` — Preset: `jewelry-box`

| State       | File                      | Total (B) | Used (B) | Unused (B) | Unused %  |
| ----------- | ------------------------- | --------- | -------- | ---------- | --------- |
| Initial     | `invitation.Bui4brD9.css` | 704,200   | 141,804  | 562,396    | **79.9%** |
| Initial     | `Layout.DjxAMGn1.css`     | 51,972    | 13,066   | 38,906     | **74.9%** |
| Post-reveal | `invitation.Bui4brD9.css` | 704,200   | 142,406  | 561,794    | **79.8%** |
| Post-reveal | `Layout.DjxAMGn1.css`     | 51,972    | 13,066   | 38,906     | **74.9%** |

### 3. `/baby-shower/demo-baby-shower-celestial` — Preset: `celestial-blue`

| State       | File                      | Total (B) | Used (B) | Unused (B) | Unused %  |
| ----------- | ------------------------- | --------- | -------- | ---------- | --------- |
| Initial     | `invitation.Bui4brD9.css` | 704,200   | 158,793  | 545,407    | **77.5%** |
| Initial     | `Layout.DjxAMGn1.css`     | 51,972    | 13,066   | 38,906     | **74.9%** |
| Post-reveal | `invitation.Bui4brD9.css` | 704,200   | 159,395  | 544,805    | **77.4%** |
| Post-reveal | `Layout.DjxAMGn1.css`     | 51,972    | 13,066   | 38,906     | **74.9%** |

### 4. `/primera-comunion/demo-primera-comunion-illustrated` — Preset: `angelic-presence`

| State       | File                      | Total (B) | Used (B) | Unused (B) | Unused %  |
| ----------- | ------------------------- | --------- | -------- | ---------- | --------- |
| Initial     | `invitation.Bui4brD9.css` | 704,200   | 156,540  | 547,660    | **77.8%** |
| Initial     | `Layout.DjxAMGn1.css`     | 51,972    | 13,066   | 38,906     | **74.9%** |
| Post-reveal | `invitation.Bui4brD9.css` | 704,200   | 157,142  | 547,058    | **77.7%** |
| Post-reveal | `Layout.DjxAMGn1.css`     | 51,972    | 13,066   | 38,906     | **74.9%** |

---

## Summary Table (initial state, invitation CSS)

| Route            | Used (KB) | Unused (KB) | Unused %  |
| ---------------- | --------- | ----------- | --------- |
| Boda             | 119       | 569         | **82.7%** |
| XV               | 138       | 549         | **79.9%** |
| Baby Shower      | 155       | 533         | **77.5%** |
| Primera Comunión | 153       | 535         | **77.8%** |

**Combined `invitation` + `Layout` average unused**: ~79.1%

---

## Shared CSS Chunk Confirmation

- **Same chunk**: `invitation.Bui4brD9.css` is served to all 4 routes (confirmed by identical
  `text.length` of 704,200)
- **Same chunk**: `Layout.DjxAMGn1.css` is identical across all routes (51,972 B)
- All routes on the same deployment share the same hashed filenames — the hash (`Bui4brD9`) is
  deterministic per build

---

## Initial vs Post-Reveal Difference

| Route            | Initial used (B) | Post-reveal used (B) | Δ      |
| ---------------- | ---------------- | -------------------- | ------ |
| Boda             | 121,600          | 122,202              | +602 B |
| XV               | 141,804          | 142,406              | +602 B |
| Baby Shower      | 158,793          | 159,395              | +602 B |
| Primera Comunión | 156,540          | 157,142              | +602 B |

The delta is consistently +602 bytes across all routes. This suggests a fixed set of post-reveal
selectors (e.g., `.envelope.open`, `.revealed` states) that are always present but not in the
initial render. The post-reveal CSS usage is essentially the same as initial — the envelope/reveal
animation contributes almost no additional CSS beyond the initial page styles.

---

## Source-Inspection Selector Group Findings

### CSS architecture

`invitation.scss` imports 5 top-level entries:

```scss
@use 'themes/presets/invitation'; // 9 preset files → only 1 used
@use 'layout/event-wrapper'; // structural, mostly used
@use 'invitation/envelope-reveal'; // used by routes with envelope
@use 'invitation/reveal-card'; // used by routes with reveal card
@use 'themes/sections'; // 22 section files → many unused
```

### Estimated waste by category (source-inspection based)

| Category                    | Files     | Est. SCSS size               | Waste per route | Notes                                                                                                                                                                                                          |
| --------------------------- | --------- | ---------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unused theme presets**    | 8 of 9    | ~154 KB                      | ~154 KB         | Each route uses 1/9 presets. Presets are 7.9–31.5 KB SCSS each, generating significant CSS after compilation                                                                                                   |
| **Unused section variants** | ~18 of 22 | ~80+ KB                      | ~70 KB          | `_index.scss` forwards all 22 section files. Many contain theme-specific variants that don't apply to the current route                                                                                        |
| **Envelope/reveal styles**  | 2 files   | ~24 KB                       | 0–24 KB         | `_envelope-reveal.scss` (17.4 KB) + `_reveal-card.scss` (6.8 KB). Routes without envelope still compile these                                                                                                  |
| **Hero/base layout**        | 2 files   | ~9 KB                        | ~0 KB           | `_event-wrapper.scss` (1.2 KB) + `_header-base.scss` (16.7 KB) — mostly structural, almost fully used                                                                                                          |
| **CSS background images**   | Various   | ~134 KB in transferred asset | Variable        | `rose-wax-seal-lc.CgdZRYqR.webp` (134 KB) is a CSS background loaded via compiled CSS. Only present if theme references the seal. The asset doesn't inflate CSS bytes but does inflate transferred page weight |

**Total estimated waste composition**: ~154 KB from unused presets + ~70 KB from unused section
variants + up to 24 KB from unused envelope/reveal + ~134 KB CSS background image (asset, not CSS
text)

### Unused preset details per route

| Route            | Active preset                  | Unused presets                                                                                                                                      |
| ---------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Boda             | `jewelry-box-wedding` (7.9 KB) | `jewelry-box`, `luxury-hacienda`, `premiere-floral`, `editorial`, `celestial-blue`, `enchanted-rose`, `sacred-keepsake`, `angelic-presence`         |
| XV               | `jewelry-box` (12.3 KB)        | `jewelry-box-wedding`, `luxury-hacienda`, `premiere-floral`, `editorial`, `celestial-blue`, `enchanted-rose`, `sacred-keepsake`, `angelic-presence` |
| Baby Shower      | `celestial-blue` (31.5 KB)     | `jewelry-box-wedding`, `jewelry-box`, `luxury-hacienda`, `premiere-floral`, `editorial`, `enchanted-rose`, `sacred-keepsake`, `angelic-presence`    |
| Primera Comunión | `angelic-presence` (23.9 KB)   | `jewelry-box-wedding`, `jewelry-box`, `luxury-hacienda`, `premiere-floral`, `editorial`, `celestial-blue`, `enchanted-rose`, `sacred-keepsake`      |

---

## Render-Blocking Confirmation

From Phase 2 LCP traces:

- `invitation.Bui4brD9.css` is loaded as a `<link rel="stylesheet"` in the `<head>` — it is
  render-blocking on every route
- `Layout.DjxAMGn1.css` is loaded identically — also render-blocking
- The CSS is shared: `dist/client/_astro/invitation.Bui4brD9.css` is 704,226 bytes on disk (matches
  Playwright measurement)
- Both CSS chunks are render-blocking by default (no `media="print"`, no `rel="preload"`)

### Cache behavior on repeat visits

From Phase 1 curl validation:

- First anonymous request: `MISS` — full CSS transfer (109 KB compressed)
- Repeat anonymous requests within 60s: `HIT` — served from Vercel edge, zero origin time
- After cache expiry: `MISS` again — CSS re-fetched from origin

---

## Decision Gate

| Criteria                             | Actual         | Result             |
| ------------------------------------ | -------------- | ------------------ |
| > 60% unused for all measured themes | **77.5–82.7%** | ✅ **Gate passes** |
| < 30% unused                         | N/A            | ❌ Not applicable  |
| 30–60% unused                        | N/A            | ❌ Not applicable  |

**CSS splitting is justified.** All 4 themes exceed 60% unused CSS by a wide margin (77.5–82.7%).

---

## Recommended Next Step

### Smallest safe CSS optimization slice

**Priority order** (each independently verifiable):

1. **Split theme presets into per-preset CSS chunks** (~154 KB waste eliminated)
   - Move `themes/presets/_invitation.scss` import out of the shared `invitation.scss`
   - Create one CSS entry per preset (e.g., `invitation-jewelry-box-wedding.scss`)
   - Load dynamically in `[slug].astro` based on `viewModel.theme.preset`
   - This alone reduces `invitation.css` by ~154 KB for every route

2. **Keep shared structural CSS in one chunk** (~80–100 KB used)
   - `layout/_event-wrapper.scss`, `invitation/_hero.scss`, `invitation/_typography.scss`
   - Base section styles from `themes/sections/_base-theme.scss`
   - These are shared across all themes and should remain in a single shared chunk

3. **Audit section variant imports (~70 KB partial waste)**
   - After step 1, evaluate how much section CSS is still unused
   - Many section SCSS files contain theme-prefixed variants that become unused once the correct
     preset is loaded
   - If section variants still show >30% unused, split sections by theme similarly

### Verification requirement

Every demo theme must render identically before and after any CSS change. Manual review across all 9
demo themes:

| Theme               | Preset                | Route                                                 |
| ------------------- | --------------------- | ----------------------------------------------------- |
| Jewelry Box Wedding | `jewelry-box-wedding` | `/boda/demo-boda-jewelry-box-wedding`                 |
| Jewelry Box         | `jewelry-box`         | `/xv/demo-xv-jewelry-box`                             |
| Enchanted Rose      | `enchanted-rose`      | `/xv/demo-xv-enchanted-rose`                          |
| Editorial           | `editorial`           | `/xv/demo-xv-editorial`                               |
| Celestial Blue      | `celestial-blue`      | `/baby-shower/demo-baby-shower-celestial`             |
| Angelic Presence    | `angelic-presence`    | `/primera-comunion/demo-primera-comunion-illustrated` |
| Luxury Hacienda     | `luxury-hacienda`     | `/cumple/demo-cumple-luxury-hacienda`                 |
| Premiere Floral     | `premiere-floral`     | (template theme)                                      |
| Sacred Keepsake     | `sacred-keepsake`     | (template theme)                                      |

---

## Risks and Blockers

| Risk                                                  | Likelihood | Mitigation                                                                                                                                                      |
| ----------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CSS split breaks a theme variant                      | Medium     | Visual regression check across all 9 demo themes; start with preset split only (lowest risk), then verify sections                                              |
| Dynamic CSS loading delays FCP                        | Medium     | Preload the correct preset CSS chunk in `<head>` using `<link rel="preload">` based on server-side `viewModel.theme.preset`                                     |
| Build complexity                                      | Low        | Astro supports multiple SCSS entry points naturally; no build tool changes needed                                                                               |
| Visual flash while CSS loads                          | Low        | `font-display: swap` pattern — similar approach with `<link rel="stylesheet">` prevents FOUC; Astro's SSR will inline critical CSS if configured                |
| Layout chunk (`Layout.DjxAMGn1.css`) still 75% unused | Low-Medium | The Layout chunk (52 KB) is separate from invitation chunk and shared across all pages (not just invitation). Splitting it is Phase 3 follow-up, not this slice |
