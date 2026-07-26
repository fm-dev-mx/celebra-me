# Auditoría de copy — Abril Michelle Becerra Rea

| Campo                | Valor                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Invitación**       | `abril-michelle-becerra-rea`                                                                                              |
| **URL auditada**     | `http://localhost:4321/xv/abril-michelle-becerra-rea?skipEnvelope=true`                                                   |
| **Fecha**            | 2026-07-26                                                                                                                |
| **Alcance**          | Solo lectura: sin cambios de código ni de contenido                                                                       |
| **Fuente principal** | Página en vivo + `scripts/provision/invitations/abril-michelle-becerra-rea.ts`                                            |
| **Comparado contra** | Romina (`romina-rios-chaparro.ts`), demos en `src/content/event-demos/**`, template XV, chrome de producto en componentes |

---

## Veredicto

La invitación **sí tiene textos únicos y de buena calidad** en quote, mensaje de familia, subtítulo
de galería, subcopy RSVP y textos de agradecimiento.  
Sin embargo, **varios rótulos y fórmulas estructurales coinciden exactamente** con Romina u otras
demos (sobre todo countdown, heading de ubicación, RSVP title, “Pase de acceso”, “Programa”, “Abra
su invitación”).

Para una pieza de alta gama, el riesgo no está en los datos del evento (nombres, sedes, fechas),
sino en que **la voz editorial se siente compartida** con otras invitaciones del sistema.

### Severidad de duplicados

| Nivel               | Criterio                                                             | Cantidad aproximada         |
| ------------------- | -------------------------------------------------------------------- | --------------------------- |
| **Crítico**         | Copy editorial o de sección idéntico a otra invitación real (Romina) | 5                           |
| **Alto**            | Rótulo configurable idéntico a demos / stock                         | 8+                          |
| **Medio**           | Etiquetas genéricas de itinerario (`Misa`, `Cena`, `Vals`, `Cierre`) | 5                           |
| **Bajo / esperado** | Chrome de producto (nav, mapas, unidades de countdown, footer)       | N/A — compartido por diseño |
| **No aplica**       | Datos de identidad (nombres, direcciones, fechas factuales)          | No deben “alternarse”       |

---

## Cómo leer este reporte

Por cada texto visible o configurable:

1. **Texto actual** — cita exacta.
2. **Tipo** — `identidad` · `editorial` · `rótulo` · `chrome producto` · `accesibilidad (alt)`.
3. **Unicidad** — `único` · `duplicado exacto` · `casi duplicado` · `compartido por diseño`.
4. **Alternativa A / B** — propuestas de alta gama, registro formal (usted), tono cálido y exclusivo
   para Abril.

Las alternativas **no inventan** hechos del cliente. Solo proponen voz, etiquetas y redacción.

---

## 0. Meta, SEO y compartido

### 0.1 Título de página / evento

- **Texto actual:** `XV años de Abril Michelle Becerra Rea`
- **Tipo:** identidad / meta
- **Unicidad:** único (contiene nombre propio)
- **Alternativa A:** `Los XV años de Abril Michelle`
- **Alternativa B:** `Abril Michelle · Presentación de XV años`

### 0.2 Description

- **Texto actual:**
  `Acompáñenos a celebrar los XV años de Abril Michelle Becerra Rea el 12 de septiembre de 2026 en Lagos de Moreno.`
- **Tipo:** editorial / meta
- **Unicidad:** único
- **Alternativa A:**
  `Con gratitud y alegría, Abril Michelle Becerra Rea celebra sus XV años el 12 de septiembre de 2026 en Lagos de Moreno, Jalisco.`
- **Alternativa B:**
  `Le invitamos a acompañar a Abril Michelle en la celebración de sus XV años · 12 de septiembre de 2026 · Lagos de Moreno.`

### 0.3 OG description

- **Texto actual:** `Invitación a los XV años de Abril Michelle Becerra Rea`
- **Tipo:** editorial / meta
- **Unicidad:** patrón cercano a Romina (`Invitación a los XV años de Romina…`) — estructura stock
- **Alternativa A:** `Una invitación especial a los XV años de Abril Michelle`
- **Alternativa B:** `Celebre con Abril Michelle sus XV años en Lagos de Moreno`

