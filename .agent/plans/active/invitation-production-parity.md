---
title: Complete invitation parity and remove redundant mechanisms
status: active
created: 2026-09-07
updated: 2026-09-08
type: remediation
---

# Complete invitation parity and remove redundant mechanisms

Operation mode: remediate. Restore every public Local/Preview invitation and demo against the
verified Production deployment, with only the owner's two bounded exceptions below. Production is
read-only. Canonical Local/Preview publication and atomic task commits are authorized. Preserve
unpublished drafts, guest/RSVP data, user-owned changes, and immutable visual evidence.

## Current evidence

- Preview deployment 6319050008 succeeded at db6da25f3b0f1a4647c7e907ba83e530c97138ad.
- Production reference: 6081525ecebac24e99a4ccc085803186ce605a1d. Recheck its deployment identity
  before final certification; a domain alone does not identify a deployment.
- Complete Preview comparison: 30 routes, 60 route/viewports, 756 sections; 685 MATCH, 70 DIFFERENT,
  one UNSTABLE, no ERROR. Evidence:
  `.tmp/visual-parity/diagnostics/preview-db6-complete/report.json`.
- Both structural audits are CURRENT with zero errors. Both mutation-schema contracts PASS.
  Evidence: `.agent/tmp/parity-close-local-audit.log`, `.agent/tmp/parity-close-preview-audit.log`,
  `.agent/tmp/parity-close-local-contract.log`, `.agent/tmp/parity-close-preview-contract.log`.
- These are pre-correction results, not certification of the working tree. Older checkpoints remain
  in [the superseded record](../archived/invitation-production-parity-through-db6da25f.md).

## Approved exceptions

1. Keep gallery captions readable where Production clips them. This covers caption visibility and
   styling required for readability only, not entire galleries, images, crops, order, or unrelated
   typography. Record exact affected cases and retain their diagnostic differences.
2. Keep 12 September 2026 in Xareni's venue section instead of Production's incorrect 2029 date. The
   exception covers that date only. Keep its text discrepancy visible.

Neither exception accepts an arbitrary capture or deployment SHA. Human review must approve the
exact final reference set through the existing acceptance mechanism.

## Corrections and current verification

- Image delivery correction (Local only): all 47 gallery references whose requested dimensions
  already matched their source files now use direct original-byte delivery. America's mobile hero
  uses a prepared 960x1440 WebP (216314 bytes); its original high-resolution file is retained.
  Canonical publication updated seven Local invitations, with one new Storage object and no
  overwrites or deletions. Preview has not received these content changes or the code change.
- The shared image policy no longer implicitly transforms prepared Storage/Cloudinary URLs,
  including versioned objects. Explicit historical transformations remain supported until their
  references are republished. All registered canonical managed definitions now reject runtime
  transformation requests through a regression check. Bundled demos retain their existing pipeline.
- Public Local checks decoded all 47 gallery images without optimizer URLs and confirmed the mobile
  hero at 960x1440. The focused browser suite passed 15 checks. Final image-change CI evidence is
  `.agent/tmp/images-direct-ci-final.log`: exit 0, 6237 unit checks and 251 browser checks passed,
  with the existing single unit-test skip and a successful build. These delivery
  checks do not constitute a new full visual-parity acceptance against Production.
- Post-publication Local status is CURRENT (83/83 migrations, 17/17 managed invitations in sync,
  zero identity conflicts). Preview and Production were excluded. The previously classified Ximena
  gallery12 asset warning remains preserved. Evidence: `.agent/tmp/images-direct-local-dbs.json`.

- Current execution is Local-first. Pause additional Preview publications and deployments while
  Local corrections stabilize. A commit is not a prerequisite for guarded database publication; do
  not republish already synchronized content without a demonstrated defect.
