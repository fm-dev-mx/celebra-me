---
title: Canonical Migration & Invitation-State — Goal 1 Audit
status: final
created: 2026-08-12
updated: 2026-08-12
related_docs:
  - docs/domains/database/cheatsheets/status-diagnostics.md
  - docs/core/content-parity-rsvp-isolation.md
  - .agent/plans/archived/invitation-promotion-status-goal1-audit.md
  - .agent/plans/archived/invitation-promotion-status-goal2-report.md
---

# Goal 1 — Canonical Migration & Invitation-State Audit

Read-only live audit. No migrations applied, no invitation writes, no Preview/Production
mutation, no Vercel queries. Classification reused the existing engine; no parallel vocabulary
was introduced.

Probe: `.agent/tmp/canonical-migration-invitation-state-audit.mts` composing
`evaluateGeneralStatus` + `classifyLiveInvitation` + `decidePromotionAction` on one
`StatusProbeSession`. `probedAt`: `2026-08-12T22:11:54.818Z`. Debug: 12 invocations, 6 memo
hits, `timeoutDegraded: false`.

## Independent domains (non-negotiable)

```text
SCHEMA / MIGRATION PARITY     classifySchemaLifecycle + migration_history_parity
≠ INVITATION CONTENT          classifyLiveInvitation + decidePromotionAction
≠ MIGRATION OPERATION READINESS  deriveSchemaOperationFields (disposable proof + pending)
```

`Schema = CURRENT` does not mean invitations are synchronized.
`Op readiness = NEEDS_DISPOSABLE_PROOF` does not mean persistent databases are `BEHIND`.
`PROMOTIONS CURRENT` (empty list) is content-only and must never be read as schema `CURRENT`.

## Classifier SSOT (do not reimplement in Goal 2)

| Domain | Authority | Tokens |
| --- | --- | --- |
| Schema lifecycle | `scripts/db/schema-lifecycle-state.ts` `classifySchemaLifecycle` | `CURRENT` \| `BEHIND` \| `SCHEMA_DRIFT` \| `UNVERIFIED` |
| Schema history I/O | `scripts/status-core/migration-probe.ts` | pending/extra IDs from `schema_migrations` |
| Op readiness | `scripts/provision/dbs-status.ts` `deriveSchemaOperationFields` | `READY` \| `NEEDS_DISPOSABLE_PROOF` \| `PENDING_MIGRATIONS` \| `SCHEMA_DRIFT` \| `UNREACHABLE` \| `NOT_CONFIGURED` \| `UNVERIFIED` |
| Per-env content | `scripts/provision/promotional-fingerprint.ts` `classifyLiveInvitation` | `match` \| `behind` \| `absent` \| `diverged` \| `conflict` \| `unknown` |
| Promotion action | `scripts/provision/promotion-decision.ts` `decidePromotionAction` | `NONE` \| `PROMOTE_PREVIEW` \| `PROMOTE_PRODUCTION` \| `BLOCKED` \| `UNKNOWN` |
| Inventory | `scripts/provision/invitations/registry.ts` `listInvitationDefinitions` | 5 managed slugs |

Formatter aliases allowed in UI copy only (must not become a second classifier):

| Engine action | Display alias if needed |
| --- | --- |
| `NONE` | `NO_ACTION` |
| `PROMOTE_PREVIEW` | same |
| `PROMOTE_PRODUCTION` | same |
| `BLOCKED` | do **not** collapse to `CONTENT_DIVERGENCE` — keep `reasonCode` |
| `UNKNOWN` | `UNVERIFIED` |

`BLOCKED` reasons are distinct: `IDENTITY_CONFLICT`, `MANAGED_DIVERGENCE`,
`PRODUCTION_AHEAD_OF_PREVIEW`, `LOCAL_BEHIND_PREVIEW_ALIGNED`. Collapsing them loses the
next valid action.

Expected migration authority: `supabase/migrations/` via `listExpectedMigrationVersions()`.
Head: `20260806120000`. Count: 75.

## Migration matrix

Persistent databases only. Disposable-test is **not** in this table.

