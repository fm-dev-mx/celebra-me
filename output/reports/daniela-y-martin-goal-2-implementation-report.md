---
title: Boda Daniela y Martín — Goal 2 Implementation Report
status: implementation-complete
scope: Approved corrections from Goal 1 fixed findings only
implementation_timestamp: 2026-08-03T20:01:27-07:00
---

# Goal 2 — Implementation Report

## Result

The approved Perla/Carlos corrections are implemented without changing the invitation payload,
assets, dependencies, configuration, route identity, reveal state machine, RSVP/API contract,
database, or publishing state.

The safe decisions recorded in the Goal 1 handoff were applied:

- Keep both family groups visible with guest-facing `Por confirmar` entries.
- Keep the civil ceremony as a separate indication rather than inventing a third venue or itinerary
  item.
- Keep ceremony-first venue order, one approved gallery image, public location visibility,
  API/hybrid RSVP, and guest cap 8.
- Keep Perla-specific visual work in the invitation profile. The only shared change is the map-link
  fallback required because Perla has approved public map URLs but no approved coordinates or venue
  images.
- Do not add interludes or new assets; the existing render plan remains interlude-free.

## Repository and working-tree state

| Item                     | Verified value                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository               | Celebra-me, worktree lane `dev-local`                                                                                                                   |
| Branch                   | `dev-local`                                                                                                                                             |
| HEAD                     | `b724c24ece9a02be59e27755a08060d3d326009f`                                                                                                              |
| Commit subject           | `feat(status): add shared status-core and optimize managed-status probes`                                                                               |
| Implementation timestamp | `2026-08-03T20:01:27-07:00` (`America/Chihuahua`)                                                                                                       |
| Current tree             | Seven changed tracked files, currently staged; ignored validation artifacts are present under `.agent/tmp/`, `.playwright-cli/`, `.tmp/`, and `output/` |
| Git actions              | No commit, push, reset, production publish, promotion, or database mutation performed                                                                   |

`pnpm agent:git-safety:check` passed with the repository's authorized-session warning that staged
state and HEAD differ from the safety baseline. The current staged state was preserved; no commit or
push was performed.

## Authority consulted

- `AGENTS.md`
- `.agent/routing-matrix.yaml`, `.agent/index.md`
- `.agent/rules/gatekeeper.md`, `.agent/rules/git-safety.md`, `.agent/rules/database.md`,
  `.agent/rules/invitation-production.md`, `.agent/rules/graphify-ops.md`
- `.agent/workflows/invitation-preparation.md`
- `.agent/skills/client-invitation-audit/SKILL.md`
- `docs/core/architecture.md`, `docs/core/content-schema.md`,
  `docs/core/invitation-preparation-contract.md`
- `docs/domains/theme/architecture.md`, `docs/domains/theme/motion.md`,
  `docs/domains/theme/section-intersections.md`, `docs/domains/theme/gallery-variants.md`
- `docs/domains/invitations/reveal-gate-automation.md`
- `docs/domains/content/event-governance.md`
- `docs/invitations/daniela-y-martin.md`
- `.agent/tmp/handoffs/daniela-y-martin-goal-1/implementation-audit.md`
- `package.json` scripts as the command authority
- Playwright browser-control instructions for local render and interaction validation

The Goal 1 report and canonical invitation documents were treated as fixed input. No new visual or
UX finding was introduced.

## Changed files and exact implementation symbols

