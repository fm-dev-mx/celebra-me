---
title: Pre-production audit and cleanup handoff
status: active
created: 2026-09-08
updated: 2026-09-08
type: remediation
---

# Pre-production audit and cleanup handoff

## Contract and evidence boundary

Implement the approved exhaustive audit, evidence-backed local cleanup and verification. Git writes,
deployments, persistent-data changes, resource deletion and production transactions remain
separately gated. This is a point-in-time handoff, not another invitation registry or a release
certificate.

Baseline: clean dev-extra at 9de1852c8a8bd8987e24305f827f78de1b8d9907. Local edits remain
uncommitted. Executable/test/dependency candidate fingerprint:
017965939f46b791a4ea6cd1b095820dbe42798df73eb02d7ef41f3844d3e93a. Per-file hashes:
.agent/tmp/preproduction-audit-candidate.json.

Vercel metadata read on 2026-09-08 confirms Preview READY at that baseline SHA and Production READY
at 6081525ecebac24e99a4ccc085803186ce605a1d. Deployment identities do not establish content parity.
No remote credentials, private data or hosted state were changed.

Repository-wide inventory: 3,040 tracked paths; 18 managed definitions, 13 demos, 547 Jest-shaped
files before the new preflight suite, and 526 assets. Full provider/runtime coverage is not
established. The existing parity initiative remains authoritative for its unresolved presentation
findings: [invitation-production-parity.md](invitation-production-parity.md). Its prior
authorization is not inherited by this task.

## Confirmed corrections

- Removed automatic Docker restarts from Astro's development preflight. One bounded health read and
  the operator warning remain. Regression: five controlled hook cases; no live Docker/DB calls.
- Removed unused @fontsource/allura from package.json and lockfile. Checked direct dependencies,
  source/scripts/tests/docs references, font families and dynamic SCSS loading; all other runtime
  packages had references. No runtime bandwidth saving is claimed for a package already unimported.
- Static fallback now selects only archived_at instead of 19 fields, avoiding snapshot and client
  contact retrieval. Published-content precedence, archive denial, error propagation and query count
  remain unchanged. Regression: existing resolver suites plus four repository cases, 43 checks
  total.
- Header-only E2E uses HTTP requests instead of full page navigation. The old navigation returned no
  response during a transition; direct checks verify both status and exact cache policy.
- Updated the seal E2E and documentation from the stale 40 px minimum to the existing 34 px
  code/unit contract; retained the 48 px minimum hit area. Wait for load before successive sizing
  navigations. No product styling was changed.
- Extended the existing opt-in media diagnostic with completed requests and encoded response-body
  bytes by origin. Hidden Resource Timing values remain null; this is load-window evidence, not all
  interactions, complete-session traffic or billed usage.

REGRESSION_DECISION: focused tests for preflight and archive behavior; existing E2E extended for
header/sizing defects; no redundant test for unused dependency removal. Unreleased note updated.

## Route and coverage assessment

All 31 definitions/demos pass the content schema. All declared managed asset files exist. Each row
received one anonymous local HTML GET; no invite identifiers or data-changing interactions were
used. HTTP 200 is route availability only, not visual/functional acceptance. Feature/variant
inventory: .agent/tmp/preproduction-audit-inventory.json. HTTP evidence:
.agent/tmp/preproduction-audit-routes.json.

