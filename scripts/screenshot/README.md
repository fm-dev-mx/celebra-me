# 📸 Celebra-me Screenshot Tool

Playwright + TypeScript screenshot tool for Celebra-me pages — digital invitations, landing pages,
dashboard, login, and custom routes.

## Support Level

| Page type                                          | Status                                          |
| -------------------------------------------------- | ----------------------------------------------- |
| Invitations with screenshot mode (`?screenshot=1`) | ✅ Verified — full 5-shot sequence              |
| Landing pages                                      | ✅ Verified                                     |
| Dashboard/admin (no auth)                          | ✅ Functional                                   |
| Dashboard/admin (requires auth)                    | ✅ Storage-state pipeline                       |
| Login pages                                        | ⚠️ Not validated                                |
| Batch mode (`--config`)                            | ✅ Implemented — see Configuration File section |

## Quick Start

```bash
# Interactive mode (asks all questions)
pnpm screenshot

# Direct — invitation (flags) — VERIFIED
# Relative routes use the lane-aware base URL (see Lane ports below)
pnpm screenshot:invite --url=/boda/demo-boda-jewelry-box-wedding

# Direct — general page (flags) — VERIFIED for landing
pnpm screenshot --url=/
```

## Lane ports (default base URL)

`pnpm screenshot` detects the current worktree lane and targets the same Astro port as `pnpm dev`:

| Lane                          | Worktree                             | Default base URL        |
| ----------------------------- | ------------------------------------ | ----------------------- |
| Integration (`develop` trunk) | repo root                            | `http://localhost:4321` |
| `dev-local`                   | `…/celebra-me-worktrees/dev-local`   | `http://localhost:4321` |
| `dev-extra`                   | `…/celebra-me-worktrees/dev-extra`   | `http://localhost:4322` |
| `dev-preview`                 | `…/celebra-me-worktrees/dev-preview` | `http://localhost:4323` |

Overrides (in order): `--base-url=…` / config `baseUrl`, then `ASTRO_PORT`, then the lane table.
Absolute `--url=http://…` values are left unchanged.

## Default Mode

The default mode is `audit`, which is intended for recurring visual QA. It marks the page with
`html[data-screenshot='audit']` immediately after DOM readiness, waits for fonts/images, scrolls the
page to trigger lazy loading and reveal effects, waits for height stability, records critical
selector visibility, then normalizes reveal states and disables animations right before capture.

Use `--mode=raw` only when debugging real runtime behavior with minimal intervention. Each run first
resolves and prints a strict scope plan, then writes `preflight.json` before browser launch. After
execution it writes `report.json` with route, mode, planned task results, viewport metadata,
generated files, dimensions, selector checks, warnings, failures, console errors, and request
failures. A partial or failed run is never reported as passed.

## Commands

| Command                               | Description                                                     | Status                                  |
| ------------------------------------- | --------------------------------------------------------------- | --------------------------------------- |
| `pnpm screenshot`                     | Interactive mode when no direct flags are supplied              | ✅                                      |
| `pnpm screenshot:invite --url=...`    | Direct invitation capture                                       | ✅ Verified                             |
| `pnpm screenshot --url=...`           | Direct page capture (invitation / landing / dashboard / custom) | ⚠️ Landing verified, auth pages pending |
| `pnpm screenshot:local-render-corpus` | Runs the registered Local Render Corpus (`--corpus`)            | ✅                                      |

### Single invitation vs corpus

Capture **one** invitation (or any single route) with the supported direct command:

```powershell
pnpm screenshot --url=/<eventType>/<slug> --viewport=<viewport> --clean
```

Example:

```powershell
pnpm screenshot --url=/boda/daniela-y-martin --viewport=mobile-standard --clean
```

`pnpm screenshot:local-render-corpus` runs every page registered in the Local Render Corpus. Corpus
mode is intentionally incompatible with targeted URL, invitation, section, viewport, target, and
cleanup options; run a direct command for one route. `pnpm screenshot --help` prints the supported
surface without launching Playwright.

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

? What is the target of this screenshot run?
  ❯ Critical QA set
    Full page
    All sections
    Single section

? Which viewport profile do you want?
  ❯ Invitation  (mobile-narrow, mobile-standard, mobile-large)
    Site        (mobile-narrow, mobile-standard, tablet, desktop)
    Full        (mobile-narrow, mobile-standard, mobile-large, tablet, desktop)
    ...

? How should section screenshots be framed?
  ❯ Full section   (entire element height, even if taller than the viewport)
    Viewport crop  (only what fits in the current viewport)

? How should reveal sections be handled?
  ❯ Auto-detect reveal section
    Force reveal open (query params)
    ...
```

The tool asks only relevant questions based on the page type (e.g. reveal questions are skipped for
landing pages). Section framing is always asked when the target includes section captures
(`critical-qa`, `all-sections`, or `single-section`).

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

# All sections at full element height (default framing)
pnpm screenshot:invite \
  --url=/xv/abril-michelle-becerra-rea \
  --target=all-sections \
  --section-extent=full \
  --profile=invitation

# Single section, viewport crop only
pnpm screenshot:invite \
  --url=/xv/abril-michelle-becerra-rea \
  --sections=hero \
  --section-extent=viewport \
  --viewport=mobile-standard
```

