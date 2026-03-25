# Plan 017: System Doc Alignment

This plan audits active documentation and governance metadata against the live repository tree and
removes stale references from the active discovery surface.

## Objectives

- Align `.agent/`, `docs/`, `README.md`, `scripts/README.md`, `tests/README.md`, and governance
  config with the current repository tree.
- Correct stale commands, routes, path references, and ownership statements without changing runtime
  behavior.
- Move historical roadmap material out of active docs and into `docs/archive/`.

## Phases

- **Governance & Discovery**: reconcile `.agent/` entrypoints, plan guidance, and governance config.
- **Repo & Domain Docs**: update repo entry docs plus testing, content, theme, and RSVP
  documentation.
- **Archive & Closeout**: move historical docs to `docs/archive/`, record the audit, and archive the
  plan.

## Success Criteria

1. Active docs describe only commands, paths, and routes that exist in the live tree.
2. Governance config no longer references missing plan buckets or dead path globs.
3. Historical material is clearly archived and removed from the active documentation taxonomy.
