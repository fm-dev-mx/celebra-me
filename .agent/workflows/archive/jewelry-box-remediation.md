---
description:
    ARCHIVED - Remediación estética y técnica completada; consolidado en workflows de gobernanza.
---

# [ARCHIVED] 💎 Workflow: Jewelry Box Remediation (XV Años)

> **Archived Date**: 2026-02-13 **Reason**: Workflow táctico consolidado y cerrado. **Coverage**:
> Use `.agent/workflows/theme-architecture-governance.md` y
> `.agent/workflows/docs/landing-page-maintenance.md` para mantenimiento continuo.

Este workflow soluciona las regresiones visuales en la demo de XV años, asegurando que el tema
`jewelry-box` sea 100% premium y esté **técnicamente aislado** de otros temas como
`luxury-hacienda`.

## 📌 Contexto y Objetivos

- **Visión**: Estética de "Joyero" - Oro pulido, perla, cristalería (glassmorphism), tipografía
  elegante.
- **Arquitectura**: Cada tema es una unidad independiente. No debe haber fugas de estilos globales
  (clases como `.card` o `.btn` no deben ser modificadas a nivel raíz por un tema).

---

## 🏗️ Fase 1: Blindaje Arquitectónico (Isolation)

1. **Protección de Selectores Globales**
    - Auditar `src/styles/themes/presets/_luxury-hacienda.scss`.
    - Mover cualquier override de `.card` o `.btn-primary` dentro del selector
      `.theme-preset--luxury-hacienda`.

2. **Robustecer Jewelry Box**
    - Enriquecer `src/styles/themes/presets/_jewelry-box.scss` con variables semánticas completas
      (surfaces, actions, borders) para evitar dependencia de valores por defecto.

---

## ✨ Fase 2: Remediación Focalizada

1. **Familia (Family - Jewelry Variant)**
    - Modificar `src/styles/themes/sections/_family-theme.scss`.
    - Eliminar texturas Western (cuero/remaches) de la variante `jewelry-box`.
    - Implementar un "Layout de Seda": Fondos claros, marcos de oro fino, tipografía formal.

2. **Ubicación & Regalos (Location & Gifts)**
    - Refinar `src/styles/themes/sections/_location-theme.scss` e
      `src/styles/themes/sections/_gifts-theme.scss`.
    - Asegurar que las cards tengan el acabado "Glass/Gold" esperado.

3. **RSVP, Itinerario & Header**
    - Ajustar `src/styles/invitation/_rsvp.scss` e `src/styles/invitation/_itinerary.scss`.
    - El Header de la invitación debe adaptarse cromáticamente al tema activo sin afectar la Landing
      Page.

4. **Gallery, Thank You & Footer**
    - Unificar el lenguaje visual en las secciones finales de la invitación.

---

## 🛠️ Fase 3: Verificación de Independencia

1. **Prueba Transversal**
    - Verificar que los cambios en `jewelry-box` NO rompan `luxury-hacienda`.
    - Verificar que la Landing Page mantenga sus estilos originales.

2. **Cierre de Calidad**
    - Ejecutar `.agent/workflows/docs/gatekeeper-commit.md` (`--strict`).
