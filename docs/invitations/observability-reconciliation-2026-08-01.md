# Observability Reconciliation Record — 2026-08-01

> Operational evidence record, not a source-of-truth override. Canonical invitation definitions,
> approved Preview artifacts, and the managed lifecycle remain authoritative.

> **Supersession note:** The current reconciliation goal supersedes the Abril and Romina editorial
> recommendations recorded below. This historical record remains operational evidence only; the
> current field-mapping records are `abril-michelle-becerra-rea-production-field-mapping.md` and
> `romina-rios-chaparro-production-field-mapping.md`.

## Scope and evidence

This record covers only `abril-michelle-becerra-rea`, `romina-rios-chaparro`, `alba-rosa-quinonez`,
and `daniela-y-martin`.

- Local, Preview, and Production availability were verified as read-only before inspection.
- A fresh observability detail snapshot was available for all three environments.
- Semantic comparisons use normalized paths only. They never record field values, database IDs,
  storage URLs, or asset hashes.
- Production preflight confirmed a current schema but stopped before a Production plan when the
  exact approved Preview release artifact was absent. No Production mutation was attempted.

## Abril Michelle Becerra Rea

The Local managed state is the current canonical projection. Production differs in both draft and
published content, and Preview differs in asset semantic-key coverage. The following is a
path-by-path decision register; entries marked `USER_DECISION_REQUIRED` must remain untouched.

| Semantic path                   | Decision                 | Supporting evidence                                                          | Permitted next step                                               |
| ------------------------------- | ------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `music`                         | `CANONICAL_CORRECT`      | The invitation document explicitly lists music as intentionally omitted.     | Reconcile only after the remaining release blockers are resolved. |
| `location.ceremony.venueEvent`  | `USER_DECISION_REQUIRED` | Venue/address material still has a documented spelling confirmation pending. | Obtain the client-approved venue wording.                         |
| `location.indications`          | `USER_DECISION_REQUIRED` | No current approved remote-to-canonical decision exists.                     | Obtain editorial confirmation.                                    |
| `location.reception.venueEvent` | `USER_DECISION_REQUIRED` | Venue/address material still has a documented spelling confirmation pending. | Obtain the client-approved venue wording.                         |
| `sharing.invitation`            | `USER_DECISION_REQUIRED` | No approved sharing-copy decision is recorded.                               | Obtain editorial confirmation.                                    |
| `sharing.ogDescription`         | `USER_DECISION_REQUIRED` | No approved sharing-copy decision is recorded.                               | Obtain editorial confirmation.                                    |
| `sharing.ogImage`               | `USER_DECISION_REQUIRED` | Asset semantic-key coverage is not aligned.                                  | Resolve asset evidence through the managed workflow.              |
| `sharing.reminder`              | `USER_DECISION_REQUIRED` | No approved reminder-copy decision is recorded.                              | Obtain editorial confirmation.                                    |
| `sharing.whatsappTemplate`      | `USER_DECISION_REQUIRED` | No approved sharing-copy decision is recorded.                               | Obtain editorial confirmation.                                    |
| `hero.nickname`                 | `USER_DECISION_REQUIRED` | Present only in the Production published projection comparison.              | Obtain editorial confirmation.                                    |
| `hero.secondaryName`            | `USER_DECISION_REQUIRED` | Present only in the Production published projection comparison.              | Obtain editorial confirmation.                                    |
| `location.indicationsHeading`   | `USER_DECISION_REQUIRED` | Present only in the Production published projection comparison.              | Obtain editorial confirmation.                                    |
| `rsvp.calendar`                 | `USER_DECISION_REQUIRED` | Present only in the Production published projection comparison.              | Obtain editorial confirmation.                                    |
| `sharing.reminderSettings`      | `USER_DECISION_REQUIRED` | Present only in the Production published projection comparison.              | Obtain editorial confirmation.                                    |
| `sharing.shareMessages`         | `USER_DECISION_REQUIRED` | Present only in the Production published projection comparison.              | Obtain editorial confirmation.                                    |
| `thankYou.closingPhrase`        | `USER_DECISION_REQUIRED` | Present only in the Production published projection comparison.              | Obtain editorial confirmation.                                    |
| `theme.fontFamily`              | `USER_DECISION_REQUIRED` | Present only in the Production published projection comparison.              | Obtain design approval.                                           |