- Enchanted Rose RSVP shells lacked a positioning context. Their absolute decorative pseudo-elements
  painted over the hero instead of RSVP. Adding `position: relative` in the owning RSVP skin fixes
  the spill without changing markup or content. Both mobile/desktop regressions failed before the
  fix and pass afterward. Ayrin and the Enchanted Rose demo now match all eight hero/RSVP checks
  against the saved Production images, with zero changed pixels and unchanged dimensions. Evidence:
  `.agent/tmp/local-rsvp-containment/checks.json`. Historical reference comparison is diagnostic
  evidence only; it does not certify the current hosted deployment or other sections.
- Final Local checkpoint CI passed after the RSVP containment change: 537 suites / 6233 unit
  checks and 243 browser checks, followed by a successful build. One existing suite/test remains
  skipped. Evidence: `.agent/tmp/parity-local-rsvp-final-ci.log`.
- Valentina's mobile surname discrepancy follows an existing title-wrapper width correction.
  Restoring the historical width in a Local browser moves the surname's right edge from 339px
  to 379.1875px within a 375px hero, reproducing the clipped ending. Keeping the complete surname
  was proposed as a separate exception; owner approval is pending. Do not broaden the gallery
  caption exception or restore the clipping without that decision.

- Fixed content-only reconciliation of delivery metadata when the previous, current and target
  uploaded references identify the same file. Source changes remain protected; concurrent metadata
  edits conflict. Published the twelve original-delivery settings and forty-seven gallery reference
  settings through the canonical Local/Preview release flow, with reviewed plans and no Storage
  overwrites or deletions.
- Preserved four verified original files for America's mobile hero/gallery, Cesar's gallery and
  Gerardo's portrait. Original preservation now has explicit 6000px / 24MP bounds; normalized output
  remains 2560px and role byte budgets remain enforced. Applied the reviewed source plans in both
  destinations, adding only the four required objects in each.
- Preview source verification covers America, Cesar and Gerardo at both viewports, including
  complete pages. Cesar and Gerardo match all sections and pages. America's remaining findings
  concern gallery text and typography; validate their exact scope against the approved caption
  exception. Evidence: `.tmp/visual-parity/diagnostics/preview-db6-final-source-check/report.json`.
- The shared Celestial access skin now supplies the existing glow token, preserving its texture in
  either stylesheet order. Single-keepsake gallery eyebrow sizing matches the measured Production
  value of 0.68rem. These source changes are not yet deployed.
- The diagnostic reuses document-strip capture and integrity validation for `--full-pages true`. It
  measures direct text, labels and buttons; waits for visible islands to hydrate; preserves nested
  overlay state; and distinguishes verified original image inputs from delivered encoding. XML
  line-ending normalization is limited to SVG. Original bytes, transformations and pixel differences
  remain recorded. The current measurement contract is version 3.
- A Local Vite dependency cache failure prevented RSVP hydration. Restarting the owned server
  restored all eleven Daniela sections. A subsequent pilot matched both complete page pixels and
  sections; the remaining SVG byte difference was proved to be CRLF versus LF. Local capture now
  uses isolated Astro/Vite caches through Astro's existing inline configuration API. The interrupted
  complete Local run is not certification and must be repeated.
- Current Local/Preview status: 83/83 migrations, 17/17 synchronized, zero identity conflicts.
  Read-only inventory classification finds 28 Local / 29 Preview active records and no unmanaged
  invitations. Preview's extra record is `e2e-preview-publication`. Extra asset records are
  retained, including legacy unkeyed records; their presence is not automatic deletion authority.
  Evidence: `.agent/tmp/parity-db6-final-local-preview-dbs.json` and
  `.agent/tmp/parity-db6-inventory-classification.json`.
- Focused verification: 21 suites / 346 checks pass; expanded image-input comparator suite has 26
  passing checks; capture browser regressions pass. Type checking reported zero errors. These are
  scoped checks, not a substitute for final CI after all edits.

- Concurrent full-page captures shared millisecond-named strip directories. A regression reproduced
  cross-contamination (the blue capture contained red pixels); unique temporary directories fix it.
  Earlier full-page diagnostics remain unaccepted and must be repeated.
