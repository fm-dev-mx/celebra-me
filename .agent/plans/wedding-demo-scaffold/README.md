# Wedding Demo Scaffold Implementation Plan

This plan outlines the creation of a high-end **Wedding Demo** for Celebra-me, leveraging the
architectural foundations of the existing birthday and XV demos while introducing wedding-specific
enhancements.

## 1. Vision & Design Goals

The Wedding Demo aims to showcase the platform's capability for sophisticated, romantic, and
large-scale events.

- **Aesthetic**: "Jewelry Box" evolved into a bridal context (Ethereal, Romantic, Premium).
- **Core Narrative**: A journey of two names becoming one, celebrating family legacy from both
  sides.
- **Key Experience**: A fluid transition through Ceremony, Reception, and personalized memories.

## 2. Structural Analysis (vs. Birthday Demo)

| Section       | Reusability | Wedding-Specific Adaptation                                                        |
| :------------ | :---------- | :--------------------------------------------------------------------------------- |
| **Hero**      | High        | Support for dual names (Bride & Groom) and romantic labels.                        |
| **Location**  | Mid         | Strict separation of Religious/Civil Ceremony and Reception.                       |
| **Family**    | Low         | Needs transformation to support multiple family groups (Parents of Bride & Groom). |
| **Itinerary** | High        | Wedding-centric icons (church, ring, first dance).                                 |
| **RSVP**      | High        | Specialized dietary restriction fields and multi-guest management.                 |
| **Gifts**     | Mid         | Integration of multiple registries and "Soibres" display.                          |

## 3. New Features proposed

1. **Dual-Group Family Component**: Refactored `Family.astro` to handle asymmetrical roles and
   multiple parent sets.
2. **Padrinos (Godparents) Elite**: A more prominent display for spiritual mentors.
3. **Dress Code Modal/Detail**: Enhanced visual cues for specific wedding formal levels.
4. **Jewelry-Box Wedding Theme**: A specialized color preset following the 3-Layer Color
   Architecture.

## 4. Decoupling Strategy

- All new styles will be scoped via `[data-variant="wedding"]` or specific theme classes.
- Shared components will be refactored with backward-compatible props.
- No modifications to existing `demo-cumple.json` or `demo-xv.json`.

## 5. Governance

- **Language**: Documentation in English. Content in Spanish.
- **Coding Standards**: Strict adherence to TypeScript and Astro best practices.
- **Design**: Jewelry Box aesthetic (Pinyon Script, EB Garamond, Soft Creams & Gold).
