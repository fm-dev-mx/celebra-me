---
title: Invitation engagement ranking — phase 2 (admin comparison over permanent snapshots)
status: active
created: 2026-10-13
updated: 2026-10-13
type: implementation
autonomy: 2
related_docs:
  - docs/domains/rsvp/engagement-analytics.md
  - docs/domains/rsvp/architecture.md
  - docs/domains/rsvp/database.md
  - docs/database-workflow.md
  - .agent/rules/database.md
supersedes:
  - invitation-engagement-analytics.md
---

# Invitation engagement ranking — phase 2

## 1. Objective

Give the administrator one internal view that compares invitations and designs on the permanent,
anonymous engagement snapshots collected since phase 1 (`invitation_engagement_snapshots`), so the
business can see which designs and sections get opened, read to the end and answered, and feed that
back into the catalog. Hosts never see this view. Phase 1 (plan
`invitation-engagement-analytics.md`, G0–G7) is complete and in Production since v0.22.0-beta.1; it
only collects.

## 2. Known evidence (established 2026-10-13, do not re-audit without cause)

- Snapshot storage: `public.invitation_engagement_snapshots` (migration `20261010130000`), one row
  per `(event_id, snapshot_kind)` with `snapshot_kind in ('rolling','final')`, `event_type`, guest
  counts (`guests_total/shared/opened/responded`, `opens_total`), rates (`open_rate`,
  `completion_rate`, `rsvp_conversion`, `reopen_ratio`, `mobile_share`), medians
  (`median_seconds_to_open`, `median_seconds_to_respond`), host covariates (`share_lead_days`,
  `reminder_coverage`), and `design jsonb` + `design_schema_version`.
- Design attributes (`src/lib/rsvp/engagement/design-attributes.ts`, schema v1): `themePreset`,
  `fontFamily`, `templateId`, `visualProfileId`, `sections[]`, `sectionVariants{}`,
  `personalizedAccessVariant`, `music{enabled,autoPlay}`, `rsvp{accessMode,confirmationMode}`.
- Refresh: the daily cron `/api/cron/engagement-maintenance` (10:43 UTC) recomputes `rolling`
  snapshots for events with newer activity and freezes one `final` snapshot 7 days after
  `events.event_date` (`list_engagement_snapshot_candidates`). Events deleted keep their snapshot
  with `event_id = null` (no label, still rankable by design).
- Access: RLS forced; `select` granted to `service_role` only. No read RPC exists for the app yet.
  Admin APIs follow `src/pages/api/dashboard/admin/platform/usage.ts`: `requireAdminRateLimit` →
  `requireAdminStrongSession` → service → `withPrivateCache(jsonResponse)`.
- Admin pages: `src/pages/dashboard/admin/*.astro` with `DashboardLayout`, `DashboardPageHeader` and
  a `client:load` React panel (`src/components/dashboard/platform/PlatformUsagePanel.tsx` is the
  reference). Styles: SCSS modules under `src/styles/dashboard/` imported from `dashboard.scss`.
