# Auditoría de Alineación Sistema-Documentación (Feb 2026)

## 1. Resumen de Hallazgos Críticos

### A. "Desincronización Fantasma" de Gobernanza

- **Problema**: `docs/DOC_STATUS.md` y `docs/implementation-log.md` reportan una reorganización
  masiva de carpetas en `.agent/workflows/` (ej. `governance/`, `sync/`, `audits/`) que NO existe en
  el filesystem.
- **Impacto**: Alta confusión al buscar guías operacionales; los paths canónicos están rotos.
- **Estado Real**: Los workflows están en `.agent/workflows/evergreen/` y
  `.agent/workflows/task-open/`.

### B. Laguna Arquitectónica en Itinerario

- **Problema**: Aunque existen estilos tematizados para `Itinerary`, la sección no está integrada
  formalmente en el sistema de `sectionStyles`.
- **Inconsistencias**:
    - `src/content/config.ts` NO incluye `itinerary` en `sectionStyles`.
    - `src/pages/[eventType]/[slug].astro` pasa el `preset` global como `variant` al Itinerario en
      lugar de una configuración específica de sección.
    - `src/content/events/demo-xv.json` tiene `variant` dentro del objeto `itinerary` directamente,
      mientras que `config.ts` prefiere (para otras secciones) que esté en `sectionStyles`.

### C. Evolución Huérfana de RSVP (WhatsApp)

- **Problema**: El componente `RSVP.tsx` ha sido actualizado recientemente con soporte para
  plantillas divididas (`confirmedTemplate`, `declinedTemplate`) y `omitTitle`, pero esta capacidad
  NO ha sido reflejada en:
    - `src/content/config.ts` (Validación de esquema fallará si se usan estos campos).
    - `docs/THEME_SYSTEM.md` (Documentación técnica incompleta).
    - `docs/RSVP_STATUS.md` (Estado de implementación no actualizado).

### D. Hardcoding en Rutas

- **Problema**: `src/pages/[eventType]/[slug].astro` contiene lógica condicionada a
  `eventType === 'cumple'` para inyectar etiquetas de RSVP.
- **Impacto**: Rompe el principio de "Arquitectura impulsada por datos" (Data-driven). Debería
  resolverse mediante `sectionStyles.rsvp.labels` o similar.

---

## 2. Inventario de Documentación Desactualizada/Redundante

| Archivo                | Estado            | Hallazgo                                                                              |
| :--------------------- | :---------------- | :------------------------------------------------------------------------------------ |
| `docs/DOC_STATUS.md`   | ❌ Crítico        | Reporta 55 workflows; solo existen ~5 activos. Paths rotos.                           |
| `docs/THEME_SYSTEM.md` | ⚠️ Desactualizado | Esquema de `sectionStyles` de ejemplo no coincide con `config.ts`. Omite `itinerary`. |
| `docs/RSVP_STATUS.md`  | ⚠️ Incompleto     | No menciona las nuevas capacidades de plantillas de WhatsApp (Tier 3).                |
| `docs/ARCHITECTURE.md` | 🟢 Saludable      | Sigue siendo la base sólida, pero debe reforzarse el aislamiento de labels de RSVP.   |

---

## 3. Plan de Auditoría (Verificación Final)

1. **[ ] Auditoría de Esquemas**: Validar que todos los campos nuevos de WhatsApp en `RSVP.tsx` sean
   añadidos a `config.ts` para evitar errores de compilación de Astro.
2. **[ ] Auditoría de Propagación de Variantes**: Verificar en el navegador que `Itinerary` esté
   recibiendo correctamente el `variant` y aplicando los estilos de `_itinerary-theme.scss`.
3. **[ ] Auditoría de Workflows**: Identificar cuáles de los workflows "fantasma" en `DOC_STATUS.md`
   son necesarios recuperar y cuáles deben ser borrados de la documentación.

---

## 4. Plan de Resolución (Blueprint)

### Fase 1: Sincronización de Gobernanza (Docs-First)

- **Meta**: Que la documentación diga la verdad sobre el estado del repositorio.
- **Pasos**:
    1. Corregir todos los paths en `DOC_STATUS.md` y `implementation-log.md` para reflejar la
       estructura real (`evergreen/`, `task-open/`).
    2. Eliminar menciones a workflows inexistentes en `DOC_STATUS.md`.

### Fase 2: Alineación de Itinerario y Galería

- **Meta**: Estandarizar el uso de `sectionStyles`.
- **Pasos**:
    1. Actualizar `src/content/config.ts` para incluir `itinerary` y `gallery` dentro de
       `sectionStyles`.
    2. Migrar los datos en `demo-xv.json` y `gerardo-sesenta.json` para que los `variants` de estas
       secciones cuelguen de `sectionStyles`.
    3. Actualizar `[slug].astro` para pasar `data.sectionStyles.itinerary.variant`.

### Fase 3: Hardening de RSVP y WhatsApp

- **Meta**: Soportar oficialmente las nuevas plantillas enviadas por el usuario.
- **Pasos**:
    1. Añadir `confirmedTemplate`, `declinedTemplate` y `omitTitle` al schema de `whatsappConfig` en
       `config.ts`.
    2. Mover las etiquetas personalizadas de "Gerardo 60" desde el código de la ruta
       (`[slug].astro`) a los archivos JSON correspondientes a través de `data.sectionStyles.rsvp`.

### Fase 4: Cierre de Documentación

- **Meta**: Actualizar manuales de temas y estatus.
- **Pasos**:
    1. Actualizar `THEME_SYSTEM.md` con las nuevas capacidades de RSVP y la sección Itinerary.
    2. Actualizar `RSVP_STATUS.md` marcando el Tier 3 (Plantillas avanzadas) como completado.
