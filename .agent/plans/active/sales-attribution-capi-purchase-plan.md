---
title: Sales Attribution CAPI Purchase Plan
status: draft
type: documentation
created: 2026-07-08
updated: 2026-07-08
autonomy: 'Level 1 - Documentation changes only'
related_skills:
  - backend-engineering
  - supabase
  - supabase-postgres
related_docs:
  - docs/domains/tracking/commercial-attribution.md
  - .agent/plans/active/commercial-analytics-attribution-dashboard.spec.md
  - .agent/rules/database.md
---

# Sales Attribution CAPI Purchase Plan

## 1. Current State Findings

Celebra-me already has a first-party commercial tracking foundation. The browser tracking module
creates `visitor_id` in `localStorage`, `session_id` in `sessionStorage`, captures `utm_source`,
`utm_medium`, and `utm_campaign`, and posts sanitized events to `/api/tracking/events`.

`lead_code` exists today. `src/lib/tracking/lead-code.ts` generates short `CM-XXXXXX` codes, while
`src/lib/tracking/client.ts` assigns them to WhatsApp clicks and hidden contact-form fields.
WhatsApp CTAs are rewritten client-side to include a human-readable `Folio: CM-899-XXXX` in the
message. The tracking event itself carries the stable `lead_code`; the folio is useful for manual
conversation context but is not the database unique key.

The current Meta Pixel map is browser-only and consent-gated:

- `page_viewed` -> `PageView`
- `demo_viewed` -> `ViewContent`
- `package_viewed` -> `ViewContent`
- `whatsapp_contact_clicked` -> `Contact`
- `form_submitted` -> `Lead`

`lead_code` is used as Meta browser `eventID` for `Contact` and `Lead` when present. That is stable
enough for current browser-side lead/contact deduplication, but it should not be reused as the
future `Purchase` `event_id`; purchases need an order/payment-specific idempotency key.

The current server-side commercial storage is:

- `visitor_sessions`: anonymous session attribution, landing path, referrer, UTM values, route
  class, consent snapshot.
- `tracking_events`: append-only PII-safe commercial event stream with allowlisted
  `event_properties`.
- `leads`: commercial lead records keyed by `lead_code`, with channel, status, optional name, email,
  phone, event type, package interest, message summary, UTM values, and consent flags.

WhatsApp clicks with `lead_code` already auto-create `leads` through tracking ingestion. Contact
form submissions also create or deduplicate leads and store richer identity details. The current
commercial dashboard is read-only; it summarizes sessions, events, leads, consent quality, and
recent leads. There is no customer table, order table, payment source of truth, or Meta CAPI outbox.

Captured today:

- `lead_code`: yes, generated in the browser and persisted in `leads.lead_code`.
- UTM source/medium/campaign: yes, in sessions, events, and leads.
- Landing URL/path: yes, as `visitor_sessions.landing_path`; full landing URL is not stored.
- Referrer: yes, from request header into `visitor_sessions.referrer`.
- Source area, package, event type: yes, when supplied as safe event properties.
- `fbp`, `fbc`, `fbclid`: not currently captured or stored.
- Customer identity for WhatsApp-only leads: not captured until manual reconciliation.
- Confirmed sale/payment status: not implemented.

Current dashboard roles are simple: `AppUserRole` is `super_admin | host_client`. The commercial
dashboard page already redirects non-super-admin users, and dashboard navigation marks
`/dashboard/commercial` as admin-only. Future sales APIs should follow the existing admin mutation
pattern with strong admin auth instead of inventing a separate sales role in the MVP.

## 2. Gaps and Risks

The main gap is not tracking; it is sales truth. Today `leads.status` includes future lifecycle
states such as `production_authorized` and `paid`, and `tracking_events` reserves
`payment_received`, but no authoritative order/payment workflow emits them.

Key risks:

- Sending `Purchase` from `leads.status = paid` alone would be fragile because there is no order,
  payment amount, or payment timestamp source of truth.
- WhatsApp-only leads may have no name, phone, or email in the database, so manual sales need a
  reconciliation step before order creation.
- Current phone utilities are designed for guest/RSVP flows and 10-digit national numbers with
  country codes. They can inform sales matching, but commercial identity should get an explicit
  utility and tests rather than importing guest import behavior.
