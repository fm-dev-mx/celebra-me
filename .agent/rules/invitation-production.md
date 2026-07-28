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
and `.agent/workflows/invitation-preparation.md`. Do not begin invitation-specific implementation
while preparation readiness is `NOT_READY`.

Obsolete one-shot: `pnpm ops optimize-assets` / `scripts/optimize-assets.mjs` is a hardcoded legacy
demo helper — **not** the managed invitation asset pipeline. Use preparation asset protocol +
`normalizeInvitationImage` / provision release normalization instead.

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

## Scope and cleanup

Prefer the smallest current contract change. Do not redesign the renderer, create a universal
engine, or broadly refactor invitation code. Report uncertain deletion candidates and retain them
until runtime and production evidence supports removal.

## Handoff

Report changed files, validation and visual-QA evidence, cache behavior, migration status, remaining
risks, deletion candidates, `git status --short`, and whether anything was staged or committed.
