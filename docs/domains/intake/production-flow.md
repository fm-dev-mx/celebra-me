# Invitation Production Runbook

This is the canonical operational workflow for producing a client invitation. The live code and
database migrations remain authoritative for executable behavior. The content contract is
[`docs/core/content-schema.md`](../../core/content-schema.md); architecture is
[`docs/core/architecture.md`](../../core/architecture.md).

## Roles and responsibility

| Concern                     | System                                                      | Agent/developer                                 | Designer                       | Manual/production operator                 |
| --------------------------- | ----------------------------------------------------------- | ----------------------------------------------- | ------------------------------ | ------------------------------------------ |
| Validate creation input     | Zod API schema and service invariant                        | Select and verify compatible preset             | —                              | —                                          |
| Create invitation and draft | Dashboard API and repositories                              | Use the dashboard; inspect failures             | —                              | —                                          |
| Write content               | Editor schemas and optimistic locking                       | Enter accurate Spanish copy and structured data | Review narrative and hierarchy | Confirm client facts                       |
| Prepare assets              | Server decode, normalize, resize, WebP conversion, metadata | Upload through the editor; never bypass policy  | Choose crop and focal point    | Review mobile crops                        |
| Preview                     | Internal SSR preview                                        | Exercise all content states                     | Approve visual direction       | Verify links and client facts              |
| Publish                     | Validation plus atomic RPC                                  | Resolve all blockers and initiate publish       | —                              | Apply required production migrations first |
| Deploy and verify           | Vercel and Supabase runtime                                 | Run checks and capture evidence                 | Review deployed visuals        | Authorize production-only actions          |

Production database mutations, deployments, and rollbacks require explicit human authorization.

## Single-File Invitation Provisioning & Promotion Workflow

Version-controlled invitations (e.g. Romina) are defined as single TypeScript files under `scripts/provision/invitations/<slug>.ts`.

```text
Define -> Plan -> Update Local -> Package -> Promote Preview -> Approve -> Resume Production
```

Use `pnpm invitation:update -- --non-interactive --slug <slug> --targets local,preview --source-dir <path> --dry-run|--apply`. The `all` workflow stops after Preview; Production resumes only from the exact approved package with an explicit owner and confirmation.

## Publication integrity rollout

Phase one retains the old seven-argument RPC only as a service-role fail-closed
`publish_upgrade_required` stub. Apply it, deploy the application and provisioning scripts using the
current RPC, monitor legacy calls while old serverless instances drain, then remove the stub in a
separate reviewed migration. During that overlap, publishing from an old instance is intentionally
unavailable.

Successful confirmation stores a durable idempotency receipt containing the full request fingerprint
and exact response. It is retained for the invitation/draft lifetime with restrictive foreign keys;
one receipt per successful confirmation gives bounded linear growth, so no scheduler is needed. The
transaction locks and validates invitation metadata, draft, and published-content fingerprints
before any write. The disposable pgTAP runner uses `ON_ERROR_STOP` and fails for migration, harness,
or TAP assertion failures.

For release evidence, reset the disposable database and run `run-tests`, `run-concurrency-test`,
`run-stale-baseline-test`, and `run-application-flow` through `scripts/db/disposable-test-env.ts`.
The latter uses isolated PostgREST to exercise the service path; the two database runners verify the
contention branch and stale public-input rollback paths.

## 1. Intake and preparation

Before creating a record, collect:

- Required: client/host name, event type, invitation title, event date/time, route slug, selected
  editor preset, and a responsible owner.
- Required for publication when used: hero name/label/date, locations, RSVP configuration, asset
  references, and a valid section order.
- Optional: description, secondary name, parents, godparents, grouped venues, separate ceremony and
  reception, itinerary, gallery, gifts, music, quote, thank-you message, envelope, map providers,
  WhatsApp templates, personalized passes, location gating, and sharing metadata.

Choose the event type from `EVENT_TYPES` and the editor preset from `DEMO_PRESET_CATALOG`. The
preset's `eventType` must match the invitation event type. `createInvitation()` rejects a missing,
invalid, or incompatible base demo before calling the create repository, so validation failures must
not persist an invitation.

