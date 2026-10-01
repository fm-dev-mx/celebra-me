---
title: Fast, low-noise visual parity platform
status: active
created: 2026-09-30
updated: 2026-09-30
related_docs:
  - docs/domains/theme/css-visual-parity.md
  - docs/core/release-process.md
  - docs/core/validation-procedures.md
type: implementation
autonomy: 1
---

# Fast, low-noise visual parity platform

Operation mode: implement (first stage only). Make the canonical visual gate fast and reviewable
without weakening it. Keep human, hash-bound acceptance, unchanged comparator tolerances, complete
coverage and one baseline system. Commits, pushes, CI trials and `visual:parity:accept` each require
explicit owner authorization in the current task.

## Owner decisions

- Complete pages are compared as contiguous section bands taken from one stable full-page raster
  (second stage). Viewport-only replacement of complete pages is rejected.
- Perceptual metrics (SSIM, row alignment, severity) rank and explain differences only. The gate
  keeps Playwright's comparator: pixelmatch threshold 0.2, anti-aliased pixels excluded,
  `maxDiffPixelRatio: 0.001`. No 2% threshold and no `ssim-cie94` gate.
- Live CARTO map tiles must leave the gate; live tile drift is reported by diagnostics. Recorded
  replay was the chosen mechanism, but CARTO's terms forbid it (see stage 1, item 2).

## Known evidence (2026-09-30, `fc5212554`)

- 184 captures: 118 viewport variants through `/test/variant` and 66 native full-page captures (33
  routes × 390×844 / 1440×900, 5.8k–22k px tall, ~433 MB in LFS). There is no stitching in the gate.
- Last pre-push: Playwright 523 s. The serial page group took 487 s on one worker while the second
  worker finished everything else by 271 s. Page captures average 5.2 s (mobile) and 9.6 s (desktop,
  max 20 s). The CI browser step took 685 s.
- Serial mode exists only because both suites accumulate results in module-level arrays that
  `afterAll` writes as the suite manifest. There is no shared server, database or write order.
- Playwright fails any size mismatch, so a 1 px height change fails every complete page that
  contains it. Its comparator decodes and diffs even byte-identical images.
- The deferral regex did not match Playwright 1.62's size-only mismatch message
  (`received 390px by …`), so a pure height change aborted the serial suite.
- `changes.html` flags any SHA-256 change, including gate-passing render noise, without diff images.
- `visual-impact.ts` is a boolean path classifier: any match runs all 184 captures.
- 10 of 13 September acceptance commits touched `location-*` captures that load live CARTO tiles.

## Stages

### Stage 1 — quick wins (this task)

1. Defer size-only mismatches; set `updateSnapshots: 'none'` in compare mode.
2. **Blocked on the venue-map decision below.** CARTO Basemaps Terms §9.c prohibit server-side
   caching, proxying and redistributing tiles, so recorded tile fixtures cannot be stored.

#### Venue map proposal (owner decision)

- Usage: `StaticVenueMap` (`src/lib/invitation/venue-map-tiles.ts`) renders a static,
  non-interactive 3×3 grid of CARTO Voyager tiles fetched by the guest's browser. Only 7 routes
  render it: the published invitations abril-michelle-becerra-rea, alba-rosa-quinonez,
  america-johana, leah-lexa and romina-rios-chaparro, plus the demos demo-xv-jewelry-box and
  demo-cumple-luxury-hacienda (11 map instances). Every other route already uses a venue photo, an
  illustrated plate or links only.
- Compliance gap: CARTO requires a per-customer API key for commercial use (free up to 1M tile
  requests per month) and credit to CARTO and OpenStreetMap on every map. Production uses neither a
  key nor attribution. The public OpenStreetMap tile servers are not a production alternative (best
  effort, no SLA, heavy use may be blocked).
- The map is decorative: guests navigate with the existing Google Maps, Apple Maps and Waze links.
  The project already switched four times between iframe, CARTO and a keyless SVG schematic map.
- Recommendation: drop CARTO. Render the venue photo when one exists, otherwise an in-house
  illustrated venue card (token-styled SVG with pin, venue name, address and the existing navigation
  actions). Remove the cartocdn allowlists from the capture specs. This removes the licensing
  exposure, the third-party request that leaks guest IPs, and the only live network dependency in
  the visual gate. Affected references (8 `location-*` variant captures and 14 page captures) join
  the single stage-2 migration acceptance; the five clients should be informed before deployment
  because their published pages change.
- Optional later: a self-generated static map image per venue, rendered once at publication from
  OpenStreetMap data and stored with the invitation assets (ODbL attribution required). Only if real
  geography is a product requirement.
- Data check: america-johana's ceremony coordinates (19.2759, −99.5177, near Toluca) do not match
  its Coyoacán address; the live map may show the wrong area.

3. Replace in-memory accumulation with per-capture records written to disk and a post-run aggregator
   that rebuilds the suite manifests, asserts complete coverage and fails on any FAIL record.
   Behavior stays serial by default.
4. Parallel capture behind `VISUAL_PARITY_PARALLEL=1` until paired CI trials meet the
   release-process criterion (≥30% wall-time saving, ≤50% more runner minutes, identical coverage).
5. Byte-identical fast path in compare mode (skips decode and pixelmatch; strictly stronger than the
   gate).
6. Candidate generation seeded with the accepted bytes and `--update-snapshots=changed`, so only
   gate-failing captures change. Records keep `observedSha256` for the fresh bytes.
7. Review report v1: diff image, metadata, severity order, filters, and a counted collapsed group of
   gate-passing byte changes.
8. Measure each pre-push Docker step, then remove the largest avoidable costs; concurrent preflight;
   compute the runtime fingerprint once per run.
9. Fix stale acceptance docs; draft policy amendments A1–A3 for owner approval.

