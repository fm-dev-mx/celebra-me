---
name: celebra-me
kind: brand-brief
status: active
version: 1.0.0
last_reviewed: 2026-10-09
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

| Event                 | Routable demos                                                                             | Notes                       |
| --------------------- | ------------------------------------------------------------------------------------------ | --------------------------- |
| XV Años (Quinceañera) | `demo-xv-editorial`, `demo-xv-enchanted-rose`, `demo-xv-celestial-blue`, `demo-xv-seaside` | Most premium tier           |
| Wedding (Boda)        | `demo-boda-jewelry-box-wedding`                                                            | Jewelry Box, editorial look |
| Birthday (Cumpleaños) | `demo-cumple-luxury-hacienda`                                                              | Varies by age/segment       |
| Baptism (Bautizo)     | `demo-bautismo-angelic-presence`                                                           | Included in platform        |
| Primera Comunión      | `demo-primera-comunion-illustrated`                                                        | Illustrated, gentle         |

Baby shower is a supported event type without a routable demo. Demos hold fictitious showcase
content only (`src/content/event-demos/`); real client invitations are never demo examples.

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

- Invitations use real client photography; derivatives follow the asset rules in
  `docs/core/invitation-preparation-contract.md`
- Prefer warm lighting, natural skin texture, and elegant composition
- Avoid plastic-looking skin, overly saturated colors, and cartoon styles

## Key URLs

- **Production**: https://celebra-me.com
- **Repository**: https://github.com/fm-dev-mx/celebra-me
- **Docs**: `docs/core/`, `docs/domains/` in repository

## Related Files

- `.agent/templates/creative/` — design reference brief and creative QA report templates
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
