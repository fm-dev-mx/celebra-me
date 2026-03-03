# Phase 4 - Scaling for Real Clients

Status: 80%

## Objetivo

Dejar habilitada la infraestructura para una nueva invitacion XV real con componentes productivos.

## Tareas ejecutadas

1. Creada plantilla base `src/content/events/template-xv-real.json`.
2. Incluidos bloques listos para produccion:
    - Itinerary
    - RSVP
    - Gallery
3. Estandarizada estructura de etiquetas RSVP en espanol.
4. Definida guia de secciones obligatorias vs opcionales.

## Contratos de datos minimos

1. Hero:
    - `name`, `date`, `backgroundImage`.
2. Location:
    - `venueName`, `address`, `city`.
3. RSVP:
    - `title`, `guestCap`, `confirmationMode`.
4. Itinerary:
    - `title`, `items[]` con `icon`, `label`, `time`.
5. Gallery:
    - `items[]` con `image`.

## Checklist de produccion XV real

1. Confirmar copy 100% en espanol.
2. Validar colores y contraste segun preset elegido.
3. Probar RSVP con `inviteId` real.
4. Verificar responsive mobile/desktop.
5. Revisar `prefers-reduced-motion`.
6. Confirmar links de mapas y WhatsApp.

## Criterios de aceptacion

- Render estable en ruta canonica.
- Sin regresiones entre presets.
- RSVP funcional con limites por invitado.
- Galeria e itinerario sin roturas de layout.
