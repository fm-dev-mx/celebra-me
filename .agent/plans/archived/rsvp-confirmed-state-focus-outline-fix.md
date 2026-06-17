---
title: RSVP Confirmed-State Focus Outline Fix
status: implemented
created: 2026-06-17
updated: 2026-06-17
related_docs:
  - docs/core/architecture.md
supersedes: []
superseded_by: []
implementation_note:
  CSS outline fix applied to _rsvp.scss (line 649) using `&__status[tabindex='-1']:focus` —
  attribute qualifier scopes suppression to programmatic, non-tabbable focus only. Also removed dead
  code (3 dangling variables, 1 self-referencing var, 4 redundant declarations) and expanded
  prefers-reduced-motion coverage to all transitioned RSVP elements.
---

# RSVP Confirmed-State Focus Outline Fix

## 1. Problem Statement

After a guest responds to an RSVP (confirmed or declined), a rectangular outline/band appears around
the .rsvp\_\_status greeting panel. The artifact disappears after clicking anywhere else on the
page. This is not a layout border -- it is the browser default focus ring on a
programmatically-focused <div>.

## 2. Confirmed Evidence from Repository Inspection

### Focus target

- RSVPComponents.tsx line 259-266: <div className="rsvp__status rsvp__greeting" tabIndex={-1}>
- RSVP.tsx line 255: successRef.current.focus({ preventScroll: true })

### Focus / outline CSS

- \_rsvp.scss line 661-663: .rsvp:focus { outline: none } -- only applies to .rsvp card, not
  children
- \_rsvp.scss line 665-669: .rsvp:focus-visible { box-shadow: ... } -- same scope limitation
- No \*:focus { outline: none } global reset exists

At the .rsvp**status div level, no CSS suppresses the browser default focus outline. Enchanted rose
targets .rsvp**status:focus-visible, but programmatic .focus() on tabindex="-1" triggers :focus, not
:focus-visible, in Chromium -- so the default outline still appears.

### Graphify findings

- domain-rsvp.md confirmed: SubmittedState component, RSVP.tsx, rsvp-logic.ts,
  use-rsvp-submission.ts are the correct scope boundary.
- risk-hubs.md confirms no RSVP component is a high-risk hub.
- No theme-specific RSVP file handles .rsvp\_\_status:focus -- only enchanted-rose handles
  :focus-visible.

## 3. Root-Cause Analysis

### Confirmed cause (high confidence)

The sequence triggering the defect:

1. Guest submits RSVP form.
2. useRsvpSubmission sets submitStatus = 'success', making submitted = true.
3. React renders SubmittedState inside AnimatePresence.
4. Post-submit useEffect in RSVP.tsx:251-257 fires:
   - successRef.current.focus({ preventScroll: true }) <-- this causes the outline
   - scrollRsvpCardIntoView(successRef.current, ...)
5. successRef points to <div className="rsvp__status rsvp__greeting" tabIndex={-1}>.
6. Browsers render a default focus ring around this div.
7. No CSS suppresses this outline at the .rsvp\_\_status level.

### Ranked hypotheses

1. [CONFIRMED] Browser default focus outline on programmatically-focused <div tabIndex={-1}>
   - successRef.current.focus() at RSVP.tsx:255 targeting tabIndex={-1} div at
     RSVPComponents.tsx:262
   - No CSS suppression; disappears on click (focus leaves element)
2. [WEAK] scrollIntoView side effect -- scroll does not cause focus rings
3. [WEAK] Hash navigation to #rsvp -- hash correction only calls scroll, not focus
4. [WEAK] data-state="confirmed" CSS -- no theme uses this for borders on .rsvp\_\_status

## 4. Minimal Implementation Strategy

### Primary fix (base RSVP styles)

Add outline: none to .rsvp\_\_status:focus in \_rsvp.scss. Since this element is non-interactive
(role="status", tabIndex={-1}, not keyboard-reachable), suppressing its focus outline is safe.

Approach: Add at end of .rsvp block in \_rsvp.scss: &\_\_status { &:focus { outline: none; } }

### Secondary fix (optional, recommended)

