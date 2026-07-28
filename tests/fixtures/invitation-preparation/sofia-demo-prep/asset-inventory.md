# Asset inventory notes — sofia-demo-prep (synthetic)

Source path: `tests/fixtures/invitation-preparation/sofia-demo-prep/assets`

**Inventory mode:** declared-only — rows below describe expected photograph metadata for the
scenario. Binary files are intentionally absent from `assets/` (folder keeps `.gitkeep` only).

| source filename | dims | format | orientation | weight | quality | role | duplicate | processing | derivative |
| --------------- | ---- | ------ | ----------- | ------ | ------- | ---- | --------- | ---------- | ---------- |
| hero-wa.jpg | 926×1280 | jpeg | portrait | 78 KB | provisional-whatsapp | hero-desktop (recommended) | no | replace with original | deferred |
| gallery-01-wa.jpg | 1200×1600 | jpeg | portrait | 95 KB | provisional-whatsapp | gallery | no | replace with original | deferred |
| gallery-01-copy.jpg | 1200×1600 | jpeg | portrait | 95 KB | provisional-whatsapp | — | duplicate of gallery-01-wa.jpg | discard | none |

Notes:

- Originals must be preserved when studio files arrive; do not overwrite this inventory folder with
  derivatives in place.
- Optimization targets apply only after production-ready sources exist.
