# Boda de Perla y Carlos — final audit, interlude integration, and cleanup

Audit timestamp: 2026-08-03T21:02:41-07:00  
Repository: `Celebra-me`  
Branch: `dev-local`  
HEAD: `b724c24ece9a02be59e27755a08060d3d326009f`  
HEAD summary: `feat(status): add shared status-core and optimize managed-status probes`  
Working tree: existing staged Goal 2 changes plus unstaged Goal 3 source/config/test changes and two
new Perla assets; no commit, push, publish, promote, database write, Storage write, dependency
change, or environment/configuration change was performed.

## Executive result

The Goal 3 gap was verified before remediation: Perla had no `interludes` content, no declared Perla
interlude assets, no interlude descriptors in the live invitation DOM, and therefore no image
requests or rendered interlude sections. The shared architecture already supported the required
data-driven path, so the minimum correction was local to the managed Perla definition, its source
asset directory, and its payload contract test.

Exactly two interludes are now declared and resolved in source:

1. `afterSection: 'countdown'` — architectural still life, bridging anticipation into locations.
2. `afterSection: 'gallery'` — reception-detail still life, bridging the gallery into RSVP.

The source render contract and browser verification produce the sequence:

`quote → countdown → interlude → location → family → gallery → interlude → personalizedAccess → rsvp → thankYou`

Both images load at 1024×1536, preserve the approved crop at 390, 768, 1024, and 1440 px checks,
contain no people, faces, hands, readable text, logos, or watermarks, and are integrated through the
existing asset/content/render pipeline. The public invitation route still reads the existing
published database content; that content was intentionally not changed. A guarded asset upload and
publication workflow remains required before the new interludes can appear in the published route.

## Authority and project rules consulted

- `AGENTS.md` — repository authority hierarchy, Git safety, database safety, relative-path, SCSS,
  Astro server/client, and validation rules.
- `.agent/rules/git-safety.md`, `.agent/rules/database.md`, `.agent/rules/gatekeeper.md` — preserved
  existing staged work, performed no Git mutation, and did not write to any database or environment.
- `.agent/routing-matrix.yaml` and relevant architecture/domain documentation.
- `docs/core/architecture.md` — section order, interlude placement, and intersection metadata.
- `docs/invitations/boda-perla-y-carlos.md` — approved preparation state, source-role inventory, and
  content constraints.
- `.agent/tmp/handoffs/boda-perla-y-carlos-goal-1/implementation-audit.md` — Goal 1 factual
  traceability baseline.
- `.agent/tmp/handoffs/boda-perla-y-carlos-goal-2/implementation-report.md` — Goal 2 implementation
  and validation baseline.
- `pasted-text-1.txt` — Goal 3 scope, mandatory two-interlude requirement, map/accessibility/cleanup
  criteria, and no-publish boundary.
- `src/lib/schemas/content/interludes.schema.ts`, `src/lib/adapters/event.ts`,
  `src/lib/invitation/render-plan.ts`, `src/lib/invitation/section-render-data.ts`,
  `src/components/invitation/InvitationSections.astro`, and
  `src/components/invitation/Interlude.astro` — authoritative interlude data and render path.
- Image-generation skill instructions — generated two project-bound raster assets with the built-in
  image generation path, then copied the selected outputs into the repository asset directory.
- Playwright and Graphify skill instructions — browser evidence was collected with the repository
  Playwright wrapper; Graphify's existing graph was queried for architecture context, while live
  source and tests remained authoritative because the graph cache predates this change.

## Verified facts versus inferences

### Verified facts

- `PERLA_ASSET_SPECS` previously contained only hero and gallery source roles; it now contains
  exactly two interlude roles.
- `buildPerlaPublishedContent()` previously omitted `interludes`; it now emits exactly two entries.
- `buildInterludes()` resolves content assets and omits only entries whose asset cannot be resolved;
  no new resolver or observer was added.
- `buildInvitationRenderPlan()` appends interludes immediately after the configured `afterSection`.
- `Interlude.astro` uses the existing `OptimizedImage` path with lazy loading, async decoding, low
  fetch priority, focal data, and the existing interlude stylesheet.
- The Perla payload schema test and the render-plan assertion both pass for exactly two entries and
  the required positions.
