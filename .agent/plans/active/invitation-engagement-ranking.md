---
title: Invitation engagement ranking — phase 2.1 (full coverage, confidence levels, filters, demos)
status: active
created: 2026-10-13
updated: 2026-10-17
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

# Invitation engagement ranking — phase 2.1

## 1. Objective

Make the administrator ranking (`/dashboard/admin/ranking`, released in v0.23.1-beta.1) useful on
today's data: list every published client invitation, stop showing misleading rates, add the history
that existed before 2026-10-12 as clearly labelled inferences and estimates, give the toolbar a
stable shape that classifies new invitations automatically, and add a separate Demos tab that
measures design retention on prospects.

Phase 2 (G0–G4, routine `20261013120000`, admin API, page) is in Production; Git history keeps its
plan. This plan replaces it.

## 2. Known evidence (Production, read-only, 2026-10-13 — do not re-audit without cause)

- **Coverage.** 25 published client invitations; only 9 have an engagement snapshot. Snapshots are
  produced only for events with ledger activity since 2026-10-12, so 16 invitations (mostly past
  events) never appear. America has 0 guests, Allison 1.
- **Misleading conversion.** `rsvp_conversion = opened∧responded / opened`. Almost every response
  predates the ledger (Xareni 44/44, Daniela y Martín 120/122), so one tracked open plus an older
  response reads as 100 %.
- **Legacy telemetry (pre-2026-10-12) is still stored** on every guest: `first_viewed_at`,
  `last_viewed_at`, `is_viewed`, `view_percentage` (2 395 guests; 1 418 at 100 %, 556 below 25 %),
  and `guest_invitation_audit` `viewed` rows (60 000+, one per request; sessionized with the 30-min
  visit rule they give e.g. Xareni ≈ 585 visits, 8.5 per viewer). Contamination signals: 496 guests
  "viewed" before `first_shared_at` (host/QA), 323 within 2 min after sharing (chat link preview
  crawler).
- **Responses by source.** Every non-pending guest carries `last_response_source` (`link` 1 226,
  `generic_link` 4, `admin` 55 — host-entered). The audit trigger derives its actor from this
  column; 38 older audit rows disagree, so the column, not the audit, is the signal.
- **Confirmation mode.** `rsvp.confirmationMode ∈ {api, whatsapp, both}`. With `whatsapp` the reply
  is a chat message and never reaches the database; `both` is partial (Destenid).
- **Grouping value.** Over the 9 snapshots, only theme preset (5 values), personalized access
  variant (5) and RSVP access mode (2) separate anything; visual profile equals the slug, template
  equals preset + type, font/confirmation/music are nearly constant.
- **Presets.** 11 presets are used by published client invitations (sacred-keepsake's repository
  files were retired by `43000fc7e`, its published row remains). Design for invitations without a
  snapshot must therefore come from the database (latest `published_invitation_content`), never from
  repository definitions.
- **Demos.** `tracking_events` (`route_class = 'demo'`, `is_internal = false`) since 2026-06-29:
  `demo_viewed` with `demo_slug` (2 120 views / 1 858 sessions), `scroll_depth_reached` with
  `depth_bucket` (7 079), `section_seen` since 2026-09-29 (68), `cta_clicked` (4),
  `whatsapp_contact_clicked` (1). The Comercial demo conversion report already shows views,
  sessions, WhatsApp CTR and the sales funnel per demo; it does not show depth.

## 3. Owner decisions (2026-10-13)

| ID  | Decision                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | List every published client invitation; those without activity read «Sin actividad desde el 12 oct».                                                                                                                                                                                                                                                                                                          |
| D2  | Three confidence levels: **measured** (ledger), **inferred** (guest-submitted response ⇒ opened), **historical estimate** (legacy telemetry, cleaned). Never mixed in one figure; ranges where uncertain; ranking on measured + inferred; estimate in its own view, frozen with a method version; estimate ships after validation.                                                                            |
| D3  | Toolbar: event type (with «Todos», ranks per type), group by (preset, personalized access, RSVP access mode), sort, data level. «Filtros» panel: event status (upcoming/past/all, default all), activity, font, music, confirmation mode, include disabled (off). Facet values derived from data. Filters in the URL. WhatsApp conversion «No medible», `both` «Parcial», both out of the conversion ranking. |
| D5  | Separate «Demos» tab focused on design retention (sessions, reach 50/75/100 %, drop-off, contacts per 100 sessions), 100-session threshold, default sort by reach 100 %, link to the Comercial funnel. The «Por preset» cross view is deferred.                                                                                                                                                               |

## 4. Definitions

