---
description: Unified atomic commit workflow using Plan-Id and Commit-Unit trailers.
---

# Gatekeeper Commit Routine (Lean 2.0)

This workflow automates the inspection, staging, and committing of code changes based on an approved
`commit-map.json`.

## Routine

1. Execute the unified commit command:

   ```bash
   pnpm gatekeeper:commit -- --plan <plan-id> [--unit <unit-id>]
   ```

   _The command handles inspection, staging, and committing in one step._

## Troubleshooting

If the command fails due to drift:

- Run `pnpm gatekeeper:workflow:cleanup`.
- Update the plan or fix the working tree.

## Maintenance Mode (Fast-Track)

For small fixes (chore, docs, fix) that don't need a formal plan:

1. Stage your changes as usual.
2. Run the maintenance commit command:

   ```bash
   pnpm gatekeeper:commit -- --maintenance --unit "type(scope): message"
   ```

_This performs an audit-only pass and automatically appends the `Maintenance: true` trailer._

## Output Contract

The commit must contain:

- Header: `type(scope): verb target`
- Summary: Semantic bullets.
- Section: `Files:` list.
- Trailers: `Plan-Id` and `Commit-Unit` OR `Maintenance: true`.
