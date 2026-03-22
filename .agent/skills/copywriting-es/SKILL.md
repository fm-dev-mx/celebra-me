---
name: copywriting-es
description:
    Maintain consistent tone and style for Spanish-language digital invitation copy. Covers
    formal/warm tone, event-specific vocabulary, courtesy formulas, and common UI patterns.
domain: content
when_to_use:
    - Writing or revising visible UI text in Spanish
    - Reviewing invitation copy, labels, helper text, or error messages
preconditions:
    - Read .agent/README.md
    - Read .agent/GATEKEEPER_RULES.md
inputs:
    - User-facing Spanish copy, invitation content, and UI messaging
outputs:
    - Tone-consistent Spanish copy guidance aligned with repository language rules
related_docs:
    - docs/core/project-conventions.md
---

# Copywriting ES

> **Related skills**: [`accessibility`](../accessibility/SKILL.md) for accessible error messages and
> form labels.

This skill guides **Spanish copywriting** for Celebra-me digital invitations. Maintain a formal yet
warm tone appropriate for celebrations and family events.

## Tone Guidelines

### Overall Voice

- **Formal but warm**: Respectful without being cold
- **Elegant**: Sophisticated vocabulary, not pretentious
- **Personal**: Direct address to guests, heartfelt expressions
- **Clear**: Simple sentence structures, avoid ambiguity

### Register

- Use implicit "usted" (formal you) when addressing guests
- Avoid explicit pronouns when possible for elegance
- Never use "tú" in invitation copy

## Event-Specific Vocabulary

### XV Años

| Use                      | Avoid               |
| ------------------------ | ------------------- |
| Quinceañera              | Cumpleañera         |
| Presentación en sociedad | Debut, coming out   |
| Celebración de XV años   | Fiesta de quince    |
| Ceremonia religiosa      | Misa (too informal) |

**Sample phrases**:

- "Tiene el honor de presentar a su hija en sociedad"
- "Celebramos sus XV primaveras"
- "Con la bendición de Dios y el amor de su familia"

### Bodas (Weddings)

| Use                | Avoid                     |
| ------------------ | ------------------------- |
| Matrimonio, enlace | Casamiento, casorio       |
| Ceremonia nupcial  | Boda (in formal contexts) |
| Los novios         | La pareja                 |
| Unir sus vidas     | Casarse                   |

**Sample phrases**:

- "Tienen el honor de invitar a la ceremonia nupcial de..."
- "Unirán sus vidas ante Dios y ante los hombres"
- "Solicitan su grata presencia"

### Bautizos (Baptisms)

| Use                           | Avoid                                        |
| ----------------------------- | -------------------------------------------- |
| Sacramento del Bautismo       | Bautizado                                    |
| Padrinos                      | Madrinas/Padrinos (separately unless needed) |
| Recibir las aguas bautismales | Ser bautizado                                |

**Sample phrases**:

- "Recibirá el Sacramento del Bautismo"
- "Con la gracia de Dios y el amor de sus padrinos"

## Standard Sections

### Opening (Encabezado)

```text
[Nombres de los anfitriones]
tienen el honor de invitar a la celebración de...
```

Or for parents hosting:

```text
[Nombre de los padres]
tienen el placer de anunciar...
```

### Date and Time

- Full date format: "Sábado, 15 de marzo de 2025"
- Time format: "A las 18:00 horas" or "A las seis de la tarde"
- Never use abbreviated months in formal invitations

### Venue

```text
[Nombre del lugar]
[Dirección completa]
[Ciudad, Estado/País]
```

### RSVP Section

- "Se ruega confirmar asistencia antes del [fecha]"
- "Favor de confirmar al [teléfono/correo]"
- "Su confirmación es muy importante para nosotros"

### Closing (Despedida)

**Formal options**:

- "Esperamos contar con su grata presencia"
- "Su compañía será nuestro mejor regalo"
- "Los esperamos con los brazos abiertos"

**Warm options**:

- "Será un honor compartir este momento tan especial con ustedes"
- "No hay regalo más valioso que su presencia"

## UI Labels and Messages

### Form Labels

| English Concept  | Spanish Label          |
| ---------------- | ---------------------- |
| Full Name        | Nombre completo        |
| Email            | Correo electrónico     |
| Phone            | Teléfono               |
| Number of guests | Número de acompañantes |
| Message          | Mensaje o dedicatoria  |
| Submit           | Confirmar asistencia   |

### Confirmation Messages

- Success: "¡Gracias por confirmar! Los esperamos con mucho gusto."
- Error: "Hubo un problema. Por favor, intente nuevamente."
- Already confirmed: "Ya hemos recibido su confirmación. ¡Gracias!"

### Validation Messages