### 0.4 WhatsApp template

- **Texto actual:**
  `Hola {name}, le compartimos la invitación para los XV años de Abril Michelle: {inviteUrl}`
- **Tipo:** editorial
- **Unicidad:** patrón cercano a Romina; contenido personalizado
- **Alternativa A:**
  `Hola {name}, con mucho gusto le compartimos la invitación de los XV años de Abril Michelle: {inviteUrl}`
- **Alternativa B:**
  `Estimado/a {name}: aquí encontrará su invitación para celebrar los XV de Abril Michelle → {inviteUrl}`

---

## 1. Envelope (sobre)

> En la URL auditada se usó `skipEnvelope=true`; estos textos existen en la definición y se ven al
> abrir sin ese parámetro.

### 1.1 Card label / Hero label

- **Texto actual:** `MIS XV AÑOS`
- **Tipo:** rótulo
- **Unicidad:** común en XV; Romina usa `MIS XV` (cercano)
- **Alternativa A:** `MIS XV PRIMAVERAS`
- **Alternativa B:** `UNA NOCHE PARA RECORDAR`

### 1.2 Nombre en sobre

- **Texto actual:** `Abril Michelle Becerra Rea`
- **Tipo:** identidad
- **Unicidad:** único
- **Alternativa A:** _(dato fijo — no reemplazar)_
- **Alternativa B:** _(opcional de presentación)_ `Abril Michelle`

### 1.3 Nombre en tarjeta

- **Texto actual:** `Abril Michelle`
- **Tipo:** identidad
- **Unicidad:** único
- **Alternativa A / B:** _(dato fijo)_

### 1.4 Tagline de tarjeta

- **Texto actual:** `12 · 09 · 2026`
- **Tipo:** identidad (fecha)
- **Unicidad:** único por fecha
- **Alternativa A:** `12 · IX · 2026`
- **Alternativa B:** `Lagos de Moreno · 2026`

### 1.5 Microcopy de apertura

- **Texto actual:** `Abra su invitación`
- **Tipo:** rótulo
- **Unicidad:** **duplicado exacto con Romina**
- **Alternativa A:** `Descubra su invitación`
- **Alternativa B:** `Abra con cariño`

### 1.6 Iniciales del sello

- **Texto actual:** `AM`
- **Tipo:** identidad
- **Unicidad:** único
- **Alternativa A / B:** _(dato fijo)_

---

## 2. Navegación (chrome de producto)

Estos labels vienen del sistema (`canonical-navigation`) y se comparten entre invitaciones.
Incluidos por exhaustividad; cambiarlos sería decisión de producto, no solo de Abril.

| Texto actual | Alternativa A | Alternativa B |
| ------------ | ------------- | ------------- |
| `Inicio`     | `Portada`     | `Bienvenida`  |
| `Evento`     | `Lugares`     | `Ceremonia`   |
| `Programa`   | `Momentos`    | `Agenda`      |
| `Galería`    | `Retratos`    | `Recuerdos`   |
| `Confirmar`  | `Asistencia`  | `RSVP`        |

- **Unicidad:** compartido por diseño
- **Nota:** En footer móvil aparece también el enlace `Itinerario` (label de sección del sistema).

---

## 3. Hero

### 3.1 Nombre

- **Texto actual:** `Abril Michelle`
- **Tipo:** identidad
- **Unicidad:** único
- **Alternativa A / B:** _(dato fijo)_ — opcional de presentación: `Abril Michelle Becerra Rea`

### 3.2 Label

- **Texto actual:** `MIS XV AÑOS`
- **Tipo:** rótulo
- **Unicidad:** stock XV (ver 1.1)
- **Alternativa A:** `CELEBRO MIS XV`
- **Alternativa B:** `PRESENTACIÓN EN SOCIEDAD`

### 3.3 Fecha (renderizada)

