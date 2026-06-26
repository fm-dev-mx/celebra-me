# Asset Mapping Report — Valentina Hernández Almaguer XV

Generated: 2026-06-26 Source:
`C:\Users\fmdevmx\OneDrive\Documentos\Projects\celebra-me\Clientes\xv revista\WhatsApp Chat`

## Asset Key Mapping

| Asset key          | Source file                              | Output file              | Dimensions | File size | Crop/focal point                                                                                                        | Status                                                             |
| ------------------ | ---------------------------------------- | ------------------------ | ---------: | --------: | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `hero`             | `00000115-PHOTO-2026-06-23-09-30-35.jpg` | `hero.jpg`               |   926×1280 |     78 KB | 9:16 portrait; provisional — needs original for full-res crop                                                           | `provisional-whatsapp`                                             |
| `portrait`         | `00000119-PHOTO-2026-06-23-09-30-35.jpg` | `portrait.jpg`           |  1003×1280 |     61 KB | Widest photo; good for social preview; needs original                                                                   | `provisional-whatsapp`                                             |
| `family`           | `00000114-PHOTO-2026-06-23-09-30-35.jpg` | `family.jpg`             |   854×1280 |     54 KB | Provisional — no dedicated family group photo available; this is a solo portrait used as placeholder                    | `provisional-whatsapp`                                             |
| `thankYouPortrait` | `00000118-PHOTO-2026-06-23-09-30-35.jpg` | `thank-you-portrait.jpg` |   901×1280 |     76 KB | Closing portrait section; needs original for production                                                                 | `provisional-whatsapp`                                             |
| `gallery01`        | `00000113-PHOTO-2026-06-23-09-30-35.jpg` | `gallery-01.jpg`         |   918×1280 |     47 KB | WhatsApp-compressed                                                                                                     | `provisional-whatsapp`                                             |
| `gallery02`        | `00000116-PHOTO-2026-06-23-09-30-35.jpg` | `gallery-02.jpg`         |   884×1280 |     53 KB | WhatsApp-compressed                                                                                                     | `provisional-whatsapp`                                             |
| `gallery03`        | `00000117-PHOTO-2026-06-23-09-30-35.jpg` | `gallery-03.jpg`         |   879×1280 |     61 KB | WhatsApp-compressed                                                                                                     | `provisional-whatsapp`                                             |
| `gallery04`        | `00000120-PHOTO-2026-06-23-09-30-35.jpg` | `gallery-04.jpg`         |   945×1280 |     85 KB | WhatsApp-compressed; largest gallery file                                                                               | `provisional-whatsapp`                                             |
| `gallery05`        | `00000121-PHOTO-2026-06-23-09-30-36.jpg` | `gallery-05.jpg`         |   853×1280 |     50 KB | WhatsApp-compressed                                                                                                     | `provisional-whatsapp`                                             |
| `gallery06`        | `00000122-PHOTO-2026-06-23-09-30-36.jpg` | `gallery-06.jpg`         |   949×1280 |     55 KB | WhatsApp-compressed                                                                                                     | `provisional-whatsapp`                                             |
| `gallery07`        | `00000123-PHOTO-2026-06-23-09-30-36.jpg` | `gallery-07.jpg`         |   868×1280 |     50 KB | WhatsApp-compressed                                                                                                     | `provisional-whatsapp`                                             |
| `gallery08`        | `00000124-PHOTO-2026-06-23-09-30-36.jpg` | `gallery-08.jpg`         |   871×1280 |     60 KB | WhatsApp-compressed                                                                                                     | `provisional-whatsapp`                                             |
| `interlude01`      | `00000125-PHOTO-2026-06-23-09-30-36.jpg` | `interlude-01.jpg`       |   919×1280 |     47 KB | **Provisional client photo used as decorative break.** Replace with generated no-people editorial image for production. | `provisional-whatsapp`                                             |
| `interlude02`      | `00000126-PHOTO-2026-06-23-09-30-36.jpg` | `interlude-02.jpg`       |   871×1280 |     76 KB | Same as interlude01                                                                                                     | `provisional-whatsapp`                                             |
| `interlude03`      | `00000127-PHOTO-2026-06-23-09-30-36.jpg` | `interlude-03.jpg`       |   907×1280 |     51 KB | Same as interlude01                                                                                                     | `provisional-whatsapp`                                             |
| `interlude04`      | `00000128-PHOTO-2026-06-23-09-30-36.jpg` | `interlude-04.jpg`       |   875×1280 |     73 KB | Same as interlude01                                                                                                     | `provisional-whatsapp`                                             |
| `ogImage`          | Same as `portrait`                       | `portrait.jpg`           |  1003×1280 |     61 KB | 4:5 social preview crop; needs original                                                                                 | `provisional-whatsapp` (via payload `sharing.ogImage: "portrait"`) |