| Term               | Definition                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| Opened (measured)  | `open_count > 0` (ledger, guest traffic only).                                                                 |
| Responded by guest | `attendance_status <> 'pending'` and `last_response_source <> 'admin'`.                                        |
| Opened (inferred)  | Opened (measured) **or** responded by guest. A lower bound: the RSVP form only exists inside the invitation.   |
| Conversion (v2)    | Responded by guest ÷ opened (inferred). Null when confirmation mode is `whatsapp`; flagged partial for `both`. |
| Opened (estimate)  | Any legacy `viewed` audit row ≥ 2 min after `first_shared_at`, or responded by guest. An upper bound.          |
| Visits (estimate)  | `viewed` audit rows before 2026-10-12, sessionized per guest with the 30-min rule.                             |
| Event status       | Upcoming when `events.event_date >= today` in `America/Chihuahua`; past otherwise; unknown without a date.     |
| Activity state     | `measured` (has a snapshot), `none` (published, no snapshot).                                                  |

## 5. Architecture

### 5.1 Database — expand migration A (`20261013150000_engagement_ranking_coverage.sql`)

- `list_invitation_engagement_ranking_v2(p_event_type text default null)` (`security definer`,
  `service_role` only) starts from published client invitations (`kind = 'client'`, not archived)
  and returns, per invitation: identity, event type/date, event status, activity state, public
  access, confirmation mode, design (chosen snapshot design, else latest published content), live
  guest aggregates (shared, responded, responded by guest, opened measured, opened inferred,
  response rate, conversion upper bound, reminder coverage, share lead days) and the ledger metrics
  of the chosen snapshot (final over rolling). Snapshots are **not** altered: inferred figures are
  exact live counts, so the earlier idea of v2 snapshot columns and a final-row backfill is dropped
  (no immutability exception needed).
- Rollout registry: `expand`, `provides: ["engagement_ranking_coverage"]`. The v1 routine stays
  until the v2 client is deployed.
- pgTAP `invitation_engagement_ranking_v2.test.sql` (14): grants, coverage (archived, demo and
  unpublished excluded), event filter, final over rolling, activity/status, responses by source,
  inferred opens, response rate and conversion bound, sample state, access, confirmation mode,
  design fallback.

### 5.2 Database — expand migration B (`20261017120000_engagement_historical_estimates.sql`)

G5 validation (2026-10-17, report in the Integration reports directory) was accepted by the owner:
legacy depth is dropped (stop condition triggered), the open rule becomes «any view ≥ 2 min after
the first share», and guests without `first_shared_at` are counted apart.

- `invitation_engagement_historical_estimates` (one row per event and `method_version`; RLS forced,
  `service_role` select only): shared, viewed, responded by guest, opens range (responses → views or
  responses), visits and visits per viewer, conversion lower bound, cleaning counters (views before
  share, views in the 2-min preview window), unshared counters. No depth column.
- `compute_engagement_historical_estimates(p_method_version smallint)` computes all rows once from
  `viewed` audit rows before 2026-10-12 16:25 UTC (ledger start); re-running a version is a no-op.
  The migration computes version 1 in its body.
- `list_engagement_historical_estimates(p_event_type, p_method_version)` lists published client
  invitations; the API serves it with `level=historical`, the dashboard in its own tab.

### 5.3 Server

- `engagement-ranking.service.ts` v2: query `{ eventType | 'all', groupBy, sort, level, filters }`;
  filters applied in the service over routine rows (small N); facets (`fonts`, `confirmationModes`,
  `presets`, …) returned from the rows so menus classify new invitations automatically; ranks and
  medians per event type; default sort is response rate; conversion is an upper bound and its
  ranking skips `whatsapp` and `both`; ranges for opened/conversion (inferred lower, estimate upper
  when the historical level is loaded).
- Demos: `demo-engagement.service.ts` reads `tracking_events` (service role, `route_class = 'demo'`,
  `is_internal = false`, period 30/60 days, the Comercial helper) and aggregates per `demo_slug`:
  sessions, bounce (left before 25 %), reach 50/75/100 % (deepest `depth_bucket` per session),
  largest drop after 25 %, contacts per 100 sessions (`cta_clicked` + `whatsapp_contact_clicked`
  sessions); preset and type from the demo inventory; 100-session threshold. Reuses the commercial
  pagination/period helpers.
- API: `GET /api/dashboard/admin/engagement/ranking` gains `level` and filter params (zod, unknown
  values → 400); new `GET /api/dashboard/admin/engagement/demos?period=&eventType=`. Same perimeter:
  rate limit, admin strong session, private cache.

### 5.4 Dashboard