| Route                                               | Registry lifecycle | Local HTTP |
| --------------------------------------------------- | ------------------ | ---------- |
| /cumple/norma-hernandez                             | in_progress        | 404        |
| /cumple/alba-rosa-quinonez                          | published          | 200        |
| /xv/abril-michelle-becerra-rea                      | published          | 200        |
| /boda/daniela-y-martin                              | published          | 200        |
| /xv/romina-rios-chaparro                            | published          | 200        |
| /boda/victoria-y-roberto                            | published          | 200        |
| /xv/renata                                          | published          | 200        |
| /xv/leslie-perez                                    | published          | 200        |
| /xv/valentina-hernandez                             | published          | 200        |
| /xv/america-johana                                  | published          | 200        |
| /xv/ana-sofia-cota-guillen                          | published          | 200        |
| /xv/ayrin-samantha-lerma-castro                     | published          | 200        |
| /bautizo/cesar-ramses                               | published          | 200        |
| /cumple/gerardo-sesenta                             | published          | 200        |
| /baby-shower/leah-lexa                              | published          | 200        |
| /primera-comunion/luna-y-estrella                   | published          | 200        |
| /xv/xareni-iyarit                                   | published          | 200        |
| /xv/ximena-meza-trasvina                            | published          | 200        |
| /baby-shower/demo-baby-shower-celestial             | demo               | 200        |
| /bautizo/demo-bautismo-angelic-presence             | demo               | 200        |
| /boda/demo-boda-jewelry-box-wedding                 | demo               | 200        |
| /cumple/demo-cumple-luxury-hacienda                 | demo               | 200        |
| /primera-comunion/demo-primera-comunion-illustrated | demo               | 200        |
| /xv/demo-xv-celestial-blue                          | demo               | 200        |
| /xv/demo-xv-editorial-magazine                      | demo               | 200        |
| /xv/demo-xv-editorial-rose                          | demo               | 200        |
| /xv/demo-xv-editorial                               | demo               | 200        |
| /xv/demo-xv-enchanted-rose                          | demo               | 200        |
| /xv/demo-xv-jewelry-box                             | demo               | 200        |
| /xv/demo-xv-valentina-profile                       | demo               | 200        |
| /xv/demo-xv-xareni-profile                          | demo               | 200        |

Norma is in_progress and not a live published invitation in this local evidence. Do not publish it
or filter it out merely to pass tests. The visual page matrix currently includes it and requires
200; reconcile its intended release scope with the owner before claiming complete route
certification.

The registry-derived visual contract requires 106 variant captures plus 62 full-page captures at
390x844 and 1440x900. The accepted manifest is absent. Visual diagnostics and human acceptance
remain separate from schema and HTTP results. Final diagnostic: 182 passed and two failed out of 184
cases. Both failures are Norma's expected-200/actual-404 checks. Produced 166 of 168 required
captures: 106 structural and 60 full-page captures covering all 30 published/demo routes in both
viewports. Six additional page checks and ten structural checks account for the 16 non-capture
cases. Diagnostic artifacts are candidates, not approved reference comparisons or human acceptance.
Evidence: .agent/tmp/preproduction-audit-visual.log and
.tmp/preproduction-audit-visual-20260908/{manifest,pages-manifest}.json.

Existing shared tests cover content resolution, event isolation, unauthorized/private responses,
RSVP validation/idempotency, guest-context read budgets, media quotas/lifecycle, image delivery,
calendar/venue links, reveal behavior and demo showroom controls. These are shared-contract
coverage, not evidence that every interaction on every hosted route was exercised. Hosted flow
coverage and per-route visual acceptance remain UNVERIFIED.

## Provider and cleanup assessment

- Supabase: published anonymous resolution retains one published read; guest lookup budgets retain
  two reads on hit and one on miss, with one view-tracking write on a permitted hit. Mock-observed
  operation tests pass. Static demos still check published content and archive state; do not bypass
  these contracts solely to reduce requests. JWT-future retries remain bounded; no new retry added.
- Vercel: public documents revalidate; private/invalid responses remain private no-store. Do not add
  positive shared TTL without the existing freshness decision. Speed Insights is production/route
  gated with configured 0.1 sampling. Build/invocation/billing totals remain UNVERIFIED.
- Cloudinary/Storage: direct-delivery policies for prepared media are covered by existing tests.
  Mobile opened-page load sampled Renata: three Cloudinary responses, 839,122 encoded body bytes;
  Romina: three local Storage responses, 2,043,078 bytes. Astro development modules are excluded
  from those media totals. Network failures observed in these two samples: none. No production byte
  or latency budget is inferred from local development HTML. Evidence:
  .agent/tmp/preproduction-audit-network-origins.log.