| Environment | Latest Applied | Pending | Extra/Drift | Schema State | Op Readiness | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Local (`persistent-local`) | `20260806120000` (75/75) | *(none)* | *(none)*; reorder=false; divergent=false | `CURRENT` | `NEEDS_DISPOSABLE_PROOF` | `LIVE` 2026-08-12T22:11:46.175Z |
| Preview (`preview`) | `20260806120000` (75/75) | *(none)* | *(none)*; reorder=false; divergent=false | `CURRENT` | `NEEDS_DISPOSABLE_PROOF` | `LIVE` 2026-08-12T22:11:46.182Z |
| Production (`production`) | `20260806120000` (75/75) | *(none)* | *(none)*; reorder=false; divergent=false | `CURRENT` | `NEEDS_DISPOSABLE_PROOF` | `LIVE` 2026-08-12T22:11:46.187Z |

No missing, extra, or reordered migration IDs on any persistent target.

Global `schemaNextAction` from the engine: `pnpm db:migrate -- --target disposable-test --apply`.
That is an **operation-readiness** gate for future schema writes, not a persistent-schema deficit.

### Disposable-test (separate)

| Proof | Status | Evidence |
| --- | --- | --- |
| `.agent/tmp/disposable-migration-proof.json` | **missing** | `LIVE` filesystem check at probe time; no receipt artifact |

A later successful disposable apply would still **not** mean Local/Preview/Production were
migrated. Do not put disposable-test in the persistent parity matrix.

## Invitation action list

Registry SSOT (5): `alba-rosa-quinonez`, `abril-michelle-becerra-rea`, `daniela-y-martin`,
`romina-rios-chaparro`, `victoria-y-roberto`.

`NO_ACTION` / `NONE` count: **0**.

Per-env states are from `classifyLiveInvitation` (live JSON + asset sha256, no timestamps,
no Storage download, no Vercel). Query evidence for all three persistent DBs: `LIVE`.

| Invitation | Source | Destination | State | Reason | Evidence | Next Handoff |
| --- | --- | --- | --- | --- | --- | --- |
| `alba-rosa-quinonez` (`cumple`) | canonical | preview | `PROMOTE_PREVIEW` | Local `match`, Preview `behind`, Production `unknown`. `PREVIEW_BEHIND_CANONICAL`. Production unknown does not block Preview-first. | `LIVE` | `pnpm invitation:release -- --slug alba-rosa-quinonez --targets preview --dry-run` then Preview `--apply` only with explicit Preview task scope |
| `abril-michelle-becerra-rea` (`xv`) | canonical | preview | `PROMOTE_PREVIEW` | same shape as Alba | `LIVE` | `pnpm invitation:release -- --slug abril-michelle-becerra-rea --targets preview --dry-run` (Preview scope for `--apply`) |
| `daniela-y-martin` (`boda`) | canonical | preview | `PROMOTE_PREVIEW` | Local `match`, Preview `behind`, Production `behind`. Forward Preview-first; do not skip to Production. | `LIVE` | `pnpm invitation:release -- --slug daniela-y-martin --targets preview --dry-run` (Preview scope for `--apply`) |
| `romina-rios-chaparro` (`xv`) | canonical | preview | `PROMOTE_PREVIEW` | Local `match`, Preview `behind`, Production `unknown` | `LIVE` | `pnpm invitation:release -- --slug romina-rios-chaparro --targets preview --dry-run` (Preview scope for `--apply`) |
| `victoria-y-roberto` (`boda`) | preview | production | `PROMOTE_PRODUCTION` | Local `match`, Preview `match`, Production `behind`. `PREVIEW_ALIGNED_PRODUCTION_BEHIND`. | `LIVE` | Agent-safe: `pnpm invitation:release -- --slug victoria-y-roberto --targets production --dry-run`. **OWNER APPLY:** `pnpm invitation:release -- --slug victoria-y-roberto --targets production --apply` |

Production `unknown` (Alba, Abril, Romina) means a live row was read but the promotional
fingerprint could not be built (fail-closed: missing published JSON, asset digest, canonical
asset key, unmapped uploaded UUID, or identity fields). It is **not** `absent` and **not**
unreachable. It does not change the Preview-first action. Goal 2 UI must still show the
per-env `unknown`.

Apply-time gates are **not** part of this classification (Preview approval artifact, critical
backup, `pnpm release-check`, owner TTY `PROMOTE <8-hex>`). Schema `CURRENT` satisfies the
promote schema gate. Disposable proof is **not** a promote gate.

Out of registry (not classified): client work such as `xareni-iyarit` / `leah-lexa` and
local-render-corpus fixtures. Do not union them into the promotion list.

