---
title: Canonical Invitation Contract Audit (Goal 1)
status: final
created: 2026-07-31
updated: 2026-07-31
related_skills: []
related_docs:
  - docs/core/invitation-creation-contract.md
  - docs/core/invitation-preparation-contract.md
  - docs/core/content-parity-rsvp-isolation.md
  - docs/domains/intake/production-flow.md
  - docs/database-workflow.md
  - .agent/workflows/managed-invitation-lifecycle.md
  - .agent/rules/invitation-production.md
  - .agent/rules/database.md
supersedes: []
---

# Goal 1 — Canonical Invitation Contract Audit

**Scope:** Diagnostic and decision only. No architectural implementation in this goal.  
**Evidence base:** Live repository code, executable `.agent` rules, tests, DB contracts, and active docs (2026-07-31).  
**Verdict:** Two creation models coexist (Dashboard ad-hoc vs managed CLI). Managed lifecycle SSOTs are clear in code. Render parity has concrete Editor gaps. Image double-encode at render is disproven for managed remotes; release-from-disk and editor upload always re-encode. Agent identity and DB classifiers already exist and should be reused.

---

## A. Responsibility inventory

Classification key: **KEEP** | **CONSOLIDATE** | **REPLACE** | **DEPRECATE** | **REMOVE**

### Creation & Dashboard

| Component | Class | Responsibility | Verified consumers | Rationale |
|-----------|-------|----------------|--------------------|-----------|
| `/dashboard/invitaciones/nueva` + `CreateInvitationFlow` | **CONSOLIDATE** | Admin UI create → Editor | `InvitationList` links, admin UI | Omits `hostLoginAlias`, `visualProfileId`, package/provenance; sets admin as owner |
| `InvitationList` demo duplicate UI | **CONSOLIDATE** | Demo → client UX | Demo rows only (`hidden: !isDemo`) | Redundant with `/nueva`; same contract gaps |
| `POST /api/dashboard/intake` | **CONSOLIDATE** | HTTP client create choke point | CreateInvitationFlow, E2E preview fixture | Primary managed-lifecycle bypass; must become enforcement boundary |
| `GET /api/dashboard/intake` + `synchronizeDemoInvitations` | **KEEP** | Demo DB sync from catalog + `event-demos` | Dashboard list, E2E inventory | Legitimate demo infrastructure |
| `POST .../duplicate` | **CONSOLIDATE** | Clone demo → client + title-only draft | InvitationList | Server rejects non-demo; still ad-hoc client create |
| `POST .../assign-owner` | **DEPRECATE** | Assign owner when `created_by` null | Dead for dashboard-created rows | Create always sets `createdBy: session.userId` |
| `invitation.service.createInvitation` | **CONSOLIDATE** | Preset/eventType invariant | Intake POST only | Keep invariant; stop using as managed-client create path |
| `invitation.service.duplicateInvitationFromDemo` | **CONSOLIDATE** | Demo clone + draft seed | Duplicate POST | Same owner/content gaps |
| `invitation.repository.createInvitation` | **KEEP** | Service-role INSERT | Service layer, demo sync, tests | Shared primitive; enforce policy above |

### Managed provision

| Component | Class | Responsibility | Verified consumers | Rationale |
|-----------|-------|----------------|--------------------|-----------|
| `scripts/provision/invitations/*.ts` + `registry.ts` | **KEEP** | Managed definition SSOT | All provision CLIs | Canonical release intent |
| `apply-local-invitation.ts` | **KEEP** | Local create/update + assets + publish | `invitation:update`, reconcile | Persistent-local engine |
| `invitation-import-engine.ts` | **KEEP** | Hosted upsert (Preview/Prod) | update, promote, preview-apply | Hosted apply |
| `invitation-host-owner.ts` | **KEEP** | Dedicated `host_client` Auth user | apply-local, import engine | Creation-contract owner policy |
| `pnpm invitation:update` | **KEEP** | Local/Preview managed apply | Operators/agents | Production mutation rejected |
| `pnpm invitation:promote` | **KEEP** | Owner-only Production promotion | Owner | Canonical Production path |
| `pnpm invitation:reconcile` | **KEEP** | Local/Preview divergence resolution | Operators | Second-writer resolution |
| `pnpm invitation:content-parity` | **KEEP** | Read-only semantic parity | Operators | Cross-env compare |
| `pnpm dbs` | **KEEP** | Compact read-only env/slug status | Operators/agents | Observability composition point |
| `db:preview:sync-invitations` | **KEEP** | Prod→Preview mirror (not promote) | Regression ops | Opposite direction from promote |
| `legacy-production-adoption-*` | **DEPRECATE** | One-shot Prod adoption | Historical (Romina) | Not general promotion |
| Manual production SQL patches | **DEPRECATE** | Legacy prep | Historical | Superseded by managed CLI |
| `pnpm ops new-invitation` / `optimize-assets` / `adopt-legacy-events` | **REMOVE** | — | Already removed in `cli.mjs` | Do not restore |

