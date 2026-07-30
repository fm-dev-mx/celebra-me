# Content Parity and RSVP Isolation Contract

**Owns:** the operational contract between invitation **content parity** and **RSVP/PII
isolation** across Local, Preview, and Production.

**Does not own:** schema ERD, env variable inventory, invitation identity fields, or CLI flag
semantics. Those remain in `docs/domains/database/overview.md`, `docs/env-workflow.md`,
`docs/core/invitation-creation-contract.md`, and live CLI help.

Executable comparison: `pnpm invitation:content-parity` /
`scripts/provision/content-parity.ts` (reuses `promotion-comparison.ts` canonicalization).

---

## Target model

```text
Managed content:
definition/package → Local → Preview → Production

Regression mirror:
Production → Preview
(content regression only; never promotion)

RSVP:
Local      → synthetic, environment-local
Preview    → synthetic, environment-local
Production → real operational data only
```

Content parity is **semantic**, not raw database equality.

---

## Flows (terminology)

| Term | Meaning | Direction | Command |
| --- | --- | --- | --- |
| **Promote** | Managed invitation content release | Local → Preview → Production | `pnpm invitation:update` |
| **Mirror** | Invitation-facing content regression copy | Production → Preview only | `pnpm db:preview:sync-invitations` |
| **Restore** | Debugging import of a Production dump into Local | Production backup → Local | `pnpm db:local:restore-from-dump` |
| **RSVP mutation** | Guest/claim/attendance/view/delivery writes | Within one environment | Authenticated RSVP/dashboard services |

Production never imports content from the Preview database or Preview Storage. Mirror is never a
promotion path.

---

## Writer ownership

### Managed invitations

Canonical writers: `scripts/provision/invitations/<slug>.ts`, the immutable package/provenance
model, and `pnpm invitation:update`. Independent editor edits against the same managed published
state are target divergence; existing managed reconciliation/merge behavior remains the intentional
resolution path. Editor changes must not silently become a second source of truth for a managed
slug.

### Editor-native invitations

Canonical writers: the dashboard editor and `publish_invitation_atomic` within the intended
environment. This contract does not migrate editor-native content into the managed package model.

### RSVP

Canonical writers: authenticated RSVP and dashboard operational services. Content promotion,
mirroring, parity verification, and invitation tooling must not insert, update, or delete guests or
claim codes. Invitation tooling may synchronize only an environment-local `events` shell and owner
membership for non-demo client invitations.

### Explicit publication exception — host share messages

`updateShareMessages` (guests dashboard) may patch `published_invitation_content.content.sharing`
for host WhatsApp/reminder templates without running the full editor publication RPC. It must:

- require an existing published row and event↔invitation link;
- increment `version` and refresh `published_at` so cache/version semantics remain honest;
- mutate only `sharing.shareMessages` / `sharing.reminderSettings` (not a general publish bypass).

This exception is intentional product behavior, not a license for other unpublished content writes.

---

## Semantic parity

Cross-environment “same content” means equal **semantic invitation-facing state** after
canonicalization (see `scripts/provision/promotion-comparison.ts`):

- Storage host URLs normalized to a placeholder
- Invitation metadata: `event_type`, `base_demo_id`, `theme_id`, `kind`, `snapshot`
- Draft and published content JSON
- Assets by semantic key + content digest (`sha256`), not environment asset UUIDs or Storage hosts
- Client RSVP **projection**: linked non-demo `(event_type, slug)` event existence (not event UUID,
  owner, memberships, timestamps, or guests)

### Legitimate environment-specific differences (excluded from equality)

Primary keys and Auth user IDs, Storage hosts/URLs, asset UUIDs, `version` / timestamps,
provenance and mutation/publication receipts, owner FKs, draft `submission_id`, Preview admin
ownership remaps, and any RSVP/PII/operational tables listed below.

---

## `events` boundary

| Class | Fields / relations |
| --- | --- |
| Synchronized projection | `slug`, `event_type`, `title` (from invitation), `invitation_project_id` link; required for published **non-demo** client RSVP |
| Environment-local | `id`, `owner_user_id`, status/timestamps, soft-delete, `event_memberships`, guests, claims, and all RSVP descendants |

