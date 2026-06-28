---
title: Valentina Hernández XV — Source-of-Truth Audit & Corrections
status: in-progress
created: 2026-06-27
updated: 2026-06-27
supersedes:
  - .agent/plans/active/valentina-editorial-magazine-real-invitation.spec.md
related_plans:
  - .agent/plans/active/xv-valentina-hernandez-db-payload.json
  - .agent/plans/active/xv-valentina-hernandez-asset-report.md
related_rules:
  - .agent/rules/invitation-production.md
  - .agent/rules/manual-sql-manifest.md
---

# Valentina Hernández XV — Source-of-Truth Audit & Corrections

## Source of Truth

Client data provided as the canonical reference for this audit. All corrections below are based on
this data.

### Event Main Data

| Field             | Client Value                                                      |
| ----------------- | ----------------------------------------------------------------- |
| Event type        | XV años                                                           |
| Celebrant         | Valentina Hernandez Almaguer                                      |
| Date              | 29 de Agosto del 2026                                             |
| Parents           | Maria Estrella Almaguer Casarreal y Juan Carlos Hernandez Calixco |
| Parents phrase    | Gracias por darme la vida y tanto amor                            |
| Godparents        | Nayeli Almaguer Casarreal y Cesar A. Perez Monroy                 |
| Godparents phrase | Gracias por guiar mis pasos                                       |

### Location & Itinerary

| Field                | Client Value                                                                        |
| -------------------- | ----------------------------------------------------------------------------------- |
| Venue                | Finca Las Palmas                                                                    |
| Address              | 4ta Cerrada de Palma s/n San Luis Huexotla Texcoco Mex                              |
| Ceremony / Misa      | 3:45 pm                                                                             |
| Reception / Cocktail | 4:30 pm                                                                             |
| Punctuality note     | Agradecemos su puntualidad para disfrutar juntos de cada momento magico de la noche |

### Guest Information

| Field           | Client Value                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Dress code      | Formal                                                                                                                   |
| Dress code text | Quiero que te veas INCREIBLE. Damas: Divinas (Reserva el color rosa y lila para la XV). Caballeros: Guapos               |
| Gift intro      | Su presencia es mi mejor regalo, pero si desean tener un detalle conmigo, les comparto estas opciones                    |
| Gift option 1   | Regalo Sorpresa                                                                                                          |
| Gift option 2   | Lluvia de Sobres (se proporcionara un sobre el dia del evento)                                                           |
| Gift option 3   | Mesa en Liverpool (520 20 257 — VALENS DREAM TEAM)                                                                       |
| RSVP phone      | 55 1832 39 34                                                                                                            |
| RSVP text       | Por favor, confirma tu asistencia enviandome un mensaje directo. ¡Me encantara saber que vienes!                         |
| Instagram       | @val27_0811                                                                                                              |
| Instagram text  | Comparte tus mejores fotos y videos de la fiesta etiquetandome... ¡Me encantara ver la celebracion desde tu perspectiva! |

### Additional Phrases

1. Dicen que la moda es temporal, pero los recuerdos son eternos. Acompañame a escribir el primer
   capitulo de mi nueva historia...
2. Preparate para una noche llena de magia sueños y mucha diversion.
3. Brillar es la actitud. Que la alegria de este dia sea el inicio de un futuro lleno de luz, magia
   y momentos inolvidables.

### Technical Requirements

- Theme: Editorial/magazine style
- Images: From Fotos Valeria.pdf (16-page file) — **note: named "Valeria" not "Valentina"**
- Tickets/passes: per-guest pass counts (4-person, 2-person)
- Music: Can't Stop The Feeling! — Justin Timberlake
- Budget: $499
- Delivery: Friday afternoon (client makes payment transfer)

## Discrepancies Found

### ⚠️ Category A — Missing Data (schema supports it)

| #   | Section                      | Issue                                                         | Payload Current                                | Client Required                                                                                       | Action                                |
| --- | ---------------------------- | ------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------- |
| A1  | family.parents               | **Missing entirely**                                          | Not present                                    | father: "Juan Carlos Hernández Calixco", mother: "María Estrella Almaguer Casarreal"                  | Add parents block                     |
| A2  | family.godparents            | **Missing Nayeli**                                            | Only César A. Pérez Monroy as Padrino          | Nayeli Almaguer Casarreal = Madrina, César A. Pérez Monroy = Padrino                                  | Add both godparents                   |
| A3  | family.labels.sectionMessage | **Missing parents/godparents phrases**                        | Generic "Con la bendición..." message          | Parents: "Gracias por darme la vida y tanto amor"; Godparents: "Gracias por guiar mis pasos"          | Update sectionMessage                 |
| A4  | location.ceremony            | **Missing ceremony venue**                                    | Not present                                    | Ceremony at 3:45 pm (likely Finca Las Palmas — needs confirmation)                                    | Add ceremony venue                    |
| A5  | gifts.items                  | **Missing Liverpool store** and **Missing "Regalo Sorpresa"** | Only "Lluvia de sobres" (cash) with wrong text | 3 items: Regalo Sorpresa, Lluvia de Sobres (with correct text), Mesa en Liverpool (registry 52020257) | Add missing items, fix text           |
| A6  | rsvp.whatsappConfig          | **Missing WhatsApp phone**                                    | Not present                                    | Phone: 55 1832 39 34 for direct message RSVP                                                          | Add WhatsApp config                   |
| A7  | location.indications         | **Missing Instagram**                                         | Not present                                    | @val27_0811 with share text                                                                           | Add as indication                     |
| A8  | location.indications         | **Missing "Preparate" phrase**                                | Not present                                    | "Preparate para una noche llena de magia sueños y mucha diversion"                                    | Add as indication                     |
| A9  | music                        | **Missing music config**                                      | Not present                                    | "Can't Stop The Feeling!" — Justin Timberlake                                                         | Blocked: no direct audio URL provided |