### Contracts & render

| Component | Class | Responsibility | Consumers | Rationale |
|-----------|-------|----------------|-----------|-----------|
| `invitation-section-registry.ts` | **KEEP** | Section inventory, save keys, required flags | Editor shell | SSOT for editor section list |
| `presentation-options.ts` | **KEEP** | Section presentation enums | Editor + published schemas | Correct ownership for family/location |
| `theme-contract.ts` / `THEME_PRESETS` | **KEEP** | Visual language + preset catalog | Provision, adapters, SCSS | Keep; move only concrete structural couplings |
| `section-styles.schema.ts` | **CONSOLIDATE** | Profile variants/flourishes/labels | Publish preserve, renderers | Profile-owned today; some fields are structural |
| `draft-to-published.mapper.ts` | **KEEP** | Draft → published transform | Publish path | Mapping SSOT |
| `eventContentSchema` / section schemas | **KEEP** | Published content contract | Adapter, validators | Runtime content SSOT |
| Editor section schemas | **CONSOLIDATE** | Host-editable fields | Editor forms | Gaps vs published (see matrix C) |
| Demo preset catalog + `event-demos` JSON | **KEEP** | Showroom demos | Create invariant, demo sync | Not client managed definitions |

### Assets

| Component | Class | Responsibility | Rationale |
|-----------|-------|----------------|-----------|
| `normalizeInvitationImage` (`asset-policy.ts`) | **KEEP** | Defensive encode/validate | Single runtime encoder |
| `image-optimization.ts` (preparation) | **KEEP** | Planning only, no theater recompress | Prep contract §7 |
| `normalized-invitation-release.ts` | **KEEP** | Package builder (always normalizes from disk) | Managed release |
| `asset-reconciliation.ts` | **KEEP** | Hash-based REUSE/UPLOAD | Skip binary when SHA matches |
| `cloudinary-adapter.ts` | **KEEP** | Cloudinary provision exception | Abril path |
| Removed `optimize-assets.mjs` | **REMOVE** | — | Do not restore |

### Identity & observability

| Component | Class | Responsibility | Rationale |
|-----------|-------|----------------|-----------|
| `db:local:bootstrap-admin` | **KEEP** | Local `super_admin` repair | Agent Local login |
| Preview `preview@preview.com` + Playwright env | **KEEP** | Preview agent/E2E identity | Product role reuse |
| Disposable `seed-test-data.sql` | **KEEP** | Test identities | Disposable only |
| `classifySchemaLifecycle` | **KEEP** | Schema status classifier | Canonical |
| `semantic-delta` + `reconciliation-state` | **KEEP** | Field-level content divergence | Canonical |
| `dbs-status.evaluateInvitationStatus` | **KEEP** | Compact content summary | Coarse; compose with semantic-delta |
| Husky pre-commit / pre-push | **KEEP** | Git/lint/tests only | Do not add DB network to hooks |

### Tests / fixtures

| Component | Class | Note |
|-----------|-------|------|
| Unit/API create + demo-sync tests | **KEEP** | Cover invariants |
| `provision-preview-fixture.spec.ts` (Dashboard POST) | **CONSOLIDATE** | Move to managed provision or keep as explicit test-only bypass with flag |
| Disposable SQL / pgTAP inserts | **KEEP** | Harness only |

---

## B. SSOT matrix

