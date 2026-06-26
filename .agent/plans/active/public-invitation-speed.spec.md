---
title: Public Invitation Route — Speed Diagnosis & Correction Spec
status: active
plan_type: implementation
autonomy_level: 2
created: 2026-06-25
updated: 2026-06-25
supersedes: []
superseded_by: []
---

# Spec: Public Invitation Route Speed

> **Status:** Analysis complete — ready for implementation **Route:** `/[eventType]/[slug]` **Test
> URL:** `https://www.celebra-me.com/xv/xareni-iyarit`

---

## 1. Problem statement

Vercel Speed Insights reports **P75 mobile** metrics on `/[eventType]/[slug]`:

| Metric | Value   |
| ------ | ------- |
| FCP    | ~8.12 s |
| LCP    | ~8.7 s  |
| TTFB   | ~3.05 s |
| CLS    | Good    |

Home `/` is fast and not the target of this investigation. The public invitation route is the only
affected route.

The 5-second gap between TTFB (3.05 s) and FCP (8.12 s) suggests the total problem has two layers:
(1) HTML delivery speed (TTFB) and (2) rendering bottleneck (CSS/fonts/images).

**This is the highest-leverage hypothesis, not a confirmed root cause.** The current curl data shows
~300 ms TTFB on CDN HIT and ~600 ms on cache-busting server call — neither fully explains the 3.05 s
mobile P75. Mobile network latency, the bare-to-www redirect, edge distribution patterns,
cold-starts, and render-blocking assets may all contribute. The fixes in this spec target the
highest-leverage layer first, with instrumentation to measure each component.

---

## 2. Evidence

### 2.1 Confirmed from code

**Route (`src/pages/\[eventType\]/\[slug\].astro`):**

- SSR only: `export const prerender = false`
- On every cold request, `resolveInvitationContent` makes **at least one Supabase REST query**
  (`published_invitation_content` table via `findPublishedBySlugAndEventType`). If no published
  record exists, it makes a **second Supabase query** (`invitations` table via
  `findInvitationBySlug`) before falling back to static content collections (JSON files).
- If `?invite=` is present, a **third Supabase query** fires (`getInvitationContextByInviteId` in
  `route-personalization.ts`), plus a write (`trackInvitationView`).
- Cache-Control is set programmatically:
  ```js
  'public, max-age=0, s-maxage=60, stale-while-revalidate=300';
  ```
  (when no `?invite=` param and page/viewModel resolve successfully)
- Error path: `'no-store, private'`
- **No `X-Render-Timing` header is set anywhere.** Zero instrumentation exists for the public route.
- No ISR, no prerender, no Vercel Edge config for this route.

**Middleware (`src/middleware.ts`):**

- Auth middleware **short-circuits** for public routes: `shouldHandleAuth` returns `false` for
  `/[eventType]/[slug]`, so `return next()` is immediate.
- No `set-cookie`, no cookie reads on public routes — caching is NOT impeded by middleware.
- No cache-control or X-Render-Timing headers set by middleware for any route.

**Astro/Vercel config (`astro.config.mjs`):**

- `output: 'server'` — full SSR for every route
- `@astrojs/vercel` v10.0.8 with `maxDuration: 30`
- `webAnalytics: { enabled: true }` — this injects the Vercel Speed Insights client script into
  every SSR page
- `imageService: true` — Vercel image optimization enabled
- No `isr` property set — ISR is not configured

**vercel.json:**

- `/_astro/(.*)` static assets: `cache-control: public, max-age=31536000, immutable` ✓
- No per-route `Cache-Control` overrides for `/[eventType]/[slug]`
- Security headers (X-Content-Type-Options, etc.) applied broadly via pattern
  `/((?!dashboard/invitaciones/...)).*)`

**CSS loading (`src/layouts/Layout.astro`):**

- 9 font packages imported eagerly via `@fontsource` (all with `font-display: swap` in the package,
  but the CSS files are render-blocking)
