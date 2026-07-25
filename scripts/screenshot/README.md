# 📸 Celebra-me Screenshot Tool

Playwright + TypeScript screenshot tool for Celebra-me pages — digital invitations, landing pages,
dashboard, login, and custom routes.

## Support Level

| Page type                                          | Status                                          |
| -------------------------------------------------- | ----------------------------------------------- |
| Invitations with screenshot mode (`?screenshot=1`) | ✅ Verified — full 5-shot sequence              |
| Landing pages                                      | ✅ Verified                                     |
| Dashboard/admin (no auth)                          | ✅ Functional                                   |
| Dashboard/admin (requires auth)                    | ⚠️ Not validated — no auth pipeline yet         |
| Login pages                                        | ⚠️ Not validated                                |
| Batch mode (`--config`)                            | ✅ Implemented — see Configuration File section |

## Quick Start

```bash
# Interactive mode (asks all questions)
pnpm screenshot

# Direct — invitation (flags) — VERIFIED
pnpm screenshot:invite --url=/boda/demo-boda-jewelry-box-wedding

# Direct — general page (flags) — VERIFIED for landing
pnpm screenshot --url=http://localhost:4321/
```

## Default Mode

The default mode is `audit`, which is intended for recurring visual QA. It marks the page with
`html[data-screenshot='audit']` immediately after DOM readiness, waits for fonts/images, scrolls the
page to trigger lazy loading and reveal effects, waits for height stability, records critical
selector visibility, then normalizes reveal states and disables animations right before capture.

Use `--mode=raw` only when debugging real runtime behavior with minimal intervention. Each run
writes `report.json` with route, mode, viewport metadata, generated files, dimensions, document
height, selector checks, warnings, failures, console errors, and request failures.

## Commands

| Command                            | Description                                    | Status                                  |
| ---------------------------------- | ---------------------------------------------- | --------------------------------------- |
| `pnpm screenshot`                  | Interactive mode (guides through all options)  | ✅                                      |
| `pnpm screenshot:invite --url=...` | Direct invitation capture                      | ✅ Verified                             |
| `pnpm screenshot --url=...`        | Direct page capture (landing/dashboard/custom) | ⚠️ Landing verified, auth pages pending |

## Interactive Flow

Run without arguments to start the guided CLI:

```
$ pnpm screenshot

📸  Celebra-me Screenshot Tool

? What do you want to screenshot?
  ❯ Invitation page   (e.g. /boda/demo-boda-jewelry-box-wedding)
    Landing page      (e.g. /)
    Dashboard / Admin (e.g. /dashboard)
    ...

? URL or route to capture: /boda/demo-boda-jewelry-box-wedding

? Which screenshot set do you want?
  ❯ Essential invitation set  (initial + reveal open/closed + full)
    Full invitation QA        (essential + individual sections)
    Reveal only               (closed + open letter + open section)
    ...

? Which viewport profile do you want?
  ❯ Invitation  (mobile-narrow, mobile-standard, mobile-large)
    Site        (mobile-narrow, mobile-standard, tablet, desktop)
    Full        (mobile-narrow, mobile-standard, mobile-large, tablet, desktop)
    ...

? How should reveal sections be handled?
  ❯ Auto-detect reveal section
    Force reveal open (query params)
    ...
```

The tool asks only relevant questions based on the page type (e.g. reveal questions are skipped for
landing pages).

## Direct Mode (Flags)

```bash
# All options
pnpm screenshot \
  --url=/dashboard \
  --type=dashboard \
  --profile=site \
  --general-set=basic \
  --format=png \
  --viewport=mobile-narrow,mobile-standard,desktop \
  --mode=audit \
  --auth=storage-state

# Short forms
pnpm screenshot:invite \
  --url=/boda/demo-boda-jewelry-box-wedding \
  --profile=invitation \
  --set=essential \
  --reveal=auto
```

### CLI Flags