- `lead_code` collisions are unlikely but possible; the database unique constraint protects writes,
  but UI should surface conflicts cleanly.
- `fbp`/`fbc` absence reduces Meta match quality for future CAPI. Capturing them should be done only
  in first-party commercial session storage, not in public UI or third-party payload logs.
- Raw customer phone/email are sensitive. If used for Meta matching later, they must be normalized,
  hashed server-side as required by Meta, and never exposed via `PUBLIC_*` variables or browser
  payloads.

## 3. Recommended Architecture

Keep the architecture minimal and additive:

```text
Commercial visit
-> Meta attribution capture readiness (fbp/fbc/fbclid on commercial surfaces only)
-> tracking_events + visitor_sessions
-> WhatsApp/contact lead with lead_code
-> manual customer reconciliation
-> sales_order created by admin
-> first real deposit_paid transition
-> one meta_conversion_events outbox row
-> server-only CAPI sender later
```

Do not turn the commercial dashboard into a CRM. Add a small sales workspace under the existing
dashboard protection, backed by server-only services and repositories:

- `src/pages/dashboard/commercial/sales.astro` or a section inside the existing commercial route.
- `src/pages/api/dashboard/commercial/*` for authenticated admin actions.
- `src/lib/commercial/customers.service.ts` and repository files for identity matching.
- `src/lib/commercial/orders.service.ts` for order creation and payment transitions.
- `src/lib/commercial/meta-conversions.service.ts` later, server-only, for CAPI payload creation and
  outbox delivery.

The browser should continue to send only PII-safe tracking events. Admin APIs may read/write PII
behind dashboard auth and service-role repository calls. CAPI should be triggered from server-side
order/payment transitions, not from browser tracking.

The first operational goal is deliberately small:

```text
Identify the customer
-> connect the lead
-> register the order
-> mark real payment
-> enqueue one idempotent Purchase event
```

### Phase 0: Meta Attribution Capture Readiness

Before customer/order work, add a narrow attribution-capture phase for Meta click/session matching:

- Capture `fbclid` from the landing URL query string on commercial acquisition surfaces.
- Capture `_fbp` and `_fbc` cookie values when present after the user reaches an eligible commercial
  surface. If `_fbc` is absent but `fbclid` is present, derive the stored `fbc` value in the
  conventional server-side shape during ingestion rather than exposing more browser state than
  necessary.
- Persist these values only for commercial sessions and leads, so future CAPI can use them
  server-side.

Eligible surfaces:

- Landing page.
- Demo/showroom routes that route policy classifies as commercial/demo and Meta-eligible.
- Pricing/package sections.
- Commercial contact form and WhatsApp CTA flows.

Explicitly excluded:

- Real client invitations.
- Personalized invitation links.
- RSVP routes and guest activity.
- Dashboard/admin activity.
- Auth routes.
- Generic APIs.

Likely storage based on the current repo:

- `visitor_sessions`: add nullable `fbp`, `fbc`, and `fbclid` columns so the session keeps the
  acquisition context.
- `tracking_events`: allowlist these only if needed for specific safe commercial events. Prefer
  session-level storage to avoid high-cardinality event payload sprawl.
- `leads`: copy `fbp`, `fbc`, and `fbclid` from the originating session when a lead is created or
  deduplicated, preserving attribution even if session rows are later retained for a shorter period.

Privacy boundaries:

- Do not expose these values in public UI.
- Do not log them unnecessarily.
- Do not send them from invitation guest routes.
- Do not add them to dashboard-visible tables unless needed for diagnostics, and then mask by
  default.
- Keep all future CAPI use server-side.

## 4. Proposed Data Model

Use additive tables. Do not migrate in this pass.

### Phase 0 additions to existing tables

Purpose: preserve Meta attribution identifiers for future server-side matching without expanding
tracking onto guest or admin surfaces.

Additive fields to consider:

- `visitor_sessions.fbp text null`
- `visitor_sessions.fbc text null`
- `visitor_sessions.fbclid text null`
- `leads.fbp text null`
- `leads.fbc text null`
- `leads.fbclid text null`

`tracking_events.event_properties` should only receive these values if a future implementation has a
specific diagnostic need and updates the safe-property allowlist deliberately. The default plan is
session-level capture plus lead-level copy.

### `customers`

Purpose: canonical commercial customer identity, separate from RSVP guests.