| Responsibility | Intended authority | Competing authorities today | Decision |
|----------------|-------------------|----------------------------|----------|
| **Managed invitation definition** | `scripts/provision/invitations/<slug>.ts` + registry | Dashboard create (no definition) | Definition wins for managed slugs |
| **Creation workflow (managed client)** | `invitation:update` → Local/Preview; `invitation:promote` → Production | `POST /api/dashboard/intake`, duplicate | Enforce at API; retire Dashboard for managed clients |
| **Creation workflow (demo)** | `synchronizeDemoInvitations` + `event-demos` | — | Keep |
| **Creation workflow (editor-native / sandbox)** | Dashboard create *if retained* | Undocumented vs managed | Explicitly scope or retire |
| **Section/content contract** | `eventContentSchema` + section schemas | Draft schema + editor schema drift | Published schema is runtime SSOT; editor must converge |
| **Presentation contract** | `presentation-options.ts` + section fields | `sectionStyles.*` for structural flags | Move listed structural flags to section presentation |
| **Theme** | `theme-contract.ts` / preset SCSS | Theme-injected copy/defaults in adapter | Theme = visual language; stop injecting section copy |
| **Editor field semantics** | Registry + editor schemas | `labels.ts`, nav labels, draft schema | Consolidate labels into one editor vocabulary |
| **Draft → published mapping** | `draft-to-published.mapper.ts` | Seed-merge preserving unpublished editor fields | Keep mapper; document seed-preserve as intentional |
| **Asset ingestion policy** | `asset-policy.ts` + publish `assertUploadedAssetPolicy` | Prep planning targets | Prep plans; policy enforces |
| **Environment divergence** | `semantic-delta` + `reconciliation-state` | `dbs-status` hash heuristic; editor artifact | Field truth = semantic-delta; dbs = compact |
| **Schema status** | `schema-lifecycle-state.classifySchemaLifecycle` | Doc references to nonexistent `db:preview:patch` | Classifier + `db:*:audit` only |
| **Agent application identity** | Local bootstrap-admin / Preview `preview@preview.com` as `super_admin` | service_role in CLI only | App login = product roles; CLI ≠ browser identity |
| **Canonical release vs env state** | Git definition + package hashes vs per-env DB/Storage/Auth | Editor publish as second writer | Documented; reconcile when diverged |

---

## C. Contract / parity matrix

Pipeline:

```text
canonical/definition → draft/editor → draft-to-published → published_invitation_content
  → adaptEvent → InvitationViewModel → render-plan / section-render-data → components
```

### Covered sections (summary)

Registry public sections: hero, quote, family, gallery, countdown, location, itinerary, rsvp, gifts, thankYou, personalizedAccess (+ config: metadata, music, envelope, publication, sharing, assetLibrary).

### Parity gaps (genuine Editor contract gaps)

| Field / behavior | Reaches renderer | Editor | Classification |
|------------------|------------------|--------|----------------|
| `location.visibility` (`after-rsvp`) | Yes (`location-policy`) | Schema/mapper only, no UI | **Gap** |
| Hero `focalPoint*`, `backgroundImageDesktop` | Yes | No | **Gap** |
| Thank-you `closingPhrase`, `date`, `focalPoint`, `overlay*` | Yes | No | **Gap** |
| RSVP `accessMode`, `personalizedAccess` copy, `calendar.*` | Yes | No (prior preserved) | **Gap** |
| Sharing `ogImage` | Yes | No | **Gap** |
| `indications[].styleVariant` | Yes | Always publishes `'default'` | **Gap** |

### Managed / profile-only (intentional; not host Editor gaps)

| Field | Notes |
|-------|-------|
| Entire `sectionStyles` tree | Variants, flourishes, RSVP labels, footer |
| `interludes[]` | In draft schema, no UI |
| Envelope premium seal/reveal/palette | Survive via seed-merge |
| `templateId`, `visualProfileId`, intersections | Provision-owned |
| Gallery `layoutRole` / `variant` / `presentation` | Structural; derived or profile |

### Intentionally derived (not gaps)

Countdown target from `eventTiming`; envelope teaser; navigation; itinerary monogram; music `revealMode`; branding visibility; demo RSVP phone; reveal recipes.

### Label / semantics duplication

- Family: registry `"Familia"` vs editor presentation `"Personas principales"` vs `SECTION_LABELS`
- Itinerary: `"Programa"` vs `"Itinerario"`
- Nav targets vs registry RSVP labels (third source in `canonical-navigation`)
- Draft RSVP `confirmationMode`: draft `optionalText(20)` vs editor strict enum

### Theme → section structural couplings (move candidates only)

1. `sectionStyles.location.showFlourishes` → venue-card presentation  
2. `indications[].styleVariant` → indication presentation  
3. Gallery `layoutRole` / `presentation` → gallery presentation  
4. Itinerary `timeline-paper` variant → itinerary presentation mode  
5. `PORTRAIT_SUPPORTED_THEMES` silent hide → explicit section capability  
6. `enchanted-rose` injected location/hero copy → section seed/content, not theme adapter  