- Comparison rules are already specified in `docs/domains/rsvp/engagement-analytics.md` ("Per
  invitation" + "Comparison rules"): same event type only; ≥ 20 shared guests per invitation and ≥ 5
  invitations per design group; rank on rates, never raw totals; show host covariates next to every
  comparison; results are hypotheses.
- Labels: snapshots carry no title. `events` provides `title`, `slug`, `event_type`, `event_date`,
  `invitation_project_id` (service-role read).
- Data volume today is small (snapshots exist only for events with engagement since 2026-10-12);
  most rows will be below the sample thresholds for months. The view must be honest about that.

## 3. Design principles

1. **Read-only over snapshots.** The ranking reads `invitation_engagement_snapshots` + `events`
   labels; it never touches raw events or guest projections, so it cannot leak guest data and works
   after anonymization.
2. **Rules in the database, presentation in the app.** Thresholds and grouping live in one
   `security definer` RPC so every consumer (page, future CSV, future cron report) applies the same
   comparison rules. The app only formats.
3. **Insufficient sample is a first-class state**, not a hidden row: rows below thresholds are
   returned with `sample: 'insufficient'` and rendered greyed with the reason; groups with fewer
   than 5 invitations show their size but no rank.
4. **One snapshot per event in a ranking**: `final` when it exists, else `rolling`; never both.
5. **Admin-only, strong session**, same perimeter as platform usage; private cache; rate limited.
6. No new client-side analytics, no GA/Meta, no per-guest data on screen.

## 4. Scope

### In scope

- Read RPC `list_invitation_engagement_ranking(p_event_type text, p_group_key text)` (service role).
- Admin API `GET /api/dashboard/admin/engagement/ranking?eventType=&groupBy=`.
- Admin page `/dashboard/admin/ranking` with:
  - filter: event type (required, default the type with most snapshots), group by design key
    (`themePreset` default; `templateId`, `fontFamily`, `personalizedAccessVariant`,
    `rsvp.confirmationMode`, `music.enabled`), metric to sort by (`open_rate`, `completion_rate`,
    `rsvp_conversion`, `median_seconds_to_respond`);
  - **Designs table**: group, invitations in group, eligible invitations, median of each rate,
    covariates (median `share_lead_days`, median `reminder_coverage`), rank only when eligible;
  - **Invitations table**: title/slug (or «Evento eliminado»), event date, snapshot kind and date,
    shared/opened/responded, rates, medians, covariates, sample state;
  - a visible caveat block with the comparison rules and the «desde 2026-10-12» note.
- Link from `/dashboard/admin` stats grid («Ranking de diseños →»).
- Tests: pgTAP for the RPC (grants, thresholds, final-over-rolling, group sizes), unit tests for the
  service/presenter (ordering, null rates, insufficient sample), component test for the panel,
  schema contract entries for the new routine, admin API test (401/403/200, cache headers).
- Docs: §"Phase 2 ranking" in `docs/domains/rsvp/engagement-analytics.md` (query contract, UI
  states), `docs/domains/rsvp/database.md` routine list.

### Non-goals

- Changing snapshot math, taxonomy or retention (phase 1 contract).
- Host-facing comparisons or any guest-level drill-down.
- CSV export, scheduled e-mail reports, charts beyond tables (candidates for phase 3).
- Section-variant ranking per section type (needs more data; the RPC returns `design` so a later
  phase can add it without a migration).
- Statistical significance testing; the view shows medians, counts and thresholds only.

## 5. Owner decisions (accepted 2026-10-13: D1–D5 as recommended)

| ID  | Question                                                                        | Recommendation                                                                           |
| --- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| D1  | Where does the view live?                                                       | `/dashboard/admin/ranking`, admin strong session, link from the admin home               |
| D2  | Keep the spec thresholds (≥ 20 shared guests, ≥ 5 invitations per group)?       | Yes; show below-threshold rows greyed as «muestra insuficiente» instead of hiding them   |
| D3  | Default design grouping key                                                     | `themePreset`; other keys selectable                                                     |
| D4  | Should deleted events (snapshot with `event_id = null`) count in design groups? | Yes for groups (design is intact), listed as «Evento eliminado» in the invitations table |
| D5  | Primary sort metric                                                             | `rsvp_conversion` (closest to business value), `open_rate` second                        |

## 6. Architecture

### 6.1 Database (expand migration `<ts>_invitation_engagement_ranking.sql`)

- `public.list_invitation_engagement_ranking(p_event_type text, p_group_key text default 'themePreset') returns table (...)`
  — `security definer`, `set search_path = public`, execute to `service_role` only, `revoke` from
  `public, anon, authenticated`.
  - Picks one snapshot per `event_id` (`final` preferred, else `rolling`); rows with `event_id` null
    are included (group only).
  - Joins `events` for `title`, `slug`, `event_date`, `invitation_project_id` (left join).
  - Computes `group_value` from `design` by key (`design->>'themePreset'`, `design->>'templateId'`,
    `design->>'fontFamily'`, `design->>'personalizedAccessVariant'`,
    `design#>>'{rsvp,confirmationMode}'`, `(design#>>'{music,enabled}')`); unknown key → error.
  - Emits per row: `sample_state` (`eligible` when `guests_shared >= 20`, else `insufficient`),
    `group_size`, `group_eligible`, `group_rank` (dense rank by the requested metric among eligible
    rows of groups with `group_eligible >= 5`, else null). Metric ranking is computed in the app
    (one query, many sorts) — the RPC returns the raw columns; only `sample_state`, group sizes and
    the chosen snapshot are decided in SQL.
  - Only `metrics_version = 1` rows; a future version bump adds a parameter, not a new RPC.
- Rollout registry entry: phase `expand`, `provides: ["invitation_engagement_ranking"]`.
- Schema contract: add the routine to `scripts/db/schema-object-contract.ts`; mutation contract:
  anon/authenticated execute = false, service_role execute = true.
- pgTAP `supabase/tests/invitation_engagement_ranking.test.sql`: grants; final beats rolling;
  deleted event kept; thresholds; unknown key raises.

### 6.2 Server

- `src/lib/rsvp/repositories/engagement.repository.ts`:
  `listInvitationEngagementRankingRpc(eventType, groupKey)` (service role client, same error mapping
  as the other RPC wrappers).
- `src/lib/rsvp/engagement/engagement-ranking.service.ts`: validates inputs against `EVENT_TYPES`
  and `RANKING_GROUP_KEYS`, calls the RPC, builds `designs[]` (median per metric, counts, covariate
  medians, rank when `groupEligible >= 5`) and `invitations[]` (sorted by the requested metric,
  nulls last), returns
  `{ eventType, groupKey, metric, since: '2026-10-12', thresholds: { sharedGuests: 20, groupInvitations: 5 }, designs, invitations }`.
- `src/pages/api/dashboard/admin/engagement/ranking.ts`: GET;
  `requireAdminRateLimit(request, 'engagement:ranking')`, `requireAdminStrongSession`, zod query
  schema, `withPrivateCache`.
- Interfaces in `src/interfaces/dashboard/engagement-ranking.interface.ts` (shared by API and
  panel).

### 6.3 Dashboard

- `src/pages/dashboard/admin/ranking.astro` (`DashboardLayout` + `DashboardPageHeader` +
  `<EngagementRankingPanel client:load />`).
- `src/components/dashboard/engagement/EngagementRankingPanel.tsx`: filters (event type, group key,
  metric), two tables, caveat block, loading/error/empty states (`empty-state` pattern). Copy in
  Spanish, «usted». Rates as percentages with one decimal; medians as «2 h 15 min» / «3 d»;
  insufficient rows greyed with `title` tooltip «Menos de 20 invitados con invitación enviada».
- `src/styles/dashboard/_engagement-ranking.scss` imported from `dashboard.scss`; mobile: tables
  scroll horizontally inside the card (no column hiding in this phase).
- Admin home: one stat card «Ranking de diseños» linking to the page.

### 6.4 Presenter rules

- Rates null → «—»; never 0 % from a zero denominator.
- `reopen_ratio` is shown but never used as a sort metric (spec: ambiguous).
- Covariates always visible next to rates (spec).
- Ranks: dense rank among eligible invitations of eligible groups; ties share rank.

## 7. Work units

| Goal | Scope                                                                                      | Files                                                                                                                                                                                                                            | Verification                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| G0   | Owner decisions D1–D5 closed; spec §"Phase 2 ranking" drafted                              | `docs/domains/rsvp/engagement-analytics.md`                                                                                                                                                                                      | Owner review                                                                                                             |
| G1   | Ranking RPC (expand migration), registry entry, schema/mutation contract, pgTAP            | `supabase/migrations/<ts>_invitation_engagement_ranking.sql`, `supabase/migration-rollout-registry.json`, `scripts/db/*contract*`, `supabase/tests/invitation_engagement_ranking.test.sql`                                       | `pnpm db:disposable:reset` + `pnpm db:migrate -- --target disposable-test --apply`, pgTAP, `pnpm test:db:rsvp-contracts` |
| G2   | Repository wrapper, ranking service + presenter, interfaces, admin API                     | `src/lib/rsvp/repositories/engagement.repository.ts`, `src/lib/rsvp/engagement/engagement-ranking.service.ts`, `src/interfaces/dashboard/engagement-ranking.interface.ts`, `src/pages/api/dashboard/admin/engagement/ranking.ts` | Unit tests (median/rank/null handling, group sizes), API tests (401/403/400/200, private cache)                          |
| G3   | Admin page, panel, SCSS, admin home link                                                   | `src/pages/dashboard/admin/ranking.astro`, `src/components/dashboard/engagement/EngagementRankingPanel.tsx`, `src/styles/dashboard/_engagement-ranking.scss`, `src/pages/dashboard/admin.astro`                                  | Component test (filters, insufficient state, empty state); Local check desktop + mobile                                  |
| G4   | Docs + rollout: Local apply, Preview apply + smoke, PR, owner Production apply, checkpoint | docs above, `CHANGELOG.md`                                                                                                                                                                                                       | `pnpm validate:changed` → `pnpm type-check` → `pnpm run ci`; `release-status` Preview/Production                         |

One commit per goal; task branch `feat/engagement-ranking` from `origin/develop`; integrate with
`merge --no-ff`.

## 8. Rollout

- Expand-only: the RPC is additive; the app may deploy before or after the migration (the API
  returns a clear 503 «Ranking no disponible todavía» if the routine is missing, so order is free;
  preferred order remains migration first: Local → Preview (me, `preview:schema:migrate`) →
  Production (owner: `db:migrate` plan, `prod:apply --schema --apply`, `db:prod:audit`).
- No contract phase, no capability requirement, nothing to revoke.
- No new published invitation rides with this release (avoids the content↔smoke↔migration cycle seen
  on 2026-10-13).

## 9. Acceptance criteria

- Admin (strong session) opens `/dashboard/admin/ranking`, picks an event type, sees designs and
  invitations with rates, covariates and sample states; non-admins get 403 on the API and no page.
- Every rate shown equals the snapshot value; no guest-level data reachable from the view.
- Rows under thresholds are visible, greyed, unranked, with the reason.
- `final` snapshots take precedence over `rolling` for the same event.
- pgTAP, unit, component and API tests green; `pnpm run ci` green locally (browser tier in CI).
- Spec updated; CHANGELOG entry in the next checkpoint.

## 10. Stop conditions

- The owner wants host-facing comparisons → stop; that changes the privacy contract (phase 1 D6).
- A metric needs raw events (e.g. per-section dwell) → stop; it is a snapshot-math change (new
  `metrics_version`), out of scope.
- The admin strong-session perimeter cannot be reused for a new route → stop and report.

## 11. Risks

| Risk                                                       | Mitigation                                                                                    |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Months of «muestra insuficiente» make the view look broken | Explicit sample states and the «desde 2026-10-12» note; design groups still show sizes        |
| Rates misread as verdicts                                  | Caveat block + covariates on every row (spec rule)                                            |
| Design key missing on old snapshots (`design` null)        | Group «Sin datos de diseño»; still listed in the invitations table                            |
| Snapshot schema version bump later                         | RPC filters `metrics_version = 1`; service passes the version explicitly in the next revision |
