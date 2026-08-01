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

- Aggregation (Node-only): `scripts/observability/snapshot.ts` → `buildObservabilitySnapshot()` & `buildObservabilitySummary()`
- Batched Database Probes: `scripts/provision/dbs-status.ts` → `evaluateBatchTargetStatuses()` (1 batched SQL query per target environment instead of 234 individual `psql` child processes).
- Runtime gate: `src/lib/observability/runtime-gate.ts` (enforces persistent-Local execution only; redirects to 404 on Vercel platform runtimes).
- Dual Payload Contracts:
  - `ObservabilitySummaryPayload`: Lightweight summary payload (< 3 KB) evaluated during Astro SSR and passed via props for immediate rendering. Served by `GET /api/dashboard/observabilidad?mode=summary`.
  - `ObservabilitySnapshot`: Full detailed matrix snapshot served on demand by `GET /api/dashboard/observabilidad?mode=detail`.
- Browser types: `src/lib/observability/types.ts` (duplicated, free of `scripts/` / Node imports).
- Server snapshot wrapper: `src/lib/observability/server/snapshot.ts`.
- UI island: `ObservabilityPanel` (4-tier visual hierarchy: Resumen, Invitaciones con atención requerida, Evidencia, Diagnóstico & comandos categorizados).

The mirrored type files are intentional: consolidating them into one module would risk pulling
Node-only scripts into the client bundle. Keep the separation.

## Deployment & Runtime Binary Contract

The dashboard is explicitly gated for **Local operator environments only**. It will not run on hosted Vercel function runtimes:
- `isLocalObservabilityRuntime()` detects `VERCEL=1` or `VERCEL_ENV=production|preview` and causes Astro SSR to redirect to `/404`.
- API route `/api/dashboard/observabilidad` rejects requests with a 404 error outside Local environments.
- This gate ensures Vercel deployments do not attempt to invoke non-existent local binaries (`psql`), execute filesystem subprocesses, or time out on serverless cold starts.

## Known limitations

- No history, charts, polling, WebSockets, alerts, or GitHub/Vercel deployment history.
- Asset health uses repository inventory + fixture metadata + Local DB counts — not bulk binary
  download.
- Environment / invitation / evidence failures degrade independently inside a `200` snapshot.