Choose slug roles independently:

- The route slug identifies `/{eventType}/{slug}` and is unique with event type.
- `previewSlug` identifies the static demo used by the editor.
- `_assetSlug` identifies the asset registry namespace.
- `visualProfileId`, when present, selects invitation-specific CSS without changing the URL.

Check collisions in existing invitations, published content, and RSVP events. Do not infer that
`slug`, `previewSlug`, and `_assetSlug` are equal.

## 2. Canonical references

Reference selection is concern-specific; no invitation is universally canonical.

| Reference                       | Use it for                                                  | Reusable patterns                                                                    | Do not copy                                                    |
| ------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `demo-xv-jewelry-box`           | Asset organization and a complete XV baseline               | Namespace layout, internal asset keys, ceremony/reception, standard section contract | Names, copy, dates, colors, crop decisions                     |
| `demo-baby-shower-celestial`    | Optional-section and intentionally omitted-section coverage | Compact section order, sparse content, grouped family/location/gifts behavior        | Baby-shower-specific narrative or the Leah Lexa client profile |
| `demo-boda-jewelry-box-wedding` | Non-XV and wedding structure                                | Couple naming, ceremony/reception separation, wedding theme compatibility            | Wedding-only semantics for other event types                   |

The capability contract in `src/lib/invitation/invitation-descriptors.ts` encodes these roles and
validates the intentionally different routable, editor-selectable, and showroom subsets.

## 3. Create the invitation

1. Open `/dashboard/invitaciones` and choose **Nueva invitación**, or go directly to
   `/dashboard/invitaciones/nueva`.
2. Select event type and a compatible base demo, then enter title, client details, and optional
   route slug.
3. The API `POST /api/dashboard/intake` validates with `CreateInvitationSchema` and calls
   `createInvitation()`.
4. The service re-resolves the preset, enforces the event-type invariant, takes the catalog theme,
   and only then calls `createInvitationRecord()`.
5. Creation returns the invitation and the UI opens `/dashboard/invitaciones/{id}/editar`. Demo
   duplication creates a client invitation and seeds a minimal draft containing the title; it does
   not copy the full demo into the production DB.

Expected initial state is a client invitation plus an editable draft. A 422 response means the
request is invalid; a conflict means a slug or concurrent state changed. Do not retry validation
errors unchanged and do not create records through manual SQL.

## 4. Edit content

The editor sections are `main`, `family`, `location`, `countdown`, `itinerary`, `rsvp`, `music`,
`envelope`, `gifts`, `messages`, `gallery`, `photoNotes`, `publication`, and `sharing`. Their
schemas live in `src/lib/intake/schemas/invitation-editor.schema.ts`; the public snapshot is
validated by `eventContentSchema`.

- Keep visible copy in Spanish and technical identifiers/comments in English.
- Save with the current `expectedUpdatedAt`. A stale save returns a conflict; reload and reconcile
  rather than overwriting a newer draft.
- `sectionOrder` is optional in public content. When absent, the render plan uses the canonical
  content-section order from `CONTENT_SECTION_KEYS` and inserts eligible interludes after their
  target sections.
- Optional sections are omitted when their content is absent or ineligible. Do not create empty
  placeholders just to match another invitation.
- Locations support `venues` for grouped cards and legacy `ceremony`/`reception` fields for separate
  cards. Preserve map URLs and location-gating semantics.
- Test long names, headings, addresses, gift descriptions, and WhatsApp copy. The editor limits are
  validation boundaries, not design targets.
- Publication merges existing published content, draft changes, and the selected demo defaults, then
  maps once through the canonical draft-to-published mapper.

## 5. Prepare and upload assets

Uploads are enforced server-side by `asset-policy.ts`:

- Accepted input MIME types: JPEG, PNG, and WebP; declared and decoded formats must match.
- Maximum input size: 8 MiB; maximum decoded input: 40 million pixels.
- Minimum input dimensions: 480 px on each side.
- EXIF orientation is normalized with Sharp.
- Output is WebP, at most 2560 × 2560 without enlargement and at most 2,500,000 bytes.
- The encoder attempts qualities 84, 76, then 68 and rejects an output that remains too large.
- Stored metadata includes output MIME, dimensions and size, original MIME and size, and
  `validation_version = 1`.

