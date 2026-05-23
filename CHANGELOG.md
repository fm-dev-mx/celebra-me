# Changelog

Todos los cambios notables en el proyecto Celebra-me serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este
proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/spec/v2.0.0.html).

## [Unreleased]

### Added

- Sistema de workflows de agente para automatización de tareas
- Documentación de arquitectura y convenciones del proyecto

## [0.2.0-beta.1] - 2026-05-23

### Stable baseline

Primer checkpoint de release luego de la fase de estabilización/testing. Este tag congela el estado
verificado de los siguientes flujos:

- Guest dashboard (CRUD, búsqueda por teléfono, country code enforcement)
- RSVP (formulario, confirmación, temas premiere-floral, editorial, celestial blue)
- Phone input component con normalización internacional
- Invitaciones (envío, estados, gatekeeper)
- Import wizard con normalización de teléfonos internacionales
- Pruebas unitarias, de integración, API, componentes y E2E
- Infraestructura de pruebas (fixtures compartidos, helpers)

### Verification

| Check      | Result                                                                     |
| :--------- | :------------------------------------------------------------------------- |
| Lint       | Passed (1 pre-existing warning)                                            |
| Type-check | Passed                                                                     |
| Tests      | Passed (Windows test skipped with `test.skip` — known platform limitation) |
| Build      | Passed                                                                     |

### Known issues

- Las pruebas que dependen de `git` pueden fallar si `git` no está en `PATH` (aislado a entornos CI
  sin git).
- La prueba de Windows `dashboard.guests.happy` se salta con `test.skip` por una limitación de
  plataforma en `spawn`.

## [0.1.0] - 2024

### Added

- Estructura inicial del proyecto con Astro
- Sistema de invitaciones digitales
- Temas visuales (Jewelry Box, Luxury Hacienda)
- Sistema de tokens de diseño SCSS
- Integración con Vercel para despliegue
