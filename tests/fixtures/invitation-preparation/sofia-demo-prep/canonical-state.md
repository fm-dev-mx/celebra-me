# Canonical Invitation Preparation State — sofia-demo-prep

> Synthetic verification fixture for the invitation-preparation workflow.  
> Schema: `docs/core/invitation-preparation-contract.md`

## Identity

| Parameter | Value |
| --------- | ----- |
| **Slug** | `sofia-demo-prep` |
| **Event Type** | `xv` |
| **Preparation Status** | `READY_WITH_PLACEHOLDERS` |

**Preparation Readiness:** `READY_WITH_PLACEHOLDERS`

## Sources

| Source | Reference | Notes |
| ------ | --------- | ----- |
| WhatsApp / conversation | `tests/fixtures/invitation-preparation/sofia-demo-prep/whatsapp-excerpt.md` | Facts only |
| Photograph / assets root | `tests/fixtures/invitation-preparation/sofia-demo-prep/assets` | Required path |
| Other | `tests/fixtures/invitation-preparation/sofia-demo-prep/asset-inventory.md` | Inventory notes |

## Fact Register

| field | value | classification | source | notes |
| ----- | ----- | -------------- | ------ | ----- |
| slug | sofia-demo-prep | verified | owner |  |
| celebrantName | Sofía Martínez | verified | whatsapp-excerpt | Explicit client statement |
| eventLabel | Mis XV Años | inferred | event-type-default | Client said XV; label inferred for prep |
| eventDate | 2026-11-14 | verified | whatsapp-excerpt |  |
| eventTime | 5:00 PM | verified | whatsapp-excerpt |  |
| timeZone | America/Mexico_City | inferred | mx-practice | Not stated by client |
| baseDemoId | demo-xv-jewelry-box | verified | owner-decision-pack | Approved after recommendation |
| sourceAssetPath | tests/fixtures/invitation-preparation/sofia-demo-prep/assets | verified | owner |  |
| sectionOrder | quote,family,countdown,location,itinerary,gallery,rsvp,thankYou | inferred | demo-xv-jewelry-box defaults |  |
| primaryVenueName | Salón Las Palmas | verified | whatsapp-excerpt |  |
| primaryVenueAddress | Av. Reforma 100, CDMX | verified | whatsapp-excerpt |  |
| distinctVenues | false | verified | whatsapp-excerpt | Same venue |
| rsvpConfirmationMode | both | verified | whatsapp-excerpt |  |
| rsvpGuestCap | 4 | verified | whatsapp-excerpt |  |
| rsvpWhatsappPhone | 5215512345678 | verified | whatsapp-excerpt | Normalized from 55 1234 5678 |
| dressCode | [[PENDIENTE:DRESS_CODE]] | missing |  | Non-blocking placeholder |
| musicUrl | — | not_applicable | whatsapp-excerpt | Client declined music |
| clientColors | — | missing |  | Recommendation only |

## Event Completeness

Contract maturity: `evidence-backed` (`xv`)

### Missing blockers

- None after owner approved `baseDemoId`.

### Non-blocking gaps

- `dressCode` → `[[PENDIENTE:DRESS_CODE]]`

**Is the available information sufficient to prepare this invitation?** `yes`

## Placeholders

| token | missing datum | blocking | reason | replacement requirement |
| ----- | ------------- | -------- | ------ | ----------------------- |
| `[[PENDIENTE:DRESS_CODE]]` | dressCode | no | Client has not defined dress code | Replace with verified client dress code or omit section copy |

## Owner Decisions

Resolved in a single pack (see test scenario):

| id | category | issue | evidence | options | recommendation |
| -- | -------- | ----- | -------- | ------- | -------------- |
| baseDemoId | demo-design-decisions | No demo selected | WhatsApp: “Todavía no” | jewelry-box / editorial / enchanted-rose | demo-xv-jewelry-box |
| hero-originals | photograph-acceptance | Only WhatsApp-compressed photos | asset-inventory.md | wait for studio / proceed provisional | proceed provisional for Local only |

## Agent Recommendations

| topic | recommendation | basis | status |
| ----- | -------------- | ----- | ------ |
| demo | `demo-xv-jewelry-box` | XV + default sections + asset count | accepted by owner |
| palette | Jewelry-box ivory/gold defaults | No client colors stated | pending visual implement review |

## Sections

| bucket | section keys |
| ------ | ------------ |
| requested | location, rsvp, gallery |
| inferred / recommended | quote, family, countdown, itinerary, thankYou |
| omitted | music, gifts |
| unresolved | — |

## Design Direction

| decision | value | classification |
| -------- | ----- | -------------- |
| Client-selected demo | — | missing (initially) |
| Recommended demo alternatives | jewelry-box, editorial, enchanted-rose | recommendation only |
| Selected variant / visual profile | demo-xv-jewelry-box / pending profile | verified (demo) |
| Client color requirements | — | missing |
| Recommended palette | ivory + soft gold | recommendation only |
| Unresolved visual decisions | profile SCSS essence | requires_owner_decision |

## Photograph Inventory

See `asset-inventory.md`. All current files are `provisional-whatsapp`. Originals not yet received.

## Implementation Constraints

- Preparation readiness is `READY_WITH_PLACEHOLDERS` — Local implementation may begin; production
  publish still requires studio originals and technical readiness gates.
- Music intentionally omitted.
- Do not treat WhatsApp images as production-authoritative.

## Preparation Readiness History

| date | readiness | notes |
| ---- | --------- | ----- |
| 2026-07-28 | `NOT_READY` | Demo decision unresolved |
| 2026-07-28 | `READY_WITH_PLACEHOLDERS` | Owner approved demo; dressCode placeholder retained |
