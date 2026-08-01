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
| Rate limit    | `admin:observabilidad` (6 req/min)                                                    |
| Concurrency   | One aggregation child process at a time (queued)                                      |
| Interaction   | Read-only                                                                             |
| Refresh       | Initial load + manual **Actualizar estado**; detail cached 60 s                       |
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

| Mode      | Wire size                         | Probe scope                             | Timeout | When                                   |
| --------- | --------------------------------- | --------------------------------------- | ------- | -------------------------------------- |
| `summary` | Small payload (&lt; 3 KB)         | **Local only** + FS validation evidence | 60s     | SSR + **Actualizar estado** (bootstrap) |
| `detail`  | Anomaly-first issues (schema v2)  | Local + Preview + Production            | 300s    | Panel issues UI (cached 60 s)          |

Summary is lightweight in **both** wire size and remote DB cost: it does not open Preview/Production
connections. Overall status for summary ignores unprobed remote stubs (`connection: unverified`).

Both modes run in an isolated child process (`scripts/observability/print-snapshot.ts`) so sync
`psql` / `execSync` probes cannot stall the Astro event loop.

---

## Observed environments

**Detail mode:** Local, Preview, and Production — connection, runtime identity, schema lifecycle,
active invitation rows (all non-archived), supported corpus presence (Local Render Corpus
clients), and render-effective parity. The browser receives only the projected issue list, not the
full matrix.

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

Validation evidence snapshots are generated artifacts (gitignored via `.tmp/`). Schema version `1`.
Freshness matches `inputFingerprint` + `corpusFingerprint` against current registry/fixtures/test
inputs.

Regression totals (`total` / `passed` / `failed` / `failures[]`) are taken from Jest’s JSON report
for the corpus suite. Snapshot write failures never convert a failed validation into a pass.

Dashboard refresh **never** runs tests, screenshots, migrations,
`invitation:update|reconcile|promote`, asset uploads/downloads, or database writes.

## Anomaly-first response contract

The browser detail payload uses schema version `2`. It intentionally contains only:

- overall status, generation time, cache state, and next refresh time;
- short source identity (branch, short SHA, dirty/clean state);
- healthy/attention/blocking/unverified counts by domain;
- non-healthy issues and allowlisted read-only or dry-run actions;
- compact regression and screenshot evidence.

Healthy invitation and asset rows, fingerprints, artifact paths, raw probe errors, resolved UUIDs,
database URLs, credentials, stack traces, and invitation content never cross the browser boundary.
The server validates the child-process JSON with a strict Zod schema before responding.

Issues are ordered by severity (`blocking` → `warning` → `unverified`) and then by domain/scope.
Contradictory counts, duplicate slugs, missing environment rows, impossible connectivity/parity
combinations, and inconsistent validation totals create a `DATA_INTEGRITY` issue and prevent a
healthy status.

## Resource limits and failure behavior

- Corpus status is queried once per configured environment with a batched SQL statement. Migration
  history adds one query per environment, for a maximum of six database subprocesses per uncached
  detail snapshot.
- Detail responses are cached for 60 seconds and share one in-flight rebuild across concurrent
  requests. There is no force-refresh bypass. At most one aggregation child runs at a time.
- Summary aggregation has a 60-second wall-clock limit; detail has 300 seconds. Child stdout is
  capped at 1 MiB and stderr at 4 KiB.
- When rebuilding detail fails, the last valid snapshot may be served for at most five minutes. It
  is marked `stale-fallback`, receives `SNAPSHOT_REFRESH_FAILED`, and cannot remain `HEALTHY`.
- The browser does not poll. Its refresh control becomes available at `refreshAfter`.

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
  `assembleObservabilityMatrix({ probeScope })`, `buildObservabilitySummary()` (always
  `probeScope: 'local'`), and `buildObservabilitySnapshot()` (detail → public issues).
- Public issue classifier: `scripts/observability/public-snapshot.ts`.
- Shared env pass: one `evaluateGeneralStatus({ environments })` feeds both migration-health and
  environment-health.
- Batched Database Probes: `scripts/provision/dbs-status.ts` →
  `evaluateBatchTargetStatuses(env, hashes, { slugs, includePublishedContent })` — corpus slug
  filter + unit-separator fields; content only when `includePublishedContent` (Local).
- Runtime gate: `src/lib/observability/runtime-gate.ts`.
- Dual Payload Contracts:
  - `ObservabilitySummaryPayload` (schema v1): small wire payload; Local-scoped compute; SSR +
    `?mode=summary`.
  - `ObservabilitySnapshot` (schema v2): anomaly-first issues; `?mode=detail`.
- Browser types/schema: `src/lib/observability/types.ts` + `src/lib/observability/schema.ts`.
- Server snapshot wrapper: `src/lib/observability/server/snapshot.ts` (child process + queue mutex +
  detail cache).
- UI island: `ObservabilityPanel` (SSR summary bootstrap; fetches detail for issues; never imports
  probe modules).

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