- Tabs «Invitaciones» / «Demos».
- Toolbar per D3; «Filtros» popover with chips, «Limpiar» and «Mostrando X de Y»; state in the URL.
- Invitations table: «Tipo» column with «Todos»; level badge per figure (Medido / Inferido /
  Estimado); ranges as «72–86 %»; «Respondieron (total)» and «Respondieron por el invitado»;
  conversion «No medible (WhatsApp)» / «Parcial»; disabled rows labelled when included; rows without
  activity greyed with «Sin actividad desde el 12 oct».
- «Histórico (estimado)» level: own table, method version and cleaning rules shown, never ranked
  against measured.
- Demos table per D5 with «Ver embudo comercial» linking to `/dashboard/commercial`.
- Remove the duplicated intro paragraph (header subtitle stays; the since-date moves to the caveat).

## 6. Work units

| Goal | Scope                                                                                                                                 | Verification                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| G0   | Spec: confidence levels, definitions (§4), ranking v2 query contract, demos metrics                                                   | Owner review                                                                                                 |
| G1   | Migration A: snapshot v2 columns + compute + backfill, ranking routine v2, registry, contracts, pgTAP                                 | Disposable pgTAP (all files), `test:db:rsvp-contracts`, mutation contract on disposable                      |
| G2   | Service + API v2: filters, facets, per-type ranks, levels, WhatsApp handling, ranges                                                  | Unit (filters, facets, per-type ranks, ranges, WhatsApp exclusion), API (400s, perimeter)                    |
| G3   | UI: tabs shell, toolbar, filters popover, chips, URL state, level badges, table changes, copy fix                                     | Component tests; Local render with a seeded admin session if available, otherwise Preview check by the owner |
| G4   | Demos tab: service, API, table                                                                                                        | Unit (aggregation, threshold, drop-off), API tests, component test                                           |
| G5   | Historical estimate: validation report (accepted 2026-10-17: no legacy depth, any-view open rule), then migration B + historical view | Validation report accepted by the owner before migration B; pgTAP; unit                                      |
| G6   | Docs, CHANGELOG, rollout (Local → Preview me; Production owner), checkpoint                                                           | `validate:changed` → `type-check` → `pnpm run ci`; `release-status` Preview/Production                       |

One task branch per goal group (`feat/ranking-coverage` for G0–G3, `feat/ranking-demos` for G4,
`feat/ranking-historical` for G5), each from `origin/develop`, merged with `--no-ff`.

## 7. Rollout

- G1–G4 ship together (one checkpoint): migration A first (expand; the v2 API answers 503 until the
  routine exists, the v1 page keeps working), then the app.
- G5 ships in a later checkpoint after the owner accepts the validation report.
- Contract `20261014120000` (after the v2 client passed Production smoke in v0.24.0-beta.1): drops
  the v1 ranking routine with the `invitation_projects` view, registered with `revokes` only — the
  deployed v0.24.0-beta.1 manifest declares no `engagement_ranking_v2_client` capability.
- No published invitation rides with these releases (content↔smoke↔migration cycle of 2026-10-13).

## 8. Acceptance criteria

- «XV años» lists all 15 published XV client invitations (archived excluded); «Todos» lists all 25
  with a type column and per-type ranks.
- Xareni shows measured opens, inferred opens (≥ 44) and conversion v2 from guest-submitted
  responses; no 100 % from a single open.
- WhatsApp-only invitations show «No medible» and are absent from the conversion ranking.
- Facets list every font, preset and confirmation mode present, including ones added after release
  (verified by a fixture with a new preset).
- Demos tab shows sessions, reach and contacts per demo for the selected period, greys demos under
  100 sessions and links to the Comercial funnel.
- No guest identifiers anywhere in the responses; all endpoints admin strong session.

## 9. Stop conditions

- (Checked 2026-10-13, not triggered) responses whose source cannot be attributed: none.
- (Checked 2026-10-17, triggered for depth only) G5 validation shows legacy depth or opens
  uncorrelated with measured data → ship G5 without that metric and report.
- Any metric would need guest-level data in the response → stop (privacy contract).

## 10. Risks

| Risk                                         | Mitigation                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| Readers treat estimates as measurements      | Level badge on every figure, ranges, own view, method version visible                |
| Final snapshot immutability                  | v1 columns never rewritten; v2 columns filled once by an idempotent, tested backfill |
| Facets explode as designs grow               | Only the three grouping keys plus four filters; values sorted by frequency           |
| Demo contacts too sparse to rank             | Default sort on reach 100 %; contacts shown with their counts                        |
| Repository definitions retired (`43000fc7e`) | Design always read from the database                                                 |