- The browser asset harness loaded both final PNGs at 1024×1536 and found no horizontal overflow at
  the four checked widths.
- The existing public route continues to use published database content; it did not show Perla
  interludes before publication because no database content was changed.
- Repository-wide type-check and CI stop at two existing diagnostics in
  `tests/unit/observability-batch.test.ts`.

### Inferences and decisions

- The smallest safe implementation boundary is the invitation definition plus its managed source
  assets and contract test. Shared adapter/render/component code already fulfills the contract and
  was not changed.
- PNG is acceptable as the managed source format because the invitation definition accepts relative
  source assets and the existing managed delivery flow normalizes uploaded delivery; no
  image-processing dependency was added.
- `height: 'screen'` is retained because the existing interlude contract treats the first two
  interludes as full narrative pauses. The selected focal points keep the architectural doorway and
  the reception detail in the responsive crop.
- The two generated concepts are treated as the final selected assets for this Goal 3 handoff. Owner
  visual sign-off and the guarded upload/publication workflow remain outside this no-publish task.

## Final status of original findings

The IDs below are the fixed Goal 1 input IDs. Statuses are based on the Goal 1/2 traceability,
current source, current tests, current working-tree diff, and live browser checks where the
published route can be inspected without mutation.

| Finding                                           | Final status                                      | Evidence and boundary                                                                                                                                                                                                |
| ------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 — preparation readiness / placeholders        | Complete                                          | `docs/invitations/boda-perla-y-carlos.md` remains `READY_WITH_PLACEHOLDERS`; preparation validation passed. This is a preparation gate, not a browser rendering state.                                               |
| F02 — source provenance                           | Complete                                          | `PERLA_ASSET_SPECS` retains the approved hero/gallery roles and adds only the two Goal 3 interlude roles with repository-relative paths. No source re-encoding or provider change was introduced.                    |
| F03 — opaque source labels                        | Complete                                          | Canonical preparation documentation remains the provenance boundary; no raw operational path is emitted to client content. `validate:no-pii` passed.                                                                 |
| F04 — managed image normalization                 | Complete for source contract; publication pending | Interludes use the same managed asset specification/upload contract as hero/gallery. No Storage write or second runtime normalization was added. The owner must run the approved upload workflow before publication. |
| F05 — route slug/alias                            | Complete                                          | `boda-perla-y-carlos`, event type `boda`, and route identity remain unchanged.                                                                                                                                       |
| F06 — family placeholders                         | Complete                                          | Payload still has two groups and four `Por confirmar` entries; live route DOM showed both groups and all four entries. `Family.astro` only adds a presentation class.                                                |
| F07 — Lane A inheritance reset                    | Complete                                          | Perla-specific profile styles remain scoped to `.event--boda-perla-y-carlos.theme-preset--jewelry-box-wedding`; no shared wedding preset was changed in Goal 3.                                                      |
| F08 — event-type classification                   | Not applicable to the Goal 3 visual correction    | `boda` remains a supported route type; no classification issue was reopened.                                                                                                                                         |
| F09 — identity derivatives                        | Complete                                          | Slug, `_assetSlug`, demo, template, and visual profile identities remain unchanged.                                                                                                                                  |
| F10 — dynamic resolver / routing                  | Not applicable to a Perla-specific correction     | The shared resolver remains the source-of-truth boundary for published real invitations; no route fallback was introduced.                                                                                           |
| F11 — Lane B demo parity                          | Blocked by explicit scope decision                | The shared `jewelry-box-wedding` demo bundle remains untouched as required. Resolving the broader demo parity item would expand beyond this Perla-specific Goal 3 scope.                                             |
| F12 — Git/worktree safety                         | Complete                                          | Branch and HEAD are unchanged; no stage, commit, reset, or push action was performed by this turn. Final state is recorded below.                                                                                    |
| F13 — preparation versus environment vocabulary   | Complete                                          | Preparation validation and publication state remain separate; no environment promotion or publication was performed.                                                                                                 |
| F14 — absent Perla finding                        | Not applicable                                    | Goal 1 found no current implementation path for this ID; no speculative remediation was created.                                                                                                                     |
| F15 — opaque source labels / provenance companion | Complete                                          | Same documentation and no-PII boundary as F03; no operational identifier or path was added to invitation content.                                                                                                    |
| F16 — route/asset/profile derivatives             | Complete                                          | Existing identity contracts remain intact; the two new asset keys are local semantic keys, not environment-local IDs or URLs.                                                                                        |
| F17 — validation tooling                          | Complete                                          | Existing preparation, changed-file, content, render-plan, browser, no-PII, event-parity, and Git-safety tooling was reused.                                                                                          |

