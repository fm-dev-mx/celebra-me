---
title: Invitation delivery and performance metrics
lifecycle: evergreen
domain: invitation-delivery
last_reviewed: 2026-08-16
---

# Invitation delivery and performance metrics

This is the canonical performance and resource-monitoring model for Celebra-me invitation delivery
and RSVP. It explains which metrics matter, where they are measured, what can fail CI, and when to
investigate.

Cache **correctness** for public and private responses remains
[`public-response-cache-policy.md`](public-response-cache-policy.md). This document does not change
that policy.

Numeric baselines below come from production `www.celebra-me.com` on 2026-08-16 via
`pnpm invitation:delivery:baseline` (two unthrottled 5-sample document runs). Representative
routes: `/xv/renata` (versioned Cloudinary), `/xv/romina-rios-chaparro` (mutable Storage), and
`/xv/renata?invite=fixture-not-a-guest` (synthetic invite; no guest PII).

A metric is canonical only if a meaningful change can trigger a concrete decision. Timing metrics
are not CI gates.

## Enforcement classes

| Class | Use for | Fails CI |
| --- | --- | --- |
| Hard CI | Deterministic correctness | Yes |
| Budget | Stable resource size with documented provenance | Optional script only |
| Runtime | Real-user or environmentally variable metrics | No |
| Informational | Investigation aids that do not predict harm by themselves | No |

**Budget** enforcement is `pnpm invitation:delivery:baseline --assert-budget`. It is not part of
`pnpm test` or `pnpm run ci`. Do not add TTFB, LCP, CLS, or INP thresholds to those suites.

## Cost-per-operation model

Interpret provider totals relative to traffic. A 20% traffic increase with an 80% read increase is
an efficiency regression; the same read increase with matching traffic is expected.

### Anonymous invitation view

`document render → 1 published-content read → critical assets and media`

The document is origin-revalidated (`public, max-age=0, must-revalidate` in production). Hashed
`/_astro` and versioned Cloudinary assets may be long-lived. Mutable Storage media must not use a
stale-prone `/_vercel/image` transform.

### Personalized invitation view

`document render → guest resolution → 1 published-content read → optional view-track write → assets`

The document is `no-store, private`. Empty `?invite=` must not look up a guest. A lookup miss is one
guest read and no view-track. A hit is guest + event (two reads) plus one fire-and-forget view-track
write.

### RSVP submission (invite link)

`validate → 1 guest lookup → 1 submit_guest_rsvp_public RPC → confirmation`

The live repository helper re-reads the guest after the RPC to return the record. Client UI must
not double-submit while the request is in flight. A failed RSVP is more important than a small
LCP change.

## Canonical registry

| Metric | Class | Source | Decision |
| --- | --- | --- | --- |
| Anonymous HTML cache | Hard CI | Jest + baseline script | Privacy/freshness |
| Personalized HTML cache | Hard CI | Jest + baseline script | Privacy |
| Storage vs `/_vercel/image` | Hard CI | Jest (code); live until deploy | Freshness |
| Cloudinary optimize eligibility | Hard CI | Jest | Delivery path |
| Content-addressed public ID | Hard CI | Jest | Replace-without-stale |
| Published-content reads | Hard CI | Jest | DB cost |
| Personalized lookup counts | Hard CI | Jest | DB cost |
| RSVP submit ops / duplicates | Hard CI | Jest | Reliability |
| HTML transfer size | Budget | Baseline `--assert-budget` | Structural growth |
| LCP / CLS / INP | Runtime | Vercel Speed Insights | UX |
| TTFB / render timing | Runtime | Headers + Speed Insights | Server cost |
| RSVP errors / latency | Runtime | Vercel logs; no in-repo alert | Reliability |
| Provider usage vs traffic | Runtime | Provider dashboards | Cost |
| HTML inventory / hero bytes | Informational | Baseline script | Diagnosis |

## Budget registry

HTML size is the only numeric performance budget. Unique URLs discovered in HTML are **not** a
budget: they do not equal executed requests and do not reliably predict LCP or bandwidth.

| Scenario | Baseline (B) | Budget (B) | Status |
| --- | ---: | ---: | --- |
| Versioned anonymous (renata) | 69 382 | 94 000 | Provisional |
| Legacy Storage (romina) | 75 902 | 103 000 | Provisional |
| Personalized miss (renata) | 69 413 | 94 000 | Provisional |

