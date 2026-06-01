# Editor interno de invitaciones

## Resumen

Se reemplazó el wizard genérico de captura que aparecía dentro de la ruta interna:

```text
/dashboard/invitaciones/[id]/editar
```

La ruta ahora renderiza un editor administrativo dedicado, organizado por secciones. El objetivo es
que producción pueda consultar y editar el contenido normalizado de una invitación sin modificar la
captura histórica del cliente y sin publicar cambios incompletos accidentalmente.

La implementación mantiene intacto el comportamiento público de captura y conserva estable la
invitación publicada hasta que un administrador ejecute explícitamente `Publicar cambios`.

## Decisión de arquitectura

El editor interno utiliza estas fuentes de datos:

| Capa                                     | Responsabilidad                                                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `invitations`                            | Metadatos administrativos: título, slug, cliente, estado y recepción de fotos.                      |
| `intake_requests` y `intake_submissions` | Captura histórica del cliente o del wizard interno anterior. No se reescribe desde el nuevo editor. |
| `invitation_content_drafts.content`      | Fuente de verdad editable para producción.                                                          |
| `published_invitation_content.content`   | Snapshot público estable. Solo cambia al republicar.                                                |
| `events`                                 | Evento RSVP independiente: invitados, códigos, asistencia y estado operativo.                       |

El guardado de una sección actualiza únicamente el borrador normalizado. No modifica el snapshot
público ni las respuestas RSVP.

## Hidratación de borradores anteriores

Algunas invitaciones publicadas, como Ayrin Samantha, tienen borradores aprobados creados antes de
que galería, programa y orden de secciones fueran editables desde producción.

El servicio `invitation-editor.service.ts` construye el contenido efectivo usando esta precedencia:

1. Borrador existente.
2. Snapshot público actual para secciones editables faltantes.
3. Contenido demo de la plantilla para valores todavía ausentes.

Actualmente se hidratan:

- `gallery`
- `itinerary`
- `sectionOrder`

La hidratación sirve para mostrar datos completos en el editor. No escribe automáticamente en base
de datos: el contenido heredado se persiste cuando se guarda una sección o se publica una revisión.

## Experiencia de edición

El nuevo editor React se encuentra en:

```text
src/components/dashboard/intake/editor/InvitationEditor.tsx
```

Incluye:

- Encabezado sticky con título, estado de revisión, `Vista previa` y `Publicar cambios`.
- Navegación lateral en escritorio y navegación horizontal compacta en pantallas estrechas.
- Tarjetas independientes por sección.
- Indicador visible de cambios sin guardar.
- Guardado pesimista por sección.
- Mensajes inline de éxito y error.
- Advertencia nativa del navegador al salir con cambios sin guardar.
- Controles operables con teclado.
- Diseño responsive integrado con los estilos del dashboard.

### Secciones disponibles

1. `Datos de la invitación`
2. `Datos principales`
3. `Personas principales`
4. `Fecha y ubicaciones`
5. `Programa`
6. `Confirmación de asistencia`
7. `Música`
8. `Mesa de regalos`
9. `Mensajes especiales`
10. `Galería`
11. `Notas de fotografías`
12. `Publicación`

## Guardado parcial y concurrencia

Cada tarjeta guarda únicamente su sección mediante:

```text
PATCH /api/dashboard/intake/[id]/editor/sections/[section]
```

Payload:

```ts
{
  expectedUpdatedAt: string;
  value: unknown;
}
```

El repositorio ejecuta un `PATCH` condicional filtrando por:

```text
id = draftId
updated_at = expectedUpdatedAt
```

Si otra persona guardó primero, Supabase devuelve cero filas y el servicio responde con
`409 conflict`. El editor conserva los valores locales para que el administrador pueda recargar
datos y decidir cómo continuar.

Los metadatos usan el mismo patrón mediante:

```text
PATCH /api/dashboard/intake/[id]/editor/metadata
```

El slug se valida antes del guardado y se rechaza si ya pertenece a otra invitación.

## Publicación explícita

Guardar una sección no modifica la invitación pública.

La publicación se realiza mediante:

```text
POST /api/dashboard/intake/[id]/editor/publish
```