| File                                                      | Symbols / selectors                                                                                                                                                                                                                                                                                                                         | Change boundary                                                                                                                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/styles/invitation-profiles/daniela-y-martin.scss` | Root `.event--daniela-y-martin.theme-preset--jewelry-box-wedding`; Goal 2 refinement block beginning at `:where(.envelope-wrapper)`, `:where(.invitation-hero)`, `:where(.quote-section)`, `:where(.countdown-section)`, `:where(.event-location)`, `.family`, `:where(.gallery-section)`, `:where(.thank-you-section)`, `:where(.rsvp)` | Invitation-specific material, hierarchy, contrast, spacing, surface, responsive, and motion-safe presentation overrides. No shared preset or render-plan change.                                 |
| `src/lib/invitation/location-helper.ts`                   | `resolveVenueMapPreviewUrl`                                                                                                                                                                                                                                                                                                                 | Shared pure resolver. Prefers `googleMapsUrl`, then existing `mapUrl`, `appleMapsUrl`, or `wazeUrl`; never invents coordinates or provider configuration.                                        |
| `src/components/invitation/components/VenueCard.astro`    | `mapPreviewUrl`; `[data-map-preview="link"]`; `.event-location__card-map-preview`                                                                                                                                                                                                                                                           | Shared venue-card markup adds a visible public map-link preview only when the existing media mode is `none` and an approved URL exists. Coordinate-bearing iframe and image paths are unchanged. |
| `src/styles/invitation/_event-location.scss`              | `.event-location__card-map-preview*`                                                                                                                                                                                                                                                                                                        | Shared styles for the link-only map preview: decorative CSS map grid, location icon, label, link, and focus treatment. It makes no network request.                                              |
| `src/components/invitation/Family.astro`                  | `family__item--pending` class condition                                                                                                                                                                                                                                                                                                     | Additive semantic class when the rendered name is `Por confirmar`; existing family data, markup, and labels remain intact.                                                                       |
| `tests/unit/location-helper.test.ts`                      | `describe('resolveVenueMapPreviewUrl')`                                                                                                                                                                                                                                                                                                     | Covers URL preference, fallback order, and absence of a URL.                                                                                                                                     |
| `tests/content/daniela-y-martin-payload.test.ts`       | location contract assertions                                                                                                                                                                                                                                                                                                                | Verifies two distinct approved public map URLs in the Perla payload contract.                                                                                                                    |

## Render and data flow

### Invitation-wide flow preserved

`daniela-y-martin` resolves through the existing dynamic route, published content resolver,
adapter, page-data builder, profile CSS resolver, and section render plan. The Perla profile is
selected from the existing invitation-specific identity/profile data. No static fallback, direct
database read, new formatter, new observer, or new dependency was introduced.

### Location fallback flow

`location.venues[]` in the existing managed payload → `adaptEvent`/location section data →
`EventLocation.astro` → `VenueCard.astro` → `resolveLocationMediaMode(...)`.

When a venue has neither approved image nor coordinates, `resolveVenueMapPreviewUrl(venue)` selects
an existing public navigation URL. `VenueCard.astro` renders the link-only preview and retains the
existing address-copy button and navigation actions. When coordinates or an image exist, the
previous media path wins and the new preview is absent.

### Family flow

Existing `family.groups[]` → `adaptEvent:buildFamilySectionData` → `Family.astro`. The new class is
derived only from the already-approved display value `Por confirmar`; it does not alter the payload,
schema, names, labels, or section order. Perla profile CSS gives that class quiet typographic
treatment so the content reads as a guest-facing pending entry rather than a technical token.

### Reveal and section flow

`EnvelopeReveal.astro`, `EditorialCoverReveal.astro`, `RevealManager`, the motion coordinator, and
the existing `data-reveal-state` transitions are unchanged. The Perla profile only refines the
existing envelope layers, seal presentation, reveal card, hero gating, section surfaces, and
reduced-motion-compatible visual rules. `?screenshot=1&reveal=letter` and
`?screenshot=1&reveal=open` remain the existing presentation-only contracts.

## Traceability matrix

The matrix maps every fixed Goal 1 input. “Preserved” means the existing implementation was
intentionally left unchanged and revalidated.

| Finding     | Section/state                          | Component / file / symbol                                                         | Styles / tokens                                                                       | Data / assets                                                                                          | Dependencies                                                 | Ownership                                           | Correction boundary                                                | Regression risk                                                                       | Validation                                                                                                      |
| ----------- | -------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| F01         | Preparation readiness                  | `readiness.ts:evaluatePreparationReadiness`; `validate-invitation-preparation.ts` | None                                                                                  | Canonical Perla prep remains `READY_WITH_PLACEHOLDERS`                                                 | Shared prep tooling                                          | Shared governance                                   | Preserved; no code correction                                      | A readiness mismatch could block a safe implementation                                | `pnpm validate:invitation-preparation` passed                                                                   |
| F02         | Asset source provenance                | `PERLA_ASSET_SPECS`; canonical Sources table                                      | None                                                                                  | Approved source-role map preserved; no re-encoding                                                     | Managed asset pipeline                                       | Asset/provenance                                    | Preserved                                                          | Replacing or re-encoding sources could change crop or provenance                      | Payload source tests and preparation validation passed                                                          |
| F03/F15     | Opaque prep labels                     | `docs/invitations/daniela-y-martin.md`                                         | None                                                                                  | Opaque source labels remain non-public                                                                 | Documentation validation                                     | Documentation                                       | Preserved                                                          | Raw paths or operational data could leak                                              | `pnpm validate:no-pii` passed                                                                                   |
| F04         | Managed delivery normalization         | `resolveAsset`; `PERLA_ASSET_SPECS`                                               | `OptimizedImage` / Astro image path                                                   | Existing managed URL contract preserved                                                                | Astro image and Storage delivery                             | Shared asset delivery                               | Preserved                                                          | A second normalization could affect LCP/crops                                         | Payload and render-corpus checks passed                                                                         |
| F05/F09/F16 | Route, slug, asset, and demo identity  | `perlaInvitation`; registry; `[eventType]/[slug].astro`                           | Perla root selector                                                                   | `daniela-y-martin`, asset namespace, demo/template derivatives unchanged                            | Dynamic route and resolver                                   | Invitation identity                                 | Preserved                                                          | Identifier drift can produce 404s or cross-load assets/CSS                            | Payload, route, E2E representative, and event parity checks passed                                              |
| F06         | Family visible/pending state           | `Family.astro`; `buildFamilySectionData`                                          | Perla `.family` block; `.family__item--pending`                                       | Two approved groups; four `Por confirmar` entries                                                      | Shared Family renderer                                       | Shared markup, Perla styling                        | Local additive class plus local profile CSS                        | Removing the section changes order/navigation; inventing names violates policy        | Payload test; fresh browser DOM: 2 groups / 4 pending entries; responsive screenshot                            |
| F07         | Shared preset inheritance              | Perla profile root and Goal 2 refinement block                                    | Perla-only `--perla-*` variables and section overrides                                | Existing `visualProfileId` selection                                                                   | Shared preset loads before profile                           | Invitation-specific                                 | Local profile change                                               | Moving these rules into the wedding preset would affect other invitations             | Stylelint, `validate:changed`, desktop/mobile screenshots                                                       |
| F08         | Event-type classification              | Preparation classification and route type                                         | None                                                                                  | `eventType: boda` unchanged                                                                            | Shared route                                                 | System/preparation                                  | N/A; preserved                                                     | Misclassification would alter readiness/routing                                       | Preparation and parity checks passed                                                                            |
| F10         | Dynamic route/resolver behavior        | `[eventType]/[slug].astro`; `resolveInvitationContent`                            | Existing event wrapper/preset classes                                                 | Published content remains authoritative                                                                | SSR route and resolver                                       | Shared platform                                     | Preserved                                                          | Static fallback could expose demo content                                             | Local route smoke, E2E, event parity                                                                            |
| F11         | Lane B demo parity                     | Wedding preset bundle and demo                                                    | Shared bundle untouched                                                               | Perla profile remains the Lane A boundary                                                              | Shared preset/section imports                                | Shared platform                                     | Preserved/deferred                                                 | Bundle edits could affect all jewelry-box wedding routes                              | Shared E2E representatives passed; no bundle diff                                                               |
| F12         | Git/worktree safety                    | Git safety workflow                                                               | None                                                                                  | Current staged/unstaged state recorded; no commit                                                      | Git tooling                                                  | Process                                             | Preserved                                                          | Reapplying or resetting could overwrite user work                                     | `git diff --check`; `agent:git-safety:check` passed with authorized-session warning                             |
| F13         | Preparation vs environment vocabulary  | Readiness helpers and docs                                                        | None                                                                                  | Local/Preview/Production distinction preserved                                                         | Governance tooling                                           | Shared governance                                   | Preserved                                                          | Prep-ready must not be confused with production-ready                                 | Preparation validation passed; no publish attempted                                                             |
| F14         | No applicable Perla path               | Active backlog and source inventory                                               | None                                                                                  | No matching implementation path exists                                                                 | None                                                         | N/A                                                 | Explicitly absent                                                  | Inventing a remediation would expand scope                                            | Goal 1 absence mapping retained                                                                                 |
| F17         | Validation tooling                     | `package.json`; validation scripts                                                | None                                                                                  | Existing gates reused                                                                                  | pnpm/Jest/Playwright                                         | Shared tooling                                      | Preserved and extended minimally                                   | Missing gates would weaken the handoff                                                | Changed validation, tests, and E2E passed                                                                       |
| C01         | Envelope teaser and reveal card        | `EnvelopeReveal.astro`; `InvitationRevealCard.astro`; Perla reveal profile rules  | Envelope layers, paper gradient, shadows, seal ring/emboss, card frame and typography | Existing teaser, monogram/seal, and reveal assets/data preserved                                       | `RevealManager`, `matchMedia`, localStorage, CSS animation   | Shared reveal markup/state; Perla presentation      | Local profile CSS                                                  | Reveal state, focus, animation fallback, or replay behavior could regress             | 10/10 shared reveal E2E; sealed/opening/revealed/letter-held/preview-opened browser states                      |
| C02         | Personalized-access paper              | `PersonalizedAccess.astro`; `renderPersonalizedAccess`                            | Existing Perla PA variables preserved                                                 | Guest/demo-only rendering unchanged                                                                    | React/SSR guest context                                      | Shared component, Perla tokens                      | Preserved                                                          | Moving PA tokens shared could retint other guest routes or leak guest data            | No-guest route omitted guest content; no payload/PA code changed                                                |
| C03         | RSVP and thank-you retint              | `RSVP.tsx`; `ThankYou.astro`; `Footer.astro`                                      | Perla olive RSVP surface, cream labels, thank-you/footer spacing and credit rules     | API/hybrid, guest cap 8, persistence, calendar, closing name/date unchanged                            | React island, RSVP API, validation, rate limit, calendar     | Shared contracts; Perla presentation                | Local profile CSS only                                             | Shared RSVP edits could affect hydration/API/accessibility                            | RSVP section screenshot; synthetic radio interaction; shared E2E; no submission                                 |
| C04         | Hero alt, map, indications, dress copy | `Hero.astro`; `PhotoGallery.astro`; `EventLocation.astro`; `VenueCard.astro`      | Perla hero overlay/lockup; location card and indication rules                         | Existing Spanish alt/copy and two venues preserved; two approved map URLs now visible as link previews | Astro image, GoogleMap when coordinates exist, Clipboard API | Shared markup with Perla style; map fallback shared | Shared helper/markup for the missing-media case; content unchanged | A broad media change could affect maps, clipboard, responsive cards, or accessibility | Payload test, map preview DOM, copy success with granted clipboard permission, location screenshot, no overflow |

## Section-by-section implementation and validation

| Surface                                    | Implemented result                                                                                                                                                                                     | Verified path                                                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reveal                                     | Material envelope base/pocket/flap, paper gradients, shadows, seal highlight/ring/emboss, monogram-compatible selectors, reveal card inset frame, and preserved state gating.                          | Default `sealed`; click `is-opening`; final `revealed`; screenshot `letter-held`; screenshot `preview-opened`; reduced motion completes immediately. |
| Hero                                       | Perla-specific overlay gradient, anchored lockup, readable title/date/time/venue hierarchy, and safe-area scroll cue.                                                                                  | `?skipEnvelope=true` at 390px and 1440px; no console errors in clean skip route.                                                                     |
| Quote                                      | Existing Spanish quote and author retained; Perla profile adjusts editorial width, line-height, divider, and author treatment.                                                                         | Payload/rendered DOM and standard full-page screenshot.                                                                                              |
| Countdown                                  | Existing target/time-zone/data path retained; Perla profile adjusts compact editorial segment treatment and separator.                                                                                 | Rendered countdown DOM and shared changed validation.                                                                                                |
| Locations/maps/directions/copy/indications | Exactly two venue cards. Each has a visible public-safe map-link preview, existing Google Maps action, address-copy control, and separate indications including formal attire and civil ceremony text. | Fresh browser DOM; map screenshot; both map links; copy feedback `Dirección copiada`; no overflow at 390/768/1024/1440 CSS widths.                   |
| Family                                     | Both approved groups remain visible; `Por confirmar` is styled as quiet content, not a dashboard placeholder.                                                                                          | DOM count: 2 groups and 4 pending entries; responsive full-page/scroll screenshot.                                                                   |
| Gallery                                    | Single approved portrait remains the only gallery item; profile gives it framed editorial presentation.                                                                                                | DOM count: 1; section screenshot; Enter/click opens one dialog, Escape hides it, focus returns to the gallery button.                                |
| RSVP                                       | Native React form and API/hybrid contracts are untouched; profile supplies olive/cream presentation and field/radio/button sizing.                                                                     | RSVP section screenshot; synthetic attendance selection transitions to the local form; no submit or persistence mutation.                            |
| Thank-you/footer/provider credit           | Existing message, closing name/date, `Con cariño`, contact CTA, logo, provider credit, and replay control remain; profile tightens spacing/credit treatment.                                           | Full-page DOM and full-page screenshots; credit text verified as `Concierge digital por Celebra-me`.                                                 |
| Interludes/transitions                     | No interlude descriptors or assets added. Existing wrapper separators remain the approved no-asset transition treatment.                                                                               | Payload has no `interludes`; render plan tests and reduced-motion/animation unit tests passed.                                                       |

## Dependency and reuse map

| Shared node                                    | Perla use                                                | Other consumers / blast radius                                                                | Guardrail applied                                                                     |
| ---------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `location-helper.ts:resolveVenueMapPreviewUrl` | Chooses a public URL when Perla lacks coordinates/images | All venue cards can call the pure helper; output is only used by the new missing-media branch | Existing URL precedence, no coordinates/API key, unit tests                           |
| `VenueCard.astro`                              | Renders Perla’s two link previews                        | All invitations using `VenueCard`; existing image/iframe branches are unchanged               | `mediaMode === 'none' && mapPreviewUrl` gate; exact shared E2E and payload checks     |
| `_event-location.scss`                         | Styles the new link preview and Perla variable values    | Shared location markup; only new preview classes receive the base block                       | No global element selectors; link focus ring; no external tiles/network               |
| `Family.astro`                                 | Adds pending class for Perla entries                     | All family sections receive an additive class only when the same display string is used       | No data mutation; Perla profile owns visual rule                                      |
| Perla visual profile                           | All approved visual corrections                          | Only `.event--daniela-y-martin.theme-preset--jewelry-box-wedding`                          | No changes to `jewelry-box-wedding` bundle, tokens, sections, or dependencies         |
| Reveal state machine / motion coordinator      | Existing Perla envelope and section states               | Every invitation route                                                                        | No new observer/listener/formatter; shared E2E and reduced-motion checks              |
| RSVP React/API                                 | Existing Perla RSVP presentation                         | Every RSVP-enabled invitation                                                                 | No changes to props, validation, API, persistence, rate limit, calendar, or guest cap |

## Ordered implementation sequence

1. Reaffirm the Goal 1 B1/B2 decisions from canonical payload and prep docs.
2. Add the smallest shared map URL resolver and link-only venue preview because the Perla payload
   has public URLs but no approved coordinates or venue images. Cover the resolver and distinct
   Perla URLs with tests.
3. Add the semantic family pending class and keep its presentation local to Perla.
4. Apply all visual corrections in the Perla profile: reveal material, hero hierarchy,
   quote/countdown rhythm, location cards/indications, family, gallery, RSVP, thank-you/footer, and
   existing no-asset separators.
5. Run scoped unit, style, payload, render-corpus, and preparation checks.
6. Validate sealed/opening/revealed/letter-held/preview-opened states, keyboard/focus, copy, gallery
   dialog, RSVP local interaction, reduced motion, no-JavaScript fallback, responsive widths, and
   screenshots.
7. Run type-check/CI and record the unrelated repository blocker; run git safety last. Production
   publication remains outside this task.

## Validation record

| Command / check                                                                                                                                                                                                                                               | Result                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test -- tests/unit/location-helper.test.ts tests/content/daniela-y-martin-payload.test.ts tests/unit/event.adapter.test.ts tests/unit/invitation.render-plan.test.ts tests/unit/invitation.section-render-data.test.ts tests/unit/page-data.test.ts` | Passed: 6 suites, 86 tests                                                                                                                                                                                                              |
| `pnpm test -- tests/unit/location-helper.test.ts tests/content/daniela-y-martin-payload.test.ts`                                                                                                                                                           | Passed: 2 suites, 12 tests after map assertions                                                                                                                                                                                         |
| `pnpm test -- tests/unit/animations.test.ts`                                                                                                                                                                                                                  | Passed: 1 suite, 5 tests                                                                                                                                                                                                                |
| `pnpm test:e2e -- tests/e2e/envelope-reveal-interaction.spec.ts`                                                                                                                                                                                              | Passed: 10/10, including shared representatives and extended reveal checks                                                                                                                                                              |
| `pnpm exec stylelint src/styles/invitation-profiles/daniela-y-martin.scss src/styles/invitation/_event-location.scss`                                                                                                                                      | Passed                                                                                                                                                                                                                                  |
| `pnpm exec prettier --check` on changed files                                                                                                                                                                                                                 | Passed                                                                                                                                                                                                                                  |
| `pnpm validate:changed`                                                                                                                                                                                                                                       | Passed; related Jest plus 17-test local render-corpus regression passed                                                                                                                                                                 |
| `pnpm validate:no-pii`                                                                                                                                                                                                                                        | Passed; no non-demo content files found                                                                                                                                                                                                 |
| `pnpm validate:event-parity`                                                                                                                                                                                                                                  | Passed; 4 DB events, 0 missing published content                                                                                                                                                                                        |
| `pnpm validate:invitation-preparation`                                                                                                                                                                                                                        | Passed; Perla readiness matches `READY_WITH_PLACEHOLDERS`                                                                                                                                                                               |
| `git diff --check`                                                                                                                                                                                                                                            | Passed; only Git line-ending warnings                                                                                                                                                                                                   |
| `pnpm agent:git-safety:check`                                                                                                                                                                                                                                 | Passed with authorized-session staged/HEAD baseline warning                                                                                                                                                                             |
| Fresh browser route `?skipEnvelope=true`                                                                                                                                                                                                                      | 0 console errors on initial route; DOM confirmed 2 locations, 2 map previews, 2 family groups, 4 pending entries, 1 gallery item, RSVP controls, required credit                                                                        |
| Reveal browser states                                                                                                                                                                                                                                         | Verified `sealed` → `is-opening` → `revealed`; `screenshot=1&reveal=letter` → `letter-held`; `screenshot=1&reveal=open` → `preview-opened`; reduced motion opens directly                                                               |
| Responsive browser checks                                                                                                                                                                                                                                     | No horizontal overflow at 390, 768, 1024, and 1440 CSS widths; `scrollWidth` stayed within the viewport excluding the normal scrollbar gutter                                                                                           |
| Map/copy/gallery/RSVP interactions                                                                                                                                                                                                                            | Both public map links present; clipboard feedback reached `Dirección copiada` with granted local permission; gallery dialog opened and Escape restored focus; synthetic RSVP attendance selection entered the local form without submit |
| No-JavaScript route                                                                                                                                                                                                                                           | Direct browser context with JavaScript disabled found one `.envelope-no-js-fallback` linking to `?skipEnvelope=true` and retained the hero in the HTML                                                                                  |