- Required field: "Este campo es obligatorio"
- Invalid email: "Por favor, ingrese un correo electrónico válido"
- Invalid phone: "Por favor, ingrese un número de teléfono válido"
- Max guests exceeded: "El número máximo de acompañantes es [N]"

## Grammar and Style

### Capitalization

- Capitalize: proper names, first word of sentences
- Do NOT capitalize: event types (boda, bautizo), months, days
- Exception: "Quinceañera" may be capitalized as title

### Punctuation

- Use proper Spanish punctuation: ¿? ¡!
- Formal invitations may omit periods after short phrases
- Use em-dash (—) for emphasis or parenthetical information

### Numbers

- Write out numbers in formal contexts: "quince años", "seis de la tarde"
- Use digits for: addresses, phone numbers, specific times with minutes

### Accents

- **Mandatory**: Always use proper accents (á, é, í, ó, ú, ñ, ü)
- Common mistakes to avoid:
    - celebración (not celebracion)
    - cortesía (not cortesia)
    - teléfono (not telefono)

## Anti-patterns (AVOID)

This section documents common mistakes to **avoid** when writing digital invitation copy.

### Incorrect Register

| ❌ Incorrect           | ✅ Correct                         | Reason                      |
| ---------------------- | ---------------------------------- | --------------------------- |
| confirma tu asistencia | confirme su asistencia             | Inappropriate informal "tú" |
| ¿Vienes a la fiesta?   | ¿Nos acompañará en la celebración? | Mixing tú/usted             |
| te esperamos           | los esperamos                      | Informal treatment          |
| no faltes              | esperamos contar con su presencia  | Informal imperative         |

### Formatting Errors

| ❌ Incorrect    | ✅ Correct                     | Reason                  |
| --------------- | ------------------------------ | ----------------------- |
| celebracion     | celebración                    | Missing accent          |
| March 15, 2025  | 15 de marzo de 2025            | Anglo-Saxon date format |
| Ene, Feb, Mar   | enero, febrero, marzo          | Abbreviated months      |
| 6:00 PM         | 18:00 horas / seis de la tarde | Anglo-Saxon time format |
| Sábado 15 Marzo | Sábado, 15 de marzo            | Incorrect punctuation   |

### Inappropriate Tone

| ❌ Avoid            | ✅ Prefer                         | Reason                |
| ------------------- | --------------------------------- | --------------------- |
| ¡Ven a la party! 🎉 | Los esperamos en la celebración   | Emojis and anglicisms |
| Save the date       | Reserve la fecha                  | Unnecessary anglicism |
| ¡No faltes!         | Esperamos contar con su presencia | Too casual            |
| ¡Fiestón!           | Celebración / Recepción           | Colloquial slang      |
| RSVP please         | Favor de confirmar asistencia     | Anglicism             |

### Common Vocabulary Mistakes

| ❌ Incorrect               | ✅ Correct                        | Context              |
| -------------------------- | --------------------------------- | -------------------- |
| Boda de Ana y Carlos       | Ceremonia nupcial de Ana y Carlos | Formal context       |
| Los esperamos en la fiesta | Los esperamos en la recepción     | Appropriate register |
| Cumpleaños de XV años      | Celebración de XV años            | Redundancy           |
| La quinceañera invita      | Tiene el honor de invitar         | Formality            |
| Casamiento                 | Matrimonio / Enlace               | Formal register      |
| El festejo                 | La celebración                    | Elegant tone         |

### Pre-publish Checklist

Before finalizing any invitation copy, verify:

- [ ] No mixing of tú/usted forms
- [ ] All accents are correct
- [ ] Dates use Spanish format (day de month de year)
- [ ] No emojis in formal copy
- [ ] No unnecessary anglicisms
- [ ] Vocabulary matches the required formality level

## Common Phrases Library

### Invitation Headers

- "Con la bendición de Dios..."
- "Tienen el honor de invitar..."
- "Se complacen en anunciar..."
- "Con inmensa alegría..."

### Event Details

- "Ceremonia religiosa"
- "Recepción"
- "Código de vestimenta"
- "Mesa de regalos"

### RSVP

- "Confirmar asistencia"
- "Fecha límite de confirmación"
- "Número de invitados"
- "Restricciones alimentarias"

### Closings

- "Los esperamos"
- "Con cariño"
- "Con amor"
- "Atentamente"

## Checklist de Verificación

Before delivering invitation copy:

- [ ] Formal register maintained (implicit usted, never tuteo)
- [ ] All accents correct (celebración, cortesía, teléfono)
- [ ] Dates in full Spanish format ("Sábado, 15 de marzo de 2025")
- [ ] Vocabulary appropriate to event type (see Use/Avoid tables)
- [ ] RSVP labels use standard terminology
- [ ] Error messages are descriptive and accessible
- [ ] No emojis or anglicisms in formal copy
- [ ] Correct Spanish punctuation (¿? ¡!)