Essential fields:

- `id uuid primary key default gen_random_uuid()`
- `display_name text not null`
- `email text null`
- `phone_country_code text null`
- `phone_national text null`
- `phone_e164 text null`
- `normalized_email text null`
- `created_from_lead_id uuid null references leads(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- Unique partial index on `lower(normalized_email)` where not null.
- Unique partial index on `phone_e164` where not null.

Privacy: contains customer PII. Service-role only for API writes; dashboard read access must remain
behind existing auth/admin checks. Do not mix with guest RSVP identity.

### `commercial_leads`

Recommendation: do not create this as a separate table in the first implementation. The existing
`leads` table already performs this role. Extend it only if needed.

Minimal additive fields to consider on `leads`:

- `customer_id uuid null references customers(id)`
- `phone_country_code text null`
- `phone_national text null`
- `phone_e164 text null`
- `landing_path text null` only if joining through `session_id` is not enough.
- `fbp text null`, copied from the originating commercial session when available.
- `fbc text null`, copied from the originating commercial session when available.
- `fbclid text null`, copied from the originating commercial session when available.

Keep `message_summary`; do not store raw WhatsApp transcript text.

### `sales_orders`

Purpose: source of truth for manual commercial orders and payment state.

Essential fields:

- `id uuid primary key default gen_random_uuid()`
- `order_number text not null unique`
- `customer_id uuid not null references customers(id)`
- `lead_id uuid null references leads(id)`
- `session_id uuid null references visitor_sessions(id) on delete set null`
- `source_event_id uuid null references tracking_events(id) on delete set null`
- `status text not null check (status in ('draft','quoted','confirmed','deposit_paid','paid','cancelled','lost'))`
- `event_type text not null`
- `package_id text null`
- `package_name text null`
- `currency text not null default 'MXN'`
- `total_amount numeric(12,2) not null check (total_amount >= 0)`
- `deposit_amount numeric(12,2) null check (deposit_amount >= 0)`
- `amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0)`
- `confirmed_at timestamptz null`
- `deposit_paid_at timestamptz null`
- `paid_at timestamptz null`
- `created_by uuid null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- `(customer_id, created_at desc)`
- `(lead_id)` where `lead_id is not null`
- `(status, created_at desc)`

The order, not the lead, should own the purchase event trigger.

### `meta_conversion_events`

Purpose: outbox and idempotency ledger for future CAPI delivery.

Essential fields:

- `id uuid primary key default gen_random_uuid()`
- `order_id uuid not null references sales_orders(id)`
- `lead_id uuid null references leads(id)`
- `customer_id uuid not null references customers(id)`
- `event_name text not null check (event_name in ('Purchase'))`
- `event_id text not null unique`
- `trigger_status text not null check (trigger_status in ('deposit_paid'))`
- `value numeric(12,2) not null check (value >= 0)`
- `currency text not null default 'MXN'`
- `payload_hash text null`
- `status text not null default 'pending' check (status in ('pending','sending','sent','failed','skipped'))`
- `attempt_count integer not null default 0`
- `last_error_code text null`
- `last_error_message text null`
- `next_attempt_at timestamptz null`
- `sent_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Do not store raw CAPI payloads if they contain hashed customer identifiers. Store delivery status,
error summaries, and a payload hash for diagnostics.

## 5. Customer Identification Strategy

Recommended matching hierarchy for manual order registration:

1. `lead_code` exact match. This is the preferred path from WhatsApp folio/contact form to lead.
2. Normalized WhatsApp phone. Store `phone_e164` for commercial customers and leads.
3. Email exact match after lowercase/trim normalization.
4. Recent lead suggestions filtered by event type, package, channel, UTM/source, and creation date.
5. Manual search by name as a last-mile helper only.

Name must not be the primary identifier. It is useful for display and manual search, but it is too
ambiguous for attribution.

Phone normalization first version:

- Put commercial normalization in `src/lib/commercial/phone.ts` or extract a reusable
  `src/lib/phone/normalize.ts`.
- Accept the current supported country codes (`+52`, `+1`, `+34`) and default admin input to `+52`.
- Normalize to `{ countryCode, nationalNumber, e164 }`.
- Require exactly 10 national digits for the first version, matching existing guest utilities.
- Keep validation messages Spanish in UI/API responses; keep function names and comments English.

## 6. Proposed Admin Flow

Smallest useful sales admin MVP:

1. Search by `lead_code`, phone, or email.
2. Show matched lead/customer candidates with attribution context: channel, campaign, source area,
   event type, package interest, created date.
3. Select an existing customer or create a new customer from lead/form data.
4. Create an order with event type, package, total value, currency, and optional deposit amount.
5. Keep initial order status as `quoted` or `confirmed`; do not send Meta events.
6. Mark `deposit_paid` or `paid` only after real payment/anticipo is confirmed.
7. Create a `meta_conversion_events` pending row only from that payment transition.

UI needed now:

- Sales search/create screen.
- Customer/lead match panel.
- Create order modal/form.
- Order detail/status transition controls.
- Minimal conversion delivery status badge later.

Can wait:

- Full pipeline Kanban.
- Sales rep assignment.
- Message history.
- Automated WhatsApp sync.
- Revenue dashboards beyond basic order totals.
- Meta diagnostics UI beyond pending/sent/failed.

### Initial Dashboard Role Assumptions

MVP assumption: only existing `super_admin` dashboard users can create customers, create sales
orders, mark `deposit_paid`, mark `paid`, and retry Meta conversion delivery later.

Reasons:

- The current repo only distinguishes `super_admin` and `host_client`.
- `/dashboard/commercial` is already presented as admin-only and the page redirects non-super-admin
  sessions.
- Payment and conversion actions are global commercial operations, not per-event guest operations.

Implementation implication for the future pass:

- Read-only commercial sales pages should use `requireAdminDashboardSessionFromLocals()`.
- Mutating sales APIs should use the existing `requireAdminMutationAccess()` /
  `requireAdminStrongSession()` pattern with CSRF validation and admin rate limits.
- Do not introduce granular sales roles until the product needs non-admin staff access.

## 7. Purchase Trigger Rule

First-version policy:

- Trigger: first real transition to `deposit_paid`.
- Value: actual paid amount at that moment.
- Currency: `MXN`.
- No second `Purchase` when the order later becomes `paid`.

Why:

- `deposit_paid` is the first reliable paid commitment in Celebra-me's WhatsApp/manual sales
  process.
- Actual paid amount is more conservative and auditable than total order value.
- Sending another `Purchase` on final `paid` would duplicate conversion reporting unless a separate
  future strategy is designed.

`Purchase` must never be triggered by:

- `Contact`.
- `Lead`.
- WhatsApp click.
- Form submission.
- `quoted`.
- `confirmed` without payment.
- `production_authorized`.

Idempotency:

- Generate `event_id` from order and trigger, for example `purchase:${order_id}:deposit_paid`.
- Unique index `meta_conversion_events.event_id`.
- Payment transition should be transactionally idempotent: repeated admin clicks return the same
  existing outbox row.
- Later `paid` transitions should update the order's internal state and amounts, but must not
  enqueue another `Purchase` for the same order in the first version.

## 8. Meta CAPI Integration Plan

Do not implement CAPI until order/payment transitions exist.

Future server-only files:

- `src/lib/commercial/meta-capi/client.ts`
- `src/lib/commercial/meta-capi/payload.ts`
- `src/lib/commercial/meta-capi/outbox.repository.ts`
- `src/pages/api/dashboard/commercial/meta-conversions/retry.ts` for manual admin retry, if needed.

Required env vars:

- `META_CAPI_ACCESS_TOKEN` server-only.
- `META_PIXEL_ID` server-only or shared carefully with existing `PUBLIC_META_PIXEL_ID` only if the
  same pixel id is intentionally public.
- `META_TEST_EVENT_CODE` server-only, optional for test mode.
- No CAPI token may use `PUBLIC_`.

Payload shape for `Purchase`:

- `event_name`: `Purchase`
- `event_time`: Unix timestamp from `deposit_paid_at`
- `event_id`: stable order deposit idempotency key
- `action_source`: `website`
- `event_source_url`: commercial landing or lead route when available, not invitation guest URLs
- `custom_data`: `{ value: actualDepositPaidAmount, currency: 'MXN' }`
- `user_data`: server-side matching fields only, such as `fbp`, `fbc`, and normalized hashed email
  or phone if approved and implemented according to Meta requirements

Retry strategy:

- Insert pending outbox row during payment transition.
- Sender marks `sending`, calls Meta, then marks `sent` with `sent_at` or `failed` with error
  summary.
- Retry failed rows with bounded attempts and `next_attempt_at`.
- On Vercel serverless, do not rely on long-running background work after response. Either send
  synchronously after the transaction with a short timeout, expose an authenticated retry endpoint,
  or schedule a Vercel Cron worker for pending rows.

## 9. Privacy and Meta Payload Boundaries

Never send these to Meta:

- Private guest data.
- RSVP responses, attendance status, guest comments, guest phone/email/name.
- Invitation recipient details.
- Personalized invitation tokens, claim codes, invite IDs, or short IDs.
- Sensitive event notes, family notes, raw messages, or WhatsApp conversation text.
- Dashboard/admin user activity.

Customer phone/email, if used for matching, must be normalized and handled server-side according to
Meta CAPI requirements. They should not be placed in browser event payloads, public env vars, logs,
or stored raw in `meta_conversion_events` payload copies.

## 10. Testing Plan

Planning-only validation for this pass:

- `git status --short`
- `pnpm agent:git-safety:check`
- `pnpm agent:git-safety:end`

Future implementation tests:

- Unit tests for `fbp`, `fbc`, and `fbclid` capture/read helpers, including route exclusions.
- Unit tests for commercial phone normalization and identity matching order.
- Repository/service tests for lead exact match, phone match, email match, recent suggestion, and
  manual customer creation.
- Order service tests for allowed status transitions and blocked duplicate payment transitions.
- Database migration tests for RLS enabled, service-role policies, constraints, indexes, and unique
  `event_id`.
- CAPI payload tests verifying no guest/RSVP fields or raw PII are included.
- Outbox idempotency tests proving repeated `deposit_paid` does not enqueue duplicate `Purchase`.
- API tests for dashboard auth and superadmin/admin authorization.
- Meta sender tests with mocked fetch for success, failure, retry, and timeout behavior.

## 11. Rollout Phases

Phase 0: Meta attribution capture readiness

- Capture and persist `fbp`, `fbc`, and `fbclid` for commercial attribution only.
- Add storage on `visitor_sessions` and copy to `leads` when leads are created/deduplicated.
- Verify excluded route classes never capture or forward these values.

Phase 1: Customer identity and lead reconciliation

- Add commercial phone normalization.
- Add `customers`.
- Extend `leads` with `customer_id` and normalized phone fields if needed.
- Build admin search and customer creation.

Phase 2: Manual orders

- Add `sales_orders`.
- Create order API and minimal admin UI.
- Keep statuses internal. No CAPI.

Phase 3: Payment transition source of truth

- Add `deposit_paid`/`paid` transition service.
- Record payment timestamps and amounts.
- Emit internal `payment_received` tracking event only from the authoritative transition.

Phase 4: Meta outbox

- Add `meta_conversion_events`.
- Enqueue pending `Purchase` rows idempotently from payment transitions.
- Still do not send to Meta until payload review is complete.

Phase 5: CAPI sender

- Add server-only Meta client.
- Send test events with `META_TEST_EVENT_CODE`.
- Verify Events Manager diagnostics.
- Enable production delivery only after owner approval.

Explicit implementation order:

1. `fbp` / `fbc` / `fbclid` capture for commercial attribution.
2. Commercial phone normalization.
3. `customers`.
4. Lead/customer reconciliation.
5. `sales_orders`.
6. Payment transition service.
7. `meta_conversion_events` outbox.
8. CAPI sender.

Non-CRM boundaries for all phases:

- No Kanban pipeline.
- No sales rep assignment.
- No conversation history.
- No WhatsApp sync.
- No revenue dashboards.
- No advanced reporting.

## 12. Open Questions Blocking Implementation

- What exact package ids/names and price fields should be canonical for sales orders?
- Are customer email and phone approved for server-side hashed Meta matching, or should first CAPI
  use only `fbp`/`fbc` plus attribution context?
- What is the retention policy for `customers`, `leads`, `sales_orders`, and conversion delivery
  logs?
- Should `fbp`, `fbc`, and `fbclid` use the same retention period as commercial sessions, or be
  retained longer when copied onto leads/orders?
- Is the MVP `super_admin`-only sales role model acceptable, or does the owner need a non-admin
  sales operator role before implementation starts?