- The attempted complete Preview v3 run ended with 185 MATCH, 14 DIFFERENT, four UNSTABLE and 44
  ERROR rows, including HTTP 403 and a strip read failure. These row counts mix sections and failed
  route/viewports and are not a parity percentage. A later public Production probe returned HTTP
  200, but the subsequent browser-based Local comparison identified Production itself returning HTTP
  403 across the requested routes. No further automated Production retries are authorized by this
  failure; hosted parity remains unverified. Automatic approval review blocked sending the existing
  Preview access credential; explicit permission for that bounded verification is pending. Do not
  retry through another tool.

- The isolated Local v3 matrix accounts for all 60 requested route/viewports as ERROR because
  Production returned HTTP 403. It provides no current visual verdict. Evidence:
  `.tmp/visual-parity/diagnostics/local-db6-isolated-complete-v3/report.json`.
- Final CI execution is recorded in `.agent/tmp/parity-db6-final-ci-complete.log`; the previous
  attempt stopped at two SCSS formatting errors, subsequently corrected. No visual acceptance
  follows from CI alone.

## Remaining work, in order

1. Resolve Local differences against the preserved reference evidence first, then repeat the entire
   Local/Preview matrix once hosted access is available, with the same measurement contract,
   including the seven reported 414x896 cases. Resolve unstable and invalid captures without masking
   content or accepting partial coverage.
2. Diagnose remaining per-section pixel, semantic and geometry differences, including shared demo
   styles, captions, hero backgrounds and any newly exposed labels. Record exact exceptions rather
   than accepting whole galleries or pages.
3. Await separate owner decisions for Romina's mobile hero (379472 bytes versus 358400 budget) and
   final gallery image (499896 versus 184320 budget). The attempted substitutions were reverted; the
   existing optimized files remain. Neither proposed exception is approved by silence.
4. Complete cleanup review, final checks and atomic commits; integrate/deploy the source corrections
   through the authorized release handoff. Production remains read-only.
5. Re-verify the actual deployed Preview SHA/content and obtain human reference acceptance. Until
   then, the task remains open.

## Verification and closure

- Reuse `visual:parity:*`, the registry, comparator and accepted manifest. No second baseline
  system, automatic acceptance, increased tolerances, or hidden content.
- Cover all 30 registered routes and discovered additions in Local and deployed Preview at 390x844
  and 1440x900. Cover Xareni, Ayrin, Ana Sofia, Abril, America, Romina and the Celestial demo also
  at 414x896.
- Verify complete pages and sections: order, fonts, images/crops, CSS loading, reveal, navigation,
  lightbox and overflow. Bind evidence to deployment, content versions, browser and capture hashes.
- Preserve existing negative coverage for missing/corrupt references, incomplete inventory, semantic
  differences and unstable captures.
- Verify public reading and synthetic RSVP in an appropriate controlled environment. Do not copy
  guest or RSVP records or mutate Production.
- Run focused regressions, type checks and successful final `pnpm run ci` after the last edit.
- Close only with every case matching or covered by an exact approved exception, no unresolved
  ERROR/UNSTABLE/missing case, verified Local/Preview integrity, and human acceptance of the final
  deployed reference set. Report unverified environments separately.

## Cleanup boundary

- Removed three unused duplicate scratch runners for Preview SHAs 7c499, 2b3 and f939 after checking
  that they differed only in SHA/URL and had no active documentation/tool references.
- Preserve their reports and source proofs. Use the existing CLI instead of creating another
  permanent runner or reference mechanism.
- Archive superseded narration; active instructions must describe current state.
- Remove shipped code, tests or dependencies only with evidence of no active consumer or a covered
  replacement. Preserve migrations and media referenced by published content or drafts.
- Finish the existing Git Safety session after mutable work. Stage exact paths and commit atomic
  units; do not infer push, integration or Production authority.