- **Texto actual:** `12 de septiembre de 2026`
- **Tipo:** identidad
- **Unicidad:** la fecha también aparece en un demo de Primera Comunión (coincidencia factual, no
  copy robado)
- **Alternativa A:** `Sábado 12 de septiembre de 2026`
- **Alternativa B:** `12 · septiembre · 2026`

### 3.4 Hora destacada (hero summary)

- **Texto actual:** `5:00 p. m.`
- **Tipo:** identidad (hora de recepción)
- **Unicidad:** valor también usado en Romina (otra ceremonia); aquí es dato factual
- **Alternativa A / B:** _(dato fijo)_ — si se desea énfasis: `Recepción · 5:00 p. m.`

### 3.5 Lugar destacado

- **Texto actual:** `Garden Palace`
- **Tipo:** identidad
- **Unicidad:** único
- **Alternativa A / B:** _(dato fijo)_

---

## 4. Quote

### 4.1 Texto

- **Texto actual:**
  `Con la bendición de mi familia y la alegría de quienes me acompañan, celebro mis XV años.`
- **Tipo:** editorial
- **Unicidad:** **único** (no aparece en Romina/demos). Estructura cercana a presets de “Con la
  bendición de…”
- **Alternativa A:**
  `Con la luz de mi familia y el cariño de quienes caminan conmigo, celebro con gratitud mis XV años.`
- **Alternativa B:**
  `Hoy, rodeada del amor que me ha formado, abro una nueva etapa y celebro mis XV años.`

### 4.2 Autor

- **Texto actual:** `Abril Michelle`
- **Tipo:** identidad
- **Unicidad:** único
- **Alternativa A / B:** _(dato fijo)_ o firma: `Con cariño, Abril Michelle`

---

## 5. Familia

### 5.1 Subtítulo de sección

- **Texto actual:** `Familia` _(en contenido; puede no destacarse visualmente según tema)_
- **Tipo:** rótulo
- **Unicidad:** **duplicado exacto** (Romina + demos)
- **Alternativa A:** `Quienes me acompañan`
- **Alternativa B:** `Mi círculo de amor`

### 5.2 Título

- **Texto actual:** `Con el amor de mis padres y mis padrinos`
- **Tipo:** editorial
- **Unicidad:** **casi duplicado** de Romina
  (`Con el amor de mis padres y la compañía de mis padrinos`)
- **Alternativa A:** `Guiada por mis padres y bendecida por mis padrinos`
- **Alternativa B:** `El amor de mi casa y el respaldo de mis padrinos`

### 5.3 Mensaje

- **Texto actual:** `Su guía y su cariño acompañan cada paso de esta celebración.`
- **Tipo:** editorial
- **Unicidad:** **único**
- **Alternativa A:** `Su ejemplo y su ternura sostienen cada instante de esta noche.`
- **Alternativa B:** `Gracias a ellos, este día se vive con calma, elegancia y mucho amor.`

### 5.4 Título padres

- **Texto actual:** `Mis padres`
- **Tipo:** rótulo
- **Unicidad:** **duplicado exacto** (Romina + demos)
- **Alternativa A:** `Con el amor de`
- **Alternativa B:** `Mis padres, mi origen`

### 5.5 Título padrinos

- **Texto actual:** `Mis padrinos`
- **Tipo:** rótulo
- **Unicidad:** genérico / común
- **Alternativa A:** `Mis padrinos de honor`
- **Alternativa B:** `Quienes me acompañan como padrinos`

### 5.6 Nombres (identidad — sin alternativas de copy)

| Rol     | Texto actual                       |
| ------- | ---------------------------------- |
| Madre   | `Sandy Guadalupe Rea Mendoza`      |
| Padre   | `José Luis Becerra Ornelas`        |
| Padrina | `María del Carmen Becerra Ornelas` |
| Padrino | `Ramiro Contreras Bermejo`         |

### 5.7 Roles (chrome / defaults de componente)

