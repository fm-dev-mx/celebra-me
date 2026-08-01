# Asset Preparation Protocol

Use during invitation preparation after an explicit **high-resolution (HR) photo URL** and/or
source asset path is provided. Parent policy:
[`docs/core/invitation-preparation-contract.md`](../../../../docs/core/invitation-preparation-contract.md)
§7.

## Preconditions

- Asset source validated (URL and/or path exists; readable in session).
- WhatsApp chat attachments are **not** the authoritative photo source.
- Canonical state file `docs/invitations/<slug>.md` will receive the inventory using **opaque**
  source labels (no absolute OneDrive/`Clientes` paths).

## Steps

1. Validate the HR URL / path (session); persist only an opaque Sources label.
2. Inventory source images (filename, dims, format, orientation, bytes).
3. Preserve originals — never overwrite source binaries with derivatives.
4. Flag obvious duplicates (same bytes / clearly identical crops).
5. Mark unusable or inadequate images (`unusable`); flag baked UI chrome (status bars, ✕ buttons).
6. Assign or recommend visual roles (hero, gallery, family, interlude, etc.).
7. **Uniqueness:** Prevent accidental multi-role reuse unless explicitly intentional and documented.
   Before any READY_* claim, record a uniqueness table (role → source → derivative).
8. Decide crops / desktop-mobile derivatives only when role + composition justify them.
9. Build an optimization plan with role-aware WebP **targets** from
   `src/lib/invitation-preparation/image-optimization.ts`.
10. Record quality states:
    - `production-ready`
    - `provisional-whatsapp`
    - `temporary-placeholder`
    - `missing`
    - `unusable`
11. Feed states into `summarizeAssetQuality` / `evaluatePreparationReadiness` — provisional-only
    inventories cannot be documented as `READY_FOR_IMPLEMENTATION`.

## Rules

- Provisional/WhatsApp-compressed material must not silently become production-authoritative.
- Do not recompress already suitable images solely to satisfy a generic process.
- **Double-encode:** Avoid a second encode/upscale of already-normalized managed-release WebPs
  (prefer direct delivery of managed URLs; never request width beyond native). Note the risk when
  sources are provisional.
- Existing runtime normalization (`asset-policy`) and publish dimension gates stay unchanged.
- Chat media never becomes a managed asset without this protocol.

## Output

Photograph Inventory + uniqueness table + optimization notes in `docs/invitations/<slug>.md`
(hygiene-compliant).