## Final status of Goal 2 acceptance criteria

| Criterion                                          | Final status         | Evidence                                                                                                                                                                                                                            |
| -------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01 — envelope/reveal and transition states        | Complete             | Shared reveal E2E passed 10/10; sealed, opening, revealed, letter-held, preview-opened, keyboard, focus, reduced-motion, and no-JS paths were covered in the Goal 2 evidence set. Goal 3 did not alter reveal code.                 |
| C02 — personalized-access paper                    | Complete / preserved | Existing shared component and Perla token contract are unchanged; no guest data or access contract was altered.                                                                                                                     |
| C03 — RSVP, thank-you, and footer                  | Complete / preserved | Existing Perla profile styling, API/hybrid RSVP contract, guest cap, calendar data, closing copy, and provider credit remain unchanged. Synthetic local RSVP interaction and existing shared checks passed; no RSVP was submitted.  |
| C04 — hero, locations, maps, indications, and copy | Complete             | Live browser DOM showed two venue cards, working public map destinations, address-copy controls, separate indications, and the civil ceremony inside indications. Goal 3 did not change the map fallback or shared location markup. |
| Goal 2 decision “no Perla interludes”              | Superseded by Goal 3 | Goal 2 explicitly deferred interludes because no approved asset existed. Goal 3 supplied the mandatory two concepts and required their integration; the existing pipeline was used without a parallel renderer.                     |

## Mandatory two-interlude result

| Interlude                     | Final asset                                                   | Content entry                                                                     | Render position             | Focal / responsive evidence                                                                                                        |
| ----------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A — anticipation to locations | `src/assets/invitations/boda-perla-y-carlos/interlude-01.png` | `PERLA_ASSET_SPECS['interlude-01']`; `buildPerlaPublishedContent().interludes[0]` | `afterSection: 'countdown'` | `50% 50%`; mobile-narrow, mobile-standard, mobile-large, and desktop screenshots retain the arch, doorway, and floral edge.        |
| B — gallery to RSVP           | `src/assets/invitations/boda-perla-y-carlos/interlude-02.png` | `PERLA_ASSET_SPECS['interlude-02']`; `buildPerlaPublishedContent().interludes[1]` | `afterSection: 'gallery'`   | `50% 58%`; mobile-narrow, mobile-standard, mobile-large, and desktop screenshots retain the table, glassware, candle, and flowers. |

### Image creation outcome

- Interlude A concept: empty pale-stone architectural passage with an arch, warm late-afternoon
  light, ivory blossoms, and muted olive foliage. It bridges the countdown’s anticipation to the
  physical event location.
- Interlude B concept: empty reception table with ivory linen, crystal coupes, candlelight, white
  flowers, olive foliage, and a deep moss background. It bridges the emotional gallery into the RSVP
  action.
- Both were generated as photorealistic editorial still lifes using the built-in image-generation
  workflow.
- Both final assets are 1024×1536 PNGs, contain no embedded text, and show no people, faces, hands,
  silhouettes, logos, or watermarks.
- No external provider, API key, map tile, runtime request, or dependency was introduced.

## Traceability matrix

