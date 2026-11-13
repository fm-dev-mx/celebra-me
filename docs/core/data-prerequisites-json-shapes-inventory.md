# Data prerequisites: JSON shapes and storage objects not yet covered (draft)

Status: draft inventory for owner decision. It does not change `supabase/data-prerequisites.json`
and adds no checks. Origin: the "Not covered" section of PR 884 (tasks T1021, T1037).

The manifest only covers Auth `app_metadata` keys (see
[`release-process.md`](./release-process.md#data-prerequisites)). This document lists the other
places where released code assumes the shape of stored data: `jsonb` table columns and storage
objects. Method: `jsonb` columns found in `supabase/migrations/` (table columns, not function
variables), then the readers found under `src/` and `scripts/` (`supabase/functions/` does not exist
in this repository). Nothing was read from any database.

Risk = chance that real stored data differs from what the code assumes, times the damage when it
does. Confidence says how well the reader was traced: **traced** (read the reader), **partial**
(found the select, did not follow the shape use), **no reader** (written or read only by SQL or
schema defaults; no runtime code assumes an internal JSON shape).

## JSON columns

- **#:** 1
  - **Table.column:** `published_invitation_content.content`
  - **Reader (file):** `src/lib/intake/repositories/published-invitation-content.repository.ts`,
    `src/lib/invitation/access/invitation-access.repository.ts`,
    `src/lib/intake/services/invitation.service.ts`;
    `scripts/invitation/verify-published-images.ts:288`,
    `scripts/provision/invitation-import-engine.ts:1004,1190,1802`,
    `scripts/provision/preview/preview-receipt-state-query.ts:234`,
    `scripts/manual/data-prerequisites/20260812_itinerary_gallery.sql`; `supabase/functions/`: none
    (no edge functions directory)
  - **Assumed shape:** Object that renders as a full invitation; `hero.date`, `eventTiming` and
    `rsvp` read by path through PostgREST (`content->hero->>date`). Typed `Record<string, unknown>`,
    not validated at read.
  - **Risk:** High
  - **Confidence:** traced (partly covered by `20260812-itinerary-gallery-structural-contracts`)
- **#:** 2
  - **Table.column:** `invitation_content_drafts.content`
  - **Reader (file):** `src/lib/intake/repositories/invitation-content-draft.repository.ts`,
    `invitation.service.ts`; `scripts/provision/invitation-import-engine.ts:750,1205,1802`,
    `scripts/provision/preview-provenance-receipt-service.ts:124,368`,
    `scripts/provision/preview/preview-receipt-state-query.ts:233`,
    `scripts/manual/data-prerequisites/20260812_itinerary_gallery.sql`; `supabase/functions/`: none
  - **Assumed shape:** Same content object, read by the host editor and the publish step; same path
    reads for `rsvp`, `eventTiming`, `hero.date`.
  - **Risk:** High
  - **Confidence:** traced
- **#:** 3
  - **Table.column:** `invitation_data_requests.answers`
  - **Reader (file):** `src/lib/invitation-data/repository.ts`;
    `scripts/manual/data-prerequisites/20261111_invitation_data_request_answers.sql:10`;
    `supabase/functions/`: none
  - **Assumed shape:** Object of the customer questionnaire answers; the reader does
    `row.answers ?? {}` and trusts the keys afterwards.
  - **Risk:** Med
  - **Confidence:** partial
- **#:** 4
  - **Table.column:** `tracking_events.event_properties`
  - **Reader (file):** `src/lib/commercial/quote-reminders.service.ts`,
    `src/lib/tracking/demo-engagement.server.ts`, `demo-conversion-report.server.ts`;
    `scripts/manual/data-prerequisites/20261111_tracking_event_lead_code.sql:9`,
    `scripts/manual/production-patches/20261112_tracking_events_blank_lead_code.sql:11`;
    `supabase/functions/`: none
  - **Assumed shape:** Object with `lead_code` (filtered with `event_properties->>lead_code`) and
    demo identifiers; a missing key silently drops the event from reminders and reports.
  - **Risk:** Med
  - **Confidence:** traced (query level)
- **#:** 5
  - **Table.column:** `tracking_events.consent_snapshot`, `visitor_sessions.consent_snapshot`
  - **Reader (file):** `src/lib/commercial/meta-capi/service.ts`; `scripts/`: none;
    `supabase/functions/`: none
  - **Assumed shape:** Object with boolean `marketing`; only `=== true` sends a conversion. Wrong
    shape fails closed (no send), so the harm is lost conversions, not leaks.
  - **Risk:** Med
  - **Confidence:** traced
- **#:** 6
  - **Table.column:** `meta_ads_insights_daily.raw`, `meta_organic_insights_daily.raw`
  - **Migration:** `supabase/migrations/20261025040000_meta_insights_daily.sql:6,21`
  - **Reader (file:line):**
    - `src/lib/meta/insights-dashboard.server.ts:21,25` (selects `raw`), evaluated in
      `src/lib/meta/insights-dashboard.ts:69-76` (`raw.spend`, `raw.clicks`,
      `raw.page_total_media_view_unique`, `raw.reach` via `finite()`, safely defaulting to `null`)
    - `src/lib/meta/weekly-review.server.ts:25` (selects `raw` where
      `attribution_window='weekly_review_v1'`), parsed strictly with `metaWeeklyReviewSchema.parse`
      in `src/lib/meta/weekly-review.ts:14-41`
    - `src/lib/commercial/meta-capi/estimated-lead-value.ts:164` (selects `raw` where
      `attribution_window=ESTIMATED_LEAD_VALUE_SNAPSHOT_WINDOW`, checks `month` and
      `typeof estimatedValue === 'number'`)
    - `scripts/`: none
    - `supabase/functions/`: none (no edge functions directory)
  - **Assumed shape:** Three distinct shapes depending on window/row: (1) Daily collector aggregate
    object (`spend`, `clicks` numbers; reach metrics), defensively parsed; (2) Weekly review
    snapshot object matching `metaWeeklyReviewSchema` (version, startDate, endDate, generatedAt,
    quality, insights, commercial, notice); (3) Monthly estimated lead value calculation snapshot
    object (`month`, `estimatedValue`).
  - **Risk:** Med
  - **Confidence:** traced
- **#:** 7
  - **Table.column:** `platform_usage_snapshots.payload`
  - **Reader (file):** `src/lib/platform/server/platform-usage.service.ts`; `scripts/`: none;
    `supabase/functions/`: none
  - **Assumed shape:** Object; read with `isRecord` and a path helper, missing parts degrade to
    blank meters.
  - **Risk:** Low
  - **Confidence:** traced (defensive)
- **#:** 8
  - **Table.column:** `invitation_mutation_operation_receipts.completed_steps`, `input_hashes`,
    `expected_state`, `result`, `sanitized_error`
  - **Reader (file):** `src/lib/intake/repositories/mutation-operation.repository.ts`;
    `scripts/provision/apply-local-invitation.ts:591,597`,
    `scripts/provision/preview-provenance-receipt-service.ts:740,742,753`,
    `scripts/provision/preview/preview-receipt-state-query.ts:236,237`,
    `scripts/status-core/promotional-evidence.ts:226,244`; `supabase/functions/`: none
  - **Assumed shape:** `completed_steps` is a string array (`?? []`); the rest are written by the
    same code and read back by the resume path.
  - **Risk:** Low
  - **Confidence:** partial
- **#:** 9
  - **Table.column:** `managed_invitation_release_provenance.managed_projection`
  - **Reader (file):** `src/lib/intake/repositories/managed-release-provenance.repository.ts`;
    `scripts/provision/apply-local-invitation.ts:581,792`,
    `scripts/provision/invitation-import-engine.ts:1213,1321-1323`,
    `scripts/provision/preview-provenance-receipt-service.ts:123-124,366-368,408-410,445`,
    `scripts/provision/preview/preview-receipt-state-query.ts:206,235`,
    `scripts/status-core/promotional-evidence.ts:166-168,196-198`; `supabase/functions/`: none
  - **Assumed shape:** Nullable; the code writes `null` on reset. In scripts, compared with draft
    content or verified as `jsonb_typeof = 'object'`.
  - **Risk:** Low
  - **Confidence:** traced
- **#:** 10
  - **Table.column:** `invitation_assets.provider_metadata`
  - **Migration:** `supabase/migrations/20260725000000_invitation_assets_cloudinary_provider.sql:15`
  - **Reader (file:line):**
    - `src/lib/intake/repositories/asset.repository.ts`,
      `src/lib/intake/services/asset-delivery.ts`: no reader (`provider_metadata` is not in
      `SELECT_COLUMNS`; delivery uses `provider`, `bucket`, `storage_path`, and `secure_url`)
    - `scripts/provision/apply-local-invitation.ts:637,1460`: selected in raw column query and
      written on insert (`{ storage_provider: 'supabase_local' }`), but no inner keys read
    - `scripts/provision/invitation-import-engine.ts:354,381`: selected and assigned to
      `providerMetadata` property; no inner keys read
    - `scripts/provision/asset-reconciliation.ts:45`: interface definition only; no inner keys read
    - `supabase/functions/`: none (no edge functions directory)
  - **Assumed shape:** Default `'{}'::jsonb`. Legacy column introduced for Cloudinary integration
    (Cloudinary provider was retired in `20261019180000` / `20261025220000`). No reader across
    `src/`, `scripts/`, or edge functions assumes any JSON shape or reads any key.
  - **Risk:** Low
  - **Confidence:** traced
- **#:** 11
  - **Table.column:** `guest_invitations.metadata`
  - **Reader (file):** RSVP dashboard (`src/components/dashboard/guests/*`), bulk import RPC;
    `scripts/`: none; `supabase/functions/`: none
  - **Assumed shape:** `needs_review` and `import_source` keys written by the bulk-create RPC;
    default `{}`. Reader use not traced.
  - **Risk:** Low
  - **Confidence:** partial
- **#:** 12
  - **Table.column:** `invitation_engagement_snapshots.design`
  - **Reader (file):** `src/lib/rsvp/engagement/engagement-ranking.service.ts`; `scripts/`: none;
    `supabase/functions/`: none
  - **Assumed shape:** Nullable object (design identity of the invitation). Not traced.
  - **Risk:** Low
  - **Confidence:** partial
- **#:** 13
  - **Table.column:** `event_memory_items.metadata`, `event_memory_*` JSON
  - **Reader (file):** `src/lib/memories/server/catalog.repository.ts`; `scripts/`: none;
    `supabase/functions/`: none
  - **Assumed shape:** Default `{}`. Not traced.
  - **Risk:** Low
  - **Confidence:** partial
- **#:** 14
  - **Table.column:** `preview_approval_artifacts.expected_asset_hashes`, `hosted_validation`
  - **Reader (file):** `scripts/provision/preview-approval-store.ts:124,138-162`; no `src/` reader;
    `supabase/functions/`: none
  - **Assumed shape:** Hash map by asset id; validation result object.
  - **Risk:** Low
  - **Confidence:** traced
- **#:** 15
  - **Table.column:** `audit_logs.old_data`/`new_data`, `guest_invitation_audit.payload`,
    `guest_engagement_events.properties`
  - **Reader (file):** Written by RPCs and triggers; `quote-reminders.service.ts` reads `audit_logs`
    rows without the JSON; `scripts/`: none (only row counts/integrity); `supabase/functions/`: none
  - **Assumed shape:** Write-only audit trail; no code assumes their shape.
  - **Risk:** Low
  - **Confidence:** traced (no shape read)
- **#:** 16
  - **Table.column:** `intake_submissions.block_data`/`photo_notes`,
    `intake_requests.enabled_blocks`/`snapshot`, `invitation_projects.snapshot`
  - **Reader (file):** No reader in `src/`, `scripts/`, or `supabase/functions/` (claim codes and
    intake capture retired by `20261012200000`)
  - **Assumed shape:** Legacy.
  - **Risk:** None
  - **Confidence:** no reader in codebase

Risk changes from prior inventory: Row 10 (`invitation_assets.provider_metadata`) changed risk from
Med to Low (tracing confirmed no reader in `src/`, `scripts/`, or edge functions assumes any JSON
shape from the column; database default is `'{}'::jsonb`).

## Storage objects

- **#:** S1
  - **Store and bucket:** Supabase Storage, public bucket `invitation-assets`
  - **Reader (file):** `src/lib/intake/storage.ts`, `src/lib/intake/services/asset-delivery.ts`,
    `src/lib/invitation-data/service.ts`; `scripts/invitation/verify-published-images.ts`,
    `scripts/provision/apply-local-invitation.ts`, `scripts/provision/invitation-import-engine.ts`,
    `scripts/provision/legacy-storage-audit.ts`
  - **Assumed shape:** Every non-deleted `invitation_assets` row with provider Supabase has an
    object at `<bucket>/<storage_path>`; the code builds `/storage/v1/object/public/<bucket>/<path>`
    and never checks the object exists. A row without its object is a broken image on a published
    invitation. Bucket public and size limit are set by migration `20260715210512`.
  - **Risk:** High
  - **Confidence:** traced
- **#:** S2
  - **Store and bucket:** R2, event memories objects
  - **Reader (file):** `src/lib/memories/contract/object-key.ts`,
    `src/lib/memories/server/cleanup.service.ts`;
    `scripts/manual/data-prerequisites/20261111_event_memory_object_keys.sql:15`
  - **Assumed shape:** Keys follow `events/<event uuid>/<object uuid>.<ext>` plus a thumbnail key
    pattern; `event_memory_items` rows must match the key regex or they are rejected at read.
    Existing rows written before the key contract may not match.
  - **Risk:** Med
  - **Confidence:** partial
- **#:** S3
  - **Store and bucket:** R2 invitation media: Preview `celebra-me-invitation-media-staging`
    (`https://media-staging.celebra-me.com`), Production `celebra-me-invitation-media`
    (`https://media.celebra-me.com`). Each environment has its own `INVITATION_MEDIA` binding.
  - **Reader (file):** `src/lib/intake/services/r2-invitation-media.ts`,
    `src/lib/invitation/hero-image-preload.ts`, `src/lib/intake/services/asset-delivery.ts`;
    `scripts/invitation/verify-published-images.ts`; widths defined in
    `src/lib/images/responsive-variants.ts`
  - **Assumed shape:** Original keys are
    `invitations/<eventType>/<slug>/<asset-key>-<sha256>.<ext>`, with a 64-character lowercase hex
    digest. Supported extensions are `webp`, `jpg`, `png`, `mp3` and `m4a`. Image derivatives share
    the original's key stem and digest: `.w<width>.webp` for widths 480, 800, 1280 and 1920, and
    `.og.jpg` for a 1200x630 social card. Both buckets enable `responsiveVariants`, so eligible
    original image URLs advertise every width in `srcset`; the hero preload consumes the same
    variants without checking existence. R2 delivery requires `secure_url`, and URL construction
    alone proves neither the original nor its derivatives exist. Missing objects break published
    images, hero preloads or social cards; S1's Supabase-only check cannot detect them.
  - **Risk:** High
  - **Confidence:** traced (key builders, delivery and hero preload; no bucket contents inspected)

## Proposal: what enters the manifest

Each accepted item becomes its own task (per the owner decision of 2026-11-09), with a read-only
`verify` command that prints only totals, as `pnpm auth:check-login-alias` does. Suggested order:

1. **S1** `invitation-assets` objects exist for every live asset row. Highest user-visible damage;
   check is a join of `invitation_assets` against `storage.objects` (totals only).
2. **S3** referenced R2 originals exist in the target environment's invitation-media bucket, along
   with every advertised width variant and referenced social card. Propose a separate read-only
   check that derives keys from live R2 asset rows and published content references, validates
   bucket/origin and digest-key consistency, and checks object existence (totals only). A
   `storage.objects` join cannot cover R2. Owner approval and a separate implementation task remain
   pending; this inventory adds no check and does not accept missing R2 media as a risk.
3. **#1 and #2** content objects: every published and draft `content` has the paths the code reads
   (`hero.date`, `eventTiming`, `rsvp`). Extends the existing `20260812` prerequisite instead of
   duplicating it.
4. **#4** `tracking_events.event_properties.lead_code` present where the quote reminder expects it.
5. **#3** `invitation_data_requests.answers` is an object on every row.
6. **S2** every `event_memory_items` object key matches the key contract.

Suggested not to declare: #5 (fails closed), #7, #8, #9, #10 (no code assumes shape; risk Low), #11
to #13 (defaults and defensive readers), #14 and #15 (no `src/` assumption), #16 (legacy). #6
remains Med risk due to strict schema parsing in weekly review (`metaWeeklyReviewSchema.parse`), but
targets internal review reporting rather than guest-facing invitations.

## Limits of this inventory

- It was built from migrations and search over `src/` and `scripts/`; `supabase/functions/` does not
  exist in this repository. No database or bucket was read, so no claim here says stored data is
  wrong, only that code assumes a shape.
- Items marked partial were not followed to every field use.
