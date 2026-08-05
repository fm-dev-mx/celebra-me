---
template: agent-report-samples
purpose: One sample human-facing report per artifact under agent-report-contract
version: 1.3.0
---

# Agent Report Samples

Illustrative only. Field values are fictional. Every MCQ has exactly three options (`a`/`b`/`c`)
with action + scope + brief example.

---

## staged-code-review

### CTA case (all auto-safe)

```md
# Staged review

**Veredicto:** 1 HIGH (0 risk · 1 cleanup) · 1 MEDIUM · 0 LOW · ~15 líneas
**Alcance:** 2 files, +8/−3 — unused export and unused prop; MM: 0

## HIGH

### Unused export `buildGuestMap`

`src/lib/guests.ts:42 · ~12 lines · TS · apply: auto-safe`

**Clase:** cleanup
**Qué pasa:** export sin consumidores en el repo.
**Por qué importa:** superficie muerta en el staged set.
**Fix:** borrar el export y limpiar re-exports.

## MEDIUM

### Prop `showHint` declared but unused

`src/components/RsvpForm.tsx:18 · ~3 lines · TSX · apply: auto-safe`

**Qué pasa:** prop en el tipo; nunca leída.
**Por qué importa:** ruido de API.
**Fix:** quitar del tipo y del call site staged.

## Decisión

Todo lo accionable es `auto-safe`. ¿Aplico con `staged-code-review-apply`?
```

### MCQ case (mixed scope)

```md
# Staged review

**Veredicto:** 2 HIGH (0 risk · 2 cleanup) · 1 MEDIUM · 1 LOW · ~28 líneas
**Alcance:** 5 files, +40/−12 — dead exports and one unused SCSS partial; MM: 0

## HIGH

### Unused export `buildGuestMap`

`src/lib/guests.ts:42 · ~12 lines · TS · apply: auto-safe`

**Clase:** cleanup
**Qué pasa:** export sin consumidores en el repo.
**Por qué importa:** superficie muerta en el staged set.
**Fix:** borrar el export y limpiar re-exports.

### Orphan SCSS partial `_legacy-badge.scss`

`src/styles/invitation/_legacy-badge.scss · ~16 lines · SCSS · apply: needs-confirm`

**Clase:** cleanup
**Qué pasa:** ningún `@use` / class consumer obvio.
**Por qué importa:** CSS huérfano candidato a borrado.
**Fix:** eliminar el archivo tras confirmar cero consumidores.

## MEDIUM

### Prop `showHint` declared but unused

`src/components/RsvpForm.tsx:18 · ~3 lines · TSX · apply: auto-safe`

**Qué pasa:** prop en el tipo; nunca leída.
**Por qué importa:** ruido de API.
**Fix:** quitar del tipo y del call site staged.

## LOW

- `src/lib/guests.ts:8` — comentario obsoleto sobre API v1 · apply: auto-safe

## Decisión

Hay limpiezas seguras y un borrado de partial con duda de consumidores.

**¿Cómo quiere proceder?**

a) Aplicar limpiezas seguras y el borrado del partial si no hay `@use`. Ej.: quitar export en `guests.ts` **(recomendado)**
b) Solo limpiezas seguras; el partial queda en manual. Ej.: imports/props sin tocar SCSS
c) Solo dejar el reporte; no aplicar cambios
```

---

## staged-code-review-apply

### Pre-apply (needs-confirm; no prior review choice)

```md
# Apply — confirmación previa

**Veredicto:** 2 auto-safe · 1 needs-confirm (delete) · 1 manual
**Scope:** unbound — waiting for delete confirmation

## Deletion manifest

- `_legacy-badge.scss` — orphan candidate; confirm zero `@use`

## Decisión

Hay borrados que requieren confirmación (manifest arriba).

**¿Cómo quiere proceder?**

a) Auto-safe + borrar el manifest. Ej.: quitar `_legacy-badge.scss` huérfano **(recomendado)**
b) Solo auto-safe; deletes a manual. Ej.: limpiar imports y dejar el `.scss`
c) No aplicar nada
```

