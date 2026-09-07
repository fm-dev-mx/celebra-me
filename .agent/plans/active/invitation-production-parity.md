---
title: Restore production invitation parity
status: active
created: 2026-09-07
updated: 2026-09-07
type: remediation
---

# Restore production invitation parity

Operation mode: remediate. Restore Local and Preview visual parity for every public invitation and
demo. Production remains read-only. Local/Preview publication and task commits are authorized.

## Approved exception

On 2026-09-07 the owner explicitly approved keeping gallery captions legible where Production clips
them outside the photo. Preserve readable captions. This exception covers only caption visibility
and the styling required for their readability; it does not approve changed image sources, crops,
section order, unrelated typography, geometry, or image-delivery differences.

Keep diagnostic differences visible. Do not change thresholds, mask captions, or mark these captures
MATCH. Record the exact affected captures during final human baseline review using the existing
visual:parity acceptance mechanism. This approval is not blanket acceptance of gallery sections or
of any deployment SHA.

## Evidence and current remediation

The deployed Preview at 0b8e2e7c was compared with Production 6081525e in
`.tmp/visual-parity/diagnostics/preview-0b8e2e7c-verified/`: 573 matches, 182 differences, and one
unstable location capture. All 30 routes were captured in two viewports.

- Cesar desktop hero: Production bytes match the existing gallery-02.webp source. Bind the desktop
  hero role to that file and retain hero-production.jpg for mobile. Separate semantic keys preserve
  the role budget contract. Published Local v5 and Preview v7 through content-and-assets/sync with
  no pruning: one Local hero overwrite and one new Preview hero upload; zero deletions. Content-only
  intentionally excludes image reference changes.
- Magazine-spread captions: the base margin reset removed 1em above and below each paragraph.
  Restore paragraph spacing and block flow in the owning variant. Local capture heights now match
  Production for the editorial-magazine and Valentina-profile demos in both viewports.
- Editorial-cover mobile: restore evidenced padding and details typography, preserving the
  bounded-width safeguards. Full visual and overflow verification remains required.
- Wedding itinerary titles: the global anywhere wrapping split words within a narrow timeline
  column. Restore normal word boundaries in the existing wedding skin. Both viewport heights now
  match Production; remaining pixel differences are not accepted by this result.
- Ornamented access: restore explicit inherited corner opacity and card glow instead of replacing
  them on the variant root. The editorial demo access matches Production in both aligned captures.
- Section capture alignment: fractional section origins introduced rasterization differences even
  with equal dimensions. Align isolated captures to the pixel grid, retain original DOM bounds and
  offsets, and reject authored CSS translate. Geometry and visible-change regressions pass. This
  does not normalize full pages or relax comparison thresholds. Wedding itinerary matches in both
  aligned captures; full inventory comparison is being repeated.
- Alba location: extracting scoped map CSS changed cascade precedence, activating previously
  ineffective profile marker/halo colors. Remove those redundant overrides and retain the shared
  marker palette. The compiled style regression reproduces Production colors; Local location
  captures match Production with zero differing pixels in both viewports.
- Image-delivery differences and remaining section geometry remain open. An explicit
  backward-compatible image delivery contract was explicitly approved by the owner. Keep that
  authorization separate from the caption exception.

## Latest verification

The repeated deployed Preview inventory in `.tmp/visual-parity/diagnostics/preview-0b8-aligned-all/`
covers 60 route/viewports and 756 sections: 570 MATCH, 185 DIFFERENT, and one UNSTABLE, affecting 27
routes. Of the findings, 133 include image identity/delivery differences. Preview still runs
0b8e2e7c and does not contain the current style corrections. These numbers are not a measurement of
the corrected Local candidate or an acceptance.

Full CI passed type checks and 532 unit suites (6027 tests; one skipped), then failed one combined
seal/CTA test on its 30-second total budget. The unchanged test passed three isolated repeats
(24.4s, 13.2s, 13.2s). Split the two interactions into separate cases with the same closed/revealed
assertions and unchanged timeouts. The separated cases passed. The final full rerun in
`.agent/tmp/parity-aligned-map-ci-verified.log` passed: type checks, 532 unit suites / 6027 tests
(one skipped), 224 browser tests, and build.

A status read during concurrent validation reported 16/17 synchronized and Ximena behind in Preview.
Both content-only and content-and-assets/verify dry-runs found zero operations. The independent live
fingerprint probe classified Ximena as matching in both environments. A fresh complete read after CI
in `.agent/tmp/parity-aligned-local-preview-dbs-verified.json` confirms 17/17 synchronized, 82/82
migrations in both environments, zero attention items, and zero identity conflicts. No corrective DB
writes were performed. The transient alert was not reproduced; its cause is not established. Keep
that earlier evidence rather than attributing it to a database defect. Production was excluded.