Move focus from .rsvp\_\_status to the <h2> greeting heading inside it after submission. This
provides a more meaningful focus target for screen-reader users. Requires: adding ref to greeting h2
in SubmittedState, changing successRef to target heading.

### What NOT to do

- Do not use outline: none globally -- would hide focus on interactive controls.
- Do not remove tabIndex={-1} -- needed for scrollIntoView positioning.
- Do not remove role="status" or aria-live="polite" -- correct for screen readers.
- Do not add per-theme hacks -- fix belongs in base RSVP styles.
- Do not focus first interactive element on submit -- would hijack user flow.

## 5. Files Likely to Change

- src/styles/invitation/\_rsvp.scss -- add .rsvp\_\_status:focus { outline: none }
- src/components/invitation/RSVPComponents.tsx -- (optional) add ref to greeting h2
- src/components/invitation/RSVP.tsx -- (optional) adjust successRef target

## 6. Visual/Functional Test Matrix

Viewport x RSVP state x Location mode x Theme:

1. 430px mobile, confirmed, public, Default -- Submit, check no outline
2. 430px mobile, confirmed, after-rsvp, Enchanted Rose -- Submit, check no outline
3. 430px mobile, declined, none, Celestial Blue -- Submit, check no outline
4. 430px mobile, editing/cancel, after-rsvp, Jewelry Box -- full edit cycle
5. Desktop 1280px, confirmed, public, Angelic Presence -- Submit, check no outline
6. Desktop 1280px, confirmed, after-rsvp, Premiere Floral -- Submit, check no outline
7. Desktop 1280px, declined, none, Editorial -- Submit, check no outline
8. Desktop 1280px, editing/change, after-rsvp, Luxury Hacienda -- full edit cycle
9. Desktop 1280px, confirmed, after-rsvp, Sacred Keepsake -- hash nav #rsvp on load
10. Desktop 1280px, confirmed, public, Enchanted Rose -- pre-submitted load
11. 430px mobile, confirmed, no location, Default -- verify AddToCalendar hidden

Focus checks:

- F1: Submit RSVP -- no visible outline on .rsvp\_\_status
- F2: Click outside -- no outline change (already clean)
- F3: Tab through elements -- focus rings visible on buttons, links, inputs
- F4: Tab navigation -- .rsvp\_\_status not Tab-reachable (tabIndex={-1})
- F5: Screen reader -- role="status" aria-live="polite" announces greeting

## 7. Accessibility Considerations

Fix is safe because:

- .rsvp\_\_status has tabIndex={-1} -- not Tab-reachable
- role="status" aria-live="polite" handles screen-reader announcement
- Removing visual outline on a non-interactive container does not affect keyboard users
- All interactive controls retain :focus-visible and :focus styles

Preferred: use outline: none on .rsvp\_\_status:focus only (same pattern as .rsvp itself at line
661).

## 8. Risks and Trade-offs

- Hiding focus indicator: LOW -- tabIndex={-1}, not Tab-reachable. Scoped to .rsvp\_\_status only.
- Shared RSVP styles across themes: LOW -- fix in base \_rsvp.scss, inherited by all themes.
- Protected location leak: NOT AFFECTED -- server-side gating.
- Calendar regression: NOT AFFECTED -- separate button class.
- CI failure: NONE -- CSS-only change.

## 9. Validation Commands

pnpm type-check pnpm lint:style pnpm test tests/components/RSVP.test.tsx pnpm test
tests/components/AddToCalendarButton.test.tsx pnpm test tests/unit/use-gated-location.test.ts pnpm
test pnpm agent:git-safety:check

Manual browser verification across multiple themes is required.

## 10. Acceptance Criteria

1. No rectangular outline/band around .rsvp\_\_status after load, hash nav, or submit.
2. Keyboard users still get visible focus indication on interactive elements.
3. Post-RSVP elements consistent across all 8 invitation themes.
4. AddToCalendar, location, Ver ubicacion, Cambiar mi respuesta, cancel/edit maintain hierarchy.
5. No protected location details leak before confirmed RSVP.
6. No invitation-specific coupling introduced.
7. pnpm type-check passes.
8. Relevant component tests pass.
9. Targeted tests (not over-engineered).
