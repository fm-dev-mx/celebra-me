---
template: agent-report-samples
purpose: One sample human-facing report per artifact under agent-report-contract
version: 1.5.0
---

# Agent Report Samples

Illustrative only. Field values are fictional. Use the shared report contract for whether a decision
is needed and how many meaningful options to present. Examples grant no authorization.

---

## staged-code-review

### CTA case (all auto-safe)

```md
# Staged review

**Veredicto:** 1 HIGH (0 risk · 1 cleanup) · 1 MEDIUM · 1 LOW · ~15 líneas **Alcance:** 2 files,
+8/−3 — unused export and unused prop; MM: 0

## HIGH

### Unused export `buildGuestMap`

`src/lib/guests.ts:42 · ~12 lines · TS · apply: auto-safe`

**Clase:** cleanup **Qué pasa:** export sin consumidores en el repo. **Por qué importa:** superficie
muerta en el staged set. **Fix:** borrar el export y limpiar re-exports.

## MEDIUM

### Prop `showHint` declared but unused

`src/components/RsvpForm.tsx:18 · ~3 lines · TSX · apply: auto-safe`

**Qué pasa:** prop en el tipo; nunca leída. **Por qué importa:** ruido de API. **Fix:** quitar del
tipo y del call site staged.

## LOW

- `src/lib/guests.ts:8` — comentario obsoleto sobre API v1 · apply: auto-safe

## Decisión

Todo lo accionable es `auto-safe` (solo limpiezas allowlisted). ¿Aplico con
`staged-code-review-apply`?
```

### MCQ case (mixed scope)

```md
# Staged review

**Veredicto:** 2 HIGH (0 risk · 2 cleanup) · 1 MEDIUM · 2 LOW · ~28 líneas **Alcance:** 5 files,
+40/−12 — dead exports and one unused SCSS partial; MM: 0

## HIGH

### Unused export `buildGuestMap`

`src/lib/guests.ts:42 · ~12 lines · TS · apply: auto-safe`

**Clase:** cleanup **Qué pasa:** export sin consumidores en el repo. **Por qué importa:** superficie
muerta en el staged set. **Fix:** borrar el export y limpiar re-exports.

### Orphan SCSS partial `_legacy-badge.scss`

`src/styles/invitation/_legacy-badge.scss · ~16 lines · SCSS · apply: needs-confirm`

**Clase:** cleanup **Qué pasa:** ningún `@use` / class consumer obvio. **Por qué importa:** CSS
huérfano candidato a borrado. **Fix:** eliminar el archivo tras confirmar cero consumidores.

## MEDIUM

### Prop `showHint` declared but unused

`src/components/RsvpForm.tsx:18 · ~3 lines · TSX · apply: auto-safe`

**Qué pasa:** prop en el tipo; nunca leída. **Por qué importa:** ruido de API. **Fix:** quitar del
tipo y del call site staged.

## LOW

- `src/lib/guests.ts:8` — comentario obsoleto sobre API v1 · apply: auto-safe
- `src/lib/guests.ts:55` — param exportado sin uso (cambia superficie pública)

## Decisión

Solo se auto-aplican limpiezas allowlisted; el partial y el param exportado quedan fuera salvo que
los elija.

**¿Cómo quiere proceder?**

- **a)** `[Recomendado]` — **Solo limpiezas allowlisted (auto-safe)**
  - **Objetivo:** Aplicar únicamente las limpiezas seguras identificadas.
  - **Pasos / Ej.:** Quitar export sin uso en `guests.ts`.

- **b)** **Allowlisted + borrado de partial huérfano**
  - **Objetivo:** Aplicar limpiezas safe e incluir la eliminación del partial si se confirma cero
    consumidores.
  - **Pasos / Ej.:** Eliminar `_legacy-badge.scss`.

- **c)** **Mantener solo reporte**
  - **Objetivo:** Conservar las observaciones sin aplicar cambios al código.
  - **Pasos / Ej.:** No modificar archivos.
```

---

## staged-code-review-apply

### Pre-apply (needs-confirm; no prior review choice)

```md
# Apply — confirmación previa

**Veredicto:** 2 auto-safe · 1 needs-confirm (delete) · 1 manual **Scope:** unbound — waiting for
delete confirmation

## Deletion manifest

- `_legacy-badge.scss` — orphan candidate; confirm zero `@use`

## Decisión

Hay borrados que requieren confirmación (manifest arriba).

**¿Cómo quiere proceder?**

- **a)** `[Recomendado]` — **Auto-safe + borrar manifest confirmado**
  - **Objetivo:** Aplicar limpiezas seguras y proceder con el borrado del manifest.
  - **Pasos / Ej.:** Eliminar `_legacy-badge.scss` huérfano.

- **b)** **Solo auto-safe**
  - **Objetivo:** Aplicar limpiezas seguras dejando el borrado de archivos a intervención manual.
  - **Pasos / Ej.:** Limpiar imports y dejar el archivo `.scss`.

- **c)** **No aplicar cambios**
  - **Objetivo:** Cancelar la aplicación.
  - **Pasos / Ej.:** No modificar nada.
```

### Post-apply (Scope from review MCQ `a` — allowlisted only)