| Texto actual | Alternativa A                       | Alternativa B             |
| ------------ | ----------------------------------- | ------------------------- |
| `Madre`      | `Mamá` _(más íntimo; menos formal)_ | `Con el amor de mi madre` |
| `Padre`      | `Papá`                              | `Con el amor de mi padre` |

- **Unicidad:** compartido por diseño (defaults `Family.astro`)

---

## 6. Countdown

### 6.1 Título

- **Texto actual:** `LA CELEBRACIÓN COMIENZA EN`
- **Tipo:** rótulo
- **Unicidad:** **duplicado exacto con Romina** (crítico)
- **Alternativa A:** `EL GRAN DÍA SE ACERCA`
- **Alternativa B:** `FALTA POCO PARA MIS XV`

### 6.2 Fecha renderizada del contador

- **Texto actual:** `SÁBADO, 12 DE SEPTIEMBRE DE 2026`
- **Tipo:** identidad (formato de sistema)
- **Unicidad:** único por fecha
- **Alternativa A / B:** _(formato de producto)_ — si se personaliza:
  `SÁBADO 12 · SEPTIEMBRE · 2026`

### 6.3 Footer

- **Texto actual:** `Misa de acción de gracias · 3:00 p. m.`
- **Tipo:** editorial + dato
- **Unicidad:** **casi duplicado** con demos (`Misa de Acción de Gracias`)
- **Alternativa A:** `Acción de gracias · 3:00 p. m.`
- **Alternativa B:** `Ceremonia en La Merced · 3:00 p. m.`

### 6.4 Unidades (chrome)

| Texto actual | Alternativa A       | Alternativa B                      |
| ------------ | ------------------- | ---------------------------------- |
| `Días`       | `Días` _(mantener)_ | `Jornadas` _(demasiado literario)_ |
| `Horas`      | `Horas`             | —                                  |
| `Minutos`    | `Minutos`           | —                                  |
| `Segundos`   | `Segundos`          | —                                  |

- **Recomendación:** conservar unidades estándar; el diferenciador debe ser el título (6.1).

---

## 7. Ubicación

### 7.1 Eyebrow

- **Texto actual:** `SÁBADO · 12 DE SEPTIEMBRE DE 2026`
- **Tipo:** identidad / rótulo
- **Unicidad:** patrón compartido con Romina (`VIERNES · 14 DE AGOSTO…`), valor único
- **Alternativa A:** `LAGOS DE MORENO · 12 · 09 · 2026`
- **Alternativa B:** `UNA TARDE DE SEPTIEMBRE`

### 7.2 Heading

- **Texto actual:** `Ceremonia y recepción`
- **Tipo:** rótulo
- **Unicidad:** **duplicado exacto con Romina** (crítico)
- **Alternativa A:** `Dos momentos, una misma celebración`
- **Alternativa B:** `De la fe al brindis`

### 7.3 Ceremonia — evento

- **Texto actual:** `Misa de acción de gracias`
- **Tipo:** rótulo / factual
- **Unicidad:** casi duplicado con demos (capitalización)
- **Alternativa A:** `Ceremonia de acción de gracias`
- **Alternativa B:** `Eucaristía de acción de gracias`

### 7.4 Ceremonia — sede

- **Texto actual:** `Templo y Ex Convento de Nuestra Señora de la Merced`
- **Tipo:** identidad
- **Unicidad:** único
- **Alternativa A / B:** _(dato fijo)_

### 7.5 Ceremonia — hora / fecha / ciudad / dirección

| Campo     | Texto actual                                                                 |
| --------- | ---------------------------------------------------------------------------- |
| Hora      | `3:00 p. m.`                                                                 |
| Fecha     | `12 de septiembre de 2026`                                                   |
| Ciudad    | `Lagos de Moreno, Jalisco`                                                   |
| Dirección | `Agustín Rivera 433-C, Colonia Centro, C.P. 47400, Lagos de Moreno, Jalisco` |

- **Tipo:** identidad · **Alternativas:** no aplican (datos fijos)

### 7.6 Recepción — evento

