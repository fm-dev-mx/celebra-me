---
title: Canonical Creation & Managed Contract Consolidation — Closure
status: final
created: 2026-07-31
updated: 2026-07-31
related_docs:
  - .agent/plans/archived/canonical-invitation-contract-audit.md
  - docs/core/content-parity-rsvp-isolation.md
  - docs/domains/intake/production-flow.md
  - docs/database-workflow.md
supersedes: []
---

# Canonical Creation & Managed Contract Consolidation — Closure Report

Authority: `.agent/plans/archived/canonical-invitation-contract-audit.md` §F.

## 1. Files changed (responsibility)

### Documentation / rules
| File | Responsibility |
|------|----------------|
| `docs/core/content-parity-rsvp-isolation.md` | Update vs Promote terminology; Production → `invitation:promote` |
| `docs/database-workflow.md` | Same Production boundary; agent identity table |
| `docs/domains/intake/production-flow.md` | §3 managed creation; smoke test wording |
| `.agent/rules/database.md` | Remove nonexistent `db:preview:patch` |
| `.agent/rules/invitation-production.md` | Agent application identity constraints |

### Canonical creation enforcement
| File | Responsibility |
|------|----------------|
| `src/lib/intake/services/dashboard-client-creation-policy.ts` | HTTP reject policy |
| `src/pages/api/dashboard/intake/index.ts` | POST choke point |
| `src/pages/api/dashboard/intake/[id]/duplicate.ts` | Duplicate choke point |
| `src/lib/intake/services/invitation.service.ts` | Extract `assertCreateInvitationPreset` (kept for service/demos) |
| `src/pages/dashboard/invitaciones/nueva.astro` | Retired notice page |
| `src/components/dashboard/intake/InvitationList.tsx` | Remove create/duplicate UI |
| `src/hooks/use-invitation-admin.ts` | Remove client create/duplicate helpers |
| `src/lib/dashboard/admin-api.ts` | Remove create/duplicate client methods |
| `scripts/validate-ui-governance.mjs` | Drop `CreateInvitationFlow` allowlist |
| Deleted | `CreateInvitationFlow.tsx`, `DemoSelector.tsx` |

### Editor ↔ renderer parity + presentation
| File | Responsibility |
|------|----------------|
| `src/lib/intake/invitation-section-registry.ts` | Label SSOT (`EDITOR_SECTION_PRESENTATION`); audited gaps owned by editor/schema/mapper |
| `src/lib/intake/labels.ts` | Derive section labels from registry |
| `src/lib/invitation/presentation-options.ts` | Six structural presentation APIs |
| Editor schemas / draft schemas / published schemas | Editable fields for audited gaps |
| `draft-to-published.mapper.ts` | Mapping for new editable fields |
| `src/lib/adapters/event.ts` | Consume presentation; stop theme copy injection; preserve itinerary styles |
| Editor section components | UI for parity gaps |
| Tests | API reject, presentation contract, label/adapter updates |

## 2. Dashboard creation paths retired / blocked

- `POST /api/dashboard/intake` → 403 `canonical_creation_required` after schema + preset validation
- `POST .../duplicate` → 403 same reason
- `/dashboard/invitaciones/nueva` → retired notice (no create form)
- InvitationList “Nueva invitación” + demo Duplicar removed

## 3. Internal primitives preserved

- `invitation.repository.createInvitation`
- `invitation.service.createInvitation` / `synchronizeDemoInvitations` / `duplicateInvitationFromDemo` (service retained; Dashboard HTTP blocked)
- `invitation-host-owner`, `apply-local-invitation`, import engine
- `pnpm invitation:update` / `reconcile` / `content-parity` / `promote` / `dbs`
- Demo sync on GET list

## 4. Editor/renderer parity gaps resolved

Audited gaps are **EDITABLE** via Editor UI + draft/editor/published schemas + publish mapping
(not a separate classification registry — that map was documentation-only and was removed):

location.visibility, hero focal points + desktop image, thank-you overlay suite, RSVP accessMode / personalizedAccess / calendar, sharing.ogImage, indications.styleVariant, gallery presentation/layoutRole, itinerary presentation behavior, location showFlourishes (`presentationOptions` with `sectionStyles` adapter fallback), hero portraitEnabled.

Managed/profile/derived fields remain outside the Editor (sectionStyles internals, interludes, envelope premium, template/visualProfile, countdown target, navigation, etc.).

Labels consolidated onto registry vocabulary.

## 5. Six ThemePreset structural couplings migrated

1. `showFlourishes` → `location.presentationOptions` / `resolveLocationShowFlourishes` (adapter falls back to `sectionStyles.location.showFlourishes`)
2. Indication `styleVariant` → editable section field
3. Gallery presentation / layoutRole → presentation contract + validation
4. Itinerary `timeline-paper` → `itinerary.presentation.behavior` (sectionStyles variant still honored when not timeline-paper)
5. Portrait → `hero.presentation.portraitEnabled` + theme offer fallback via `resolvePortraitEnabled`
6. Enchanted-rose adapter location/scroll injection removed — content/seed owns copy

## 6. Agent identity (Local / Preview)

Documented and constrained:

| Env | Identity | Role |
|-----|----------|------|
| Local | `db:local:bootstrap-admin` (first `SUPER_ADMIN_EMAILS`) | `super_admin` |
| Preview | `preview@preview.com` | `super_admin` |
| Production | Owner-only; no agent app identity | — |

No browser `service_role`, no invented agent permissions, no Production agent apply.

## 7. Asset pipeline

**No change required.** `normalizeInvitationImage` retained; `optimize-assets.mjs` not restored; no pass-through short-circuit added.

## 8. Tests and validation

Focused suites green including:

- `dashboard.intake.create` / `duplicate` reject tests
- `invitation-presentation-contract`
- `invitation-creation.service` (service still creates)
- `mutation-reconciliation` (Production via `invitation:update` rejected)
- InvitationList / DraftEditor / DraftReview / event.adapter / section-render-data updates

Gates:

- `pnpm type-check` — pass
- `pnpm validate:changed` — pass
- `pnpm validate:structure` — pass
- `pnpm agent:git-safety:check` — pass
- `git diff --check` — pass

E2E Preview provision fixture no longer POSTs Dashboard create; requires pre-existing `e2e-preview-publication` fixture (deferred full fixture provision CLI if needed).

## 9. Deferred follow-on

Tracked under `.agent/plans/active/managed-observability.md`:

- Compact Git/DB observability status composing `dbs-status` / classifiers (no new parallel classifier; not in husky)
- Optional Preview fixture provision script replacing retired Dashboard POST for greenfield Preview E2E bootstrap
- Broader Editor UX polish beyond audited fields
- assign-owner endpoint deprecation cleanup if still unused after host-owner path
- Any remaining stale archive-plan references to CreateInvitationFlow (historical only)

## Acceptance criteria

1. Managed client create cannot bypass via Dashboard UI/API — **Yes**
2. Internal create primitives still work — **Yes**
3. Production promotion only via `invitation:promote` — **Yes** (docs + existing parseMutationTargets tests)
4. Parity gaps via shared contracts — **Yes**
5. Six couplings owned by section presentation — **Yes**
6. No broad theme/asset refactor — **Yes**
7. Local/Preview agent identities are real product roles — **Yes**
8. Obsolete create UI removed after replacement — **Yes**
9. Operational docs match behavior — **Yes**
10. Required validation gates pass — **Yes** (full `pnpm run ci` / Vercel deploy not re-run in this session; type-check + validate:changed + structure green)
