---
title: Consent, GA4, GTM, and Meta Pixel Implementation Plan
status: draft
type: documentation
created: 2026-06-28
updated: 2026-06-28
autonomy: 'Level 1 - Documentation changes only'
related_skills:
  - backend-engineering
  - astro-patterns
related_docs:
  - .agent/plans/active/commercial-analytics-attribution-dashboard.spec.md
  - docs/core/architecture.md
  - docs/core/project-conventions.md
  - src/lib/tracking/route-policy.ts
  - src/lib/tracking/client.ts
  - src/lib/tracking/consent-policy.ts
---

# Consent, GA4, GTM, and Meta Pixel Implementation Plan

## 1. Problem statement

The Commercial Analytics Attribution MVP established a first-party tracking system as the source of
truth: route policy, internal exclusion, `visitor_sessions`, `tracking_events`, `leads`, a contact
API with lead creation, and a commercial dashboard. What remains unimplemented is the **consent
layer** and the **third-party analytics/marketing dispatch** layer.

Specifically:

- `getConsentSnapshot()` in `client.ts` is a hardcoded stub
  (`{necessary:true, analytics:true, marketing:false}`). No consent UI, no user choice, no
  persistence.
- GA4 is loaded via `Layout.astro` using `shouldLoadGoogleAnalytics()` (route-gated,
  production-gated), but no custom events are forwarded from the first-party event system.
  `gtag('config')` sends a default `page_view` without route classification or consent check.
- GTM is absent and its necessity is undecided.
- Meta Pixel is absent.
- `/privacidad` and `/terminos` do not describe consent categories, GA4, Meta Pixel, remarketing, or
  third-party data processing.
- The commercial dashboard has no tracking-quality metrics (consent distribution, blocked event
  counts, third-party dispatch status).
- No CAPI or `Purchase` semantics exist, and they must remain future-only.

Without these layers, the system cannot legally deploy GA4 or Meta Pixel for ad optimisation, cannot
respect user consent choices, and cannot validate that third-party events match the first-party
contract.

## 2. Current implemented state

### 2.1 First-party tracking (MVP — complete)

| Component                                | Status        | Notes                                                                                               |
| ---------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| `route-policy.ts`                        | ✅ Complete   | Classifies 8 route classes with `internalAllowed`, `gaAllowed`, `metaAllowed` flags                 |
| `internal-exclusion.ts`                  | ✅ Complete   | Excludes dashboard users, opt-out cookie, non-production, excluded routes                           |
| `consent-policy.ts`                      | ✅ Complete   | `normalizeConsentSnapshot()` normalises `{necessary: true, analytics: boolean, marketing: boolean}` |
| `event-contract.ts`                      | ✅ Complete   | Zod schema, safe-property allowlist, PII detection, sanitisation                                    |
| `ingestion.service.ts`                   | ✅ Complete   | Validates route policy → PII safety → internal exclusion → persist                                  |
| `repository.ts`                          | ✅ Complete   | Supabase REST upsert for sessions, insert for events                                                |
| `lead.service.ts` / `lead.repository.ts` | ✅ Complete   | Contact form → lead upsert                                                                          |
| `lead-code.ts`                           | ✅ Complete   | `CM-XXXXXX` generation                                                                              |
| `client.ts`                              | ✅ Complete\* | Browser tracking — but `getConsentSnapshot()` is a stub                                             |
| `api/tracking/events.ts`                 | ✅ Complete   | Rate-limited (120/min) POST endpoint                                                                |
| `api/contact.ts`                         | ✅ Complete   | Validates, creates lead, sends email                                                                |
| Migration `20260628...`                  | ✅ Complete   | `visitor_sessions`, `tracking_events`, `leads` with RLS                                             |

### 2.2 GA4 and analytics (partial)

| Component                   | Status                     | Notes                                                                |
| --------------------------- | -------------------------- | -------------------------------------------------------------------- |
| `Layout.astro` GA injection | ✅ Route-gated             | Uses `shouldLoadGoogleAnalytics()` → production-only, route-gated    |
| `DashboardLayout.astro` GA  | ✅ Removed                 | No GA injection. Dashboard uses only commercial first-party tracking |
| `GoogleAnalytics.astro`     | ⚠️ Sends default page_view | `gtag('config', id)` fires immediately without consent check         |
| Custom GA4 events           | ❌ Missing                 | No `gtag('event', ...)` calls from any component                     |
| GA4 consent signal          | ❌ Missing                 | No `gtag('consent', 'update', ...)` integration                      |
| `shouldLoadGoogleAnalytics` | ✅ Route-gated             | Checks `gaAllowed` from route policy + production + ID present       |

### 2.3 Consent (missing)

| Component           | Status     | Notes                                                                       |
| ------------------- | ---------- | --------------------------------------------------------------------------- |
| Consent UI          | ❌ Missing | No banner, modal, or preference UI                                          |
| Consent persistence | ❌ Missing | `getConsentSnapshot()` returns hardcoded values                             |
| Consent withdrawal  | ❌ Missing | No mechanism to change choice                                               |
| Marketing consent   | ❌ Missing | `consentMarketing` field exists in contact form but no runtime consent gate |

### 2.4 GTM (missing)

| Component         | Status                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------- |
| GTM container     | ❌ Not present                                                                            |
| `dataLayer` usage | 🟡 Present but controlled — client.ts already pushes to `dataLayer` via `pushDataLayer()` |
| GTM decision      | ❌ Undecided                                                                              |

### 2.5 Meta Pixel (missing)

| Component         | Status         |
| ----------------- | -------------- |
| Meta Pixel script | ❌ Not present |
| Meta events       | ❌ Not sent    |
| Meta env vars     | ❌ Not defined |

### 2.6 Legal pages (outdated)

| Page          | Status                                                  | Missing                                                                         |
| ------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `/privacidad` | ⚠️ Covers basic data collection, ARCO rights, retention | No consent categories, GA4, Meta Pixel, remarketing, third-party platforms list |
| `/terminos`   | ⚠️ General terms                                        | No analytics/marketing consent sections                                         |

### 2.7 Dashboard

| Feature                  | Status                                                             |
| ------------------------ | ------------------------------------------------------------------ |
| Commercial dashboard MVP | ✅ Sessions, CTA, WhatsApp, forms, demos, leads, scroll, sections  |
| Tracking quality         | ❌ Missing (consent distribution, blocked events, dispatch status) |

### 2.8 Tests

| Test file                                         | Status                                 |
| ------------------------------------------------- | -------------------------------------- |
| `tests/unit/tracking-route-policy.test.ts`        | ✅ Comprehensive                       |
| `tests/unit/tracking-policy.test.ts`              | ✅ Covers exclusion, consent, contract |
| `tests/unit/tracking-ingestion.service.test.ts`   | ✅ Covers ingestion pipeline           |
| `tests/unit/tracking-lead.service.test.ts`        | ✅ (exists, not inspected)             |
| `tests/unit/commercial-dashboard.service.test.ts` | ✅ (exists, not inspected)             |
| `tests/unit/tracking-events-api.test.ts`          | ✅ (exists, not inspected)             |

