# Canonical Invitation Preparation State — alba-like-provisional

> Synthetic Goal 3 A8 fixture: provisional WhatsApp inventory must evaluate to
> `READY_WITH_PLACEHOLDERS`, never `READY_FOR_IMPLEMENTATION`.

## Identity

| Parameter | Value |
| --------- | ----- |
| **Slug** | `alba-like-provisional` |
| **Host Login Alias** | `alba_like` |
| **Event Type** | `cumple` |
| **Preparation Status** | `READY_WITH_PLACEHOLDERS` |

**Preparation Readiness:** `READY_WITH_PLACEHOLDERS`

Technical envReadiness is out of scope.

## Sources

| Source | Reference | Notes |
| ------ | --------- | ----- |
| WhatsApp / conversation | `source:wa-export` | Evidence only |
| High-res photos / assets root | `source:hr-photos` | Opaque label; session holds URL/path |

## Fact Register

| field | value | classification | source | notes |
| ----- | ----- | -------------- | ------ | ----- |
| slug | alba-like-provisional | verified | owner | |
| celebrantName | Alba Rosa Ejemplo | verified | whatsapp | |
| eventLabel | 70 Años | inferred | age | |
| eventDate | 2026-09-12 | verified | whatsapp | |
| eventTime | 20:00 | verified | whatsapp | |
| timeZone | America/Mexico_City | inferred | mx-practice | |
| baseDemoId | demo-cumple-luxury-hacienda | verified | owner | |
| sourceAssetPath | source:hr-photos | verified | owner | Opaque |
| sectionOrder | hero,location,gallery,gifts,rsvp,thankYou | verified | owner | |
| primaryVenueName | Canta Luna Campestre | verified | owner | |
| primaryVenueAddress | Los Mochis, Sinaloa | verified | owner | |
| rsvpConfirmationMode | api | verified | product | |
| dressCode | Formal | verified | whatsapp | |
| musicUrl | — | not_applicable | — | Omitted |
| gifts | legend-only | verified | whatsapp | |
| clientColors | beige, cream, white | verified | whatsapp | |

## Event Completeness

Contract maturity for this event type: `partial`

### Missing blockers

- None

Deterministic question: **Is the available information sufficient to prepare this invitation?**
Answer: `yes`

## Placeholders

| token | missing datum | blocking | reason | replacement requirement |
| ----- | ------------- | -------- | ------ | ----------------------- |
| — | — | no | No placeholders remain | — |

## Owner Decisions

| id | category | issue | evidence | options | recommendation |
| -- | -------- | ----- | -------- | ------- | -------------- |
| photoProvisionalAccept | photograph-acceptance | Proceed with provisional sources | owner | wait / proceed | proceed with documented provisional |

## Agent Recommendations

| topic | recommendation | basis | status |
| ----- | -------------- | ----- | ------ |
| demo | demo-cumple-luxury-hacienda | Client selection | accepted |

## Sections

| bucket | section keys |
| ------ | ------------ |
| requested | hero, location, gallery, gifts, rsvp, thankYou |
| omitted | music, itinerary |
| unresolved | — |

## Design Direction

| decision | value | classification |
| -------- | ----- | -------------- |
| Client-selected demo | demo-cumple-luxury-hacienda | verified |
| Recommended demo alternatives | — | recommendation only |
| Selected variant / visual profile | luxury-hacienda | verified |
| Client color requirements | beige, cream, white | verified |
| Recommended palette | neutral editorial | recommendation only |
| Unresolved visual decisions | — | not_applicable |

## Photograph Inventory

Source label: `source:hr-photos`

| source filename | dims | format | orientation | weight | quality | role | duplicate | processing | derivative |
| --------------- | ---- | ------ | ----------- | ------ | ------- | ---- | --------- | ---------- | ---------- |
| garden-portrait.jpg | 965×2008 | jpeg | portrait | 180KB | provisional-whatsapp | hero | no | chrome crop | hero-mobile.webp |
| cafe.jpg | 1171×2000 | jpeg | portrait | 118KB | provisional-whatsapp | thank-you | no | top crop | thank-you.webp |
| paris.jpg | 1400×1750 | jpeg | portrait | 200KB | provisional-whatsapp | gallery | no | none | gallery-01.webp |

Quality class: `provisional-whatsapp` — studio originals not yet received.

### Uniqueness table (required before READY_*)

| role | source | derivative | intentional multi-role? |
| ---- | ------ | ---------- | ----------------------- |
| Hero | garden-portrait.jpg | hero-mobile.webp | no |
| Gallery | paris.jpg | gallery-01.webp | no |
| Thank You | cafe.jpg | thank-you.webp | no |

## Implementation Constraints

- prepReadiness is `READY_WITH_PLACEHOLDERS` — provisional assets documented; not
  `READY_FOR_IMPLEMENTATION`.
- Chat attachments were evidence only; HR photo root is the asset source.

## Preparation Readiness History

| date | readiness | helper basis | notes |
| ---- | --------- | ------------ | ----- |
| 2026-07-31 | `READY_WITH_PLACEHOLDERS` | evaluatePreparationReadiness | A8 fixture |