Static demos (`event-demos` / `is_demo`) remain content-only by default and must **not** receive
persistent `events` rows unless a separate product contract explicitly requires one. Hybrid/public
personalized RSVP requires a published non-demo invitation **and** a linked environment-local
`events` row.

---

## Strict isolation (never promote or mirror)

By construction, content promote/mirror/parity tooling excludes:

- `guest_invitations`, `guest_invitation_audit`
- `event_claim_codes`
- Legacy `rsvp_records`, `rsvp_audit_log`, `rsvp_channel_log`
- Auth users, credentials, sessions, MFA factors
- `intake_requests`, `intake_submissions`
- `audit_logs`
- `visitor_sessions`, commercial attribution/analytics, and related tracking/PII

Executable exclusion list for the Preview mirror: `EXCLUDED_TABLES` in
`scripts/db/db-target-config.ts`.

---

## Preview mirror and RSVP reset

`pnpm db:preview:sync-invitations` mirrors invitation-facing tables and Storage, remaps ownership to
the dedicated Preview admin, rewrites Storage URLs, and does **not** copy Production guests, claims,
Auth, intake, or commercial data.

It replaces Preview `events` with `TRUNCATE … CASCADE` then reinserts Production event shells. That
**resets Preview RSVP children** (guests, claims, memberships) on those events. Stale Preview-only
invitation candidates are reported only; they are not auto-pruned.

After a mirror apply, recreate required Preview synthetic RSVP/E2E fixtures with the existing gated
provisioning path (`pnpm test:e2e:preview:provision` and
`PLAYWRIGHT_ALLOW_PREVIEW_FIXTURE_PROVISIONING`). Provision synthetic data only.

---

## Local / Preview synthetic RSVP

| Environment | RSVP data |
| --- | --- |
| Disposable / unit | `supabase/test/seed-test-data.sql` (synthetic) |
| Local interactive | Environment-local synthetic guests on local event shells |
| Preview | Synthetic fixtures / E2E provisioning only |
| Production | Real operational guest data only |

---

## Production → Local restore (PII exception)

`pnpm db:local:restore-from-dump` remains an intentional **debugging** workflow. It may import real
Production PII (guests, intake, commercial, optional Auth/Storage dumps) with no sanitization.

- It is **not** content synchronization or promotion.
- Restored Local data must **never** be used to seed Preview.
- Backup artifacts stay under gitignored `.backups/` / `.tmp/` with existing access and retention
  controls.
- “Non-destructive” means the restore avoids `db reset` and does not overwrite existing primary
  keys — it does **not** mean the import is free of PII risk.

No other downward full Production-data path is approved. Blocked refresh aliases remain fail-closed.

---

## Authorization boundary

Worktree path, lane, `CELEBRA_RUNTIME_TARGET`, UI environment banner, and credential presence are
**not** mutation authorization. Authorization requires explicit task scope, classified target, and
the repository’s guarded operation confirmations. See `docs/env-workflow.md` and
`.agent/rules/database.md`.

---

## Legacy / fail-closed paths

| Path | Status |
| --- | --- |
| `pnpm ops adopt-legacy-events` | Fail-closed / disabled — not a supported mutation path |
| `pnpm ops optimize-assets` | Legacy demo helper — not the managed asset pipeline |
| `pnpm db:local:refresh-from-prod*` | Fail-closed — use backup + restore-from-dump |
| Manual production SQL patches | Lint-only via `pnpm db:prod:patch` unless separately authorized |

---

## Related authorities

- Database ops procedures: [`docs/database-workflow.md`](../database-workflow.md)
- Env sources / lane connectivity: [`docs/env-workflow.md`](../env-workflow.md)
- Invitation production runbook: [`docs/domains/intake/production-flow.md`](../domains/intake/production-flow.md)
- Agent DB safety: [`.agent/rules/database.md`](../../.agent/rules/database.md)
- Managed lifecycle procedure: [`.agent/workflows/managed-invitation-lifecycle.md`](../../.agent/workflows/managed-invitation-lifecycle.md)
