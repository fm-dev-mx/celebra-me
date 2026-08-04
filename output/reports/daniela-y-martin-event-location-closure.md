# Perla `event-location` — final closure

Scoped presentation refinement for `daniela-y-martin` map preview / navigation hierarchy. No
venue payload, URL, or shared provider-button capability was removed.

## Contract preserved

| Rule                                             | Status                                                |
| ------------------------------------------------ | ----------------------------------------------------- |
| `showNavigationButtons` optional, default `true` | Preserved (`presentation-options.ts`, schema default) |
| Perla alone sets `showNavigationButtons: false`  | Preserved (`daniela-y-martin.ts` provision)        |
| Other invitations keep provider buttons          | Confirmed via jewelry-box control                     |
| Shared `VenueCard` provider buttons retained     | Still rendered when `showNavigationButtons !== false` |

## Perla interaction hierarchy

- Linked map preview (`a.event-location__card-map-preview--link`) is the sole navigation action
- Address copy remains the only secondary action
- Provider button container is not rendered

## Visual refinements (Perla-scoped)

Applied in `src/styles/invitation-profiles/daniela-y-martin.scss`:

1. **Pin** — smaller marker anchored to the plate corner (`inset: auto 0.7rem 0.55rem auto`) so
   church spire/cross/door and hall entrance stay readable
2. **Background** — single parchment field; diagonal “road” bands removed; quiet rectilinear grid
   only
3. **Artwork** — church / hall silhouettes retained and slightly clarified
4. **“Ver mapa”** — label + arrow grouped in `.event-location__card-map-preview-action` and centered
   as one understated affordance

Shared-safe additions:

- `VenueCard.astro` wraps the linked-preview foot action (linked path only)
- `_event-location.scss` adds minimal foot / action base styles for that path

## Verification

### DOM contract (Playwright)

```text
pnpm exec playwright test tests/e2e/event-location-navigation-contract.spec.ts
```

With an existing local server: `$env:PLAYWRIGHT_REUSE_EXISTING_SERVER = 'true'`.

Result: **2/2 passed**

- Perla: 0 navigation-button containers, 0 `.event-location__nav-button`, 2 linked previews, 2
  action clusters, 2 copy buttons, church + hall artwork present
- Control (`demo-boda-jewelry-box-wedding`): 2 provider containers, Google Maps buttons, 2 copy
  buttons, 0 linked full-preview plates

### Payload / adapter

```text
pnpm test -- tests/content/daniela-y-martin-payload.test.ts
```

Result: **8/8 passed** (Perla opt-out + control default `true`).

### Screenshots

```text
pnpm screenshot --url=/boda/daniela-y-martin --type=invitation --sections=location --viewport=mobile-standard,desktop --output=output/playwright/daniela-y-martin/event-location-closure --clean

pnpm screenshot --url=/boda/demo-boda-jewelry-box-wedding --type=invitation --sections=location --viewport=mobile-standard,desktop --output=output/playwright/demo-boda-jewelry-box-wedding/event-location-closure --clean
```

Artifacts (repo-relative; under gitignored `output/playwright/`):

| Subject | Viewport        | Path                                                                                                             |
| ------- | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Perla   | mobile-standard | `output/playwright/daniela-y-martin/event-location-closure/mobile-standard/06-section-location.png`           |
| Perla   | desktop         | `output/playwright/daniela-y-martin/event-location-closure/desktop/06-section-location.png`                   |
| Control | mobile-standard | `output/playwright/demo-boda-jewelry-box-wedding/event-location-closure/mobile-standard/06-section-location.png` |
| Control | desktop         | `output/playwright/demo-boda-jewelry-box-wedding/event-location-closure/desktop/06-section-location.png`         |

Visual read:

- Perla: no provider buttons; corner pin; coherent parchment preview; distinct church/hall art; “VER
  MAPA →” reads as one action; copy secondary
- Control: prior provider-button + map-preview treatment unchanged

### Gates

| Command                                                | Result                             |
| ------------------------------------------------------ | ---------------------------------- |
| `pnpm exec prettier --write` (changed files)           | Clean                              |
| `pnpm exec stylelint` (Perla + `_event-location` SCSS) | Passed                             |
| `pnpm exec eslint` (VenueCard + e2e spec)              | Passed                             |
| `pnpm validate:changed`                                | Passed                             |
| `pnpm build:app`                                       | Passed                             |
| `pnpm type-check`                                      | Failed — baseline only (see below) |
| `pnpm agent:git-safety:check`                          | Run at session close               |

### Baseline type-check isolation

`pnpm type-check` reports only:

```text
tests/unit/observability-batch.test.ts:8  ts(2554)
tests/unit/observability-batch.test.ts:36 ts(2556)
```

Proof these are not introduced by this change:

```text
git diff HEAD -- tests/unit/observability-batch.test.ts
# (empty — file unmodified in this working tree)

git log -1 --oneline -- tests/unit/observability-batch.test.ts
# b724c24e feat(status): add shared status-core and optimize managed-status probes
```

None of the four files in this change appear in the type-check diagnostics.

## Files touched

- `src/components/invitation/components/VenueCard.astro`
- `src/styles/invitation-profiles/daniela-y-martin.scss`
- `src/styles/invitation/_event-location.scss`
- `tests/e2e/event-location-navigation-contract.spec.ts`

## Acceptance checklist

- [x] Perla alone suppresses provider buttons
- [x] Other invitations retain provider-button behavior / treatment
- [x] No shared capability removed for a Perla-only need
- [x] Map preview remains sole Perla navigation action
- [x] Copy-address remains accessible and secondary
- [x] Pin no longer covers architectural focal details
- [x] Preview background uses one coherent visual language
- [x] Church and reception artwork remain distinguishable
- [x] “Ver mapa” + arrow read as one affordance
- [x] Same markup / hierarchy on mobile and desktop
- [x] Fresh Perla + control screenshots confirm isolation
- [x] Relevant validation / build gates pass with no new errors
