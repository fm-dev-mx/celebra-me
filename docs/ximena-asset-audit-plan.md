# Ximena Asset Audit Plan

## Technical Findings

This audit is intentionally read-only. Findings below are based on observable repo state in the
`ximena-meza-trasvina` asset subtree and its consumers. Exact `git diff --staged` inspection was
requested, but staged-diff confirmation remains blocked in this shell because Git execution is not
currently available through the session wrapper.

### 1. Filename governance drift

The Ximena asset folder mixes canonical role-centric filenames with event-prefixed filenames:

- Canonical or near-canonical:
  - `signature.webp`
  - `portrait.webp` is not present, but `portrait` exists as a local semantic role in code
- Non-canonical event-prefixed assets:
  - `ximena-portrait-main.webp`
  - `ximena-portrait-alt.webp`
  - `ximena-family.webp`
  - `ximena-gallery-01.webp`
  - `ximena-gallery-02.webp`
  - `ximena-gallery-03.webp`
  - `ximena-gallery-04.webp`
  - `ximena-thank-you.webp`

This diverges from repo conventions in
[docs/core/project-conventions.md](C:/Code/celebra-me/docs/core/project-conventions.md) and from
neighboring event modules, which predominantly use role-centric kebab-case such as `hero.webp`,
`portrait.webp`, `gallery-01.webp`, and `thank-you-portrait.webp`.

### 2. Semantic mismatch in role mapping

In
[src/assets/images/events/ximena-meza-trasvina/index.ts](C:/Code/celebra-me/src/assets/images/events/ximena-meza-trasvina/index.ts),
the event export assigns:

```ts
hero: portrait;
```

This means the `hero` registry role is satisfied by the portrait asset rather than a dedicated hero
file. The shape is technically valid for current consumers, but it weakens the asset-role contract
and obscures future editorial swaps.

### 3. Non-canonical local symbol naming

The same module introduces descriptive local imports that do not align with governed registry roles:

- `galleryWalking`
- `galleryLaughing`
- `detailJewelry`
- `heroAlt`
- `interludeRoses`
- `interludeDress`
- `bgPremiere`
- `bgRSVP`

These names are then funneled into positional `gallery[]` slots or interlude keys. The result is a
disconnect between filename semantics, import symbol names, and the exported asset contract.

### 4. AI partition exists but is only partially normalized

The `ai/` subfolder is a reasonable architectural partition for generated derivatives, but governed
filenames inside it are inconsistent:

- Already role-oriented:
  - `gallery-05.png`
  - `gallery-06.png`
  - `gallery-07.png`
  - `gallery-08.png`
  - `gallery-09.png`
- Narrative/editorial names that should be normalized to governed roles if they remain in the
  registry surface:
  - `gallery-walking.png`
  - `gallery-laughing.png`
  - `detail-jewelry.png`
  - `interlude-roses.png`
  - `interlude-dress.png`
  - `bg-premiere.png`
  - `bg-rsvp.png`

The partition itself is sound. The drift is in the naming contract, not the directory boundary.

### 5. Registry typing is only partially explicit

[src/lib/assets/asset-registry.ts](C:/Code/celebra-me/src/lib/assets/asset-registry.ts) expects
discovery results shaped as:

```ts
EventAssets & { gallery?: ImageMetadata[] }
```

However,
[src/assets/images/events/ximena-meza-trasvina/index.ts](C:/Code/celebra-me/src/assets/images/events/ximena-meza-trasvina/index.ts)
exports an untyped `assets` object. The module happens to be structurally compatible with discovery
today, but it is not explicitly declared against the registry contract, which leaves room for
unnoticed drift such as extra keys like `heroAlt`.

### 6. Export surface contains a non-governed extra key

The Ximena asset module exports `heroAlt`, but `heroAlt` is not present in `EVENT_KEYS` within
[src/lib/assets/asset-registry.ts](C:/Code/celebra-me/src/lib/assets/asset-registry.ts). Because
discovery imports the whole `assets` object, this extra property currently survives at the module
boundary even though the registry flattening logic ignores it.

This is architectural noise and should be removed from the governed export surface unless the
registry is intentionally extended.

### 7. Alias usage is compliant where it matters

The central asset infrastructure is using the `@/` alias correctly:

- [src/lib/assets/asset-registry.ts](C:/Code/celebra-me/src/lib/assets/asset-registry.ts)
- [src/lib/assets/discovery.ts](C:/Code/celebra-me/src/lib/assets/discovery.ts)

