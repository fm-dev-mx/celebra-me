# Invitation Production Rules

The canonical operational source is
[`docs/domains/intake/production-flow.md`](../../docs/domains/intake/production-flow.md). Read it
before creating, editing, publishing, or validating an invitation. Content structure is defined by
[`docs/core/content-schema.md`](../../docs/core/content-schema.md).

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

## Local application, packaging, and promotion workflow

- Versioned invitation definitions are single TypeScript files under
  `scripts/provision/invitations/<slug>.ts`.
- Managed invitation changes use
  `pnpm invitation:update -- --slug <slug> --targets <targets> --source-dir <path> --dry-run|--apply`.
- The canonical pipeline is
  `Define -> Plan -> Update Local -> Package -> Promote Preview -> Approve -> Resume Production`.
- Preview is a validation environment. Production MUST NOT import directly from the Preview
  database or Storage.
- Production resume from an approved package requires a matching Preview approval artifact and
  explicit owner:
  ```bash
  pnpm invitation:update -- --resume --package <path> --slug <slug> --targets production --owner-user-id <uuid> --apply
  ```
- Packages are immutable, deterministic versioned JSON files containing un-hashed metadata, content,
  and embedded base64 assets with SHA-256 signatures.
- Packages MUST NOT leak local or environment-specific Supabase URLs (sanitized to
  `__STORAGE_URL__`).
- Preview promotion requires target project `iwipdvisoyerfdytuhwi` and generates a non-secret
  Preview approval artifact (`.agent/tmp/approvals/preview-approval-<hash>.json`).
- Production promotion requires a matching Preview approval artifact for the exact package hash, an
  existing target owner UUID (`--owner-user-id`), zero source-URL verification, and explicit
  confirmation.

## Scope and cleanup

Prefer the smallest current contract change. Do not redesign the renderer, create a universal
engine, or broadly refactor invitation code. Report uncertain deletion candidates and retain them
until runtime and production evidence supports removal.

## Handoff

Report changed files, validation and visual-QA evidence, cache behavior, migration status, remaining
risks, deletion candidates, `git status --short`, and whether anything was staged or committed.