**Derivation:** measured HTML bytes on 2026-08-16 plus about 35% headroom. That percentage is a
**provisional regression margin** for substantial structural growth (new critical CSS/JS, duplicated
documents, accidental inlining). It is not an HTML optimization target. Increases below the ceiling
can still warrant review when the cause is suspicious (for example a second copy of a view-model in
the document).

**Normal variation:** HTML bytes were identical across two 5-sample runs. Timing was not.

**Intended catch:** accidental document bloat, not a 2–3 KB copy tweak.

Encoded in `src/lib/invitation/delivery-budget.ts` as `MEASURED_PRODUCTION_HTML` and
`DELIVERY_HTML_BUDGETS`.

### Budget-update policy

A budget must never be increased solely to make a failing validation pass.

When a budget is exceeded:

1. Identify what changed in the document or render path.
2. Quantify the delta in bytes (and, if relevant, which URLs appeared).
3. Decide whether it is a regression or an intentional product change.
4. Evaluate user and resource impact (LCP candidate, bandwidth, function time).
5. Fix the regression when the extra cost is not justified.
6. Update `MEASURED_PRODUCTION_HTML` and `DELIVERY_HTML_BUDGETS` together only when the new cost is
   accepted. Record the reason in the change that updates those constants.

Do not silently regenerate baselines. Do not copy generic “HTML < 100 KB” advice over project
evidence.

## Metric catalog

### Anonymous invitation HTML cache

**Definition.** Effective `Cache-Control` on anonymous `/{eventType}/{slug}` HTML: public,
`max-age=0`, no positive `s-maxage`, no `stale-while-revalidate`. Production may omit the source
token `s-maxage=0`. `x-vercel-cache` for the document must not be `HIT`.

**Why it matters.** Hosts republish invitations; a shared TTL would show a stale published version.

**Measurement.** `tests/unit/private-cache-contract.test.ts`,
`tests/unit/delivery-contract.test.ts`, `pnpm invitation:delivery:baseline`.

**Enforcement.** Hard CI (helpers + page source). Baseline script also fails `--assert-budget` on a
document HIT.

**Baseline.** Production 2026-08-16: `public, max-age=0, must-revalidate`; document MISS/MISS.

**Interpretation.** A positive shared TTL is a correctness defect, not a performance win.

**Example.** `s-maxage=60` on `/xv/renata` would let CDNs serve an hour-old republish.

**Use case.** Any change to `[eventType]/[slug].astro` cache headers, middleware, or ISR/SWR.

**Action.** Revert the TTL. Do not “fix” it by caching personalized HTML.

### Personalized and private cache

**Definition.** `?invite=`, short invite routes, dashboard, auth, and captura responses use
`no-store, private` (see the cache policy doc for the full private surface).

**Why it matters.** Guest names and RSVP state must not enter a shared cache.

**Measurement.** Jest cache-contract tests; baseline scenario `personalizedLookupMiss`.

**Enforcement.** Hard CI.

**Baseline.** `/xv/renata?invite=fixture-not-a-guest` returned `no-store, private` and document
MISS.

**Interpretation.** Missing `private` or a public TTL on an invite URL is a privacy incident.

**Example.** Caching `/xv/renata?invite=…` as public would leak one guest’s HTML to another.

**Use case.** New query params, middleware exceptions, or `jsonResponse` cache changes.

**Action.** Restore `no-store, private`. Confirm `hasInviteParam` still forces the private branch.

### Mutable Storage vs `/_vercel/image`

**Definition.** In-place Supabase Storage URLs must not be rewritten through `/_vercel/image`.
Versioned Cloudinary and hashed `/_astro` remain eligible.

**Why it matters.** Vercel image transforms can cache a derived byte stream after the Storage object
is replaced.

**Measurement.** `tests/unit/vercel-image-policy.test.ts`, HTML inventory in
`delivery-contract` tests. Live production HTML may still wrap Storage until that policy is
deployed; hermetic tests guard the code.

**Enforcement.** Hard CI for code. Live `stale-vercel-storage` count in the baseline script is
report-only until production matches the code.

**Baseline.** Renata: 0 Storage-through-Vercel URLs. Romina production HTML on 2026-08-16: 4 wrapping
URLs (pre-deploy). Displayed mobile Romina hero was already raw Storage via `<picture>`.

**Interpretation.** Re-enabling Storage through `/_vercel/image` is a freshness regression even if
LCP looks better.