- 3 Astro CSS imports: `global.scss` (global styles), the main `invitation.scss` (from route
  frontmatter), plus `headLinks` — 2 more CSS files per theme:
  - `/_astro/celestial-blue.CC3wHGS0.css` (preset)
  - `/_astro/celestial-blue.BegIfgBf.css` (section bundle)
- Plus `Layout.DjxAMGn1.css` — **4 render-blocking CSS files total** before any content is painted

**Data flow:**

1. `resolveInvitationContent(slug, eventType)` → Supabase:
   `published_invitation_content?slug=eq.{slug}&event_type=eq.{eventType}&...` (REST query via
   `supabaseRestRequest` with `useServiceRole: true`)
2. If not found, `findInvitationBySlug(slug, true)` → Supabase: `invitations?slug=eq.{slug}&...`
   (second REST query)
3. If still not found, `getRoutableEventEntry(slug, eventType)` → local JSON content collection
   (fast, no network)
4. Optional: `resolveRoutePersonalization` → Supabase: `getInvitationContextByInviteId` +
   `trackInvitationView`

### 2.2 Confirmed from measurements

All measurements below are from `www.celebra-me.com` (bare domain `celebra-me.com` issues a 307
redirect to www).

**Route headers (`/xv/xareni-iyarit`):**

```
HTTP/1.1 200 OK
Age: 109
Cache-Control: public, max-age=0
Content-Type: text/html
X-Vercel-Cache: STALE
```

- Production `Cache-Control` shows `public, max-age=0` **only** — `s-maxage=60` and
  `stale-while-revalidate=300` are NOT present in the downstream response. This is consistent with
  Vercel stripping CDN-only directives from the response header. Vercel CDN applies `s-maxage` and
  `stale-while-revalidate` internally.
- `X-Vercel-Cache: STALE` confirms Vercel CDN cached the response and is serving
  stale-with-revalidation.
- No `set-cookie` present.
- No `X-Render-Timing` header present.
- `Age: 109` — the edge cache age.

**Repeated TTFB (3 runs each, datacenter curl):**

| Route               | TTFB 1 | TTFB 2 | TTFB 3 | Status | Size     |
| ------------------- | ------ | ------ | ------ | ------ | -------- |
| `/xv/xareni-iyarit` | 286 ms | 299 ms | 299 ms | 200    | 77,532 B |
| `/`                 | 318 ms | 305 ms | 351 ms | 200    | 63,622 B |
| `/404`              | 317 ms | 327 ms | 280 ms | 404    | 11,651 B |
| `/login`            | 416 ms | 368 ms | 406 ms | 200    | 21,110 B |

**Cold-request TTFB (cache-busting param):**

```
https://www.celebra-me.com/xv/xareni-iyarit?<timestamp>
TTFB: 595 ms
```

This measures the real SSR + Supabase overhead on Vercel Lambda (non-cold-start but cache-bypassed):
**~600 ms** server time.

**HTML size:**

- Invitation page: **77,532 bytes** — large for mobile. The entire invitation content (family names,
  dates, venue, sections, quotes, gallery data, RSVP form, inline scoped styles, SVG filters, Google
  Analytics script) is SSR'd into a single HTML document.
- Home: 63,622 bytes
- 404: 11,651 bytes (static, prerendered)
- Login: 21,110 bytes (SSR, not cached)

### 2.3 Hypotheses