| Finding / surface                 | Section or state                          | Component                                                              | File / symbol                                                                                          | Styles / tokens                                                                     | Data / assets                                                   | Dependencies                                                         | Ownership                                              | Correction boundary         | Regression risk                                                                                                  | Validation                                                                                              |
| --------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Goal 3 interlude A                | After countdown, before location          | `Interlude.astro`                                                      | `scripts/provision/invitations/boda-perla-y-carlos.ts:PERLA_ASSET_SPECS`, `buildPerlaPublishedContent` | `src/styles/invitation/_interlude.scss`; inherited Perla profile and theme contract | `interlude-01.png`; semantic uploaded asset ref                 | `buildInterludes`, `resolveAsset`, Astro image delivery              | Perla invitation definition and managed asset workflow | Local data/asset addition   | Wrong key or upload mapping would omit the image; screen-height pause changes page length and LCP below the fold | Payload schema test; render-plan test; 4-width browser image load and screenshots                       |
| Goal 3 interlude B                | After gallery, before RSVP                | `Interlude.astro`                                                      | Same definition symbols; `interludes[1]`                                                               | Same shared interlude contract; `focalPoint: 50% 58%`                               | `interlude-02.png`; semantic uploaded asset ref                 | Same shared adapter/render path                                      | Perla invitation definition and managed asset workflow | Local data/asset addition   | Incorrect focal point could crop the table detail; upload mapping could omit the image                           | Payload schema test; render-plan sequence assertion; responsive section screenshots                     |
| Exact count / order               | Full section sequence                     | `InvitationSections.astro`                                             | `buildInvitationRenderPlan`, `buildInvitationSectionRenderDescriptors`                                 | Existing intersection metadata and motion coordinator                               | `viewModel.interludes` filtered by `afterSection`               | Shared render-plan and motion system                                 | Shared platform contract, Perla-owned data             | No shared refactor required | Duplicate entries or wrong `sectionOrder` position could move RSVP or create extra pauses                        | 2 interludes in view model; exact plan sequence; browser synthetic DOM sequence                         |
| Asset resolution                  | Adapter stage                             | `buildInterludes`                                                      | `src/lib/adapters/event.ts:280`                                                                        | No new CSS or runtime override                                                      | `InterludeInput.image` → `ImageAsset`                           | `resolveAsset`, `_assetSlug`                                         | Shared adapter                                         | Preserved shared behavior   | Invalid image key is skipped with warning                                                                        | Existing adapter tests; Perla source asset contract; schema pass                                        |
| Actual markup and loading         | Interlude section                         | `Interlude.astro`, `OptimizedImage`                                    | `src/components/invitation/Interlude.astro`                                                            | `src/styles/invitation/_interlude.scss`                                             | `alt`, `height`, `focalPoint` props                             | Lazy loading, async decoding, low priority, one motion coordinator   | Shared component                                       | Preserved shared component  | Component contract, accessibility, or performance regression                                                     | Existing interlude tests; images loaded at 1024×1536 in browser harness; reduced-motion shared coverage |
| Reveal / hero / quote / countdown | All reveal states and initial chapters    | Existing shared reveal, `Hero.astro`, `Quote.astro`, `Countdown.astro` | Existing Goal 2 symbols and Perla profile                                                              | `src/styles/invitation-profiles/boda-perla-y-carlos.scss`                           | Existing hero source and text payload                           | `RevealManager`, localStorage, matchMedia, countdown target/timezone | Shared contracts with Perla profile presentation       | Preserved; no Goal 3 change | Existing Goal 2 visual and interaction coverage remains the regression boundary                                  | Reveal E2E 10/10; existing mobile/desktop screenshots; 90 targeted unit tests                           |
| Location and map actions          | Two venue cards and indications           | `EventLocation.astro`, `VenueCard.astro`                               | Existing Goal 2 helper/markup and Perla location payload                                               | Perla location profile and `_event-location.scss`                                   | Two approved public map URLs; civil ceremony remains indication | Clipboard API / fallback and external links                          | Shared markup, Perla content                           | Preserved; no Goal 3 change | Third-card promotion or map destination drift                                                                    | Live DOM: 2 cards; 2 distinct URLs; copy success; location screenshots                                  |
| Family / gallery                  | Guest-facing family and one-photo gallery | `Family.astro`, `Gallery.astro`, `PhotoGallery.astro`                  | Existing Goal 2 class and profile rules                                                                | Perla family/gallery profile styling                                                | Two groups, four pending entries, one approved gallery image    | Gallery dialog and focus restoration                                 | Shared renderer with Perla presentation                | Preserved; no Goal 3 change | Placeholder or dialog contract regression                                                                        | Live DOM and gallery keyboard/Escape/focus evidence                                                     |
| RSVP / closing                    | Confirmation and footer closure           | `RSVP.tsx`, `ThankYou.astro`, `Footer.astro`                           | Existing Goal 2 symbols                                                                                | Perla RSVP, thank-you, and footer profile rules                                     | API/hybrid contract, calendar, closing copy, provider credit    | React island, RSVP API, calendar behavior                            | Shared contract with Perla presentation                | Preserved; no Goal 3 change | Hydration/API/persistence regression                                                                             | Synthetic local RSVP progression; known shared hydration warning documented; no submission              |

