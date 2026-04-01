# Technical Audit Report

## Executive Summary

Audit scope was restricted to the current staged snapshot from `git diff --cached` and cross-checked against the staged file contents via `git show :path` where needed.

Overall health is mixed:

- The staged set introduces a legitimate capability (`focalPoint`) and a broader palette refinement pass.
- The staged snapshot also contains one direct functional regression and several contract/architecture drifts.
- The most serious issue is that `focalPoint` is built into the view model for `family`, `interlude`, and `thankYou`, but the staged renderer drops those props before the components render.

Verification note:

- `pnpm run type-check` could not complete in this environment because `astro check` failed with `EPERM` while trying to unlink `C:\Code\celebra-me\node_modules\.vite\deps\@astrojs_react_client__js.js`. This is a local verification blocker, not a code finding by itself.

## Critical Findings

### C1. `focalPoint` is dropped before render for `Family`, `Interlude`, and `ThankYou`

**Severity:** Critical  
**Category:** Functional regression / integration gap

**Evidence**

- The staged adapter now builds and forwards `focalPoint` into the invitation view model:
  - `src/lib/adapters/event-view-models.ts:185`
  - `src/lib/adapters/event-view-models.ts:290`
  - `src/lib/adapters/event-view-models.ts:386`
- The staged components explicitly expect and consume the prop:
  - `src/components/invitation/Family.astro:46`
  - `src/components/invitation/Family.astro:191-197`
  - `src/components/invitation/Interlude.astro:12`
  - `src/components/invitation/Interlude.astro:20-27`
  - `src/components/invitation/ThankYou.astro:12`
  - `src/components/invitation/ThankYou.astro:24-31`
- But the staged renderer contract still omits it entirely:
  - `src/lib/invitation/section-render-data.ts:12-23`
  - `src/lib/invitation/section-render-data.ts:67-72`
  - `src/lib/invitation/section-render-data.ts:88-96`
  - `src/lib/invitation/section-render-data.ts:121-126`
  - `src/lib/invitation/section-render-data.ts:153-165`
  - `src/lib/invitation/section-render-data.ts:237-243`
- The staged content already relies on the missing wiring:
  - `src/content/events/ximena-meza-trasvina.json:105`
  - `src/content/events/ximena-meza-trasvina.json:156`
  - `src/content/events/ximena-meza-trasvina.json:233`

**Why this matters**

The staged changes create the appearance that focal-point support exists end-to-end, but in the staged snapshot only the hero path is actually wired through. `family`, `interlude`, and `thankYou` values are computed and then silently discarded before rendering. That makes the Ximena content changes partially non-functional in the exact staged commit.

**Risk**

- User-facing focal-point tuning for three sections will not apply.
- Reviewers may miss this because the component and schema changes look complete in isolation.
- The current worktree already appears to contain an unstaged follow-up in `section-render-data.ts`, which increases the risk of accidentally committing an incomplete slice.

## Warning Findings

### W1. The same premiere presets now have conflicting palette definitions in TS and SCSS

**Severity:** Warning  
**Category:** 3-layer architecture drift / single-source-of-truth break

**Evidence**

- The staged TS palette map defines concrete colors for the premiere presets:
  - `src/lib/theme/color-tokens.ts:30-61`
- The staged SCSS preset file publishes a second set of runtime values for those same preset names:
  - `src/styles/themes/presets/_premiere-floral.scss:168-245`
  - `src/styles/themes/presets/_premiere-floral.scss:247-348`
- Runtime color resolution still depends on the TS map:
  - `src/lib/theme/color-tokens.ts:113-132`
- The adapter uses that resolver for invitation-facing colors such as the envelope palette:
  - `src/lib/adapters/event-view-models.ts:68-84`

**Why this matters**

This breaks the repository’s intended color flow. A preset name should resolve to one semantic palette. After this staged change, the same preset can mean one thing in JS/TS and another in runtime CSS.

The drift is especially visible in `premiere-sage-gold`:

- TS map says sage/gold:
  - `src/lib/theme/color-tokens.ts:41-50`
- SCSS preset is still built from floral/rose/champagne mixes and comments:
  - `src/styles/themes/presets/_premiere-floral.scss:195-218`

That is not just aesthetic subjectivity; it is a contract mismatch.

**Impact**

- Any server-side or adapter-driven color resolution can disagree with what the preset actually renders in CSS.
- Envelope, reveal, or inline color usages may visually diverge from the rest of the themed page.
- The change makes future palette maintenance harder because there is no authoritative source anymore.

