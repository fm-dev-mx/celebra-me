---
title: Commercial Analytics Attribution Dashboard
status: draft
type: documentation
created: 2026-06-28
updated: 2026-06-28
autonomy: 'Level 1 - Documentation changes only'
related_skills:
  - backend-engineering
  - astro-patterns
  - supabase
  - supabase-postgres
related_docs:
  - docs/core/architecture.md
  - docs/core/project-conventions.md
  - docs/env-workflow.md
  - docs/domains/database/overview.md
  - docs/domains/intake/production-flow.md
  - docs/domains/rsvp/architecture.md
---

# Commercial Analytics Attribution Dashboard SDD Spec

## 1. Problem statement

Celebra-me needs a professional analytics, attribution, tracking, and dashboard system that reflects
the actual commercial workflow: acquisition starts on the landing page and continues through
WhatsApp or the contact form; payment is currently manual and happens after client approval or
delivery. The system must not pretend that an online checkout exists.

The current tracking surface is broad and script-oriented. Google Analytics is injected from shared
layouts, dashboard pages can receive GA, and Vercel Web Analytics is enabled globally. There is no
central route policy, consent policy, first-party commercial event contract, internal traffic
exclusion layer, or commercial dashboard model. This creates contamination risk across marketing
pages, real client invitations, RSVP guest flows, dashboard/admin pages, APIs, local development,
and Vercel Preview.

The target architecture must make first-party tracking the source of truth, use GA4 only for
behavioral analytics, use Meta Pixel only for ad optimization, keep GTM optional, and connect
behavior to lead, production, and future payment outcomes without sending fake purchase events.

## 2. Current state

- `src/layouts/Layout.astro` injects `GoogleAnalytics` when
  `process.env.VERCEL_ENV === 'production'` and `PUBLIC_GOOGLE_ANALYTICS_ID` is present. The same
  layout also injects Vercel Analytics and Speed Insights in production.
- `src/layouts/DashboardLayout.astro` injects `GoogleAnalytics` whenever
  `PUBLIC_GOOGLE_ANALYTICS_ID` exists, without a production, consent, or route exclusion gate.
- `astro.config.mjs` enables `vercel({ webAnalytics: { enabled: true } })`, so Vercel Web Analytics
  is platform-enabled in addition to layout-level analytics.
- `src/components/common/GoogleAnalytics.astro` loads `gtag.js` and emits `gtag('config', id)`,
  which sends a default page view without route classification, consent, preview, or internal
  traffic checks.
- The landing page is `src/pages/index.astro`. It renders hero, services, pricing, FAQ, contact, and
  footer sections from `src/data/landing-page.data.ts`.
- Current CTAs are direct anchors and direct WhatsApp links. `src/utils/whatsapp.ts` builds
  `https://wa.me/...` URLs from `CONTACT_WHATSAPP`.
- The contact form in `src/components/ui/ContactForm.astro` posts `name`, `email`, and `message` to
  `/api/contact`. `src/pages/api/contact.ts` validates the body and sends email only. It does not
  create a lead or attribution record.
- Real invitation rendering lives at `src/pages/[eventType]/[slug].astro`, with personalized links
  through `?invite=...` and short routes under `src/pages/[eventType]/[slug]/i/[shortId].astro` and
  `src/pages/i/[shortId].astro`.
- Guest/RSVP telemetry already exists for operational use. `src/lib/invitation/engagement.ts`
  reports personalized invitation section progress to `/api/invitacion/:inviteId/view`, which
  updates `guest_invitations` view fields through `trackInvitationView()`.
- Dashboard routes live under `src/pages/dashboard/**`; API routes live under `src/pages/api/**`.
  Middleware protects dashboard and dashboard API routes through session and MFA rules.
- Existing legal pages are `/privacidad` and `/terminos`. There is no cookie/consent page, and
  current copy does not describe GA4, Meta Pixel, remarketing, consent categories, manual payment,
  customer versus guest RSVP data separation, retention detail, or withdrawal of consent.
- Environment variables are typed in `src/env.d.ts` and templated in `.env.example`. Current
  analytics naming uses `PUBLIC_GOOGLE_ANALYTICS_ID`; the future plan should introduce clearer names
  only during an implementation pass.

## 3. Goals