## Payload-to-Asset Cross-Reference

| Payload reference                                      | Asset key                   | Status                                                                                                           |
| ------------------------------------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `hero.backgroundImage = "hero"`                        | `hero`                      | ✅ Mapped to `hero.jpg` (provisional)                                                                            |
| `hero.portrait = "portrait"`                           | `portrait`                  | ✅ Mapped to `portrait.jpg` (provisional)                                                                        |
| `family.featuredImage = "family"`                      | `family`                    | ✅ Mapped to `family.jpg` (provisional)                                                                          |
| `thankYou.image = "thankYouPortrait"`                  | `thankYouPortrait`          | ✅ Mapped to `thank-you-portrait.jpg` (provisional)                                                              |
| `gallery.items[0-7].image = "gallery01".."gallery08"`  | `gallery01`–`gallery08`     | ✅ All 8 gallery slots mapped (provisional)                                                                      |
| `interludes[0-3].image = "interlude01".."interlude04"` | `interlude01`–`interlude04` | ⚠️ Provisional — client photos used as decorative breaks. Replace with no-people editorial images for production |
| `sharing.ogImage = "portrait"`                         | `portrait`                  | ✅ Same as hero.portrait                                                                                         |

## Asset Registry File

`src/assets/images/events/xv-valentina-hernandez/index.ts` — 17 imports (`hero`, `portrait`,
`family`, `thankYouPortrait`, `gallery01`–`gallery08`, `interlude01`–`interlude04`). All status:
`provisional-whatsapp`.

## Photo Sources Available (Not Used)

The following WhatsApp images were **not** mapped to asset keys:

| Source file                                 |      Size | Reason omitted                                                  |
| ------------------------------------------- | --------: | --------------------------------------------------------------- |
| `00000108-PHOTO-2026-06-23-09-29-55.jpg`    |     36 KB | Guest management dashboard screenshot — not an invitation photo |
| `00000135-PHOTO-2026-06-23-09-32-48.jpg`    |    111 KB | Event data image — not a photo                                  |
| `00000136-PHOTO-2026-06-23-09-32-48.jpg`    |     88 KB | Event data image — not a photo                                  |
| `00000154-PHOTO-2026-06-24-13-12-33.jpg`    |    117 KB | Music screenshot — not usable as invitation photo               |
| `00000039–00000044-*.jpg`                   | 77–175 KB | Editorial reference images — not client's own photos            |
| `00000066-PHOTO-2026-06-22-16-31-27.jpg`    |    209 KB | PDF preview of something Paco received — not a client photo     |
| `00000147-STICKER-2026-06-24-13-06-49.webp` |     33 KB | WhatsApp sticker — not usable                                   |

## Production Requirements

All 16 mapped images need to be replaced with:

- **Originals** from client's photo session (requested via WeTransfer to `soporte@celebra-me.com`)
- Processed: crop → editorial pink/silver color grade → WebP quality 86
- Target resolutions:
  - Hero: ~1440×2560 (9:16 mobile-first)
  - Portrait: ~1600×2000 (4:5 for social preview)
  - Gallery: ~1400×1750 each
  - Interludes: ~1440×2160 decorative only (no people, no faces, no text)
- Replace `.jpg` files with `.webp` files in the asset directory
- Update `index.ts` imports from `.jpg` to `.webp`

## Draft Preview Readiness

✅ All 17 asset keys are populated with actual client photos (WhatsApp-compressed). ✅ Build passes
with real image files. ⚠️ Interludes are provisional client photos, not decorative editorial images.
❌ Production delivery blocked: original photos required.