## Screenshot evidence

All paths below are ignored local validation artifacts and use repository-relative paths.

- Before baseline: `output/playwright/daniela-y-martin/goal2-before-mobile-hero.png`
- After mobile hero: `output/playwright/daniela-y-martin/goal2-after-mobile-hero.png`
- After sealed/opening/open: `output/playwright/daniela-y-martin/goal2-after-mobile-sealed.png`,
  `goal2-after-mobile-opening.png`, `goal2-after-mobile-open.png`
- After screenshot-held letter:
  `output/playwright/daniela-y-martin/goal2-after-mobile-letter-held.png`
- After responsive full pages: `goal2-after-narrow-full.png`,
  `goal2-after-standard-full-scrolled.png`, `goal2-after-large-full.png`,
  `goal2-after-mobile-full-scrolled.png`
- After large hero: `goal2-after-large-viewport.png`
- After sections: `goal2-after-location-scrolled.png`, `goal2-after-gallery-scrolled.png`,
  `goal2-after-rsvp-scrolled.png`

## Risks, limitations, and unresolved decisions

- The map preview is intentionally link-only. Perla has no approved coordinates or venue images; an
  embedded map would require an owner-approved coordinate/provider decision. No invented
  coordinates, map tile dependency, or API key was added.
- `location-helper.ts`, `VenueCard.astro`, `_event-location.scss`, and `Family.astro` are shared
  surfaces. The fallback is gated to missing media, existing media paths are untouched, the family
  change is additive, and the blast radius is covered by unit, changed, render-corpus, and browser
  checks.