- Define a route-gated, consent-gated, privacy-safe commercial analytics architecture.
- Make internal first-party events the commercial source of truth.
- Define a GA4 event strategy for intentional, PII-safe behavioral analytics.
- Define optional GTM readiness through a controlled data layer, not as business logic.
- Define Meta Pixel setup for approved commercial/demo routes only, with marketing consent.
- Reserve Meta CAPI/offline conversions for future confirmed payments only.
- Define dashboard metrics that connect traffic, engagement, CTAs, demos, leads, production, and
  payment outcomes.
- Separate customer/lead tracking from real invitation guest and RSVP activity.
- Define internal traffic exclusion before any event reaches internal tracking, GA4, GTM, or Meta.
- Identify legal and privacy documentation gaps that require future copy and legal review.

## 4. Non-goals

- Do not implement production code in this pass.
- Do not create migrations, database tables, API routes, UI pages, tracking scripts, GA4 events, GTM
  containers, Meta Pixel scripts, or Meta CAPI calls in this pass.
- Do not model the current manual payment flow as online checkout.
- Do not send Meta `Purchase`, `InitiateCheckout`, `AddPaymentInfo`, or `AddToCart` events until a
  real checkout/payment flow exists.
- Do not treat RSVP or guest activity as commercial lead activity.
- Do not create an analytics warehouse, heatmap recorder, session replay system, or server-side GTM
  MVP.
- Do not create `/admin/pixel`; future dashboard work should prefer `/dashboard/commercial`.

## 5. Constraints

- Keep visible UI copy in Spanish. Keep code, identifiers, comments, and technical documentation in
  English unless an existing document requires otherwise.
- Preserve Astro server/client boundaries. Browser tracking helpers must not import server-only
  modules or secrets.
- Use SCSS for maintained styling and do not introduce Tailwind.
- Public environment variables must be browser-safe. Server-only tokens must never use `PUBLIC_`.
- Vercel Preview, local development, dashboard/auth/admin/API routes, real invitations, and RSVP
  routes must not emit production marketing events by default.
- The system must remain buildable and deployable after every phase.
- Supabase schema changes must be additive migrations in a future pass and must follow RLS and
  database safety rules.

## 6. Route tracking policy

| Route class                   | Examples                                                                 | Internal first-party                                         | GA4                                            | Meta Pixel                                                                | Notes                                                       |
| ----------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Commercial/marketing          | `/`, landing sections, `/privacidad`, `/terminos`, contact and CTA flows | Allowed                                                      | Allowed after analytics consent where required | Allowed only after marketing consent                                      | Main acquisition surface. No PII in third-party events.     |
| Demo/catalog                  | `/{eventType}/demo-*`                                                    | Limited allowed                                              | Allowed                                        | Limited `ViewContent` only after explicit demo classification and consent | Do not infer all static routes are demos; use route policy. |
| Real client invitations       | `/{eventType}/{slug}` when `isDemo !== true`                             | Only privacy-safe operational/internal tracking if justified | No marketing analytics by default              | No                                                                        | Must not contaminate ad audiences.                          |
| Personalized invitation links | `?invite=...`, `/i/[shortId]`, `/{eventType}/{slug}/i/[shortId]`         | RSVP operational tracking only                               | No marketing analytics by default              | No                                                                        | Guest identity and event attendance are not lead signals.   |
| RSVP/guest APIs               | `/api/invitacion/**/rsvp`, `/api/invitacion/**/view`                     | Operational logging only                                     | No                                             | No                                                                        | Keep guest data separate from commercial leads.             |
| Dashboard/admin/auth          | `/dashboard/**`, `/login`, `/api/auth/**`, `/api/dashboard/**`           | Audit/logging only if needed                                 | No                                             | No                                                                        | Authenticated owner/team usage must be excluded.            |
| Generic APIs                  | `/api/**`                                                                | Server-side logs only                                        | No client analytics                            | No                                                                        | API routes do not load client analytics.                    |
| Development/preview           | local hosts, `VERCEL_ENV=preview`, `VERCEL_ENV=development`              | Debug/test-only if explicitly enabled                        | Disabled by default                            | Disabled                                                                  | Never send production marketing events.                     |

Route policy must be evaluated before any event is emitted. GTM must not bypass this policy.

## 7. Event taxonomy

### Internal first-party events

MVP commercial events:

- `page_viewed`
- `session_started`
- `session_ended`
- `section_seen`
- `scroll_depth_reached`
- `cta_clicked`
- `package_viewed`
- `demo_viewed`
- `whatsapp_contact_clicked`
- `form_started`
- `form_submitted`
- `lead_created`

