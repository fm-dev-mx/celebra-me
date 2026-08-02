# Production Published Field Mapping — `romina-rios-chaparro`

This record maps the current Production published revision into the canonical contract. It records
paths and migration rationale only; it does not persist Production field values, identifiers, URLs,
or hashes.

## Source evidence

- Editorial source: Production published revision `v10`.
- Extraction: the existing server-side managed candidate reader, scoped to this slug and Production.
- Asset evidence: the existing Production asset-mapping verifier confirmed an exact binary match for
  every declared canonical slot.
- Target scope: Local and Preview managed `content-and-assets`; Production remains dry-run-only.

## Mapping register

| Production path               | Canonical path or omission                 | Rationale                                                                                                                                             | Behavior             |
| ----------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `music`                       | `music`                                    | Supported current section; retain the approved presentation.                                                                                          | Functional / visible |
| `location.venues[*]`          | `location.ceremony` / `location.reception` | Migrate the legacy venue collection to the current ceremony/reception contract; omit transport IDs and legacy labels.                                 | Visible / functional |
| `location.indications`        | `location.indications`                     | Supported current location contract.                                                                                                                  | Visible              |
| `location.indicationsHeading` | Omitted                                    | Empty legacy value has no visible or functional effect.                                                                                               | Residual             |
| `hero.nickname`               | Omitted                                    | Empty legacy value has no visible or functional effect.                                                                                               | Residual             |
| `hero.secondaryName`          | Omitted                                    | Empty legacy value has no visible or functional effect.                                                                                               | Residual             |
| `family.labels`               | `family.labels`                            | Supported current family contract; retain approved family presentation.                                                                               | Visible              |
| `sharing.shareMessages`       | `sharing.shareMessages`                    | Supported current sharing contract; retain approved invitation and reminder behavior.                                                                 | Functional / visible |
| `sharing.reminderSettings`    | `sharing.reminderSettings`                 | Supported current reminder contract; retain approved scheduling behavior.                                                                             | Functional           |
| `theme.fontFamily`            | `theme.fontFamily`                         | Supported current theme contract; retain the approved typography intent.                                                                              | Visible              |
| Uploaded asset references     | Declared semantic asset keys               | Existing canonical binaries were verified against Production Storage; Preview duplicates remain untouched and environment identifiers are not copied. | Visible / functional |