| #   | Hypothesis                                                                                                                                                                                          | Confidence | Evidence basis                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | **CDN cache TTL is too short** — `s-maxage=60` means the Lambda is re-invoked every 60s for every edge region. A publication that is viewed for hours gets hundreds of cold re-renders.             | **High**   | Code shows `s-maxage=60`. Production `X-Vercel-Cache` shows HIT/STALE — cache exists but expires rapidly.                                                             |
| H2  | **Browsers never cache the HTML** — `max-age=0` forces every navigation to revalidate. On mobile with poor connectivity, this adds 1-2 s per visit.                                                 | **High**   | Code confirms `max-age=0`. No browser cache short-circuit.                                                                                                            |
| H3  | **The bare-to-www 307 redirect adds a full round trip** — `celebra-me.com` → `www.celebra-me.com`. Speed Insights likely traces the bare URL, which means the 3.05s P75 TTFB includes the redirect. | **Medium** | Production curl shows 307 on bare domain. Vercel Speed Insights reports may trace the bare URL.                                                                       |
| H4  | **Cold Lambda starts inflate P75** — Vercel Serverless Functions on-demand have cold start overhead (~500 ms-2 s). The 60s TTL ensures every edge cache expiry forces a new cold start.             | **Medium** | `maxDuration: 30` is generous. Cold start from cache-busting param shows ~600 ms, which is tolerable alone.                                                           |
| H5  | **Supabase query latency adds server time** — Two sequential REST queries on cold path.                                                                                                             | **Medium** | Code confirms two queries (`published_invitation_content` + `invitations`). Total server time ~600 ms on cache-bypass, but Supabase REST queries add per-hop latency. |
| H6  | **Render-blocking CSS + 77KB HTML cause the TTFB→FCP gap** — After TTFB, ~5 s to first paint. 4 CSS files + 9 font families + large hero images.                                                    | **High**   | Production HTML confirms 4+ CSS `<link>` tags, 77KB body, multiple variable fonts.                                                                                    |
| H7  | **Vercel Speed Insights client script contributes to FCP delay** — The injected `script.js` and Google Analytics `gtag.js` compete for bandwidth on mobile.                                         | **Low**    | Both are `async`/`defer` but still consume bandwidth on constrained connections.                                                                                      |
| H8  | **Mobile network overhead** — DNS, TCP, TLS, and the bare-to-www redirect add multiple RTTs (300-1200 ms) that are invisible from datacenter curl.                                                  | **High**   | Latency physics: mobile 4G RTT 50-200 ms × 4-6 round trips = 200-1200 ms before a byte of HTML arrives.                                                               |

---

## 3. Root-cause assessment

### Is `/[eventType]/[slug]` SSR, prerendered, or hybrid?

**Full SSR.** `export const prerender = false`. There is no ISR, no `getStaticPaths`, no prerender.
Every request to a cold CDN edge invokes the Vercel Lambda.

### Does it hit Supabase per request?

**Yes.** On every cold SSR request:

1. `resolveInvitationContent` → **always** calls `findPublishedBySlugAndEventType` (Supabase REST
   query on `published_invitation_content`)
2. If not found → **also** calls `findInvitationBySlug` (Supabase REST query on `invitations`)
3. If `?invite=` present → **also** calls `getInvitationContextByInviteId` + `trackInvitationView`
   (read + write)

That's 1–3 Supabase API calls per cold render.

### Is HTML CDN-cacheable today?

**Yes, partially.** The code sets `s-maxage=60` and `stale-while-revalidate=300`. Vercel CDN applies
these internally; they are stripped from the downstream response to the client. Production
`X-Vercel-Cache: HIT/STALE` confirms edge caching occurs. The cache window (60s) is narrow for
content that doesn't change by the minute.

### Is cache only in-memory per lambda?

**No.** Vercel CDN caches at the edge (regional). The `X-Vercel-Cache: HIT/STALE` header confirms
edge-cached responses. This is not in-memory per Lambda instance.

### Are cookies/middleware making the route uncacheable?

**No.** The middleware short-circuits for public routes with no cookie reads, no `set-cookie`, and
no processing beyond calling `return next()`. The response has no `set-cookie` header.

### Is Fluid Compute likely to solve the root cause?

**Partially.** Fluid Compute (now called "Vercel Fluid" or serverless concurrency) reduces
cold-start overhead by keeping functions warm. However:

- Fluid does not address the **highest-leverage hypothesis**: the CDN cache TTL is too short for
  published content that doesn't change by the minute.
