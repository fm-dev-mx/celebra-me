# Valentina Hernández Almaguer — Invitation Record

This is the durable implementation and readiness record for the Valentina Hernández Almaguer XV
invitation. It consolidates the completed editorial implementation passes, client facts, asset
evidence, and remaining delivery constraints that were previously spread across active plans.

The live repository is authoritative where this record and historical plans differ:

- Managed definition (content SSOT):
  [`valentina-hernandez.ts`](../../scripts/provision/invitations/valentina-hernandez.ts)
- Payload contract test:
  [`valentina-hernandez-payload.test.ts`](../../tests/content/valentina-hernandez-payload.test.ts)
- Visual profile:
  [`valentina-hernandez.scss`](../../src/styles/invitation-profiles/valentina-hernandez.scss)
- Asset registry (draft WhatsApp JPEGs until remastered):
  [`index.ts`](../../src/assets/images/events/xv-valentina-hernandez/index.ts)
- Demo-safe visual counterpart:
  [`demo-xv-valentina-profile.json`](../../src/content/event-demos/xv/demo-xv-valentina-profile.json)
- Historical SQL patch (no longer the content owner):
  [`20260626_valentina_hernandez_xv.sql`](../../scripts/manual/production-patches/20260626_valentina_hernandez_xv.sql)

## Current implementation state

| Area                  | Current state                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route identity        | `xv/valentina-hernandez`                                                                                                                          |
| Event kind            | Client XV invitation (`isDemo: false`)                                                                                                            |
| Template              | `xv-editorial-magazine`                                                                                                                           |
| Theme preset          | `editorial-magazine`                                                                                                                              |
| Visual profile        | `valentina-hernandez`                                                                                                                             |
| Asset namespace       | `xv-valentina-hernandez`                                                                                                                          |
| Content source        | Managed definition `scripts/provision/invitations/valentina-hernandez.ts` (`deliveryScope: content-only` for Preview/Production; Local first populate may use `content-and-assets`) |
| Schema evidence       | Jest parses `buildValentinaPublishedContent` through `eventContentSchema`                             |
| Visual implementation | Editorial cover, responsive hero, section dividers, family/location treatment, gallery, gifts, RSVP, and footer passes are present in live source |
| Publication authority | Preview variants applied; Production owner apply still pending. No production execution is implied by this record |

The historical implementation passes are complete or superseded by live source and this record.
Future visual changes should start from the current profile and shared editorial contracts instead
of reopening those plans.

## Client facts retained

These facts came from the corrected client-source audit and are represented in the managed
definition's `buildPublishedContent` unless noted otherwise.

| Field              | Durable value                                                       |
| ------------------ | ------------------------------------------------------------------- |
| Celebrant          | Valentina Hernández Almaguer                                        |
| Date               | 29 de agosto de 2026                                                |
| Start              | 3:45 p.m. (`2026-08-29T15:45`, `America/Mexico_City`)               |
| Parents            | María Estrella Almaguer Casarreal and Juan Carlos Hernández Calixco |
| Godparents         | Nayeli Almaguer Casarreal and César A. Pérez Monroy                 |
| Venue              | Finca Las Palmas                                                    |
| Address            | 4ta Cerrada de Palma s/n, San Luis Huexotla, Texcoco, México        |
| Ceremony           | 3:45 p.m.                                                           |
| Reception          | 4:30 p.m.                                                           |
| Dress code         | Formal; pink and lilac are reserved for the celebrant               |
| Liverpool registry | `52020257`, display name `VALENS DREAM TEAM`                        |
| RSVP               | Hybrid in-app and WhatsApp confirmation, maximum four attendees     |
| Instagram          | `@val27_0811`                                                       |
| Requested music    | “Can’t Stop the Feeling!” — Justin Timberlake                       |
| Commercial scope   | Original intake recorded a $499 template adaptation                 |

The invitation copy also retains the client directions “Gracias por darme la vida y tanto amor,”
“Gracias por guiar mis pasos,” “Brillar es la actitud,” and the editorial opening about memories
being eternal.

## Content and interaction contract

- Section order is quote, family, countdown, itinerary, location, gallery, gifts, personalized
  access, RSVP, and thank-you.
- Ceremony and reception intentionally share the Finca Las Palmas location while retaining their
  distinct times in the itinerary. The numbered magazine program is authored as
  `itinerary.variant: editorial-program`.
- The gifts section contains “Regalo Sorpresa,” “Lluvia de Sobres,” and the Liverpool registry.
- RSVP uses `accessMode: "hybrid"` and `confirmationMode: "both"`.
- The editorial envelope uses `revealVariant: "editorial-cover"`, edition `XV`, issue `2026`, and
  seal initials `V·H`.
- Hosted `content.music` is authored in the managed definition (Justin Timberlake — “Can't Stop the
  Feeling!”). Do not omit it on apply or the player disappears.
- The demo-safe counterpart intentionally uses fictional people, dates, and locations while
  preserving the same visual profile.

## Asset record

The registry contains 17 keys: `hero`, `portrait`, `family`, `thankYouPortrait`, `gallery01` through
`gallery08`, and `interlude01` through `interlude04`.

The current files are WhatsApp-compressed JPEG previews:

- Typical dimensions are approximately 853–1003 × 1280.
- Typical file sizes are approximately 47–85 KB.
- `sharing.ogImage` uses the `hero` asset (not `portrait`).
- `family` is a solo portrait placeholder rather than a family group photo.
- Interludes currently use client photos rather than no-people editorial artwork.

Production-quality replacement guidance:

- Obtain original photo-session files.
- Produce a mobile-first hero around 1440×2560, a social portrait around 1600×2000, and gallery
  crops around 1400×1750.
- Apply the approved pink/silver editorial grade and export WebP at approximately quality 86.
- Replace interludes with reviewed no-people, no-text editorial imagery.
- Update the asset registry imports only after replacement files exist.

## Remaining delivery constraints

1. The asset registry still labels every image as draft-preview quality. High-resolution originals
   remain the primary production-readiness blocker.
2. Do not run the historical SQL patch. Production apply is owner-only and still pending:
   `pnpm prod:apply -- --slug valentina-hernandez --apply`.
3. A focused test proves schema validity and absence of placeholder copy in
   `buildValentinaPublishedContent`; it does not prove that a production route was deployed or
   client-approved.
4. Google Maps uses a search URL for Finca Las Palmas. Confirm the exact entrance pin before final
   delivery if navigation precision matters.
5. Confirm the Instagram handle, Liverpool registry availability, RSVP destination, and any licensed
   direct music asset during final client review.
6. Real guest loading and per-guest pass assignment remain dashboard operations; they are not stored
   in this documentation record.

## Verification

Use focused, non-production checks:

```bash
pnpm test -- tests/content/valentina-hernandez-payload.test.ts
pnpm test -- tests/unit/editorial-cover-reveal-contract.test.ts
pnpm type-check
pnpm build
```

Browser and production validation require the appropriate environment and authorization. Historical
screenshots and implementation plans are evidence only; they are not substitutes for a current
preview review.
