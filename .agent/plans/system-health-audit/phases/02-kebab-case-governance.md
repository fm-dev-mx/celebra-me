# Fase 2: Renombrado Súper-Consciente e Integración Kebab-Case

**Objetivo Principal:** Ajustar la ambigüedad en las reglas de nomenclatura entre el Framework
(Astro/React con `PascalCase`) y las políticas documentadas de Gatekeeper de "todo en minúsculas y
`kebab-case`", para asegurar un pipeline y reglas deterministas sin fricción para el usuario.

**Estado:** `0% Completado`

---

## 🎯 Hallazgos Específicos

1. **Problemas con Cientos de Archivos en `PascalCase`:**
    - La auditoría en caliente identificó una media de **750 archivos** en `src/` (y en `.agent/`)
      que no siguen la regla de `kebab-case` que Gatekeeper impone (`GATEKEEPER_RULES.md`). Las
      excepciones para `PascalCase` en componentes **React / Astro** son comúnes y naturales.
    - Las carpetas nativas de Next/Astro en algunas estructuras también usan `[brackets]` que rompen
      la validación tradicional.

2. **Convenciones Híbridas (Falta de Alineación Doc-Código):**
    - El documento original `docs/core/project-conventions.md` no establece explícitamente cuáles
      son los límites entre `.tsx` / `.astro` y módulos funcionales habituales (`utils.ts`).
    - El evaluador de `governance.js` de la herramienta `gatekeeper` no distingue fluidamente las
      excepciones (si es un `.tsx` / `.astro`, etc.).

---

## 🛠️ Plan de Ejecución Paso a Paso

### 1. Resolución Arquitectónica (Voto Temprano)

- **Decisión a tomar:** ¿Aceptará Gatekeeper archivos React/Astro en `PascalCase` y únicamente se
  enforzará `kebab-case` para directorios, assets y utilidades JS/TS puros? Esto reducirá el impacto
  de renombrado drásticamente.
- **Acción:** Documentar la excepción en `docs/core/project-conventions.md`.

### 2. Modificación de `governance.js`

- Ajustar el script de validación (presumiblemente alojado en `.agent/scripts` o
  `.agent/governance/`) para inyectar una "Whitelist Regex" que perdone el caso `Camel` o `Pascal`
  exclusivamente a componentes de capa UI (archivos `.astro`, `.tsx`, `.jsx`).

### 3. Renombrado Determinista Restante (El Remanente)

- Si quedan archivos fuera de la UI (ej. `.ts` en `src/lib/`, `.css` puros desalineados) o
  directorios con `PascalCase` o `camelCase`, ejecutaremos su migración a `kebab-case`.
- Actualizar las rutas de importación en todos los archivos del código usando `ripgrep`/búsqueda
  global para mantener las construcciones pasando con el 100% de tests.

---

## ✅ Criterios de Aceptación

- [ ] Todas las extensiones `.tsx` y `.astro` están expresamente exentas del `kebab-case`
      restrictivo en la regla oficial de validación.
- [ ] La herramienta Gatekeeper (sea el script manual o el Workflow general) pasa exitosamente sin
      arrojar falsos positivos por la capitalización de nombres de componentes UI.
- [ ] Cualquier función de soporte `.ts` / utilerías, activos y directorios han sido sanitizados al
      estricto `kebab-case`.
