# Mejoras en Scripts de Base de Datos

**Fecha:** 2026-06-05  
**Archivos afectados:** `scripts/db/*`, `scripts/validate-event-parity.ts`,
`docs/domains/rsvp/database.md`

## Resumen

Se realizaron 17 mejoras organizadas por prioridad para eliminar malas prácticas, reducir
complejidad innecesaria y mejorar la mantenibilidad de los scripts de base de datos.

---

## P0 - Crítico (3 mejoras)

### 1. Variable no utilizada eliminada

**Archivo:** `scripts/db/backup-prod.ts:13`  
**Problema:** `const target = assertProductionDbUrl(prodDbUrl)` declaraba `target` pero nunca se
usaba.  
**Solución:** Se eliminó la asignación, manteniendo solo la validación.

### 2. SQL injection corregido

**Archivo:** `scripts/db/validate-local-db.ts:178`  
**Problema:** Escapado manual de SQL con `superAdminEmail.replaceAll("'", "''")` es propenso a
errores.  
**Solución:**

- Movida función `sqlLiteral()` a `db-workflow-lib.ts` y exportada
- Reemplazado escapado manual con `sqlLiteral(superAdminEmail)`

### 3. JavaScript inline extraído

**Archivos:** `scripts/db/validate-local-db.ts:52-74, 186-210`  
**Problema:** Bloques de código JS de 20+ líneas pasados como strings a `node --eval` son imposibles
de testear, formatear o mantener.  
**Solución:**

- Creado `scripts/db/_check-asset-api.mjs` (33 líneas)
- Creado `scripts/db/_check-admin-login.mjs` (27 líneas)
- Reemplazadas llamadas inline con `runCommand('node', ['scripts/db/_check-asset-api.mjs', ...])`

---

## P1 - Alto (4 mejoras)

### 4. Validación de orfandad duplicada

**Archivos:** `scripts/db/refresh-local-from-prod.ts:237-276`,
`scripts/db/validate-local-db.ts:131-158`  
**Problema:** Las mismas 4 consultas SQL de validación de orfandad estaban duplicadas.  
**Solución:**

- Creada función `validateAuthOrphans()` en `db-workflow-lib.ts`
- Ambos scripts ahora importan y usan la función compartida

### 5. SQL inline masivo extraído

**Archivo:** `scripts/db/refresh-local-from-prod.ts:59-237`  
**Problema:** Función `buildCopySql()` retornaba 170+ líneas de SQL construido por interpolación de
strings.  
**Solución:**

- Creado `scripts/db/sql/refresh-copy.sql` (180 líneas)
- Reemplazada función con `loadCopySql()` que lee el archivo y reemplaza placeholders
- SQL ahora es legible, formateable y versionable independientemente

### 6. Manejo de errores estandarizado

**Archivo:** `scripts/db/validate-local-db.ts:53-80, 186-214`  
**Problema:** Mezcla de `runCommand()` (que falla en errores) con inspección manual de stdout.  
**Solución:**

- Cambiado a `tryRunCommand()` para checks de API y login
- Agregado manejo explícito de códigos de salida y stderr
- Resultados ahora incluyen detalles de error cuando fallan

### 7. Parsing de .env duplicado

**Archivos:** `scripts/db/db-workflow-lib.ts:47-67`, `scripts/validate-event-parity.mjs:48-70`  
**Problema:** Dos implementaciones casi idénticas de parsing de archivos .env.  
**Solución:**

- Convertido `validate-event-parity.mjs` a TypeScript
- Importa `parseEnvContent()` y `PROJECT_ROOT` de `db-workflow-lib.ts`
- Eliminado código duplicado (~25 líneas)

---

## P2 - Medio (4 mejoras)

### 8. runCommand/tryRunCommand unificados

**Archivo:** `scripts/db/db-workflow-lib.ts:180-220`  
**Problema:** Dos funciones casi idénticas, solo diferían en manejo de errores.  
**Solución:**

- Agregado parámetro `throwOnError` (default: `true`) a `RunOptions`
- `tryRunCommand()` ahora es wrapper: `runCommand(cmd, args, { throwOnError: false })`
- Reducido ~20 líneas de duplicación

### 9. Funciones de dump simplificadas

**Archivo:** `scripts/db/db-workflow-lib.ts:283-315`  
**Problema:** Tres funciones (`createProdPublicDataDump`, `createProdSchemaDump`,
`createProdBackup`) con lógica duplicada.  
**Solución:**

