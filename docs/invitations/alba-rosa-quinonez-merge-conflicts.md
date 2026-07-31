# Reconciliación Alba Rosa — conflictos de merge managed vs editor

Guía operativa (solo lectura hasta autorización explícita) para `alba-rosa-quinonez` cuando
`pnpm invitation:update` reporta `Conflicto de derivación` / conflictos de merge.

## Contexto

Tras un apply managed, el editor puede publicar cambios en Production. El ancestro
`managed_projection` puede quedar desfasado; el merge 3-way marca `DRIFT` en paths donde el paquete
y el destino (editor) divergieron del ancestro.

Con el tooling actual:

1. El dry-run lista cada conflicto: path, ancestro, paquete, destino.
2. Se elige por path `package` (valor managed) o `target` (conservar editor).
3. Apply usa `--conflict-resolutions <archivo.json>`.

## Procedimiento seguro

```bash
# 1. Dry-run (no muta)
pnpm invitation:update -- --slug alba-rosa-quinonez --targets local,preview --dry-run --non-interactive --json

# 2. Guardar resoluciones sugeridas del JSON (suggestedConflictResolutions)
#    o construir manualmente, por ejemplo:
```

```json
{
  "resolutions": {
    "envelope.tooltipText": "package"
  }
}
```

Valores:

- `"package"` — aplicar el valor del paquete managed.
- `"target"` — conservar el valor actual en draft/destino (editor).

```bash
# 3. Volver a planificar con resoluciones (sigue dry-run)
pnpm invitation:update -- --slug alba-rosa-quinonez --targets local,preview --dry-run --non-interactive --conflict-resolutions .tmp/alba-resolutions.json --json

# 4. Apply solo con autorización explícita del owner y confirmaciones Production
pnpm invitation:update -- --slug alba-rosa-quinonez --targets local,preview --apply --non-interactive --conflict-resolutions .tmp/alba-resolutions.json --confirm-destructive
```

## Verificación post-apply

- Provenance `managed_projection` alineado con el contenido aplicado.
- Draft y published coherentes con las elecciones.
- Un publish desde el editor limpia el ancestro managed (`managed_projection = null`) para el
  siguiente ciclo de merge.

## No hacer

- No omitir `--conflict-resolutions` en non-interactive si hay DRIFT.
- No bypassear preflight / confirmaciones de Production.
- No mutar Production sin autorización de la tarea actual.