- Fluid does not address browser cache (`max-age=0`).
- Fluid does not address the FCP gap (CSS/fonts/images).
- The cache-busting measurement (~600 ms server time) suggests cold-start overhead alone is not the
  dominant component of 3.05 s P75 TTFB.

**Verdict:** Fluid might improve P75 TTFB by ~200-500 ms in cold scenarios but is not the
highest-leverage fix. Cache policy changes and instrumentation are the correct first step.

---

## 4. Correction strategy

Priority order (correct by evidence, not by assumption):

### Phase 1: Instrument — add `X-Render-Timing` headers

**Why first:** Without X-Render-Timing, any future optimization is blind. The route makes 1–3
Supabase queries with no timing data. Adding instrumentation costs near-zero overhead and provides
the data to decide whether Phase 3 is needed.

**Change:** Add `X-Render-Timing` metrics for these spans:

- `resolveInvitationContent` (total Supabase + adapter time)
- `getRoutableEventEntry` (content collection read, if used)
- `resolveRoutePersonalization` (invite context fetch, if used)
- `page-prepare` (page data assembly)
- `total` (full render span)

### Phase 2: Extend CDN + browser cache

**Why second:** Published invitations are append-only during their active lifespan (publish → event
date). There is no live-editing of published content. A conservative cache with longer TTL is safe
and impacts every uncached view.

**Cache policy by route/content type:**

| Route / Content type                       | Cache-Control header                                                                                                        | Rationale                                                                                                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Published invitation, no `?invite=`**    | `public, max-age=60, s-maxage=300, stale-while-revalidate=86400`                                                            | Public, cacheable. CDN fresh for 5 min; browser may serve from cache for 60s; stale CDN content may be served for up to 24h while revalidating in background.        |
| **Published invitation, with `?invite=`**  | `private, no-store, max-age=0`                                                                                              | Personalized content (guest name, RSVP state). Must never be cached by CDN or shared cache.                                                                          |
| **Demo public invitation**                 | `public, max-age=60, s-maxage=300, stale-while-revalidate=86400`                                                            | Demos are template previews with no PII. Same caching treatment as published. The `isDemo` flag does not affect cache policy — only the presence of `?invite=` does. |
| **Dashboard / editor / preview**           | Not set by this route — the dashboard Astro pages have their own response handling. The middleware enforces authentication. | Authenticated routes must not be CDN-cached. The `no-store, private` constraint is enforced by the dashboard route code.                                             |
| **Error / fallback (500 or render error)** | `no-store, private`                                                                                                         | Error pages must never be cached.                                                                                                                                    |
| **404**                                    | Not set by this route (prerendered). Vercel returns its own 404 handling.                                                   | Static 404 page. No cache changes needed.                                                                                                                            |

**Values explanation:**

- `max-age=60`: lets the browser serve from its own cache for 60 seconds. A user sharing a link on
  WhatsApp and tapping it 10 seconds after the first visitor gets instant load from the local disk
  cache, with only a revalidation request (304) to the network.
- `s-maxage=300`: Vercel CDN keeps the response fresh for 5 minutes. After 5 minutes the CDN may
  serve a stale copy while revalidating in the background (SWR).
- `stale-while-revalidate=86400`: allows the CDN to serve stale content for up to 24 hours if the
  origin is slow or unavailable, while a background Lambda revalidates.

### Phase 1 + 2 parallel diagnostic: TTFB→FCP gap

While Phases 1 and 2 address TTFB, add immediate measurement for the FCP gap (the ~5 s between TTFB
and first paint). Do not implement fixes yet — only measure.

**Measure on mobile (Chrome DevTools mobile emulation with 4G throttling, or Lighthouse mobile
report on a production `/xv/xareni-iyarit`):**

1. **LCP element**: What is the actual LCP element? (likely hero image or hero text)
2. **Hero image loading**: Is the mobile-optimized hero image (`backgroundImageMobile`) being
   prioritised with `fetchpriority="high"`? Is the desktop image being loaded on mobile via
   `<source media>`?
3. **Render-blocking CSS**: Count and total size of CSS files that block first paint. Current: 4
   files.
