---
title: LCP Measurement Results — Phase 2
status: draft
created: 2026-06-20
source_deployment: celebra-areapmyow-francisco-mendoza-s-projects.vercel.app
phase: 2
---

# LCP Measurement Results

## Environment

- **Preview URL**: `https://celebra-areapmyow-francisco-mendoza-s-projects.vercel.app`
- **Browser**: Playwright (headless Chromium via MCP)
- **Measurement window**: 3s after `load` event
- **Phase 1 cache headers**: active (`public, max-age=0, s-maxage=60, stale-while-revalidate=300`
  for anonymous; `no-store, private` for personalized)

## Measured Routes

### 1. `/boda/demo-boda-jewelry-box-wedding`

| Metric                                   | Value                                                      |
| ---------------------------------------- | ---------------------------------------------------------- |
| FCP                                      | **1192 ms**                                                |
| LCP                                      | **4508 ms**                                                |
| LCP element                              | `<img>` — hero image                                       |
| LCP size                                 | 409600 px² (640×640 natural)                               |
| LCP URL                                  | `_vercel/image?url=_astro%2Fhero.CuzPqrR3.webp&w=960&q=80` |
| Hero image transfer                      | 125 KB (webp, 960w q80)                                    |
| DOM Content Loaded                       | 1336 ms                                                    |
| Load Event                               | 1480 ms                                                    |
| DOM size                                 | 611 elements                                               |
| Envelope visible                         | **Yes** — "Abrir sobre de la invitación" button present    |
| Requires interaction before main content | **Yes**                                                    |
| Navigation type                          | navigate (fresh)                                           |

**Largest resources**:

- `invitation.Bui4brD9.css` — 109 KB transferred, **704 KB decoded**
- `Layout.DjxAMGn1.css` — 11 KB transferred, 52 KB decoded
- `hero.CuzPqrR3.webp` — 125 KB transferred (hero image, LCP)
- `gallery-01.476uR2e9.webp` — 51 KB transferred
- `pinyon-script-latin-400-normal.woff2` — 39 KB transferred

---

### 2. `/xv/demo-xv-jewelry-box`

| Metric               | Value                            |
| -------------------- | -------------------------------- |
| FCP                  | **708 ms**                       |
| LCP                  | **708 ms**                       |
| LCP element          | `<p>` — paragraph text           |
| LCP size             | 12691 px²                        |
| Hero image transfer  | 131 KB (webp, 960×960, 960w q80) |
| DOM Content Loaded   | 792 ms                           |
| Load Event           | 997 ms                           |
| DOM size             | 665 elements                     |
| Envelope visible     | **No**                           |
| Requires interaction | **No**                           |
| Navigation type      | navigate (fresh)                 |

**Largest resources**:

- `invitation.Bui4brD9.css` — **300 B transferred** (cached), 704 KB decoded
- `hero.B_5e9R5k.webp` — 131 KB transferred
- `gallery-01.CIBYsjs8.webp` — 79 KB transferred
- `rose-wax-seal-lc.CgdZRYqR.webp` — 134 KB (CSS background)
- `pinyon-script-latin-400-normal.woff2` — 39 KB

---

### 3. `/baby-shower/demo-baby-shower-celestial`

| Metric               | Value                            |
| -------------------- | -------------------------------- |
| FCP                  | **812 ms**                       |
| LCP                  | **812 ms**                       |
| LCP element          | `<p>` — paragraph text           |
| LCP size             | 12388 px²                        |
| Hero image transfer  | 37 KB (webp, 960×1707, 960w q80) |
| DOM Content Loaded   | 878 ms                           |
| Load Event           | 1310 ms                          |
| DOM size             | 432 elements                     |
| Envelope visible     | **No**                           |
| Requires interaction | **No**                           |
| Navigation type      | navigate (fresh)                 |

**Largest resources**:

- `invitation.Bui4brD9.css` — **300 B transferred** (cached), 704 KB decoded
- `rose-wax-seal-lc.CgdZRYqR.webp` — 134 KB (CSS background)
- `family.C5f9Yn92.webp` — 59 KB transferred
- `hero.CvdftBlP.webp` — 37 KB transferred
- `instrument-sans-latin-wght-normal.woff2` — 30 KB transferred
- `pinyon-script-latin-400-normal.woff2` — transferred

---

### 4. `/primera-comunion/demo-primera-comunion-illustrated`

| Metric               | Value                                |
| -------------------- | ------------------------------------ |
| FCP                  | **636 ms**                           |
| LCP                  | **636 ms**                           |
| LCP element          | `<p>` — paragraph text               |
| LCP size             | 11742 px²                            |
| Hero image transfer  | 61 KB (webp, 960×1440, 960w q80)     |
| DOM Content Loaded   | 714 ms                               |
| Load Event           | 1388 ms                              |
| DOM size             | 540 elements                         |
| Envelope visible     | **No** (non-standard button visible) |
| Requires interaction | **Yes** (action button present)      |
| Navigation type      | navigate (fresh)                     |

**Largest resources**:

- `invitation.Bui4brD9.css` — **300 B transferred** (cached), 704 KB decoded
- `hero.BxCJTQxh.webp` — 61 KB transferred
- `interlude-01.kXzh7b7J.webp` — 89 KB transferred
- `pinyon-script-latin-400-normal.woff2` — transferred
- `instrument-sans-latin-wght-normal.woff2` — 30 KB

---

## Cross-Route Synthesis

### FCP / LCP Summary

| Route            | FCP (ms) | LCP (ms) | LCP Element | Δ LCP−FCP |
| ---------------- | -------- | -------- | ----------- | --------- |
| Boda             | 1192     | **4508** | Hero IMG    | +3316 ms  |
| XV               | 708      | 708      | Text `<p>`  | 0 ms      |
| Baby Shower      | 812      | 812      | Text `<p>`  | 0 ms      |
| Primera Comunión | 636      | 636      | Text `<p>`  | 0 ms      |

### Likely Primary Bottleneck

**CSS render-blocking** — all routes share `invitation.Bui4brD9.css` at **704 KB decoded** (109 KB
compressed). This is the largest single resource and blocks rendering on every route.

**Secondary bottleneck: Hero image** — the boda route has a 125 KB hero image that becomes LCP at
4.5 s. The hero image is behind an envelope reveal animation that requires user interaction. For the
three text-LCP routes, the hero image loads asynchronously behind the text and doesn't delay
perceived performance.

**Tertiary: Envelope reveal** — the boda route requires a user click to reveal main content. Before
the click, only the envelope is visible. The main content (including the hero image) is hidden until
interaction. This delays LCP artificially — the user must interact before seeing the LCP element.

### Render-Blocking Resources (from trace)

| Resource                        | Size (transferred) | Size (decoded) |
| ------------------------------- | ------------------ | -------------- |
| `invitation.Bui4brD9.css`       | 109 KB             | **704 KB**     |
| `Layout.DjxAMGn1.css`           | 11 KB              | 52 KB          |
| Font: `pinyon-script`           | 39 KB              | —              |
| Font: `instrument-sans`         | 30 KB              | —              |
| CSS background: `rose-wax-seal` | 134 KB             | —              |

### Confidence Level

**High** for CSS bottleneck — 704 KB decoded is unambiguously oversized for a single-page invitation
view. **Medium** for hero image — the boda route LCP is clearly the hero image, but envelope
interaction complicates the measurement. **Low** for font impact — fonts (69 KB total) are
significant but secondary to the 704 KB CSS.

## Decision Gates

| Question                                    | Answer                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Is unused CSS likely > 60%?                 | **Yes** — 704 KB decoded for a single theme is extremely large; most of this is unused section styles and theme variants |
| Should Phase 3 CSS measurement start next?  | **Yes** — CSS is the clearest bottleneck                                                                                 |
| Should Phase 4 font measurement start next? | **No** — not until CSS waste is understood and addressed                                                                 |
| Should envelope/animation remain deferred?  | **Yes** — animation changes without CSS measurement first would be speculative                                           |