- `pnpm type-check` and `pnpm run ci` are not green because of two unrelated existing diagnostics in
  `tests/unit/observability-batch.test.ts` at lines 8 and 36: `mockRunCommand` argument typing and a
  spread tuple typing error. No Perla change is implicated and that file was not modified.
- A fresh RSVP browser route reports an existing shared React hydration mismatch for the disabled
  notes textarea’s `style` attribute. It reproduces outside the changed file set and was not altered
  because Goal 2 preserves the RSVP island contract. It should be resolved separately before a
  repository-wide clean console/publish claim.
- RSVP validation was synthetic/local only. No real guest, submission, persistence, rate-limit,
  calendar, database, or publish path was exercised or mutated.
- No new interlude or transition asset was approved or added; the existing separators are the only
  Perla transition treatment.
- No production publish/promote, secret access, storage mutation, environment mutation, dependency
  installation, asset re-encoding, or configuration change occurred.

## Goal 2 handoff brief

The implementation is ready for owner review and for a separate publication workflow. Before
publishing, resolve the unrelated `observability-batch.test.ts` type errors and decide whether the
existing shared RSVP hydration warning is release-blocking. If embedded maps are required, provide
approved coordinates/provider policy; otherwise the current link-only preview is the safe
contract-preserving implementation.
