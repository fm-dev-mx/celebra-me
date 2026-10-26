# Commercial Attribution

## Purpose

Celebra-me uses first-party deterministic attribution to connect anonymous commercial traffic to
identifiable leads. Attribution is resolved server-side through the tracking ingestion pipeline and
contact form API. No third-party cookies are used.

## Mexico consent

Consent follows Mexico ARCO practice. Categories: `necessary` (always on), `analytics` (gates GA4),
`marketing` (gates Meta Pixel and any GTM marketing tags). Default before user choice: analytics and
marketing off. Analytics and marketing consent can be withdrawn at any time.

## GA4 vs GTM ownership

First-party tracking is the source of truth. GA4 is behavioral analytics and is loaded directly, not
through GTM. Meta Pixel is ad optimisation only. GTM is not activated; if added later it must not
bypass app route policy or consent policy.

## Retention

- Commercial analytics (`tracking_events`, `visitor_sessions`): 13 months. The daily engagement
  maintenance cron (`43 10 * * *`, `src/lib/server/scheduled-jobs.ts`) calls
  `public.purge_commercial_analytics` in batches of 5,000 rows (at most 20 batches per run) and logs
  the deleted counts as `[commercial][retention] completed`. The rule lives only in
  `public.commercial_analytics_retention_cutoff`: on 2027-11-24 the events of 2026-10-23 and earlier
  are deleted. Sessions go once they are past retention and no event, lead or order references them;
  events and sessions that a lead or an order references are kept, so the purge never rewrites
  `leads`, `customers`, `sales_orders` or `meta_conversion_*`.
- Meta conversion outbox (`meta_conversion_events`): browser `PageView`, `ViewContent`, `Contact`
  and `Lead` rows, plus CRM `LeadQuoted`, `LeadPaid` and `LeadLost` rows, that are `sent` or
  `skipped` are deleted 30 days after `created_at` (their delivery attempts cascade). The
  quarter-hour Production cron (`*/15 * * * *`) calls `public.purge_meta_conversion_retention` after
  the outbox sweep, in batches of 500 rows (at most 4 batches per run), and logs
  `[meta-capi][retention] completed`; it runs even while delivery is disabled. The rule lives only
  in `public.meta_conversion_retention_cutoff`: on 2026-11-30 the rows created before 2026-10-31 go.
  `Purchase` rows (owned by a sales order), rows still `pending`, `sending`, `failed` or
  `ambiguous`, and rows an operator recovered are kept. Meta only accepts server events up to 7 days
  old and deduplicates within 48 hours, so 30 days covers every retry.
- Marketing withdrawals (`visitor_consent_withdrawals`): kept while any stored visitor session
  started on or before the withdrawal's `updated_at`; the same purge deletes a withdrawal once it is
  older than the oldest stored session. In practice that follows the 13-month session retention;
  with no stored session nothing is deleted.
- Marketing-audience retention: not established in this repository; requires an explicit privacy
  decision before being treated as a current contract.
- Contact/lead data: duration of the commercial relationship + 2 years

## Identifier Chain

```
visitor_id  →  session_id  →  lead
```

| Identifier   | Generated in                     | Stored in                                                               | Persistence     |
| ------------ | -------------------------------- | ----------------------------------------------------------------------- | --------------- |
| `visitor_id` | `client.ts` — `localStorage`     | `tracking_events.visitor_id`, `visitor_sessions.visitor_id`             | Device-lifetime |
| `session_id` | `client.ts` — `sessionStorage`   | `leads.session_id`, `tracking_events.session_id`, `visitor_sessions.id` | Tab lifetime    |
| `lead_code`  | `client.ts` — `CM-XXXXXX` format | `leads.lead_code` (unique)                                              | Persistent      |

### Attribution resolution

Visitor attribution is resolved through `visitor_sessions`:

```
leads.session_id → visitor_sessions.id → visitor_sessions.visitor_id
```

`leads` stores `session_id`, not `visitor_id` directly. `tracking_events` stores both `visitor_id`
and `session_id`.

## Lead Sources

### WhatsApp clicks

A `whatsapp_contact_clicked` tracking event carrying a non-empty `lead_code` in `event_properties`
triggers automatic lead creation during ingestion (`ingestion.service.ts`).

| Behaviour    | Detail                                                                       |
| ------------ | ---------------------------------------------------------------------------- |
| Channel      | `whatsapp`                                                                   |
| Status       | `new`                                                                        |
| Consent      | `consent_contact: true` (user initiated contact), `consent_marketing: false` |
| Name/contact | `null` initially — filled later through manual reconciliation                |
| Intent       | Early commercial intent, NOT a qualified lead, sale, or confirmed customer   |

