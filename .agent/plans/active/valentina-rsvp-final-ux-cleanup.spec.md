# SDD: Valentina RSVP — Final UX Cleanup Pass

**Agent**: hermes **Date**: 2026-06-28 **Asset**: `/xv/valentina-hernandez` **Theme**:
`editorial-magazine` / Valentina pink-silver-charcoal palette

---

## Current Visual/UX Problems

1. **RSVP header too large and redundant on mobile** — stacks 5 labels on small screens:
   - `CONFIRMACIÓN DE ASISTENCIA` (access-kicker)
   - `RSVP PRIVADO` (eyebrow)
   - `◆` (separator)
   - `Confirma tu asistencia` (title, ~2.1rem)
   - `ACCESO PRIVADO · EDICIÓN XV` (edition-label)
   - explanatory paragraph (subcopy)

   At 390px viewport this creates excessive vertical consumption before form fields, fighting the
   "fast confirmation" goal.

2. **Invalid SCSS values** — Line 1658 in `_xv-valentina-hernandez.scss`:

   ```scss
   .rsvp__country-code {
     background-color: none;
   }
   ```

   `none` is not a valid value for `background-color`; renders as a no-op/invalid property.

3. **Phone prefix (`+52`) looks like a captured value** — the country-code `<select>` inherits
   `border: none; border-bottom: 1px solid ...` from the editorial-magazine theme, making it
   visually identical to a typed input.

4. **Dedication placeholder too low-contrast** — `--rsvp-placeholder-color` maps to
   `--color-text-muted` which is derived from `--v-ink-rgb` (dark charcoal). On the dark RSVP
   background (`--v-ink`), a dark placeholder is nearly invisible.

5. **"Cambiar" button has inadequate mobile tap target** — the button uses `display: inline` with
   `padding: 0.2rem 0.5rem` and `font-size: 0.58rem` on mobile, yielding ~15px total height — well
   below the 44px mobile touch guideline.

6. **Phone-required ambiguity** — `phoneRequired` is hard-coded to `false` in the submission hook.
   Phone is never required for validation but is sent to the API if provided.

---

## Scope

- Fix all 6 problems above via CSS overrides in the valentina-scoped SCSS file.
- Minor SCSS adjustments in `_rsvp.scss` if a base CSS contract needs fixing.
- Document the phone-required recommendation — no behavioral change to validation logic.

## Non-Goals

- No React/TSX structural changes to `RSVPComponents.tsx` or `RSVPFormFields.tsx` unless semantics
  require it.
- No changes to `rsvp-logic.ts` or `use-rsvp-submission.ts`.
- No changes to the editorial-magazine base theme file (`_editorial-magazine.scss`).
- No changes to the RSVP form validation rules.
- No staging, committing, pushing, deploying, or production commands.

## Implementation Strategy

All changes land in **one file**:

- `src/styles/themes/sections/_xv-valentina-hernandez.scss`

The file is scoped to `.event--valentina-hernandez.theme-preset--editorial-magazine`, so overrides
affect only this invitation.

### 1. Fix invalid SCSS value

Replace `background-color: none;` with `background-color: transparent;` on `.rsvp__country-code`.

### 2. Mobile header compression (≤640px)

Inside the existing `@media (width <= 640px)` block:

- `display: none` on `.rsvp__access-kicker`, `.rsvp__separator`, `.rsvp__edition-label`
- Repurpose `.rsvp__eyebrow` to display the merged "RSVP PRIVADO · EDICIÓN XV" via `::before`
  pseudo-element
- Reduce `.rsvp__title` size to `clamp(1.25rem, 5.5vw, 1.55rem)`
- Reduce `.rsvp__subcopy` size and max-width
- Reduce `.rsvp__header` padding-bottom

### 3. Phone prefix visual treatment

Within the `.rsvp__field` context:

- Remove the input-like border-bottom from the editorial-magazine select styling
- Add a subtle right separator (`border-right`) to visually separate the prefix from the phone input
- Mute the color to `rgb(var(--v-white-rgb) / 48%)`
- Compact sizing with `width: auto; min-width: 0`

### 4. Placeholder contrast

Within the `.rsvp__field input, textarea` block:

- Add `&::placeholder { color: rgb(var(--v-white-rgb) / 38%); }` — subtle white on dark background,
  readable but not as strong as actual input text.

### 5. "Cambiar" mobile tap target

Inside the `@media (width <= 640px)` block:

- Change `display` to `inline-flex` with `align-items: center`
- Set `min-height: 44px`
- Adjust padding block to ensure visual compactness
- Flexbox parent handles vertical alignment

### 6. Phone-required evaluation

Document in this spec. No code change for this pass.

## Accessibility Considerations

- `aria-describedby` on input fields is preserved — no JSX changes.
- Error semantics (`role="alert"`) preserved.
- "Cambiar" button retains `type="button"` semantics.
- Keyboard navigation: focus styles are inherited from the editorial-magazine theme.
- Placeholder contrast improved from nearly-invisible to `rgb(white / 38%)` — meets WCAG for
  placeholder:placeholder contrast with both its own background and adjacent input text.
- Country code select remains keyboard-accessible via `<select>` element.
- Header reduction reduces visual noise but the `rsvp__eyebrow` is a `<p>` element in a `<header>`
  landmark, ARIA semantics preserved.
- No `sr-only` text changes — the sr-only `RsvpStatusHeader` is unaffected.

## Validation Plan

1. Build: `pnpm build` — must pass with no errors or warnings.
2. Visual: Open `http://localhost:4321/xv/valentina-hernandez` at 390px × 844px (mobile).
3. Checklist at test viewport:
   - [ ] RSVP header is visibly shorter — access-kicker, edition-label, and separator hidden
   - [ ] Eyebrow reads "RSVP PRIVADO · EDICIÓN XV"
   - [ ] Title "Confirma tu asistencia" is ~1.35rem, not ~2.1rem
   - [ ] Subcopy text present and readable
   - [ ] Name, phone, dedication, attendance summary, submit button remain accessible
   - [ ] `+52` reads as a prefix (muted, separated by vertical rule, no input border)
   - [ ] Dedication placeholder visible (white, ~38% opacity)
   - [ ] "Cambiar" button has 44px minimum height for touch
   - [ ] Error message compact and contextual (preserved from previous pass)
   - [ ] Keyboard tab sequence works through the entire form

## Rollback Notes

- All changes are CSS-only in the Valentina-scoped file. Revert by running:
  ```bash
  git checkout -- src/styles/themes/sections/_xv-valentina-hernandez.scss
  ```
- No database or API changes.
- No React/TSX changes — no rollback risk for component logic.

## Files Inspected

- `src/components/invitation/RSVPComponents.tsx`
- `src/components/invitation/RSVPFormFields.tsx`
- `src/components/invitation/RSVP.tsx`
- `src/styles/invitation/_rsvp.scss`
- `src/styles/themes/sections/rsvp/_editorial-magazine.scss`
- `src/styles/themes/sections/_xv-valentina-hernandez.scss`
- `src/components/invitation/rsvp-logic.ts`
- `src/hooks/use-rsvp-submission.ts`

## Files Changed

- `src/styles/themes/sections/_xv-valentina-hernandez.scss`

## Phone-Required Recommendation

**Decision: Leave unchanged.**

`phoneRequired` is hard-coded to `false` in `use-rsvp-submission.ts` line 151. Phone is already
optional for all RSVP responses. The form only sends phone to the API when it has a value (line 259:
`...(normalizedPhone ? { phone: normalizedPhone, countryCode } : {})`).

To make phone required for "No podré asistir" (declined), the validation callback in
`use-rsvp-submission.ts` would need to conditionally set
`phoneRequired: attendanceStatus === 'confirmed'` or similar, plus the `validateRsvpForm` function
already accepts `phoneRequired` so it would work. The validation in `rsvp-logic.ts` lines 226-233
shows:

```typescript
if (phoneRequired && !normalizedPhone) {
  errors.phone = 'Por favor, escribe tu teléfono.';
}
```

If a future requirement asks for phone-required-on-declined, this is a one-line change in the
`validate` callback. For now, there is no clear product driver, and making phone required for
declined responses could increase friction for guests who can't attend — which is counterproductive.
**Recommendation: Keep phone optional for all responses.**