Active invitation **row** counts (all non-archived rows, not registry): Local 26, Preview 27,
Production 26. Identity conflicts: 0. The extra Preview row is inventory, not a managed
promotion action.

## CLI / authority findings (Goal 2 must not copy these)

1. **`pnpm dbs --json` promotions omit per-env states and source/destination.** The previous
   promotion Goal 1 contract specified `environments: { local, preview, production }`. Goal 2
   of that work shipped `{ slug, eventType, action, reasonCode }` only. UI cannot show the
   required source/destination without either extending that payload or re-deriving it from
   the same functions. Extend the payload; do not reimplement the decision.
2. **`pnpm dbs <slug>` still prints `evaluateInvitationStatus` package-hash/timestamp
   vocabulary** (`MATCH_CANONICAL` / `DIVERGED`) beside the new `Promotion:` line. Dual
   authority. Promotional UI must use fingerprint + `decidePromotionAction` only.
3. **Header “Managed” counts every active `invitations` row**, not `listInvitationDefinitions()`.
   Label is false. Do not use it as the managed corpus.
4. **Global `schemaNextAction` is disposable-first even when all persistent DBs are `CURRENT`.**
   Correct for migrate authorization; misleading if shown as “schema is behind.” Keep three
   columns: Schema State, Op Readiness, Content Action.
5. **`PROMOTIONS` / `CURRENT` in empty-list text collides with schema `CURRENT`.** Prefer
   `PROMOTIONS (none)` or `IN_SYNC` for the empty content list.
6. **`--compact` CONTENT is connectivity-only** (by design for Git hooks). Must not be used as
   live invitation publication state.
7. **`invitation:release --status` leaves remotes `UNEVALUATED`.** Not a live publication
   authority.
8. **Observability `applyNextStep` and `invitation-promotion-candidates.ts` remain competing
   next-action calculators.** Goal 2 UI must consume `decidePromotionAction` only.

## Probe / evidence policy (keep)

- One `StatusProbeSession` per execution; memoize connectivity, `schema_migrations`, and the
  grouped promotional SELECT (one per env).
- Do not call `pnpm db:prod:audit` from this status path (owner-only object audit; different
  evidence class).
- Do not query Vercel for this matrix.
- Cached snapshots (observability, reconciliation JSON) may be displayed only as `CACHED`.
- This audit did not use them as live authority.

## Goal 1 non-goals (honored)

- No `db:migrate` apply.
- No `invitation:release --apply`.
- No Preview/Production writes.
- No owner TTY.

## Goal 2 contract

Implement UI and operational handoffs that **consume** the SSOT above.

Must:

- Render the three domains as separate fields.
- Show only registry invitations; default list = action ≠ `NONE`.
- For each pending promotion, show source, destination, `reasonCode`, evidence `LIVE`/`CACHED`/`UNVERIFIED`, and the exact next command from this audit (Preview dry-run vs **OWNER APPLY** Production).
- Extend `PromotionStatusRow` / JSON with `environments`, `source`, `destination` derived from the existing decision + env states — no new business rules.
- Stop using package-hash status as promotional authority in the slug view.
- Keep `--compact` free of fingerprint I/O.

Must not:

- Redefine `classifySchemaLifecycle` or `decidePromotionAction`.
- Treat disposable proof as invitation publication state.
- Treat schema `CURRENT` as content sync.
- Auto-promote or auto-migrate.
- Execute Production `--apply`.

## Handoff

| Field | Value |
| --- | --- |
| Current state | Goal 1 complete: live histories classified; all 5 managed invitations classified |
| Completed work | Read-only probe + this specification |
| Evidence | Probe JSON at `.agent/tmp/canonical-migration-invitation-state-audit.json`; 12 SQL invocations / 6 memo hits |
| Validation passed | Persistent histories independently classified from `schema_migrations`; empty pending/extra sets; disposable reported separately |
| Validation not run | `db:*:audit` object-audit class (out of scope); Production fingerprint-failure subtype for the three `unknown` rows (fail-closed is enough for action) |
| Residual risks | Production `unknown` on Alba/Abril/Romina hides whether Production is behind vs unhashable; Preview `--apply` still needs task scope; Victoria Production apply still needs owner gates |
| Authorization | None for writes |
| Next | Goal 2 implemented: `.agent/plans/archived/canonical-migration-invitation-state-goal2-report.md` |
