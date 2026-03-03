# Phase 3 - Demo Lifecycle Management

Status: 90%

## Objetivo

Convertir Gerardo a demo oficial con slug nuevo, asegurar render, y retirar entry original.

## Tareas ejecutadas

1. Creado `src/content/events/demo-gerardo-sesenta.json`.
2. Configurado `isDemo: true`.
3. Retirada entrada original `src/content/events/gerardo-sesenta.json`.
4. Actualizado `AssetRegistry` para usar slug `demo-gerardo-sesenta`.
5. Actualizado landing para exponer demo de cumpleanos.

## Contrato demo oficial

1. Slug prefijado con `demo-`.
2. `isDemo: true` obligatorio.
3. Assets aislados y resolubles por slug.

## Validaciones pendientes

1. Smoke test de ruta publica `/cumple/demo-gerardo-sesenta`.
2. Verificacion manual de secciones completas (hero, location, gallery, rsvp, gifts, thank-you).
3. Confirmar que no existan consumidores externos de la URL retirada.

## Rollback

1. Restaurar `gerardo-sesenta.json`.
2. Revertir mapping del registry al slug antiguo.
3. Quitar enlace de cumpleanos demo en landing.
