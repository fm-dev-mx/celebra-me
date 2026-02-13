---
description: Structural Audit for Gerardo's Invitation (Luxury Hacienda)
---

# 💎 Workflow: Gerardo Structural Audit

This workflow focuses on the editorial and structural evaluation of Gerardo's 60th birthday
invitation. It analyzes section adequacy, sequence logic, and content gaps to ensure a premium
"Luxury Hacienda" experience.

## Phase 1: Structural Inventory

1. **Source of Truth**: Read `src/content/events/cumple-60-gerardo.json` to identify active sections
   and their configurations.
2. **Sequential Mapping**: Read `src/pages/[eventType]/[slug].astro` to map the exact rendering
   order of components.
3. **Visual Verification**: Start the dev server and navigate to `/cumple/cumple-60-gerardo` to
   experience the current flow.

## Phase 2: Adequacy & Hierarchy Evaluation

Analyze the following criteria:

- **Tone & Context**: Are the sections appropriate for a 60th birthday? (e.g., Is "Family"
  prioritized enough? Is "Gallery" too early or too late?).
- **Redundancy Sweep**: Is there any overlapping information between "Hero", "Quote", and
  "ThankYou"?
- **Gaps Identification**:
    - Is there a need for a "Accommodations" section if guests are traveling?
    - Is the "Dress Code" clearly defined or should it have its own micro-section/callout?
    - Is "Registry" (Gifts) handled according to the premium etiquette?

## Phase 3: Logical Sequence Audit

Review the narrative flow:

1. **Discovery**: Envelope → Header → Hero (The "Hook").
2. **Emotional Connection**: Quote → Countdown → Family.
3. **Logistics**: Location → Itinerary → Gifts.
4. **Closure**: Gallery → RSVP → ThankYou.

_Is the transition from "Family" to "Location" too abrupt? Should "Gallery" be moved to the
"Emotional Connection" phase?_

## Phase 4: Adjustment Proposals

1. **Draft Recommendations**: Create a report in `reports/structural-audit-gerardo-[DATE].md`
   detailing:
    - [ ] Sections to Add/Remove.
    - [ ] Proposed New Order.
    - [ ] Content Adjustments (Copywriting/Typography).
2. **Architectural Impact**: Identify if ordering changes require modifications to `[slug].astro` or
   just JSON toggles.

## Phase 5: Closure

1. Update `docs/implementation-log.md` with the audit findings.
2. **Self-Archive**: Move this workflow to `.agent/workflows/archive/` once the structural changes
   are approved or implemented.

// turbo

> [!IMPORTANT] **Critical Reflection: Structural Complexity & Narrative Intent**
>
> - **Friction Point**: The section order is hardcoded in `[slug].astro`. While data can
>   enable/disable sections, changing the sequence requires code edits, not just JSON configuration.
>   The workflow must account for this "Architectural Locking".
> - **Aesthetic Risk**: "Luxury Hacienda" relies on a specific "Crescendo" (Slow Reveal → Emotional
>   Core → Logistics). Abrupt jumps between "Registry" and "Family" could break the premium
>   immersion.
> - **Refinement Priority**: The audit should focus on whether "Gallery" acts as a distraction or a
>   payoff. In 60th birthdays, "Legacy" (Family/Gallery) is often more important than "Party"
>   (Music/Itinerary) details.