### ⚠️ Category B — Incorrect Data

| #   | Section                      | Issue                        | Payload Current                                                                                                                   | Client Required                                                                                                                                                                                                   | Action                   |
| --- | ---------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| B1  | gifts.subtitle               | **Wrong intro text**         | "Su presencia es mi mejor regalo. Si desean tener un detalle adicional, habrá un espacio especial para sobres el día del evento." | "Su presencia es mi mejor regalo, pero si desean tener un detalle conmigo, les comparto estas opciones"                                                                                                           | Fix subtitle             |
| B2  | gifts.items[0].text          | **Wrong "Lluvia" text**      | "Gracias por acompañarme con tanto cariño en esta noche tan especial."                                                            | "Se proporcionará un sobre el día del evento."                                                                                                                                                                    | Fix text                 |
| B3  | location.indications[0].text | **Incomplete dress code**    | "Código de vestimenta: **formal**. El color **rosa y lila** están reservados para la quinceañera."                                | "Quiero que te veas INCREIBLE. Damas: Divinas (Reserva el color rosa y lila para la XV). Caballeros: Guapos" — plus "Código de vestimenta: formal"                                                                | Add full dress code text |
| B4  | rsvp.subcopy                 | **Missing WhatsApp mention** | "Confirma tu asistencia desde esta invitación. Me encantará saber que vienes."                                                    | "Por favor, confirma tu asistencia enviándome un mensaje directo. ¡Me encantará saber que vienes!"                                                                                                                | Update subcopy           |
| B5  | rsvp.confirmationMode        | **API-only, no WhatsApp**    | "api"                                                                                                                             | Client wants direct message RSVP (phone provided)                                                                                                                                                                 | Change to "both"         |
| B6  | gallery.subtitle             | **Missing phrase**           | "Un recorrido visual por la magia de esta celebración única."                                                                     | "Brillar es la actitud. Que la alegría de este día sea el inicio de un futuro lleno de luz, magia y momentos inolvidables." — The 2nd sentence is already in thankYou, but the gallery subtitle could be enhanced | Update gallery subtitle  |

### ⚠️ Category C — Observation Only (no change)

| #   | Section            | Observation                                                                                                                              | Status                                                            |
| --- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| C1  | Images             | Source file named "Fotos **Valeria**.pdf" but celebrant is **Valentina**. Record as naming inconsistency.                                | No action: images are actual client photos regardless of PDF name |
| C2  | Names              | Client source has no accents ("Valentina Hernandez"). Payload uses accents ("Hernández"). Project rule says polished Spanish accents OK. | ✅ Use accented versions for UI text                              |
| C3  | Phone format       | Client: "55 1832 39 34". In WhatsApp format: +5215518323934 or 525518323934                                                              | Verify with client if +52 prefix is correct                       |
| C4  | Liverpool registry | Client: "520 20 257". With spaces removed: "52020257" — matches spec expectation.                                                        | ✅ Use without spaces: 52020257                                   |

### Category D — Client Confirmation Required

| #   | Item               | Question                                                                                                          |
| --- | ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| D1  | Ceremony venue     | Is the 3:45 PM religious ceremony at Finca Las Palmas or a different church/venue?                                |
| D2  | Google Maps links  | Need Google Maps URL for Finca Las Palmas and/or ceremony venue                                                   |
| D3  | Liverpool registry | Verify registry 52020257 at https://mesaderegalos.liverpool.com.mx/milistaderegalos/52020257                      |
| D4  | Music audio file   | Need direct MP3/audio URL for "Can't Stop The Feeling!" — YouTube/Spotify links won't work with `<audio>` element |
| D5  | Instagram handle   | Confirm @val27_0811 is active and publicly accessible                                                             |
| D6  | Original photos    | Request originals via WeTransfer to soporte@celebra-me.com                                                        |
| D7  | RSVP deadline      | Confirm RSVP deadline date for location indications                                                               |

## Corrections Applied

See `.agent/plans/active/xv-valentina-hernandez-db-payload.json` and
`scripts/manual/production-patches/20260626_valentina_hernandez_xv.sql` for updated content.

### Files Modified

1. `.agent/plans/active/xv-valentina-hernandez-db-payload.json`
2. `scripts/manual/production-patches/20260626_valentina_hernandez_xv.sql`

### Validation

- [ ] `pnpm build` passes
- [ ] Payload test passes: `pnpm test tests/content/valentina-hernandez-payload.test.ts`
- [ ] SQL embedded payload matches canonical payload

## Remaining Risks

1. **Music** — Blocked on client-provided audio URL. Cannot use YouTube/Spotify links with `<audio>`
   element.
2. **Ceremony venue** — Assumed same as reception (Finca Las Palmas) pending client confirmation.
3. **Instagram** — Added as location indication (best available option given no dedicated social
   section).
4. **"Regalo Sorpresa"** — Implemented as `cash` type (schema has no "surprise" gift type).
5. **Photo quality** — All images are WhatsApp-compressed JPEGs (~47–85 KB). Send production quality
   is blocked until originals arrive.
6. **Client delivery** — Expected Friday afternoon for payment transfer. This blocks production
   deployment.
