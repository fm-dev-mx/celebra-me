# 💎 Workflow: Gerardo Structural Remediation

This workflow implements the structural improvements and gap closures identified in the
`structural-audit-gerardo-2026-02-13.md` report. It focuses on achieving a "Premium Crescendo"
narrative and fixing data redundancies.

## Phase 1: Data Hardening & Fixes

1.  **Redundancy Check**: Open `src/content/events/cumple-60-gerardo.json` and verify the `family`
    section. Ensure `Trinidad Orduño` (Spouse) is not inadvertently listed in the `parents` section
    unless explicitly intended as an "In Memory" honor.
2.  **Gap Closure (Content)**:
    - Add a `dressCode` field to the `cumple-60-gerardo.json` data (e.g., within `location` or a new
      section).
    - If guests are traveling, add an `accommodations` array to the JSON.
3.  **Navigation Sync**: Update the `navigation` array in the JSON to match the new proposed
    sequence anchor links.

## Phase 2: Narrative Reordering (Architectural)

1.  **Component Sequencing**: Modify `src/pages/[eventType]/[slug].astro` to reorder the components
    in the `<main>` block:
    -   1. `Hero`
    -   2. `Quote`
    -   3. `Family`
    -   4. `Gallery` (**MOVE UP**)
    -   5. `Countdown`
    -   6. `EventLocation`
    -   7. `Itinerary`
    -   8. `RSVP`
    -   9. `Gifts` (**MOVE DOWN**)
    -   10. `ThankYou`
2.  **Visual Break Audit**: After reordering, check for color block clashes (e.g., two consecutive
    dark sections). Adjust `sectionStyles` in the JSON if necessary to maintain balance.

## Phase 3: Content Component Updates

1.  **Dress Code Integration**:
    - Update `EventLocation.astro` or create a small `DressCode` component to display the new
      information.
2.  **Gallery Payoff**: Ensure the `Gallery` section has a smooth entrance animation as it now acts
    as the emotional payoff following the `Family` section.

## Phase 4: Verification

1.  **Visual Confirmation**: Start the dev server and navigate to `/cumple/cumple-60-gerardo`.
2.  **Scroll Narrative**: Verify that the flow feels like a "crescendo" (Emotional Heart ->
    Logistical Details).
3.  **Link Integrity**: Click all navigation links to ensure they scroll to the correct (newly
    ordered) sections.

## Phase 5: Closure

1.  Update `docs/implementation-log.md` with the implementation details.
2.  **Self-Archive**: Move this workflow to `.agent/workflows/archive/` once the changes are
    verified.

// turbo

> [!IMPORTANT] **Critical Reflection: Sequential Locking**
>
> - **Friction Point**: The order in `[slug].astro` is global for all events. If other events (like
>   Demo XV) rely on the same order, this change might affect them. However, since the sections are
>   conditionally rendered (e.g., `data.sections?.gallery`), the sequence only matters when they
>   _are_ present.
> - **Risk**: The `Gallery` section might have a different default background than `Family`,
>   potentially causing a jarring jump if not visually balanced.