Local readiness also reports missing Local Storage binaries for the managed assets. Preview and
Production remain blocked from reconciliation: Preview lacks usable managed provenance, the asset
semantic-key set differs, and Production lacks an approved Preview release. No baseline adoption or
asset inference is authorized.

## Romina Ríos Chaparro

The current canonical definition and the historical finalization record support the following
canonical decisions. The historical record is supporting evidence only; it does not authorize an
environment write on its own.

| Semantic path                         | Decision                 | Supporting evidence                                                                                   | Permitted next step                                                   |
| ------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `family.fatherName`                   | `CANONICAL_CORRECT`      | Finalization record and current canonical family model agree.                                         | Reconcile only after Preview provenance and asset evidence are valid. |
| `family.focalPoint`                   | `CANONICAL_CORRECT`      | Current canonical asset allocation is the documented final composition.                               | Reconcile only after Preview provenance and asset evidence are valid. |
| `family.godparents`                   | `CANONICAL_CORRECT`      | Finalization record and current canonical family model agree.                                         | Reconcile only after Preview provenance and asset evidence are valid. |
| `family.godparentsTitle`              | `CANONICAL_CORRECT`      | Finalization record and current canonical family model agree.                                         | Reconcile only after Preview provenance and asset evidence are valid. |
| `family.labels`                       | `CANONICAL_CORRECT`      | Finalization record and current canonical family model agree.                                         | Reconcile only after Preview provenance and asset evidence are valid. |
| `family.motherName`                   | `CANONICAL_CORRECT`      | Finalization record and current canonical family model agree.                                         | Reconcile only after Preview provenance and asset evidence are valid. |
| `family.parents`                      | `CANONICAL_CORRECT`      | Finalization record and current canonical family model agree.                                         | Reconcile only after Preview provenance and asset evidence are valid. |
| `family.parentsTitle`                 | `CANONICAL_CORRECT`      | Finalization record and current canonical family model agree.                                         | Reconcile only after Preview provenance and asset evidence are valid. |
| `family.sectionMessage`               | `CANONICAL_CORRECT`      | Finalization record and current canonical family model agree.                                         | Reconcile only after Preview provenance and asset evidence are valid. |
| `family.sectionSubtitle`              | `CANONICAL_CORRECT`      | Finalization record and current canonical family model agree.                                         | Reconcile only after Preview provenance and asset evidence are valid. |
| `family.sectionTitle`                 | `CANONICAL_CORRECT`      | Finalization record and current canonical family model agree.                                         | Reconcile only after Preview provenance and asset evidence are valid. |
| `location.ceremony.venueEvent`        | `CANONICAL_CORRECT`      | Finalization record describes the completed ceremony location model.                                  | Reconcile only after Preview provenance and asset evidence are valid. |
| `location.indications`                | `CANONICAL_CORRECT`      | Finalization record describes the completed location presentation.                                    | Reconcile only after Preview provenance and asset evidence are valid. |
| `location.reception.coordinates.zoom` | `CANONICAL_CORRECT`      | Current canonical location model is documented as final.                                              | Reconcile only after Preview provenance and asset evidence are valid. |
| `location.reception.venueEvent`       | `CANONICAL_CORRECT`      | Finalization record describes the completed reception location model.                                 | Reconcile only after Preview provenance and asset evidence are valid. |
| `location.venues`                     | `CANONICAL_CORRECT`      | Finalization record describes the completed location presentation.                                    | Reconcile only after Preview provenance and asset evidence are valid. |
| `music`                               | `USER_DECISION_REQUIRED` | The current evidence does not establish whether the remote or canonical music treatment was approved. | Obtain editorial confirmation.                                        |
| `hero.nickname`                       | `USER_DECISION_REQUIRED` | Present only in the Production published projection comparison.                                       | Obtain editorial confirmation.                                        |
| `hero.secondaryName`                  | `USER_DECISION_REQUIRED` | Present only in the Production published projection comparison.                                       | Obtain editorial confirmation.                                        |
| `location.ceremony`                   | `USER_DECISION_REQUIRED` | Published projection differs at the section level beyond the documented detail.                       | Obtain an exact editorial decision.                                   |
| `location.indicationsHeading`         | `USER_DECISION_REQUIRED` | Present only in the Production published projection comparison.                                       | Obtain editorial confirmation.                                        |
| `location.reception`                  | `USER_DECISION_REQUIRED` | Published projection differs at the section level beyond the documented detail.                       | Obtain an exact editorial decision.                                   |
| `sharing.reminderSettings`            | `USER_DECISION_REQUIRED` | Present only in the Production published projection comparison.                                       | Obtain editorial confirmation.                                        |
| `sharing.shareMessages`               | `USER_DECISION_REQUIRED` | Present only in the Production published projection comparison.                                       | Obtain editorial confirmation.                                        |
| `theme.fontFamily`                    | `USER_DECISION_REQUIRED` | Present only in the Production published projection comparison.                                       | Obtain design approval.                                               |