**Example.** Romina `hero.webp` origin 379 472 B vs a 168 431 B Vercel JPEG fallback. Typical mobile
LCP already uses the Storage `<source>`. Do not restore the transform to “optimize” that fallback.

**Use case.** Image component changes, new Storage uploads, or LCP path debugging.

**Action.** Keep the cache-safe `<img>` bypass. Treat Cloudinary rehost as a separate product change.

### Cloudinary optimize eligibility and content-addressed IDs

**Definition.** Hashed Cloudinary public IDs stay eligible for `/_vercel/image`. The public ID
changes when `sha256` changes.

**Why it matters.** Versioned media can be cached long-lived; a new hash is a new object, so
replacements are not stale.

**Measurement.** `tests/unit/vercel-image-policy.test.ts`,
`tests/provision/cloudinary-adapter.test.ts`.

**Enforcement.** Hard CI.

**Baseline.** Renata hero-desktop `…-0cc4c2f74a2b.webp` through `/_vercel/image` delivered 128 150 B,
`max-age=2592000`, repeat HIT.

**Interpretation.** A stable public ID after a byte change means clients can keep the old image.

**Example.** Changing only the file on a mutable Storage path would not change the URL; hashed
Cloudinary would.

**Use case.** Adapter or upload-pipeline changes; “the new hero does not show”.

**Action.** Confirm `buildCloudinaryPublicId` includes the content hash. Do not flatten hashes to
stable keys.

### Published-content reads

**Definition.** A published anonymous invitation resolves with one
`findPublishedBySlugAndEventType` read and must not also `findInvitationBySlug` on that hit.

**Why it matters.** Extra resolver calls add TTFB and Postgres load on every guest open.

**Measurement.** `tests/unit/content-resolver.test.ts`. Constants in
`src/lib/invitation/delivery-contract.ts`.

**Enforcement.** Hard CI. Count is operations per request, not monthly totals.

**Baseline.** `ANONYMOUS_PUBLISHED_CONTENT_READS = 1`.

**Interpretation.** A second published-content or invitation-row read on the happy path is a cost
regression.

**Example.** Restoring a fallback `findInvitationBySlug` on published hits would double work for
Renata and Romina.

**Use case.** Content-resolver or route-loader edits.

**Action.** Remove the extra call. Do not raise the constant to match it.

### Personalized lookup counts

**Definition.** Empty invite id: 0 extra reads. Miss: 1 guest context read, 0 view-track. Hit: 2
reads (guest + event) and 1 view-track write.

**Why it matters.** Personalization cost must stay on the invite path, not leak into anonymous
renders or retry loops.

**Measurement.** `tests/integration/invitation-route-personalization.test.ts`.

**Enforcement.** Hard CI.

**Baseline.** Constants `PERSONALIZED_GUEST_CONTEXT_READS_ON_MISS = 1`,
`PERSONALIZED_GUEST_CONTEXT_READS_ON_HIT = 2`, `PERSONALIZED_VIEW_TRACK_WRITES_ON_HIT = 1`.
Production miss HTML was only +31 B vs anonymous Renata.

**Interpretation.** Extra lookups without a guest payload are wasted origin time.

**Example.** Calling context twice on a successful invite would double RSVP DB reads per open.

**Use case.** `resolveRoutePersonalization` or view-track changes.

**Action.** Restore the one-shot lookup. Keep `no-store` on the document.

### RSVP submit operations and duplicate prevention

**Definition.** Invite-link `POST /api/invitacion/:inviteId/rsvp`: one guest lookup, then one
`submit_guest_rsvp_public` RPC. The UI must not send a second submit while loading. Confirmation
must reflect the mutation.

**Why it matters.** Duplicate submits and silent RPC failures break the product more than a slow
hero.

**Measurement.** `tests/unit/rsvp-v2.service.test.ts`, `tests/components/RSVP.test.ts` (in-flight
duplicate), `tests/db/public-guest-rsvp-db-boundary.test.ts` (RPC atomicity). Constants in
`src/lib/rsvp/rsvp-operation-contract.ts`.

**Enforcement.** Hard CI for call counts and duplicate UI. Submit **latency and error rate** are
runtime (logs), not CI timing.

**Baseline.** Service layer: `RSVP_SUBMIT_BY_INVITE_SERVICE_LOOKUPS = 1`,
`RSVP_SUBMIT_BY_INVITE_MUTATION_RPCS = 1`. The live RPC helper then re-reads the guest to return the
row.

**Interpretation.** A second RPC per click is a reliability and write-amplification defect.

