---
title: Preview provenance and managed promotion remediation
status: superseded
created: 2026-08-13
updated: 2026-08-15
related_skills:
  - supabase
related_docs:
  - .agent/rules/database.md
  - docs/domains/intake/production-flow.md
  - docs/core/content-parity-rsvp-isolation.md
  - docs/database-workflow.md
autonomy: 1
type: implementation
---

# Goal 1 — Audit and specification

## Objective

Restore a simple, fail-closed managed release path for `abril-michelle-becerra-rea` without
re-uploading assets, changing invitation content unnecessarily, or permitting Production promotion
without exact, live Preview approval.

## Current evidence

- Worktree `dev-local` is clean at `56af5b388`.
- The immutable package exists at
  `.agent/tmp/packages/invitation-abril-michelle-becerra-rea-d00d8ed9271dfe85.json`.
- Read-only Preview provenance dry-run returned:
  - `status: EVIDENCE_UNAVAILABLE`
  - `invitationId: null`
  - `writes: 0`
  - `evidence: legacy_provenance`
  - `uncertainty: La procedencia previa no permite reconstruir una comparación determinista del destino.`
- Read-only Production plan returned:
  - `Mutaciones 0`
  - `MISSING_PREVIEW_APPROVAL`
  - no owner apply required.
- The earlier Preview release run reported `0` database writes and `0` Storage mutations for Local
  and Preview. Project, route, publication, projection, and Storage checks passed; only provenance
  failed.
- The first Production structural patch was already applied. It must not be replayed merely because
  its post-apply verifier previously failed.

## Evidence interpretation

The current helper catches any `ManagedBaselineError` while probing the strict content-only baseline
and collapses it into `EVIDENCE_UNAVAILABLE`. The public output does not expose the subtype, so the
exact cause is not yet proven to be `missing_receipt`, `stale_provenance`,
`partial_previous_operation`, `publication_after_baseline`, or another non-reconstructable
classification. The implementation must surface that classification before any baseline write is
allowed.

The regular release used the invitation delivery scope `content-and-assets`, which can report zero
content/asset drift without proving that the managed provenance contract is valid. “SIN CAMBIOS” is
therefore not equivalent to “safe to approve Preview”.

## Non-negotiable invariants

1. Production remains read-only until the exact package has a current, live-verified Preview
   approval.
2. No manual SQL, mirror, seed, reset, or Production re-apply may be used to repair provenance.
3. A provenance diagnosis is read-only and must not download or upload invitation assets.
4. Baseline adoption is valid only when Preview draft, publication, package projection, and asset
   identity are deterministic and the failure is limited to missing/legacy provenance evidence.
5. Stale, partial, manual-drift, publication-after-baseline, identity-conflict, or incompatible
   normalization evidence remains blocked and requires explicit Owner/HITL reconciliation.
6. A valid baseline repair writes only the provenance row and one durable operation receipt in
   Preview, in one transaction, followed by a live read-back verification.
7. Cloudinary assets remain Cloudinary assets. They must never be rematerialized as Supabase Storage
   URLs or re-uploaded as part of provenance repair.
8. Dashboard controls remain read-only; they may copy canonical commands but never execute
   mutations.
9. A post-apply verification failure is not permission to replay a successful Production mutation.

## Required implementation scope

### 1. Provenance classifier and diagnostic contract

Files:

- `scripts/provision/managed-merge-baseline.ts`
- `scripts/provision/preview-provenance-baseline-service.ts`
- `scripts/provision/invitation-release-cli.ts`
- focused provenance tests under `tests/provision/`

Add a typed diagnostic result that preserves the existing baseline classifications and reports:

- classification;
- package, slug, route, and plan identity (no secrets or content payloads);
- whether draft/publication/asset parity was proven;
- whether adoption is eligible;
- exact next action and stop reason;
- expected database and Storage writes.

Human output must distinguish `IN_SYNC`, `PLANNED`, `BLOCKED`, and `EVIDENCE_UNAVAILABLE`. JSON
output must not hide the classification behind the generic `legacy_provenance` label.

