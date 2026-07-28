# Asset Preparation Protocol

Use during invitation preparation after an explicit source asset path is provided.

## Preconditions

- Source path validated (exists; readable).
- WhatsApp is not used as the authoritative photo source.
- Canonical state file `docs/invitations/<slug>.md` will receive the inventory.

## Steps

1. Validate the path.
2. Inventory source images (filename, dims, format, orientation, bytes).
3. Preserve originals — never overwrite source binaries with derivatives.
4. Flag obvious duplicates (same bytes / clearly identical crops).
5. Mark unusable or inadequate images (`unusable`).
6. Assign or recommend visual roles (hero, gallery, family, interlude, etc.).
7. Prevent accidental multi-role reuse unless explicitly intentional and documented.
8. Decide crops / desktop-mobile derivatives only when role + composition justify them.
9. Build an optimization plan with role-aware WebP **targets** from
   `src/lib/invitation-preparation/image-optimization.ts`.
10. Record quality states:
    - `production-ready`
    - `provisional-whatsapp`
    - `temporary-placeholder`
    - `missing`
    - `unusable`

## Rules

- Provisional/WhatsApp-compressed material must not silently become production-authoritative.
- Do not recompress already suitable images solely to satisfy a generic process.
- Existing runtime normalization (`asset-policy`) and publish dimension gates stay unchanged.

## Output

Photograph Inventory + optimization notes in `docs/invitations/<slug>.md`.
