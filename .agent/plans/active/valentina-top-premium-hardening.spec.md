---
title: Valentina Hernández XV Top Premium Hardening
status: active
type: implementation
created: 2026-06-27
updated: 2026-06-27
autonomy: 'Level 2 — Local code changes allowed, no staging/commit/deploy'
related_skills:
  - frontend-design
  - theme-architecture
  - copywriting-es
  - testing
related_rules:
  - .agent/rules/gatekeeper.md
  - .agent/rules/git-safety.md
  - .agent/rules/invitation-production.md
related_docs:
  - docs/core/architecture.md
  - docs/domains/theme/architecture.md
---

# Valentina Hernández XV Top Premium Hardening

## Problem Statement

The real Valentina Hernández XV invitation is on branch `feat/valentina-hernandez-xv-invitation` and
renders at `/xv/valentina-hernandez` through the dynamic invitation route. Recent work moved the
invitation to the `editorial-magazine` preset, but the production-bound content still exposes
internal placeholder/admin wording and the opened mobile hero crops the full name.

This pass must make the invitation feel production-premium without inventing missing client data,
running production SQL, changing schemas, or refactoring the invitation architecture.

## Current Evidence

- Branch: `feat/valentina-hernandez-xv-invitation`.
- Public route: `src/pages/[eventType]/[slug].astro`.
- Route content resolution: `src/lib/invitation/content-resolver.ts` checks
  `published_invitation_content` first for real non-demo invitations, then blocks non-demo static
  fallback.
- Canonical editable content payload discovered by repo search and SQL comments:
  `.agent/plans/active/xv-valentina-hernandez-db-payload.json`.
- Embedded production patch payload to synchronize after canonical edits:
  `scripts/manual/production-patches/20260626_valentina_hernandez_xv.sql`.
- Event-scoped SCSS override: `src/styles/themes/sections/_xv-valentina-hernandez.scss`.
- Local visual QA before this pass:
  - `/xv/valentina-hernandez?forceEnvelope=true` returned HTTP 200.
  - Closed editorial cover was readable at about `430x932` and `390px`.
  - Opened hero cropped `VALENTINA HERNÁNDEZ ALMAGUER` horizontally on mobile.
  - Visible placeholders appeared in Family, Program, Locations, Gallery, and Gifts.
  - The bottom pill visible in screenshots was the Astro dev toolbar; production-visible fixed
    controls still need verification after changes.

## Current Visual Gaps

- Opened hero behaves like a generic two-column hero on mobile and crops the name.
- Placeholder/admin copy is visible: `PENDIENTE`, `[confirmar ...]`, `Confirmar ubicación`,
  `definir fecha límite`, `confirmar número de registro`, and similar unfinished language.
- Location and program content exposes unknown ceremony/registry details instead of making a clear
  product decision.
- Gift registry is incomplete and should be hidden rather than cosmetically rewritten.
- Several editorial-magazine text treatments are too faint over Valentina's blush palette.
- Program, locations, notes, and gifts need a stronger editorial system while staying scoped.

## Scope

- Create this active SDD spec before implementation.
- Update the canonical payload first, then synchronize modified content into the SQL patch.
- Add regression coverage that rejects placeholder/admin strings in Valentina's canonical payload
  and checks the SQL embedded payload remains synchronized for the modified content object.
- Use Valentina-scoped SCSS for mobile typography, contrast, program, location, notes, and gift
  polish.
- Use minimal backward-compatible component changes only if CSS cannot solve an issue cleanly.
- Validate the real route visually at about `390px` and `430x932`, including after cover reveal.

## Out Of Scope

- Production DB execution, deploys, staging, commits, or branch changes.
- New dependencies, schemas, route architecture, or broad theme refactors.
- Fake client data, fake registry URLs, fake map links, or fake image placeholders.
- Replacing WhatsApp-compressed image assets with production originals.
- Changing the shared `editorial-magazine` demo unless a shared bug is proven and the demo is
  re-verified.

## Acceptance Criteria

- No visible admin/placeholder wording remains in Valentina's payload or SQL embedded payload.
- Optional incomplete commercial modules are removed, especially Liverpool registry data without a
  real URL/number/list name.
- Required unknown event details use polished public Spanish copy only when the invitation would be
  incomplete without them.
- `Solicitar enlace` is removed only if it appears as visible placeholder/admin copy or unavailable
  functionality.
- At `390px` and `430x932`, after opening the editorial cover and waiting for reveal completion:
  - `document.documentElement.scrollWidth <= window.innerWidth`.
  - Closed cover and opened hero show the full name in a deliberate readable composition.
  - Production-visible fixed controls do not cover final lines, section titles, CTAs, or cards.
- Program, Locations, Details/Notas, and Gifts feel consistent with the editorial cover.
- `/xv/demo-xv-editorial-magazine` is not broken by any shared/component-level change.
- The repo remains buildable.

## Implementation Phases

1. **Regression coverage**
   - Add a focused Jest test for the canonical payload and SQL embedded payload synchronization.
   - Verify the test fails before payload edits because current content contains placeholders.

2. **Canonical content cleanup**
   - Edit `.agent/plans/active/xv-valentina-hernandez-db-payload.json`.
   - Remove incomplete family names instead of displaying bracketed confirmations.
   - Treat the unknown ceremony as polished required context or hide the venue if it cannot be
     completed.
   - Remove the incomplete Liverpool registry card and keep only intentional cash gift copy.
   - Remove or polish gallery captions without mentioning missing photos.

3. **SQL synchronization**
   - Mechanically replace the embedded `v_content jsonb := $$...$$::jsonb;` JSON with the canonical
     payload content.
   - Run the payload/sync regression test again.

4. **Valentina-scoped SCSS polish**
   - Fix mobile hero title sizing and layout.
   - Raise contrast for muted editorial text over the blush palette.
   - Refine program, location cards, notes/details, and gifts using existing selectors.
   - Avoid shared component edits unless required.

5. **Validation and visual QA**
   - Run schema validation, type-check, lint, tests, build, and git safety checks.
   - Start local dev server and inspect `/xv/valentina-hernandez?forceEnvelope=true` at `390px` and
     `430x932`.
   - Open the editorial cover, wait for reveal completion, measure scroll width, and verify name
     readability and fixed control behavior.
   - Spot-check `/xv/demo-xv-editorial-magazine` if any shared/component-level change occurs.

## Validation Checklist

- `pnpm test -- tests/content/valentina-hernandez-payload.test.ts`
- `pnpm ops validate-schema`
- `pnpm type-check`
- `pnpm run lint`
- `pnpm test`
- `pnpm build`
- Visual QA with system Chrome or Playwright-compatible browser.
- `pnpm agent:git-safety:check`
- `pnpm agent:git-safety:end`

If a validation command is unavailable or fails for a preexisting reason, document the command, exit
status, and relevant output in the final report.

## Rollback Notes

- Revert this spec, the focused test, canonical payload edits, SQL embedded payload sync, and
  Valentina-scoped SCSS edits.
- Do not run destructive SQL rollback snippets automatically.
- If local DB content was not updated during QA, no DB rollback is needed.

## Stop Conditions

- Schema changes become necessary.
- Production SQL execution or deploy approval becomes necessary.
- The payload and SQL embedded content cannot be synchronized reliably.
- More than minimal component changes are required.
- Validation failures cannot be attributed to this pass or safely remediated within scope.
