# Local Render Corpus

**Owns:** which supported Production client invitations must be reproducibly renderable and
regression-tested in Local before Preview/Production deployment.

**Does not own:** managed release lifecycle procedure, Editor UX, RSVP/Auth operations, or remote
promotion. Those remain:

- Canonical managed registry — `scripts/provision/invitations/registry.ts`
- Creation contract — [`invitation-creation-contract.md`](./invitation-creation-contract.md)
- Production flow — [`../domains/intake/production-flow.md`](../domains/intake/production-flow.md)

---

## Three corpora (do not conflate)

| Corpus                         | Purpose                                                                                         | SSOT                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Canonical Managed Registry** | Invitations controlled by `definition → invitation:update → Preview → invitation:promote`       | `scripts/provision/invitations/registry.ts`         |
| **Local Render Corpus**        | Every currently supported Production **client** invitation required for Local render regression | `scripts/provision/local-render-corpus/registry.ts` |
| **Demo Corpus**                | Marketing/theme demonstration coverage (`kind=demo`, Astro `event-demos`)                       | `src/content/event-demos/**` + Local demo rows      |

`pnpm dbs` “Managed” counts are **active non-archived invitation rows** (clients + demos), not the
Local Render Corpus size.

---

## SSOT

```text
scripts/provision/local-render-corpus/registry.ts
```

Consumed by:

- Local bootstrap — `pnpm invitation:local-corpus`
- Deterministic regression — `pnpm test:managed:regression` / `pnpm test:local-render-corpus`
- Screenshot completeness — `pnpm screenshot:local-render-corpus` (`--corpus`)
- Changed-path routing — `requiresManagedInvitationRegression` in `scripts/validation-runner.mjs`
- Local observability dashboard — `/dashboard/observabilidad` (read-only; rows derived from this
  SSOT)

Do not maintain independent slug lists in Jest, screenshot JSON, seed scripts, or dashboard UI.

---

## Local bootstrap

```bash
pnpm invitation:local-corpus --dry-run
pnpm invitation:local-corpus --apply
pnpm invitation:local-corpus --apply --slug valentina-hernandez
```

Behavior:

- **Canonical** entries → `applyLocalInvitation` / `invitation:update` Local with
  `content-and-assets` (persistent-local only).
- **Legacy** entries → upsert `invitations` + `published_invitation_content` from versioned
  sanitized fixtures under `scripts/provision/local-render-corpus/fixtures/`.

Never targets Preview/Production. Never clones databases. Never imports Auth users, guests, RSVP
responses, analytics, tracking, audit history, or mutation receipts.

Local is **render-equivalent**, not DB-identical to Production.

---

## Regression & screenshots

```bash
pnpm test:local-render-corpus          # schema → adapter → page → section descriptors (13 clients)
pnpm screenshot:local-render-corpus    # runtime/completeness against Local routes (no pixel baselines)
pnpm exec tsx scripts/provision/local-render-corpus/verify-local-routes.ts
```

`pnpm screenshot:local-render-corpus` runs the **registered corpus only**. It does not support
`--slug` filtering, and the current entry point does not expose a usable `--help`. To capture one
invitation instead:

```powershell
pnpm screenshot --url=/<eventType>/<slug> --viewport=<viewport> --clean
```

See `scripts/screenshot/README.md` for the single-route contract and reveal-state capture rules.

Failures name the exact invitation slug.

Both commands write an uncommitted validation evidence snapshot under
`.tmp/observability/validation/` (`regression.json` / `screenshots.json`) for the Local
observability dashboard. Regression totals come from the Jest JSON report. Snapshot write failures
never convert a failed validation into a pass. Freshness uses `inputFingerprint` +
`corpusFingerprint` (not commit SHA alone).

See [`observability-dashboard.md`](./observability-dashboard.md).

---

## Registering a new supported client

1. If managed: add definition to `scripts/provision/invitations/registry.ts` **and** add a corpus
   entry (`classification: 'canonical'`).
2. If legacy-supported: export/add a sanitized fixture under
   `scripts/provision/local-render-corpus/fixtures/`, then add a corpus entry
   (`classification: 'legacy'`, `fixtureFile`, asset strategy).
3. Run `pnpm invitation:local-corpus --apply --slug <slug>` and `pnpm test:local-render-corpus`.

Omitting a repository-known supported client from the corpus SSOT fails the corpus contract tests.

---

## Exclusions

Not part of the client regression corpus:

- `demo-*`
- `e2e-preview-publication`
- `alba-rosa-quinones` (stale rekey twin)
- archived / deleted / empty test rows
