---
title: Invitation engagement analytics — phase 1 (opens, previews, RSVP funnel, permanent snapshots)
status: active
created: 2026-10-10
updated: 2026-10-10
type: implementation
autonomy: 2
related_docs:
  - docs/domains/rsvp/engagement-analytics.md
  - docs/domains/rsvp/architecture.md
  - docs/domains/rsvp/database.md
  - docs/domains/tracking/commercial-attribution.md
  - docs/database-workflow.md
  - .agent/rules/database.md
---

# Invitation engagement analytics — phase 1

## 1. Objective

Give hosts a trustworthy, privacy-preserving answer to "who opened my invitation, how many times,
and where did they stop" by recording first-party, guest-scoped engagement events with explicit
metric definitions, and surfacing a send → preview → open → RSVP funnel in the host dashboard.

Success looks like: for any guest link, the dashboard shows real opens (not scroll noise), excludes
host/staff/bot/Preview traffic, and every number shown maps to one documented metric definition.

Secondary objective: keep a **permanent, anonymous, per-invitation engagement snapshot** (aggregates
plus the invitation's design attributes) so that, once enough history exists, Celebra-me can compare
invitations and designs fairly. Phase 1 only starts collecting snapshots; the internal ranking view
is phase 2.

## 2. Known evidence (established 2026-10-10, do not re-audit without cause)

Current pipeline (all three writers hit `track_guest_invitation_view_public`,
`supabase/migrations/20260730113000_public_guest_rsvp_atomic_rpc.sql:161-215`):

| Writer        | Location                                         | Problem                                                                                                               |
| ------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| A. SSR render | `src/lib/invitation/route-personalization.ts:81` | Fires on every `?invite=` render, including bots/prefetch/link previews of the long URL; no UA, session, or env check |
| B. RSVP mount | `src/hooks/use-rsvp-submission.ts:104-111`       | Fires only when RSVP section becomes visible (`client:visible`); duplicate of A                                       |
| C. Scroll     | `src/lib/invitation/engagement.ts`               | Forced report at 1 s + throttled section progress; no unload flush; no tests                                          |

- Every RPC call changes `last_viewed_at`, so the audit trigger
  (`20260402010100_rsvp_engagement_standardization.sql:44-126`) writes one `viewed` row per call.
  Example: `/i/CHEKWNGB` (test guest, `mia-pintor`) has 114 `viewed` rows ≈ 13–17 real visits.
- `/api/invitacion/[inviteId]/view.ts` has no auth (inviteId uuid is the credential), rate limit
  120/60 s per invite+IP hash (in-memory unless Upstash flag), returns 200 even for unknown invites.
- Short-link crawler branch (`src/lib/invitation/short-id-resolver.ts:84`) records nothing; share
  links prefer `/i/{shortId}` (`src/utils/invitation-link.ts:30-49`). Crawler regex includes
  `instagram`, which may match the Instagram in-app browser (real humans) — unverified.
- Commercial tracking (`src/lib/tracking/*`, `tracking_events`) deliberately excludes personalized
  invitations (`docs/domains/tracking/commercial-attribution.md:78-130`). Guest engagement must stay
  a separate mechanism; do not route it through commercial tracking, GA4, or Meta.
- `rsvpApi.trackAction` posts to `/api/rsvp/channel`, which does not exist (dead telemetry).
- No session detection on invitation routes; `sb-access-token` cookie is sent there
  (`src/middleware.ts:120-128`); `getSessionContextFromRequest`
  (`src/lib/rsvp/auth/auth.ts:145-150`) can validate it. Host-of-event = `events.owner_user_id` or
  active `event_memberships`, or `super_admin`.
- `guest_invitations` / `guest_invitation_audit`: service_role has SELECT only; writes go through
  SECURITY DEFINER functions. Future tables get default full DML for service_role
  (`20260715210600…:67`), so new tables must revoke explicitly (template:
  `20260930180000_event_memories_catalog.sql:138-162`).
- No retention/purge exists for guest data; the only cron is `/api/cron/memories-cleanup`. `events`
  has no event-date column (date lives in published content; see §5).
- Privacy page (`src/pages/privacidad.astro`) does not mention guest engagement tracking.
- Dashboard: totals in `buildDashboardTotals`
  (`src/lib/rsvp/services/dashboard-guests.service.ts:50-107`), stages in
  `guest-presenter.ts:178-264`, KPI panel `GuestStatusOverview.tsx:167-192`; `viewPercentage` is
  never displayed.

## 3. Design principles

1. **Append-only event log + derived projections.** Raw events are immutable facts; per-guest
   counters and dashboard aggregates are projections that can be rebuilt from the log.
2. **Closed, versioned event taxonomy.** `object_action` names, a fixed property schema per event,
   validated at the edge (zod) and in the DB (check constraints). Unknown events are rejected, not
   stored.
3. **Metrics are defined once.** A metrics dictionary doc is the SSOT for every number the UI shows
   (definition, source events, filters, window). UI copy never invents a metric.
4. **Measure intent, not requests.** An "open" is a client-confirmed page view (JS ran, page
   visible), not an SSR render. Bots and prefetches are excluded by construction, then by
   classification.
5. **Classify, don't silently drop.** Each event carries a `traffic_class`
   (`guest | host | test | bot | non_production`); metrics filter to `guest`. This keeps exclusions
   auditable and lets definitions change without data loss.
6. **Idempotent ingestion.** Client-generated `client_event_id` (uuid v4) with a unique constraint;
   retries and `sendBeacon` duplicates are no-ops.
7. **Data minimization.** No IP, no raw user agent, no free text. Only coarse `device_class`
   (`mobile | tablet | desktop | unknown`), crawler family for previews, and bounded integers.
   Bounded retention for raw events.
8. **Isolation.** Guest engagement never feeds commercial attribution, GA4, or Meta, and never joins
   `tracking_events`.
9. **Fail-open for guests, fail-closed for data.** Tracking failures never affect page rendering or
   RSVP; invalid payloads are rejected and counted, never coerced.
10. **Expand → migrate → contract.** New path ships alongside legacy columns (dual-write), legacy
    writers are removed only after the new path is verified in Production.

## 4. Event taxonomy and metrics (SSOT moved)

The event taxonomy, traffic classification, metrics dictionary, comparison rules, storage tiers,
retention, event-date derivation, and snapshot design attributes are owned by
[`docs/domains/rsvp/engagement-analytics.md`](../../../docs/domains/rsvp/engagement-analytics.md).
This plan only sequences their implementation; if the two disagree, the domain doc wins and this
plan must be corrected.

## 5. Goal 1 findings (G0, 2026-10-10)

- **Event date.** `sharing.eventDate` does not exist. The canonical resolver is
  `resolveInvitationSchedule` (`src/lib/intake/invitation-validity.ts:57-86`):
  `eventTiming.localDateTime` → `eventTiming.startsAtUtc` in `eventTiming.timeZone` (default
  `America/Chihuahua`) → legacy `hero.date`. `getSharingConfigForSlug`
  (`src/lib/rsvp/services/shared/invitation-helpers.ts:198-228`, via `extractEventDate` at
  `:128-133`) reads `hero.date` only — inconsistent; switch it to `events.event_date` in G1/G5.
- **Writing `event_date` on publish.** `publish_invitation_atomic` (11-arg, live definition in
  `20260717193000_publication_preflight_integrity.sql:54-190`) updates/inserts `events` at
  `:162-172`. Decision (revised in G1): derive the date in SQL through
  `public.invitation_event_date(p_content jsonb) returns date` and keep it current with an AFTER
  trigger on `published_invitation_content`, which covers every content writer (publication RPC,
  scripts, manual patches) without redefining the large publication function. A shared fixture
  (`tests/fixtures/engagement/invitation-event-date-cases.json`) is replayed against
  `resolveInvitationSchedule` (unit) and the SQL helper (disposable DB) to keep them equal.
  Backfill: one idempotent statement in the expand migration over the newest live published content.
- **Design attributes.** Paths confirmed (see domain doc): `theme.preset`/`fontFamily`,
  `templateId`, `visualProfileId`, rendered `sectionOrder` keys, section `variant`s, `music`,
  `rsvp.accessMode`/`confirmationMode`. No dress-code field exists; not captured. Real invitation
  content lives only in `published_invitation_content.content` (repo content is demo-only).
- **Share links** embed `/i/{shortId}` when present (`src/utils/invitation-link.ts:40-41`), so
  WhatsApp previews hit the crawler branch of the short-id resolver.
- **`rsvp_submitted` emit point.** `persistRsvpResponse`
  (`src/lib/rsvp/services/rsvp-submission.service.ts:139-211`), after the success log at `:186`;
  covers personalized and hybrid public submissions.
- **Test guests.** Considered the existing hidden `system:` tag mechanism
  (`src/lib/guests/guest-tags.ts`); chose a typed `is_test` column (cheap RPC check, explicit
  dashboard checkbox, indexable). Form: `src/components/dashboard/guests/GuestFormModal.tsx`; APIs:
  `POST /api/dashboard/guests`, `PATCH /api/dashboard/guests/[guestId]`.
- **Open questions carried into G1/G4:** whether `instagram` in the crawler regex matches the
  Instagram in-app browser (verify with real UA fixtures); whether `authenticated` can read
  `guest_invitation_audit` in hosted DBs (grant revoked in `20260901000000…:14`).

## Goal mapping

Goal 1 (audit + specification) = G0, complete when this plan and the domain doc are accepted. Goal 2
(implementation + verification) = G1–G6. Goal 3 (cleanup + final verification) = G7 (contract of
legacy view telemetry, docs consolidation).

## 6. Architecture

```text
Browser (invitation page)                Server (Astro API)                 Postgres
─────────────────────────                ──────────────────                 ────────
invitation-analytics.ts ──POST batch──▶ /api/invitacion/[inviteId]/events
  page_view_id, client_event_id          zod validate envelope
  visibility + sendBeacon                 rate limit (reuse provider)
                                          classify traffic (env, host session, UA)
                                          ──rpc──▶ record_guest_engagement_events_public(...)
                                                     insert … on conflict (client_event_id) do nothing
                                                     update guest_invitations projections
                                                     (dual-write legacy first/last_viewed_at)
Short-link crawler branch ──fire-and-forget──▶ same RPC (invitation_link_previewed)
RSVP submit service ─────────────────────────▶ same RPC (rsvp_submitted)

Dashboard ──host token──▶ /api/dashboard/guests (+ engagement fields)
                         /api/dashboard/engagement-summary ──rpc (invoker, RLS)──▶ get_event_engagement_summary
```

### 6.1 Database (expand migration)

- `public.guest_engagement_events`: envelope columns from §4 plus
  `guest_invitation_id uuid not null references guest_invitations(id) on delete cascade` (nullable
  after anonymization) and `event_id uuid` (FK by `events.id`, denormalized for event-level
  aggregation). Check constraints for `event_name`, `traffic_class`, `device_class`,
  `schema_version`, and per-event `properties` shape. Unique `(client_event_id)`. Indexes:
  `(guest_invitation_id, occurred_at desc)`, `(event_id, event_name, occurred_at)`.
- RLS enabled + forced. `revoke all` from public, anon, authenticated, service_role; grant
  service_role `select, insert` only (append-only ledger pattern). No client read access: hosts read
  aggregates through the summary function, which uses projections only.
- Projection columns on `guest_invitations` (nullable/zero defaults, expand-safe):
  `open_count int not null default 0`, `first_opened_at`, `last_opened_at`, `last_previewed_at`,
  `max_progress_milestone smallint not null default 0`, `rsvp_form_viewed_at`,
  `rsvp_form_started_at`.
- Test guests (D5): `guest_invitations.is_test boolean not null default false`. The RPC forces
  `traffic_class = 'test'` for these guests; they are excluded from projections, host funnel, and
  snapshots. Dashboard: "Invitado de prueba" checkbox on create/edit; badge in the list.
- Event date (D7): `events.event_date date null`, written by the published-content trigger through
  `invitation_event_date(content)` and backfilled once from current published content (see §5).
  Index `(event_date)`.
- Raw events are anonymizable: `guest_invitation_id` is nullable, plus `anonymized_at timestamptz`.
  Check constraint: `guest_invitation_id is null` ⇔ `anonymized_at is not null`.
- `record_guest_engagement_events_public(p_invite_id text, p_events jsonb, p_viewer_user_id uuid)` —
  SECURITY DEFINER, classifies host (owner, active member, super admin) from the viewer id,
  `search_path = public`, execute granted to service_role only. Resolves invite by
  `invite_id = p_invite_id::uuid` (fixes the `invite_id::text` index bypass), rejects soft-deleted
  guests/events, inserts idempotently, updates projections only for `traffic_class = 'guest'`,
  dual-writes legacy `first_viewed_at`/`last_viewed_at`/`is_viewed`/`view_percentage` from
  opens/milestones. Max 20 events per call. Returns a typed result (`accepted`, `duplicates`,
  `rejected`) — no silent 200s.
- `get_event_engagement_summary(p_event_id uuid)` — SECURITY INVOKER (RLS applies), returns funnel
  counts and median time-to-open for guests only.
- Audit trigger: emit `viewed` only when `first_viewed_at` changes (first view), not on every
  `last_viewed_at` change. Stops the audit-row inflation; engagement detail lives in the new table.
- Register in `supabase/migration-rollout-registry.json` (phase `expand`, capability
  `guest_engagement_events`; app capability `guest_engagement_client`). Extending
  `scripts/db/schema-object-contract.ts` / `mutation-schema-contract-query.ts` is deferred to G7:
  adding the RPCs before every hosted target has the migration would make contract verification fail
  on targets that are correctly behind.

### 6.2 Ingestion (server)

- New route `src/pages/api/invitacion/[inviteId]/events.ts` (keep `/view` during dual-run; it maps
  to `invitation_opened`/`invitation_progressed` for old cached clients, then is removed in
  contract).
- Module layout (follow existing `src/lib/rsvp/{services,repositories}` conventions):
  - `src/lib/rsvp/engagement/event-contract.ts` — zod schemas, enums, `schema_version`.
  - `src/lib/rsvp/engagement/traffic-classifier.ts` — pure function: `non_production` if
    `VERCEL_ENV !== 'production'`; `bot` if UA matches crawler/bot list; `host` if a valid session
    cookie belongs to the event owner/member or super_admin (auth lookup only when an auth cookie is
    present, so guests pay no extra latency); `test` if the guest has `is_test = true` (resolved in
    the RPC); else `guest`.
  - `src/lib/rsvp/engagement/device-class.ts` — UA → coarse class; UA discarded after.
  - `src/lib/rsvp/engagement/engagement.service.ts` + repository calling the RPC.
- Rate limit: reuse `rate-limit-provider` (namespace `engagement`), plus per-request cap of 20
  events.
- Responses: `202` with `{accepted, duplicates}`; `400` invalid; `404` unknown invite (constant
  timing not required — inviteId is a bearer uuid already); `429`. `no-store`.
- Structured log line per rejection reason (no inviteId, no PII) for observability.
- Implemented (G2):
  `src/lib/rsvp/engagement/{taxonomy,event-contract,traffic-classifier,engagement.service}.ts`,
  `src/lib/rsvp/repositories/engagement.repository.ts`; `rsvp_submitted` is emitted by both RSVP
  routes after a successful submission; only Vercel Production counts as production (Local and
  Preview are `non_production`; projection math is covered by the disposable pgTAP suite). The
  crawler precision fix of G4 landed here because the classifier depends on it.

### 6.3 Client instrumentation

- Replace `src/lib/invitation/engagement.ts` and the `markViewed` effect with one module
  `src/lib/invitation/invitation-analytics.ts`:
  - generates `page_view_id` per load; `is_reload` from `PerformanceNavigationTiming.type`;
  - `invitation_opened` once the document has been visible ≥ 1 s (Page Visibility API) — skips
    background-tab prefetches;
  - milestones via the existing `[data-section-id]` IntersectionObserver, emitting only on
    25/50/75/100 crossings;
  - `rsvp_form_viewed` / `rsvp_form_started` from the RSVP island via a small typed emitter (no
    direct fetch from the hook);
  - queue + batch flush (≤ 5 s or on `visibilitychange: hidden` via `navigator.sendBeacon`);
  - no-op for demo, `?screenshot`, and dashboard preview.
- Remove SSR writer A (`route-personalization.ts:81`) once the client path is live (it is the main
  source of bot/prefetch inflation).
- Client bundle stays free of server-only imports (Server/Client boundary invariant).
- Implemented (G3): opens use `PerformanceNavigationTiming.redirectCount` to tell short-link entries
  from direct ones; RSVP form steps travel as a `celebra:invitation-engagement` DOM event with a
  window buffer so an island that hydrates first is not lost; automation (`navigator.webdriver`) and
  `?screenshot` captures are skipped. `PERSONALIZED_VIEW_TRACK_WRITES_ON_HIT` is now 0. Browser
  check on Local: two batches (open; milestones + form steps) passed edge validation, no `/view`
  calls; the Local DB lacks the migration (blocked behind unrelated pending contract migrations), so
  the RPC answered 503 and the page was unaffected.

### 6.4 Link preview capture

- In the short-id crawler branch, fire-and-forget `invitation_link_previewed` with `crawler_family`,
  `traffic_class = 'bot'`, server-generated `client_event_id` derived deterministically from
  `(guest, crawler_family, 10-minute bucket)` so preview bursts dedupe.
- Fix crawler detection precision: replace bare `instagram` with explicit crawler UAs; add tests for
  Instagram/Facebook in-app browsers (must be classified as human).

### 6.5 Dashboard

- Extend `DashboardGuestItem` with `openCount`, `firstOpenedAt`, `lastOpenedAt`, `lastPreviewedAt`,
  `maxProgressMilestone`, `rsvpFormStartedAt` (column map in `guest.repository.ts`, rows in
  `shared/rows.ts`, DTO mapper `shared/guest-dto.ts`).
- `GuestStatusOverview`: funnel strip (Enviadas → Vista previa → Abiertas → Formulario →
  Respondidas) fed by `get_event_engagement_summary`; "desde {fecha}" note.
- Guest detail: "Abierta {n} veces · última {fecha relativa}", "Recorrido: {milestone}%", "Vista
  previa en WhatsApp: sí/no". Spanish, "usted" register, SCSS only.
- `getGuestStage` keeps its contract; switch its "opened" signal to `openCount > 0` with fallback to
  legacy `firstViewedAt` during dual-run.

### 6.6 Privacy and retention

- Update `src/pages/privacidad.astro`: guest engagement data collected (opens, depth, device class),
  purpose (shown only to the event host), no third parties, retention period.
- Retention (D1): raw events stay linked to the guest until `events.event_date + 180 days`; then
  they are **anonymized**, not deleted: `guest_invitation_id` set to null, `anonymized_at` set.
  Anonymous events keep only `event_id`, `event_type` (via event), `event_name`, timestamps,
  `page_view_id` (random), `device_class`, `traffic_class`, and `properties`; they are kept
  permanently for re-analysis under future metric definitions. Events whose invitation has no
  `event_date` fall back to `max(occurred_at) + 180 days` (documented, reported by the cron).
- Hard deletion of a guest still cascades its not-yet-anonymized events (deletion requests stay
  honorable). Anonymized events are no longer linkable to a person.
- Mechanism: guarded Vercel cron modeled on `/api/cron/memories-cleanup` (auth header, batch
  updates, run log) calling a SECURITY DEFINER `anonymize_guest_engagement_events(p_batch int)`;
  service_role keeps no direct UPDATE on the ledger.
- Privacy page also states that anonymous, aggregated statistics are kept to improve the service.
- Reconcile the contradiction between `privacidad.astro:72-77` and
  `docs/domains/tracking/commercial-attribution.md:21-25` (note only; owner decides).

### 6.7 Permanent invitation snapshots

Three storage tiers, each with its own retention:

| Tier                                                     | Content                   | Retention            |
| -------------------------------------------------------- | ------------------------- | -------------------- |
| Raw events (`guest_engagement_events`)                   | Per-guest event log       | Bounded (D1)         |
| Guest projections (`guest_invitations` columns)          | Per-guest counters/dates  | Until guest deletion |
| Invitation snapshots (`invitation_engagement_snapshots`) | Aggregates, no guest data | Permanent (D8)       |

- Table `public.invitation_engagement_snapshots`:
  - identity: `id`, `event_id uuid null references events(id) on delete set null` (snapshot survives
    event deletion), `event_type`, `snapshot_kind` (`rolling` | `final`),
    `metrics_version smallint`, `computed_at`;
  - sample sizes: `guests_total`, `guests_shared`, `guests_opened`, `guests_responded`,
    `opens_total`;
  - metrics from §5 (rates as `numeric(5,4)`, durations as `interval`), nulls when the denominator
    is 0;
  - host-behavior covariates: `share_lead_days` (event date − median `first_shared_at`),
    `reminder_coverage` (guests reminded / guests shared);
  - design attributes: `design jsonb` per the domain doc's attribute table, with
    `design_schema_version`.
  - Unique `(event_id, snapshot_kind)` for live events; no guest ids, names, phones, or free text.
- RLS forced; service_role `select, insert, update` limited to the compute function (SECURITY
  DEFINER); no host or authenticated access in phase 1 (internal data).
- `compute_invitation_engagement_snapshot(p_event_id uuid, p_kind text)`: idempotent upsert of the
  `rolling` row; inserts the `final` row once and never updates it afterwards.
- Snapshots exclude `test`, `host`, `bot`, and `non_production` traffic and test guests.
- Scheduling (same guarded cron as retention, §6.6), in this order on every run:
  1. refresh `rolling` snapshots for events with engagement activity in the last 48 h;
  2. freeze `final` snapshots for events whose `event_date` passed ≥ 7 days ago;
  3. only then anonymize raw events past retention. The anonymize function refuses to process an
     invitation whose snapshot is older than its newest raw event (per-guest aggregation must be
     captured before the guest link is removed).
- Metric definition changes bump `metrics_version`; old snapshots are not rewritten.

## 7. Work units

| Goal | Unit                                                                                                                                                 | Files (boundary)                                                                                                                                                                                         | Verification                                                                                                                                                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | ✅ Metrics dictionary + taxonomy doc (decisions in §9 closed); design-attribute paths confirmed (§5)                                                 | `docs/domains/rsvp/engagement-analytics.md`, `docs/domains/rsvp/architecture.md`                                                                                                                         | Owner review                                                                                                                                                                                                  |
| G1   | Expand migration (event ledger, projections, `is_test`, `event_date`), RPCs, trigger change, contract scripts, `event_date` publish write + backfill | `supabase/migrations/<ts>_guest_engagement_events.sql`, rollout registry, `scripts/db/*contract*`, `supabase/tests/guest_engagement_events.test.sql`, `tests/db/guest-engagement-*.test.ts`, DB docs/ERD | `pnpm db:disposable:test`; pgTAP: grants, RLS, idempotency, projection math, guest-only projections, audit emits once                                                                                         |
| G2   | Ingestion API + classifier + device class                                                                                                            | `src/pages/api/invitacion/[inviteId]/events.ts`, `src/lib/rsvp/engagement/**`, unit/integration tests                                                                                                    | Unit tests for contract, classifier (env/bot/host/guest), clamp, caps; API tests for 202/400/404/429                                                                                                          |
| G3   | Client module, RSVP emitter, remove `engagement.ts`/`markViewed`/SSR writer, remove dead `trackAction`                                               | `src/lib/invitation/invitation-analytics.ts`, `src/pages/[eventType]/[slug].astro`, `src/hooks/use-rsvp-submission.ts`, `src/lib/client/rsvp-api.ts`, `route-personalization.ts`                         | jsdom tests (visibility gating, milestones, batching, beacon, demo no-op); browser check on Local: one open per load, no SSR write                                                                            |
| G4   | Preview capture + crawler precision                                                                                                                  | `short-id-resolver.ts`, `social-crawler.ts`, tests                                                                                                                                                       | Unit tests incl. in-app browser UAs; Local curl with WhatsApp UA records one preview per bucket                                                                                                               |
| G5   | Dashboard DTO + funnel + guest detail + test-guest checkbox/badge                                                                                    | `src/interfaces/dashboard/guest.interface.ts`, dashboard service/repository, `GuestStatusOverview.tsx`, guest detail components, SCSS                                                                    | Unit tests for totals/funnel monotonicity; visual check desktop + mobile                                                                                                                                      |
| G6   | Privacy copy + snapshot/retention cron                                                                                                               | `src/pages/privacidad.astro`, `src/pages/api/cron/engagement-maintenance.ts`, `vercel.json`, snapshot table + compute/anonymize functions migration, `src/lib/rsvp/engagement/design-attributes.ts`      | Unit tests for design extraction and batch anonymization; disposable DB tests: snapshot math on fixture event, final row immutable, anonymization blocked while snapshot is stale, anonymized rows unlinkable |
| G7   | Rollout + contract                                                                                                                                   | registry, removal of `/view` route and legacy RPC (separate contract migration after ≥ 1 release)                                                                                                        | See §8                                                                                                                                                                                                        |

Each goal is one task branch (`feat/engagement-*`), `pnpm validate:changed` → `pnpm type-check` →
`pnpm run ci` before handoff.

## 8. Rollout

1. Disposable DB tests green → apply expand migration to persistent Local via guarded workflow.
2. Preview: migrate, deploy app, smoke on a Preview test guest (expect
   `traffic_class = non_production`, no projection change; projection math is proven by the
   disposable pgTAP suite).
3. Production: apply expand migration via `pnpm prod:apply`/guarded flow **before** the app deploy
   (migration is backward compatible with the current app).
4. Deploy app (dual-write: legacy columns keep working). Verify on a real test guest: one open per
   page load, preview recorded, host session classified `host`, dashboard funnel matches SQL.
5. Observe ≥ 1 week (rejection logs, row growth, p95 latency of `/events`).
6. Contract (separate task, owner-approved): drop `/view` route,
   `track_guest_invitation_view_public`, and stop writing `view_percentage` once nothing reads it.

## 9. Owner decisions (G0) — all decided 2026-10-10

| #   | Decision                                                   | Outcome                                                                             |
| --- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| D1  | Raw event retention                                        | Linked to guest until `event_date + 180 days`, then anonymized and kept permanently |
| D2  | Excluded traffic (`host`, `test`, `bot`, `non_production`) | Stored with classification; excluded from metrics                                   |
| D3  | Visit window                                               | 30 minutes of inactivity                                                            |
| D4  | Backfill historic opens from audit rows                    | No; metrics labeled "desde {fecha}"; legacy "Abierta" + first date kept             |
| D5  | "Test guest" flag                                          | Yes, phase 1 (`guest_invitations.is_test`, dashboard checkbox)                      |
| D6  | Per-guest detail shown to hosts                            | Opens count, first/last dates, depth, preview yes/no; no device or detailed times   |
| D7  | Event date source                                          | New `events.event_date` column, written on publish + one-time backfill              |
| D8  | Permanent anonymous per-invitation snapshots               | Yes, phase 1; internal ranking view in phase 2                                      |

## 10. Non-goals

- CTA click tracking, time-on-page, heatmaps, A/B tests (phase 2+).
- Internal ranking/comparison dashboard over snapshots (phase 2; data collection starts in phase 1).
- Any GA4/Meta/Vercel Analytics on personalized invitation routes.
- Cross-guest or cross-event identity, fingerprinting, IP storage.
- Changing commercial attribution or `tracking_events`.
- Reminder history table (separate initiative).

## 11. Invariants

- Git writes, DB applies, and Production operations each need explicit current-task authorization.
- Production DB: read-only except owner apply via guarded flow. Resets only on `disposable-test`.
- New tables: explicit `revoke all` + minimal grants; service_role append-only on the event ledger.
- UI copy in Spanish ("usted"); code/identifiers/comments in English; SCSS only.
- No server-only code in client islands.
- Scripts only from `package.json`; no absolute machine paths.

## 12. Acceptance criteria

- One page load with a guest link produces exactly one `invitation_opened`; reloads produce new
  opens with `is_reload = true`; background prefetch produces none.
- A WhatsApp preview fetch of `/i/{shortId}` produces one `invitation_link_previewed` per 10-minute
  bucket and zero opens.
- Host viewing their own guest link (logged in) is classified `host` and does not move projections.
- Preview/Local traffic is classified `non_production` and does not move Production projections.
- Audit table receives one `viewed` row per guest (first view) instead of one per call.
- Dashboard funnel numbers equal the SQL definitions in the metrics dictionary on a fixture event.
- RSVP and page rendering behave identically when the engagement endpoint fails (tested).
- Privacy page describes the collection; the cron anonymizes events past `event_date + 180 days` in
  a disposable test, and test-guest traffic never reaches projections or snapshots.
- Every invitation with engagement activity has a `rolling` snapshot refreshed within 48 h; events
  past date + 7 days have exactly one immutable `final` snapshot; snapshots contain no guest data.
- `pnpm run ci` green; disposable DB suite green; contract verification updated and green.

## 13. Stop conditions

- Any required DB target unavailable (`pnpm db:availability:verify`) — stop dependent steps.
- Migration risk gate classifies the expand migration as `contract` — redesign before proceeding.
- Host-session classification adds measurable latency to guest requests (it must not run without an
  auth cookie).
- Owner revisits any §9 decision — revise schema before G1.
- Design attributes cannot be extracted reliably from published content — store snapshots without
  `design` and report; do not invent attributes.

## 14. Risks

- `occurred_at` client clock skew → clamped; metrics use `occurred_at` but ordering ties fall back
  to `received_at`.
- In-memory rate limiter per instance is weak → acceptable (idempotency + per-call cap); enable
  Upstash flag if abuse appears.
- Old cached pages keep calling `/view` during dual-run → `/view` maps to new events until contract.
- Crawler UA lists drift → classifier is a pure, tested function with a single list.
- Row growth: ~5–10 events per open; anonymized events are permanent (~2M rows/year at 1,000
  invitations × 100 guests) — monitor Supabase storage; partition or archive later if needed.
- Anonymized events could be re-identified by timing correlation with small guest lists → internal
  use only, never exposed to hosts; aggregate displays enforce minimum group sizes.
- Snapshot comparisons are confounded by host behavior and guest mix → covariates stored, rates
  only, minimum sample sizes; treat rankings as hypotheses, not verdicts.