Lifecycle events:

- `quote_sent`
- `production_authorized`
- `production_started`
- `preview_delivered`
- `payment_pending`
- `payment_received`
- `invitation_activated`
- `converted_to_demo`
- `lost`

Rules:

- `production_authorized` means operational client commitment, not payment.
- `payment_received` is the only event that may later map to Meta `Purchase`.
- RSVP events and guest invitation view events are separate operational events and must not become
  commercial leads by default.

### GA4 events

Recommended mappings:

| Internal event             | GA4 event                                | Parameters                                                       |
| -------------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| `page_viewed`              | `page_view`                              | `route_class`, `page_type`, `is_demo`, `event_type` when non-PII |
| `section_seen`             | `section_view`                           | `section_id`, `page_type`, `visibility_bucket`                   |
| `scroll_depth_reached`     | `scroll_depth`                           | `depth_bucket`, `page_type`                                      |
| `cta_clicked`              | `select_content` or `cta_click`          | `cta_id`, `cta_location`, `destination_type`                     |
| `package_viewed`           | `view_item`                              | `package_id`, `package_tier`                                     |
| `demo_viewed`              | `view_item` or `view_content` equivalent | `demo_slug`, `event_type`, `is_demo=true`                        |
| `whatsapp_contact_clicked` | `generate_lead` or `contact`             | `lead_channel=whatsapp`, `cta_id`                                |
| `form_started`             | `form_start`                             | `form_id`                                                        |
| `form_submitted`           | `form_submit`                            | `form_id`, `success=true`                                        |
| `lead_created`             | `generate_lead`                          | `lead_channel`, `lead_source`                                    |

GA4 must not receive names, emails, phone numbers, raw message text, invite IDs, claim codes,
tokens, or guest names.

### Meta events

Allowed when route policy and marketing consent both allow:

- `PageView` on commercial/marketing routes.
- `ViewContent` on explicitly classified commercial packages and demo/catalog routes.
- `Contact` for WhatsApp click or successful contact intent.
- `Lead` only when a server-side lead is created or confidently deduplicated.
- Future `Purchase` only when `payment_received` is recorded.

Rejected until a real checkout/payment flow exists:

- `Purchase`
- `InitiateCheckout`
- `AddPaymentInfo`
- `AddToCart`

## 8. Consent model

Consent categories:

- Necessary: required security, auth, CSRF, session, and operational cookies.
- Analytics: first-party analytics and GA4 behavioral analytics.
- Marketing: Meta Pixel, remarketing, advertising audiences, and future ad platform integrations.

Rules:

- Consent is evaluated on the client before browser events are sent.
- Internal traffic exclusion is evaluated before consent-based routing to avoid recording owner/team
  activity at all.
- Consent state should be stored in a minimal cookie or local storage record that contains category
  choices and timestamp, not personal data.
- Necessary cookies may be set without analytics/marketing consent.
- Marketing consent must be explicit before loading Meta Pixel or pushing Meta events.
- A future UI must allow withdrawal of analytics and marketing consent.

## 9. Internal traffic exclusion strategy

Apply exclusion before sending to internal tracking, GA4, GTM, or Meta:

- Exclude authenticated dashboard users and dashboard/admin routes.
- Exclude local development and Vercel Preview by default.
- Support a local device opt-out cookie such as `cm_ignore_tracking=true`.
- Add a future protected dashboard/debug action labeled in Spanish, for example "Excluir este
  dispositivo del seguimiento", to set the opt-out cookie.
- Optional GA4-only IP filters may be configured in GA, but must not be the primary application
  control.
- Debug/test modes must be explicit and visibly separated from production metrics.

## 10. GA4 strategy

- Replace broad layout-level GA with a route-policy-aware loader in a future implementation pass.
- Use a future public variable name such as `PUBLIC_GA_MEASUREMENT_ID`; keep
  `PUBLIC_GOOGLE_ANALYTICS_ID` compatibility only if an implementation plan explicitly requires a
  transition.
- Disable GA4 in local and Vercel Preview unless a test/debug flag is explicitly enabled.
- Avoid duplicate `page_view` by controlling whether `gtag('config')` sends the default page view.
- Send intentional custom events only after route policy, consent, and internal-exclusion checks.
- Use GA4 DebugView during implementation validation.

## 11. GTM strategy