The WhatsApp URL is rewritten client-side to embed the canonical `lead_code` (`CM-XXXXXX`) in the
message text. The visitor can quote it in the chat so the operator finds the lead in the CRM.

### Lead capture form («Aparta su fecha»)

WhatsApp CTAs on commercial and demo routes carry `data-lead-capture`. A click opens
`LeadCaptureDialog.astro` instead of WhatsApp (without JavaScript the CTA keeps its link). The
dialog offers two exits, both tracked WhatsApp links that copy the CTA's tracking attributes, so a
`Contact` is still counted once: `<cta>__ask` («Solo quiero preguntar», the CTA's own message) and
`<cta>__form` (after the form, with a prefilled message that ends in `Folio CM-XXXXXX`).

`POST /api/leads/capture` (`lead-capture.service.ts`) validates the form server-side (event type,
date from yesterday to three years ahead, name, Mexican or US WhatsApp number, approved demo slug)
and then:

- **Step:** Anti-bot
  - **Detail:** Honeypot field, a 2-second minimum fill time and automated user agents are answered
    201 without writes; 10 requests per IP per minute
- **Step:** Session
  - **Detail:** With analytics or marketing consent in Production: visitor session upsert and a
    `form_submitted` event whose ID is the Pixel `eventID`. The event carries no personal data
- **Step:** Lead
  - **Detail:** Channel `contact_form`, name, phone, `event_type`, `event_date`, `celebrant_names`,
    `demo_slug`, UTMs; Meta attribution and `consent_marketing` only with marketing consent. The
    browser's `lead_code` is kept only when its lead belongs to the same session
- **Step:** Customer
  - **Detail:** `createCommercialCustomer` creates or matches the customer by phone and links the
    lead
- **Step:** Meta
  - **Detail:** With marketing consent on a Meta-allowed route in Production: a `Lead` outbox row
    with the same event ID, `session_id`, `customer_id` and `lead_id`, so delivery adds the hashed
    phone

The browser fires the Pixel `Lead` with the same event ID but does not post `form_submitted` to
`/api/tracking`; the capture API already stored it. Outside Production the lead and customer are
stored without a session, tracking event or Meta row.

An order created from the dashboard without a session takes `lead_id` and `session_id` from the
given lead, or from the customer's latest lead (`findLeadOrderAttribution`), so the deposit
`Purchase` carries that visit's fbp/fbc.

## `lead_created` Event Rule

`lead_created` is a first-party tracking event fired server-side after lead persistence. It follows
a three-valued guard:

| `findLeadByCode()` returns | Behaviour                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Existing `StoredLead`      | Lead already exists. Do NOT emit `lead_created`. Return the existing lead.                                        |
| `null`                     | Confirmed new lead. Emit exactly one `lead_created`. Upsert the lead.                                             |
| Throws / lookup failure    | Preserve the operational upsert (lead capture is more important than event counting). Do NOT emit `lead_created`. |

This rule applies to WhatsApp click leads, the only public lead source since the landing contact
form was removed. Older rows may still carry `lead_channel=contact_form`.

The `lead_created` event carries:

- `lead_code` — the stable attribution code
- `lead_channel` — the click channel, for example `whatsapp`
- `routePath` — `/api/tracking/events`
- `consentSnapshot` — `{ necessary: true, analytics: false, marketing: false }`

## GA4 Status

`generate_lead` is **not active** in the current implementation.

- `lead_created` is emitted **server-side** only.
- The GA4 forwarder (`ga4-forwarder.ts`) runs **client-side** via `gtag('event', ...)`.
- These two boundaries do not meet. The mapping is commented out with an explanation.

Future options to enable `generate_lead`:

- Dispatch `lead_created` client-side (requires adding it to the client tracking pipeline)
- Implement server-side GA4 Measurement Protocol to forward from the API route directly

Verification: `tests/unit/ga4-forwarder.test.ts` pins the `gtag` command shape (native `Arguments`,
`send_page_view: false`, exactly one `page_view`) in jsdom. `pnpm test:e2e:ga4` repeats both consent
scenarios in a real browser against a production-mode server on port 4340, through the consent
banner and the `gtag` loader. Run it when `src/lib/tracking/**` or the consent banner changes.

## Exclusions

The following are explicitly excluded from commercial attribution:

- RSVP guest records and tracking
- Personalized invitation routes
- Real (published) invitation routes
- Dashboard admin auth
- Consent banner UI
- Meta Pixel behaviour (forwarding decisions are orthogonal to attribution)
- Public browser writes to administrative demo milestones

Route exclusion is enforced by `route-policy.ts`. See `docs/domains/rsvp/architecture.md` for the
separate guest tracking mechanism.

## Meta Event Architecture

Meta Pixel remains a downstream consumer of the first-party tracking contract. The browser-safe
configuration lives behind `PUBLIC_META_PIXEL_ID` and `PUBLIC_META_PIXEL_ENABLED`; no server-only
secrets are exposed client-side.

### Browser-side event map

| First-party event          | Meta event    | When it fires                                                        | Metadata sent                                                                              | Dedup key                 |
| -------------------------- | ------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------- |
| `page_viewed`              | `PageView`    | Commercial/demo page load after marketing consent                    | `content_category=page`, optional `content_name`, `source_area`                            | —                         |
| `demo_viewed`              | `ViewContent` | Demo page load on real showroom/demo routes                          | `content_name`, `content_category=demo`, `event_type`, `source_area`                       | —                         |
| `package_viewed`           | `ViewContent` | Pricing/package card becomes visible on the landing page             | `content_name`, `content_category=package`, `source_area`                                  | —                         |
| `whatsapp_contact_clicked` | `Contact`     | Commercial WhatsApp CTA click; then the custom `WhatsAppClick` copy  | `content_name`, `content_category`, optional `event_type`, `source_area`                   | Technical `event_id` UUID |
| `form_submitted`           | `Lead`        | No live emitter since the contact form was removed; kept for history | `content_name=contact`, `content_category=lead_form`, optional `event_type`, `source_area` | Technical `event_id` UUID |

Notes:

- Meta payloads intentionally exclude guest identity, RSVP data, names, email, phone, free-text
  messages, invite tokens, and claim codes.
- Browser `eventID` uses only the per-activation technical UUID. Consultation codes are never sent
  to GA4, Meta, or the public data layer. Server Purchase IDs remain unchanged.
- `Contact` is the conversion ads optimize for (owner decision of 2026-10-24). The custom
  `WhatsAppClick` copy carries the same parameters and `eventID`, so custom conversions built on it
  keep counting; Meta deduplicates by event name plus ID, so the two never merge.
- Pixel loading stays route-gated and consent-gated through `route-policy.ts`, `consent-client.ts`,
  and `meta-pixel.ts`.

### Guest-route isolation

Commercial Meta events do **not** run on:

- real invitation routes such as `/xv/<slug>` when the slug is a real invitation,
- personalized invitation links such as `/i/<token>` or `?invite=...`,
- RSVP guest APIs,
- dashboard/auth routes,
- generic API routes,
- preview/local environments.

This isolation is enforced by `classifyTrackingRoute()` and prevents ordinary invitation-guest
activity from contaminating acquisition data.

## Conversions API (CAPI) and Sales Workspace

The Conversions API (CAPI) reports confirmed `Purchase` events and mirrors the browser `PageView`,
`ViewContent` (demo or package view), `Contact` (WhatsApp click) and `Lead` (form submission) events
server-side, so ad blockers and iOS do not lose them. It is supported by an interactive
administration workspace under `/dashboard/commercial` (under the "Espacio de Ventas" tab) for super
admins.

### Architecture Flow

```
1. Admin marks Order Deposit Paid
   → calls markCommercialOrderDepositPaid() in orders.service.ts
2. Ledger Row Inserted
   → upsertMetaConversionEvent() creates a 'pending' Purchase row in meta_conversion_events
3. Asynchronous Dispatch
   → deliverMetaConversionEvent() is fired in the background with a timeout
4. Meta Graph API Delivery
   → Hashes email/phone (digits-only E.164 without leading '+') via SHA-256
   → Adds fbp/fbc, the session client IP and user agent (unhashed, as Meta requires) and a
     SHA-256 external_id (session visitor_id, else customer_id)
   → Sets action_source=chat: the deposit is agreed over WhatsApp and registered in the dashboard
   → Enforces route safety on event_source_url (fallback to homepage if guest path)
   → Dispatches POST to Graph API v26.0 with the access token in the JSON body, never in the URL
5. Status Update
   → Updates ledger status: 'pending' → 'sending' → 'sent' or 'failed' / 'skipped'
```

### Browser PageView, ViewContent, Contact and Lead events

1. Tracking ingestion accepts `page_viewed` (`PageView`), `demo_viewed` or `package_viewed`
   (`ViewContent`), `whatsapp_contact_clicked` (`Contact`) or `form_submitted` (`Lead`) and, only on
   the Production deploy identity, on a Meta-allowed route and with marketing consent, calls
   `enqueueBrowserConversionEvent()` with the first-party event as `trigger`. It inserts a `pending`
   row with that trigger as `trigger_status` and `event_id` set to the tracking event UUID, the same
   value the Pixel sends as `eventID`, so Meta deduplicates the two copies. A replayed event ID
   keeps the first row. A failed insert is logged and never rejects the tracking event.
2. Browser rows carry `session_id` (no foreign key, so the analytics purge stays free) and
   `event_source_path` instead of an order, customer and value (migrations
   `20261025120000_meta_conversion_contact_lead` and `20261026000000_meta_conversion_view_events`;
   the shape check pairs each event with its own triggers and keeps Purchase rows as strict as
   before). The late-consent `PageView` the Pixel sends after a page loaded without marketing
   consent has no `eventID` and no server copy, because that page's `page_viewed` was stored without
   marketing consent.
3. Delivery sends `action_source=website`, the click path as `event_source_url` (route policy still
   applies), the row creation time as `event_time`, and no `custom_data`. It skips with
   `CONSENT_REQUIRED` when the session's latest consent snapshot no longer grants marketing, and
   with `MISSING_CLIENT_USER_AGENT` when the session has no user agent, which Meta requires for
   website events. Withdrawing marketing consent in the banner posts the stored visitor ID to
   `POST /api/tracking/consent` (rate-limited, needs no tracking consent). The route calls
   `record_visitor_marketing_withdrawal`, which keeps the newest withdrawal per visitor in
   `visitor_consent_withdrawals` and turns marketing off on every stored session of that visitor, so
   rows still queued for those sessions are skipped. The banner keeps an unconfirmed withdrawal in
   localStorage and resends it on every page load until the server answers. Consent snapshots carry
   the visitor's decision time (`decidedAt`), and the
   `trg_visitor_sessions_keep_marketing_withdrawal` trigger (insert and update) keeps marketing off
   unless the snapshot carries a strictly newer decision, so a tracking request sent before the
   withdrawal cannot turn it back on, even for a session stored after the withdrawal.
4. The Production-only `*/15 * * * *` cron runs the platform usage collector and then
   `processPendingMetaConversionEvents()` (up to 20 due rows, oldest first, so at most 1,920 rows a
   day; one page view queues one `PageView` plus one `ViewContent` per demo page or package card
   seen). The sweep skips outside Production and while `META_CAPI_DELIVERY_MODE=disabled`, so rows
   stay `pending` instead of being marked `skipped`. A batch with failed or ambiguous deliveries
   fails the job (the rows are retried later). The dashboard «Filas sin pedido» check counts only
   Purchase rows.

### CRM lead-stage events

The commercial outbox also sends CRM stage events for existing lead milestones: `quote_sent` maps to
`LeadQuoted`, marking an order's deposit paid maps its linked lead to `LeadPaid`, and the `lost`
demo follow-up maps to `LeadLost`. The current app has no generic lead-status mutation endpoint, so
these events follow the existing quote, deposit-paid and loss actions. These rows use
`crm_lead_quoted`, `crm_lead_paid` or `crm_lead_lost` as `trigger_status`, have a stable `event_id`
per lead and stage, and carry `lead_id` without an order, customer, value or event source URL. The
existing foreign key clears `lead_id` if a lead is deleted, so pending outbox rows do not block that
deletion. The `custom_data` identifies `event_source=crm`, `lead_event_source=Celebra-me` and the
stage; `action_source` is `system_generated`.

The queue checks `leads.consent_marketing` before inserting. Delivery checks it again and, when the
lead has a session, also requires that session's latest marketing-consent snapshot. Only a
digits-only SHA-256 hash of the lead phone and the lead's stored `fbp`/`fbc` are sent as user data;
no email, raw phone, IP address or user agent is included. CRM stage rows use the outbox creation
time as `event_time`, do not include `event_source_url`, and follow the same retry lifecycle and
30-day terminal-row retention as browser events. In the current workspace, `paid` is emitted when
the deposit is registered; there is no separate full-payment transition API.

### Environment Variables

| Variable                  | Values / Purpose                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `META_CAPI_DELIVERY_MODE` | `disabled` (default), `test` (sends test payload), or `production` (live Graph API calls) |
| `META_CAPI_ACCESS_TOKEN`  | Meta Graph API access token                                                               |
| `META_PIXEL_ID`           | Meta Pixel Identifier (fallback to `PUBLIC_META_PIXEL_ID`)                                |
| `META_TEST_EVENT_CODE`    | Required in `test` mode to register events in Meta Events Manager                         |

### Match keys

The Pixel and CAPI send the same `external_id`: the SHA-256 hex of the first-party visitor ID
(`cm_visitor_id`, trimmed and lowercased). The Pixel passes it to `fbq('init', id, { external_id })`
with `autoConfig` off, so it is the only manual match key in the browser; it initializes without it
when no visitor ID is stored.

`visitor_sessions.client_ip_address` and `client_user_agent` (migration
`20261024180000_visitor_sessions_client_signals`) are written by tracking ingestion only when the
event carries marketing consent, keep their first value like the other first-touch columns, and
follow the 13-month commercial analytics retention. The IP comes from `getClientIp()`
(`CF-Connecting-IP` on Workers). The application that writes them needs the migration applied first,
because PostgREST rejects unknown columns on the session upsert. `/privacidad` discloses this
server-side send (owner decision d242): the signals stay 13 months with the visit, or as long as the
contact record when a lead or order still references the session, because
`purge_commercial_analytics` keeps referenced sessions.

### Route Privacy Policy

Meta Graph API events must never leak guest identity or invitation routes. The delivery service
parses the session's `landing_path` and verifies it using `classifyTrackingRoute()`:

- If the route has `metaAllowed: true` (e.g., `/`, `/privacidad`, `/demos/xv`), the CAPI payload
  sets `event_source_url` to the actual landing URL.
- Otherwise, it falls back to `https://www.celebra-me.com/` to protect guest anonymity.

### Sales Workspace Administration

Super admins can access the Workspace at `/dashboard/commercial` using the tab switcher. The
workspace enables:

1. **Search**: Find leads by code (`CM-XXXXXX`), phone, or email.
2. **Reconciliation**: Convert leads into `customers` with E.164 normalized details.
3. **Order Creation**: Register quoted or confirmed orders with event type, package, total amount
   (MXN), and optional suggested deposit amount.
4. **Order Display**: Each order card shows:
   - Order number (`CMO-YYYYMMDD-XXXXXX`)
   - Event type (human-readable label, e.g., "XV años")
   - Package name (when available)
   - Total amount, amount paid, and outstanding balance
   - Status badge (Confirmado, Cotizado, Anticipo Pagado, Totalmente Pagado, Cancelado, Perdido)
   - Deposit paid or fully paid timestamp when available
5. **Deposit Paid Transition**: Mark a confirmed/quoted order as `deposit_paid`. This is the only
   trigger for CAPI `Purchase` outbox events.
6. **CAPI Queue Control**: View CAPI outbox ledger logs (status, value, attempts, errors) and
   manually trigger batch processing or retry individual skipped/failed events.

### Order Status Semantics

| Status         | Meaning                                      | CAPI Purchase Triggered                              |
| -------------- | -------------------------------------------- | ---------------------------------------------------- |
| `draft`        | Preliminary order, not yet quoted            | No                                                   |
| `quoted`       | Quote sent to customer                       | No                                                   |
| `confirmed`    | Customer confirmed verbally or by WhatsApp   | No                                                   |
| `deposit_paid` | First real deposit/anticipo payment received | **Yes** — exactly one `Purchase` on first transition |
| `paid`         | Order fully paid                             | No (second Purchase is not created)                  |
| `cancelled`    | Order cancelled by admin                     | No (deposit_paid is rejected)                        |
| `lost`         | Deal lost to competitor or abandoned         | No (deposit_paid is rejected)                        |

**Invalid transitions**: `cancelled`, `lost`, and `draft` orders cannot be moved to `deposit_paid`.
If attempted, the service returns a controlled Spanish error message.

### Payment Semantics and CAPI Purchase Value

The `Purchase` value sent to Meta is always the **actual amount registered as paid** at the moment
`deposit_paid` is marked. It is:

- **Not** the order's `totalAmount` (which represents the full contract value).
- **Not** the `depositAmount` / "Anticipo Sugerido" (which is a suggested reference value stored at
  order creation).
- **Always** the explicit numeric value entered by the operator in the deposit payment field.

The operator enters the actual payment amount per-order at the time of marking `deposit_paid`. This
ensures the Meta Purchase event reflects real money received.

### CAPI Purchase Trigger Rules

1. **Only on `deposit_paid`**: The first real payment transition creates a `Purchase` outbox row.
2. **Idempotent**: Repeated `deposit_paid` calls for the same order return the existing outbox row
   without duplicating it.
3. **`paid` does not trigger Purchase**: Moving an order to fully paid status does not create a
   second `Purchase` event. The CAPI event is emitted only once on the first deposit payment.
4. **Event ID format**: `purchase:{orderId}:deposit_paid` — stable, deterministic, and used as the
   unique constraint key for idempotency.
5. **Currency**: Always `MXN`.
6. **Event Name**: Always `Purchase` for deposit rows (browser rows are `Contact` or `Lead`).
7. **Disabled mode**: When `META_CAPI_DELIVERY_MODE=disabled`, no Meta network request is made. The
   outbox status is set to `skipped` with a descriptive reason.

### Outbox Status Semantics

Each row in `meta_conversion_events` follows a strict lifecycle:

- **`pending` (Pendiente)**: The event is enqueued and waiting for background delivery or queue
  processing.
- **`sending` (Enviando...)**: Delivery is currently in progress.
- **`sent` (Enviado (CAPI))**: Delivery was successfully received by Meta Graph API.
- **`failed` (Error de Envío)**: Graph API rejected the event or a network error occurred. Employs
  exponential backoff before auto-retrying.
- **`skipped` (Ignorado (CAPI Desactivado))**: The event was skipped because
  `META_CAPI_DELIVERY_MODE` is set to `disabled`. The reason is preserved in `last_error_message`.
- **`ambiguous` (Entrega por confirmar)**: Meta may have accepted the event but local success
  persistence did not complete. This state is never retried automatically.

#### Manual Re-queuing / Retries

Recovery is a conditional server-side transition, not a resend shortcut. It requires a reason,
preserves `attempt_count`, records the actor and source state, and rejects terminal `sent`,
`pending`, active `sending`, and `skipped/CONSENT_REQUIRED` events. Recovery only returns the row to
`pending`; it does not synchronously deliver it.

#### Batch Processing

The **"Procesar Cola CAPI"** button queries due `pending` or `failed` events (up to 20 per batch).
`claim_meta_conversion_event` locks and rechecks the row, increments the attempt counter, assigns a
bounded lease, and inserts the immutable attempt record in one transaction. An empty result means
the event was ineligible or another worker owned it, so no Meta request is made. Retries always use
the existing stable `event_id`.

When `META_CAPI_DELIVERY_MODE=disabled`, all claimed events are marked as `skipped` without making
Meta network requests.

---

### Meta Events Manager Test-Mode Validation

To validate that your local/staging setup is correctly delivering conversion events without
contaminating production acquisition data:

1. **Obtain Test Event Code**: Log in to Meta Events Manager $\rightarrow$ Select your Pixel
   $\rightarrow$ Navigate to **Test Events** tab $\rightarrow$ Note the code displayed (e.g.
   `TEST12345`).
2. **Configure Environment Variables**:
   ```env
   META_CAPI_DELIVERY_MODE=test
   META_CAPI_ACCESS_TOKEN=<your_graph_api_token>
   META_PIXEL_ID=<your_pixel_id>
   META_TEST_EVENT_CODE=<test_event_code_from_step_1>
   ```
3. **Trigger Event**: In the Sales Workspace, register a sales order and mark its deposit paid.
4. **Verify in Events Manager**: Look at the **Test Events** dashboard in Meta Events Manager. You
   should see a `Purchase` event show up immediately with:
   - Event Source: `Server`
   - Event ID matching: `purchase:{orderId}:deposit_paid`
   - Custom Data: Value (anticipo amount) and Currency (`MXN`)
   - Hashed parameters corresponding to customer identity.

---

### Production Deployment Gate Checklist

Before enabling live production delivery, verify:

- [ ] `META_CAPI_DELIVERY_MODE` is explicitly set to `production` in the Production Worker.
- [ ] `META_CAPI_ACCESS_TOKEN` is configured securely as a serverless secret.
- [ ] `META_PIXEL_ID` matches your production pixel.
- [ ] `META_TEST_EVENT_CODE` is deleted/unset.
- [ ] Test mode has been validated without errors in Events Manager.

---

### Privacy & Data Restrictions (Never Send to Meta)

To maintain absolute guest privacy, the server-side payload client strictly isolates acquisition
data. The following data **must never** be passed to Meta under any circumstances:

- RSVP details, dietary preferences, or attendance responses.
- Personalized guest URLs, short tokens, or claim codes.
- Invitation guest names, email, phone numbers, or free-text messages.
- Dashboard admin auth sessions.

Only the first-party commercial customer's normalized, SHA-256 hashed identity is ever sent for
deduplication.

## Production-readiness state model

`META_CAPI_DELIVERY_MODE` must remain `test` until the owner completes the production-readiness
checklist below. Commercial success and Meta delivery are separate outcomes: registering an anticipo
commits the order and its stable Purchase outbox row atomically; delivery may remain pending or need
technical attention without undoing the commercial payment.

### Atomic deposit invariant

The server calls `register_commercial_deposit_purchase` with the order, actual amount, actor,
timestamp, and deposit idempotency key. The function locks the order and permits only
`quoted|confirmed -> deposit_paid`. A retry with the same key and amount returns the authoritative
order and conversion; a different amount or key conflicts. The transaction always creates or returns
exactly one `purchase:{orderId}:deposit_paid` row and never overwrites an existing conversion's
delivery state or history.

Order creation also carries a unique idempotency key. Repeating the same request returns the same
order; reusing the key for different commercial data is a conflict.

### Queue transitions and recovery

| Source                      | Normal action              | Destination                                 | Manual recovery                      |
| --------------------------- | -------------------------- | ------------------------------------------- | ------------------------------------ |
| `pending`                   | Claim when eligible        | `sending`                                   | Not allowed                          |
| due `failed`                | Claim when eligible        | `sending`                                   | Allowed with reason                  |
| active `sending`            | Complete provider attempt  | `sent`, `failed`, `skipped`, or `ambiguous` | Not allowed                          |
| stale `sending`             | Operator-reviewed recovery | `pending`                                   | Allowed after lease expiry           |
| `sent`                      | None                       | Terminal                                    | Never allowed                        |
| `skipped/CONSENT_REQUIRED`  | None                       | Terminal until consent policy review        | Not allowed                          |
| other allowlisted `skipped` | Operator-reviewed recovery | `pending`                                   | Allowed with reason                  |
| `ambiguous`                 | Owner-approved recovery    | `pending`                                   | Allowed with reason; never automatic |

Every claim increments `attempt_count` in the database and inserts an immutable attempt record.
Every completion is fenced by the event ID, `sending` state, and active `claim_id`; a zero-row
completion is a lost claim and never changes the event again. A successful completion clears the
claim ID and lease timestamps. Recovery never resets the counter and records actor, reason, source
state, destination state, and time. A Meta success followed by failure to persist `sent` is
`ambiguous`, not a normal network failure. Operators must inspect Meta Test Events and the stable
`event_id` before approving another attempt.

Successful responses may retain `events_received`, `fbtrace_id`, and a bounded provider message.
Tokens, raw identity, hashes, full payloads, URLs with tokens, and unrestricted provider responses
must not be logged or stored. Persisted provider errors are sanitized, redacted, and capped at 300
characters with a safe fallback message.

#### Legacy sending rows without lease metadata

Rows created before leases may be `sending` with `claim_expires_at IS NULL`. They are never selected
for automatic processing. An owner may manually recover one only with a reason and authenticated
actor; recovery records `sending_legacy_no_lease → pending`, preserves `attempt_count` and
`event_id`, and does not dispatch in the same operation. Active leased `sending` rows remain
protected.

#### Historical paid orders without Purchase

Technical diagnostics list `deposit_paid` or `paid` orders that lack the stable
`purchase:{order_id}:deposit_paid` outbox row. This is read-only evidence, never an automatic repair
or resend. The owner must decide, record by record, whether to preserve the historical gap, correct
the commercial record through a separately approved process, or document why no conversion should
exist. This remediation never chooses or executes that decision.

### Test/QA record classification

`commercial_record_classifications` records reversible `test_qa` classifications for leads,
customers, orders, and conversion events. Active classifications are excluded from commercial
lead/revenue metrics, including linked records through a classified lead, customer, or order.
Original records and CAPI delivery history remain unchanged and visible in technical diagnostics.

Owner procedure after deployment:

1. Export a read-only inventory of suspected test records and their linked IDs.
2. Review each record; never infer test status only from name, date, or amount.
3. Use the authenticated commercial classifications API to classify one reviewed record at a time,
   including a reason. Do not run direct production SQL.
4. Verify commercial totals exclude the record while Salud still retains its technical evidence.
5. If classification was wrong, revoke that classification with a reason; do not delete the row.

### Production activation checklist

- [ ] Migration history and deployed constraints/RPC grants match the reviewed migration.
- [ ] Atomic same-amount and conflicting-amount deposit tests pass.
- [ ] `sent`, `pending`, and active `sending` recovery attempts are rejected server-side.
- [ ] Stale claims and ambiguous delivery have been exercised in Meta test mode.
- [ ] Attempt counts remain monotonic and recovery history identifies the actor and reason.
- [ ] Classified QA records are excluded from commercial metrics but retained in diagnostics.
- [ ] CRM confirms `Anticipo registrado` independently from the CAPI state.
- [ ] Preview and Production variable scopes have been reviewed without exposing secret values.
- [ ] The owner has approved a separate go/no-go review. Changing delivery mode is not part of the
      remediation deployment.

Rollback: keep CAPI in `test`, stop queue recovery actions, preserve all
outbox/attempt/classification evidence, revert application behavior, and use a new corrective
migration for schema changes. Never regenerate stable event IDs or rewrite an applied migration.

---

## Celestial Blue conversion pilot

The pilot is selected for current exposure, not measured preference. Most demo traffic is driven by
operator-shared WhatsApp links. A design change or before/after difference cannot establish sales
causality.

- Public demo composition opts in only for `demo-xv-celestial-blue`. Two static WhatsApp links
  follow gallery and thank-you; the latter also links to the existing XV showroom.
- `data-preserve-message=true` protects the exact style message from promotional and folio rewrites.
  No new commercial CTA is added to real invitations. Links do not depend on JavaScript or
  analytics.
- `demo_viewed` still means demo page load, not envelope opening. One initialization per document
  prevents hydration/reopening duplicates. A genuine second activation has a new technical UUID.
- First-party browser events require analytics or marketing consent. GA4 and Meta retain their
  individual consent gates. No pre-consent click/view history is reconstructed.
- The first-party event UUID is the tracking row ID. Repeated ingestion returns the existing row
  only for the same session and event name. Purchase idempotency is not modified.

### Measurement rollout

Mapping authored on 2026-09-25 and revised on 2026-10-24; **production effective date and deployment
SHA: pending validation**. The WhatsApp browser click went from standard `Contact` to custom
`WhatsAppClick` on 2026-09-25 and returns to standard `Contact` on 2026-10-24, with `WhatsAppClick`
kept as a custom copy. Historical records retain their original meaning. Neither event proves a
received conversation. Before release, validate current official Meta documentation, dataset
configuration, Test Events, GA4 mapping and QA exclusions under separately authorized provider
access. Server-side `Contact` and `Lead` delivery through the outbox was added on 2026-10-25.

### Existing dashboard and administrative persistence

The report in `/dashboard/commercial` offers 30/60 complete calendar days in `America/Chihuahua`,
excluding today. The inventory is the canonical demo collection, including demos not listed in the
showroom. Keyset pagination continues to an empty page; query errors, non-advancing cursors or
safety overflow produce unavailable data, never partial totals.

The older operational overview remains explicitly all-history; it also uses complete pagination.
Recent lists remain short presentation lists, not data-source limits. Neither surface sums GA4 and
hosting-provider data.

An observed view establishes that measurement exists for that demo in the selected period; absent
views are unknown coverage, not proof of zero traffic. A zero contact count means no administrative
records found, not proof of no WhatsApp conversations. CTR uses measured demo sessions only; the
click count separately includes showroom activations. Period stage counts are not a cohort
conversion rate.

Migration `20260925182713_commercial_demo_followups.sql` is merged to `main`; read its apply state
per environment from `pnpm dbs`, not from this document. It adds an append-only milestone ledger
linked to existing leads and authenticated actors. It does not create a new CRM, alter order/payment
state, or emit provider events. Service-role SELECT/INSERT only; anonymous and authenticated direct
access is denied by privileges and RLS. The existing admin authentication, CSRF, runtime mutation
guard and rate limiting protect the POST endpoint.

A lead code selects an existing opportunity; only sharing/contact milestones can create a missing
opportunity, with no personal fields or marketing consent. Operators reuse the same code for the
same opportunity and link existing conversations manually. Each lead/demo/action is recorded once.
Retries preserve the request ID and return the original milestone without changing its timestamp.
This minimal ledger does not provide corrections or reopening; those require a separately reviewed
administrative workflow. Loss reasons use a closed list and default to “No informado”.

Payments use existing orders and the first confirmed-deposit timestamp. A payment is assigned only
when exactly one style was recorded as shared before that payment; ambiguous/unlinked payments
remain unattributed. Multiple styles and later shares cannot arbitrarily change historical credit.
Existing order and Purchase transitions remain owned by the Sales Workspace.

### Remaining acceptance gates

- Guarded migration review/apply and disposable-database privilege/idempotency verification.
- Authenticated dashboard end-to-end checks with complete, empty and unavailable data.
- Human mobile/desktop approval, complete visual regression and assistive-technology verification.
- Media quality/rights confirmation; no new assets or licenses have been acquired.
- Exact Preview artifact approval, separately authorized Production publication, and measurement
  cutover timestamp. Local source and tests do not prove deployed behavior.

## Future Work

- Lead Management MVP: `new → contacted → quoted → won/lost` lifecycle
- Purchase/revenue attribution: `lead_id → order_id → revenue`
- Optional GA4 Measurement Protocol for server-side `generate_lead`
- Optional transactional lead creation if concurrency becomes relevant