- **Texto actual:** `Recepción`
- **Tipo:** rótulo
- **Unicidad:** **duplicado exacto** (Romina / demos / template)
- **Alternativa A:** `Recepción y celebración`
- **Alternativa B:** `Fiesta en Garden Palace`

### 7.7 Recepción — sede / hora / dirección

| Campo     | Texto actual                                                                                 |
| --------- | -------------------------------------------------------------------------------------------- |
| Sede      | `Garden Palace`                                                                              |
| Hora      | `5:00 p. m.`                                                                                 |
| Dirección | `Macedio Ayala núm. 70, Colonia Plan de los Rodríguez, C.P. 47480, Lagos de Moreno, Jalisco` |

- **Tipo:** identidad · **Alternativas:** no aplican

### 7.8 Controles de mapa (chrome)

| Texto actual           | Alternativa A        | Alternativa B      |
| ---------------------- | -------------------- | ------------------ |
| `Copiar dirección`     | `Copiar ubicación`   | `Copiar domicilio` |
| `Apple Maps`           | _(marca — mantener)_ | —                  |
| `Abrir en Google Maps` | `Ver en Google Maps` | `Abrir mapa`       |

- **Unicidad:** compartido por diseño

---

## 8. Itinerario / Programa

### 8.1 Título

- **Texto actual:** `Programa`
- **Tipo:** rótulo
- **Unicidad:** **duplicado exacto** (Romina + demos)
- **Alternativa A:** `Orden del día`
- **Alternativa B:** `Momentos de la celebración`

### 8.2 Ítems

| Hora          | Texto actual | Alternativa A       | Alternativa B             | Unicidad         |
| ------------- | ------------ | ------------------- | ------------------------- | ---------------- |
| `3:00 p. m.`  | `Misa`       | `Acción de gracias` | `Ceremonia`               | genérico / demos |
| `5:00 p. m.`  | `Recepción`  | `Bienvenida`        | `Llegada a Garden Palace` | duplicado stock  |
| `6:00 p. m.`  | `Cena`       | `Cena de gala`      | `Brindis y cena`          | duplicado stock  |
| `7:00 p. m.`  | `Vals`       | `Vals de honor`     | `Primer vals`             | duplicado stock  |
| `12:00 a. m.` | `Cierre`     | `Último baile`      | `Despedida`               | duplicado stock  |

---

## 9. Galería

### 9.1 Eyebrow

- **Texto actual:** `Galería`
- **Tipo:** rótulo
- **Unicidad:** **duplicado exacto** (casi todas las demos). Romina usa `Recuerdos` (mejor
  diferenciado)
- **Alternativa A:** `Recuerdos`
- **Alternativa B:** `En imágenes`

### 9.2 Título

- **Texto actual:** `Abril Michelle`
- **Tipo:** identidad
- **Unicidad:** único
- **Alternativa A:** `Abril en retrato`
- **Alternativa B:** `La protagonista`

### 9.3 Subtítulo

- **Texto actual:** `Retratos de una tarde hecha para recordar`
- **Tipo:** editorial
- **Unicidad:** **único** (buena calidad)
- **Alternativa A:** `Instantes que ya pertenecen a su historia`
- **Alternativa B:** `Luz, elegancia y la emoción de sus XV`

### 9.4 Textos alt (accesibilidad)

| Texto actual                                         | Alternativa A                                              | Alternativa B                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- |
| `Abril Michelle con velas encendidas en forma de 15` | `Abril Michelle frente a velas que forman el número 15`    | `Primer plano de Abril Michelle iluminada por velas del 15`       |
| `Retrato en blanco y negro con el pastel`            | `Abril Michelle en retrato blanco y negro junto al pastel` | `Retrato monocromático de Abril Michelle con su pastel`           |
| `Abril Michelle sentada con globos dorados y pastel` | `Abril Michelle sentada entre globos dorados y su pastel`  | `Composición de estudio: Abril Michelle, globos dorados y pastel` |
| `Abril Michelle con traje blanco y globos 15`        | `Abril Michelle de traje blanco junto a globos del 15`     | `Abril Michelle en traje blanco con globos numerados`             |

