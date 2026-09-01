# Content Parity and RSVP Isolation Contract

**Owns:** the operational contract between invitation **content parity** and **RSVP/PII isolation**
across Local, Preview, and Production.

**Does not own:** schema ERD, env variable inventory, invitation identity fields, or CLI flag
semantics. Those remain in `docs/domains/database/overview.md`, `docs/env-workflow.md`,
`docs/core/invitation-creation-contract.md`, and live CLI help.

Executable comparison: `pnpm invitation:content-parity` / `scripts/provision/content-parity.ts`
(reuses `promotion-comparison.ts` canonicalization).

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

| Term              | Meaning                                          | Direction                     | Command                               |
| ----------------- | ------------------------------------------------ | ----------------------------- | ------------------------------------- |
| **Update**        | Managed invitation apply to Local and/or Preview | Definition → Local / Preview  | `pnpm invitation:release`             |
| **Promote**       | Owner-only managed content release to Production | Approved package → Production | `pnpm prod:apply -- --slug <slug>`    |
| **Mirror**        | Invitation-facing content regression copy        | Production → Preview only     | `pnpm db:preview:sync-invitations`    |
| **Restore**       | Debugging import of a Production dump into Local | Production backup → Local     | `pnpm db:local:restore-from-dump`     |
| **RSVP mutation** | Guest/claim/attendance/view/delivery writes      | Within one environment        | Authenticated RSVP/dashboard services |

Use `pnpm dbs` for read-only managed status, `pnpm invitation:release` for Local/Preview managed
content, `pnpm prod:apply` for owner Production apply, and `pnpm db:migrate` for non-Production
schema. Demo Content Sync, Git lane sync, Preview mirror, and `pnpm db:local:restore-from-dump`
remain separate systems.

Canonical workflow: managed creation via definition registry → Local/Preview with
`pnpm invitation:release` → Production dry-run with
`invitation:release --targets production --dry-run` → Production apply with
`pnpm prod:apply -- --slug <slug> --apply`. `invitation:release` rejects Production mutation
targets.

Production never imports content from the Preview database or Preview Storage. Mirror is never a
promotion path.

---

## Writer ownership

### Managed invitations

Canonical writers: `scripts/provision/invitations/<slug>.ts`, the immutable package/provenance
model, `pnpm invitation:release` (Local/Preview), and owner-only `pnpm prod:apply -- --slug`
(Production). Independent editor edits against the same managed published state are target
divergence; existing managed reconciliation/merge behavior remains the intentional resolution path.
Editor changes must not silently become a second source of truth for a managed slug.

### Editor-native invitations

Canonical writers: the dashboard editor and `publish_invitation_atomic` within the intended
environment. This contract does not migrate editor-native content into the managed package model.

### RSVP

Canonical writers: authorized public RSVP APIs through service-role-only, scope-validating RSVP
RPCs, plus authenticated dashboard operational services through host RLS. The service role has
`SELECT` but no direct `INSERT`, `UPDATE`, or `DELETE` privilege on guest or guest-audit tables.
Content promotion, mirroring, parity verification, and invitation tooling must not insert, update,
or delete guests or claim codes. Invitation tooling may synchronize only an environment-local
`events` shell and owner membership for non-demo client invitations.

### Explicit publication exception — host share messages

`updateShareMessages` (guests dashboard) may patch `published_invitation_content.content.sharing`
for host WhatsApp/reminder templates without running the full editor publication RPC. It must:

- require an existing published row and event↔invitation link;
- increment `version` and refresh `published_at` so cache/version semantics remain honest;
- mutate only `sharing.shareMessages` / `sharing.reminderSettings` (not a general publish bypass).

This exception is intentional product behavior, not a license for other unpublished content writes.

---

## Canonical managed invitation parity

A registry invitation is **canonical** when it has a valid `InvitationDefinition` in
`scripts/provision/invitations/registry.ts`. It is **in parity** when every required environment has
exactly one active managed record whose invitation-facing semantic state matches that definition
after the single comparison owner below. This contract is slug-agnostic: future client migrations
reuse it without per-invitation comparison rules.