## Acceptance

Run focused regressions, type-check, and full CI after final changes. Verify the immutable deployed
Preview, all current public routes and full pages at 390x844 and 1440x900, plus the seven reported
routes at 414x896. Recheck content versions and invalidate evidence on deployment/content drift. Use
the existing visual:parity manifests and human approval at the exact final SHA. No unexplained or
unaccepted difference may remain. Database health does not imply visual parity.

## Explicit image delivery implementation (in progress)

The owner approved the recommended image delivery contract. Optional delivery settings now flow
through canonical definitions, published asset references, adapters, and shared image components.
Omitted settings retain existing rendering defaults. Source preservation is opt-in and decodes the
complete image while retaining dimension, byte-size, MIME, and applicable role-budget validation.
Versioned Local object paths prevent mutable Storage URLs from entering the image-transform cache.
Cloudinary URLs retain the declared original extension instead of silently requesting WebP.

Migration 20260907230000 expands validated-original JPEG/PNG acceptance without updating rows. It
must be applied through db:migrate to Local, then Preview, before original-format publication.
Production remains read-only. Local now has 83 migrations after guarded application of this
migration. Preview subsequently passed the guarded migration and now also has 83/83 migrations. Both object
audits are CURRENT, with zero structural findings and matching canonical fingerprints.
Cesar's desktop and mobile sources are the first evidence-backed declarations. Local publication
created version 6 with two new versioned objects, zero overwritten objects, and zero deletions.
A repeated release dry-run proposes zero logical, database, or Storage changes.

Focused validation: 112 image/publication tests and 32 pipeline/registry tests passed (overlapping
suites; do not sum). Chromium verifies exact original bytes and dimensions through canonical content
resolution at 390px and 1440px. Initial type-check found three generic indexing errors; corrected,
subsequent full CI passed in `.agent/tmp/parity-image-contract-ci-verified.log`: type checks,
533 unit suites / 6044 tests (one skipped), 230 browser tests, and build. The disposable database
suite passed 153 assertions after a guarded disposable-only reset. The final-tree rerun in `.agent/tmp/parity-image-contract-release-ci.log` also passed all of those
checks. Local object audit is CURRENT with 83/83 migrations, zero structural findings, and a
matching disposable-reference fingerprint. Local and Preview mutation-schema contracts pass.

Local public-route evidence is in `.tmp/visual-parity/diagnostics/local-cesar-original-delivery/`
and its `-mobile` rerun. Desktop hero matches the existing threshold. Mobile hero has identical
image bytes, intrinsic dimensions, and crop but a repeatable pixel difference in two text elements.
Font bytes, computed styles, and element bounds match in the follow-up probe; the remaining cause
is not established. Other sections still differ. A fresh alias lookup found Preview deployed at 124097c9
(`dpl_EWJRvLej3X4H6tp3dW6Lcv9BYT66`); it includes the earlier corrections but not this image contract. None of these results establish complete visual parity or acceptance.

REGRESSION_DECISION: Add executable propagation, byte-preservation, MIME provenance,
immutable-cache, and browser source-selection regressions because source conversion and dropped
delivery metadata can escape section screenshot thresholds. Retain existing visual thresholds and
caption exception.


## Hosted rollout checkpoint

The three reviewed commits are 9774dd97 (schema), 3df19d5f (image contract), and 2d667da2
(evidence). Guarded Preview schema application is complete; no Production mutation occurred.
Fresh Local/Preview status in `.agent/tmp/parity-image-contract-local-preview-status.json` shows
16/17 managed definitions synchronized. Only Cesar is behind in Preview; Local matches. There
are zero identity conflicts, 28 Local active rows, and 29 Preview active rows. Production is
explicitly excluded. The additional Preview fixture remains classified as previously documented.

The final Local pilot report at
`.tmp/visual-parity/diagnostics/local-cesar-image-contract-2d667da2/` covers 18 section/viewports:
six MATCH and twelve DIFFERENT. Hero image bytes match both viewports; mobile text rasterization
remains different. No thresholds, baselines, or caption exceptions were expanded.

Deployment must retain the actual develop-scoped Preview configuration. The user authorized
commits and deployments; protected Git push, PR creation, and integration still require their
exact authorization under git-safety.md. Prepare the Preview content release but publish it only
after the new application is deployed and its identity verified. Do not claim visual completion.