**Interludios / assets (alt):**

| Texto actual                                            | Alternativa A                                                 | Alternativa B                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `Corona sobre tela satinada`                            | `Corona de quinceañera sobre seda`                            | `Detalle de corona sobre tela satín`                               |
| `Palacio oriental y lámpara de época`                   | `Fachada de inspiración oriental con lámpara vintage`         | `Arquitectura de ensueño y lámpara de época`                       |
| `Abril Michelle con vestido rosa palo y tiara`          | `Abril Michelle con vestido rosa palo y tiara de quinceañera` | `Retrato de portada: Abril Michelle en rosa y tiara`               |
| `Abril Michelle con vestido rosa palo retrato vertical` | `Retrato vertical de Abril Michelle con vestido rosa palo`    | `Abril Michelle en composición vertical, vestido rosa palo`        |
| `Abril Michelle luciendo tiara y guantes`               | `Abril Michelle con tiara y guantes de gala`                  | `Detalle de Abril Michelle con tiara y guantes`                    |
| `Abril Michelle con vestido rosa y confeti`             | `Abril Michelle entre confeti con vestido rosa`               | `Cierre festivo: Abril Michelle, rosa y confeti`                   |
| `Abril Michelle con vestido blanco, pastel y globos`    | `Abril Michelle de blanco con pastel y globos`                | `Abril Michelle en vestido blanco, pastel de celebración y globos` |

---

## 10. RSVP

### 10.1 Título (contenido)

- **Texto actual:** `Confirme su asistencia`
- **Tipo:** rótulo
- **Unicidad:** **duplicado exacto** (Romina + varias demos) — crítico
- **Alternativa A:** `¿Nos acompaña?`
- **Alternativa B:** `Reserve su lugar en la celebración`

### 10.2 Subcopy (contenido; no visible en modo locked de la URL auditada)

- **Texto actual:** `Reserve su lugar para acompañarnos el 12 de septiembre.`
- **Tipo:** editorial
- **Unicidad:** **único**
- **Alternativa A:**
  `Su confirmación nos permite preparar cada detalle con el cuidado que esta noche merece.`
- **Alternativa B:**
  `Le pedimos confirmar su asistencia para recibirle como se merece el 12 de septiembre.`

### 10.3 Eyebrow visible (chrome)

- **Texto actual:** `RSVP`
- **Tipo:** chrome producto
- **Unicidad:** compartido
- **Alternativa A:** `Asistencia`
- **Alternativa B:** `Confirmación`

### 10.4 Mensaje locked (chrome — visible en la auditoría)

- **Texto actual:** `Las reservas para este evento se gestionan de forma personalizada.`
- **Tipo:** chrome producto
- **Unicidad:** compartido por diseño (`RSVPComponents.tsx`)
- **Alternativa A:**
  `La confirmación de asistencia para esta celebración es personal e intransferible.`
- **Alternativa B:**
  `Este evento cuenta con invitaciones nominativas; la reserva se realiza con su enlace exclusivo.`

### 10.5 Detalle locked (chrome — visible)

- **Texto actual:**
  `Si recibiste tu invitación directa, utiliza el enlace exclusivo que te fue compartido.`
- **Tipo:** chrome producto
- **Unicidad:** compartido
- **Problema de tono:** usa **tú** (`recibiste`, `tu`, `te`), inconsistente con el registro formal
  (usted) de la invitación
- **Alternativa A:**
  `Si recibió su invitación de forma directa, utilice el enlace exclusivo que le fue compartido.`
- **Alternativa B:**
  `Acceda mediante el enlace personal que le enviaron; allí podrá confirmar con facilidad.`

### 10.6 Mensajes de confirmación (contenido; flujo con enlace personalizado)