- GTM is optional orchestration, not the business logic layer.
- A data-layer-compatible helper can be built before GTM is installed so event shape is stable.
- The helper should expose only approved, PII-safe events after route policy, consent, and internal
  exclusion have passed.
- Future public variable: `PUBLIC_GTM_ID`, documented but not added in this pass.
- GTM must not load Meta or GA tags on routes that the application route policy excludes.

## 12. Meta Pixel strategy

- Future public variables: `PUBLIC_META_PIXEL_ID` and `PUBLIC_META_PIXEL_ENABLED`, documented but
  not added in this pass.
- Load Meta Pixel only on allowed route classes, only in production, only after marketing consent,
  and only when internal traffic is not excluded.
- Emit only the allowed events from the Meta taxonomy.
- Use route parameters and demo/package identifiers only when they are not PII.
- Do not load Pixel on real invitations, personalized invitation links, RSVP flows, dashboard/admin,
  auth, APIs, local, or preview routes by default.

## 13. Future CAPI strategy

- Future server-only variables: `META_ACCESS_TOKEN` and `META_TEST_EVENT_CODE`, documented but not
  added in this pass.
- CAPI/offline conversions should be implemented only after first-party lead/order/payment entities
  exist.
- Send future `Purchase` only for `payment_received`.
- Use event deduplication IDs when browser Pixel and CAPI both report the same allowed event.
- Do not send guest RSVP data, invitation guest identity, or raw customer PII to Meta. If matching
  fields are ever used, they require explicit legal review and hashing according to Meta
  requirements.

## 14. Dashboard plan

Future route: `/dashboard/commercial`.

Use the existing protected dashboard architecture rather than a new admin namespace. The MVP should
answer commercial questions, not just show vanity counts.

Sections:

1. Overview
2. Traffic
3. Engagement
4. CTAs
5. Demos
6. Leads
7. Orders / production
8. Payments
9. Tracking quality
10. Meta/GA delivery status, future phase only

Metrics:

- Visits, users, sessions, engaged sessions, average active time.
- Max scroll depth and section visibility.
- CTA clicks, WhatsApp clicks, form submissions.
- Demo views, top demos by visits, top demos by leads.
- Top CTAs by lead creation.
- Source, medium, campaign, and device type.
- Internal traffic excluded.
- Leads by status.
- Production authorized rate.
- Payment received rate.
- Converted-to-demo count and lost leads.
- Campaign to lead to production to payment attribution.

## 15. Data model proposal

No migrations are created in this pass.

### `visitor_sessions`

- Status: MVP.
- Purpose: first-party anonymous session record for commercial route visits.
- Minimal fields: `id`, `visitor_id`, `started_at`, `ended_at`, `last_seen_at`, `landing_path`,
  `referrer`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `device_type`,
  `route_policy`, `is_internal`, `consent_snapshot`, `created_at`.
- Privacy/PII: avoid IP storage in MVP; if IP-derived metadata is needed later, store coarse values
  or hashed/short-retention fields only after legal review.
- Dashboard use cases: sessions, traffic quality, campaign attribution, engaged session rate.

### `tracking_events`

- Status: MVP.
- Purpose: append-only first-party event stream for approved commercial events.
- Minimal fields: `id`, `session_id`, `visitor_id`, `event_name`, `occurred_at`, `route_path`,
  `route_class`, `source`, `medium`, `campaign`, `event_properties`, `consent_snapshot`,
  `is_internal`, `created_at`.
- Privacy/PII: event properties must be allowlisted and PII-safe.
- Dashboard use cases: funnel analysis, section engagement, CTA performance, demo views, quality
  diagnostics.

### `leads`

- Status: MVP.
- Purpose: commercial lead record created from contact form or manual WhatsApp/admin reconciliation.
  WhatsApp clicks create intent events and lead codes, not confirmed leads by default.
- Minimal fields: `id`, `lead_code`, `session_id`, `source_event_id`, `channel`, `status`, `name`,
  `email`, `phone`, `event_type`, `message_summary`, `utm_source`, `utm_medium`, `utm_campaign`,
  `created_at`, `updated_at`.
- MVP statuses: `new`, `contacted`, `quoted`, `production_authorized`, `paid`, `converted_to_demo`,
  `lost`, `spam`. `production_authorized` means client commitment, not payment; `paid` is the only
  paid/sale state.