## Dependency and reuse map

```text
Perla definition
  ├─ PERLA_ASSET_SPECS[interlude-01, interlude-02]
  │    └─ guarded managed upload workflow → uploaded asset refs
  └─ buildPerlaPublishedContent().interludes[]
       └─ published content / draft preview content
            └─ adaptEvent()
                 └─ buildInterludes()
                      └─ buildInvitationRenderPlan()
                           └─ section-render-data descriptors
                                └─ InvitationSections.astro
                                     └─ Interlude.astro
                                          ├─ OptimizedImage
                                          ├─ _interlude.scss
                                          └─ motion-coordinator
```

Reuse decisions:

- New behavior is invitation-specific at the definition and asset-source boundary.
- `interludesSchema`, `buildInterludes`, `buildInvitationRenderPlan`, `Interlude.astro`, the motion
  coordinator, and the base interlude stylesheet are shared and were not modified.
- No shared token, selector, observer, asset registry, map provider, or dependency change is
  required.
- Existing Goal 2 shared location fallback remains the only shared production-code change in the
  staged baseline; Goal 3 adds no shared production code.

## Ordered implementation and publication sequence

1. Completed: audit the Goal 1/2 reports, fixed source, staged diff, current browser route, and
   interlude architecture before editing.
2. Completed: generate and select exactly two image concepts under the Goal 3 restrictions.
3. Completed: copy the two assets into the Perla invitation source directory and add only two
   `PERLA_ASSET_SPECS` entries.
4. Completed: add exactly two data-driven `interludes` entries after `countdown` and `gallery`.
5. Completed: extend the Perla schema/render-plan contract test to assert assets, exact count, exact
   order, and exact render sequence.
6. Completed: run source, style, payload, render-plan, browser, responsive, preparation, parity,
   no-PII, changed-file, and Git-safety validation.
7. Required next owner action: approve the selected assets and run the guarded invitation
   asset/content delivery workflow. This is not performed here because the task explicitly prohibits
   Preview/Production publication and Storage/database mutation.
8. Required after delivery: verify the published route at the approved mobile and larger viewports,
   then perform the normal publication gate. Do not treat the local source contract alone as proof
   that a published Storage object exists.

## Validation record

