# Administrative invitation workflow

The dashboard invitation list separates work status from publication and manual review.
`in_progress` / `completed` are administrative decisions. Neither state changes publication, content
parity, visual acceptance, RSVP, or the checks required for a release.

Only the authenticated project owner (`celebra.me.com@gmail.com`), with the existing strong
administrator authorization, may record or clear a manual review. Agents must never invoke these
actions, including through browser automation. Work status may be changed by an agent within an
authorized task. The recorded date is historical, not certification of the current deployment.
Content changes do not invalidate it automatically.

Client database roles cannot insert or update these administrative fields directly. Existing column
writes remain available under existing RLS; the server endpoint owns the identity check. This does
not attempt to distinguish a human from automation using the same owner session: agents must respect
the manual-action boundary.

The existing `invitations` row owns these fields. Publication and demo synchronization update their
own explicit fields and must not copy administrative decisions between environments. New rows and
duplicates start in progress with no review. The schema migration does not initialize
invitation-specific decisions. After target inventory review and explicit authorization, use the
work-status action to close existing active entries. Missing rows are reported, never created to
fill inventory gaps. Allison Scarlett is not part of that initial closed inventory and retains the
new-row default when introduced. No runtime slug exception exists.

## Rollout

Apply migration `20260910160000` through the guarded database workflow before deploying the
dashboard code that selects the new columns. This is an additive schema change; previous code can
continue to run. Production apply and deployment require separate owner authorization. Use the
current canonical invitation registry and demo preset catalog to identify matching active rows in
the target before administrative initialization and report missing or unexpected identities rather
than synchronizing or publishing them to fill gaps. This repository-only implementation does not
assert that those rows exist in Production.

A rollback to previous application code can leave the additive columns in place. Do not drop the
columns or clear owner decisions as part of an application rollback. Production decisions copied in
a diagnostic database restore remain evidence from the source environment, not a new Local review.

## Verification

Focused API and component tests use mocks; they do not record real manual reviews. Disposable
database tests verify the schema default and paired date/actor constraint. Missing migrations must
be resolved before hosted use; do not mask database errors as completed or reviewed work.
