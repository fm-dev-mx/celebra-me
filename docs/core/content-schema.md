# Content Schema

## Overview

Event content schemas are assembled in `src/content.config.ts` (Astro content collections entry
point) from modular Zod definitions under `src/lib/schemas/content`. The schemas are the source of
truth; per-section fields are summarized in
[Section Contracts](../domains/content/section-contracts.md).

## Module Boundaries

- `base-event.schema.ts`: top-level event assembly and cross-section rules (`countdown` and
  `memories` must have data when `sectionOrder` lists them)
- `shared.schema.ts`: assets, focal points, theme, root fields (`sectionOrder`, `eventTiming`,
  `composition`, `_assetSlug`), and the `quote`, `countdown`, `thankYou`, `music`, `sharing`, and
  `navigation` sections
- `hero.schema.ts`: hero and celebrant metadata
- `envelope.schema.ts`: envelope/reveal configuration
- `location.schema.ts`: canonical venue array (`venues[]`), map, indication, and structural variant
  schemas. Legacy `ceremony` and `reception` root properties are rejected in canonical content and
  converted exclusively at ingress.
- `family.schema.ts`: family and relationship groups
- `itinerary.schema.ts`: itinerary event schedule
- `gallery.schema.ts`: gallery image items
- `gifts.schema.ts`: gift option variants
- `rsvp.schema.ts`: RSVP payload, personalized access pass, canonical section variant, and label
  overrides
- `memories.schema.ts`: entry point to the event memory space (`publicSlug`)
- `interludes.schema.ts`: interlude section configuration

## Root Fields