The event-local asset module uses relative imports for sibling images, which is acceptable and
should not be treated as a violation.

### 8. Content contract is currently aligned to registry keys

[src/content/events/ximena-meza-trasvina.json](C:/Code/celebra-me/src/content/events/ximena-meza-trasvina.json)
references governed keys such as:

- `hero`
- `portrait`
- `family`
- `jardin`
- `gallery01` through `gallery08`
- `interlude01`
- `interlude02`
- `interlude03`
- `interludeNew01`
- `thankYouPortrait`

This means the remediation can focus on filesystem naming and module-export normalization without
requiring content-schema changes.

## Remediation Plan

### Target Naming Contract

Standardize the Ximena asset set to role-centric kebab-case:

- Root assets:
  - `hero.webp`
  - `portrait.webp`
  - `portrait-alt.webp`
  - `family.webp`
  - `signature.webp`
  - `thank-you-portrait.webp`
  - `gallery-01.webp`
  - `gallery-02.webp`
  - `gallery-03.webp`
  - `gallery-04.webp`
- AI assets:
  - `gallery-05.png`
  - `gallery-06.png`
  - `gallery-07.png`
  - `gallery-08.png`
  - `gallery-09.png`
  - `gallery-10.png`
  - `gallery-11.png`
  - `gallery-12.png`
  - `interlude-01.png`
  - `interlude-02.png`
  - `interlude-03.png`
  - `interlude-04.png`

Optional non-governed alternates should either be excluded from the exported `assets` object or
named as explicitly secondary assets only if they are intentionally out of registry scope.

### Module Contract Normalization

Standardize
[src/assets/images/events/ximena-meza-trasvina/index.ts](C:/Code/celebra-me/src/assets/images/events/ximena-meza-trasvina/index.ts)
to satisfy the discovery contract explicitly:

- Import files using normalized role-centric filenames.
- Rename local symbols so they match their actual registry role:
  - `gallery10`, `gallery11`, `gallery12`
  - `interlude01`, `interlude02`, `interlude03`, `interlude04`
- Export only sanctioned keys used by discovery and `EventAssetKey` consumers:
  - `hero`
  - `portrait`
  - `portraitAlt`
  - `family`
  - `signature`
  - `jardin`
  - `gallery`
  - `interlude01`
  - `interlude02`
  - `interlude03`
  - `interludeNew01`
  - `thankYouPortrait`
- Remove `heroAlt` from the exported object unless `EVENT_KEYS` is intentionally expanded.
- Add an explicit local type for the exported object, derived from `EventAssets` plus optional
  `gallery`, so future drift becomes a type error instead of a silent convention break.

### Hero Asset Policy

Two acceptable outcomes exist:

1. Preferred: introduce or rename a dedicated `hero.webp` and map `hero` directly to that file.
2. Temporary exception: if no distinct hero image exists, keep `hero` aliased to `portrait`, but
   document the alias inline as an explicit exception rather than allowing the current implicit
   semantic drift.

### Validation Expectations After Refactor

After renaming and module cleanup:

- The Ximena asset folder should contain only role-centric kebab-case filenames.
- The `ai/` subfolder should remain intact but contain governed filenames where assets participate
  in registry roles.
- The Ximena `assets` export should be assignable to the discovery/registry contract without extra
  exported keys.
- [src/content/events/ximena-meza-trasvina.json](C:/Code/celebra-me/src/content/events/ximena-meza-trasvina.json)
  should continue referencing only valid registry keys already defined in `EVENT_KEYS`.
- [src/lib/assets/discovery.ts](C:/Code/celebra-me/src/lib/assets/discovery.ts) should require no
  path changes, because the discovery shape remains
  `import.meta.glob('../../assets/images/events/*/index.ts', { import: 'assets', eager: true })`.

## Refactoring Steps

### 1. Rename files to the target governed contract

Execute the following renames:

