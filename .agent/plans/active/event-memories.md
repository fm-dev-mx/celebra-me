---
title: Event memories — canonical per-event guest photo/video QR
status: active
created: 2026-09-30
updated: 2026-10-13
type: implementation
supersedes:
  - valentina-memories-qr.md
related_docs:
  - docs/core/architecture.md
  - docs/env-workflow.md
  - workers/celebra-memories-sign/OWNER.md
  - src/lib/memories/contract/limits.ts
---

# Event memories — repository and owner-gate tracking

The authoritative operational checklist, apply order, per-event activation, rollback, proof table
and evidence contract live in
[`workers/celebra-memories-sign/OWNER.md`](../../../workers/celebra-memories-sign/OWNER.md). This
plan tracks scope and status only; it must not duplicate that handoff.

## Objective

Serve any published event with a private guest photo/video QR without client identity in code:
per-event configuration in `event_memory_settings`, event-neutral Workers, owner-only organizer
surface, super-admin activation, and a single retention instant per space that expires sessions,
catalog rows and objects together.

## Scope

- Contract, server, client, islands, routes, cron and Workers under the module layout documented in
  `docs/core/architecture.md` (ESLint `boundaries` enforce the dependency direction).
- Migration `20260930180000_event_memories_catalog` (expand; registered as `contract` because it
  revokes RPC execution from browser roles) plus pgTAP and disposable concurrency coverage.
- Application capability `event_memories_client` in `supabase/deployed-app-capabilities.json` with a
  static proof that no executable memories path names a legacy object.
- Scripts: `pnpm memories:qr -- --slug <slug>`, `pnpm canary:memories`,
  `pnpm worker:memories:config:generate`.

## Non-goals

- Legacy retirement (see below), streaming ZIP export to disk, multipart video uploads, browser-side
  rejection telemetry, and package-catalog gating. Entitlement is recorded per space; gating by
  catalog stays commercial process.
- Any database, Cloudflare, R2 or Git mutation from an agent session.
- The Staging load-test harness of the pilot was retired with it; a per-space harness is a separate
  task.

## Legacy retirement (done)

Planned design, kept for context. Forward migration `event_memories_legacy_retirement`, registered
as `contract` with `requiresDeployedAppCapabilities: ["event_memories_client"]` and `revokes` for
every legacy capability, applied only after the replacement application is deployed and
smoke-verified:

1. Insert the settings row for the pilot event (`events.slug = 'valentina-hernandez'`) with
   `public_slug 'valentina'`, its historical window and limits, and `retention_ends_at` at the end
   of its 30-day retention, `on conflict (event_id) do nothing` (the owner may create it earlier
   from the admin surface so `/r/valentina` keeps resolving).
2. Move sessions, items and audit rows with `event_key = 'valentina'` into the event-neutral tables
   with `on conflict do nothing`; mark moved items `deleted` with
   `object_deleted_at = created_at + interval '30 days'` (R2 already removed them) and anonymize
   moved sessions in bulk.
3. Drop the three `valentina_memory_*` tables and eight legacy functions. Rows whose event does not
   exist in the target environment are discarded with them.

Owner decision 2026-10-09: export the `valentina_memory_*` rows and storage objects outside Git and
drop them; steps 1 and 2 were not carried out. Step 3 shipped as
`20261012200200_retire_valentina_memories.sql` and was applied to Local, Preview and Production with
the v0.21.0-beta.1 checkpoint (CHANGELOG, 2026-10-12).

## Current status

- Repository: implementation merged. Migrations `20260930180000_event_memories_catalog`,
  `20261002012428_event_memory_settings_planning`, and `20261006120000_event_memories_gallery_share`
  reached `main` through PR #219 and PR #228. The app deploy must not precede `20261002012428`.
- Legacy retirement: done. `20261012200200_retire_valentina_memories.sql` (contract) is applied in
  every hosted database (v0.21.0-beta.1); the Production schema audit reported `CURRENT` at it.
- Owner gates: Production apply, per-event activation, Worker deploys, canary, and phone proof
  remain `OWNER_ACTION_REQUIRED`; every live proof is `UNVERIFIED` until the owner records it in
  `workers/celebra-memories-sign/OWNER.md`.
