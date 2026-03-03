# Evolucion de Invitaciones - Marzo 2026

## Objetivo

Estabilizar la arquitectura de invitaciones para garantizar independencia entre eventos, migrar
Gerardo a demo oficial, y dejar base productiva para nuevos clientes XV.

## Alcance

- Desacoplamiento de contenido, ruteo y estilos por invitacion.
- Gobernanza de color en 3 capas.
- Ciclo de vida de demo oficial para Gerardo.
- Infraestructura base para nuevo cliente XV real.

## Fuera de alcance

- Rediseño completo de componentes.
- Cambios de negocio en RSVP fuera de validaciones de compatibilidad.
- Instalacion de nuevas skills externas.

## Riesgos principales

- Colision de estilos por reglas fuera de su seccion.
- URLs no canonicas por desalineacion `eventType` vs slug.
- Dependencia de assets por slug no normalizado.
- Fallos silenciosos por variantes invalidas.

## Flujo arquitectonico (texto)

1. JSON (`theme`, `sectionStyles`) se valida con `src/content/config.ts`.
2. `adaptEvent` normaliza datos, resuelve assets y variantes.
3. La pagina dinamica inyecta CSS vars runtime (`--color-primary`, `--color-accent`) en
   `event-theme-wrapper`.
4. Preset (`theme-preset--*`) define tokens semanticos.
5. Cada componente aplica `data-variant` para estilos por seccion.

## Hallazgos de acoplamiento detectados

- `isDemo` existia en schema pero sin gobernanza operativa.
- Ruta principal cargaba por slug sin validar `eventType`.
- `src/styles/themes/sections/_gallery-theme.scss` contenia reglas de thank-you.
- Variantes en adapter se casteaban sin validacion estricta.

## Estandares de independencia entre invitaciones

1. Cada evento debe tener slug unico y assets aislados.
2. Demo oficial: `isDemo: true` y slug `demo-*`.
3. Ningun archivo de tema de seccion debe contener reglas de otra seccion.
4. Toda variante de seccion debe pasar por validacion con fallback controlado y log.

## Definicion operativa: demo vs cliente real

- Demo oficial:
    - `isDemo: true`
    - slug `demo-*`
    - contenido demostrativo, sin datos personales sensibles.
- Cliente real:
    - `isDemo: false` (o omitido)
    - slug de cliente
    - datos finales de evento y RSVP.

## Convenciones de naming

- Demos: `demo-{tipo}-{nombre}` (ejemplo: `demo-gerardo-sesenta`).
- Reales: `{nombre}-{referencia-evento}`.
- Plantillas: `template-{tipo}-real`.

## Nota editorial

La skill `copywriting-es` no esta disponible en la sesion actual; el proyecto mantiene copy en
espanol por gobernanza interna.
