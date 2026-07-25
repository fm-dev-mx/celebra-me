---
template: design-reference-brief
purpose: Task-scoped visual context and acceptance contract for UI and invitation design work
version: 1.0.0
brand: celebra-me
---

# Design Reference Brief

Complete this brief before reference-driven visual implementation. Keep it conversation-scoped or in
the active task handoff by default. A real client invitation still requires
`client-invitation-audit` and its two-lane spec; this brief does not replace either.

| Field             | Value                      |
| ----------------- | -------------------------- |
| **Status**        | Draft / Approved / Blocked |
| **Prepared by**   |                            |
| **Approved by**   |                            |
| **Approval date** |                            |

## Surface

| Field                   | Value                                        |
| ----------------------- | -------------------------------------------- |
| **Surface type**        | Real invitation / Demo / Landing / Dashboard |
| **Route or component**  |                                              |
| **Primary user**        |                                              |
| **Guest/user journey**  |                                              |
| **Desired experience**  |                                              |
| **Observable cues**     |                                              |
| **Primary viewport**    | Width × height                               |
| **Secondary viewports** |                                              |

## Current State and References

### Product baseline

- Current route or preview:
- Baseline evidence:
- New surface (if applicable) and closest live internal comparison:
- Existing preset, component, or demo counterpart:
- What already works:
- What is weak or missing:

### Internal references

List the most relevant live component, demo, preset, per-invitation note, or prior verified pattern.

1.
2.

### External inspiration (non-authoritative)

External screenshots, Figma frames, Mobbin examples, or competitor references may communicate
intent, but they never override the Celebra-me brief, live theme contract, or repository patterns.

1.
2.

### Reference interpretation

Record only dimensions that affect implementation or QA. Use `Unsupported` when the references do
not show enough evidence; do not infer silently.

| Dimension                          | Reference evidence | Intended implementation | Status                        |
| ---------------------------------- | ------------------ | ----------------------- | ----------------------------- |
| Visual hierarchy and composition   |                    |                         | Supported / Unsupported / N/A |
| Typography                         |                    |                         | Supported / Unsupported / N/A |
| Color and contrast                 |                    |                         | Supported / Unsupported / N/A |
| Image treatment and focal behavior |                    |                         | Supported / Unsupported / N/A |
| Spacing and layout rhythm          |                    |                         | Supported / Unsupported / N/A |
| Responsive behavior                |                    |                         | Supported / Unsupported / N/A |
| Motion and interaction             |                    |                         | Supported / Unsupported / N/A |

## Focus and Boundaries

| Priority | Target section or element | Desired change | Owning layer |
| -------- | ------------------------- | -------------- | ------------ |
| P0       |                           |                |              |
| P1       |                           |                |              |

Owning layer: copy/data, asset, semantic/component token, section layout/variant, or
invitation-scoped override.

- Authorized files or zones:
- Explicit non-goals:
- Behavior and content that must remain unchanged:
- Copy/data changes and owner:
- Reusable theme decision: None / Lane B / Theme-governance review required

## Assets

| Asset | Status | Source | Production-ready? | Blocker or action |
| ----- | ------ | ------ | ----------------- | ----------------- |
|       |        |        |                   |                   |

Real client assets take precedence over generated placeholders. Mark missing critical assets as
blocking; do not silently ship temporary rectangles, stock stand-ins, or invented client media.

## Deviations and Unresolved Details

| Reference detail | Reason it cannot or should not be matched | Approved substitute | Decision owner | Status             |
| ---------------- | ----------------------------------------- | ------------------- | -------------- | ------------------ |
|                  |                                           |                     |                | Approved / Blocked |

## Acceptance Criteria

Each criterion must be observable. Avoid standalone terms such as “premium,” “polished,” or
“faithful”; state what a reviewer can compare in the rendered result.

| ID  | Section or element | Observable expected result | Required viewport(s) | Evidence source | Verification owner | Pass rule |
| --- | ------------------ | -------------------------- | -------------------- | --------------- | ------------------ | --------- |
| A1  |                    |                            |                      |                 |                    |           |

Include criteria for responsive behavior, legibility/contrast/focus, content preservation, image
quality/treatment, and cross-surface consistency when applicable.

## Stop Conditions

Do not start visual implementation when any applicable condition is unresolved:

- the primary user/journey, desired experience, target surface, or primary viewport is unknown;
- no baseline route, screenshot, or equivalent current-state evidence exists;
- a critical production asset is missing or still classified as a placeholder;
- the target section and desired delta are too broad to form a focused iteration unit;
- a reference conflict or unsupported detail prevents an observable acceptance criterion;
- a real invitation has not classified the work as Lane A or Lane B through
  `client-invitation-audit`;
- parallel tasks would edit the same preset, section variant, layout contract, or file.
