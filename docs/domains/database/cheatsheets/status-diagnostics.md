# Cheat sheet — Status & diagnostics

**Purpose:** Read-only evidence of managed invitations and schema readiness.  
**User:** Human operators and agents.  
**Prerequisites:** Credentials for claimed targets; run availability verify before integrity claims.

## Commands

```bash
pnpm db:availability:verify -- --targets local,preview,production
pnpm dbs
pnpm dbs --verbose
pnpm dbs --diagnostics
pnpm dbs --in-sync
pnpm dbs --json
pnpm dbs --compact
pnpm dbs <slug>
pnpm invitation:content-parity -- --slug <slug> --event-type <type>
pnpm invitation:cross-db-reconcile
pnpm invitation:inventory-audit
pnpm invitation:diagnose-identity -- --slug <slug>
pnpm db:local:audit | db:preview:audit | db:prod:audit
```

`pnpm dbs` is the canonical operator matrix: **schema migrations**, **registry publication**,
**operation readiness**, and **Production authorization evidence** as separate columns. It also
shows the active manual-patch catalog. Patch rows are read-only detectors: `PENDING` means the
detector found rows inside the approved range, `NOT_NEEDED` means it found zero rows (not
"applied"), and `NOT_APPLICABLE` means the environment is outside the patch target. The detailed
section includes the owner planning command for `PENDING`; applying still requires the owner TTY
workflow and `--apply`. Historical SQL files outside the catalog are intentionally excluded.
Disposable-test proof is listed apart from persistent schema. `--compact` is connectivity + schema
only — not publication state. `CURRENT`/`BEHIND` on that matrix are **migration-history** states.
Named public object drift is `pnpm db:*:audit` (`object_audit_readiness`).

Local dashboard: `/dashboard/estado` (explicit remote refresh; same classifiers as `pnpm dbs`).
Advanced diagnostics are enrichment only (`?diagnostics=1` / `pnpm dbs --diagnostics`), except
missing Production owner-apply evidence, which is a first-class integrity finding (`MISSING`) and
must not be presented as unqualified `CURRENT`.

## Acción primero

El dashboard muestra una sola cola priorizada: bloqueos confirmados, acciones aplicables,
verificaciones pendientes y revisión manual. Cada paso expone comando, prerrequisito y si requiere
Owner/HITL; los comandos solo se copian, nunca se ejecutan desde la UI. El bloque de alcance de
revalidación (Entorno, Dominio y Diagnóstico avanzado) delimita la siguiente sonda, no filtra la
información ya visible. Migraciones y parches son dominios distintos: `pnpm prod:apply -- --schema`
opera el flujo de esquema, mientras `pnpm prod:apply -- --patch <file>` es el flujo de parche
manual.

`Todo en orden` exige evidencia LIVE en los controles aplicables, disposable-test válido, ninguna
promoción/migración/parche pendiente y autorización aplicable íntegra. `NOT_APPLICABLE` no bloquea;
`NOT_NEEDED` significa «0 filas en el detector» y no prueba que un parche fue aplicado. La evidencia
cached, stale o unverified mantiene el estado fuera de verde. Las secciones de historial y
diagnósticos quedan colapsadas para que la primera acción sea visible.

**Expected result:** Typed availability and lifecycle/parity evidence. `UNVERIFIED` ≠ healthy.

**Failures:** `CREDENTIALS_REQUIRED`, `IDENTITY_CONFLICT`, `UNREACHABLE`, incomplete evidence under
`--strict`.

**Recovery:** Fix credentials/identity; never invent zero-row health. Schema behind → migrate
workflow. Content drift → update/reconcile — not audit alone.

See taxonomy in [README](./README.md).