## 3. Goals

1. Implement consent model, UI, and persistence so the site legally deploys GA4 and Meta Pixel.
2. Forward approved first-party events to GA4 as PII-safe custom events with consent gating.
3. Decide on GTM necessity and either add readiness or activate.
4. Activate Meta Pixel for `PageView`, `ViewContent`, `Contact` with marketing consent. `Lead` is
   reserved for a future server-side phase.
5. Update `/privacidad` with consent categories, GA4, Pixel, remarketing, and third-party
   disclosures.
6. Add tracking-quality metrics to the commercial dashboard.
7. Reserve CAPI and `Purchase` for a future payment-model phase.
8. Keep every phase buildable, deployable, and incrementally verifiable.

## 4. Non-goals

- Do not implement a full CMP (Consent Management Platform) such as Cookiebot, OneTrust, or Osano.
- Do not implement CAPI server-side conversion delivery in this phase set.
- Do not implement `Purchase`, `InitiateCheckout`, `AddPaymentInfo`, or `AddToCart`.
- Do not implement GTM server-side.
- Do not send guest RSVP data, invitation guest identity, or raw customer PII to any third party.
- Do not create an analytics warehouse, heatmap recorder, or session replay.
- Do not alter the existing first-party event contract or migration schema.

## 5. Constraints

- Visible UI copy must be in Spanish. Code, identifiers, types, and technical comments in English.
- Preserve Astro server/client boundaries. Client-side consent scripts must not import server-only
  modules.
- Use SCSS for maintained styling; do not introduce Tailwind.
- Public env vars must be browser-safe. Server-only tokens must never use `PUBLIC_`.
- Vercel Preview, local development, dashboard/auth/admin/API routes, real invitations, and RSVP
  routes must not emit production marketing events.
- `production_authorized` means operational client commitment, not payment.
- `payment_received` is the only future basis for Meta `Purchase`.
- WhatsApp click = intent, not confirmed lead.
- Contact form success / manual reconciliation = confirmed lead.
- RSVP/guest activity remains separate from commercial lead tracking.
- First-party tracking = source of truth. GA4 = behavioral analytics. Meta Pixel = ad optimisation
  only.
- GTM must not bypass app route policy or consent policy.
- The system must remain buildable after every phase.

## 6. Owner/manual decisions required

### Before implementation

1. **Consent UI style**: choose between (a) compact banner with accept/reject/configure versus (b)
   banner + separate preferences modal. (See Section 8 for recommendation.)
2. **GA4 direct vs GTM**: confirm whether GA4 should be loaded directly (recommended) or through
   GTM. (See Section 11 for analysis.)
3. **GTM timing**: confirm whether GTM should be activated now or only prepared (dataLayer
   compatibility without container). (Recommended: prepare only, activate later if needed.)
4. **Demo pages for Meta remarketing**: confirm whether demo pages can be included in Meta Pixel
   audiences. (Recommended: yes, with marketing consent.)
5. **Vercel Web Analytics**: confirm whether Vercel Web Analytics remains enabled as platform-level
   analytics. (Recommendation: keep enabled; it has separate privacy implications.)
6. **Cookie banner positioning**: confirm whether the banner should appear on demo pages.
   (Recommended: yes, if GA4/Pixel are active on those routes.)

### During/after implementation

7. Create/confirm GA4 Measurement ID (e.g. `G-XXXXXXXXXX`).
8. Create/confirm Meta Pixel ID.
9. Create/confirm GTM Container ID **only if** GTM activation is chosen.
10. Configure Vercel env vars for all new IDs.
11. Review and approve legal/privacy/cookie copy in Spanish before publishing.
12. Validate GA4 DebugView (`gtag('config', { debug_mode: true })`) during implementation.
13. Validate Meta Events Manager / Test Events during implementation.
14. Test consent accept/reject/configure flows across all browsers.
15. Verify no tracking scripts fire on excluded routes (real invitations, dashboard, RSVP, local,
    preview).

## 7. Consent model

### 7.1 Categories

```
necessary → Always enabled. CSRF, session, and operational cookies.
analytics → Gates GA4 loading and GA4 event forwarding.
marketing → Gates Meta Pixel loading, Meta events, and any GTM marketing tags.
```

### 7.2 Rules

- `necessary` is always enabled and cannot be disabled via the UI.
- `analytics` consent gates: GA4 script loading, `gtag('config')`, `gtag('event')` calls.
- `marketing` consent gates: Meta Pixel script loading, `fbq('init')`, `fbq('track')` calls, GTM
  marketing tags.
- Consent is evaluated on the **client** before browser events are sent to third parties.
- Internal traffic exclusion is evaluated **before** consent-based gating to avoid recording
  owner/team activity at all.
- Consent state is stored in `localStorage` as a minimal JSON record:
  `{necessary:true, analytics:boolean, marketing:boolean, updatedAt:ISO-string}`.
- No PII in the consent record. No server-side consent table — the consent snapshot is recorded per
  event/session in the existing `consent_snapshot` JSONB column.
- A future UI must allow withdrawal of `analytics` and `marketing` consent at any time.

### 7.3 Default state

Before the user interacts with the consent UI:

- `necessary = true`
- `analytics = false`
- `marketing = false`

This means no GA4 and no Meta Pixel fire until the user accepts or configures. The only exception is
the existing first-party tracking, which operates on commercial/demo routes and is covered under
legitimate interest / necessary operation.

### 7.4 Storage shape (localStorage key: `cm_consent`)

```json
{
  "necessary": true,
  "analytics": false,
  "marketing": false,
  "updatedAt": "2026-06-28T12:00:00.000Z"
}
```

## 8. Consent UI strategy

### Recommendation: Compact banner with accept/reject/configure

**Rationale**: A single-tier banner avoids the complexity and maintenance of a multi-modal CMP while
remaining professional, privacy-compliant, and simple to implement. The banner slides in from the
bottom on commercial and demo routes only.

**Two interaction patterns**:

1. **Accept All** → sets `analytics=true, marketing=true`.
2. **Reject Optional** → sets `analytics=false, marketing=false` (keeps `necessary`).
3. **Configure** → expands inline or opens a lightweight `ConsentPreferences` modal where the user
   can toggle `analytics` and `marketing` independently.

### UI requirements

- Banner copy in Spanish. Visible on commercial (`/`, `/privacidad`, `/terminos`) and demo
  (`/xv/demo-*`, etc.) routes only.
