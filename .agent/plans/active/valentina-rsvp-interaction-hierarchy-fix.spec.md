# Spec: Valentina — RSVP interaction hierarchy & progressive disclosure

## Problem

At 390px mobile, after the guest selects "Sí, asistiré", the RSVP remains visually saturated. The
attendance radio cards (Sí / No) still occupy the same vertical space, labels are too dominant, the
editorial grid background competes with form readability, the submit CTA is buried by overall
density, and "Cancelar" looks like a full block CTA. The form feels like a compressed editorial
poster, not a clear confirmation flow.

The previous CSS-only pass reduced spacing but did not change the interaction hierarchy — the
component still shows the radio cards unconditionally, the Cancelar button is still a full secondary
button, and the form structure is unchanged.

## Scope

- `src/components/invitation/RSVPComponents.tsx` — add progressive-disclosure state to collapse
  radio cards into a compact summary after selection
- `src/styles/themes/sections/_xv-valentina-hernandez.scss` — style the summary, reduce label
  weight, cancelar as text, subdue grid background
- The WhatsApp CTA CSS suppression from the previous pass is retained as-is (Valentina-scoped
  `.rsvp__contact-host { display: none; }`)

## Non-goals

- Do not change the data payload (confirmationMode stays "both")
- Do not remove WhatsApp CTA globally
- Do not rewrite RSVP from scratch
- Do not add new full-page components or external dependencies
- Do not change the access/kicker labels or header structure

## Why CSS-only was insufficient

The previous pass reduced spacing (form-gap, radio-card padding, etc.) but could not:

1. **Collapse attendance radio cards** after selection — the AttendanceField renders both
   radio-label cards unconditionally; SCSS cannot remove DOM elements.
2. **Replace radio cards with a compact summary row** — a different DOM structure is needed (a
   summary div + "Cambiar" link instead of two `.rsvp__radio-card` elements).
3. **Convert "Cancelar" from a full block button to a text link** — the button's className
   `.rsvp__secondary-button` carries full-width block styles; overriding every inherited property
   via SCSS is fragile.
4. **Change form-field visibility based on attendance state** — hiding the attendance radio group
   after selection and re-showing on "Cambiar" requires a local state toggle in React.

These are all rendering/state concerns, not visual polish.

## Files changed

| File                                                      | Reason                                                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/components/invitation/RSVPComponents.tsx`            | Add local state for attendance collapse; new summary JSX; change Cancelar className       |
| `src/styles/themes/sections/_xv-valentina-hernandez.scss` | Style summary row; reduce labels; subdue grid; style Cancelar as text; keep WhatsApp hide |

## Implementation plan

### RSVPComponents.tsx — RsvpFormView function

1. Add `const [attendanceCollapsed, setAttendanceCollapsed] = useState(false);`
2. **Before `<AttendanceField>`**: conditionally render:
   - If `attendanceStatus !== null && attendanceCollapsed`:
     `<div className="rsvp__attendance-summary">
     <span className="rsvp__attendance-summary-label">Respuesta</span>
     <span className="rsvp__attendance-summary-value"> {attendanceStatus === 'confirmed' ? 'Sí,
     asistiré' : 'No podré asistir'} </span> <button type="button"
     className="rsvp\_\_attendance-change" onClick={() =>
     setAttendanceCollapsed(false)}>Cambiar</button>
      </div>`
   - Else: render `<AttendanceField>` as before
3. Wrap `onAttendanceChange` locally so that after the parent callback fires,
   `setAttendanceCollapsed(true)` is called.
4. Change "Cancelar" button from `className="rsvp__secondary-button"` to
   `className="rsvp__cancel-link"`.

### \_xv-valentina-hernandez.scss

Attach everything under `.rsvp[data-variant='editorial-magazine']`:

```scss
// Attendance summary row — compact inline row
.rsvp__attendance-summary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid rgb(var(--v-white-rgb) / 22%);
  background: rgb(var(--v-white-rgb) / 5%);
}
.rsvp__attendance-summary-label {
  font-family: var(--font-label);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgb(var(--v-white-rgb) / 52%);
  flex: 0 0 auto;
}
.rsvp__attendance-summary-value {
  font-family: var(--font-label);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--v-white);
  flex: 1;
}
.rsvp__attendance-change {
  flex: 0 0 auto;
  padding: 0.2rem 0.5rem;
  border: 1px solid rgb(var(--v-white-rgb) / 28%);
  border-radius: 0;
  background: transparent;
  color: rgb(var(--v-white-rgb) / 68%);
  font-family: var(--font-label);
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s ease;
  &:hover {
    border-color: var(--v-accent);
    color: var(--v-accent);
  }
}

// Reduce label weight on mobile
@media (width <= 640px) {
  label,
  legend {
    font-size: 0.62rem;
    letter-spacing: 0.14em;
  }
  .rsvp__attendance-summary {
    padding: 0.5rem 0.6rem;
  }
}

// Cancelar as text link — low emphasis
.rsvp__cancel-link {
  display: inline;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 0;
  background: transparent;
  color: rgb(var(--v-white-rgb) / 48%);
  font-family: var(--font-label);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: rgb(var(--v-white-rgb) / 20%);
  cursor: pointer;
  transition: color 0.2s ease;
  min-height: auto;
  width: auto;
  &:hover {
    color: rgb(var(--v-white-rgb) / 78%);
  }
}

// Subdue editorial grid background in form area
.rsvp__form {
  background:
    radial-gradient(circle at 86% 12%, rgb(var(--v-accent-rgb) / 8%), transparent 18rem),
    var(--v-ink);
  background-size: auto, auto;
}
```

### WhatsApp CTA (revisit of previous pass)

The previous CSS suppression `.rsvp__contact-host { display: none; }` is retained. A render-level
prop would require either (a) a new prop on the shared RSVP component or (b) event-specific logic in
`section-render-data.ts`. Both add shared-code surface area for a single-event concern. The CSS
approach is correct for this scope: Valentina-scoped, no side effects, zero JS bundle cost. The
`showWhatsAppCta` boolean remains `true` but the element is rendered display:none, which is
functionally identical to not having it for both sighted and AT users (display:none removes from
accessibility tree).

## Acceptance criteria

1. At 390px after selecting Sí/No, radio cards collapse into a 1-line summary row
2. "Cambiar" re-shows radio cards without losing typed data
3. Labels are visibly lighter on mobile
4. Cancelar is a thin underline text link, not a block button
5. Submit button is the dominant visual action
6. WhatsApp CTA absent in Valentina success state
7. No regression on non-Valentina editorial-magazine RSVPs
8. `pnpm build` passes

## Validation plan

1. `pnpm agent:git-safety:check`
2. `pnpm build`
3. Manual inspection at 390px: attendance collapse, summary row, Cancelar as text, submit dominance
4. Confirm WhatsApp CTA absent
5. `pnpm run lint`
6. Relevant RSVP tests if any

## Rollback

- `git checkout -- src/components/invitation/RSVPComponents.tsx` to revert component
- `git checkout -- src/styles/themes/sections/_xv-valentina-hernandez.scss` to revert styles
