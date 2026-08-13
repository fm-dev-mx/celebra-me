# Database & invitation operational cheatsheets

**Owns:** concise operator cards (purpose, audience, prerequisites, commands, failures, recovery).

**Does not own:** full runbooks, architecture ERDs, agent policy, or CLI flag SSOT.

| Mechanism               | Card                                                                     | Audience                  | Evidence / notes              |
| ----------------------- | ------------------------------------------------------------------------ | ------------------------- | ----------------------------- |
| Schema migrate          | [schema-migrate.md](./schema-migrate.md)                                 | Human (+ agent preflight) | Migration history after apply |
| Owner Production apply  | [schema-migrate.md](./schema-migrate.md)                                 | Owner                     | `pnpm prod:apply` mixed plan  |
| Preview mirror          | [preview-mirror.md](./preview-mirror.md)                                 | Operator + Preview scope  | Resets Preview RSVP           |
| Backups / restore       | [backups.md](./backups.md)                                               | Owner / operator          | Critical RPO 15m              |
| Disposable DB           | [disposable.md](./disposable.md)                                         | Agent / CI                | Port 54332 only               |
| Status / diagnostics    | [status-diagnostics.md](./status-diagnostics.md)                         | Human + agent             | Distinct evidence classes     |
| Manual Production patch | [prod-patch.md](./prod-patch.md)                                         | Owner exception           | Not migrate/promote           |

## Status evidence taxonomy (do not conflate)

| Command                              | Evidence class                                       | Use when                       |
| ------------------------------------ | ---------------------------------------------------- | ------------------------------ |
| `pnpm dbs` / `dbs --compact`         | `migration_history_parity` + managed content summary + Production `authorizationIntegrity` | Fast operator matrix |
| `pnpm db:*:audit`                    | `object_audit_readiness` vs disposable reference     | Schema object drift            |
| `pnpm invitation:content-parity`     | Semantic invitation content                          | Content diff without RSVP/PII  |
| `pnpm invitation:cross-db-reconcile` | Cross-DB inventory                                   | Slug presence / inventory gaps |
| `pnpm invitation:inventory-audit`    | Tabular parity matrix / JSON                         | Bulk inventory reporting       |
| `pnpm invitation:diagnose-identity`  | Identity/alias probes                                | Managed identity conflicts     |
| `pnpm db:availability:verify`        | Reachability + read-only session                     | Before claiming DB state       |

Canonical detail: [`docs/database-workflow.md`](../../../database-workflow.md),
[`docs/core/content-parity-rsvp-isolation.md`](../../../core/content-parity-rsvp-isolation.md).

## Retention / deprecation (owner evidence required)

| Script                                                        | Disposition                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `db:local:reset-ready`                                        | Deprecated duplicate blocked rail; prefer `db:local:reset` message |
| `invitation:romina-draft-reset`                               | Temporary one-off; remove after owner confirms apply complete      |
| `db:stop`, `db:backup:create-manifest`, `db:disposable:start` | Keep; document; no removal without operator confirmation           |
