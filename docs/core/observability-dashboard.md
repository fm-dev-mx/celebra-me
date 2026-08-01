# Observability Dashboard (Local-first)

**Owns:** read-only operational health for invitation corpus, environments, migrations, assets, and
latest Local validation evidence.

**Does not own:** writes, promotions, migrations, asset transfers, alerts, history, or remote
mutation authority. CLI workflows remain authoritative for all writes. Dashboard health never
authorizes remote mutation.

---

## Route & availability

| Item          | Value                                                                                 |
| ------------- | ------------------------------------------------------------------------------------- |
| Route         | `/dashboard/observabilidad`                                                           |
| API           | `GET /api/dashboard/observabilidad`                                                   |
| Runtime       | Approved persistent-Local only                                                        |
| Authorization | Authenticated `super_admin` with strong session (MFA / trusted device / Local bypass) |
| Rate limit    | `admin:observabilidad` (30 req/min)                                                   |
| Interaction   | Read-only                                                                             |
| Refresh       | Initial load + manual **Actualizar estado** only                                      |
| Polling       | None                                                                                  |

Request order:

```text
strong super_admin session → persistent-Local runtime → rate limit → probes
```

Outside Local (including Vercel Preview/Production), the page redirects to `/404` and the API
returns not-found. Non–`super_admin` dashboard users are redirected to `/dashboard/invitados` by
middleware. The route remains build-safe when hosted credentials are absent.

Local gate (executable contract in `src/lib/observability/runtime-gate.ts`):

- not hosted Vercel (`VERCEL=1` / `VERCEL_ENV=production|preview`);
- `CELEBRA_RUNTIME_TARGET` is not `preview`;
- `SUPABASE_URL` is Local Supabase (`http://127.0.0.1:54321` or `http://localhost:54321`).

Worktree path alone is never authorization. There is no alternate env-flag override for this gate.

---

## Observed environments

Local, Preview, and Production — connection, runtime identity, schema lifecycle, active invitation
rows (all non-archived), supported corpus presence (13 Local Render Corpus clients), and
render-effective parity.

**Asset health** is corpus-level evidence (repository inventory + fixture metadata + Local DB asset
counts). It is not presented as an independently verified per-environment remote asset audit.

---

## Status vocabulary

Overall: `HEALTHY` | `ATTENTION` | `BLOCKED` | `UNVERIFIED`

Never `HEALTHY` when required evidence is unreachable, stale, invalid, or absent.

Canonical invitation cells reuse `MATCH_CANONICAL` / `BEHIND_CANONICAL` / `DIVERGED` / … Legacy
cells use reference-relative `MATCH_REFERENCE` / `DIVERGED_FROM_REFERENCE` / …

Evidence freshness: `PASS` | `FAIL` | `STALE` | `NOT_RUN` | `INVALID`

---

## Validation evidence

| Item        | Location                                         | Owning command                        |
| ----------- | ------------------------------------------------ | ------------------------------------- |
| Regression  | `.tmp/observability/validation/regression.json`  | `pnpm test:local-render-corpus`       |
| Screenshots | `.tmp/observability/validation/screenshots.json` | `pnpm screenshot:local-render-corpus` |

Snapshots are generated artifacts (gitignored via `.tmp/`). Schema version `1`. Freshness matches
`inputFingerprint` + `corpusFingerprint` against current registry/fixtures/test inputs.

Regression totals (`total` / `passed` / `failed` / `failures[]`) are taken from Jest’s JSON report
for the corpus suite. Snapshot write failures never convert a failed validation into a pass.

Dashboard refresh **never** runs tests, screenshots, migrations,
`invitation:update|reconcile|promote`, asset uploads/downloads, or database writes.

---

## Distinction of corpora

| Surface                    | SSOT                                                       |
| -------------------------- | ---------------------------------------------------------- |
| Canonical managed registry | `scripts/provision/invitations/registry.ts`                |
| Local Render Corpus        | `scripts/provision/local-render-corpus/registry.ts`        |
| Dashboard observability    | Aggregates the above; does not define a parallel slug list |

---

## Implementation & type boundary

- Aggregation (Node-only): `scripts/observability/snapshot.ts` → `buildObservabilitySnapshot()`
- Runtime gate: `src/lib/observability/runtime-gate.ts`
- Browser types: `src/lib/observability/types.ts` (duplicated, free of `scripts/` / Node imports)
- Server snapshot wrapper: `src/lib/observability/server/snapshot.ts`
- UI island: `ObservabilityPanel` (fetches API only; never imports probe modules)

The mirrored type files are intentional: consolidating them into one module would risk pulling
Node-only scripts into the client bundle. Keep the separation.

## Known limitations

- No history, charts, polling, WebSockets, alerts, or GitHub/Vercel deployment history.
- Asset health uses repository inventory + fixture metadata + Local DB counts — not bulk binary
  download.
- Environment / invitation / evidence failures degrade independently inside a `200` snapshot.
