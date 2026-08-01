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
| Concurrency   | One aggregation child process at a time (queued)                                      |
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

## Summary vs detail (compute contract)

| Mode      | Wire size                 | Probe scope                             | Timeout | When                        |
| --------- | ------------------------- | --------------------------------------- | ------- | --------------------------- |
| `summary` | Small payload (&lt; 3 KB) | **Local only** + FS validation evidence | 60s     | SSR + **Actualizar estado** |
| `detail`  | Full matrix               | Local + Preview + Production            | 300s    | **Ver detalle completo**    |

Summary is lightweight in **both** wire size and remote DB cost: it does not open Preview/Production
connections. Overall status for summary ignores unprobed remote stubs (`connection: unverified`).

Both modes run in an isolated child process (`scripts/observability/print-snapshot.ts`) so sync
`psql` / `execSync` probes cannot stall the Astro event loop.

---

## Observed environments

**Detail mode:** Local, Preview, and Production — connection, runtime identity, schema lifecycle,
active invitation rows (all non-archived), supported corpus presence (13 Local Render Corpus
clients), and render-effective parity.

**Summary mode:** Local probes only. Preview/Production cells are marked unprobed until detail runs.

Invitation batch SQL is always restricted to Local Render Corpus slugs. Published JSON content is
fetched only for Local (base64-encoded) to support legacy reference hashing — never pulled from
Preview/Production into the probe process.

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

## Validation evidence (optional for load; required for HEALTHY)

| Item        | Location                                         | Owning command                        |
| ----------- | ------------------------------------------------ | ------------------------------------- |
| Regression  | `.tmp/observability/validation/regression.json`  | `pnpm test:local-render-corpus`       |
| Screenshots | `.tmp/observability/validation/screenshots.json` | `pnpm screenshot:local-render-corpus` |

These CLIs are **operator evidence writers**, not runtime dependencies of the dashboard route:

- Refresh **never** runs tests, screenshots, Playwright, migrations, or promotes.
- Missing evidence → freshness `NOT_RUN` (page still loads); overall cannot be `HEALTHY`.
- PNG artifacts under `output/screenshots/` are not read by the dashboard — only the JSON evidence
  file is.
- No GitHub workflow invokes `pnpm screenshot:local-render-corpus`.

Snapshots are generated artifacts (gitignored via `.tmp/`). Schema version `1`. Freshness matches
`inputFingerprint` + `corpusFingerprint` against current registry/fixtures/test inputs.

Regression totals (`total` / `passed` / `failed` / `failures[]`) are taken from Jest’s JSON report
for the corpus suite. Snapshot write failures never convert a failed validation into a pass.

---

## Distinction of corpora

| Surface                    | SSOT                                                       |
| -------------------------- | ---------------------------------------------------------- |
| Canonical managed registry | `scripts/provision/invitations/registry.ts`                |
| Local Render Corpus        | `scripts/provision/local-render-corpus/registry.ts`        |
| Dashboard observability    | Aggregates the above; does not define a parallel slug list |

---

## Implementation & type boundary

- Aggregation (Node-only): `scripts/observability/snapshot.ts` →
  `buildObservabilitySnapshot({ probeScope })` & `buildObservabilitySummary()` (always
  `probeScope: 'local'`).
- Shared env pass: one `evaluateGeneralStatus({ environments })` feeds both migration-health and
  environment-health.
- Batched Database Probes: `scripts/provision/dbs-status.ts` →
  `evaluateBatchTargetStatuses(env, hashes, { slugs, includePublishedContent })` — corpus slug
  filter + unit-separator fields; content only when `includePublishedContent` (Local).
- Runtime gate: `src/lib/observability/runtime-gate.ts`.
- Dual Payload Contracts:
  - `ObservabilitySummaryPayload`: small wire payload; Local-scoped compute; SSR + `?mode=summary`.
  - `ObservabilitySnapshot`: full multi-env matrix; `?mode=detail`.
- Browser types: `src/lib/observability/types.ts` (duplicated, free of `scripts/` / Node imports).
- Server snapshot wrapper: `src/lib/observability/server/snapshot.ts` (child process + queue mutex).
- UI island: `ObservabilityPanel`.

The mirrored type files are intentional: consolidating them into one module would risk pulling
Node-only scripts into the client bundle. Keep the separation.

## Deployment & Runtime Binary Contract

The dashboard is explicitly gated for **Local operator environments only**. It will not run on
hosted Vercel function runtimes:

- `isLocalObservabilityRuntime()` detects `VERCEL=1` or `VERCEL_ENV=production|preview` and causes
  Astro SSR to redirect to `/404`.
- API route `/api/dashboard/observabilidad` rejects requests with a 404 error outside Local
  environments.
- This gate ensures Vercel deployments do not attempt to invoke non-existent local binaries
  (`psql`), execute filesystem subprocesses, or time out on serverless cold starts.

## Known limitations

- No history, charts, polling, WebSockets, alerts, or GitHub/Vercel deployment history.
- Asset health uses repository inventory + fixture metadata + Local DB counts — not bulk binary
  download.
- Environment / invitation / evidence failures degrade independently inside a `200` snapshot.
- SSR page load bypasses the API rate limiter (still Local + strong session gated); API refreshes
  are rate-limited and serialized through the aggregation mutex.