### Post-apply (Scope from review MCQ `a` or pre-apply MCQ `a`)

```md
# Apply result

**Veredicto:** 3 aplicados · 0 omitidos · 1 manual · ~31 líneas · verify PASS
**Scope:** review MCQ `a` — auto-safe + deletion manifest
  (or: pre-apply MCQ `a` — same scope)

## Manual

### Governance path

`docs/core/project-conventions.md:20`

**Motivo:** nunca auto-apply en `docs/**`.
**Sugerencia:** editar a mano o autorizar excepción explícita.

## Aplicado

| Archivo | Cambio | ~líneas |
| --- | --- | --- |
| `guests.ts:42` | removed dead export | 12 |
| `_legacy-badge.scss` | deleted orphan partial | 16 |
| `RsvpForm.tsx:18` | removed unused prop | 3 |

## Decisión

Working tree dirty; verify PASS.

**¿Cómo quiere proceder?**

a) Planear commits con `commit-planner` (usted stagea cuando quiera visualizar). Ej.: intent atómico **(recomendado)**
b) Revisar el diff unstaged a mano antes de planear. Ej.: panel Changes / `git diff`
c) Parar aquí

## Verify

- `pnpm type-check` — PASS
- Stash: skipped — stash not authorized
```

---

## commit-planner

````md
# Commit plan

**Veredicto:** should split · 2 commits · CHANGELOG n/a
**Árbol:** 6 files dirty · 0 staged

## Commit 1 — `fix(rsvp): restore guest count when RSVP is declined`

**Intent:** corregir el conteo al declinar.
**Incluye:** `src/lib/rsvp/counts.ts`, `tests/unit/rsvp-counts.test.ts`
**Fuera:** hunks de rename en `src/lib/rsvp/counts.ts` → Commit 2
**Usuario stagea:** `git add -p src/lib/rsvp/counts.ts` (solo hunks del fix); `git add tests/unit/rsvp-counts.test.ts`

```
fix(rsvp): restore guest count when RSVP is declined

- src/lib/rsvp/counts.ts: keep confirmed seats when status is declined
- tests/unit/rsvp-counts.test.ts: cover declined path
```

## Commit 2 — `refactor(rsvp): rename tallyGuests to countConfirmedGuests`

**Intent:** rename sin cambio de comportamiento.
**Incluye:** restante de `src/lib/rsvp/counts.ts` + call sites
**Fuera:** ya committed en Commit 1
**Usuario stagea:** `git add -p` / exact call-site paths (user runs — agent does not)

## Decisión

El diff mezcla fix de RSVP y rename mecánico en el mismo archivo.

**¿Cómo particionamos?**

a) Dos commits: usted stagea el fix RSVP y luego el rename con `git add -p`. Ej.: conteo primero **(recomendado)**
b) Un solo commit (fix + rename juntos). Ej.: revert más difícil
c) Solo plan; no hacer stage ni commit
````

---

## error-remediation

```md
# Remediation

**Estado:** CYCLE 2/3 · VERIFY FAIL
**Error:** Type error: Property 'slug' does not exist on type 'EventRow'
**Dónde:** `src/lib/events.ts:88` · category: type · complexity: moderate

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

### Escalation (cycle 3 exhausted)

```md
# Escalation — remediation exhausted

**Bloqueante:** Type error on `EventRow.slug` still failing `pnpm type-check`
**Intentos:** 3

**Qué se intentó:**
- C1: optional chaining
- C2: rename to `invitation_slug` in one caller
- C3: widen type — still fails elsewhere

## Decisión

Se agotaron 3 ciclos sin VERIFY PASS.

**¿Cómo quiere proceder?**

a) Parar aquí; indico el siguiente enfoque. Ej.: revisar tipos generados juntos **(recomendado)**
b) Un intento más con hipótesis acotada. Ej.: mapear solo en el adapter
c) Revertir solo archivos tocados por esta remediation (si el worktree lo permite)
```