Publication requires current-policy metadata, WebP output, positive dimensions, dimensions no larger
than 2560, and output no larger than 2,500,000 bytes. A legacy asset with `validation_version = 0`
is grandfathered only when the same asset ID already exists in the prior published snapshot; newly
referenced or changed legacy assets are blocked. Missing required asset keys and unresolved uploaded
assets also block publication.

The system does not choose art direction. Designers/developers must still select an appropriate
source, confirm semantic role and alt text, choose focal points, and review desktop and mobile
crops. Do not replace independent client namespaces merely because files have identical hashes.

## 6. Preview and visual QA

Use both the internal preview (`/dashboard/invitaciones/{id}/preview`) and a deployed Vercel
preview. Internal preview proves editor mapping; only a deployment proves Linux casing, Vercel
bundling, headers, Supabase connectivity, and real asset delivery.

Minimum viewports:

- 360 × 800 small mobile.
- 390 × 844 standard mobile.
- 768 × 1024 tablet.
- 1440 × 900 desktop.

Required cases:

- Long content and missing optional content.
- Grouped venues and separate ceremony/reception.
- Generic envelope, editorial cover, persisted-open state, and `?skipEnvelope=true`.
- JavaScript disabled: content remains visible and the envelope offers a usable fallback.
- `IntersectionObserver` unavailable or failing: progressive content fails open.
- Reduced motion: no required content or action depends on animation.
- Keyboard navigation, visible focus, and correct reading/order semantics.
- Maps, WhatsApp templates, personalized passes, RSVP, gallery navigation, image crops, and image
  loading priority.
- Anonymous request and `?invite=` personalized request. Anonymous HTML uses the correctness-first
  `public, max-age=0, s-maxage=0, must-revalidate` policy: browsers and shared caches may store it
  but must revalidate before reuse. This prioritizes publication freshness over CDN cache-hit rate;
  confirm the effective Vercel behavior after deployment. Personalized responses remain
  `no-store, private`.

## 7. Publish

The editor first requests a server-side publication preflight. It maps the effective draft through
the canonical draft-to-published mapper, normalizes representational noise (including
null/empty/derived upload URLs), compares it with the published projection, and returns only
meaningful changed editor sections plus a reviewed draft revision, published version, public
metadata hash (`slug` + `title`), and projection hash. It is authorized, read-only, and responds
with `Cache-Control: no-store, private`. The confirmation modal presents that server result; it
never infers a change from hydrated section provenance.

Labels are ordered and de-duplicated by the canonical section registry. The modal renders them
verbatim; it does not append, rename, regroup, or calculate sections client-side. `photoNotes` is
draft-only and excluded from the public comparison. It stays open for preflight, publication,
conflict, validation, maintenance (`upgrade_required`), and transient failures. Only centrally
classified transient failures offer retry; success remains visible in the dialog.

`guestCap` is the configurable maximum **total** attendees selectable in one RSVP response,
including the named guest. Any positive integer supported by the PostgreSQL `integer` column is
valid. The editor, public RSVP runtime, dashboard guest operations, and database constraints share
that contract without a smaller product-level clamp.

| Route or response                                                                       | Cache-Control                                    |
| --------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Anonymous invitation                                                                    | `public, max-age=0, s-maxage=0, must-revalidate` |
| Personalized invitation, metadata, token capture, dashboard preview                     | `no-store, private`                              |
| Preflight, publication, RSVP/context/view APIs                                          | `no-store, private`                              |
| Invalid type, missing invitation, authorization failure, validation/conflict, redirects | `no-store, private`                              |

`publishDraft()` performs these gates before the write:

1. Invitation and draft exist and are not archived/deleted.
2. Draft status is exactly `draft`.
3. Owner, slug, preset/event-type, schema, content, RSVP, and asset invariants pass.
4. Uploaded references are frozen to public URLs and asset delivery policy passes.
5. The `(event_type, slug)` does not belong to another invitation.

