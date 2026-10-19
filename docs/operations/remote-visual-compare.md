# Remote visual compare

Read-only screenshots of every live public route on a real origin, and a compare of two capture
sets. Built for the cutover to Cloudflare Workers: capture `www` before, capture it again after, and
the report says whether guests see the same pages.

The repository's visual baselines only cover fixture sections, and the Preview E2E guards in
`scripts/playwright/preview-environment.ts` refuse Production on purpose. This tool is a separate
mode with its own allow-list; it does not loosen those guards.

## Commands

```bash
pnpm visual:remote:routes --origin=https://www.celebra-me.com
pnpm visual:remote:capture --origin=https://www.celebra-me.com --label=antes
pnpm visual:remote:capture --origin=https://www.celebra-me.com --label=despues
pnpm visual:remote:compare --before=antes --after=despues
```

Output lives under `output/playwright/remote-visual/` (git-ignored): one folder per capture label
with `manifest.json` and one PNG per route and viewport, and `compare-<before>-vs-<after>/` with
`report.md`, `report.json` and at most six cropped before/after images in `cases/`.

In Git Bash on Windows, keep paths from being rewritten:
`MSYS2_ARG_CONV_EXCL='--only=;--origin=;--vista-previa='`.

Options for `capture`:

| Flag                    | Meaning                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `--label=<name>`        | Capture set name (lowercase letters, digits, `-`). Refuses to overwrite.               |
| `--replace=true`        | Overwrite an existing set with the same label.                                         |
| `--vista-previa=<path>` | Comma-separated `/vista-previa/<token>` photos to check (200 `image/webp`).            |
| `--clock=<iso>`         | Frozen browser clock. Default `2026-10-17T12:00:00-07:00`; keep it equal in both sets. |
| `--only=<paths>`        | Comma-separated paths, for debugging one route.                                        |
| `--concurrency=<n>`     | Routes captured at once (default 3).                                                   |

## Allowed origins

| Origin                                                                              | Access headers |
| ----------------------------------------------------------------------------------- | -------------- |
| `https://www.celebra-me.com`                                                        | none           |
| Production Worker version URL `<prefix>-celebra-me.celebra-me-com.workers.dev`      | required       |
| Preview Worker `celebra-me-preview.celebra-me-com.workers.dev` and its version URLs | required       |

Anything else (apex domain, other hosts, ports, paths, `http`) is rejected. For Worker hosts the CLI
reads `CLOUDFLARE_ACCESS_CLIENT_ID` / `CLOUDFLARE_ACCESS_CLIENT_SECRET` from the environment or
`.env.e2e.local`, and adds them only to requests for that exact origin, never to fonts, maps or
other third parties. Values are never printed.

## Read-only guarantees

- Plain probes are `GET` without following redirects.
- In the browser every request other than `GET`/`HEAD`/`OPTIONS` is aborted, as are first-party
  tracking beacons (`/api/tracking/*`) and analytics hosts.
- Pages load with `?screenshot=1&reveal=open`, which also turns off invitation analytics.

## Route list

Built from the repository, then checked against the origin:

- `/`, `/login`, `/privacidad`, `/terminos`;
- the demo showrooms (`/demos/xv`, `/demos/boda`, `/demos/bautizo`, `/demos/cumpleanos`);
- every demo in `src/content/event-demos`;
- every active invitation definition. Definitions marked `in_progress` are captured only when the
  origin serves them (for example `/xv/naydelin-paredes` answers 200 in Production); a 404 is
  recorded and skipped. Disabled invitations answer 403 by design and are captured as such;
- `/r/victoria-y-roberto` (memories QR landing);
- the permanent redirects of the legacy URL scheme, with `:eventType/:slug` filled from a published
  invitation. A 301 or 308 both count as permanent;
- `/vista-previa/<token>` photos given with `--vista-previa`, or the first one found in a captured
  page. A set without one gets a warning in the report.

Each page is captured full-page at desktop (1440×900) and mobile (390×844), device scale 1, reduced
motion, `es-MX`, `America/Mazatlan`, with the clock frozen so countdowns match. Lazy images are
loaded by scrolling, and fixed overlays (header, cookie banner) are pinned to their first-viewport
position so every capture places them the same way.

## Pass rule (owner decision)

A compare passes only when all of these hold:

- every route in "before" exists in "after" with the same status class;
- redirects are permanent and land on the same path;
- every `/vista-previa` photo answers 200 `image/webp`;
- no photo is missing, replaced, broken or moved by more than 2 px (photos are matched in page order
  by source name without host, image service or build hash);
- at most 0.5 % of pixels changed outside photo and embedded-media regions. A height change counts
  as changed rows.

Example: if `/xv/america` mobile had its second photo shift 40 px down after the cutover, the report
lists it under "Imagen movida" with the old and new position and includes a cropped side-by-side
image, even when the rest of the page is identical.

## Cutover use

1. Friday 22:00: `capture --label=antes` on `https://www.celebra-me.com` (still the former host).
2. Optional rehearsal: capture the Production Worker version URL and compare it with `antes`.
3. At the cutover (T+15 min): `capture --label=despues` on `https://www.celebra-me.com`, then
   `compare --before=antes --after=despues`. Exit code 0 = pass, 1 = fail.
