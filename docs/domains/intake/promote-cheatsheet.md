# Cheat sheet — Promoción a Production

**Owns:** atajo operativo del propietario para promover contenido administrado.

**Does not own:** runbook completo, schema migrate, ni espejo Preview. Detalle:
[`production-flow.md`](./production-flow.md) ·
[`.agent/rules/invitation-production.md`](../../../.agent/rules/invitation-production.md).

## Camino feliz (TTY)

```bash
pnpm invitation:promote
```

1. Elija una release **lista** (o **Cancelar** — valor por defecto; Enter no escribe).
2. Revise el plan compacto (slug, aprobación Preview, schema, cambios, respaldo).
3. El orquestador prepara release-check + respaldo crítico (reutiliza cobertura fresca si aplica).
4. Confirme con el código exacto: `PROMOTE <8-hex>`.
5. Espere verificación post-apply. Sin verificación OK no hay cierre exitoso.

Una sola candidata lista **nunca** se aplica sola: siempre hay selección explícita.

## Antes de promover

| Requisito                         | Señal / comando                                          |
| --------------------------------- | -------------------------------------------------------- |
| Release en Preview aprobada       | Aprobación exacta en el store compartido (Preview DB)    |
| Schema Production compatible      | `CURRENT` (`pnpm dbs`); si no → `pnpm db:prod:migrate`   |
| Worktree listo para release-check | `HEAD` limpio; evidencia válida o se genera en el flujo  |
| Sin scope de agente Preview       | Quite `CELEBRA_TASK_SCOPE`                               |
| Credenciales Production           | `PROD_DB_URL` / secretos canónicos del propietario       |
| Credenciales Preview (lectura)    | `PREVIEW_DB_URL` para verificar la aprobación compartida |

Promote **no** migra schema, **no** toca RSVP/PII y **no** importa la DB de Preview.

Las aprobaciones viven en `public.preview_approval_artifacts` (Preview DB), no en
`.agent/tmp/approvals` del worktree. Finalize:

```bash
pnpm invitation:update -- --package-hash <hash> --evidence <path> --apply
```

Importación puntual de JSON legacy (solo `approved` vigentes):

```bash
pnpm invitation:approvals:migrate -- [--dir .agent/tmp/approvals]            # dry-run default
pnpm invitation:approvals:migrate -- --apply [--dir .agent/tmp/approvals]  # Preview auth required
```

## Qué verá en el menú

| Estado       | Seleccionable | Significado                                     |
| ------------ | ------------- | ----------------------------------------------- |
| Lista        | Sí            | Aprobada en Preview; ausente o atrasada en Prod |
| Sincronizada | No            | Production ya coincide; se resume, no se elige  |
| Atención     | No            | Bloqueada; el CLI imprime qué comando ejecutar  |

`lifecycle` / `deliveryScope` son contexto; **no** autorizan la promoción.

## Si queda bloqueado

| Bloqueo                         | Qué hacer                                                                 |
| ------------------------------- | ------------------------------------------------------------------------- |
| Sin aprobación Preview          | Preview apply → `invitation:update --package-hash … --evidence … --apply` |
| Schema incompatible             | Owner: `pnpm db:prod:migrate` (flujo aparte)                              |
| Divergencia / conflicto managed | Resolver en origen o reconciliar; no hay auto-merge en promote            |
| `PLAN_DRIFT`                    | Reiniciar `pnpm invitation:promote`; no confirmar plan viejo              |
| Respaldo / release-check        | Seguir remediación del CLI; no saltar el gate                             |
| Sin TTY / automatización        | Preflight: `--slug … --dry-run`. Apply: solo TTY del propietario          |

## Flags (avanzado / no TTY)

```bash
pnpm invitation:promote -- --slug <slug> [--package <path>] --dry-run
pnpm invitation:promote -- --slug <slug> [--package <path>] --apply
pnpm invitation:promote -- --help
```

`--backup-manifest` es opcional; el orquestador prepara cobertura crítica si falta. `db:sync`
`package-to-production` usa el **mismo** orquestador y el mismo gate.

## Límites fijos

- Solo el **propietario** confirma apply. Los agentes pueden preflight; **nunca** `--apply`.
- Confirmación tipada obligatoria: `PROMOTE <8-hex>` (no basta elegir en el menú).
- Un promote = una release Preview-aprobada exacta → Production.
- Ante duda: **Cancelar** y releer el plan.
