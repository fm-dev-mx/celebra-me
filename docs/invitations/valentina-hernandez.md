# Valentina Hernández Almaguer — Delivered State

The event took place on 2026-08-29. This record keeps only the delivered state; preparation notes,
implementation passes, and asset audits live in Git history.

## Identity

| Parameter            | Value                                                  |
| -------------------- | ------------------------------------------------------ |
| **Slug**             | `valentina-hernandez`                                  |
| **Route**            | `/xv/valentina-hernandez`                              |
| **Event Type**       | `xv`                                                   |
| **Host Login Alias** | `valentina_hernandez`                                  |
| **Event start**      | `2026-08-29T15:45` (`America/Mexico_City`)             |
| **Asset namespace**  | `xv-valentina-hernandez` (differs from the route slug) |

## Preset and variants

- Theme preset `editorial-magazine`; visual profile `valentina-hernandez` (frozen by digest in
  `tests/unit/invitation-profile-boundary.test.ts`); legacy `baseDemoId`
  `demo-xv-editorial-magazine` (catalog-only).
- Envelope `revealVariant: editorial-cover`.
- Variants: hero `editorial-cover`, family `standard`, countdown `magazine-folio`, itinerary
  `editorial-program`, location `standard`, gallery `magazine-spread`, gifts `editorial-catalog`,
  RSVP `editorial-press-pass` with personalized access `editorial-pass`, thank-you
  `editorial-back-cover`.

## Delivered state

- Managed definition `scripts/provision/invitations/valentina-hernandez.ts`, `lifecycle: published`,
  `deliveryScope: content-and-assets`. Contract test:
  `tests/content/valentina-hernandez-payload.test.ts`.
- RSVP `accessMode: hybrid`, `confirmationMode: both`, `guestCap: 4`. Music is authored in the
  definition; omitting it removes the player.
- Per-environment state comes from `pnpm dbs valentina-hernandez`; this record asserts none.

## Known constraints

- The asset registry (`src/assets/images/events/xv-valentina-hernandez/index.ts`) holds 16 keys
  (`hero`, `portrait`, `family`, `thankYouPortrait`, `gallery01`–`gallery08`,
  `interlude01`–`interlude04`) sourced from WhatsApp-compressed JPEGs; high-resolution originals
  were never supplied.
- Ceremony and reception share Finca Las Palmas; the Maps link is a search URL, not a pinned
  entrance.
- Leaving release planning requires an owner `archive` record in the definition.