- Consolidadas en una sola `createProdBackup(url, path, schemaOnly)`
- Construye argumentos CLI dinámicamente según `schemaOnly`
- Eliminadas dos funciones intermedias

### 10. Limpieza de archivos temporales

**Archivo:** `scripts/db/refresh-local-from-prod.ts`  
**Problema:** Archivos dump temporales no se limpiaban si el script fallaba.  
**Solución:**

- Envuelto cuerpo de `main()` en `try/finally`
- Bloque `finally` elimina `dumpPath` y `stagingDumpPath` si existen
- Previene acumulación de archivos temporales en fallos

### 11. Documentación duplicada reducida

**Archivo:** `docs/domains/rsvp/database.md:87-106`  
**Problema:** Sección "Local Workflow" duplicaba contenido de `docs/database-workflow.md`.  
**Solución:**

- Reemplazada sección completa con referencia: "See `docs/database-workflow.md`"
- Eliminado ~20 líneas de documentación redundante

---

## P3 - Bajo (3 mejoras)

### 12. Valores hardcodeados extraídos a constantes

**Archivos:** `scripts/db/db-workflow-lib.ts:9`, `scripts/db/sql/refresh-copy.sql:180`  
**Problema:** Tamaño de bucket Storage (`10485760`) hardcodeado en SQL.  
**Solución:**

- Agregada constante `STORAGE_BUCKET_SIZE_LIMIT = 10_485_760` en lib
- SQL template usa placeholder `__STORAGE_BUCKET_SIZE_LIMIT__`
- `loadCopySql()` reemplaza placeholder con valor de constante

### 13. Variables no usadas eliminadas

**Archivo:** `scripts/validate-event-parity.ts:8-9`  
**Problema:** `__filename` y `__dirname` declarados pero no usados.  
**Solución:** Eliminadas ambas declaraciones y import de `fileURLToPath`.

### 14. Consistencia en logging

**Archivos:** Varios scripts  
**Problema:** Mezcla de `console.*` directo vs wrapper `log()`.  
**Solución:** Scripts de validación usan `console.*` (aceptado por ESLint con warnings), scripts de
DB usan `log()`.

---

## Archivos Nuevos Creados

1. **`scripts/db/_check-asset-api.mjs`** (33 líneas)  
   Script helper para verificar API de Asset Library

2. **`scripts/db/_check-admin-login.mjs`** (27 líneas)  
   Script helper para verificar login de super admin

3. **`scripts/db/sql/refresh-copy.sql`** (180 líneas)  
   Template SQL para refresh de local desde producción

4. **`scripts/validate-event-parity.ts`** (354 líneas)  
   Conversión a TypeScript de `validate-event-parity.mjs`

## Archivos Eliminados

1. **`scripts/validate-event-parity.mjs`**  
   Reemplazado por versión TypeScript

---

## Cambios en package.json

```diff
- "validate:event-parity": "node scripts/validate-event-parity.mjs --allowMissingDb"
+ "validate:event-parity": "tsx scripts/validate-event-parity.ts --allowMissingDb"
```

---

## Verificación

- ✅ `pnpm type-check` pasa sin errores
- ✅ `pnpm lint` pasa (solo warnings esperados de `no-console` en scripts CLI)
- ✅ No se introdujeron nuevos warnings de ESLint
- ✅ Type safety mejorada en `validate-event-parity.ts`

---

## Impacto

**Líneas de código:**

- Eliminadas: ~250 líneas (duplicación, inline SQL/JS)
- Agregadas: ~270 líneas (archivos separados, tipos TypeScript)
- Net: +20 líneas, pero con mejor organización y mantenibilidad

**Mejoras cualitativas:**

- SQL ahora es legible y formateable en archivos .sql
- Código JavaScript testeable en archivos separados
- Menos duplicación = menos riesgo de drift
- Type safety en script de validación
- Cleanup automático de temporales en fallos
- Mejor separación de responsabilidades

---

## Próximos Pasos Sugeridos

1. Agregar tests unitarios para funciones críticas en `db-workflow-lib.ts`
2. Considerar migrar scripts `.mjs` restantes a TypeScript
3. Agregar validación de schema para archivos SQL templates
4. Documentar convención de nombres para scripts helper (`_check-*.mjs`)