4. **Font CSS**: Which font files are requested before first paint? Are any font loads blocking the
   LCP element? Record URL, size, and `font-display` value for each.
5. **Hero image dimensions**: What is the actual mobile hero image URL and its file size/format?
6. **Envelope reveal**: Does the envelope animation delay the first paint of meaningful content?

**Expected output:** A table mapping each resource to its contribution to the TTFB→FCP gap, with
byte counts and load order.

### Phase 3: Optimize Supabase fetches (only if measured as material)

**Condition:** Only proceed if Phase 1 timing shows `resolveInvitationContent` exceeds 200ms
consistently on cache-miss requests.

**Potential changes:**

1. Add a **Supabase query cache** layer (in-memory LRU with 60s TTL) for
   `findPublishedBySlugAndEventType`. Since the same slug is unlikely to hit different Lambda
   instances within 60s, this is a project-wide optimization.
2. Remove the **redundant second query** (`findInvitationBySlug`): The published content already
   exists in `published_invitation_content`. The fallback to `invitations` table was a migration-era
   safety net. If the migration is complete, the fallback can be removed.
3. **Reduce query columns** — `SELECT_COLUMNS` in `published-invitation-content.repository.ts`
   fetches 9 columns. Not a material issue, but worth listing.

### Phase 4: CSS/font/image critical path (conditional on diagnostic)

**Condition:** Proceed after the Phase 2 diagnostic identifies the largest contributor to the
TTFB→FCP gap.

**Potential changes (prioritised by diagnostic):**

1. Add `<link rel="preload" as="image" fetchpriority="high">` for the mobile hero image.
2. Inline critical CSS for the envelope/hero above-the-fold into `<style>` in `<head>`.
3. Add `<link rel="preload" as="style">` for the active preset CSS bundle (not the section bundle —
   that can be deferred).
4. Lazy-load section-specific CSS only when sections scroll into view (via IntersectionObserver +
   dynamic link injection).
5. Evaluate whether 9 font families can be reduced or delayed per theme preset.
6. Reduce the 77 KB HTML by moving non-critical SSR data (gallery, RSVP form) into deferred
   JS-fetched fragments.

### Phase 5: Treat `/404` and `/login` separately

- **`/404`**: Already prerendered (`export const prerender = true`), TTFB ~300 ms, 11 KB. Not a
  problem.
- **`/login`**: SSR, `maxDuration: 30`, ~400 ms TTFB. Authenticated route — must not be CDN-cached.
  No issues with current setup.

---

## 5. Implementation plan — first batch (Phase 1 + 2)

### Phase 1: Add X-Render-Timing instrumentation

| Aspect                     | Detail                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Objective**              | Measure real server-side time splits for public invitation route                                                                                                                                                                                                                                                                                                              |
| **Files affected**         | `src/pages/[eventType]/[slug].astro`                                                                                                                                                                                                                                                                                                                                          |
| **Exact change**           | Wrap the async operations (`resolveInvitationContent`, `getRoutableEventEntry`, `resolveRoutePersonalization`, `prepareInvitationPageContext` / `buildPageContextFromViewModel`) with `performance.now()` measurements. At the end of frontmatter, before `---`, build a `X-Render-Timing` header string and set it via `Astro.response.headers.set('X-Render-Timing', ...)`. |
| **Risk**                   | Minimal. X-Render-Timing is a no-op for browsers that don't support it. No data leaks (only timing, no PII).                                                                                                                                                                                                                                                                  |
| **Validation**             | `curl -I https://www.celebra-me.com/xv/xareni-iyarit \| grep -i server-timing`                                                                                                                                                                                                                                                                                                |
| **Expected metric impact** | Zero on Speed Insights scores. Diagnostic only.                                                                                                                                                                                                                                                                                                                               |

### Phase 2: Extend CDN + browser cache

