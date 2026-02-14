---
description: Recovery and Aesthetic Refinement of the Initial Card (Gerardo)
lifecycle: task-open
domain: remediation
owner: ux-remediation
last_reviewed: 2026-02-14
---

# Gerardo Initial Card Recovery Workflow

Este workflow coordina la ejecución técnica para restaurar la "carta inicial" desaparecida,
asegurando alineación con la arquitectura de temas.

## Requisitos Previos

- [x] Análisis de la causa raíz (componente vacío y estilos ausentes).
- [x] Plan de implementación aprobado.

## Fases de Ejecución

### 1. Preparación de Estructura

- [ ] Modificar `src/components/invitation/EnvelopeReveal.tsx` para agregar los placeholders de
      contenido dentro de `.envelope-card`.
- [ ] Asegurar que el componente sea agnóstico al evento pero estilizable por temas.

### 2. Estilización de Tema (Luxury Hacienda)

- [ ] Abrir `src/styles/themes/sections/_reveal-theme.scss`.
- [ ] Definir estilos para `.envelope-card` específicos para `luxury-hacienda`.
- [ ] Implementar texturas de pergamino, remaches y costuras.

### 3. Refinamiento de Animación

- [ ] Ajustar el `translateY` en el estado `.is-rising` si el nuevo contenido requiere más espacio.

### 4. Verificación

- [ ] Ejecutar servidor dev (`pnpm dev`).
- [ ] Forzar apertura de sobre y auditar visualmente.
- [ ] Correr `/gatekeeper-commit` al finalizar satisfactoriamente.

## Guías de Calidad

- **BEM**: Usar `.envelope-card__content`, `.envelope-card__item`, etc.
- **Tokens**: Usar `var(--color-surface-primary)` y mixins de tipografía.
- **Premium**: La carta debe sentirse "física", no un elemento plano.