| Campo                 | Texto actual                                                                     | Alternativa A                                                       | Alternativa B                                                              |
| --------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `confirmationMessage` | `Su confirmación quedó registrada. Nos alegra saber que celebrará con nosotros.` | `Hemos recibido su confirmación. Será un honor celebrar con usted.` | `Su lugar quedó reservado. Gracias por sumarse a esta noche tan especial.` |
| confirmed.title       | `¡Gracias por confirmar, {guestName}!`                                           | `¡Qué alegría contar con usted, {guestName}!`                       | `{guestName}, gracias por confirmar su asistencia`                         |
| confirmed.subtitle    | `Su asistencia ha quedado registrada.`                                           | `Ya tiene su lugar en la celebración.`                              | `Registramos su respuesta con mucho gusto.`                                |
| declined.title        | `Lamentamos que no pueda acompañarnos, {guestName}.`                             | `Sentimos que no pueda estar, {guestName}.`                         | `{guestName}, agradecemos que nos haya avisado`                            |
| declined.subtitle     | `Gracias por avisarnos.`                                                         | `Gracias por informarnos con anticipación.`                         | `Su aviso nos ayuda a preparar mejor la celebración.`                      |

- **Nota:** `Gracias por avisarnos.` también existe como fallback global en `rsvp-logic.ts`.

### 10.7 Personalized access (contenido)

| Campo      | Texto actual                               | Unicidad                    | Alternativa A                                  | Alternativa B                          |
| ---------- | ------------------------------------------ | --------------------------- | ---------------------------------------------- | -------------------------------------- |
| title      | `Pase de acceso`                           | **duplicado exacto Romina** | `Su invitación personal`                       | `Tarjeta de acceso`                    |
| subtitle   | `Invitación especial para:`                | cercano a Romina            | `Preparado con cariño para:`                   | `Esta celebración le espera a:`        |
| footerText | `Confirme su asistencia en el formulario.` | único / genérico            | `Continue abajo para confirmar su asistencia.` | `Un paso más: confirme su asistencia.` |

### 10.8 Calendario

| Campo       | Texto actual                                                                                                                                      | Alternativa A                                                                           | Alternativa B                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| title       | `XV de Abril Michelle`                                                                                                                            | `XV años · Abril Michelle`                                                              | `Celebración de Abril Michelle`                                                                         |
| description | `Recepción de los XV años de Abril Michelle Becerra Rea. Garden Palace, Macedio Ayala núm. 70, Lagos de Moreno, Jalisco. Inicia a las 5:00 p. m.` | `Recepción de los XV de Abril Michelle en Garden Palace · Lagos de Moreno · 5:00 p. m.` | `Acompáñenos a la recepción de Abril Michelle. Garden Palace, Lagos de Moreno. Inicia a las 5:00 p. m.` |

---

## 11. Thank you

### 11.1 Mensaje

- **Texto actual:** `Gracias por acompañarnos en esta celebración.`
- **Tipo:** editorial
- **Unicidad:** **único** (Romina usa otra frase). En UI puede verse con inicial ornamental (`G`
  separada); el copy real es continuo.
- **Alternativa A:** `Gracias por hacer más luminosa esta celebración.`
- **Alternativa B:** `Nuestro corazón agradece su presencia en este día.`

### 11.2 Closing name / fecha

| Campo       | Texto actual               | Notas     |
| ----------- | -------------------------- | --------- |
| closingName | `Abril Michelle`           | identidad |
| date        | `12 de septiembre de 2026` | identidad |

### 11.3 Closing phrase (página)

- **Texto actual:** `Con cariño`
- **Tipo:** chrome / prop de página
- **Unicidad:** compartido en rutas de invitación
- **Alternativa A:** `Con gratitud`
- **Alternativa B:** `Con todo mi cariño`

### 11.4 Branding footer (chrome)

| Texto actual                                                             | Alternativa A                                 | Alternativa B                        |
| ------------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------ |
| `Concierge digital por Celebra-me`                                       | _(marca — mantener)_                          | `Experiencia digital por Celebra-me` |
| `Powered by`                                                             | _(marca EN — mantener o)_ `Con tecnología de` | `Creado con`                         |
| `Volver a ver la apertura del sobre` (aria) / `Volver a ver la apertura` | `Rever la apertura`                           | `Abrir el sobre otra vez`            |