**Do not** broad-refactor ThemePreset for color/type tokens, editorial-magazine hero swap, RSVP theme UX branches, or `visualProfileId` composition.

---

## D. Dependency and removal map

```text
Dashboard UI (nueva / duplicate)
  → adminApi → POST /api/dashboard/intake|duplicate
    → invitation.service.create*|duplicate*
      → invitation.repository.createInvitation  ← KEEP forever (also demos)

Managed definition (registry)
  → invitation:update
    → applyLocalInvitation (local) | runImportEngine (preview)
      → invitation-host-owner + normalize/release assets + publish_invitation_atomic
  → invitation:promote (production only)
    → runImportEngine(production) after approval + schema CURRENT + backup

Editor publish (any invitation)
  → publishDraft → publish_invitation_atomic
  → may diverge managed slugs → invitation:reconcile

Demo sync
  → GET list → synchronizeDemoInvitations → repository.create + publish

Observability
  → dbs-status composes schema-lifecycle-state + package hash
  → semantic-delta / reconciliation-state for field truth
  → editor-divergence reads runtime reconciliation artifacts
```

### Safe removal order (Goal 2+)

1. **Docs first:** Align production-flow §3, content-parity “Promote” row, database-workflow promote table with `invitation:promote`.  
2. **API enforcement:** Restrict `POST /api/dashboard/intake` for managed/production clients before deleting UI.  
3. **Retire UI:** `/nueva` + duplicate for managed clients (keep demo sync).  
4. **E2E fixture:** Retarget provision CLI or gate Dashboard POST as test-only.  
5. **Then** remove/deprecate `assign-owner` if unused; never delete repository `createInvitation` or demo sync.  
6. Presentation/theme moves only for the six couplings above.  
7. Asset: no restore of `optimize-assets.mjs`; optional compliant-input short-circuit is optimization, not required for correctness.

---

## E. Documentation conflicts

| Document | Conflict | Authoritative replacement |
|----------|----------|---------------------------|
| `docs/domains/intake/production-flow.md` §3 | Documents Dashboard create as primary path | Same doc Single-File section + `invitation-creation-contract.md` + `managed-invitation-lifecycle.md` for managed clients |
| `docs/core/content-parity-rsvp-isolation.md` Flows table L39 | Promote = `invitation:update` through Production | Code: `parseMutationTargets` rejects production; use `invitation:promote`. Note: later table in same doc already lists promote — fix Flows table |
| `docs/database-workflow.md` L175 | `invitation:update` Promote Local→Preview→Production | Same as above; split Update (Local/Preview) vs Promote (Production) |
| `.agent/rules/database.md` | References `db:preview:patch` | No such `package.json` script; use `db:preview:migrate` |
| Overloaded “Promote” wording | Preview step inside update vs Production promote | Prefer “Preview apply” vs `invitation:promote` |
| Per-invite markdown lag | Static readiness notes vs live DB | Operational SSOT: `pnpm dbs <slug>` / readiness |
| Archived plans / removed ops | Historical `ops new-invitation` | `scripts/cli.mjs` rejection + `invitation-production.md` |
| `intake-publishing-coupling-audit.md` (2026-06) | Narrow import-coupling plan | Orthogonal; this Goal 1 audit is authority for creation/lifecycle/parity |

**Doc authority for managed lifecycle (effective):**  
`invitation-creation-contract.md` → `production-flow.md` (Single-File + promote) → `managed-invitation-lifecycle.md` → `invitation-production.md` → live CLI `--help`.

---

## F. Implementation decisions (Goal 2 handoff)

### CONFIRMED

1. **Managed client invitations** are created/updated via definition registry + `invitation:update` / `invitation:promote`, not Dashboard `/nueva`.  
2. **Server boundary for canonical-only create:** harden `POST /api/dashboard/intake` (and duplicate) — UI removal alone is insufficient. Options confirmed viable: reject managed registry slugs; reject client creates in Preview/Production; require host-owner + provenance for client rows.  
3. **Keep:** repository `createInvitation`, demo sync, host-owner, apply-local, import-engine, all `invitation:*` / `dbs` CLIs.  
4. **Canonical vs env:** definition + package hashes are release SSOT; DB/Storage/Auth are environment state; editor publish is intentional second writer resolved by reconcile.  
5. **Image:** Managed remote WebP → renderer direct URL — **no render double-encode**. Release-from-disk and editor upload **always** re-encode via `normalizeInvitationImage` (defensive, not proven harmful pass-through requirement). Apply skips upload when SHA256 matches. **Do not restore `optimize-assets.mjs`.**  
6. **Agent identity:** Local `super_admin` via `db:local:bootstrap-admin`; Preview `preview@preview.com` + Playwright env + MFA bypass gates. Editor requires `super_admin` + strong auth. Host flows use real `host_client`. No service_role browser login, no Production agent apply, no invented agent permissions.  
7. **Observability:** Schema → `classifySchemaLifecycle`; content field → `semantic-delta` / `reconciliation-state`; compact → `dbs-status`. Hooks stay Git/test-only; compose `pnpm dbs` for status.  
8. **Theme:** Only the six listed structural couplings are candidates for section presentation; no broad theme refactor.

