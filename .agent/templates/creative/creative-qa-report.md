---
template: creative-qa-report
purpose: Checklist and report for reviewing creative outputs before delivery
version: 1.0.0
brand: celebra-me
---

# Creative QA Report

## Item Under Review

| Field                    | Value                                                            |
| ------------------------ | ---------------------------------------------------------------- |
| **Campaign**             |                                                                  |
| **Asset type**           | Reel / Social / Carousel / Image / Video frame / UI / Invitation |
| **Brand**                | Celebra-me                                                       |
| **Reviewer**             |                                                                  |
| **Date**                 |                                                                  |
| **Brief**                |                                                                  |
| **Baseline**             |                                                                  |
| **Post-change evidence** |                                                                  |
| **Required viewports**   |                                                                  |

## Copy QA

| Check                            | Pass/Fail | Notes |
| -------------------------------- | --------- | ----- |
| Spanish language throughout      |           |       |
| Formal "usted" register          |           |       |
| No English in guest-facing text  |           |       |
| Tone consistent with brand brief |           |       |
| CTA is clear and actionable      |           |       |
| No invented client data          |           |       |
| Appropriate for event type       |           |       |
| No spelling or grammar errors    |           |       |

## Visual QA (images)

| Check                                     | Pass/Fail | Notes |
| ----------------------------------------- | --------- | ----- |
| No plastic-looking skin                   |           |       |
| Natural lighting and shadows              |           |       |
| Composition is balanced                   |           |       |
| Colors match brand palette                |           |       |
| No artifacts or deformities               |           |       |
| Resolution sufficient for intended use    |           |       |
| Style consistent with other assets in set |           |       |

## UI / Invitation Visual QA

When reviewing shipped invitation or marketing UI (not only generated images), also apply the
`frontend-design` Visual Critique / Polish Checklist (brand-first viewport, one job per section,
theme tokens, hierarchy, spacing, contrast/focus, reduced-motion, Spanish copy fit, distill).

Use `Pass`, `Fail`, `Blocked`, or `N/A`. A pass requires evidence at every viewport named by the
brief; `Blocked` identifies evidence or environment that could not be obtained.

| Area                                                                         | Status | Affected section / viewport | Evidence and notes |
| ---------------------------------------------------------------------------- | ------ | --------------------------- | ------------------ |
| Reference fidelity and approved deviations                                   |        |                             |                    |
| Responsive behavior and reflow                                               |        |                             |                    |
| Content legibility, contrast, and focus                                      |        |                             |                    |
| Typography hierarchy and consistency                                         |        |                             |                    |
| Image resolution, crop, focal point, and treatment                           |        |                             |                    |
| Layout rhythm, alignment, and spacing                                        |        |                             |                    |
| Component, token, preset, and theme consistency                              |        |                             |                    |
| Accessibility-relevant visual behavior and reduced motion                    |        |                             |                    |
| Cross-page, cross-section, or sibling-preset regressions                     |        |                             |                    |
| Rendered technical defects, overflow, broken assets, or interaction failures |        |                             |                    |
| Production UI contains no temporary placeholder assets                       |        |                             |                    |
| `frontend-design` polish checklist completed                                 |        |                             |                    |

## UI / Invitation Findings

Severity: `Critical` blocks safe delivery or core use; `Important` fails an approved criterion or
causes a material regression; `Minor` is observable but does not block acceptance.

| ID  | Severity | Status                    | Section / viewport | Source file / line | Criterion | Expected | Actual | Evidence | Revision owner |
| --- | -------- | ------------------------- | ------------------ | ------------------ | --------- | -------- | ------ | -------- | -------------- |
|     |          | Open / Resolved / Blocked |                    |                    |           |          |        |          |                |

## Technical QA

| Check                                | Pass/Fail | Notes |
| ------------------------------------ | --------- | ----- |
| Generation parameters logged         |           |       |
| Seed recorded for reproducibility    |           |       |
| File format and size appropriate     |           |       |
| Aspect ratio matches target platform |           |       |

## Issues Found

Use this summary for non-UI assets. UI and invitation findings belong in the evidence table above.

### Critical (must fix before delivery)

1.

### Important (should fix)

1.

### Minor (nice to have)

1.

## Overall Assessment

| Verdict    | Description                                              |
| ---------- | -------------------------------------------------------- |
| ✅ Pass    | Every required area and acceptance criterion passes      |
| ❌ Fail    | One or more criteria fail; revision evidence is required |
| ⛔ Blocked | Required input, environment, or evidence is unavailable  |

## Notes / Recommendations
