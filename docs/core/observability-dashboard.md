# Observability Dashboard (Local-first)

**Owns:** read-only operational health for invitation corpus, environments, migrations, assets, and
latest Local validation evidence.

**Does not own:** writes, promotions, migrations, asset transfers, alerts, history, or remote
mutation authority. CLI workflows remain authoritative for all writes.

---

## Route & availability

| Item            | Value                                                                 |
| --------------- | --------------------------------------------------------------------- |
| Route           | `/dashboard/observabilidad`                                           |
| API             | `GET /api/dashboard/observabilidad`                                   |
| Runtime         | Approved persistent-Local only                                        |
| Authorization   | Authenticated admin / super-admin with strong session (MFA / trusted) |
| Interaction     | Read-only                                                             |
| Refresh         | Initial load + manual **Actualizar estado** only                      |
| Polling         | None                                                                  |

Outside Local (including Vercel Preview/Production), the page redirects to `/404` and the API
returns not-found. The route remains build-safe when hosted credentials are absent.

Local gate: Local Supabase (`http://127.0.0.1:54321` / `localhost:54321`) and not
`CELEBRA_RUNTIME_TARGET=preview|production`. Optional explicit flag:
`CELEBRA_LOCAL_OBSERVABILITY=1` (still requires Local Supabase).

Worktree path alone is never authorization. Dashboard health never authorizes remote mutation.

---

## Observed environments

Local, Preview, and Production — connection, runtime identity, schema lifecycle, active invitation
rows (all non-archived), supported corpus presence (13 Local Render Corpus clients), render-effective
parity, and asset summary.

---

## Status vocabulary

Overall: `HEALTHY` | `ATTENTION` | `BLOCKED` | `UNVERIFIED`

Never `HEALTHY` when required evidence is unreachable, stale, invalid, or absent.

Canonical invitation cells reuse `MATCH_CANONICAL` / `BEHIND_CANONICAL` / `DIVERGED` / …
Legacy cells use reference-relative `MATCH_REFERENCE` / `DIVERGED_FROM_REFERENCE` / …

Evidence freshness: `PASS` | `FAIL` | `STALE` | `NOT_RUN` | `INVALID`

---

## Validation evidence

| Item        | Location                                              | Owning command                         |
| ----------- | ----------------------------------------------------- | -------------------------------------- |
| Regression  | `.tmp/observability/validation/regression.json`       | `pnpm test:local-render-corpus`        |
| Screenshots | `.tmp/observability/validation/screenshots.json`      | `pnpm screenshot:local-render-corpus`  |

Snapshots are generated artifacts (gitignored via `.tmp/`). Schema version `1`. Freshness matches
`inputFingerprint` + `corpusFingerprint` against current registry/fixtures/test inputs.

Dashboard refresh **never** runs tests, screenshots, migrations, `invitation:update|reconcile|promote`,
asset uploads/downloads, or database writes.

---

## Distinction of corpora

| Surface                    | SSOT                                                      |
| -------------------------- | --------------------------------------------------------- |
| Canonical managed registry | `scripts/provision/invitations/registry.ts`               |
| Local Render Corpus        | `scripts/provision/local-render-corpus/registry.ts`       |
| Dashboard observability    | Aggregates the above; does not define a parallel slug list |

---

## Implementation

- Aggregation: `scripts/observability/snapshot.ts` → `buildObservabilitySnapshot()`
- Runtime gate: `src/lib/observability/runtime-gate.ts`
- UI: `src/pages/dashboard/observabilidad.astro` + `ObservabilityPanel`

## Known limitations

- No history, charts, polling, WebSockets, alerts, or GitHub/Vercel deployment history.
- Asset health uses repository inventory + fixture metadata + DB counts — not bulk binary download.
- Remote environment gaps degrade independently; they do not suppress the rest of the snapshot.