### W2. `godparentsTitle` was added only at the component edge; schema and shared types still do not support it

**Severity:** Warning  
**Category:** Contract inconsistency

**Evidence**

- The staged `Family.astro` component now advertises and consumes `labels.godparentsTitle`:
  - `src/components/invitation/Family.astro:36-44`
  - `src/components/invitation/Family.astro:78-85`
  - `src/components/invitation/Family.astro:163-166`
- The shared `FamilyLabels` type still does not include it:
  - `src/lib/adapters/types.ts:126-133`
- The content schema for `family.labels` still does not include it:
  - `src/lib/schemas/content/family.schema.ts:16-23`

**Why this matters**

The component API implies a new content capability, but the schema/type contracts do not permit it. In practice, content authors cannot reliably provide a custom godparents title through the supported content pipeline, even though the staged component suggests they can.

**Impact**

- Inconsistent authoring experience.
- Higher chance of “it works locally in a hand-edited object but not from content collections” bugs.
- Another example of the implementation moving faster than the contract.

### W3. Hero focal point is injected into an inline style string from an unrestricted schema field

**Severity:** Warning  
**Category:** Content contract weakness / rendering safety

**Evidence**

- The staged schema accepts any string:
  - `src/lib/schemas/content/hero.schema.ts:13`
- The staged content now uses the field:
  - `src/content/events/ximena-meza-trasvina.json:53`
- The staged component injects that value directly into a style attribute:
  - `src/components/invitation/Hero.astro:64-70`

**Why this matters**

Unlike the other focal-point paths that flow through `OptimizedImage` as a style object, the hero path interpolates raw content into a CSS declaration string. Even if repository-managed content keeps this low-risk operationally, the contract is too loose for a renderer-facing field. A malformed value can break the declaration block or smuggle additional declarations into the inline style.

**Impact**

- Fragile rendering contract.
- Harder-to-debug layout breakage from invalid content values.
- Inconsistent safety model compared with the safer `OptimizedImage` path.

## Optimization Findings

### O1. The new sage token scale is currently dead inventory

**Severity:** Optimization  
**Category:** YAGNI / unused system tokens

**Evidence**

- New system tokens were added:
  - `src/styles/tokens/system/_color.scss:65-71`
- But the staged preset implementation does not consume them for `premiere-sage-gold`:
  - `src/styles/themes/presets/_premiere-floral.scss:195-218`
- The staged TS palette map also bypasses them and uses manual hex values instead:
  - `src/lib/theme/color-tokens.ts:41-50`

**Why this matters**

Adding a full system scale without a staged consumer increases maintenance surface without improving the staged behavior. It also muddies the intent of the preset, because the repository now has “sage” tokens that are not actually driving the `premiere-sage-gold` preset in the same commit.

## Remediation Plan

1. Fix the functional regression first by updating `src/lib/invitation/section-render-data.ts` so `focalPoint` is included in:
   - `FamilyProps`
   - `ThankYouProps`
   - interlude render props
   - the `renderInterlude`, `family`, and `thankYou` render branches
2. Re-run a staged-only verification on Ximena after the render fix and confirm that:
   - hero focal point applies
   - family image focal point applies
   - interlude focal point applies
   - thank-you image focal point applies
3. Collapse the palette definition back to one source of truth for premiere presets:
   - either derive `PRESET_COLOR_MAP` from the same preset contract,
   - or define canonical semantic values once and consume them from both TS and SCSS
4. Complete the `godparentsTitle` contract so the component, shared types, and content schema agree:
   - `src/components/invitation/Family.astro`
   - `src/lib/adapters/types.ts`
   - `src/lib/schemas/content/family.schema.ts`
5. Constrain `hero.focalPoint` with a narrow schema or normalization step before it reaches the inline style string.
6. Either wire the new sage system tokens into `premiere-sage-gold` immediately or remove them from this changeset to keep the commit atomic and non-speculative.
7. Re-run:
   - `git diff --cached`
   - `astro check` or `pnpm run type-check` after clearing the local `.vite` permission blocker
   - visual review for the Ximena invitation in the exact staged state

## Closing Assessment

This staged set is not ready for final commit as-is. The focal-point work is incomplete in the renderer path, and the premiere preset refinements introduce a split palette authority that conflicts with the repository’s token/preset/component architecture.