- R2/Workers: upload/retrieval, quota, replay protection, private access, cleanup leases and batch
  bounds have source/test coverage. The configured daily cleanup and actual invocation evidence are
  different things; remote execution, object retention/orphans and billed operations remain
  UNVERIFIED. Potential repeated anonymization of expired already-anonymized sessions is an audit
  lead in the cleanup service; reproduce with a focused service test before changing its privacy
  behavior.
- Tracking/email: reviewed route/environment/consent boundaries and server-only sending ownership.
  No messages sent. Provider billing, live delivery and all dashboard workflows remain UNVERIFIED.
- Assets: 64 identical-byte groups across 133 files; retained. Samples include separate section
  roles, demo/client identities and public URL aliases. Equality alone does not justify deletion or
  prove duplicated network traffic. Evidence: .agent/tmp/preproduction-audit-asset-duplicates.json.
- Remaining code/dependency/asset deletion requires proven consumers and rollback compatibility; no
  speculative bulk deletion, new cache layer, DB migration or persistent-resource cleanup applied.

## Verification and next responsibility

Tier C attempted on the final code: type-check (1,721 files; zero diagnostics), structure, ESLint,
Stylelint, UI governance, event parity, PII hygiene and invitation preparation passed. Jest: 542
suites, 6,278 tests passed; one existing suite/test skipped because validate-commits-script.test.ts
explicitly skips its symlink-based range-validation fixture on Windows. CI then FAILED at visual
comparison because the accepted manifest is missing. It is not a green release pipeline. Log:
.agent/tmp/preproduction-audit-final-ci.log.

- validate:changed: passed, including 292 related checks and 24 corpus regression checks before the
  final documentation-only handoff additions.
- Final independent functional E2E: 58/58 passed, one worker, zero retries. Suites:
  demo-routing-parity, invitation-route-isolation, envelope-reveal-interaction,
  image-delivery-contract, rsvp-decoration-containment and personalized-access-surface. Evidence:
  .agent/tmp/preproduction-audit-final-e2e.log.
- Media diagnostic: 2/2 passed; captures network evidence, not acceptance thresholds.
- build:app: passed independently after CI could not reach its build step. Bounded built-artifact
  scans found no test-harness routes in the server function and no service-role environment key name
  or child_process import in client JavaScript; this does not establish exhaustive privacy.
- test:db:rsvp-contracts and test:db:managed-contracts: passed on disposable-test after guarded
  setup. Logs: .agent/tmp/preproduction-audit-db-rsvp.log and
  .agent/tmp/preproduction-audit-db-managed.log.
- Disposable services stopped after use. Persistent-local sentinel confirmed present after tests.
- No production transactions, migrations, hosted content writes, load tests, emails or provider
  resource deletion. release-check not run: its clean-HEAD evidence cannot certify uncommitted
  edits.
- Temporary audit listeners on 4331/4332 are gone; the pre-existing 4321 server remains untouched.
- Git Safety closure is recorded in the final session handoff after this document is finalized. No
  staging, commits, branch changes, push or deployment authorized.

Release remains blocked pending accepted visual evidence, final green CI, scoped hosted verification
and explicit resolution of material remaining findings. Prior parity records report hosted access
failures and unapproved Romina media budget exceptions; they are unresolved evidence, not accepted
waivers. Do not retry rejected hosted credential operations through another tool.

Next: resolve the Norma lifecycle/visual-matrix mismatch with the owner; obtain the exact visual
reference acceptance through the existing workflow; verify Preview content and provider telemetry
with appropriate access; then rerun affected release checks on the exact integrated candidate.
Rollback for this local patch is limited to reversing its reviewed source/dependency/test changes;
there is no data migration to reverse. A production rollback must use a separately approved,
compatible deployment. Do not restore the automatic shared-container restart as operational
recovery.

## Follow-up implementation — 2026-09-08

