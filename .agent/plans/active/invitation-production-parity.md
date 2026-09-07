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
- Image-delivery differences, remaining section geometry, and the unstable capture remain open. An
  explicit backward-compatible image delivery contract was proposed to the owner; approval is
  pending. Do not infer that approval from the caption exception.

## Acceptance

Run focused regressions, type-check, and full CI after final changes. Verify the immutable deployed
Preview, all current public routes and full pages at 390x844 and 1440x900, plus the seven reported
routes at 414x896. Recheck content versions and invalidate evidence on deployment/content drift. Use
the existing visual:parity manifests and human approval at the exact final SHA. No unexplained or
unaccepted difference may remain. Database health does not imply visual parity.