### Executable owners (do not add a second path)

| Concern                            | Owner                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Managed definition                 | `scripts/provision/invitations/<slug>.ts` via `defineInvitation` / registry                                              |
| Lifecycle / delivery scope         | `InvitationDefinition.lifecycle`, `deliveryScope`                                                                        |
| Package / publication apply        | `pnpm invitation:release` (Local/Preview), `pnpm prod:apply -- --slug` (Production)                                      |
| Definition vs live status          | `pnpm dbs` promotional fingerprint (`scripts/provision/promotional-fingerprint.ts`)                                      |
| Cross-environment semantic compare | `pnpm invitation:content-parity` (`scripts/provision/content-parity.ts`)                                                 |
| Semantic canonicalization          | `canonicalizeManagedInvitationContent` + `rewriteUploadedAssetReferences` in `scripts/provision/promotion-comparison.ts` |
| Canonical variant fields             | `eventContentSchema` and the adapter consume only declared section variants; legacy aliases are ingress-only during cutover |
| Publication projection             | `preparePublicationProjection` / `canonicalizePublicationValue`                                                          |

`hashPublicationProjection` remains the publication optimistic-lock fingerprint. It is **not** the
cross-environment semantic owner.

### When a managed invitation is in parity

All of the following must hold for each required environment (Local, Preview, Production):

1. **Managed definition ownership** — one registry definition; `managedIdentityId` matches the live
   row; no `IDENTITY_CONFLICT`.
2. **Publication / lifecycle** — `lifecycle: published` expects a published managed record in every
   required environment. `lifecycle: in_progress` may be absent or behind on Production without
   being a promotion candidate; it still must not carry unclassified semantic drift where present.
3. **Effective published payload** — live published (and draft, when present) JSON equals the
   definition’s `buildPublishedContent` after semantic canonicalization.
4. **Runtime-semantic equivalence** — equivalent spellings that the renderer already folds compare
   equal (for example `itinerary.presentation.behavior` vs `itinerary.variant`).
5. **Asset representation** — uploaded refs compare by rewritten managed key; binaries compare by
   `sha256` / `managed_sha256` for **referenced** keys when both environments carry managed
   inventories. Content-only hosted URL strings vs managed uploaded refs at the same path are
   equivalent under the shared comparison owner. Unreferenced leftover rows are not semantic
   content. Missing canonical keys fail closed (`behind`).
6. **Local / Preview / Production** — `invitation:content-parity` reports `PASS` across loaded
   environments, and `pnpm dbs` classifies required environments `match` against the definition
   fingerprint (or an explicit classified remainder below).

### Difference classification

Every remaining field-level difference must receive exactly one class. Do not invent further classes
or suppress unexplained differences.

- **REAL_DRIFT** — Canonical invitation-facing state that should agree but materially differs.
- **ENVIRONMENT_OWNED** — Intentionally owned by the target environment (storage provider,
  first-insert title, Auth/owner IDs).
- **NORMALIZATION_ARTIFACT** — Semantically equivalent representations. If they still fail, fix the
  comparison owner above; do not add slug exceptions.
- **EXPECTED_PROVENANCE** — Publication version, timestamps, receipts, package hashes, or host-owned
  sharing overlays that do not change canonical invitation semantics.

Host `sharing.shareMessages` / `sharing.reminderSettings` overlays written by `updateShareMessages`
are **EXPECTED_PROVENANCE**. Other `sharing.*` fields (og image, og description, WhatsApp template)
remain managed semantic content.

`invitations.title` / `events.title` are currently **ENVIRONMENT_OWNED**: managed apply preserves
the first-insert title and the fingerprint does not include it. Accent/spelling drift is therefore
retained, not hidden. Promoting title into managed equality is a later contract change.

### Semantic compare surface

Cross-environment “same content” means equal **semantic invitation-facing state** after
`canonicalizeManagedInvitationContent`:

- Runtime variant fold, publication projection canonicalize, host-sharing overlay strip, Storage
  host placeholder, sorted keys
- Uploaded asset UUIDs rewritten to managed keys before that canonicalize
- Managed uploaded refs and hosted content-only external representations at the same path are
  **NORMALIZATION_ARTIFACT** equivalents (bare semantic key strings or URL strings; same comparison
  owner; no slug-specific rules)
- Invitation metadata: `event_type`, `base_demo_id`, `theme_id`, `kind`, `snapshot`
- Draft and published content JSON
- Referenced assets by semantic key + content digest (`sha256`), not environment asset UUIDs,
  Storage hosts, or Cloudinary vs local Supabase provider. Empty managed inventory paired with
  hosted URL-string content is representation-compatible with a managed uploaded inventory.
- Client RSVP **projection**: linked non-demo `(event_type, slug)` event existence (not event UUID,
  owner, memberships, timestamps, or guests)

### Identity ambiguity & duplicate protection

Before comparing semantic content, parity evaluation verifies that exactly **one** active logical
invitation matches the target slug in each evaluated environment. If multiple active invitation
records or ambiguous identity mappings exist for a slug:

- Parity evaluation immediately flags `IDENTITY_CONFLICT`.
- Parity check fails (`ok: false`) and returns `IDENTITY_CONFLICT` drift details.
- A target with an identity conflict can **never** report `MATCH_CANONICAL` or `PASS`.

### Legitimate environment-specific differences (excluded from equality)

Primary keys and Auth user IDs, Storage hosts/URLs, asset UUIDs, `version` / timestamps, provenance
and mutation/publication receipts, owner FKs, draft `submission_id`, Preview admin ownership remaps,
storage provider (`supabase` vs `cloudinary`), first-insert `invitations.title`, host share-message
overlays, unreferenced leftover assets, and any RSVP/PII/operational tables listed below.

---

## `events` boundary

| Class                   | Fields / relations                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Synchronized projection | `slug`, `event_type`, `title` (from invitation), `invitation_project_id` link; required for published **non-demo** client RSVP |
| Environment-local       | `id`, `owner_user_id`, status/timestamps, soft-delete, `event_memberships`, guests, claims, and all RSVP descendants           |

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
the dedicated Preview admin, rewrites Supabase Storage URLs, and does **not** copy Production
guests, claims, Auth, intake, or commercial data. `--dry-run` performs zero writes (including
role/profile and report files). `--apply` requires Preview authorization
(`CELEBRA_TASK_SCOPE=preview:content-mirror:sync-invitations` or interactive confirmation).

It replaces Preview `events` with `TRUNCATE … CASCADE` then reinserts Production event shells. That
**resets Preview RSVP children** (guests, claims, memberships) on those events. Stale Preview-only
invitation candidates are reported only; they are not auto-pruned. Automatic pruning remains
disabled.

Mirror apply is fail-closed: any partial table upsert, missing transferable Storage object, missing
Preview service-role key when transferable assets exist, unregistered Supabase Storage references in
content, or residual Production Storage URLs after rewrite yields `ok=false`, non-zero exit, and no
complete-sync claim. There is no automatic rollback of already-committed phases.

After a mirror apply, recreate required Preview synthetic RSVP/E2E fixtures with the existing gated
provisioning path (`pnpm test:e2e:preview:provision` and
`PLAYWRIGHT_ALLOW_PREVIEW_FIXTURE_PROVISIONING`). Provision synthetic data only.

---

## Storage Provider Boundary (Local vs Preview/Production)

Image storage and delivery follows an environment-deterministic abstraction (`StorageProvider`):

- **Local (`dev-local`):** Uses **Supabase Storage local** (`http://127.0.0.1:54321` / bucket
  `invitation-assets`). Dashboard uploads and `pnpm invitation:apply:local` persist locally with
  `provider: 'supabase'` and require zero third-party credentials.
