# Fase 4: Saneamiento Visual (Jewelry Box Architecture Refactoring)

**Objetivo Principal:** Erradicar todo uso de inline-styles subóptimos y utilidades CSS "ad-hoc" en
el ecosistema, mudando las reglas a una arquitectura coherente y centralizada `SCSS` gestionada por
el tema global "Jewelry Box", incrementando mantenibilidad para futuros features.

**Estado:** `100% Completado`

---

## 🎯 Hallazgos Específicos

1. **Abuso de "Ad-hoc Styling" Reactivo:**
    - La arquitectura UI tiene designados tokens de SCSS según `docs/domains/theme/`, pero hemos
      auditado el uso repetitivo de la prop DOM `style={{ ... }}` en componentes React del Dashboard
      y Claim Codes (ej., `margin`, `padding`, `gridColumn`).
    - Impactos conocidos bajo archivos:
        - `src/components/dashboard/events/EventsAdminTable.tsx`
        - `src/components/dashboard/ErrorBoundary.tsx`
        - `src/components/dashboard/claimcodes/ClaimCodeFormModal.tsx`
        - `src/components/dashboard/claimcodes/ClaimCodesTable.tsx`

2. **Ruptura del Principio de Encapsulamiento (BEM / Token CSS):**
    - El ecosistema "Jewelry Box" se caracteriza por predefinir bloques o entidades. Usar reglas
      inline elude variables de `color`, `radii` y espaciados estandarizados `rem`.

---

## 🛠️ Plan de Ejecución Paso a Paso

### 1. Migración Gradual por Dominios de Componente

- Repasar archivo por archivo los componentes en modo inspección usando búsqueda global de
  `style={{`.
- Transferir reglas como `gridColumn: '1 / -1'` (para errores de span global) a una clase en los
  módulos `.scss` correspondientes (ej., `.dashboard-error--full` o rehusando selectores CSS
  `span-all`).
- Transferir mofdicaciones de espaciado (`padding`, `marginTop`) hacia variables de sistema de
  tokens preexistentes (ej. `var(--spacing-md)` o `.u-mt-1`).

### 2. Estabilización de Componentes de Soporte UI Secundarios

- Por ejemplo, en `ErrorBoundary.tsx`: Convertirlo en una estructura visual elegante con SCSS
  modular, utilizando la paleta de alertas/estado (state-colors) definidos en el theme central.
- Extender SCSS global o crear utilidades reutilizables (`.u-grid-full`, `.u-text-center`) donde
  existan excepciones estéticas justificadas, evitando crear miles de Clases nuevas sin sentido;
  priorizando el uso del Block-Element-Modifier estricto.

### 3. Saneamiento General

- Rematar buscando otros ad-hocs como `TimelineList.tsx` y `Confetti.tsx` donde se usen cálculos
  `style={{ ... }}` que no requieran transformaciones JavaScript de animación matemáticas crudas.

---

## ✅ Criterios de Aceptación

- [x] Se redujeron en al menos un **95%** las ocurrencias totales de la propiedad `style={{...}}` o
      equivalente en componentes JSX, a excepción exclusiva de manipulaciones matemáticas dinámicas
      que no se puedan alojar en `SCSS` de clase estática.
- [x] La estructura domina y confía únicamente en referencias nominales formales a clases semánticas
      CSS conectadas con `docs/domains/theme/` (Architecture Refactoring Completo).

## 📝 Excepciones Documentadas

Las siguientes 2 ocurrencias de `style={{}}` fueron auditadas y se mantienen intencionalmente:

- **`Confetti.tsx`**: Cada partícula recibe `width`, `height`, `backgroundColor` y `borderRadius`
  derivados de `Math.random()` en runtime. No migrable a SCSS estático.
- **`TimelineList.tsx`**: La prop `pathLength` recibe un `MotionValue` de Framer Motion (`scaleY`)
  que controla la animación SVG reactiva al scroll. No migrable a SCSS estático.

Adicionalmente, se identificó deuda técnica fuera del alcance original (JSX `style={{}}`):

- **`mfa-setup.astro`**: Contiene ~10 asignaciones imperativas `.style.*` dentro de un bloque
  `<script>` de página Astro (vanilla JS con `document.createElement`). No son props JSX
  `style={{}}` sino manipulación DOM directa para el flujo MFA de Supabase. Se registra como backlog
  de refinamiento visual, no como regresión de esta fase.