- Privacy/PII: contains customer PII; protect behind dashboard auth, do not send raw values to
  GA4/Meta, define retention and access rules.
- Dashboard use cases: lead volume, source attribution, lead status, CTA to lead conversion.

### `orders`

- Status: MVP, can start minimal once lead lifecycle requires it.
- Purpose: commercial lifecycle record connecting lead, invitation production, authorization, and
  payment.
- Minimal fields: `id`, `lead_id`, `invitation_id`, `status`, `package_tier`,
  `production_authorized_at`, `production_started_at`, `preview_delivered_at`, `payment_pending_at`,
  `payment_received_at`, `amount`, `currency`, `created_at`, `updated_at`.
- Privacy/PII: payment and order data require restricted access and clear retention.
- Dashboard use cases: production authorized rate, payment received rate, revenue attribution.

### `meta_event_deliveries`

- Status: later.
- Purpose: record future Pixel/CAPI delivery attempts, deduplication IDs, test codes, and outcomes.
- Minimal fields: `id`, `event_id`, `meta_event_name`, `deduplication_id`, `delivery_channel`,
  `status`, `error_code`, `error_message`, `sent_at`, `created_at`.
- Privacy/PII: do not store Meta access tokens; avoid storing payloads with PII.
- Dashboard use cases: tracking quality and delivery diagnostics.

### `analytics_daily_rollups`

- Status: later.
- Purpose: performance optimization for dashboard date ranges after event volume justifies it.
- Minimal fields: `date`, `metric_key`, `route_class`, `source`, `medium`, `campaign`, `value`,
  `dimensions`, `created_at`, `updated_at`.
- Privacy/PII: aggregated only.
- Dashboard use cases: faster dashboards, long-range trend views.

### `page_engagements`

- Status: optional later.
- Purpose: separate per-page engagement summary if querying raw `tracking_events` becomes expensive.
- Minimal fields: `id`, `session_id`, `path`, `max_scroll_depth`, `active_time_seconds`,
  `sections_seen`, `first_seen_at`, `last_seen_at`.
- Privacy/PII: no PII; tie to session only.
- Dashboard use cases: engagement summaries and top-section reporting.

## 16. Legal/documentation gaps

Future legal/privacy/cookie updates should cover:

- GA4 analytics and event categories.
- Meta Pixel, advertising cookies, remarketing, and audience building.
- Consent categories: necessary, analytics, marketing.
- Consent withdrawal and opt-out.
- Manual payment, transfer, approval, and delivery workflow. Current payment is not online checkout.
- Separation of customer/lead data from guest RSVP data.
- Data retention for leads, orders, analytics events, RSVP guest data, and operational logs.
- Third-party processors and platforms, including Google, Meta, Vercel, Supabase, email, and any
  future payment provider.
- ARCO/privacy contact process and legal review.

Legal copy must be reviewed by a qualified owner before publication. This spec is technical
planning, not legal advice.

## 17. Implementation phases

### Phase 1: Policy, consent, and cleanup plan

- Implement route classification as a pure helper with unit tests.
- Define consent categories and storage shape.
- Implement internal traffic exclusion rules.
- Prepare legal/documentation updates.
- Remove or gate broad GA/dashboard analytics contamination.

### Phase 2: First-party event contract

- Add migrations for `visitor_sessions` and `tracking_events`.
- Add server-side event ingestion API with validation and rate limits.
- Add a controlled `dataLayer`-compatible helper.
- Add basic engagement tracking for commercial routes with throttled/bucketed events.

### Phase 3: Landing instrumentation and lead creation

- Instrument landing sections, pricing/package views, CTA clicks, WhatsApp clicks, and contact form
  start/success.
- Generate a `lead_code` for WhatsApp flows so campaign to CTA to lead can be reconciled.
- Enhance `/api/contact` to create or deduplicate leads before sending email.

### Phase 4: Commercial dashboard MVP

- Add `/dashboard/commercial` under existing dashboard protection.
- Show overview, traffic, engagement, CTAs, demos, and leads.
- Keep order/payment sections minimal or hidden until lifecycle data exists.

### Phase 5: GA4 clean implementation

- Add route-gated, consent-gated GA4 loading.
- Map approved first-party events to GA4.
- Validate in GA4 DebugView.
- Confirm no PII is sent.

### Phase 6: Meta Pixel clean implementation

