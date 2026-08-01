# Invitation Production Rules

**Owns:** agent safety constraints for invitation production (authorization, secrets, dry-run,
rollback claims, scope limits).

**Does not own:** identity field lists, runbook steps, or CLI flag semantics. Authority chain:
creation contract → production runbook → managed-invitation-lifecycle workflow → this rule → live
CLI help. See [`.agent/index.md`](../index.md).

The canonical operational source is
[`docs/domains/intake/production-flow.md`](../../docs/domains/intake/production-flow.md). Read it
before creating, editing, publishing, or validating an invitation. Content structure is defined by
[`docs/core/content-schema.md`](../../docs/core/content-schema.md). Identity requirements live in
[`docs/core/invitation-creation-contract.md`](../../docs/core/invitation-creation-contract.md).
Preparation semantics (classifications, placeholders, preparation readiness) live in
[`docs/core/invitation-preparation-contract.md`](../../docs/core/invitation-preparation-contract.md)
and `.agent/workflows/invitation-preparation.md`. Content promote/mirror vs RSVP isolation lives in
[`docs/core/content-parity-rsvp-isolation.md`](../../docs/core/content-parity-rsvp-isolation.md). Do
not begin invitation-specific implementation while preparation readiness is `NOT_READY`.

Obsolete one-shot tooling (`ops optimize-assets`, `ops new-invitation`, `ops adopt-legacy-events`,
`reorganize-cloudinary-assets.ts`) has been removed. Use preparation asset protocol +
`normalizeInvitationImage` / provision release normalization for managed assets.

## Required preflight

- Inspect the current resolver, descriptor, preset catalog, asset registry, and target event type
  before selecting a pattern. Do not copy an older invitation merely because it looks similar.
- Use `demo-xv-jewelry-box` for asset organization, `demo-baby-shower-celestial` for
  optional-section coverage, and `demo-boda-jewelry-box-wedding` for non-XV structure. Reuse
  contracts and shared components, not design-specific copy or client styling.
- Preserve Astro server/client boundaries. Code, identifiers, comments, migrations, and technical
  documentation are English; visible UI copy is Spanish.
- Enforce event-type/preset compatibility before persistence. Keep route slug, `_assetSlug`, and
  `previewSlug` distinct when their roles differ. Treat path casing as Linux-sensitive.
- Real/client invitations are DB-published. Static demos remain independent showcase content;
  development templates are not production routes.

## Required gates

- Respect the upload and delivery policy in the runbook, including normalization metadata,
  role-aware limits, mobile crop review, and unchanged-legacy grandfathering.
- Verify required, optional, grouped-location, and long-copy cases. Verify reduced motion,
  no-JavaScript, and observer-failure behavior; public content must remain readable without motion
  initialization.
- Keep anonymous responses public-cacheable only when no guest context is present. Personalized,
  preview, invalid-content, and error responses must remain private/non-cacheable.
- Publication must use the atomic RPC with stale-write protection. Never replace it with sequential
  public-state writes.
- Validate required migrations locally and report both local and production status. Database
  migrations precede dependent application deployment. Never infer production alignment.
- Run the narrow relevant checks plus production-oriented build/E2E checks proportional to risk. Do
  not stage, commit, deploy, or mutate production unless explicitly requested.

## Managed updates

Use `.agent/workflows/managed-invitation-lifecycle.md` as the thin agent procedure and the
production runbook for lifecycle semantics, target order, flags, packaging, approval, and recovery
behavior. Inspect the live CLI help before composing a command.

The agent-specific constraints are:

- Start with inspection and dry-run output.
- Never classify an uninspected target as unchanged.
- Never expose secrets, raw credentials, private client data, or environment-specific URLs.
- Never prune assets, overwrite pre-existing resources, or claim successful rollback without
  explicit evidence and authorization.
- Never mutate Preview or Production without authorization for that exact target and operation.
  Worktree path, runtime target, environment banner, and credential presence are not authorization.

### Local observability dashboard

`/dashboard/observabilidad` is observational only (Local runtime + admin strong session). It does
not authorize writes. CLI workflows remain authoritative for mutations. Stale regression or
screenshot evidence requires running the owning command (`pnpm test:local-render-corpus` /
`pnpm screenshot:local-render-corpus`), not dashboard refresh. See
[`docs/core/observability-dashboard.md`](../../docs/core/observability-dashboard.md).
- Do not treat Production→Preview content mirror as promotion. Do not copy Production RSVP/PII into
  Preview. After a Preview mirror apply, re-provision synthetic fixtures if RSVP E2E needs them.