| Flag                     | Short | Description                                                                                            |
| ------------------------ | ----- | ------------------------------------------------------------------------------------------------------ |
| `--url=<url>`            | `-u`  | URL or route to capture                                                                                |
| `--base-url=<url>`       |       | Base URL for route resolution (default: http://localhost:4321)                                         |
| `--type=<type>`          | `-t`  | Page type: invitation, landing, dashboard, admin, login, custom                                        |
| `--mode=<mode>`          |       | Mode: audit (default), raw                                                                             |
| `--profile=<name>`       | `-p`  | Viewport profile: invitation, site, full, single                                                       |
| `--viewport=<names>`     |       | Comma-separated viewport names: mobile-narrow, mobile-standard, mobile-large, tablet, desktop          |
| `--set=<name>`           |       | Invitation set: essential, full-qa, reveal-only, full-page                                             |
| `--general-set=<name>`   |       | Page set: basic, full-qa                                                                               |
| `--reveal=<mode>`        |       | Reveal handling: auto, force-open, closed-only, open-only, skip                                        |
| `--animation=<mode>`     |       | Compatibility flag: disable, wait, query-param, custom. Prefer `--mode=audit` or `--mode=raw` instead. |
| `--sections=<mode>`      |       | Sections: none, auto, known, custom                                                                    |
| `--auth=<method>`        |       | Auth: none, existing-session, storage-state, manual-login                                              |
| `--format=<fmt>`         | `-f`  | Output: png, jpeg, webp, pdf                                                                           |
| `--output=<path>`        | `-o`  | Custom output folder                                                                                   |
| `--output-style=<style>` |       | Folder style: default, timestamped, custom, overwrite                                                  |
| `--config=<path>`        |       | Path to screenshot.config.json                                                                         |

## Output Structure

```
screenshots/
  demo-boda-jewelry-box-wedding/
    mobile-standard/
      01-initial-full-page.png
      02-reveal-section-closed.png
      03-reveal-letter-open.png
      04-reveal-section-open.png
      05-invitation-full-open.png
    mobile-narrow/
      ...
    mobile-large/
      ...

  dashboard/
    desktop/
      01-viewport.png
      02-full-page.png
      20-critical-main.png
    report.json
```

### Invitation Screenshots

| File                           | Description                     |
| ------------------------------ | ------------------------------- |
| `01-initial-full-page.png`     | Full page (closed reveal state) |
| `02-reveal-section-closed.png` | Reveal section, unopened        |
| `03-reveal-letter-open.png`    | Letter/card content visible     |
| `04-reveal-section-open.png`   | Reveal section, opened state    |
| `05-invitation-full-open.png`  | Full page (after reveal)        |

### General Page Screenshots

| File                    | Description                 |
| ----------------------- | --------------------------- |
| `01-viewport.png`       | Visible viewport only       |
| `02-full-page.png`      | Full page scrolling capture |
| `03-header.png`         | Header element (full QA)    |
| `04-main.png`           | Main content (full QA)      |
| `05-footer.png`         | Footer element (full QA)    |
| `06-section-{name}.png` | Individual sections         |

## Configuration File

Batch mode via `--config=screenshot.config.example.json` runs each configured page sequentially. The
config supports `defaultMode`, `outputDir`, viewport presets, page routes, wait selectors, hide
selectors, and page-specific critical selectors. Missing required selectors fail validation; missing
optional selectors warn.

## Viewport Profiles

### invitation

| Name            | Resolution | DPR |
| --------------- | ---------- | --- |
| mobile-narrow   | 360×740    | @2x |
| mobile-standard | 390×844    | @2x |
| mobile-large    | 430×932    | @3x |

### site

| Name            | Resolution | DPR |
| --------------- | ---------- | --- |
| mobile-narrow   | 360×740    | @2x |
| mobile-standard | 390×844    | @2x |
| tablet          | 768×1024   | @2x |
| desktop         | 1440×1200  | @1x |

### full

All 5 viewports combined (for comprehensive QA).

Mobile-small is accepted as a CLI alias for `mobile-narrow`; reports use the canonical
`mobile-narrow` name.

## Reveal Detection Priority

1. **Query params**: `?screenshot=1&reveal=open` / `?screenshot=1&reveal=closed`
2. **Data attributes**: `[data-screenshot="reveal-section"]`, `[data-screenshot="reveal-trigger"]`,
   `[data-screenshot="reveal-letter"]`
3. **Click automation**: Finds and clicks the trigger button/link
4. **Text fallback**: Matches against "abrir", "ver invitación", "descubrir", etc.

## Page Stability

Before each screenshot, the tool ensures:

- `DOMContentLoaded` fired
- Network idle (best-effort timeout)
- Fonts loaded (`document.fonts.ready`)
- Visible images loaded
- Lazy-loaded images (scroll-triggered)
- Reveal/animated content normalized only in `audit` mode
- CSS animations disabled right before capture in `audit` mode
- Critical selector visibility and image readiness validated

## Recommended Data Attributes

Add these attributes to Celebra-me components for more reliable captures:

```html
<div data-screenshot="invitation-root">
  <div data-screenshot="page-root">
    <section data-screenshot="reveal-section">
      <button data-screenshot="reveal-trigger">
        <div data-screenshot="reveal-letter">
          <header data-screenshot="header">
            <main data-screenshot="main">
              <footer data-screenshot="footer">
                <section data-screenshot-section="gallery">
                  <section data-screenshot-section="countdown">
                    <section data-screenshot-section="location">
                      <section data-screenshot-section="itinerary">
                        <section data-screenshot-section="rsvp">
                          <section data-screenshot-section="gifts">
                            <section data-screenshot-section="thankYou"></section>
                          </section>
                        </section>
                      </section>
                    </section>
                  </section>
                </section>
              </footer>
            </main>
          </header>
        </div>
      </button>
    </section>
  </div>
</div>
```

The tool always prefers `[data-screenshot-*]` attributes over CSS classes or text matching. Missing
optional elements produce warnings, not errors.

### Landing page recommended data-screenshot attributes

```html
<section data-screenshot="landing-hero">
  <section data-screenshot="landing-event-types">
    <section data-screenshot="landing-includes">
      <section data-screenshot="landing-essence">
        <section data-screenshot="landing-testimonials">
          <section data-screenshot="landing-process">
            <section data-screenshot="landing-pricing">
              <section data-screenshot="landing-faq">
                <section data-screenshot="landing-contact">
                  <footer data-screenshot="landing-footer"></footer>
                </section>
              </section>
            </section>
          </section>
        </section>
      </section>
    </section>
  </section>
</section>
```

## Requirements

- Node.js >= 22.12.0
- Playwright browsers installed (`pnpm exec playwright install chromium`)
- Dev server running (`pnpm dev`) for local captures

## Troubleshooting

**"browserType.launch: Executable doesn't exist"** → Install Playwright browsers:
`pnpm exec playwright install chromium`

**Page loads but screenshots are empty** → Check the dev server is running. Try `pnpm dev` in
another terminal.

**Reveal not opening** → Ensure your page supports `?screenshot=1&reveal=open` server-side
(preferred path). Or add `data-screenshot="reveal-trigger"` to the button for click automation
fallback.

**Missing sections in full QA** → Add `data-screenshot-section="{name}"` to the section wrapper. The
tool warns about missing elements but continues.

**Screenshots show loading spinners** → Use `--animation=disable` (default in interactive mode).
Server-side `?animations=off` support provides the most deterministic captures.