Current baseline: clean dev-extra at 35068a81a483bbacb636dd54d946bd889f21522c. The user committed
and deployed the preceding work. Preview deployment dpl_zjvAcgfxuTCAvjTU8SJGDaTq5yPf is READY at
that SHA. A single credential-free public request returned 302 to Vercel protection; no bypass
credential was transmitted. New changes below are local and uncommitted. This section supersedes
earlier pending Norma/Valentina decisions, not historical test evidence.

### Implemented and measured

- Public visual coverage now derives from published lifecycle definitions plus all demos in the
  active content directory. Demos have no separate lifecycle field. No slug exclusion and no
  publication-state change. A draft-to-published regression changes page coverage and its hash
  without removing any structural variant. Norma's public 404/private-cache regression passes.
- Complete diagnostic: 209/209 cases passed, including 106 structural and 60 full-page captures.
  Evidence: .agent/tmp/release-gap-visual.log and .tmp/release-gap-visual-20260908/. These captures
  are diagnostic, not an accepted reference set. Runtime local content may still use previously
  published media; candidate source bytes are validated separately below.
- Romina hero-mobile.webp: 1280x1920, 245264 bytes, below 358400. gallery-final.webp (social key):
  1280x853, 176790 bytes, below 184320. Prepared with normalizeInvitationImage and the existing role
  budgets; no crop or focal-point change. Original JPEG hashes are protected by tests. sourcePolicy
  preserve and explicit original delivery prevent publication/runtime re-encoding. Comparison:
  .agent/tmp/release-gap-media/comparison.jpg (original left, derivative right); full
  metadata/hashes: .agent/tmp/release-gap-media/report.json. Human visual approval is pending.
- Compared with the previously recorded 379472/499896-byte delivered files, the two proposed
  replacements total 422054 bytes versus 879368 (457314 fewer bytes, about 52%). This is a two-file
  projection, not measured provider savings, complete-page savings or billing telemetry.
- Valentina's fully visible surname is explicitly owner-approved. Only the existing title-wrapper
  anti-clipping change is excepted; baseline acceptance and other typography remain separate.
- Seven 414x896 route regressions are included in test:e2e:ci. They check public rendering,
  horizontal overflow, application errors and completed broken images, not pixel parity or all
  lazy-loaded media. Final execution: 7/7 passed. Evidence: .agent/tmp/release-gap-narrow-final.log.

### Confirmed recurring-consumption defect

An isolated service test reproduces repeated anonymization of an already-anonymized expired empty
session: two cleanup runs issue two PATCHes and two audit writes for that same session. No R2
objects or live database were used. Revoked rows remain eligible for subsequent selection, so they
can also occupy the bounded session batch repeatedly. Production incidence is UNVERIFIED.

The current schema has no independent anonymized_at marker. Do not substitute display_name or
revoked_at as proof of anonymization: a revoked session can still require personal-data removal. A
correct durable fix needs a separately reviewed schema/application contract: an explicit marker,
atomic marker-and-anonymization update, exclusion of completed rows, and tests for repeated runs,
concurrency, retained items and revoked-but-not-anonymized rows. No schema change is included here,
as the approved plan excludes it. The characterization test records this unresolved defect; its
passing result does not mean idempotency is fixed. Treat resolution or explicit impact acceptance as
a release gate.

### Operation budgets and remaining coverage

