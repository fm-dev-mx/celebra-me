---
title: Duplicate Invitation Safeguards
status: active
created: 2026-08-05
updated: 2026-08-05
related_skills:
  - backend-engineering
  - database-parity
related_docs:
  - docs/core/invitation-creation-contract.md
  - docs/domains/database/overview.md
  - .agent/rules/database.md
---

# Duplicate Invitation Safeguards

Prevent slug-rename duplicates (Daniela–Martín class) and safely remove the obsolete Preview UUID
after reviewed authorization.

## Scope

1. Immutable `managedIdentityId` + `previousSlugs`; unique DB identity; backfill even with zero content drift.
2. Guarded Local + Preview slug rekey; Production remains blocked.
3. DB archive cascade includes `intake_submissions` verification + reactivation block.
4. Alias-aware diagnostics fail closed on probe errors; dashboard excludes archived-parent children fail-safe.
5. Preview UUID purge: exact UUID/slug pins, archived-only inconsistent source, Storage ownership/hashes,
   append-only JSONB receipt, resumable Storage residuals.
6. Preview cleanup of obsolete `4b616edc-142f-4427-85df-dc75e94aa381` only after explicit auth.

## Non-goals

- Production schema migrate or Production purge
- Title/client-name uniqueness or fuzzy identity inference
- Git staging/commit without explicit authorization

## Validation

- Disposable migration + pgTAP + hermetic tests
- Local migrate apply + diagnostics
- Preview migrate only after credentials + authorization
- Purge dry-run → reviewed apply → postconditions