---

## 12. Resumen ejecutivo de priorización

### Prioridad 1 — Cambiar sí o sí (duplicados exactos con Romina u stock fuerte)

1. `Abra su invitación`
2. `LA CELEBRACIÓN COMIENZA EN`
3. `Ceremonia y recepción`
4. `Confirme su asistencia`
5. `Pase de acceso`
6. `Programa` (título de itinerario)
7. `Con el amor de mis padres y mis padrinos` (casi idéntico a Romina)

### Prioridad 2 — Diferenciar rótulos genéricos

1. `Galería` → preferir algo como `Recuerdos` / `En imágenes`
2. `Mis padres` / `Mis padrinos` / `Familia`
3. Ítems de itinerario: `Misa`, `Recepción`, `Cena`, `Vals`, `Cierre`
4. `Misa de acción de gracias` (casi stock de demos)
5. `Recepción` como venueEvent

### Prioridad 3 — Mantener (ya suenan exclusivos o son datos)

- Quote actual (con pulido opcional)
- Mensaje de familia
- Subtítulo de galería
- Subcopy RSVP
- Thank-you message
- Nombres, sedes, direcciones, fechas factuales
- Alts descriptivos (mejoras menores opcionales)

### Prioridad 4 — Producto (no solo Abril)

- Texto locked RSVP en **tú** → corregir a **usted** a nivel de componente
- Nav labels, mapas, unidades de countdown, footer de marca

---

## 13. Paquete sugerido “alta gama” (si se aprueba un solo pase de copy)

Propuesta coherente entre sí (no aplicada; solo recomendación):

| Sección            | Propuesta elegida                                                                      |
| ------------------ | -------------------------------------------------------------------------------------- |
| Envelope microcopy | `Descubra su invitación`                                                               |
| Hero label         | `PRESENTACIÓN EN SOCIEDAD`                                                             |
| Quote              | `Hoy, rodeada del amor que me ha formado, abro una nueva etapa y celebro mis XV años.` |
| Family title       | `Guiada por mis padres y bendecida por mis padrinos`                                   |
| Family message     | `Su ejemplo y su ternura sostienen cada instante de esta noche.`                       |
| Parents title      | `Con el amor de`                                                                       |
| Godparents title   | `Mis padrinos de honor`                                                                |
| Countdown          | `EL GRAN DÍA SE ACERCA`                                                                |
| Countdown footer   | `Ceremonia en La Merced · 3:00 p. m.`                                                  |
| Location heading   | `De la fe al brindis`                                                                  |
| Ceremony event     | `Ceremonia de acción de gracias`                                                       |
| Reception event    | `Recepción y celebración`                                                              |
| Itinerary title    | `Momentos de la celebración`                                                           |
| Itinerary items    | `Acción de gracias` · `Bienvenida` · `Cena de gala` · `Vals de honor` · `Último baile` |
| Gallery eyebrow    | `Recuerdos`                                                                            |
| Gallery subtitle   | _(mantener o)_ `Luz, elegancia y la emoción de sus XV`                                 |
| RSVP title         | `Reserve su lugar en la celebración`                                                   |
| Access title       | `Su invitación personal`                                                               |
| Thank you          | `Gracias por hacer más luminosa esta celebración.`                                     |
| Closing            | `Con gratitud`                                                                         |

---

## 14. Evidencia y límites

- Snapshot de página en vivo con `skipEnvelope=true` (2026-07-26).
- Definición canónica: `scripts/provision/invitations/abril-michelle-becerra-rea.ts`.
- Comparación real: `scripts/provision/invitations/romina-rios-chaparro.ts`.
- No se modificó código, contenido ni estilos.
- No se ejecutó suite de tests (auditoría de copy únicamente).
- El chrome locked de RSVP **sí es visible** en la URL pública auditada; el formulario completo
  requiere enlace personalizado.

---

## 15. Git

No se realizó stage ni commit. Este archivo es un artefacto de auditoría solicitado explícitamente.
`)