## Scope and cleanup

Prefer the smallest current contract change. Do not redesign the renderer, create a universal
engine, or broadly refactor invitation code. Report uncertain deletion candidates and retain them
until runtime and production evidence supports removal.

## Handoff

Report changed files, validation and visual-QA evidence, cache behavior, migration status, remaining
risks, deletion candidates, `git status --short`, and whether anything was staged or committed.

## Agent application identity

Local and Preview agent browser/Editor access uses real `super_admin` product identities only:

- **Local:** `pnpm db:local:bootstrap-admin` (first `SUPER_ADMIN_EMAILS` entry).
- **Preview:** `preview@preview.com` (see `docs/database-workflow.md` agent identity table and
  `docs/env-workflow.md` Playwright Preview auth).

Do not authenticate agents with `service_role`, invent agent-only app permissions, or grant
Production application access. Production managed promotion remains owner-only via
`pnpm invitation:promote`.

## Actor capability matrix (SSOT)

This matrix is the SSOT for Agent vs Owner operational capabilities. Preview task scope is an
operational assertion, not cryptographic security; strong control depends on credential and
execution-boundary separation.

| Capability | Agent | Owner |
| --- | --- | --- |
| Canonical invitation source | Edit with task authorization | Approve and own |
| Disposable test DB | Run guarded tests | Run |
| Persistent Local managed mutation | Yes via managed lifecycle (`invitation:update --targets local`) | Yes |
| Persistent Local raw/ad-hoc DB mutation | Never (unsupported agent workflow) | Exceptional only |
| Preview managed mutation | Yes with explicit Preview task scope (`CELEBRA_TASK_SCOPE`) | Yes |
| Preview raw DB mutation | Never | Guarded schema workflow only |
| Production read — safe surfaces | `pnpm dbs`; `invitation:update --status`; `invitation:content-parity`; `invitation:promote --dry-run` (read-only preflight) | Same safe surfaces |
| Production read — privileged DB audit | Never (`db:prod:audit`, backups, Auth/Storage export) | Owner-only guarded `db:prod:*` audit/backup/export |
| Production invitation mutation | Never via `invitation:update` or `invitation:reconcile` | Owner-only `pnpm invitation:promote --apply` |
| Production schema / migration | Never | Owner-only `db:prod:migrate` (separate from content promotion) |
| Production specialized SQL patch | Never (`db:prod:patch --apply`) | Owner-only specialized maintenance (`RESTRICT_OWNER_ONLY`) |
| Reconciliation | Plan and apply Local/Preview managed decisions | Authorize Preview scope and source updates |
| Schema operations | Never auto-run from invitation workflows | Use separate guarded `db:*:migrate` workflows |

### Production read surfaces

- **Safe Agent (and Owner) read:** `pnpm dbs` / `pnpm dbs --compact`, `invitation:update --status`
  (including `--targets all|production`), `invitation:content-parity`, and
  `invitation:promote --dry-run` / preflight. These are redacted / summary-oriented and do not
  authorize privileged DDL inspection or PII dumps.
- **Owner-only privileged DB audit:** `pnpm db:prod:audit`, `db:prod:backup*`,
  `db:prod:export-auth`, `db:prod:export-storage`, and any direct Production `psql`/service-role
  inspection. Agents must not run these unless the owner explicitly authorizes that exact
  privileged read.
- **Owner-only Production content promotion:** `pnpm invitation:promote --apply` requires exact
  Preview approval, schema `CURRENT`, verified critical backup evidence
  (`pnpm db:prod:backup:critical`), and interactive owner confirmation
  (`PROMOTE <slug> <packageHash>` or matching `CONFIRM_PROD_MIGRATION`). Agents must not execute
  `--apply`.

## Schema lifecycle contract

Canonical schema authority is `supabase/migrations/*`. Lifecycle order:

```text
versioned migration → Disposable → Persistent Local → Preview → human-controlled Production migration
```

Schema drift states: `CURRENT` | `BEHIND` | `SCHEMA_DRIFT` | `UNVERIFIED`
(`scripts/db/schema-lifecycle-state.ts`, surfaced by `db:*:audit` and `pnpm dbs`). Do not reuse
invitation reconciliation decisions (`KEEP_ENVIRONMENT`, etc.) for schema. Invitation workflows
must never auto-run migrations; `invitation:promote` preflight that detects incompatible schema
returns `SCHEMA_INCOMPATIBLE` / `OWNER_ACTION_REQUIRED` and stops.

Disposable operations are available to **both Agent and Owner** under the guarded disposable-test
workflows.