- Not shown on dashboard, real invitations, RSVP, or API routes.
- Banner respects route policy and internal exclusion before rendering.
- Once the user has made a choice, the banner disappears and never re-appears on that browser unless
  consent is reset (e.g. via a "Configurar cookies" link in the footer).
- A "Configurar cookies" link in the footer re-opens the preferences modal on any commercial/demo
  page.
- The banner and modal are Astro client islands (React) for state management, or plain vanilla JS in
  an inline `<script>` for zero-dependency simplicity.

### Files likely affected

- `src/components/common/ConsentBanner.astro` (new)
- `src/components/common/ConsentBanner.tsx` (new, React island if chosen)
- `src/lib/tracking/consent-client.ts` (new) — client-side consent read/write/observe
- `src/layouts/Layout.astro` — load consent banner in `<body>`
- `src/components/home/Footer.astro` — add "Configurar cookies" link

### Acceptance criteria

- Banner appears exactly once per visitor on commercial routes.
- Accept All sets both `analytics` and `marketing` to `true`.
- Reject Optional sets both to `false`.
- Configure allows independent toggles.
- Footer link re-opens the preferences modal.
- No banner on dashboard, real invitations, RSVP, API routes.
- Banner respects internal exclusion.

### Tests/validation

- Unit test: consent read/write/parse from localStorage.
- Unit test: default state is `{necessary:true, analytics:false, marketing:false}`.
- E2E: banner appears on `/`, accept all → GA fires on next navigation.
- E2E: banner appears on `/xv/demo-xv-editorial`.
- E2E: banner does not appear on `/dashboard/commercial`.
- E2E: after rejecting, no GA/gtag scripts on page.

### Rollback

- Revert the consent banner component from `Layout.astro`.
- Remove `ConsentBanner` component files.
- Revert footer link changes.

## 9. Legal/privacy/cookie copy plan

### 9.1 Recommendation: expand `/privacidad` with a dedicated Cookies section

Do **not** create a separate `/cookies` page. Expand Section 5 (Cookies) of `/privacidad` and add a
broader "Tecnologías de publicidad y analítica" section. This keeps legal copy consolidated and
avoids maintenance burden.

### 9.2 Required updates to `/privacidad`