Antes de cualquier escritura pública o sincronización RSVP:

1. Se genera el contenido publicado con `mapDraftToPublished()`.
2. Se normaliza la fecha principal a ISO datetime cuando el borrador contiene una fecha simple o un
   valor `datetime-local`.
3. Se valida el snapshot completo con `eventContentSchema`.
4. Si hay datos incompletos o inválidos, se devuelve `422` incluyendo las rutas problemáticas.
5. Si la validación pasa, se sincroniza RSVP cuando aplica.
6. Se actualiza `published_invitation_content`.
7. Se incrementa la versión pública.
8. El borrador pasa a estado `approved`.

También se corrigió el mapper para:

- Preferir galería y programa editados en el borrador.
- Conservar galería y programa demo cuando todavía no existen en el borrador.
- Preservar familia y ubicaciones demo cuando no hay reemplazo normalizado.
- Mapear el teléfono RSVP a `whatsappConfig.phone`, compatible con el esquema público.

## Galería

El componente:

```text
src/components/dashboard/intake/editor/GalleryEditor.tsx
```

permite:

- Ver miniaturas de todas las fotografías.
- Editar el título y subtítulo de la galería.
- Editar el pie de foto de cada imagen.
- Editar el punto focal CSS de cada imagen.
- Reordenar fotografías con botones `Subir` y `Bajar`.

El guardado de galería es atómico: orden, captions y puntos focales se envían como una sola sección.
No existen escrituras parciales independientes para elementos individuales.

## Programa

El componente:

```text
src/components/dashboard/intake/editor/ItineraryEditor.tsx
```

permite:

- Editar título y subtítulo.
- Agregar y eliminar actividades.
- Editar actividad, horario, descripción e icono.
- Reordenar actividades con botones accesibles.

## RSVP

Los textos de presentación RSVP se editan dentro del borrador:

- Título.
- Máximo de acompañantes.
- Mensaje de confirmación.
- Modo de confirmación.
- Teléfono de WhatsApp.
- Texto secundario.

Los invitados, códigos, confirmaciones y asistencia siguen almacenados en las tablas RSVP separadas.

El editor muestra el estado de vinculación con `events`:

| Estado                | Significado                                                |
| --------------------- | ---------------------------------------------------------- |
| `linked`              | El evento ya está relacionado con `invitation_project_id`. |
| `unlinked_slug_match` | Existe un evento con el mismo slug pero falta vincularlo.  |
| `missing`             | No se encontró evento relacionado.                         |

Para reparar de forma explícita el caso `unlinked_slug_match` se añadió:

```text
POST /api/dashboard/intake/[id]/editor/reconcile-rsvp
```

La reconciliación verifica slug y tipo de evento antes de actualizar `events.invitation_project_id`.

## Endpoints añadidos

| Método  | Ruta                                                   | Uso                                            |
| ------- | ------------------------------------------------------ | ---------------------------------------------- |
| `GET`   | `/api/dashboard/intake/[id]/editor`                    | Cargar contexto efectivo del editor.           |
| `PATCH` | `/api/dashboard/intake/[id]/editor/metadata`           | Guardar metadatos con control de concurrencia. |
| `PATCH` | `/api/dashboard/intake/[id]/editor/sections/[section]` | Guardar una sección del borrador.              |
| `POST`  | `/api/dashboard/intake/[id]/editor/publish`            | Validar y publicar una revisión.               |
| `POST`  | `/api/dashboard/intake/[id]/editor/reconcile-rsvp`     | Vincular un evento RSVP compatible.            |

Todos reutilizan:

- Sesión administrativa fuerte.
- Protección CSRF.
- Rate limiting administrativo.
- Acceso Supabase con service role exclusivamente en servidor.

El endpoint anterior:

```text
/api/dashboard/intake/[id]/edit
```

se conserva para compatibilidad, pero la ruta `/editar` ya no renderiza el wizard interno.

## Validación

Se añadió:

```text
src/lib/intake/schemas/invitation-editor.schema.ts
```

La validación incluye:

- Textos con trim y límites máximos.
- URL válida o vacía.
- Email válido o vacío.
- Slug con minúsculas, números y guiones intermedios.
- Capacidad RSVP entera entre 1 y 20.
- WhatsApp obligatorio cuando el modo RSVP lo requiere.
- Iconos permitidos para programa.
- Referencias de assets válidas.
- Puntos focales compatibles con posiciones CSS.
- Arrays completos para galería, programa y orden público.
- Validación completa del snapshot antes de publicar.

## Archivos principales

### Servidor

```text
src/lib/intake/editor-api.ts
src/lib/intake/services/invitation-editor.service.ts
src/lib/intake/schemas/invitation-editor.schema.ts
src/lib/intake/schemas/invitation-content-draft.schema.ts
src/lib/intake/mappers/draft-to-published.mapper.ts
src/lib/intake/repositories/invitation-content-draft.repository.ts
src/lib/intake/repositories/invitation.repository.ts
src/lib/intake/services/publishing.service.ts
```

### API

```text
src/pages/api/dashboard/intake/[id]/editor.ts
src/pages/api/dashboard/intake/[id]/editor/metadata.ts
src/pages/api/dashboard/intake/[id]/editor/sections/[section].ts
src/pages/api/dashboard/intake/[id]/editor/publish.ts
src/pages/api/dashboard/intake/[id]/editor/reconcile-rsvp.ts
```

### Cliente

```text
src/pages/dashboard/invitaciones/[id]/editar.astro
src/hooks/use-invitation-editor.ts
src/lib/dashboard/admin-api.ts
src/lib/dashboard/dto/intake.ts
src/components/dashboard/intake/editor/InvitationEditor.tsx
src/components/dashboard/intake/editor/MetadataSection.tsx
src/components/dashboard/intake/editor/GalleryEditor.tsx
src/components/dashboard/intake/editor/ItineraryEditor.tsx
src/components/dashboard/intake/editor/PublicationSection.tsx
src/styles/dashboard/_intake.scss
```

### Pruebas

```text
tests/unit/invitation-editor.service.test.ts
tests/unit/draft-to-published.mapper.test.ts
tests/unit/publishing.service.test.ts
tests/components/InvitationEditor.test.tsx
tests/components/GalleryEditor.test.tsx
```

## Base de datos

No se añadió ninguna migración.

La implementación reutiliza:

- `invitation_content_drafts.content` JSONB para galería y programa.
- `published_invitation_content.content` JSONB para snapshots públicos.
- `updated_at` para concurrencia optimista.
- `events.invitation_project_id` para reconciliación RSVP.

## Verificación realizada

Se ejecutó:

```bash
pnpm test -- tests/unit/invitation-editor.service.test.ts \
  tests/components/InvitationEditor.test.tsx \
  tests/components/GalleryEditor.test.tsx \
  tests/unit/draft-to-published.mapper.test.ts \
  tests/unit/draft-update.service.test.ts \
  tests/unit/publishing.service.test.ts \
  --runInBand

pnpm type-check
pnpm lint
pnpm exec stylelint src/styles/dashboard/_intake.scss
pnpm build
git diff --check
```

Resultado:

- `62/62` pruebas enfocadas pasaron.
- TypeScript/Astro pasó con `0 errors`, `0 warnings`, `0 hints`.
- ESLint pasó.
- El stylesheet modificado pasó Stylelint.
- El build de Astro con adaptador Vercel pasó.
- `git diff --check` pasó.

También se realizó un smoke test en navegador:

```text
/dashboard/invitaciones/01548214-bc22-4141-ba61-f36c27cd8627/editar
```

Sin sesión administrativa, la ruta redirige correctamente a:

```text
/login
```

## Notas de entorno

El worktree aislado no contiene secretos locales ni credenciales del dashboard. Por esa razón no se
ejecutó una prueba visual autenticada contra los datos reales de Ayrin Samantha.

El repositorio requiere que exista el directorio vacío:

```text
src/content/events
```

Git no conserva directorios vacíos, por lo que se creó localmente dentro del worktree antes de
ejecutar `pnpm build`.

El comando global:

```bash
pnpm lint:styles
```

continúa reportando errores preexistentes en estilos de invitación no modificados por esta
implementación. El archivo editado `src/styles/dashboard/_intake.scss` sí pasa Stylelint de forma
aislada.
