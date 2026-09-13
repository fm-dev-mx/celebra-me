# Invitation image namespace migration

This procedure changes image identifiers and delivery URLs while preserving source bytes and
rendered content. Production execution belongs to the owner. It does not authorize schema changes,
provider deletion, Git publication, or visual-reference acceptance.

## Source and planning

Use the currently published Production image as the default canonical source. Compare SHA-256,
dimensions, format, and appearance before resolving a package conflict. A different approved image
requires an owner decision. For an existing published original, the package may use the existing
`sourcePolicy: 'preserve'` original-image contract; do not attach a derivative optimization role or
change shared limits merely to accept it. This is distinct from a blanket reconciliation policy.

The executable contracts are:

- [Release CLI](../../scripts/provision/invitation-release-cli.ts): Local package reconciliation,
  explicit dry-run/apply, and sanitized Preview namespace diagnostics.
- [Migration CLI](../../scripts/invitation/image-namespace-migration-cli.ts): immutable plans,
  source verification, destination byte checks, Preview apply, and rollback.
- [Remap](../../scripts/invitation/image-namespace-remap.ts): reference coverage and transactional
  concurrency checks. An approved destination can contain the old identifier as a suffix; only the
  exact destination URL and its generated OG URL are exempt from residual-reference rejection.
- [Production entrypoint](../../scripts/db/production-image-namespace-apply.ts): manifest identity,
  snapshot checks, remap validation, backup, owner confirmation, and scoped write permit.

Generate each remote plan with the existing CLI `plan` mode and a new output path. Review its
target, invitation identity, source/destination IDs, hashes, swaps, retirements, and snapshot before
apply. Never overwrite a reviewed manifest. Validate the remap before provider copies. A changed
snapshot requires a new reviewed plan; an old manifest is not authority to overwrite a divergent
draft.

## Execution order

1. Reconcile Local through `pnpm invitation:release`, starting with `--dry-run`. Preserve the
   approved originals and divergent editorial content. Do not introduce a Local migration path.
2. Apply an exact reviewed Preview manifest with the migration CLI `apply-preview` mode and the
   required task scope. Verify public image delivery and composition, then repeat release dry-runs.
3. Stop affected work on provider errors, missing images, or hash/snapshot mismatches. Preserve any
   verified copies for an idempotent retry; do not prune them or keep retrying a rejected batch.
4. Before owner Production execution, complete release/compatibility checks and required visual
   acceptance independently. A successful migration dry-run alone does not certify release
   readiness.
5. Give the owner concrete manifest paths for `pnpm prod:apply -- --image-namespace`, first without
   `--apply`, then with it only after review and all required gates. Never supply placeholder
   commands as ready to execute. Save applied receipts and verify hashes, delivery, and
   reconciliation again.

The same immutable manifest supports the existing rollback modes. Preview uses `rollback-preview`;
Production uses `pnpm prod:apply -- --image-namespace-rollback` with the manifest path, first as a
plan and then owner apply. Rollback requires the exact expected post-migration state; concurrent
edits block it. Keep original objects and manifests while rollback or historical versions depend on
them.

## Retirement and closure

An asset-row retirement is not provider-object deletion. Before physical deletion, check all
environments, canonical packages, current drafts, published and historical versions, archived
records, shared references, backups, and recovery requirements. Unknown consumers block deletion.
Use an existing guarded exact-object operation or deliver an explicit reviewed owner deletion list.
Do not add a generic cleanup framework.

Keep the import engine's explicit legacy read compatibility while existing Production or historical
content needs it. Historical source files may remain as documented provenance without being active
release inputs. Audio and unrelated compatibility mechanisms are outside this image procedure.

Closure requires zero active obsolete image dependencies, unchanged Production bytes and
presentation, explained reconciliation results, final-SHA CI and Preview smoke, and required human
acceptance. Asset-row counts alone do not establish absence of legacy URLs in content. Report
unverified provider inventory, retained historical references, and pending owner actions explicitly.
