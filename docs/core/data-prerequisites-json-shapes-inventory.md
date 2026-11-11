# Data prerequisites: JSON shapes and storage objects not yet covered (draft)

Status: draft inventory for owner decision. It does not change `supabase/data-prerequisites.json`
and adds no checks. Origin: the "Not covered" section of PR 884 (tasks T1021, T1037).

The manifest only covers Auth `app_metadata` keys (see
[`release-process.md`](./release-process.md#data-prerequisites)). This document lists the other
places where released code assumes the shape of stored data: `jsonb` table columns and storage
objects. Method: `jsonb` columns found in `supabase/migrations/` (table columns, not function
variables), then the readers found under `src/lib/`. Nothing was read from any database.

Risk = chance that real stored data differs from what the code assumes, times the damage when it
does. Confidence says how well the reader was traced: **traced** (read the reader), **partial**
(found the select, did not follow the shape use), **no reader in `src/`** (written or read only by
SQL, scripts or edge functions; not traced here).

## JSON columns

- **#:** 1
  - **Table.column:** `published_invitation_content.content`
  - **Reader (file):** `src/lib/intake/repositories/published-invitation-content.repository.ts`,
    `src/lib/invitation/access/invitation-access.repository.ts`,
    `src/lib/intake/services/invitation.service.ts`
  - **Assumed shape:** Object that renders as a full invitation; `hero.date`, `eventTiming` and
    `rsvp` read by path through PostgREST (`content->hero->>date`). Typed `Record<string, unknown>`,
    not validated at read.
  - **Risk:** High
  - **Confidence:** traced (partly covered by `20260812-itinerary-gallery-structural-contracts`)
- **#:** 2
  - **Table.column:** `invitation_content_drafts.content`
  - **Reader (file):** `src/lib/intake/repositories/invitation-content-draft.repository.ts`,
    `invitation.service.ts`
  - **Assumed shape:** Same content object, read by the host editor and the publish step; same path
    reads for `rsvp`, `eventTiming`, `hero.date`.
  - **Risk:** High
  - **Confidence:** traced
- **#:** 3
  - **Table.column:** `invitation_data_requests.answers`
  - **Reader (file):** `src/lib/invitation-data/repository.ts`
  - **Assumed shape:** Object of the customer questionnaire answers; the reader does
    `row.answers ?? {}` and trusts the keys afterwards.
  - **Risk:** Med
  - **Confidence:** partial
- **#:** 4
  - **Table.column:** `tracking_events.event_properties`
  - **Reader (file):** `src/lib/commercial/quote-reminders.service.ts`,
    `src/lib/tracking/demo-engagement.server.ts`, `demo-conversion-report.server.ts`
  - **Assumed shape:** Object with `lead_code` (filtered with `event_properties->>lead_code`) and
    demo identifiers; a missing key silently drops the event from reminders and reports.
  - **Risk:** Med
  - **Confidence:** traced (query level)
- **#:** 5
  - **Table.column:** `tracking_events.consent_snapshot`, `visitor_sessions.consent_snapshot`
  - **Reader (file):** `src/lib/commercial/meta-capi/service.ts`
  - **Assumed shape:** Object with boolean `marketing`; only `=== true` sends a conversion. Wrong
    shape fails closed (no send), so the harm is lost conversions, not leaks.
  - **Risk:** Med
  - **Confidence:** traced
- **#:** 6
  - **Table.column:** `meta_ads_insights_daily.raw`, `meta_organic_insights_daily.raw`
  - **Reader (file):** `src/lib/meta/insights-dashboard.server.ts`,
    `src/lib/meta/weekly-review.server.ts`
  - **Assumed shape:** Provider response object (DB check: `jsonb_typeof = 'object'`); the dashboard
    and weekly review read provider metric keys from it.
  - **Risk:** Med
  - **Confidence:** partial
- **#:** 7
  - **Table.column:** `platform_usage_snapshots.payload`
  - **Reader (file):** `src/lib/platform/server/platform-usage.service.ts`
  - **Assumed shape:** Object; read with `isRecord` and a path helper, missing parts degrade to
    blank meters.
  - **Risk:** Low
  - **Confidence:** traced (defensive)
- **#:** 8
  - **Table.column:** `invitation_mutation_operation_receipts.completed_steps`, `input_hashes`,
    `expected_state`, `result`, `sanitized_error`
  - **Reader (file):** `src/lib/intake/repositories/mutation-operation.repository.ts`
  - **Assumed shape:** `completed_steps` is a string array (`?? []`); the rest are written by the
    same code and read back by the resume path.
  - **Risk:** Low
  - **Confidence:** partial
- **#:** 9
  - **Table.column:** `managed_invitation_release_provenance.managed_projection`
  - **Reader (file):** `src/lib/intake/repositories/managed-release-provenance.repository.ts`
  - **Assumed shape:** Nullable; the code writes `null` on reset. Readers not traced.
  - **Risk:** Low
  - **Confidence:** partial
- **#:** 10
  - **Table.column:** `invitation_assets.provider_metadata`
  - **Reader (file):** `src/lib/intake/repositories/asset.repository.ts`,
    `src/lib/intake/services/asset-delivery.ts`
  - **Assumed shape:** Default `{}`; no JSON fields read by these files. The current providers are
    Supabase and R2: the repository selects separate `provider`, `bucket`, `storage_path` and
    `secure_url` columns, not `provider_metadata`. Delivery requires R2 `secure_url`; Supabase uses
    `secure_url` or builds a public URL from bucket and path. Other readers remain untraced.
  - **Risk:** Med
  - **Confidence:** partial
- **#:** 11
  - **Table.column:** `guest_invitations.metadata`
  - **Reader (file):** RSVP dashboard (`src/components/dashboard/guests/*`), bulk import RPC
  - **Assumed shape:** `needs_review` and `import_source` keys written by the bulk-create RPC;
    default `{}`. Reader use not traced.
  - **Risk:** Low
  - **Confidence:** partial
- **#:** 12
  - **Table.column:** `invitation_engagement_snapshots.design`
  - **Reader (file):** `src/lib/rsvp/engagement/engagement-ranking.service.ts`
  - **Assumed shape:** Nullable object (design identity of the invitation). Not traced.
  - **Risk:** Low
  - **Confidence:** partial
- **#:** 13
  - **Table.column:** `event_memory_items.metadata`, `event_memory_*` JSON
  - **Reader (file):** `src/lib/memories/server/catalog.repository.ts`
  - **Assumed shape:** Default `{}`. Not traced.
  - **Risk:** Low
  - **Confidence:** partial
- **#:** 14
  - **Table.column:** `preview_approval_artifacts.expected_asset_hashes`, `hosted_validation`
  - **Reader (file):** scripts (release tooling), no `src/` reader
  - **Assumed shape:** Hash map by asset id; validation result object.
  - **Risk:** Low
  - **Confidence:** no reader in `src/`
- **#:** 15
  - **Table.column:** `audit_logs.old_data`/`new_data`, `guest_invitation_audit.payload`,
    `guest_engagement_events.properties`
  - **Reader (file):** Written by RPCs and triggers; `quote-reminders.service.ts` reads `audit_logs`
    rows without the JSON
  - **Assumed shape:** Write-only audit trail; no code assumes their shape.
  - **Risk:** Low
  - **Confidence:** traced (no shape read)
- **#:** 16
  - **Table.column:** `intake_submissions.block_data`/`photo_notes`,
    `intake_requests.enabled_blocks`/`snapshot`, `invitation_projects.snapshot`
  - **Reader (file):** No reader in `src/` (claim codes and intake capture retired by
    `20261012200000`)
  - **Assumed shape:** Legacy.
  - **Risk:** None
  - **Confidence:** no reader in `src/`

## Storage objects

- **#:** S1
  - **Store and bucket:** Supabase Storage, public bucket `invitation-assets`
  - **Reader (file):** `src/lib/intake/storage.ts`, `src/lib/intake/services/asset-delivery.ts`,
    `src/lib/invitation-data/service.ts`
  - **Assumed shape:** Every non-deleted `invitation_assets` row with provider Supabase has an
    object at `<bucket>/<storage_path>`; the code builds `/storage/v1/object/public/<bucket>/<path>`
    and never checks the object exists. A row without its object is a broken image on a published
    invitation. Bucket public and size limit are set by migration `20260715210512`.
  - **Risk:** High
  - **Confidence:** traced
- **#:** S2
  - **Store and bucket:** R2, event memories objects
  - **Reader (file):** `src/lib/memories/contract/object-key.ts`,
    `src/lib/memories/server/cleanup.service.ts`
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
    `src/lib/invitation/hero-image-preload.ts`, `src/lib/intake/services/asset-delivery.ts`; widths
    defined in `src/lib/images/responsive-variants.ts`
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

Suggested not to declare: #5 (fails closed), #7, #8, #9, #11 to #13 (defaults and defensive
readers), #14 and #15 (no `src/` assumption), #16 (legacy). #6 and #10 need a tracing pass before
deciding; both are listed as partial above.

## Limits of this inventory

- It was built from migrations and `rg` over `src/lib`; no database or bucket was read, so no claim
  here says stored data is wrong, only that code assumes a shape.
- Items marked partial or no trace were not followed to every field use.
- `scripts/` and `supabase/functions/` readers were not searched.