#### Stage 1 status (2026-09-30, uncommitted on `feat/visual-parity-platform`)

- Done: items 1, 3–7 and 9; item 8 adds per-step host/container timings, failure-only evidence
  copies in compare, a concurrent preflight and an inherited runtime fingerprint. Volume and LFS
  optimizations wait for measured timings from a certified run.
- Native diagnostic trial (Windows, not certification; same SHA, 4 workers):
  - 118 variant captures: 134 s serial → 47 s parallel; 0 byte differences; same matrix hash.
  - 26 demo complete pages: 212 s serial → 121 s parallel; 0 byte differences; same matrix hash.
  - Stable-capture time per capture is unchanged under contention (pages 3.5 s → 3.7 s average).
- Review report on real data (Windows captures against Linux references): 144 captures, 134 gate
  failures listed with diffs, 7 gate-passing byte changes collapsed, 670 linked images, 223 KB HTML.
- Certified pre-push (pinned Linux image, serial, same 333 tests):

  | Step                  | Before     | Archive + volume (cold)     | Warm        |
  | --------------------- | ---------- | --------------------------- | ----------- |
  | Source into container | 109 s copy | 36 s archive + 26 s extract | 20 s + 25 s |
  | pnpm install          | 132 s      | 13 s                        | 6 s         |
  | Playwright            | 9.3 min    | 9.0 min                     | 9.0 min     |
  | Total                 | 840 s      | 644 s                       | 622 s       |

- `develop` (`fc5212554`) already fails 152 of 184 certified comparisons, identical to this branch:
  `601d7b716` changed font fallbacks in tokens and presets without re-accepted references. The
  branch reproduces develop's rendered bytes for 179 of 184 captures; the 5 that differ between runs
  (map, thank-you and photo-heavy pages) show run-to-run nondeterminism.
- Band probe (Windows diagnostic, 26 demo pages, one row inserted between the first two sections):
  whole-page comparison fails 26 of 26; 0 of 328 bands below the change fail the gate (108 drift
  below the threshold). Bands remove the cascade without changing the tolerance.
- Pending owner authorization: the `visual_parallel` CI input with its validation-contract update,
  three paired CI trials, re-accepting references for the font change, and the venue-map decision.

### Stage 2 — banded complete pages and triage engine

- Probe fixed layers (`position: fixed`, `background-attachment: fixed`) under full-page capture.
- `scripts/screenshot/visual-bands.ts`: contiguous bands `[0, rasterHeight)` with deterministic
  boundaries (floored tops, DOM order, next-section top wins on overlap); band ids `NN-kind-id`;
  coverage proven with `composite.ts` strip assertions; one snapshot per band with the same ratio
  (stricter for localized changes — the amendment must state this).
- Manifest v2: one `captures[]` entry per case (matrix hash unchanged) with nested `bands[]`.
- Triage for failing bands only: row-signature alignment (unique-row anchors plus LCS, aligned pairs
  verified with the gate's YIQ check) classifying `SHIFT_ONLY`, `CONTENT_CHANGE`, `MIXED`; SSIM and
  bounding-box severity for ordering.
- Single-pass page preparation and clip-based font pin, adopted only with identical or gate-passing
  output on all captures. Compare-only stability shortcut when the first frame equals the accepted
  bytes.
- One migration acceptance covering bands and replayed tiles.

### Stage 3 — platform

- Registry-based dependency map (variant `cssOwner`, presets, profiles, definitions, demos, section
  components, DOM inventory from records); unknown or global paths select the full matrix. Shadow
  mode first; selective pre-push becomes its own evidence class and is never cached as full
  certification. CI always runs the full matrix.
- Deterministic clustering `(diffClass, sectionKind, variant, viewport, heightDelta, causeSet)` with
  a representative per cluster.
- Interactive review UI (side by side, slider, onion skin, heatmap, cluster filters, keyboard
  review) exporting `review-decisions.json`; `accept` binds its hash and records decisions.
- Optional CI sharding with an LFS cache.

## Policy amendments (owner gates)

| Id  | Change                                                                             | Owning text                                                                                                      |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| A1  | Parallel capture suites with on-disk records                                       | `validation-procedures.md` worker settings, `release-process.md` trials, `css-visual-parity.md` serial rationale |
| A2  | Candidates keep accepted bytes for gate-passing captures; record observed bytes    | `css-visual-parity.md`, `release-process.md` candidate review                                                    |
| A3  | Deterministic map layer in the gate (mechanism pending); live drift in diagnostics | `css-visual-parity.md` venue previews                                                                            |
| A4  | Banded complete-page evidence, per-band ratio                                      | `css-visual-parity.md` complete-page evidence                                                                    |
| A5  | Accepted-identical first frame satisfies stability in compare only                 | `css-visual-parity.md` stabilization                                                                             |
| A6  | Selective pre-push evidence class                                                  | `release-process.md` local certification                                                                         |
| A7  | Cluster decisions bound to acceptance                                              | `css-visual-parity.md` release-time confirmation                                                                 |

## Acceptance criteria (stage 1)

- Aggregated serial manifests match the previous suite manifests (cases, matrix hash, statuses).
- Parallel and serial runs of the same SHA produce identical coverage and comparison results.
- A size-only mismatch is recorded as FAIL without aborting the remaining captures.
- Candidate review lists only gate-failing captures as changes; gate-passing byte changes are
  counted separately and keep the accepted bytes.
- No tolerance, matrix or acceptance rule changes without an approved amendment.

## Stop conditions

- Parallel execution changes any pixel verdict or coverage relative to serial.
- CARTO terms do not allow recorded tiles in test fixtures.
- Trials miss the release-process criterion: keep serial and report.
- A change would require re-accepting baselines outside the single stage-2 migration acceptance.