### 2. Safe baseline/adoption flow

Separate the baseline authorization from the Production approval artifact. The current
`verifyApprovalForApply` gate is circular for a pre-approval baseline and must not be reused for
this operation.

The specialized Preview command may apply only after its own exact Preview owner confirmation and
only for an eligible `PLANNED` result. It must bind the write to the package/slug/plan and record a
`managed_baseline_adoption` receipt. It must refuse to apply when the evidence is not deterministic.

### 3. Preview approval flow

The wizard must stop after a provenance failure and show a remediation state instead of offering a
Production action that is guaranteed to fail. Direct `--package-hash ... --approve` remains
available only after the pending artifact passes all live checks.

Asset hash verification may be reused only within the same package/plan/project identity and bounded
verification lifetime. A repeated dry-run must not re-download assets merely to redisplay the same
failure.

### 4. Production verifier permit propagation

Files:

- `scripts/db/migrate-executors.ts`
- `scripts/db/migrate-policy-production.ts`
- `scripts/db/run-prod-patch.ts`
- related production executor tests

Pass the exact in-process Production permit binding into the read-only post-apply contract verifier.
After a successful mutation, the result must be `APPLIED_AND_VERIFIED`; if verification fails after
a write, the CLI must clearly mark the operation as applied-but-unverified and instruct the operator
to run a read-only recheck, never replay the mutation.

### 5. Status dashboard UX

Files:

- `scripts/provision/canonical-diagnostics.ts`
- `src/lib/status/types.ts`
- `src/lib/status/semantics.ts`
- `src/lib/status/publication-semantics.ts`
- `src/components/dashboard/status/CanonicalStatusPanel.tsx`
- dashboard/status tests

Expose separate states for content parity, asset verification, provenance, Preview approval, and
Production readiness. A provenance blocker must produce a Manual/HITL action with no misleading
Apply command. The card must state the write impact (`0 content`, `0 Storage`, or metadata-only) and
the condition that will make it verified.

## Acceptance criteria

- Abril's read-only diagnostic names the exact provenance classification or explicitly states that
  the classification is unavailable, without implying a safe repair.
- No command offered by the wizard can apply a baseline when evidence is stale, partial,
  conflicting, or otherwise non-deterministic.
- An eligible baseline repair does not require a pre-existing Preview approval artifact.
- A baseline repair performs no content or Storage mutation and records exactly one provenance row
  plus one durable receipt.
- Preview approval is possible only after all live checklist items pass for the exact package.
- Production remains blocked until that approval exists and matches all release hashes.
- The first Production patch is not replayed; its state is verified read-only.
- The post-apply schema verifier accepts the authorized permit in both migration and patch paths.
- Cloudinary package serialization and URL handling remain intact without terminal-only environment
  setup.
- Dashboard tests prove that provenance blockers show manual review and do not expose a false Apply
  action.

## Validation strategy

Read-only first:

```text
pnpm invitation:release -- --preview-provenance --slug abril-michelle-becerra-rea --targets preview --package <package> --dry-run --json
pnpm prod:apply -- --slug abril-michelle-becerra-rea
```

After implementation, use focused tests for managed baseline, Preview live verification, approval,
Production executor permits, canonical diagnostics, and `CanonicalStatusPanel`, followed by:

```text
pnpm type-check
pnpm validate:changed
```

Disposable database contract tests are required if the implementation changes schema-facing SQL or
receipt contracts. No hosted apply is part of Goal 1.

## Stop conditions

Stop before any write if the live evidence reports identity conflict, missing/ambiguous draft or
publication, asset identity uncertainty, a non-recoverable baseline classification, package/hash
mismatch, unexpected planned content/Storage operations, or a verifier-permit mismatch.

## Next handoff

Goal 2 may implement only the scope above. It must begin by adding the typed provenance
classification and tests, then decouple baseline authorization from Preview approval, and finally
repair Production verifier permit propagation. Operational Preview or Production writes require a
separate explicit owner confirmation after the implementation gates pass.