### CLI Flags

| Flag                      | Short | Description                                                                                            |
| ------------------------- | ----- | ------------------------------------------------------------------------------------------------------ |
| `--url=<url>`             | `-u`  | URL or route to capture                                                                                |
| `--base-url=<url>`        |       | Base URL for route resolution (default: http://localhost:4321)                                         |
| `--type=<type>`           | `-t`  | Page type: invitation, landing, dashboard, admin, login, custom                                        |
| `--mode=<mode>`           |       | Mode: audit (default), raw                                                                             |
| `--profile=<name>`        | `-p`  | Viewport profile: invitation, site, full, single                                                       |
| `--viewport=<names>`      |       | Comma-separated viewport names: mobile-narrow, mobile-standard, mobile-large, tablet, desktop          |
| `--target=<preset>`       |       | Preset: full-page, critical-qa, all-sections, single-section, reveal-only                              |
| `--include-layout[=bool]` |       | Include standard general-page layout tasks                                                             |
| `--set=<name>`            |       | Invitation set: essential, full-qa, reveal-only, full-page                                             |
| `--general-set=<name>`    |       | Page set: basic, full-qa                                                                               |
| `--reveal=<mode>`         |       | Reveal handling: auto, force-open, closed-only, open-only, skip                                        |
| `--animation=<mode>`      |       | Compatibility flag: disable, wait, query-param, custom. Prefer `--mode=audit` or `--mode=raw` instead. |
| `--sections=<ids>`        |       | Comma-separated registered section IDs; stable-deduplicated                                            |
| `--section-extent=<mode>` |       | Section framing: `full` (default, entire element) or `viewport` (visible crop only)                    |
| `--auth=<method>`         |       | Auth: none or storage-state (deterministic headless capture)                                           |
| `--format=<fmt>`          | `-f`  | Output: png, jpeg, webp, pdf                                                                           |
| `--output=<path>`         | `-o`  | Custom output folder                                                                                   |
| `--output-style=<style>`  |       | Folder style: default, timestamped, custom, overwrite                                                  |
| `--config=<path>`         |       | Path to screenshot.config.json                                                                         |
| `--corpus`                |       | Run the canonical Local Render Corpus; incompatible with targeted scope options                        |
| `--clean`                 |       | Remove only exact artifacts and manifests owned by the resolved plan                                   |
| `--interactive`           |       | Use the guided flow                                                                                    |
| `--help`                  | `-h`  | Print the supported command surface                                                                    |

`--set` and `--general-set` remain compatibility inputs, but they are resolved immediately to
explicit targets (`essential`/`full-qa` → `critical-qa`, `reveal-only` → `reveal-only`, `full-page`
→ `full-page`; `basic` → `full-page`). `--section-selectors` and unsupported interactive
authentication are rejected with an actionable error.

Scope is resolved once. Runtime DOM probes may verify readiness and the presence of a planned
section, but they cannot add persisted tasks to an explicit section request. `all-sections` and
`critical-qa` are named presets with their documented runtime inventory behavior.

## Output Structure

```
screenshots/
  demo-boda-jewelry-box-wedding/
    mobile-standard/
      01-initial-closed-viewport.png
      02-reveal-closed.png
      03-reveal-letter-open.png
      04-reveal-transition-open.png
      10-01-hero.png
      05-invitation-full-page.png
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

Legacy filename `05-invitation-full-open.png` is removed only at the exact planned viewport path so
it cannot be confused with the canonical `05-invitation-full-page.png`.

### Preflight, cleanup, and final records

`preflight.json` is the resolved scope record and exists before Playwright launches. It contains the
canonical route identity, page type, section selection, deduplicated viewports, planned task paths,
and owned cleanup targets. `--clean` deletes those exact files only; it never removes an output
directory or scans another viewport. `report.json` is written after capture and reports `passed`,
`warning`, `partial`, or `failed` status using the same task IDs.

### Invitation Screenshots

| File                             | Description                                         |
| -------------------------------- | --------------------------------------------------- |
| `01-initial-closed-viewport.png` | Closed reveal state (viewport only)                 |
| `02-reveal-closed.png`           | Reveal section, unopened                            |
| `03-reveal-letter-open.png`      | Letter/card via `?reveal=letter` (measurable hold)  |
| `04-reveal-transition-open.png`  | Reveal section via same `?reveal=letter` state      |
| `10-*-{section}.png`             | Per-section captures (before full-page in full QA)  |
| `05-invitation-full-page.png`    | Open invitation full page: document-space composite |

### Screenshot reveal URL contract

| `reveal=`                    | Layout                                                                         | Used by                     |
| ---------------------------- | ------------------------------------------------------------------------------ | --------------------------- |
| `closed` (+ `forceEnvelope`) | Envelope/cover closed (`sealed`)                                               | `01`, `02`                  |
| `letter` (+ `forceEnvelope`) | Envelope + letter held (`letter-held`; audit does **not** `display:none`)      | `03`, `04` (one navigation) |
| `open`                       | Envelope → `preview-opened`; harness then normalizes to `revealed` for content | `10-*`, `05`                |

Navigation is skipped when the page is already on the same `screenshot`/`reveal`/`forceEnvelope`
URL. Closed/letter prepares skip full-page lazy-scroll (only `reveal=open` needs section warm-up).

Content captures (`10-*`, `05`) share one open-preparation path: `ensureInvitationOpenForCapture` →
`?screenshot=1&reveal=open` → `normalizeInvitationRevealedForCapture` (sole owner of
`data-reveal-state="revealed"`). Do not mutate reveal state from `cli.ts`, capture-plan, section, or
full-page helpers.

`05-invitation-full-page` is built by stacking the same-run section captures (source of truth) after
that normalized open state (one retry). Invitations must expose `data-screenshot-section` markers.
If open or composite fails, the job fails and any previous `05` for that viewport is removed
(correct or nothing).

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
selectors, registered `sections`, and page-specific critical selectors. The tool validates every
configured page and resolves every plan before launching the first browser. Missing required
selectors fail validation; missing optional selectors warn.

The normal targeted budget is one page/invitation, five total viewports, and thirty planned
artifacts. A larger config batch must opt in with `--allow-large=true`; the named
`pnpm screenshot:local-render-corpus` command is the explicit corpus exception. The command prints
the planned page, invitation, viewport, and artifact counts first. Agent evidence selection and
environment escalation are governed by
[`.agent/rules/gatekeeper.md`](../../.agent/rules/gatekeeper.md).

`preflight.json` and `report.json` are safe records: route query values, credentials, cookies,
tokens, signatures, and sensitive diagnostic assignments are redacted. Explicit `--sections` is
exact; `critical-qa` and `all-sections` are named presets that may discover data-driven sections
such as interludes from the rendered DOM.

See [`docs/core/screenshot-tool-contract.md`](../../docs/core/screenshot-tool-contract.md) for the
validation boundary and representative test matrix.

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

1. **Query params (authoritative for invitation steps)**:
   - `?screenshot=1&reveal=closed&forceEnvelope=true` — closed envelope
   - `?screenshot=1&reveal=letter&forceEnvelope=true` — letter held for `03`/`04` (server-painted)
   - `?screenshot=1&reveal=open` — open invitation for sections / `05`
2. **Data attributes**: `[data-screenshot="reveal-section"]`, `[data-screenshot="reveal-trigger"]`,
   `[data-screenshot="reveal-letter"]`

## Page Stability

Before each screenshot, the tool ensures:

- `DOMContentLoaded` fired
- Network idle (best-effort timeout)
- Fonts loaded (`document.fonts.ready`)
- Visible images loaded (plus scoped, deduped background-image URLs)
- Lazy-loaded images (scroll-triggered once per page; skipped if audit already scrolled)
- Open-invitation hero image readiness before full-page stitch
- Reveal/animated content normalized only in `audit` mode
- CSS animations disabled right before capture in `audit` mode
- Critical selector visibility and image readiness validated

Viewports are captured **sequentially**. Parallel contexts against `pnpm dev` tend to hit Vite
optimize-dep races; use a production preview build if you need more throughput later.

If `05-invitation-full-page` fails verification — or the reveal never opens — any previous published
file for that viewport is deleted so a stale full-page cannot sit next to freshly updated section
captures. Section and full-page open captures are skipped together when a reveal exists but fails to
open.

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

## Agent proportional use

[`gatekeeper.md`](../../.agent/rules/gatekeeper.md) §5.3–5.4 is the single authority for agent
evidence hierarchy, incremental escalation, budgets, stopping conditions, and provider isolation.
The examples below show only the command syntax for a focused capture; select the target there
before launching the tool.

Recommended agent patterns (server already on `http://localhost:4321`):

```bash
# One section, one primary mobile viewport
pnpm screenshot:invite \
  --url=/xv/<slug> \
  --sections=hero \
  --viewport=mobile-standard \
  --section-extent=viewport

# Reveal states only (closed / letter / open subset)
pnpm screenshot:invite \
  --url=/boda/<demo-or-slug> \
  --set=reveal-only \
  --viewport=mobile-standard

# Full critical-qa only when reveal+open composition is in scope (still prefer one viewport first)
pnpm screenshot:invite \
  --url=/boda/<demo-or-slug> \
  --target=critical-qa \
  --viewport=mobile-standard
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

**Reveal not opening** → Ensure your page supports `?screenshot=1&reveal=open` (and `?reveal=letter`
for held-letter steps) server-side. Mark hosts with `data-screenshot="reveal-section"` /
`reveal-letter` as needed. For the full reveal-gate state machine, the `data-reveal-state` values to
wait on, and stuck-at-`sealed` diagnosis, see
[`docs/domains/invitations/reveal-gate-automation.md`](../../docs/domains/invitations/reveal-gate-automation.md).

**Missing sections in full QA** → Add `data-screenshot-section="{name}"` to the section wrapper. The
tool warns about missing elements but continues.

**Screenshots show loading spinners** → Use `--animation=disable` (default in interactive mode).
Server-side `?animations=off` support provides the most deterministic captures.