| Scenario                                                               | Evidence / budget                                                                               | Status                                 |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------- |
| Empty cleanup batch                                                    | Five bounded DB operations; zero object or audit operations in service test                     | PASSED locally                         |
| Previously anonymized empty session                                    | Repeated update/audit per run reproduced; target is zero repeated writes                        | FAILED invariant                       |
| Session retaining undeleted media                                      | No session PATCH or anonymization audit                                                         | PASSED locally                         |
| Public published resolution                                            | Existing one-read contract; no runtime query change in this patch                               | Existing test evidence                 |
| Guest context                                                          | Existing hit/miss and authorized view-write budgets preserved                                   | Existing test evidence                 |
| New Romina media                                                       | Both role byte limits and exact-byte preservation tested                                        | PASSED locally; publication UNVERIFIED |
| All public routes, mobile/desktop                                      | 60 page captures; 30 public routes                                                              | PASSED locally; Preview UNVERIFIED     |
| Hosted RSVP, access, QR and uploads                                    | Need controlled fixture transaction and cleanup authorization                                   | UNVERIFIED                             |
| Demo persistence and interactions                                      | Existing deterministic contracts and routing suite; full hosted interaction measurement pending | PARTIAL                                |
| Scheduled cleanup telemetry                                            | Production log query, 24h, cleanup filter, grouped status: no rows returned                     | UNVERIFIED                             |
| Billing, object retention and complete interaction request/byte counts | No complete provider telemetry or controlled hosted scenarios available                         | UNVERIFIED                             |

### Verification and release gates

Focused lifecycle/cleanup cases: 5 passed. Prepared media and normalized release roundtrip: 8
passed; 64 existing image transformation tests also passed. validate:changed passed after correcting
a fixture that wrote JPEG bytes under every filename, including WebP. Evidence:
.agent/tmp/release-gap-changed-final.log. Tier C pre-browser checks passed: type-check (1725 files,
zero diagnostics), structure, ESLint, SCSS, UI governance, event parity, PII checks, preparation and
545 Jest suites / 6285 tests. One existing Windows-specific suite/test remains skipped. CI first hit
the occupied pre-existing 4321 port. Repeating only its browser stage on owned port 4331 failed at
the missing accepted visual manifest, as required. This is not green CI. Evidence:
.agent/tmp/release-gap-ci-final.log and .agent/tmp/release-gap-ci-browser.log. build:app passed
independently in 17.85s. The seven narrow viewport checks passed. Temporary listeners are gone and
the original 4321 server remains. Git Safety closure follows document finalization; the final task
response records its outcome.

No deployment, commit, persistent publication, cleanup invocation or provider-resource deletion was
performed. Existing disposable DB results apply to unchanged DB/runtime contracts; no database
migration was introduced. Full visual candidate/accept require a clean source revision and explicit
human hash approval. Do not manufacture accepted metadata from these diagnostic artifacts.

Next required handoff: user reviews and commits this patch; separately authorize only the two Romina
asset replacements and their content-reference updates through the guarded managed-release flow,
first Local then Preview, retaining old objects and verifying all unrelated content unchanged.
Deploy the resulting source SHA. Authorize bounded protected Preview reads through the existing
same-origin bypass fixture; any synthetic persistent writes remain separately scoped. Complete
hosted route/feature evidence and review visual differences, then accept the exact candidate hashes,
commit accepted artifacts, and rerun final CI/release checks. Resolve the cleanup idempotency gate.
Production deployment remains a separate decision.

Rollback: reverse reviewed source/tests and the two derivative references; original media remains.
Once publication is separately authorized, retain the previous published version and object
references for a compatible content rollback. Do not delete originals or shared provider objects.

## Readiness closure checkpoint — 2026-09-08

Baseline c0b6b26d67e4cbb14eff385fb247759fac12cfdd, clean before this implementation. The owner
requested closing the remaining gates. This checkpoint supersedes the unresolved local anonymization
finding above; deployment and acceptance are still distinct from implementation.

### Closed with current evidence

- Protected Preview public suite: 61 passed (30 routes at two viewports plus general public/resource
  smoke), one synthetic-fixture read skipped because its identifier is not configured. Deployment
  dpl_H7eJi64gEyCTBhkVUiJHDb44eBpW is READY at the baseline SHA. Secret came from .env.local and was
  supplied only to the same-origin fixture; no secret files were copied or values logged. Evidence:
  .agent/tmp/preview-c0b6b26-public-authorized.log.