```md
# Apply result

**Veredicto:** 3 aplicados · 1 omitido · 1 manual · ~16 líneas · verify PASS **Scope:** review MCQ
`a` — solo limpiezas allowlisted (auto-safe)

## Manual

### Governance path

`docs/core/project-conventions.md:20`

**Motivo:** nunca auto-apply en `docs/**`. **Sugerencia:** editar a mano o autorizar excepción
explícita.

## Aplicado

| Archivo           | Cambio                   | ~líneas |
| ----------------- | ------------------------ | ------- |
| `guests.ts:42`    | removed dead export      | 12      |
| `RsvpForm.tsx:18` | removed unused prop      | 3       |
| `guests.ts:8`     | removed obsolete comment | 1       |

## Omitido

- `src/lib/guests.ts:55` — cambia superficie pública
- `_legacy-badge.scss` — fuera del alcance `a`

## Decisión

Working tree dirty; verify PASS.

**¿Cómo quiere proceder?**

- **a)** `[Recomendado]` — **Planear commits con `commit-planner`**
  - **Objetivo:** Estructurar cambios en commits atómicos (el usuario stagea cuando decida
    visualizar).
  - **Pasos / Ej.:** Dividir fix y cleanup por intent.

- **b)** **Revisar diff unstaged manualmente**
  - **Objetivo:** Inspeccionar los cambios en el editor antes de organizar commits.
  - **Pasos / Ej.:** Panel Changes / `git diff`.

- **c)** **Detener aquí**
  - **Objetivo:** Finalizar el proceso sin planear o crear commits.
  - **Pasos / Ej.:** Mantener estado actual del working tree.

## Verify

- `pnpm type-check` — PASS
- Stash: skipped — stash not authorized
```

---

## commit-planner

````md
# Commit plan

**Veredicto:** should split · 2 commits · CHANGELOG n/a **Árbol:** 6 files dirty · 0 staged

## Commit 1 — `fix(rsvp): restore guest count when RSVP is declined`

**Intent:** corregir el conteo al declinar. **Incluye:** `src/lib/rsvp/counts.ts`,
`tests/unit/rsvp-counts.test.ts` **Fuera:** hunks de rename en `src/lib/rsvp/counts.ts` → Commit 2
**Usuario stagea:** `git add -p src/lib/rsvp/counts.ts` (solo hunks del fix);
`git add tests/unit/rsvp-counts.test.ts`

```
fix(rsvp): restore guest count when RSVP is declined

- src/lib/rsvp/counts.ts: keep confirmed seats when status is declined
- tests/unit/rsvp-counts.test.ts: cover declined path
```

## Commit 2 — `refactor(rsvp): rename tallyGuests to countConfirmedGuests`

**Intent:** rename sin cambio de comportamiento. **Incluye:** restante de `src/lib/rsvp/counts.ts` +
call sites **Fuera:** ya committed en Commit 1 **Usuario stagea:** `git add -p` / exact call-site
paths (user runs — agent does not)

## Decisión

El diff mezcla fix de RSVP y rename mecánico en el mismo archivo.

**¿Cómo quiere proceder?**

- **a)** `[Recomendado]` — **Autorizar al agente a ejecutar los commits según lo planeado**
  - **Objetivo:** Permitir que el agente realice las acciones necesarias en git (stage/unstage de
    los paths exactos y creación de los commits atómicos).
  - **Pasos / Ej.:** El agente agrupa y ejecuta Commit 1, luego Commit 2 de forma segura.

- **b)** **Ejecución manual paso a paso (el usuario stagea)**
  - **Objetivo:** El usuario stagea manualmente cada unidad en el index antes de que el agente cree
    el commit.
  - **Pasos / Ej.:** El usuario ejecuta `git add <paths>` para cada unidad.

- **c)** **Solo generar plan**
  - **Objetivo:** Conservar la propuesta sin realizar cambios ni commits.
  - **Pasos / Ej.:** Mantener el estado actual de Git.
````

---

## error-remediation

```md
# Remediation

**Estado:** CYCLE 2/3 · VERIFY FAIL **Error:** Type error: Property 'slug' does not exist on type
'EventRow' **Dónde:** `src/lib/events.ts:88` · category: type · complexity: moderate **Lock:**
extend-existing-test — EventRow exposes invitation_slug; callers map via adapter shape

## Hipótesis actual

`EventRow` quedó desalineado tras un cambio de tipos generados; el caller usa `slug` pero el tipo
expone `invitation_slug`.

## Por qué cambió vs ciclo anterior

El ciclo 1 añadió un optional chaining; el error persiste porque el nombre del campo es incorrecto,
no la nulabilidad.

## Fix propuesto

Usar `invitation_slug` (o mapear en el adapter) en `src/lib/events.ts:88` únicamente.

## Decisión

Re-run: `pnpm type-check`
```

### Escalation (cycle 3 exhausted / test-gap)

```md
# Escalation — remediation exhausted

**Bloqueante:** Type error on `EventRow.slug` still failing `pnpm type-check` **Intentos:** 3

**Qué se intentó:**

- C1: optional chaining
- C2: rename to `invitation_slug` in one caller
- C3: widen type — still fails elsewhere

## Decisión

Se agotaron 3 ciclos sin VERIFY PASS. (Or: lock required but out of safe scope.)

**¿Cómo quiere proceder?**

- **a)** `[Recomendado]` — **Pausar e indicar siguiente enfoque**
  - **Objetivo:** Detener ciclos automáticos y registrar el test-gap/bloqueo de forma segura.
  - **Pasos / Ej.:** Registrar invariante de familia o pedir revisión técnica.

- **b)** **Intento adicional acotado**
  - **Objetivo:** Ejecutar un intento final restringido a una superficie pequeña.
  - **Pasos / Ej.:** Mapear únicamente en el adapter.

- **c)** **Revertir cambios de esta remediación**
  - **Objetivo:** Deshacer las modificaciones realizadas durante la remediación si el worktree lo
    permite.
  - **Pasos / Ej.:** Restaurar archivos tocados por la sesión de remediación.
```