| Aspect                     | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Objective**              | Reduce repeat SSR invocations and allow browser caching                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Files affected**         | `src/pages/[eventType]/[slug].astro` — the `cacheControl` constant (one line)                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Exact change**           | Replace `'public, max-age=0, s-maxage=60, stale-while-revalidate=300'` with `'public, max-age=60, s-maxage=300, stale-while-revalidate=86400'`. The error/personalized paths (`no-store, private`) are unchanged.                                                                                                                                                                                                                                                                                |
| **Risk**                   | **Low for published invitations** — content doesn't change without explicit re-publish. The 5-minute `s-maxage` limits stale-origin time to 5 minutes worst case; 24-hour SWR only applies to stale CDN responses while revalidating, which affects sub-second stale-delivery vs. waiting for the origin. **No PII risk** because `?invite=` path still uses `no-store, private`.                                                                                                                |
| **Validation**             | 1. `pnpm build` passes<br>2. `pnpm test` passes<br>3. Preview deployment: `curl -I $PREVIEW_URL/xv/xareni-iyarit \| grep -i cache-control` — expect `public, max-age=60` (s-maxage and stale-while-revalidate may be stripped by Vercel; validate via `X-Vercel-Cache` and repeated TTFB instead)<br>4. Production: repeated curl on same URL within 60s shows `X-Vercel-Cache: HIT` with increasing `Age` values<br>5. Production: repeated curl shows no increase in TTFB (flat or decreasing) |
| **Expected metric impact** | TTFB P75: expected improvement from ~3.05 s → ~1.5-2.0 s. Repeat visits within 60s are instant from browser cache. CDN serves stale-with-revalidation after 5 min without blocking the response.                                                                                                                                                                                                                                                                                                 |

### Parallel diagnostic: TTFB→FCP gap measurement

