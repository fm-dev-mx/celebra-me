# Owner post-merge checklist (hosted applies)

Implementation work must not mutate Local/Preview/Production. After merging workflow consolidation
changes, the repository owner runs these **explicit** steps:

1. **Preview schema:** run `pnpm db:preview:audit`, then apply any live pending set with
   `pnpm db:migrate -- --target preview` (preflight → scoped `--apply --expected …`).
2. **Legacy approvals:** filesystem approval import is retired; create and approve current evidence
   through `pnpm invitation:release`.
3. **Production compatibility:** live `pnpm db:prod:audit` before any Production migrate; do not
   trust frozen counts in docs/reports. Owner apply is `pnpm prod:apply -- --schema --apply`.
4. **One-offs:** confirm whether `invitation:romina-draft-reset` is finished; remove alias only
   after owner confirmation and zero remaining references.
5. **Daily backup health:** inspect latest `.backups/prod/reports/` for RPO/EFS failures.

Agents may prepare dry-run evidence; they must not run hosted `--apply` without current-task owner
authorization.