| Command / check                                                                                                                                              | Result                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test -- tests/content/boda-perla-y-carlos-payload.test.ts tests/unit/invitation.render-plan.test.ts tests/unit/invitation.section-render-data.test.ts` | Passed — 3 suites, 26 tests.                                                                                                                                                                      |
| Targeted section/adapter/motion/gallery/family/location suite                                                                                                | Passed — 10 suites, 90 tests.                                                                                                                                                                     |
| `pnpm validate:changed`                                                                                                                                      | Passed — related validation, 38 suites / 344 tests, and local render corpus regression 17/17. Prettier warning was only the existing Goal 2 report handoff; changed source files were formatted.  |
| `pnpm validate:invitation-preparation -- --file docs/invitations/boda-perla-y-carlos.md`                                                                     | Passed — readiness matches `READY_WITH_PLACEHOLDERS`.                                                                                                                                             |
| `pnpm validate:event-parity --allowMissingDb`                                                                                                                | Passed — 4 DB events considered, 0 without published content. No DB write.                                                                                                                        |
| `pnpm validate:no-pii`                                                                                                                                       | Passed — no non-demo content files found.                                                                                                                                                         |
| `pnpm exec stylelint 'src/styles/invitation-profiles/boda-perla-y-carlos.scss' 'src/styles/invitation/_event-location.scss'`                                 | Passed.                                                                                                                                                                                           |
| Prettier check for the changed Perla definition and payload test                                                                                             | Passed.                                                                                                                                                                                           |
| `pnpm test:e2e -- tests/e2e/envelope-reveal-interaction.spec.ts`                                                                                             | Passed — 10/10. The first attempt was blocked only because a pre-existing local Astro server occupied port 4321; after stopping that local server, the managed E2E server completed successfully. |
| `pnpm type-check`                                                                                                                                            | Blocked by 2 pre-existing diagnostics in `tests/unit/observability-batch.test.ts:8` and `:36`; no changed-file diagnostic was reported.                                                           |
| `pnpm run ci`                                                                                                                                                | Stops at the same type-check diagnostics; later CI stages did not run. Full CI is not claimed green.                                                                                              |
| `git diff --check`                                                                                                                                           | Passed; only normal CRLF conversion warnings were reported by Git.                                                                                                                                |
| `pnpm agent:git-safety:check`                                                                                                                                | Passed with the repository's authorized-session warning; branch/HEAD unchanged and no Git mutation performed in this turn.                                                                        |

### Browser and responsive evidence

The public route was inspected without database mutation. Its existing published content showed the
Goal 2 sections and interactions. For the new asset-specific visual check, a temporary local image
server and a browser-only DOM harness inserted the two source-resolved interlude sections after the
exact `countdown` and `gallery` anchors; no repository runtime code or database content was altered.
The harness verified:

- exactly 2 `.invitation-interlude` elements;
- sequence `quote, countdown, interlude, location, family, gallery, interlude, rsvp, thankYou` in
  the rendered DOM;
- both image natural sizes `1024×1536`;
- no horizontal overflow at 390, 768, 1024, or 1440 px (`document.scrollWidth` remained one
  scrollbar gutter below viewport width);
- focal points `50% 50%` and `50% 58%` preserved the meaningful architectural and reception details;
- section heights were 844 px in the 844 px browser viewport at each checked width;
- both interludes loaded with no text or human subjects visible in the section screenshots.

## Screenshot locations

New interlude evidence:

- `output/playwright/boda-perla-y-carlos/goal3-interlude-a-mobile-narrow.png`
- `output/playwright/boda-perla-y-carlos/goal3-interlude-b-mobile-narrow.png`
- `output/playwright/boda-perla-y-carlos/goal3-interludes-mobile-narrow-full.png`
- `output/playwright/boda-perla-y-carlos/goal3-interlude-a-mobile-standard.png`
- `output/playwright/boda-perla-y-carlos/goal3-interlude-b-mobile-standard.png`
- `output/playwright/boda-perla-y-carlos/goal3-interludes-mobile-standard-full.png`
- `output/playwright/boda-perla-y-carlos/goal3-interlude-a-mobile-large.png`
- `output/playwright/boda-perla-y-carlos/goal3-interlude-b-mobile-large.png`
- `output/playwright/boda-perla-y-carlos/goal3-interludes-mobile-large-full.png`
- `output/playwright/boda-perla-y-carlos/goal3-interlude-a-desktop.png`
- `output/playwright/boda-perla-y-carlos/goal3-interlude-b-desktop.png`
- `output/playwright/boda-perla-y-carlos/goal3-interludes-desktop-full.png`
- `output/playwright/boda-perla-y-carlos/goal3-interlude-a-mobile.png`
- `output/playwright/boda-perla-y-carlos/goal3-interlude-b-mobile.png`
- `output/playwright/boda-perla-y-carlos/goal3-interludes-mobile-full.png`

Existing Goal 2 section/reveal evidence remains under `output/playwright/boda-perla-y-carlos/`,
including sealed/opening/open reveal states, location, gallery, RSVP, and full-page checks.

## Files inspected and changed

### Goal 3 changes

- `scripts/provision/invitations/boda-perla-y-carlos.ts`
  - `PERLA_ASSET_SPECS`: `interlude-01`, `interlude-02`.
  - `buildPerlaPublishedContent()`: exactly two `interludes` entries.
- `src/assets/invitations/boda-perla-y-carlos/interlude-01.png`
- `src/assets/invitations/boda-perla-y-carlos/interlude-02.png`
- `tests/content/boda-perla-y-carlos-payload.test.ts`
  - source-file coverage, schema contract, exact interlude metadata, and exact render-plan sequence.

### Goal 2 files inspected in the final diff

- `src/components/invitation/Family.astro` — pending-name presentation class.
- `src/components/invitation/components/VenueCard.astro` — compliant map-link preview fallback.
- `src/lib/invitation/location-helper.ts` — public map preview URL selection.
- `src/styles/invitation-profiles/boda-perla-y-carlos.scss` — Perla-scoped presentation corrections.
- `src/styles/invitation/_event-location.scss` — shared map-preview contract styles.
- `tests/unit/location-helper.test.ts` — map fallback coverage.
- `output/reports/boda-perla-y-carlos-goal-2-implementation-report.md` — existing staged handoff,
  preserved as historical Goal 2 evidence.

No unrelated source file, dependency manifest, environment file, database record, Storage object, or
publishing configuration was changed.

## Cleanup and technical risk review

- Removed all temporary browser verification scripts from `.agent/tmp` after use.
- Stopped the temporary Astro and image-only local servers; ports 4321 and 8765 were closed at final
  cleanup.
- No duplicate interlude renderer, observer, scroll listener, selector override, dead code,
  temporary debug code, secret, internal path, guest data, or operational identifier was added.
- No shared component or token refactor was introduced because the existing architecture already
  satisfies the data/render contract.
- No map provider/API key, external tile request, or dependency was introduced.
- The generated PNGs are source assets only; the managed upload workflow remains responsible for
  delivery optimization and public Storage references.
- The known shared RSVP hydration mismatch remains pre-existing: the disabled notes textarea differs
  by an empty client `style` attribute in `RSVP.tsx`. Goal 3 did not touch RSVP code and did not
  claim this warning fixed.

## Blockers, assumptions, and decisions for the next goal/workflow

1. **Publication boundary:** the public route reads DB-published content. Because this task forbids
   Preview/Production publication and Storage/database mutation, the new interludes are not present
   in that existing published row yet. The next authorized workflow must upload the two source
   assets, build the managed uploaded refs, deliver the content payload, and then re-run the
   public-route browser checks.
2. **Owner visual approval:** the two selected concepts satisfy the supplied Goal 3 constraints and
   are recorded as the selected final assets. Owner sign-off should be recorded before publication.
3. **Repository type-check:** resolve the unrelated `tests/unit/observability-batch.test.ts` typing
   errors before claiming repository-wide CI green. This report does not change that test.
4. **Shared RSVP hydration warning:** decide separately whether the known pre-existing mismatch is
   release-blocking. It is not a Goal 3 regression.
5. **No changes to Goal 1/2 policy:** family pending names, two venue cards, separate indications,
   civil ceremony placement, single gallery item, RSVP contract, dates, copy, route identity, and
   visual profile ownership remain unchanged.

## Final staged and working-tree state

At the final audit snapshot:

- Branch: `dev-local`.
- HEAD: `b724c24ece9a02be59e27755a08060d3d326009f`.
- Staged baseline preserved: the existing Goal 2 report and six Goal 2 implementation/test files
  remain staged as supplied by the working session.
- Unstaged Goal 3 source changes: `scripts/provision/invitations/boda-perla-y-carlos.ts` and the
  additional assertions in `tests/content/boda-perla-y-carlos-payload.test.ts`.
- Untracked Goal 3 assets: `src/assets/invitations/boda-perla-y-carlos/interlude-01.png` and
  `interlude-02.png`.
- This canonical report is an ignored audit handoff under
  `.agent/tmp/handoffs/boda-perla-y-carlos-goal-3/`. A visible copy is provided under
  `output/reports/boda-perla-y-carlos-goal-3-final-audit.md` without staging it.
- No commit, reset, push, database write, publication, Storage upload, dependency install,
  secret/configuration mutation, or Preview/Production operation occurred.

## Concise handoff brief

The Perla source definition is ready for the next guarded delivery step. It declares two generated,
no-person/no-text editorial assets and places them through the existing `interludes[]` contract
after `countdown` and `gallery`. The schema and render-plan tests, changed-file validation,
responsive image checks, and reveal E2E are green. Before publication, obtain owner visual approval,
upload the two assets through the managed workflow, deliver the generated content payload to the
approved environment, verify the live route at the listed viewport sizes, and separately resolve the
two pre-existing repository type errors and decide on the known RSVP hydration warning.