The repository then calls `publish_invitation_atomic` with the reviewed draft timestamp, published
version, public-metadata hash, projection hash, and a client-generated UUID idempotency key. In one
transaction the RPC locks the invitation, draft, and published row; rejects stale or non-draft
state; synchronizes the RSVP event; creates or versions published content; marks the invitation
published; and marks the draft approved. `invitation_publication_idempotency` stores the key as its
primary key, bound to invitation, draft revision, projection hash, and resulting content/version.
Retrying the exact confirmed request returns that stored publication without incrementing its
version; reuse with different parameters is rejected. Contact-only changes do not alter the public
metadata hash and therefore do not invalidate a confirmation.

- Success is all-or-nothing and returns the approved draft plus published version metadata.
- Failure commits none of those state changes.
- A network failure with no success response is safe to retry with the same confirmation while the
  editor remains open; a changed revision requires a fresh preflight.
- Republication requires an editable `draft` again; it increments the published version.
- Concurrent or stale publication returns 409. Reload; never force the timestamp or update tables
  independently.

## 8. Migrations and deployment

Required order:

1. Validate migrations in the disposable/local environment.
2. Back up and apply required migrations in production through the authorized migration workflow.
3. Verify the RPC signature, execute grants, tables/columns, constraints, bucket limit, and
   migration history.
4. Deploy application code that depends on those migrations.
5. Run the production smoke tests below and inspect Vercel/Supabase logs.

Application code must not be deployed before its required database migration. In particular,
reviewed atomic publication requires `20260717193000_publication_preflight_integrity.sql` (after
`20260715210301_atomic_invitation_publication.sql`), and asset metadata gating requires
`20260715210512_invitation_asset_delivery_gate.sql`.

Production migration state is never inferred from files or local state. If it was not checked with
authorized production access, report it as **unverified/pending**. Do not apply production
migrations without explicit authorization.

## 9. Production smoke tests

Capture URL, timestamp, response status, cache header, published version, and relevant log request
IDs for each test.

1. Create a valid invitation and confirm its draft/editor route.
2. Attempt an incompatible preset/event type; expect 422 and no new record.
3. Upload a valid JPEG/PNG/WebP and verify normalized WebP metadata.
4. Upload a spoofed, undersized, oversized, or corrupt image; expect 422 and no asset row.
5. Publish a valid new invitation and verify invitation, RSVP event, snapshot, and draft state.
6. Edit through a new draft and republish; verify version increment and availability.
7. Attempt to publish a stale draft; expect 409 and unchanged published state.
8. Open the anonymous route; verify 200, complete content, and public cache policy.
9. Open a personalized route/short link; verify guest data and `no-store, private` isolation.
10. Test generic and editorial envelopes plus `?skipEnvelope=true`.
11. Submit RSVP once through the supported mode and verify the dashboard result.
12. Open every map provider and WhatsApp link with correctly encoded data.
13. Open a legacy valid invitation and confirm read-time schema validation preserves rendering.
14. Inject an invalid published fixture only in a disposable/test environment; expect the controlled
    unavailable state, no malformed payload in logs, and no public/personalized cache.
15. Inspect Vercel function logs and Supabase API/Postgres logs for errors, latency, and RPC
    markers.

## 10. Rollback and incident handling

- Application code and CSS can be rolled back by promoting the last known-good Vercel deployment.
  Preserve the database migrations; migration history is append-only.
- A database correction requires a new forward migration. Never edit or delete an applied migration
  or drop a compatibility object without production-consumer evidence.
- A failed atomic publication leaves the previous published snapshot available. Reload state,
  capture the error marker and IDs, correct the draft or dependency, and retry.
- Suspect partial state only when writes bypassed the RPC or an older deployment was used. Compare
  invitation status, draft status/timestamp, published version/timestamp, and RSVP event linkage.
- If malformed stored content is detected, preserve the published row and logs, remove it from
  public caching, repair through a reviewed draft/republish or forward data migration, and verify
  the prior public version remains recoverable.

Before corrective changes capture: current deployment ID/commit, route and cache headers, migration
history, relevant row IDs and timestamps (without client payloads), published version, draft
timestamp/status, and Vercel/Supabase request IDs.
