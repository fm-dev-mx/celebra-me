# Fase 1: Limpieza de Residuos, Archivos Obsoletos y Referencias Caídas

**Objetivo Principal:** Reducir la "deuda de ruido" y aumentar la fidelidad de la documentación
corrigiendo enlaces rotos y eliminando archivos residuales (ej. configuraciones de herramientas
sustituidas o logs temporales) sin afectar la funcionalidad core del sistema.

**Estado:** `100% Completado`

---

## 🎯 Hallazgos Específicos

1. **Scripts Obsoletos (Raíz del proyecto):**
    - El ecosistema actualmente utiliza `playwright` (`playwright.config.ts`), sin embargo, se
      detecta el archivo `jest.config.cjs`. Dado que en `.agent/skills/testing/SKILL.md` ambas
      tecnologías son válidas (Jest para Unit, Playwright para E2E), es imperativo confirmar su
      obsolescencia antes de borrar.
    - Existen rastros de `commitlint.config.cjs` en un ecosistema que delega el lint de commits a
      las reglas de _Gatekeeper Commit Workflow_ (`.agent/GATEKEEPER_RULES.md`).

2. **Referencias Caídas (Documentation Drift):**
    - He verificado mediante herramientas AST que los siguientes archivos clave contienen
      referencias a archivos `.md` que ya no existen (debido a la re-estructuración reciente a
      3-Capa):
        - `docs/core/architecture.md`: Línea 40-42 (aprox.) apunta a `./THEME_SYSTEM.md` que fue
          movido a `docs/domains/theme/`.
        - `docs/PREMIUM_UX_VISION.md`: Apunta a `./THEME_SYSTEM.md`.

3. **Carpetas con `.gitkeep` innecesarios:**
    - La auditoría en caliente no reportó archivos `.gitkeep` atrapados en carpetas repletas de
      contenido de forma concluyente, pero requiere una corrida de revalidación previa al commit de
      la fase.

---

## 🛠️ Plan de Ejecución Paso a Paso

### 1. Revalidación de Residuos

- Leer detalladamente `package.json` para cruzar dependencias de `jest` y `commitlint`.
- Si existen los scripts `"test:unit": "jest"` y dependencias, `jest.config.cjs` es legítimo y se
  remueve este ítem como deuda técnica. En caso contrario, se programa su eliminación.
- Mismo criterio para `commitlint.config.cjs`.

### 2. Corrección de Enlaces (Documentation Binding)

- Actualizar `docs/core/architecture.md` reemplazando los links rotos a `docs/domains/theme/` (ej.
  `[Theme System](../domains/theme/...)`).
- Actualizar `docs/PREMIUM_UX_VISION.md` (y reevaluar si este mismo archivo debe moverse a
  `docs/core/` para cumplir convención de rutas).

### 3. Validación de Calidad

- Ejecutar un script de comprobación final rápido para garantizar cero "Broken Links" desde la
  carpeta `docs/` y `.agent/`.

---

## ✅ Criterios de Aceptación

- [x] Todas las referencias locales de Markdown en `docs/` resuelven a rutas existentes.
- [x] No existen configuraciones huérfanas en la raíz de herramientas removidas del `package.json`
      (Revisado: tanto config de Jest como CommitLint están operativas según `package.json` y
      `Husky`).
- [x] Opcional: El documento `PREMIUM_UX_VISION.md` ha sido migrado y estandarizado a la
      arquitectura de 3 capas (`docs/core/premium-ux-vision.md`) o en su defecto a
      `docs/domains/theme/`.
