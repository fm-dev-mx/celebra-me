# Plan de Evolución de Skills del Agente

**Fecha:** 14 de Febrero, 2026 **Estado:** Aprobado

## Contexto

Este documento formaliza la estrategia para evolucionar las capacidades del agente ("Skills") para
alinearse con la arquitectura actual de 'Celebra-me', específicamente cubriendo las brechas
introducidas por el módulo RSVP (Backend/API) y la Arquitectura de Temas v2.

## 1. Mantenimiento de Skills Core

Las siguientes skills se mantienen sin cambios mayores por su estabilidad y relevancia continua:

- **accessibility**: WCAG 2.1 AA sigue siendo el estándar.
- **testing**: Estrategia de Jest/Playwright validada.
- **copywriting-es**: Tono y voz para eventos sociales definidos.
- **seo-metadata**: Implementación de Open Graph correcta.

## 2. Nueva Skill: `backend-engineering`

**Objetivo:** Estandarizar el desarrollo de lógica de servidor y APIs, crítico para el módulo RSVP.
**Alcance:**

- Estructura de Endpoints (`src/pages/api/`).
- Validación de datos (Zod, Runtime).
- Manejo de Errores (Tipado, HTTP Codes).
- Integración con Supabase (Auth, RLS) y Servicios Externos (Email).

## 3. Nueva Skill: `documentation-governance`

**Objetivo:** Alinear el código con la documentación para evitar deuda técnica y "drift".
**Alcance:**

- Estructura oficial de `docs/`.
- Reglas para `task.md`, `implementation_plan.md`, `walkthrough.md`.
- Mantenimiento de diagramas (Mermaid).

## 4. Refactorización: `frontend-design` & `theme-architecture`

**Objetivo:** Soportar múltiples temas visuales ('jewelry-box', 'luxury-hacienda') con una
arquitectura de tokens robusta. **Estrategia:**

- **Separar**: Mover la lógica técnica de temas a una nueva skill `theme-architecture` (tokens,
  layers, switching).
- **Actualizar**: Enfocar `frontend-design` puramente en guías estéticas, composición y uso correcto
  de los tokens definidos.

## 5. Refactorización: `astro-patterns`

**Objetivo:** Limpiar patrones de renderizado y separar la carga de datos. **Cambios:**

- Promover patrones de "Backend-for-Frontend" (BFF).
- Clarificar uso de Server Islands vs Client Hydration.

## Roadmap de Implementación

1. ✅ Auditoría y Aprobación.
2. [En Progreso] Implementación de `backend-engineering`.
3. Implementación de `documentation-governance`.
4. Implementación de `theme-architecture` y actualización de `frontend-design`.
5. Actualización de `astro-patterns`.
