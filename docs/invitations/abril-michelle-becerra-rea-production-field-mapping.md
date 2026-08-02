# Production Published Field Mapping — `abril-michelle-becerra-rea`

This record maps the current Production published revision into the canonical contract. It records
paths and migration rationale only; it does not persist Production field values, identifiers, URLs,
or hashes.

## Source evidence

- Editorial source: Production published revision `v7`.
- Extraction: the existing server-side managed candidate reader, scoped to this slug and Production.
- Asset evidence: the existing Production asset-mapping verifier confirmed an exact binary match for
  every declared canonical slot.
- Target scope: Local and Preview managed `content-and-assets`; Production remains dry-run-only.

## Mapping register

| Production path               | Canonical path or omission   | Rationale                                                                                                     | Behavior             |
| ----------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------- |
| `music`                       | `music`                      | Supported current section; retain the approved presentation.                                                  | Functional / visible |
| `location.indications`        | `location.indications`       | Supported current location contract.                                                                          | Visible              |
| `location.indicationsHeading` | Omitted                      | Empty legacy value has no visible or functional effect.                                                       | Residual             |
| `hero.nickname`               | Omitted                      | Empty legacy value has no visible or functional effect.                                                       | Residual             |
| `hero.secondaryName`          | Omitted                      | Empty legacy value has no visible or functional effect.                                                       | Residual             |
| `rsvp.calendar`               | `rsvp.calendar`              | Supported current RSVP/calendar contract; existing canonical projection already matches.                      | Functional / visible |
| `sharing.shareMessages`       | `sharing.shareMessages`      | Supported current sharing contract; retain approved invitation and reminder behavior.                         | Functional / visible |
| `sharing.reminderSettings`    | `sharing.reminderSettings`   | Supported current reminder contract; retain approved scheduling behavior.                                     | Functional           |
| `theme.fontFamily`            | `theme.fontFamily`           | Supported current theme contract; retain the approved typography intent.                                      | Visible              |
| `thankYou.closingPhrase`      | Omitted                      | Canonical-only value is not present in approved Production published content and would change visible output. | Residual             |
| Uploaded asset references     | Declared semantic asset keys | Existing canonical binaries were verified against Production Storage; environment identifiers are not copied. | Visible / functional |
