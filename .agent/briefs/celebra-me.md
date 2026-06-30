---
name: celebra-me
kind: brand-brief
status: active
version: 1.0.0
last_reviewed: 2026-06-29
---

# Celebra-me — Brand Brief

> **⚠️ This brief was compiled from project context, codebase analysis, and discovery audit. It is a
> working reference for agents and should be reviewed by the repository owner.**

## What Celebra-me Is

Celebra-me is a **premium digital invitation platform** for social events. It sells a visual,
practical, emotional experience that is easy to share via WhatsApp.

The platform offers:

- Digital invitations with elegant, customizable designs
- RSVP management (guest tracking, confirmations, messages)
- Host dashboard for invitation editing and guest management
- Publishing flow with demo/preview/production states

## Target Audience

- **Primary**: Hispanic families and event hosts in Mexico and Latin America
- **Decision-makers**: Parents of XVañera, engaged couples, new parents, birthday honorees
- **Guests**: Friends and family members who receive and RSVP via WhatsApp
- **Tone expectation**: Formal but warm, respectful, elegant, personal

## Event Types Supported

| Event                 | Demo examples                                 | Notes                         |
| --------------------- | --------------------------------------------- | ----------------------------- |
| XV Años (Quinceañera) | Valentina Hernández, Xareni Iyarit, Ana Sofía | Most premium tier             |
| Wedding (Boda)        | Leah & Lexa (engagement transition)           | Jewelry Box, editorial themes |
| Baby Shower           | Leah & Lexa baby shower                       | Warm, intimate                |
| Birthday (Cumpleaños) | Don Gerardo                                   | Varies by age/segment         |
| Baptism (Bautizo)     | César & Ramsés                                | Included in platform          |

## Visual Identity

- **Style**: Elegant, minimalist, modern, soft romantic palette
- **Typography**: Serif for headings (editorial feel), sans-serif for body
- **Colors**: Soft creams, golds, rose tones, pastels; varies per theme preset
- **Themes**: Preset-based system with section variants (see `docs/domains/theme/`)
- **Imagery**: Professional photography aesthetic, warm natural light, editorial quality
- **Logo**: Minimalist, lowercase "celebra-me.com" with champagne glasses motif

## Tone & Voice

- **Language**: Spanish (UI copy), English (code, identifiers, technical comments)
- **Register**: Formal "usted" for guests, never "tú" in invitation copy
- **Style**: Formal but warm, elegant without pretension, clear and personal
- **Emotion**: Celebrates connection, family, tradition, and joy

## Content Boundaries

- **Do** create warm, emotional copy that centers the honoree(s) and family
- **Do** use event-appropriate vocabulary (XV, wedding, baby shower, etc.)
- **Don't** use English in invitation copy
- **Don't** use informal register ("tú") in guest-facing text
- **Don't** invent client details — use only provided data
- **Don't** assume religious content unless explicitly stated

## Image and Visual Content

- Invitations use real photography / generated editorial photography
- Image generation should emphasize: warm lighting, natural skin texture, elegant composition
- Preferred models (local ComfyUI): Juggernaut XL v9 for photorealism, Flux Dev fp8 for general
- Avoid: plastic-looking skin, overly saturated colors, cartoon styles
- See `.agent/templates/creative/` for prompt structures

## Key URLs

- **Production**: https://celebra-me.com
- **Repository**: https://github.com/fm-dev-mx/celebra-me
- **Docs**: `docs/core/`, `docs/domains/` in repository

## Related Files

- `.agent/templates/creative/` — prompt and copy templates
- `.agent/skills/copywriting-es/SKILL.md` — Spanish copy guidance
- `docs/core/project-conventions.md` — project-wide conventions
- `docs/core/architecture.md` — architecture reference
- `docs/domains/theme/` — theme preset documentation

---

_This brief is a working document. Update it as the brand evolves._

---

**Note on multi-brand architecture:** Other brands (such as CEJ) are separate from Celebra-me. They
must be handled outside this repository — in a Hermes-level creative workspace or a separate project
repository. Do not create CEJ-specific content, briefs, or skills inside this repository.