- **Section 5 — Cookies**: replace the generic cookie paragraph with:
  - Definition of consent categories (necessary, analytics, marketing).
  - List of cookies/technologies per category.
  - Consent withdrawal mechanism ("puede retirar su consentimiento en cualquier momento mediante el
    enlace 'Configurar cookies' en el pie de página o ajustando la configuración de su navegador").
  - Analytics cookies: GA4, page views, custom events, anonymised IP.
  - Marketing cookies: Meta Pixel, remarketing audiences, ad personalisation.
  - Third-party platforms: Google (GA4), Meta (Pixel), Vercel (hosting, Web Analytics), Supabase
    (database), email provider (Nodemailer/Gmail), future payment provider.
  - Retention periods: analytics events (26 months), marketing audiences (180 days), contact/lead
    data (duration of commercial relationship + 2 years).
  - Separation between customer/lead data (stored in `leads` table) and guest/RSVP data (stored
    separately in invitation-related tables). Clarify that guest data is never used for marketing.
  - Manual payment/approval/delivery workflow (no online checkout).

- **Section 6 — ARCO rights**: expand to include:
  - Right to withdraw consent for analytics and marketing.
  - Right to data portability for customer and lead data.
  - Contact process: use contact form or WhatsApp.

- **Section 9 — Contact**: add an analytics/consent-specific contact reference.

### 9.3 Required updates to `/terminos`

- No major changes required for analytics/Meta purposes. The terms cover general service use,
  payments, and IP. Add a brief note in Section 1 or a new section referencing the privacy policy
  for analytics and marketing consent practices.

### 9.4 Legal wording ownership

**All legal copy in Sections 9.2 and 9.3 is marked `[REQUIRES OWNER/LEGAL REVIEW]`.** No final legal
copy is drafted in this planning pass.

## 10. GA4 strategy

### 10.1 Architecture

GA4 is now loaded dynamically on the client after analytics consent. The existing
`GoogleAnalytics.astro` server-side component was removed from `Layout.astro`. GA4 loading, consent
gating, and event forwarding are handled by the client-side `ga4-forwarder.ts` module.

1. **No consent signal** before `gtag('config')`.
2. **No custom events** forwarded from first-party tracking to GA4.

### 10.2 Changes needed

#### 10.2.1 Consent gating for GA4 script loading

Modify `shouldLoadGoogleAnalytics()` (or a new `shouldLoadGA4()`) to require:

- Production environment → ✅ already done
- Route policy `gaAllowed` → ✅ already done
- `PUBLIC_GOOGLE_ANALYTICS_ID` (or future `PUBLIC_GA_MEASUREMENT_ID`) present → ✅ already done
- **Analytics consent granted** → 🆕 NEW

GA4 uses **Basic Consent Mode**: GA4 is never loaded or initialized before `analytics=true`. The
`gtag.js` script is injected dynamically **only after** the user grants analytics consent. There is
no pre-consent `gtag('consent', 'default', ...)` — consent is a hard gate on whether the script
loads at all.

- When the page loads, GA4 is **not** loaded even when route policy + production + ID are satisfied.
- After the consent banner produces `analytics=true`, the app dynamically loads the GA4 script and
  calls `gtag('config')`.
- If `analytics=false` (default), GA4 never loads on that page. On consent change, if the user
  navigates to a new page, the new page evaluates consent again.
- The existing `shouldLoadGoogleAnalytics()` check in `Layout.astro` is replaced: no server-side GA
  loading. The route policy, production, and ID checks move into the client-side GA4 loader.
- First-party tracking (our source of truth) loads independently of consent.

#### 10.2.2 GA4 event forwarding service

Create a new client-side module `src/lib/tracking/ga4-forwarder.ts` that:

1. Listens to the first-party tracking events (via the existing `dataLayer` push or a custom event
   bus).
2. Checks analytics consent before forwarding.
3. Maps events according to the table below.
4. Calls `gtag('event', ...)` with PII-safe parameters.
5. Does nothing on non-production, excluded routes, or without consent.

#### 10.2.3 GA4 event mapping

| First-party event          | GA4 event name  | Parameters                                   | Notes                                                                     |
| -------------------------- | --------------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| `page_viewed`              | `page_view`     | `route_class`, `page_type`                   | Suppress the default gtag `page_view`; send intentional one after consent |
| `section_seen`             | `section_view`  | `section_id`, `page_type`                    | Bucketed via IntersectionObserver                                         |
| `scroll_depth_reached`     | `scroll`        | `depth_bucket`, `page_type`                  | Fires once per bucket (25, 50, 75, 90, 100)                               |
| `cta_clicked`              | `cta_click`     | `cta_id`, `cta_location`, `destination_type` | From `data-track-*` attributes                                            |
| `package_viewed`           | `view_item`     | `package_id`, `package_tier`                 | Tier name, not price                                                      |
| `demo_viewed`              | `view_item`     | `demo_slug`, `event_type`, `is_demo=true`    |                                                                           |
| `whatsapp_contact_clicked` | `contact`       | `lead_channel=whatsapp`, `cta_id`            |                                                                           |
| `form_started`             | `form_start`    | `form_id`                                    |                                                                           |
| `form_submitted`           | `form_submit`   | `form_id`, `success=true`                    |                                                                           |
| `lead_created`             | `generate_lead` | `lead_channel`, `lead_source`                | Via server-side GA4 measurement protocol in future phase                  |

#### 10.2.4 PII safety

- No names, emails, phones, raw message text, invite IDs, claim codes, tokens, or guest names.
- Parameters are limited to: `route_class`, `page_type`, `section_id`, `visibility_bucket`,
  `depth_bucket`, `cta_id`, `cta_location`, `destination_type`, `package_id`, `demo_slug`,
  `event_type`, `is_demo`, `form_id`, `success`, `lead_channel`, `lead_source`.
- Use the existing `sanitizeEventProperties()` for the forwarder's parameter shape.

#### 10.2.5 Duplicate page_view prevention

- Do NOT send `gtag('config')` with `send_page_view: true` (default behaviour). Set
  `send_page_view: false` in the config command.
- Send a deliberate `page_view` event only after consent check and route policy check.

#### 10.2.6 GA4 DebugView validation

- During implementation, load GA4 in debug mode: `gtag('config', id, { debug_mode: true })` when
  `import.meta.env.DEV` or a query param `?ga_debug=1` is present.
- Validate that all mapped events appear correctly in GA4 DebugView.
- Validate that no PII appears in GA4 event parameters.

### 10.3 Files likely affected

- `src/lib/tracking/ga4-forwarder.ts` (new)
- `src/lib/tracking/client.ts` — integrate forwarder into `initCommercialTracking()`
- `src/components/common/GoogleAnalytics.astro` — add consent mode defaults, suppress default
  page_view
- `src/layouts/Layout.astro` — no change needed (already route-gated)
- `src/lib/tracking/route-policy.ts` — no change (already has `gaAllowed`)

### 10.4 Acceptance criteria

- GA4 loads only in production, on commercial/demo routes, with analytics consent, and with an ID
  present.
- `page_view` is sent once per page load after consent.
- All mapped events appear in GA4 DebugView.
- No PII appears in GA4 event parameters.
- GA4 does not load on dashboard, real invitations, RSVP, API, local, or preview.
- Suppress default `page_view` from `gtag('config')`.

### 10.5 Tests/validation

- Unit test: `ga4-forwarder.ts` event mapping.
- Unit test: forwarder skips when consent is absent.
- E2E: GA4 network request (`/g/collect`) appears only after accept all.
- E2E: GA4 does not send custom events after reject optional.
- Manual: GA4 DebugView shows all mapped events with correct parameters.

### 10.6 Rollback

- Remove `ga4-forwarder.ts`.
- Restore `GoogleAnalytics.astro` to current state (remove consent mode changes).
- Revert `client.ts` changes.

## 11. GTM decision analysis

### 11.1 Options compared

| Criterion                                 | A: Direct GA4 + direct Meta                                                                                            | B: GTM loads GA4/Meta via controlled dataLayer                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Simplicity**                            | ✅ Simpler. No extra container, no extra network request, no extra failure point.                                      | ❌ Adds container load, dataLayer management, and GTM interface maintenance.                                           |
| **Debugging**                             | ✅ GA4 DebugView + Meta Events Manager provide direct debugging. One less layer.                                       | ❌ Adds GTM Preview mode as an extra debugging step.                                                                   |
| **Consent enforcement**                   | ✅ Same pattern as first-party: consent check before `gtag()` or `fbq()`.                                              | ⚠️ GTM can enforce consent via its own consent overview, but this duplicates app-level consent logic and can drift.    |
| **Risk of bypassing route policy**        | ✅ Route policy is hard-coded in the app.                                                                              | ❌ GTM could theoretically fire tags on routes the app excluded, unless the app controls which routes load GTM at all. |
| **Future maintainability**                | ⚠️ Tag changes require a deploy.                                                                                       | ✅ Tag changes through GTM web UI, no deploy needed.                                                                   |
| **Ability to adjust tags without deploy** | ❌ Requires code change + deploy.                                                                                      | ✅ GTM allows tag configuration changes without code deploy.                                                           |
| **Current codebase readiness**            | ✅ `dataLayer` already exists and `pushDataLayer()` already pushes to it. Direct GA4/Pixel can use the same event bus. | ✅ `dataLayer` already exists. GTM consumes the same pushes.                                                           |
| **Need for non-engineer tag management**  | ❌ Only engineers can change tags.                                                                                     | ✅ Non-engineers (marketing) with GTM access can adjust tags.                                                          |

### 11.2 Recommendation: Direct GA4 + Direct Meta Pixel (no GTM)

**Rationale**: Celebra-me is a single-owner/team project. There is no marketing team that needs
non-deploy tag management. The route policy, consent enforcement, and PII safety are already coded
in the application layer. Adding GTM:

1. Introduces a second tag-loading system that can bypass app-level gating if not carefully
   constrained.
2. Adds an extra network request and JavaScript evaluation (GTM container ~60KB gzipped).
3. Requires the owner to learn and maintain a GTM workspace.
4. Provides no benefit over direct `gtag()` and `fbq()` calls for the current scale.

**Mitigation**: The `dataLayer` is already present and `pushDataLayer()` in `client.ts` already
pushes to it. If GTM is later desired, the app can load a `PUBLIC_GTM_ID` container without code
changes to the event mapping — the events already flow through `dataLayer`.

### 11.3 GTM readiness (documentation only)

GTM is **not implemented or activated** in this pass. The existing `dataLayer` compatibility in
`client.ts` (`pushDataLayer()`) already provides a future-ready event bus. If GTM is later needed:

- The app would load a `PUBLIC_GTM_ID` container only in production, on commercial/demo routes, with
  analytics consent.
- Route-gate through `shouldLoadGoogleAnalytics()` pattern.
- Never load GTM on dashboard, real invitations, RSVP, API, local, or preview.
- GTM tags must not contain PII or bypass app route policy.
- The app's `dataLayer` must only push events that have passed route policy, internal exclusion, and
  consent checks — GTM only forwards what the app already approved.

### 11.4 Files likely affected (if GTM were activated)

- `src/components/common/GoogleTagManager.astro` (new)
- `src/layouts/Layout.astro` — add GTM script
- `.env.example` — add `PUBLIC_GTM_ID`
- `src/env.d.ts` — add `PUBLIC_GTM_ID`

## 12. Meta Pixel strategy

### 12.1 Architecture

Meta Pixel is loaded purely as an ad-optimisation tool. It fires only:

- In production.
- On commercial and demo routes (`metaAllowed == true` in route policy).
- After marketing consent is explicitly granted — `marketing=true` is a hard gate.
- With internal exclusion checked before dispatch.
- With no RSVP/guest data, no real invitation tracking, no dashboard events, no preview/local
  events.

The Pixel script (`fbevents.js`) is never loaded before marketing consent. There is no pre-init or
pre-consent default. The script is injected dynamically only when `marketing=true` and all other
gates pass.

### 12.2 Events (Phase 5 scope)

Only client-side events are implemented in the first Pixel phase:

| Meta Pixel event | Trigger                                                                      | First-party source              | Conditions                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `PageView`       | Each eligible page load after marketing consent via `page_viewed` forwarding | `page_viewed`                   | marketing consent + production + allowed route. Only one `PageView` per page load — fired via first-party forwarding, not on Pixel init |
| `ViewContent`    | Demo or package viewed                                                       | `demo_viewed`, `package_viewed` | marketing consent + production + commercial/demo route                                                                                  |
| `Contact`        | WhatsApp click (intent only)                                                 | `whatsapp_contact_clicked`      | marketing consent + production + commercial/demo route. Not sent for form submissions, page views, or passive engagement                |
| `Purchase`       | ❌ Blocked until `payment_received`                                          | —                               | Future only                                                                                                                             |

`Lead` is reserved for a later server-side or confirmed-lead delivery phase (see Phase 8). `Contact`
is an intent signal from WhatsApp clicks only; `Lead` will be a confirmed conversion. They are not
duplicates of the same event — they serve different funnel stages and will use different event names
and event IDs in a future phase.

### 12.3 Contact vs Lead distinction

- `Contact` fires from the **client** on WhatsApp click only. This is an intent signal, not a
  confirmed lead.
- `Lead` is **not implemented** in this phase. It is reserved for a future server-side delivery
  phase when a confirmed lead event exists in the first-party system.
- `Contact` and `Lead` are not duplicates. They represent different funnel stages: intent vs
  confirmed conversion.
- No `eventID` is sent for `Contact` in this phase. `Contact` does not use `lead_code` because no
  confirmed lead record exists for a generic WhatsApp click.
- In a future phase where the same logical event is sent through both browser Pixel and server-side
  CAPI, deduplication must use the same `event_name` and a stable `event_id`. This is not applicable
  in the current phase.

### 12.4 No checkout-like events

`Purchase`, `InitiateCheckout`, `AddPaymentInfo`, `AddToCart` are blocked until a real
payment/checkout flow exists. `payment_received` is the only trigger for a future `Purchase`.

### 12.5 Files likely affected

- `src/lib/tracking/meta-pixel.ts` (new) — client-side Pixel loading and event dispatch
- `src/lib/tracking/client.ts` — integrate Pixel initialisation into `initCommercialTracking()`
- `src/components/home/Footer.astro` — no change needed
- `.env.example` — add `PUBLIC_META_PIXEL_ID`, `PUBLIC_META_PIXEL_ENABLED`
- `src/env.d.ts` — add type definitions

### 12.6 Acceptance criteria

- Pixel loads only in production, on commercial/demo routes, with marketing consent.
- `PageView`, `ViewContent`, `Contact` fire with correct parameters. `Lead` is not implemented in
  this phase.
- No Pixel events fire on real invitations, RSVP, dashboard, API, local, or preview.
- No PII in Pixel events.
- Meta Events Manager Test Events shows correctly structured events.

### 12.7 Tests/validation

- Manual: Meta Pixel Helper browser extension shows Pixel loaded only on commercial/demo routes.
- Manual: Meta Events Manager Test Events shows `PageView`, `ViewContent`, and `Contact` events.
- E2E: `fbq('track')` network request absent on `/xv/valentina-hernandez`.
- E2E: `fbq('track')` present on `/` after marketing consent granted.

### 12.8 Rollback

- Remove `meta-pixel.ts`.
- Revert `client.ts` changes.
- Remove env vars from Vercel.

## 13. Event mapping (comprehensive)

| First-party event          | GA4 event       | Meta Pixel event | GA4 consent | Meta consent | Notes                                                                      |
| -------------------------- | --------------- | ---------------- | ----------- | ------------ | -------------------------------------------------------------------------- |
| `page_viewed`              | `page_view`     | `PageView`       | analytics   | marketing    | Suppress default `gtag` page_view; GA4 loaded only after analytics consent |
| `section_seen`             | `section_view`  | —                | analytics   | —            | Bucketed                                                                   |
| `scroll_depth_reached`     | `scroll`        | —                | analytics   | —            | Per bucket                                                                 |
| `cta_clicked`              | `cta_click`     | —                | analytics   | —            |                                                                            |
| `package_viewed`           | `view_item`     | —                | analytics   | marketing    | No price in params                                                         |
| `demo_viewed`              | `view_item`     | `ViewContent`    | analytics   | marketing    |                                                                            |
| `whatsapp_contact_clicked` | `contact`       | `Contact`        | analytics   | marketing    | Intent signal only; `Lead` not implemented in first phase                  |
| `form_started`             | `form_start`    | —                | analytics   | —            |                                                                            |
| `form_submitted`           | `form_submit`   | —                | analytics   | —            | Intent only                                                                |
| `lead_created`             | `generate_lead` | —                | analytics   | —            | Reserved for future server-side `Lead` dispatch                            |
| `quote_sent`               | —               | —                | —           | —            | Internal lifecycle only                                                    |
| `production_authorized`    | —               | —                | —           | —            | Internal lifecycle only                                                    |
| `payment_received`         | `purchase`      | `Purchase`       | analytics   | marketing    | **Future only**                                                            |
| All other lifecycle        | —               | —                | —           | —            | Internal only                                                              |

## 14. Route, consent, and internal-exclusion gating

### 14.1 Evaluation order

```
Route loads page
  → Layout evaluates route policy (classifyTrackingRoute)
  → Layout evaluates environment (production only)
  → Layout loads commercial tracking if internalAllowed + production
    → client.ts initCommercialTracking() fires
      → shouldIgnoreTracking() check (opt-out cookie)
      → Check consent from localStorage
        → If analytics consent: forward to GA4
        → If marketing consent: forward to Meta Pixel
      → First-party event always persists (it's our source of truth)
```

### 14.2 Gating matrix

| Check                          | First-party                                  | GA4                          | Meta Pixel                        |
| ------------------------------ | -------------------------------------------- | ---------------------------- | --------------------------------- |
| Route policy `internalAllowed` | ✅ Required                                  | —                            | —                                 |
| Route policy `gaAllowed`       | —                                            | ✅ Required                  | —                                 |
| Route policy `metaAllowed`     | —                                            | —                            | ✅ Required                       |
| Production environment         | ✅ Required                                  | ✅ Required                  | ✅ Required                       |
| Internal exclusion             | ✅ Checked before persist                    | ✅ Checked before dispatch   | ✅ Checked before dispatch        |
| Analytics consent              | —                                            | ✅ Required                  | —                                 |
| Marketing consent              | —                                            | —                            | ✅ Required                       |
| No PII                         | ✅ Validated by `hasUnsafeEventProperties()` | ✅ Parameters from allowlist | ✅ Parameters from Meta allowlist |

### 14.3 Route classes coverage

| Route class             | GA4 client-side after consent?                   | First-party tracking? | GA4 events?               | Meta Pixel?                                 |
| ----------------------- | ------------------------------------------------ | --------------------- | ------------------------- | ------------------------------------------- |
| commercial              | ✅ (dynamic client-side after analytics consent) | ✅                    | ✅ (if analytics consent) | ✅ (if marketing consent)                   |
| demo                    | ✅ (dynamic client-side after analytics consent) | ✅                    | ✅ (if analytics consent) | ✅ (if marketing consent, ViewContent only) |
| real_invitation         | ❌                                               | ❌                    | ❌                        | ❌                                          |
| personalized_invitation | ❌                                               | ❌                    | ❌                        | ❌                                          |
| rsvp_guest_api          | ❌                                               | ❌                    | ❌                        | ❌                                          |
| dashboard_admin_auth    | ❌                                               | ❌                    | ❌                        | ❌                                          |
| generic_api             | ❌                                               | ❌                    | ❌                        | ❌                                          |
| unknown                 | ❌                                               | ❌                    | ❌                        | ❌                                          |

## 15. PII safety rules

1. First-party event properties are validated by `hasUnsafeEventProperties()` (rejects keys matching
   `email|phone|whatsapp|nombre|name|message|comment|token|invite|guest|claim` and values matching
   email patterns or 10+ digit numbers).
2. GA4 event parameters must come from the `SAFE_EVENT_PROPERTY_KEYS` allowlist in
   `event-contract.ts`.
3. Meta Pixel event parameters must be limited to: `content_name` (demo/package slug),
   `content_type` ("demo" or "package"), `content_category` (event type), `value` (never used — no
   prices), `currency` (never used), `eventID` (lead_code only).
4. No raw customer PII (name, email, phone, message text) is ever sent to GA4 or Meta.
5. `lead_code` is a non-PII opaque identifier (e.g. `CM-A3X9K2`) that is safe for GA4 and Meta event
   IDs.
6. RSVP/guest data is never sent to any third-party analytics or marketing platform.
7. Internal traffic exclusion (dashboard auth, opt-out cookie, non-production env) runs before any
   third-party dispatch.

## 16. Dashboard tracking-quality additions

### 16.1 New cards/sections for `/dashboard/commercial`

Add these to the existing `CommercialDashboardSummary` interface and `commercial.astro`. All metrics
must be derivable from the existing `consent_snapshot` JSONB column in persisted `tracking_events`
or `visitor_sessions`. No blocked-event counters are added because rejected/blocked events are never
persisted.

| Card                          | Data source                                               | Description                                                                  |
| ----------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Consent distribution          | Derived from `consent_snapshot` in `tracking_events`      | % analytics enabled, % marketing enabled among persisted events              |
| GA4-eligible events           | Derived from `consent_snapshot.analytics=true` per event  | Count of persisted events with analytics consent — would have been forwarded |
| GA4-blocked-by-consent        | Derived from `consent_snapshot.analytics=false` per event | Count of persisted events without analytics consent — blocked                |
| Meta-eligible events          | Derived from `consent_snapshot.marketing=true` per event  | Count of persisted events with marketing consent                             |
| Meta-blocked-by-consent       | Derived from `consent_snapshot.marketing=false` per event | Count of persisted events without marketing consent                          |
| Last tracking event timestamp | Max `occurred_at` from `tracking_events`                  | When was the last event received                                             |

### 16.2 Implementation approach

- Add a new summarisation function or extend `summarizeCommercialAnalytics()` in
  `commercial-dashboard.ts`.
- Add Supabase queries for consent distribution (aggregate on `consent_snapshot` JSONB).
- Display as muted metric cards below the existing totals.

### 16.3 Files likely affected

- `src/lib/tracking/commercial-dashboard.ts` — add fields and queries
- `src/pages/dashboard/commercial.astro` — add tracking-quality cards

## 17. Environment variables

### 17.1 Existing

```env
PUBLIC_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX   # Current GA ID
```

### 17.2 Future public/browser-safe (added in implementation phases)

```env
PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX      # Phase 3 — recommended rename from PUBLIC_GOOGLE_ANALYTICS_ID
PUBLIC_META_PIXEL_ID=1234567890            # Phase 5 — Meta Pixel ID
PUBLIC_META_PIXEL_ENABLED=true             # Phase 5 — kill switch for Pixel

# Only if GTM is activated:
# PUBLIC_GTM_ID=GTM-XXXXXXX               # Phase 4
```

### 17.3 Future server-only (later phases)

```env
META_ACCESS_TOKEN=EAAS...                  # Future CAPI phase
META_TEST_EVENT_CODE=TEST12345             # Future CAPI phase
```

### 17.4 Variable lifecycle

| Variable                     | Phase added      | Public/Server | Notes                                                                      |
| ---------------------------- | ---------------- | ------------- | -------------------------------------------------------------------------- |
| `PUBLIC_GOOGLE_ANALYTICS_ID` | Existing         | Public        | Keep for backward compat; migrate to `PUBLIC_GA_MEASUREMENT_ID` optionally |
| `PUBLIC_GA_MEASUREMENT_ID`   | Phase 3          | Public        | Preferred name; fall back to `PUBLIC_GOOGLE_ANALYTICS_ID`                  |
| `PUBLIC_META_PIXEL_ID`       | Phase 5          | Public        | Required for Pixel activation                                              |
| `PUBLIC_META_PIXEL_ENABLED`  | Phase 5          | Public        | Allows disabling Pixel without code change                                 |
| `PUBLIC_GTM_ID`              | Phase 4 (if GTM) | Public        | Required for GTM container load                                            |
| `META_ACCESS_TOKEN`          | Future CAPI      | Server        | Never exposed to client                                                    |
| `META_TEST_EVENT_CODE`       | Future CAPI      | Server        | Used for Meta test events                                                  |

## 18. Implementation phases

### Phase 1: Consent model + UI + consent persistence

**Scope**: Create the consent storage helper, consent UI (banner + preferences), integrate into
Layout.

**Files likely affected**:

- `src/lib/tracking/consent-client.ts` (new) — read/write/observe consent in localStorage
- `src/components/common/ConsentBanner.astro` (new) — Astro component
- `src/components/common/ConsentBanner.tsx` (new) — React island for state management
- `src/components/common/ConsentPreferences.tsx` (new) — optional modal component
- `src/layouts/Layout.astro` — import and render ConsentBanner
- `src/lib/tracking/client.ts` — replace `getConsentSnapshot()` stub with real `readConsent()`
- `src/components/home/Footer.astro` — add "Configurar cookies" link

**Acceptance criteria**:

- Consent banner appears on commercial routes only.
- Accept All, Reject Optional, Configure work correctly.
- Consent persists in localStorage and survives page navigation.
- `getConsentSnapshot()` returns real user choice.
- Footer link re-opens preferences.
- No banner on non-commercial routes.

**Tests/validation**:

- Unit: `consent-client.ts` read/write/parse.
- Unit: default state equals `{necessary:true, analytics:false, marketing:false}`.
- E2E: banner appearance and interaction.
- E2E: no banner on dashboard.

**Rollback**:

- Revert `Layout.astro` consent banner import.
- Delete `ConsentBanner.astro`, `ConsentBanner.tsx`, `ConsentPreferences.tsx`.
- Revert `client.ts` to hardcoded getConsentSnapshot.
- Revert footer link.

---

### Phase 2: Legal/privacy/cookie draft updates

**Scope**: Update `/privacidad` with consent categories, GA4, Meta Pixel, remarketing, third-party
disclosures. Update `/terminos` minimally. Mark all legal copy as `[REQUIRES OWNER/LEGAL REVIEW]`.

**Files likely affected**:

- `src/pages/privacidad.astro` — expand Sections 5, 6, 9
- `src/pages/terminos.astro` — brief reference to privacy policy for analytics

**Acceptance criteria**:

- Updated privacy page covers all required topics from Section 9.2.
- Legal copy flagged for owner/legal review.
- Terms page references privacy policy for analytics/marketing.
- Links check passes.

**Tests/validation**:

- Visual review of rendered legal pages.
- `pnpm ops check-links` passes.

**Rollback**:

- Revert `privacidad.astro` and `terminos.astro` to current versions.

---

### Phase 3: GA4 event forwarding from first-party events

**Scope**: Add consent-mode defaults to GA4, suppress default `page_view`, create `ga4-forwarder.ts`
to forward mapped events. GA4 is dynamically loaded client-side only after analytics consent — no
pre-consent loading.

**Files likely affected**:

- `src/components/common/GoogleAnalytics.astro` — remove server-side loading; this component becomes
  a client-side dynamic loader or is replaced by the forwarder
- `src/layouts/Layout.astro` — remove `GoogleAnalytics` static import and `loadGoogleAnalytics`
  check; GA loading moves to client
- `src/lib/tracking/route-policy.ts` — no change (already has `gaAllowed`)

**Acceptance criteria**:

- GA4 script loads dynamically only after `analytics=true` is granted.
- Default `page_view` suppressed; intentional `page_view` sent after consent check.
- All mapped events forward to GA4 with correct parameters.
- No GA4 events on dashboard, real invitations, RSVP, API, local, preview.
- No PII in GA4 parameters.
- Validated in GA4 DebugView.

**Tests/validation**:

- Unit: ga4-forwarder event mapping and consent gate.
- E2E: GA4 network request absent without analytics consent.
- E2E: GA4 custom events present after accept all.
- Manual: GA4 DebugView shows correct events.

**Rollback**:

- Delete `ga4-forwarder.ts`.
- Revert `Layout.astro` — restore `GoogleAnalytics` import and server-side loading if needed.
- Revert `client.ts` changes.

---

### Phase 4: GTM readiness (documentation only)

**Scope**: GTM is not implemented or loaded in this pass. Document GTM readiness: the existing
`pushDataLayer()` in `client.ts` already provides GTM-compatible events through `dataLayer`. No
container loading, no new components.

**Minimum deliverable**: Add a comment in `client.ts` clarifying that `pushDataLayer()` already
provides GTM-compatible events. Document `PUBLIC_GTM_ID` in `.env.example` with a comment.

**If GTM activation is chosen**:

- Create `src/components/common/GoogleTagManager.astro`.
- Load GTM only in production, on commercial/demo routes, with analytics consent.
- Route-gate via `shouldLoadGoogleAnalytics()` pattern.

**Acceptance criteria (if activated)**:

- GTM loads only on allowed routes with consent.
- No GTM on non-commercial routes.
- `dataLayer` pushes same events as first-party.
- GTM Preview mode shows correct tags.

---

### Phase 5: Meta Pixel activation

**Scope**: Load Meta Pixel, fire `PageView`, `ViewContent`, `Contact` with marketing consent gating.
`Lead` is not implemented in this phase.

**Files likely affected**:

- `src/lib/tracking/meta-pixel.ts` (new) — Pixel init and event dispatch
- `src/lib/tracking/client.ts` — integrate Pixel init
- `.env.example` — add `PUBLIC_META_PIXEL_ID`, `PUBLIC_META_PIXEL_ENABLED`
- `src/env.d.ts` — add type definitions

**Acceptance criteria**:

- Pixel loads only in production, on commercial/demo routes, with marketing consent.
- `PageView`, `ViewContent`, `Contact` fire with correct parameters.
- No Pixel on real invitations, RSVP, dashboard, API, local, preview.
- No PII in Pixel events.
- Validated in Meta Events Manager / Test Events.

**Tests/validation**:

- Manual: Meta Pixel Helper extension.
- Manual: Meta Events Manager Test Events.
- E2E: no Pixel request on `/xv/valentina-hernandez`.
- E2E: Pixel fires on `/` after marketing consent.

**Rollback**:

- Delete `meta-pixel.ts`.
- Revert `client.ts`.
- Remove `PUBLIC_META_PIXEL_ID`/`PUBLIC_META_PIXEL_ENABLED` from Vercel.

---

### Phase 6: Dashboard tracking-quality additions

**Scope**: Add consent distribution, GA4-eligible vs GA4-blocked-by-consent counts, Meta-eligible vs
Meta-blocked-by-consent counts, and last tracking event timestamp. Only metrics derivable from
existing persisted data are included.

**Files likely affected**:

- `src/lib/tracking/commercial-dashboard.ts` — extend `CommercialDashboardSummary`, add queries
- `src/pages/dashboard/commercial.astro` — add new cards

**Acceptance criteria**:

- Dashboard shows consent distribution percentages.
- GA4 enabled/blocked counts visible.
- Meta enabled/blocked counts visible.
- Last tracking event timestamp visible.
- Internal/excluded session counts already exist.

**Tests/validation**:

- Unit: summarisation function includes new fields.
- Manual: dashboard shows realistic numbers after test events.

**Rollback**:

- Revert `commercial-dashboard.ts` to previous interface.
- Remove new cards from `commercial.astro`.

---

### Phase 7: Post-launch validation and monitoring

**Scope**: Monitor GA4 DebugView, Meta Events Manager, and dashboard tracking quality for 1-2 weeks
after launch. Fix any issues found.

**Actions**:

- Verify GA4 events in DebugView match first-party events.
- Verify Meta Pixel events in Test Events match expectations.
- Verify no tracking on excluded routes via browser DevTools network tab.
- Verify consent banner functions correctly on all target browsers (Chrome, Safari, Firefox, mobile
  browsers).
- Run `pnpm test` to confirm existing tests still pass.

---

### Phase 8: Future CAPI/Purchase (not yet)

Blocked on:

- `orders` or payment model existing in the database.
- `payment_received` event existing and populated.
- A real checkout/payment flow (even if manual approval).

Future requirements:

- `meta_event_deliveries` table to track server-side delivery attempts.
- Deduplication via `eventID` matching `lead_code` or `order_id`.
- `Purchase` event only after `payment_received`.
- No guest RSVP data in CAPI payloads.
- Hashing/matching (SHA256(email), SHA256(phone)) only after explicit legal review.
- Server-only `META_ACCESS_TOKEN` and `META_TEST_EVENT_CODE` env vars.
- Meta Conversions API endpoint integration server-side.

## 19. Acceptance criteria (global)

All implementation phases produce buildable, deployable increments.

- First-party tracking remains the source of truth; GA4 and Meta are downstream consumers.
- GA4 receives only analytics-consented, route-gated, PII-safe events.
- Meta Pixel receives only marketing-consented, route-gated, PII-safe events.
- Consent state is persistent, changeable, and respected by all third-party dispatchers.
- `/privacidad` covers consent categories, GA4, Meta Pixel, remarketing, and third-party platforms.
- Dashboard shows tracking health metrics (consent distribution, GA4-eligible vs
  GA4-blocked-by-consent, Meta-eligible vs Meta-blocked-by-consent).
- No RSVP/guest data leaks to GA4 or Meta.
- Real invitations, personalized links, dashboard, auth, API, local, and preview routes never fire
  production marketing events.
- `getConsentSnapshot()` returns real user consent, not hardcoded values.

## 20. Validation plan

### For this planning pass

- Inspect all listed source files for current state. ✅ Done.
- Run `pnpm ops check-links` for document references. ✅ Done (passes).
- Run `pnpm agent:git-safety:check` and `pnpm agent:git-safety:end`. ⬜ To be done.
- Report `git status --short`. ⬜ To be done.

### For each implementation phase

- Unit tests for new client-side modules (consent, ga4-forwarder, meta-pixel).
- Updates to existing route-policy and ingestion tests if contracts change.
- E2E tests for consent banner appearance and interaction.
- E2E tests verifying no third-party scripts on excluded routes.
- Manual validation using GA4 DebugView, Meta Pixel Helper, Meta Events Manager.
- `pnpm build` must pass after every phase.
- `pnpm test` must pass after every phase.

## 21. Rollback plan

Each phase in Section 18 includes its own rollback steps. The general approach:

1. **Revert code changes**: reverse the file modifications for the phase.
2. **Revert env vars**: remove phase-specific variables from Vercel project settings.
3. **Remove migration**: if a phase added a Supabase migration, write a down migration.
4. **Verify rollback**: confirm no third-party scripts fire, existing tests pass, build succeeds.

Emergency rollback (all phases):

```bash
git checkout develop -- src/lib/tracking/ src/components/common/ src/layouts/ src/pages/ src/env.d.ts
```

## 22. Risks and trade-offs

| Risk                                                       | Impact                 | Mitigation                                                                    |
| ---------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------- |
| Consent banner delays first meaningful paint               | UX                     | Use non-blocking CSS/JS; banner renders after page content                    |
| GA4 blocking due to ad blockers                            | Analytics              | First-party tracking is unaffected; GA4 is best-effort                        |
| Meta Pixel firing on demos that look like real invitations | Audience contamination | Route policy classifies `demo-*` slugs explicitly; only these fire Pixel      |
| Consent state reset on browser storage clear               | User annoyance         | Acceptable; banner re-appears once                                            |
| GDPR/ePrivacy regulator changes                            | Compliance             | Consent model is simple and standard; can be upgraded to a full CMP if needed |
| GTM decision later reversed                                | Extra work             | `dataLayer` already present; adding GTM later is straightforward              |
| `lead_created` never fires from server                     | No Meta `Lead`         | `Lead` is deferred to a future phase with server-side dispatch                |

## 23. Recommended next implementation prompt

Phases 1–6 have been implemented in the current pass. The next implementation pass should begin with
post-launch validation (Phase 7) and not repeat earlier phases.

## Owner/manual actions required

### Before implementation

- [ ] **Decide consent UI style**: recommendation is compact banner + preferences modal. Confirm or
      choose alternative.
- [ ] **Confirm GA4 direct vs GTM**: recommendation is direct GA4 + direct Meta (no GTM). Confirm or
      choose GTM.
- [ ] **Confirm demo pages for Meta remarketing**: recommendation is yes, with marketing consent.
- [ ] **Confirm Vercel Web Analytics stays enabled**: recommendation is yes.
- [ ] **Confirm whether consent banner should appear on demo routes**: recommendation is yes.
- [ ] **Create GA4 Measurement ID** in Google Analytics 4 property (if not already created).
- [ ] **Create Meta Pixel ID** in Meta Business Manager / Events Manager.
- [ ] **Create GTM Container ID** if GTM activation is chosen.
- [ ] **Review privacy/legal copy drafts** before deployment.

### During implementation

- [ ] **Configure Vercel env vars** for each new ID (GA4, Meta Pixel).
- [ ] **Test consent flows** on Chrome, Safari, Firefox, mobile browsers.
- [ ] **Validate GA4 DebugView** during Phase 3 implementation.
- [ ] **Validate Meta Events Manager / Test Events** during Phase 5 implementation.
- [ ] **Verify no tracking on excluded routes** via browser DevTools network tab.
- [ ] **Run `pnpm build` and `pnpm test`** after each phase.

### After implementation

- [ ] **Monitor GA4 DebugView** for 1-2 weeks for correct event volume and parameters.
- [ ] **Monitor Meta Events Manager** for Active Events status and deduplication.
- [ ] **Monitor commercial dashboard tracking-quality cards** for consent distribution and GA4/Meta
      consent-blocked counts.
- [ ] **Review privacy page** annually or when adding new tracking technologies.
- [ ] **When payment model is built**, revisit Phase 8 (CAPI/Purchase) requirements.