### REQUIRES IMPLEMENTATION (Goal 2+)

| Decision | Work |
|----------|------|
| Retire Dashboard managed-client create UX | Remove/redirect `/nueva` + duplicate for production managed path after API gate |
| API canonical-only enforcement | Implement choke-point policy on POST create/duplicate |
| E2E preview fixture | Stop depending on Dashboard POST or mark as explicit test bypass |
| Fix stale docs | content-parity Flows table, database-workflow promote row, production-flow §3 scope, database.md `db:preview:patch` |
| Editor parity gaps | Decide host-editable vs managed-only for each gap in §C; implement or document as profile-only |
| Presentation ownership | Move six theme/sectionStyles structural couplings into section presentation contracts |
| Label consolidation | Single editor vocabulary for section labels |
| Optional asset short-circuit | Only if Goal 2 prioritizes; not required to fix a live double-encode bug |
| Compact Git/DB status | Compose existing classifiers; no new parallel classifier; not in husky |

### NO CHANGE NEEDED

| Area | Reason |
|------|--------|
| Demo synchronization | Correct demo infrastructure |
| `invitation:promote` owner gates | Already correct in code |
| RSVP/PII isolation from promote/mirror | Already enforced |
| Schema lifecycle orthogonal to content | Already separated |
| Preparation planning (`image-optimization.ts`) | Correctly non-encoding |
| Theme visual language (colors, type, SCSS presets) | Correct ownership |
| Intentionally derived render fields | Not Editor gaps |
| Husky hook scope | Correctly excludes DB network |

---

## Lifecycle reconstruction (effective)

```text
preparation (docs/invitations/<slug>.md)
  → canonical definition (scripts/provision/invitations/<slug>.ts)
  → implementation (TS/SCSS/assets in git)
  → Local (invitation:update --targets local)
  → package (.agent/tmp/packages/*.json)
  → Preview apply (invitation:update --targets preview) + pending approval
  → QA (readiness, content-parity, visual checklist, schema CURRENT)
  → finalize Preview approval artifact
  → [optional] invitation:reconcile on divergence
  → Production (owner invitation:promote --apply)
```

Out-of-lifecycle writers: Dashboard editor publish; share-message patch; Prod→Preview mirror; local restore-from-dump; `db:prod:patch`; legacy adoption; manual SQL.

---

## Acceptance criteria checklist

1. Every real creation path traced — **Yes** (§A)  
2. Dashboard retire vs keep primitives proven — **Yes** (§A, §D)  
3. Lifecycle + SSOTs explicit — **Yes** (§B, lifecycle)  
4. Render-affecting fields accounted — **Yes** (§C)  
5. Theme structural couplings identified without broad refactor — **Yes** (§C)  
6. Image double-processing claim evidenced — **Disproven at render; confirmed re-encode at release-from-disk and editor upload** (§F)  
7. Local/Preview agent identity defined — **Yes** (§F CONFIRMED #6)  
8. DB/schema classifiers + hook points identified — **Yes** (§B, §F)  
9. Single intended SSOT or consolidation decision per responsibility — **Yes** (§B)  
10. Goal 2 implementable without rediscovery — **Yes** (§F decisions)

---

## Goal 2 entry point

Implement in this order unless product prioritizes otherwise:

1. Documentation conflict fixes (low risk, unblocks operators).  
2. `POST /api/dashboard/intake` (+ duplicate) canonical enforcement.  
3. Dashboard create UX retirement / repositioning + E2E fixture retarget.  
4. Editor parity decisions for §C gaps (edit vs managed-only).  
5. Six presentation ownership moves.  
6. Optional compact `dbs`-composed status for agents (CLI only, not hooks).