- Add route-gated, consent-gated Pixel loading.
- Emit only `PageView`, `ViewContent`, `Contact`, and `Lead`.
- Verify no Meta scripts or events fire on excluded routes.

### Phase 7: Orders, production, and payment tracking

- Add `orders` lifecycle support.
- Record `production_authorized`, `production_started`, `preview_delivered`, `payment_pending`,
  `payment_received`, `converted_to_demo`, and `lost`.
- Connect lead to invitation and future payment status.

### Phase 8: Future Meta CAPI/offline conversions

- Add `meta_event_deliveries`.
- Implement CAPI/offline conversion delivery only for allowed events.
- Send `Purchase` only after `payment_received`.

## 18. Acceptance criteria

- No production code is implemented by this documentation pass.
- No migrations or database changes are created by this documentation pass.
- The spec clearly distinguishes current state from future planned work.
- Future implementation has a clear route policy and consent policy.
- No Meta or marketing tracking is allowed on real invitations, personalized invite links, RSVP
  routes, dashboard/admin/auth routes, API routes, local development, or Vercel Preview by default.
- Internal traffic can be excluded before events reach internal tracking or third parties.
- GA4 events are intentional and PII-safe.
- Meta events are intentional and do not include fake purchases.
- `production_authorized` is documented as commitment, not payment.
- `payment_received` is the only future basis for Meta `Purchase`.
- Dashboard metrics connect traffic and engagement to lead, production, and payment outcomes.
- The plan remains incremental and does not require an analytics warehouse in the MVP.

## 19. Validation plan

For this documentation pass:

- Inspect the generated spec for all required sections.
- Run `pnpm ops check-links` because the spec references active docs.
- Run `pnpm agent:git-safety:check`.
- Run `pnpm agent:git-safety:end`.
- Report `git status --short`.
- Do not run build, type-check, or lint unless code-facing contracts are changed.

For future implementation:

- Add unit tests for route policy and consent gating.
- Verify no marketing scripts load on disabled routes.
- Verify no events fire in Vercel Preview unless explicitly in test mode.
- Verify no PII is sent to GA4 or Meta.
- Verify dashboard routes do not load marketing tags.
- Verify WhatsApp `lead_code` can connect campaign to CTA to lead.
- Verify form success creates a lead only once.
- Verify scroll and engagement tracking is bucketed and throttled.
- Use browser checks for landing, demo, real invitation, personalized invite, RSVP, dashboard, auth,
  API, local, and preview route classes.

## 20. Rollback notes

For this documentation pass, rollback is deleting
`.agent/plans/active/commercial-analytics-attribution-dashboard.spec.md`.

For future implementation phases:

- Keep each phase independently deployable.
- Gate new tracking behind environment variables and route policy.
- If marketing tracking misfires, disable Pixel/GA/GTM loading by environment flag first, then
  revert code if needed.
- Migrations must be additive and reversible through reviewed corrective migrations, not production
  rewrites.
- Dashboard changes should be isolated to `/dashboard/commercial` and removable without affecting
  RSVP or invitation production flows.

## 21. Risks and trade-offs

- Broad current GA injection may already have contaminated historical GA data with dashboard, demo,
  real invitation, or guest traffic.
- Vercel Web Analytics may remain useful for performance and high-level traffic, but it must be
  documented separately from first-party business attribution.
- Consent UX adds friction, but marketing tags without consent create legal and trust risk.
- A lean first-party event model is less powerful than a warehouse, but it is easier to maintain and
  safer for the MVP.
- WhatsApp attribution can never be perfect because conversation and payment happen outside the
  site, so `lead_code` reconciliation should be treated as best-effort.
- Future payment and purchase mapping requires operational discipline: only confirmed
  `payment_received` should generate purchase-like events.

## 22. Open questions

- Which consent UI pattern should be used for Mexico-focused visitors: banner, compact preference
  panel, footer link, or another reviewed pattern?
- What retention periods should apply to anonymous sessions, tracking events, leads, orders, and
  guest RSVP data?
- Should GA4 remain installed directly or be loaded through GTM after the controlled data layer
  exists?
- Should the post-MVP lead lifecycle add `in_production`, `preview_delivered`, and
  `payment_pending`, or should those remain order-level statuses?
- Who is the legal reviewer for privacy, cookies, remarketing, and payment workflow copy?
- Should Vercel Web Analytics remain enabled globally after route-policy implementation, or should
  it be narrowed/disabled to avoid parallel metrics confusion?