- **Preview & Production:** Uses **Cloudinary** (`provider: 'cloudinary'`, `secure_url`). Client
  invitations published in Preview/Production must deliver referenced images from Cloudinary
  (publish and promote fail closed if local or Supabase Storage URLs are referenced).
- **Demos / Templates:** Resolve through Astro/Vite static image pipeline across all environments.

| Flow                                 | Local (`dev-local`)                                                                           | Preview / Production                                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Dashboard Intake / Upload            | Uploads to Supabase Storage local (`127.0.0.1:54321/storage/...`)                             | Uploads to Cloudinary with SHA-256 deduplication                                                                            |
| Provision (`invitation:apply:local`) | Uploads normalized binaries to local Supabase Storage (`managed/<slug>/<key>.webp`)           | N/A (local provision only)                                                                                                  |
| Release / Promote (`prod:apply`)     | N/A                                                                                           | Uploads/reconciles canonical binaries to Cloudinary; freezes immutable CDN URLs                                             |
| Production→Preview mirror            | Binary copy for rows with `storage_path`; rewrite public Storage URLs in `content`/`snapshot` | `secure_url` and Cloudinary hosts are **copied/preserved**, not rewritten; rows without `storage_path` skip binary transfer |

---

## Local / Preview synthetic RSVP

| Environment       | RSVP data                                                |
| ----------------- | -------------------------------------------------------- |
| Disposable / unit | `supabase/test/seed-test-data.sql` (synthetic)           |
| Local interactive | Environment-local synthetic guests on local event shells |
| Preview           | Synthetic fixtures / E2E provisioning only               |
| Production        | Real operational guest data only                         |

---

## Production → Local restore (PII exception)

`pnpm db:local:restore-from-dump` remains an intentional **debugging** workflow. It may import real
Production PII (guests, intake, commercial, optional Auth/Storage dumps) with no sanitization.

- It is **not** content synchronization or promotion.
- Restored Local data must **never** be used to seed Preview.
- Backup artifacts stay under gitignored `.backups/` / `.tmp/` with existing access and retention
  controls.
- “Non-destructive” means the restore avoids `db reset` and does not overwrite existing primary keys
  — it does **not** mean the import is free of PII risk.

No other downward full Production-data path is approved. Blocked refresh aliases remain fail-closed.

---

## Authorization boundary

Worktree path, lane, `CELEBRA_RUNTIME_TARGET`, UI environment banner, and credential presence are
**not** mutation authorization. Authorization requires explicit task scope, classified target, and
the repository’s guarded operation confirmations. See `docs/env-workflow.md` and
`.agent/rules/database.md`.

---

## Legacy / specialized paths

| Path                               | Status                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm ops adopt-legacy-events`     | **REMOVED** — no longer registered                                                       |
| `pnpm ops optimize-assets`         | **REMOVED** — no longer registered                                                       |
| `pnpm ops new-invitation`          | **REMOVED** — no longer registered                                                       |
| `pnpm ops dbs`                     | **REMOVED** alias — use canonical `pnpm dbs`                                             |
| `--preview-provenance`             | `KEEP_SPECIALIZED` Preview receipt diagnose/recovery only                                |
| `pnpm db:local:refresh-from-prod*` | Fail-closed — use backup + restore-from-dump                                             |
| Manual production SQL patches      | Lint via `pnpm db:prod:patch -- --dry-run`; mutate only via `pnpm prod:apply -- --patch` |
| `pnpm invitation:release`          | Local/Preview apply + Production dry-run; Production apply is `pnpm prod:apply`          |

---

## Related authorities

- Database ops procedures: [`docs/database-workflow.md`](../database-workflow.md)
- Env sources / lane connectivity: [`docs/env-workflow.md`](../env-workflow.md)
- Invitation production runbook:
  [`docs/domains/intake/production-flow.md`](../domains/intake/production-flow.md)
- Agent DB safety: [`.agent/rules/database.md`](../../.agent/rules/database.md)