- Romina's actual mobile hero and final gallery response bodies are byte-identical to the prepared
  sources: 245264 and 176790 bytes, both HTTP 200. No upload or republishing was necessary.
  Evidence: .agent/tmp/romina-preview-delivered-media.json. The broader dry-run proposed unrelated
  Local uploads and later became blocked by the pending schema; neither plan was applied.
- Repeated anonymization fixed in local source: additive anonymized_at marker; service-role-only
  security-invoker RPC; event/session locks in reservation order; undeleted-item check; identity,
  marker and audit in one transaction. Completed rows are excluded from future batches. Missing
  migration/RPC fails closed. Legacy rows receive one final anonymization; no name-based backfill.
- Disposable SQL: all suites passed, including 15 new permission/isolation/retry/retained-media/
  rollback assertions. Concurrency: exactly one anonymization winner and audit; reservation versus
  anonymization cannot both succeed. Existing idempotency, quotas, signer failure, deduplication,
  delete race, cleanup leases and 100 synthetic contention reservations passed on disposable DB. No
  live R2 operations. Evidence: .agent/tmp/readiness-db-tests.log and
  .agent/tmp/readiness-memory-concurrency-verified.log.
- Public RSVP DB/HTTP contracts passed on disposable PostgREST. This verifies the real HTTP/service/
  RPC boundary locally, not a hosted RSVP transaction. Evidence: .agent/tmp/readiness-rsvp-db.log.
- validate:changed: 281 tests passed. Tier C: type-check (1725 files, no diagnostics), structure,
  lint, styles, UI governance, event parity, PII and preparation passed; 545 suites / 6285 tests
  passed, one existing Windows skip. Browser comparison FAILED for the missing accepted manifest.
  Evidence: .agent/tmp/readiness-changed-final.log and .agent/tmp/readiness-ci.log.
- Disposable services stopped; persistent-local sentinel remains present. Preview runtime log query
  grouped by status returned 126 HTTP-200 records in its 24h window; this is not a billing count or
  complete lifecycle/cleanup proof. No production transaction or persistent migration was run.

### Mandatory rollout order and unresolved gates

1. Review and commit the local correction, without deploying its application code yet. The canonical
   Preview migration preflight refuses a dirty worktree in migrate-policy-preview.ts. This is an
   actual DIRTY_WORKTREE failure, not an automatic approval rejection. No Git writes are authorized.
2. With clean HEAD and current disposable proof, review exactly migration 20260908212231 using pnpm
   db:migrate -- --target preview --expected 20260908212231. Apply only the reviewed additive
   migration through the canonical scoped Preview workflow before deploying this cleanup code.
   Production requires its own owner schema apply before its application rollout.
3. Complete the controlled hosted flows. Current .env.local/.env.preview.local do not configure
   PLAYWRIGHT_HOST_LOGIN, PLAYWRIGHT_HOST_PASSWORD or PLAYWRIGHT_PREVIEW_INVITATION_ID. Use the
   dedicated synthetic Preview fixture and approved cleanup, never customer records. The bypass
   secret is available and already verified; do not ask for it again. R2 canaries additionally need
   verified Preview isolation before any write to avoid touching production resources.
4. Generate the visual candidate only on a clean committed source and the prescribed Linux x64, Node
   24.14.1, pnpm 11.23.0, Playwright 1.62.1 runtime with a real image digest. Current Windows
   diagnostic captures are not acceptable substitutes. Obtain exact human reference/matrix/manifest
   hash approval; then use the existing accept workflow, commit its accepted artifacts and rerun
   complete CI/release checks. No thresholds or manifests were weakened or fabricated.
5. Verify deployed cleanup execution and remaining provider telemetry after rollout. No absence of
   logs is counted as zero consumption. Production deployment remains a separate owner decision.

Rollback: the migration is additive. Retain its column/function when rolling the application back;
old code remains schema-compatible but reintroduces repeated work. Do not remove the marker or
restore personal data. The forward fix must be redeployed before claiming idempotent cleanup. Final
build and Git Safety closure are recorded in the final session handoff.