```bash
git mv src/assets/images/events/ximena-meza-trasvina/ximena-portrait-main.webp src/assets/images/events/ximena-meza-trasvina/portrait.webp
git mv src/assets/images/events/ximena-meza-trasvina/ximena-portrait-alt.webp src/assets/images/events/ximena-meza-trasvina/portrait-alt.webp
git mv src/assets/images/events/ximena-meza-trasvina/ximena-family.webp src/assets/images/events/ximena-meza-trasvina/family.webp
git mv src/assets/images/events/ximena-meza-trasvina/ximena-gallery-01.webp src/assets/images/events/ximena-meza-trasvina/gallery-01.webp
git mv src/assets/images/events/ximena-meza-trasvina/ximena-gallery-02.webp src/assets/images/events/ximena-meza-trasvina/gallery-02.webp
git mv src/assets/images/events/ximena-meza-trasvina/ximena-gallery-03.webp src/assets/images/events/ximena-meza-trasvina/gallery-03.webp
git mv src/assets/images/events/ximena-meza-trasvina/ximena-gallery-04.webp src/assets/images/events/ximena-meza-trasvina/gallery-04.webp
git mv src/assets/images/events/ximena-meza-trasvina/ximena-thank-you.webp src/assets/images/events/ximena-meza-trasvina/thank-you-portrait.webp
git mv src/assets/images/events/ximena-meza-trasvina/ai/gallery-walking.png src/assets/images/events/ximena-meza-trasvina/ai/gallery-10.png
git mv src/assets/images/events/ximena-meza-trasvina/ai/gallery-laughing.png src/assets/images/events/ximena-meza-trasvina/ai/gallery-11.png
git mv src/assets/images/events/ximena-meza-trasvina/ai/detail-jewelry.png src/assets/images/events/ximena-meza-trasvina/ai/gallery-12.png
git mv src/assets/images/events/ximena-meza-trasvina/ai/interlude-roses.png src/assets/images/events/ximena-meza-trasvina/ai/interlude-01.png
git mv src/assets/images/events/ximena-meza-trasvina/ai/interlude-dress.png src/assets/images/events/ximena-meza-trasvina/ai/interlude-02.png
git mv src/assets/images/events/ximena-meza-trasvina/ai/bg-premiere.png src/assets/images/events/ximena-meza-trasvina/ai/interlude-03.png
git mv src/assets/images/events/ximena-meza-trasvina/ai/bg-rsvp.png src/assets/images/events/ximena-meza-trasvina/ai/interlude-04.png
```

If a distinct hero source already exists outside the currently observed files, rename or copy that
source to `hero.webp` and use it as the canonical `hero` import. If not, keep the temporary
`hero: portrait` alias and document it inline during the refactor.

### 2. Update imports and local symbols in the event module

Revise
[src/assets/images/events/ximena-meza-trasvina/index.ts](C:/Code/celebra-me/src/assets/images/events/ximena-meza-trasvina/index.ts):

- Replace all `ximena-*` import paths with normalized filenames.
- Rename narrative import symbols to governed role symbols:
  - `galleryWalking` -> `gallery10`
  - `galleryLaughing` -> `gallery11`
  - `detailJewelry` -> `gallery12`
  - `interludeRoses` -> `interlude01`
  - `interludeDress` -> `interlude02`
  - `bgPremiere` -> `interlude03`
  - `bgRSVP` -> `interlude04`
- Remove `heroAlt` from the exported `assets` object unless the registry is formally expanded.
- Keep `gallery` ordered so array position continues to resolve to `gallery01`, `gallery02`, and so
  on through future higher slots.

### 3. Tighten typing on the exported asset module

Add an explicit type for the Ximena module export, such as:

```ts
type EventModuleAssets = Partial<EventAssets> & {
  gallery?: ImageMetadata[];
};
```

Or an equivalent local type that:

- uses the registry-sanctioned keys,
- permits the `gallery` array used by discovery flattening,
- rejects extra exported keys that are outside the governed surface.

### 4. Validate consumers after refactor

Perform a post-refactor validation pass:

- Confirm
  [src/content/events/ximena-meza-trasvina.json](C:/Code/celebra-me/src/content/events/ximena-meza-trasvina.json)
  still references only valid registry keys.
- Confirm [src/lib/assets/discovery.ts](C:/Code/celebra-me/src/lib/assets/discovery.ts) remains
  unchanged.
- Confirm [src/lib/assets/asset-registry.ts](C:/Code/celebra-me/src/lib/assets/asset-registry.ts)
  still flattens the Ximena module into valid `EventAssetKey` entries.
- Run type-check/build validation after the refactor to ensure no consumer relied on the removed
  `heroAlt` extra key.

### 5. Regression-check against neighboring event modules

Use `demo-bodas`, `demo-cumple`, `gerardo-sesenta`, and `noir-premiere-xv` as neighboring references
for filename style and export shape. The goal is not byte-for-byte similarity, but consistent
adherence to role-centric naming, predictable gallery ordering, and a clean registry-facing module
surface.