### Preview asset-slot audit

Every expected current slot has three Preview candidates with the same normalized display name, MIME
type, dimensions, and file size. One candidate in each trio is referenced by the current draft at
the path below, but all three lack a managed semantic key. The content association is evidence of
use, not authority to assign a persistent identity to one duplicate.

| Expected slot    | Candidate count | Current content association                                                         |
| ---------------- | --------------: | ----------------------------------------------------------------------------------- |
| `closing`        |               3 | `thankYou.image`                                                                    |
| `family`         |               3 | `family.featuredImage`                                                              |
| `hero`           |               3 | `hero.backgroundImage`, `hero.backgroundImageMobile`, `hero.backgroundImageDesktop` |
| `petLandscape`   |               3 | `gallery.items[3].image`                                                            |
| `petPortrait`    |               3 | `gallery.items[1].image`                                                            |
| `pinkFloral`     |               3 | `gallery.items[5].image`                                                            |
| `portrait`       |               3 | `gallery.items[0].image`                                                            |
| `sageLandscape`  |               3 | `interludes[0].image`                                                               |
| `social`         |               3 | `gallery.items[6].image`, `sharing.ogImage`                                         |
| `whiteBotanical` |               3 | `gallery.items[4].image`                                                            |
| `whitePortrait`  |               3 | `gallery.items[2].image`                                                            |

`ASSET_IDENTITY_UNVERIFIED` therefore remains correct. No candidate was selected by recency,
deleted, renamed, keyed, or adopted. The existing Preview dry-run remains blocked because no
non-empty managed projection is available; baseline adoption remains explicitly blocked.

## Alba Rosa Quiñónez

`envelope.showCardAction` is deprecated and removed from the content contract, so the canonical
absence is the approved structural intent. This is not an editorial decision.

- Local was reconciled through the managed workflow: one functional deletion, with no Storage
  mutation.
- Preview was reconciled to semantic equality through the same planned deletion. Its post-apply
  receipt verification reported recoverable unmanaged drift, but the subsequent zero-drift dry-run
  and fresh snapshot confirm that both draft and published content now match canonical.
- The remaining Preview `PARTIAL_PROMOTION` work item is retained as truthful provenance work; it is
  not hidden or repaired by creating a baseline.
- Production still has the one pending semantic deletion. It remains dry-run-only until an exact
  Preview approval and invitation-specific Production authorization are supplied.

## Daniela y Martín

`daniela-y-martin` remains `HEALTHY + IN_PROGRESS`. Its Local differences remain preparation work
(envelope text, family, gallery, location, section order, and RSVP styling); Preview and Production
do not contain the invitation. No reconciliation or promotion was attempted merely to clear
observability.