| Field              | Status    | Notes                                                                       |
| ------------------ | --------- | --------------------------------------------------------------------------- |
| `eventType`        | Required  | One of `EVENT_TYPES` (`src/lib/theme/theme-contract.ts`)                    |
| `title`            | Required  | Event title                                                                 |
| `theme.preset`     | Required  | One of `THEME_PRESETS`; no default                                          |
| `theme.fontFamily` | Defaulted | `serif` \| `sans`, default `serif`                                          |
| `sectionOrder`     | Required  | Non-empty array of render section keys; see [Section Order](#section-order) |
| `composition`      | Required  | `{}` is valid; `intersections` defaults to `{}`, `ornaments` optional       |
| `hero`             | Required  | Only required section                                                       |
| `isDemo`           | Defaulted | `false`                                                                     |
| `eventTiming`      | Optional  | `localDateTime`, `timeZone`, `startsAtUtc`                                  |
| `_assetSlug`       | Optional  | Legacy asset namespace; see below                                           |

Other optional root fields: `description`, `templateId`, `visualProfileId`, `navigation`, and every
section key except `hero`. The root object is strict: unknown keys are rejected.

- **Theme preset**: the event adapter (`src/lib/adapters/event.ts`) throws on a preset outside
  `THEME_PRESETS`. `envelope.variant` falls back to `theme.preset`; see the envelope precedence in
  [Section Contracts](../domains/content/section-contracts.md#2-envelope-envelope).
- **`_assetSlug`**: optional. Demos and legacy definitions that predate
  `src/assets/invitations/<slug>/` use it to name their asset namespace; new definitions do not
  declare it.

## Deprecation Policy

RSVP copy overrides live under `rsvp.labels`.

- `labels.name`
- `labels.guestCount`
- `labels.attendance`
- `labels.confirmButton`
- `labels.phone`
- `labels.notesLabel`
- `labels.notesPlaceholder`

Keep UI-facing values in Spanish when content overrides visible RSVP copy.

## Image Layout Fields

The following fields are used to control the presentation of images across various sections.

### `focalPoint`

Defines the `object-position` of the focal area of an image.

- **Supported in**: `hero`, `interludes`, `family`, `thankYou`, `location` (venue images), and
  `gallery` (per item). `hero` and gallery items also accept `focalPointMobile`, `focalPointTablet`,
  and `focalPointDesktop`; interludes accept `focalPointDesktop`.
- **Valid values**: CSS `object-position` compatible strings.
  - Percentages: `"50% 38%"`
  - Keywords: `"center top"`, `"left 20%"`
  - Single values: `"center"`, `"left"`
- **Default**: `"center"`

### `overlayAnchor` and `overlaySafeArea` (Thank You only)

Use these when a thank-you section places copy over a full-bleed photo and the subject must stay
clear.

- **`overlayAnchor` valid values**: `"left"`, `"right"`, `"top"`, `"bottom"`
- **`overlaySafeArea` valid values**: `{ "x": 0.38, "y": 0.24, "width": 0.34, "height": 0.34 }`
- Values are normalized image coordinates from `0` to `1`.
- `x + width` and `y + height` must stay within `1`.
- Mark the protected subject area, usually the face/head region. The overlay should anchor outside
  that area.
- For subject-aware full-bleed thank-you layouts, provide `overlayAnchor` and `overlaySafeArea`
  together so shared styles can position copy without covering the subject.

### `height` (Interludes only)

Defines the minimum height of the interlude section.

- **Valid values**:
  - `"screen"`: 100svh (fills the viewport)
  - `"tall"`: 80svh
  - `"medium"`: compact editorial interlude height
- **Default**: `"screen"`
- Indexed interludes (`data-interlude-index`) honor this contract. Optional theme/profile tokens
  `--interlude-min-height-1` / `--interlude-min-height-2` (and `*-sm` mobile variants) may refine
  coverage per plate without forcing full-viewport height.

## Section Order

The required `sectionOrder` field controls the render order of invitation sections. It is a
non-empty array defined in `shared.schema.ts` over `INVITATION_RENDER_SECTION_KEYS` (exported from
`src/lib/theme/theme-contract.ts`): `quote`, `family`, `gallery`, `countdown`, `location`,
`itinerary`, `rsvp`, `gifts`, `thankYou`, `memories`, and `personalizedAccess`.

```jsonc
// Example section order (`personalizedAccess` must be explicit)
"sectionOrder": ["quote", "location", "countdown", "family", "itinerary", "gallery", "gifts", "personalizedAccess", "rsvp", "thankYou"]
```

### Rules

- **Required** (at least one entry). The renderer follows the array verbatim; `personalizedAccess`
  must be explicitly listed to appear.
- Listing `countdown` requires `countdown.variant`; listing `memories` requires `memories` data.
  Other listed sections without data render nothing.
- Interludes are appended after their `afterSection` parent regardless of the section's position in
  the order.
- Only listed sections are rendered. Unlisted sections with data are silently skipped.

### Choosing an order

- Order follows the event narrative; there is no implicit default.
- Keeping Gifts → PersonalizedAccess → RSVP → ThankYou together is a recommendation, not a schema
  rule: some demos deliberately open with the access pass.

## Key Naming

Content keys are camelCase: section keys, `sectionOrder` entries, `interludes[].afterSection`, and
the variant registry's `section` field (`thankYou`, `personalizedAccess`). Render-only identifiers
are kebab-case: stylesheet paths, `cssOwner` values in `src/lib/invitation/section-variants.ts`,
anchor ids, and the access pass render target. No renames are planned. Keys where the two differ:

| Content key          | Render / CSS identifiers                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `thankYou`           | `sections/thank-you/`, `_thank-you.scss`, `section-base:thank-you`, `#thank-you-section`                                         |
| `personalizedAccess` | `sections/personalized-access/`, `section-base:personalized-access`, render target and `data-section-kind` `personalized-access` |

`thankYou` keeps its camelCase key as `data-section-kind` and as a `composition.intersections` key;
`personalizedAccess` uses `personalized-access` there
(`src/lib/invitation/composition-contract.ts`). Interlude targets follow the content key
(`interlude-after-thankYou`, `interlude-after-personalizedAccess`).
