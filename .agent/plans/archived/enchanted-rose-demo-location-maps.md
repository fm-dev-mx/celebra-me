---
title: Restore enchanted-rose demo location maps
status: accepted
created: 2026-07-27
updated: 2026-07-27
related_skills:
  - demo-content-consistency
  - testing
related_docs:
  - docs/domains/content/collections.md
  - docs/domains/content/event-governance.md
supersedes: []
superseded_by: []
---

# Restore `demo-xv-enchanted-rose` location maps

## Goal

Restore the ceremony/reception map frames on `/xv/demo-xv-enchanted-rose` so they match
`ayrin-samantha-lerma-castro` (illustrated parchment maps + `enchanted-rose` location styling),
without re-exposing client photography on the public demo and without new asset-resolution
architecture.

**Human approval of this plan = authorization to implement in one pass.** No further design
questions unless a gate fails.

## Locked decisions (no re-litigation)

| Decision | Choice |
| -------- | ------ |
| Map medium | Static illustrated images (`mapCeremony` / `mapReception`), same as Ayrin — **not** `GoogleMap` / coordinates |
| Privacy | Keep `_assetSlug: "demo-xv-editorial"` + `_mediaFallback: true` |
| Asset ownership of binaries | Remain under `src/assets/images/events/demo-xv-enchanted-rose/` (Ayrin still resolves that pack) |
| Demo resolvability | Re-export those two keys from `demo-xv-editorial/index.ts` via sibling import (single binary, no copy) |
| Content wiring | Restore `ceremony.image` / `reception.image` string keys on the demo JSON |
| Adapter / VenueCard / GoogleMap | **No code changes** |
| Ayrin DB / production | **No changes** |
| Watermark / family initials font | **Out of scope** (location has no typographic watermark; family `::after` override is separate debt) |
| Long-term dedicated enchanted-rose demo photography | **Out of scope** (tracked as existing `_mediaFallback` gap) |

## Audit summary (evidence)

1. Ayrin prod publishes `image.key = mapCeremony|mapReception`, `_assetSlug = demo-xv-enchanted-rose`,
   `coordinates = null`.
2. Demo lost maps in `ca3ad8ce` when media was redirected to editorial and venue `image` refs were
   dropped so unresolved keys would not fail audits.
3. `resolveLocationMediaMode` with no image and no coordinates → `mediaMode: 'none'` → empty frame.
4. Map webps still exist locally; editorial pack does not currently export those keys.

## Success criteria

1. `/xv/demo-xv-enchanted-rose` location cards render map images for ceremony and reception
   (`data-media-mode="image"`).
2. Visual treatment remains `data-variant="enchanted-rose"` (existing section/preset CSS).
3. Demo continues to use editorial photography for hero/gallery/etc. (no return of client photo pack
   as demo `_assetSlug`).
4. `tests/content/demo-counterpart-audit.test.ts` passes (referenced keys resolve in selected
   registry).
5. Ayrin asset resolution path unchanged.

## Non-goals

- Migrating Ayrin off `demo-xv-enchanted-rose` asset namespace
- Building a full dedicated enchanted-rose demo photo set
- Interactive maps, rustic tiles, or GoogleMap variant wiring
- Family watermark / monogram font work
- Committing or staging unless explicitly requested after implementation

## Implementation units

### U1 — Editorial registry re-exports

**File:** `src/assets/images/events/demo-xv-editorial/index.ts`

- Import:

  ```ts
  import mapCeremony from '../demo-xv-enchanted-rose/map-ceremony.webp';
  import mapReception from '../demo-xv-enchanted-rose/map-reception.webp';
  ```

- Export `mapCeremony` and `mapReception` on `assets` (same pattern as `jardin` alias; comment that
  these are decorative demo-safe maps shared while `_mediaFallback` is active).

### U2 — Demo content restore

**File:** `src/content/event-demos/xv/demo-xv-enchanted-rose.json`

- On `location.ceremony`: `"image": "mapCeremony"`
- On `location.reception`: `"image": "mapReception"`
- Keep `_assetSlug: "demo-xv-editorial"` and `_mediaFallback: true`
- Tighten `_mediaFallbackNote` to state: photography uses editorial fallback; location maps are
  decorative assets re-exported from the enchanted-rose pack for venue parity with the client
  counterpart

### U3 — Verification (same iteration)

Run:

```bash
pnpm exec jest tests/content/demo-counterpart-audit.test.ts
```

Optional smoke (if local preview already running): open `#event-location` on
`/xv/demo-xv-enchanted-rose` and confirm two map frames.

If gatekeeper content-resolution tier requires more for the touched paths, also run the narrowest
additional command that applies (do not expand to full build unless a touched contract demands it).

## Explicit non-edits

Do not modify:

- `src/components/common/GoogleMap.astro`
- `src/components/invitation/components/VenueCard.astro`
- `src/lib/invitation/presentation-options.ts`
- `src/lib/adapters/event.ts` (unless a test proves resolution breaks — unexpected)
- Ayrin provision/SQL/production content
- Abril WIP files in the working tree

## Rollback

Revert U1 + U2 only. No migrations, no DB.

## Approval prompt

Reply **aprobado** (or equivalent) to execute U1–U3 in one pass and report results. Any change to
locked decisions must be stated in that same reply before implementation starts.
