# Plan 016: Dead Weight Remediation

This plan removes verified dead runtime artifacts and aligns the active documentation and governance
surface with the live repository tree.

## Objectives

- Prune dormant components, helpers, and archived content that are outside the production flow.
- Remove orphaned assets only after verifying that no current runtime or test surface imports them.
- Reconcile active docs and governance configs so they stop referencing missing commands, files, and
  dashboards.

## Phases

- **Runtime Prune**: remove dead code and stale test-only helpers that no longer support runtime
  behavior.
- **Asset Prune**: delete unreferenced asset files and legacy folders after a final reference sweep.
- **Docs & Governance Reconcile**: update active docs, skills, workflows, and policy/config entries
  to match the current repo.

## Success Criteria

1. Active code and asset trees contain no verified orphan files from the audit set.
2. Active docs stop referencing `DOC_STATUS`, removed governance runners, `smoke-test`, and other missing
   commands or files.
3. The repository exposes a working `pnpm test` command and passes the validation commands used for
   this remediation.