**Example.** Removing the loading guard would let a double tap write twice; the RPC must still be
idempotent, but the client must not invite that.

**Use case.** RSVP island or submission-service changes.

**Action.** Keep one in-flight request. Inspect Vercel logs for `/api/invitacion/**/rsvp` 5xx before
tuning LCP.

### HTML transfer size

**Definition.** Byte length of the invitation HTML document (not total page weight).

**Why it matters.** Smoke metric for structural document growth. It is not a primary product KPI
and is a weak LCP proxy.

**Measurement.** `pnpm invitation:delivery:baseline` (`htmlBytes`). Optional `--assert-budget`.

**Enforcement.** Budget (provisional). Not in `pnpm test`.

**Baseline / threshold.** See [Budget registry](#budget-registry).

**Interpretation.** A jump toward the ceiling often means new inlined CSS/JS or duplicated markup.
A 1 KB copy change is noise.

**Example.** Renata 69 382 B vs Romina 75 902 B: Romina is a heavier document, not a failed budget.

**Use case.** After adding sections, fonts-in-HTML, or JSON-LD blobs.

**Action.** Diff HTML inventories. Do not raise the budget to silence `--assert-budget`.

### LCP

**Definition.** Largest Contentful Paint. On invitations the LCP element is usually the hero image
or cover.

**Why it matters.** First meaningful visual of the invitation. Guests judge quality here.

**Measurement.** Vercel Speed Insights on production (`Layout.astro` loads it when
`VERCEL_ENV=production`, including invitation routes). Local/embedded browsers in this repo did not
reliably emit LCP entries — treat lab LCP as **not reliably observable**. Prefer real-user **p75**
over one laptop sample.

**Enforcement.** Runtime. Web Vitals “good” LCP (p75 ≤ 2.5 s) is contextual reference only — not a
CI gate.

**Baseline.** No stable lab LCP. Displayed mobile heroes on 2026-08-16: Renata Cloudinary
`hero-mobile` 128 150 B; Romina Storage `hero.webp` 379 472 B.

**Interpretation.** Sustained p75 degradation on invitation routes, not a single cold start.

**Example.** If Romina p75 LCP is worse than Renata, inspect the 379 KB Storage hero and the
picture/srcset path — not HTML cache TTLs.

**Use case.** Hosts report “la invitación tarda en verse”; after replacing a hero; after Speed
Insights weekly review.

**Action.** Identify the LCP URL (hero vs font vs section). Check bytes and delivery path (hashed
Cloudinary vs Storage). Check `X-Render-Timing-Detail` only if the document itself is slow.

### CLS

**Definition.** Cumulative Layout Shift.

**Why it matters.** Shifts on hero, fonts, or RSVP feel cheap and can cause mis-taps.

**Measurement.** Vercel Speed Insights p75. No hermetic CLS test.

**Enforcement.** Runtime.

**Baseline.** None in-repo.

**Interpretation.** Invitation-specific causes: images without dimensions, late webfonts (for
example display scripts), reveal/envelope, dynamically injected RSVP or map.

**Example.** A hero `img` without width/height that swaps from a tiny placeholder to 1707×2560 will
move the RSVP block.

**Use case.** Visual QA after gallery/hero/font changes; Speed Insights CLS regression.

**Action.** Fix dimensions or reserve space. Do not disable the reveal to chase a lab score.

### INP

**Definition.** Interaction to Next Paint.

**Why it matters.** RSVP, gallery, menu, and maps must respond. INP is not the first-view quality
signal (that is LCP) but it is the interaction signal.

**Measurement.** Vercel Speed Insights p75.

**Enforcement.** Runtime.

**Baseline.** None in-repo.

**Interpretation.** Spikes clustered on RSVP submit or map init point at those islands, not at HTML
size.

**Example.** A gallery that decodes every image on first tap can delay INP without changing LCP.

**Use case.** Guests report that Confirmar asistencia feels stuck; after adding client JS.

**Action.** Profile the island. Keep the duplicate-submit guard. Do not add a CI INP threshold.

### TTFB and server render timing

**Definition.** Time to first HTML byte, plus `X-Render-Timing` / `X-Render-Timing-Detail`
(`resolveContent`, `routePersonalization`, `pagePrepare`).

**Why it matters.** Origin work (DB, personalization) shows up here. It is a poor CI signal: two
5-sample runs on 2026-08-16 showed Renata TTFB medians of 341 ms and 663 ms (range 306–1494 ms).

**Measurement.** Baseline script; Speed Insights TTFB; response headers.

**Enforcement.** Runtime / informational headers. Never `TTFB < X ms` in CI.

**Baseline.** Personalized miss adds `routePersonalization` on the order of 100–320 ms on top of
content resolve.

**Interpretation.** Sustained origin-time increase with flat traffic suggests extra queries or a
cold-start mix change — confirm with query-count tests before “optimizing” cache TTLs.

**Example.** A second published-content read would likely lift `resolveContent`, not CSS size.

**Use case.** Slow HTML with a fast LCP image; personalization work.

**Action.** Read `X-Render-Timing-Detail`. Compare anonymous vs `?invite=`. Check resolver call
counts.

### Hero / LCP resource bytes

**Definition.** Transferred bytes of the likely LCP image. The baseline script probes the HTML
high-priority `<img>`, which may be a `<picture>` fallback rather than `currentSrc`.

**Why it matters.** Mobile bandwidth and LCP. Bytes are often more actionable than one timing
sample.

**Measurement.** Informational in `invitation:delivery:baseline` (`hero.deliveredBytes`,
`hero.originBytes`). Displayed `currentSrc` needs a browser.

**Enforcement.** Informational. No CI budget: Romina’s displayed hero is ~3× Renata by design of
the legacy asset, and the HTML hero URL is not always the painted one.

**Baseline.** Renata displayed ~128 KB hashed Cloudinary. Romina displayed ~379 KB Storage webp;
HTML fallback img was a 168 KB Vercel JPEG.

**Interpretation.** 128 KB → 135 KB is noise. 128 KB → 380 KB on a **versioned** invitation is a
media-pipeline issue.

**Example.** Do not weaken Storage freshness to recapture the 168 KB Vercel JPEG on Romina. If a
new versioned hero lands near 379 KB, inspect export size and Cloudinary transforms.

**Use case.** New hero upload; LCP regression with stable HTML size.

**Action.** Weigh the painted URL. Prefer rehost/versioning over `/_vercel/image` on mutable
Storage.

### Critical requests and critical bytes

**Definition.** Requests and bytes needed to reach first meaningful paint / LCP. This is **not**
the count of unique URLs in the HTML (Renata 40, Romina 54), which includes lazy gallery, maps, and
unused srcset candidates.

**Why it matters.** Extra **critical** CSS/JS/fonts/hero compete with LCP. Extra lazy gallery URLs
usually do not.

**Measurement.** Not isolated reliably today. Baseline HTML inventory is a diagnostic. Speed
Insights does not replace a filmstrip.

**Enforcement.** Informational.

**Baseline.** Eager imgs in HTML: 3 on both Renata and Romina. Lazy: 8 vs 29.

**Interpretation.** Treating 54 Romina URLs as “54 critical requests” would mis-blame lazy gallery
and map tiles.

**Example.** An extra render-blocking CSS file in `<head>` is a critical-path issue; a 29th lazy
gallery thumb is not.

**Use case.** After adding global CSS/JS or preload/prefetch (preload changes are out of scope
unless a later goal justifies them).

**Action.** Distinguish head/eager/high-priority from `loading="lazy"`. Do not budget unique URL
count.

### RSVP reliability (runtime)

**Definition.** Submit success vs 4xx/5xx, time to confirmation, and whether the UI matches the
mutation.

**Why it matters.** Confirming attendance is the product outcome of the invitation.

**Measurement.** Vercel runtime logs and runtime errors for `/api/invitacion/**/rsvp`. No dedicated
in-repo RSVP success-rate dashboard or alert exists — do not claim one.

**Enforcement.** Runtime investigation. Functional contracts stay in Hard CI (above).

**Baseline.** None as a percentile. Use trends: a cluster of 5xx after a deploy is the trigger, not
one timeout.

**Interpretation.** Rising errors at constant traffic beats a 100 ms LCP win.

**Example.** RPC permission errors (`42501`) are a ship-blocker; a 50 ms slower hero is not.

**Use case.** Hosts report lost RSVPs; after RSVP API or RPC changes.

**Action.** Inspect logs and the atomic RPC tests. Do not add synthetic RSVP probes in CI.

### Provider consumption vs traffic

**Definition.** Vercel function invocations/CPU/transfer, Postgres reads/writes, Cloudinary
delivery, Supabase Storage bandwidth, Vercel image transforms — always compared with invitation
open and RSVP volume.

**Why it matters.** Absolute GB or invocation counts follow traffic. Disproportionate growth means
an efficiency bug (extra queries, transform amplification, duplicate downloads).

**Measurement.** Provider-native dashboards (Vercel Usage, Supabase, Cloudinary). Vercel MCP
`get_web_analytics` can count route pageviews for a traffic denominator. No in-repo replica of
those dashboards.

**Enforcement.** Runtime. No automated provider-billing alert is configured in this repository.

**Baseline.** Do not claim billed savings. Goal-era measurements recorded delivery bytes, not
invoices.

**Interpretation.** Traffic +20% and DB reads +80% → investigate resolver/RSVP amplification.
Traffic +20% and reads +20% → expected.

**Example.** Routing every Storage image through `/_vercel/image` would raise transform usage
without a matching guest-count increase — and would violate the freshness contract.

**Use case.** Monthly cost review; after a deploy that changes media or resolver behavior.

**Action.** Pair usage with analytics route volume. Fix the operation-count contract rather than
raising a silent budget.

## Monitoring map

There is **no** in-repository PagerDuty/Datadog/Grafana alert. “Trigger” means when a human should
investigate.

| Metric | Where | Trigger | Response |
| --- | --- | --- | --- |
| LCP, CLS, INP | Vercel Speed Insights | Sustained p75 worsening on invitation routes (days, not one sample) | Hero/path, layout, islands |
| TTFB | Speed Insights + `X-Render-Timing-Detail` | Sustained origin-time rise vs traffic | Query-count tests, personalization span |
| Document cache | Baseline script; deploy checks | Public TTL or document HIT | Restore origin-revalidate / no-store |
| RSVP API errors | Vercel runtime logs / errors | Cluster of 5xx or RPC failures after deploy | RPC, auth, rate limit |
| Usage vs traffic | Vercel / Supabase / Cloudinary dashboards | Consumption rising faster than opens/RSVPs | Operation contracts, media path |

Vercel Analytics (also production `Layout.astro`) is pageview telemetry, not a Web Vital. It can
help as a traffic denominator. Commercial GA4 is consent-gated and must not be required for these
operational metrics.

## CI contract

These may fail automated validation immediately:

- Anonymous HTML origin-revalidate helpers and `[slug].astro` source (no positive `s-maxage`, no
  SWR; `?invite=` forces `no-store, private`).
- Private-path `no-store` for dashboard/auth/captura (`private-cache-path`).
- `shouldOptimizeThroughVercelImage` false for mutable Storage; true for Cloudinary and hashed
  `/_astro`.
- Cloudinary public ID changes when `sha256` changes.
- Published resolver: one content read on hit; no extra invitation-row read.
- Personalization: empty invite = 0 lookups; miss = 1; hit = 1 context call + 1 view-track.
- RSVP: one lookup + one mutation RPC at the service layer; no duplicate in-flight client submit.
- Optional: `pnpm invitation:delivery:baseline --assert-budget` for HTML bytes + live cache
  headers + document not HIT.

These must **not** fail CI: TTFB, LCP, CLS, INP, page load time, hero bytes, unique HTML URL count,
provider invoices.

## Commands and code map

| Need | Command or path |
| --- | --- |
| Policy SSOT | `docs/domains/invitations/performance-metrics.md` |
| Cache correctness SSOT | `docs/domains/invitations/public-response-cache-policy.md` |
| Measure documents | `pnpm invitation:delivery:baseline` |
| Assert HTML budget | `pnpm invitation:delivery:baseline --assert-budget` |
| Hermetic contracts | `pnpm test -- tests/unit/delivery-contract.test.ts` (and related Jest files named above) |
| Budget constants | `src/lib/invitation/delivery-budget.ts` |
| Header/inventory helpers | `src/lib/invitation/delivery-contract.ts` |

Scratch JSON from the baseline script is written under `.tmp/observability/` and is gitignored. Do
not commit it.

## Out of scope

Do not add Grafana, Prometheus, Datadog, custom metric storage, Redis/KV telemetry, synthetic
monitoring farms, or a performance history database unless a confirmed operational gap appears that
Speed Insights, provider dashboards, logs, and these tests cannot cover.

Do not implement, as part of this model, Romina Cloudinary migration, font/Parisienne tuning, demo
prerender, map-tile cuts, gallery redesign, preload strategy, or image-quality retuning. Those need
evidence from the metrics above that the benefit justifies the work, and must preserve the cache
freshness contract.