| Aspect              | Detail                                                                                                                                                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Objective**       | Identify the largest contributors to the 5-second gap between TTFB and FCP on mobile                                                                                                                                                                                               |
| **Method**          | 1. Open the production invitation URL in Chrome DevTools with mobile emulation and 4G throttling. 2. Record the Performance trace. 3. Extract: LCP element, render-blocking CSS count/size, font file count/size, hero image URL/size/format/preload status, layout shift sources. |
| **Expected output** | A short document (or additions to this spec's "Evidence" section) mapping each resource to its contribution to the TTFB→FCP gap. This will inform Phase 4 priorities.                                                                                                              |
| **Risk**            | None (measurement only).                                                                                                                                                                                                                                                           |
| **Time**            | ~30 minutes of manual testing.                                                                                                                                                                                                                                                     |

---

## 6. Refactor decision

```md
Is a refactor needed?

- No

Reason: The highest-leverage hypothesis is a cache-configuration issue, not an architectural flaw.
The SSR pipeline is clean (middleware doesn't interfere, data fetching is straightforward, no
excessive serialization or blocking). The CDN is already caching; the TTL is just too short. The
full stack (Astro SSR → Vercel CDN → Supabase → Content Collections) is sound for the intended
workload.

The TTFB→FCP gap is real and material (~5s) but is a separate concern from the SSR/cache layer. The
parallel diagnostic will determine whether CSS, fonts, images, or JS are the dominant component. No
refactor of the Astro page structure is required for either layer.

Minimum viable change (first batch):

1. Add X-Render-Timing instrumentation (~15 lines added to one file)
2. Change one line: the cacheControl string
3. Deploy
4. Measure with the parallel diagnostic

Changes to avoid:

- Do not switch to ISR/Incremental Static Regeneration yet. The simpler cache-header fix achieves
  the same effect without changing the render model.
- Do not convert the route to getStaticPaths() prerender — published invitations are dynamic per
  slug and region, and prerender would require build-time data fetching from Supabase
  (anti-pattern).
- Do not add a Redis/Memcached/DynamoDB cache layer. Vercel CDN + s-maxage is the correct cache
  layer for this use case.
- Do not reduce the number of font families or remove layout components — those are product
  features, not performance bugs.
- Do not refactor the envelope reveal or Hero components.
```

---

## 7. Acceptance criteria

### Implementation status (pre-existing)

- [x] `pnpm build` passes — verified
- [x] `pnpm test` passes — 209/209 suites, 2747/2749 tests — verified
- [ ] `pnpm lint` — **BLOCKED by 2 pre-existing ESLint errors** in
      `.agent/tmp/preview-vercel-curl-validation.mjs` and `.agent/tmp/route-qa.cjs` (temporary agent
      files). These errors (`no-console` and `no-undef`) are unrelated to the spec changes. The spec
      is a `.md` file and is not scanned by ESLint. Fixing the tmp files is outside the spec scope
      unless the project convention excludes `.agent/tmp/` from lint.

### Phase 1 (X-Render-Timing) acceptance

- [ ] Preview deployment shows `X-Render-Timing` header on `/[eventType]/[slug]`:
  ```
  curl -I $PREVIEW_URL/xv/xareni-iyarit | grep -i server-timing
  ```
- [ ] `X-Render-Timing` contains at least these metric names: `resolveContent`,
      `routePersonalization`, `pagePrepare`, `total`
- [ ] No `X-Render-Timing` data leaks PII (only timing numbers, no URLs or invite IDs)

### Phase 2 (Cache-Control) acceptance

**Cache header content** (what's visible downstream):

- [ ] Published invitation, no `?invite=`: `Cache-Control: public, max-age=60` is visible in the
      response. `s-maxage` and `stale-while-revalidate` may be stripped by Vercel — **not required**
      in the visible header.
- [ ] Published invitation, with `?invite=`: `Cache-Control: no-store, private` or `private` — no
      caching.
- [ ] Error / render-failure path: `Cache-Control: no-store, private` — never cached.

**Vercel CDN behavior:**

- [ ] `X-Vercel-Cache: HIT` observed after first request within the cache window
- [ ] Repeated TTFB (3 quick requests) stays flat or decreases — no increase
- [ ] After 5+ minutes, `X-Vercel-Cache` may return `STALE` while revalidating fails to HIT —
      acceptable

**Safety:**

- [ ] Dashboard routes (`/dashboard/*`), `/login`, and `/api/*` are **not** affected — their cache
      behavior is unchanged
- [ ] Adding `?invite=` to any URL produces `Cache-Control: no-store, private` — guest data is never
      cached

### Staleness policy

- [ ] If a host publishes an updated invitation, the update is reflected within `s-maxage=300`
      seconds (5 minutes) at most on the CDN edge
- [ ] The `stale-while-revalidate=86400` allows background revalidation without blocking the
      response for stale-content requests

### What to measure after deployment

| Metric                            | Current (approx) | Target (Phase 2)                        |
| --------------------------------- | ---------------- | --------------------------------------- |
| TTFB (curl, repeated, HIT)        | 286-351 ms       | Same or lower                           |
| TTFB (curl, cold/cache-bust)      | 595 ms           | Same                                    |
| P75 TTFB (Speed Insights, mobile) | 3.05 s           | < 1.5 s                                 |
| P75 FCP (Speed Insights, mobile)  | 8.12 s           | Evaluate after TTFB improves            |
| Vercel CDN HIT rate               | Unknown          | > 80 % on repeated requests to same URL |

---

## Summary

```md
Primary suspected cause (highest-leverage hypothesis): The CDN cache TTL (s-maxage=60) is too short
for published invitations that don't change by the minute. Combined with max-age=0 (no browser
cache), every mobile visit after 60s of inactivity incurs a full SSR request with 1–3 Supabase
queries. The 3.05s P75 TTFB arises from a combination of: cache expiry forcing re-invocation, mobile
network RTT, the bare-to-www redirect, cold-start overhead, and the 77KB HTML payload. This spec
targets cache policy as the highest-leverage component.

Should implementation proceed? Yes. Phase 1 and 2 are small, low-risk, and directly address the
highest-leverage hypothesis.

Spec path: .agent/plans/active/public-invitation-speed.spec.md
```
