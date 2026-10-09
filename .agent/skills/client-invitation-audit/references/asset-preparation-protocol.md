# Asset Preparation Protocol

The procedure is owned by
[`docs/core/invitation-preparation-contract.md`](../../../../docs/core/invitation-preparation-contract.md)
§7. Use it after an explicit high-resolution (HR) photo URL and/or source asset path is provided;
WhatsApp attachments are never the authoritative photo source.

Session checklist:

- Validate the source in session; persist only an opaque Sources label.
- Inventory, preserve originals, flag duplicates and baked UI chrome (status bars, close buttons).
- Record one quality state per image: `production-ready`, `provisional-whatsapp`,
  `temporary-placeholder`, `missing`, or `unusable`.
- Record the uniqueness table (role → source → derivative) before any `READY_*` claim.
- Feed the states into `summarizeAssetQuality` / `evaluatePreparationReadiness` (contract §9.1).

Output: Photograph Inventory, uniqueness table, and optimization notes in
`docs/invitations/<slug>.md`, following the hygiene rules in contract §4.1.
