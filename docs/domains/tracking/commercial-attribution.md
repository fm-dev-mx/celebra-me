# Commercial Attribution

## Purpose

Celebra-me uses first-party deterministic attribution to connect anonymous commercial traffic to
identifiable leads. Attribution is resolved server-side through the tracking ingestion pipeline and
contact form API. No third-party cookies are used.

## Mexico consent

Consent follows Mexico ARCO practice. Categories: `necessary` (always on), `analytics` (gates GA4), `marketing` (gates Meta Pixel and any GTM marketing tags). Default before user choice: analytics and marketing off. Analytics and marketing consent can be withdrawn at any time.

## GA4 vs GTM ownership

First-party tracking is the source of truth. GA4 is behavioral analytics and is loaded directly, not through GTM. Meta Pixel is ad optimisation only. GTM is not activated; if added later it must not bypass app route policy or consent policy.

## Retention

- Analytics-event and marketing-audience retention: not established in this repository; requires an
  explicit privacy decision before being treated as a current contract.
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

| Behaviour    | Detail                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------- |
| Channel      | `whatsapp`                                                                                |
| Status       | `new`                                                                                     |
| Consent      | `consent_contact: true` (user initiated contact), `consent_marketing: false`              |
| Name/contact | `null` initially — filled later through manual reconciliation or eventual form submission |
| Intent       | Early commercial intent, NOT a qualified lead, sale, or confirmed customer                |

The WhatsApp URL is rewritten client-side to embed the canonical `lead_code` (`CM-XXXXXX`) in the message text. The lead code bridges the
anonymous click to any future contact form submission.

### Contact form submissions

The contact form (`ContactForm.astro`) submits to `POST /api/contact`. The form includes hidden
fields for `sessionId`, `visitorId`, `leadCode`, and UTM parameters.

| Behaviour    | Detail                                            |
| ------------ | ------------------------------------------------- |
| Channel      | `contact_form`                                    |
| Dedup        | By `lead_code` via `on_conflict=lead_code` upsert |
| Name/contact | Provided by user in the form                      |

## `lead_created` Event Rule

`lead_created` is a first-party tracking event fired server-side after lead persistence. It follows
a three-valued guard:

| `findLeadByCode()` returns | Behaviour                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Existing `StoredLead`      | Lead already exists. Do NOT emit `lead_created`. Return the existing lead.                                        |
| `null`                     | Confirmed new lead. Emit exactly one `lead_created`. Upsert the lead.                                             |
| Throws / lookup failure    | Preserve the operational upsert (lead capture is more important than event counting). Do NOT emit `lead_created`. |

This rule applies to **both** lead sources (WhatsApp clicks and contact form submissions).

The `lead_created` event carries:

- `lead_code` — the stable attribution code
- `lead_channel` — `whatsapp` or `contact_form`
- `routePath` — `/api/tracking/events` or `/api/contact`
- `consentSnapshot` — `{ necessary: true, analytics: false, marketing: false }`

## GA4 Status

`generate_lead` is **not active** in the current implementation.

- `lead_created` is emitted **server-side** only.
- The GA4 forwarder (`ga4-forwarder.ts`) runs **client-side** via `gtag('event', ...)`.
- These two boundaries do not meet. The mapping is commented out with an explanation.

Future options to enable `generate_lead`:

- Dispatch `lead_created` client-side (requires adding it to the client tracking pipeline)
- Implement server-side GA4 Measurement Protocol to forward from the API route directly

## Exclusions

The following are explicitly excluded from commercial attribution:

- RSVP guest records and tracking
- Personalized invitation routes
- Real (published) invitation routes
- Dashboard admin auth
- Consent banner UI
- Meta Pixel behaviour (forwarding decisions are orthogonal to attribution)
- SQL schema changes (the feature uses existing tables and columns)

Route exclusion is enforced by `route-policy.ts`. See `docs/domains/rsvp/architecture.md` for the
separate guest tracking mechanism.

## Meta Event Architecture

Meta Pixel remains a downstream consumer of the first-party tracking contract. The browser-safe
configuration lives behind `PUBLIC_META_PIXEL_ID` and `PUBLIC_META_PIXEL_ENABLED`; no server-only
secrets are exposed client-side.

### Browser-side event map

| First-party event          | Meta event    | When it fires                                                     | Metadata sent                                                                              | Dedup key                |
| -------------------------- | ------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------ |
| `page_viewed`              | `PageView`    | Commercial/demo page load after marketing consent                 | `content_category=page`, optional `content_name`, `source_area`                            | —                        |
| `demo_viewed`              | `ViewContent` | Demo page load on real showroom/demo routes                       | `content_name`, `content_category=demo`, `event_type`, `source_area`                       | —                        |
| `package_viewed`           | `ViewContent` | Pricing/package card becomes visible on the landing page          | `content_name`, `content_category=package`, `source_area`                                  | —                        |
| `whatsapp_contact_clicked` | `Contact`     | Commercial WhatsApp CTA click                                     | `content_name`, `content_category`, optional `event_type`, `source_area`                   | `lead_code` when present |
| `form_submitted`           | `Lead`        | Contact form submission succeeds (`POST /api/contact` returns OK) | `content_name=contact`, `content_category=lead_form`, optional `event_type`, `source_area` | `lead_code`              |

Notes:

- Meta payloads intentionally exclude guest identity, RSVP data, names, email, phone, free-text
  messages, invite tokens, and claim codes.
- `lead_code` is used as the browser-side `eventID` when a contact/lead event already has a stable
  non-PII identifier.
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

The Conversions API (CAPI) is fully implemented server-side to report confirmed `Purchase` events.
It is supported by an interactive administration workspace under `/dashboard/commercial` (under the
"Espacio de Ventas" tab) for super admins.

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
   → Enforces route safety on event_source_url (fallback to homepage if guest path)
   → Dispatches POST to Facebook Graph API
5. Status Update
   → Updates ledger status: 'pending' → 'sending' → 'sent' or 'failed' / 'skipped'
```

### Environment Variables

| Variable                  | Values / Purpose                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `META_CAPI_DELIVERY_MODE` | `disabled` (default), `test` (sends test payload), or `production` (live Graph API calls) |
| `META_CAPI_ACCESS_TOKEN`  | Meta Graph API access token                                                               |
| `META_PIXEL_ID`           | Meta Pixel Identifier (fallback to `PUBLIC_META_PIXEL_ID`)                                |
| `META_TEST_EVENT_CODE`    | Required in `test` mode to register events in Meta Events Manager                         |

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
6. **Event Name**: Always `Purchase`.
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

- [ ] `META_CAPI_DELIVERY_MODE` is explicitly set to `production` in Vercel.
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

## Future Work

- Lead Management MVP: `new → contacted → quoted → won/lost` lifecycle
- Purchase/revenue attribution: `lead_id → order_id → revenue`
- Optional GA4 Measurement Protocol for server-side `generate_lead`
- Optional transactional lead creation if concurrency becomes relevant
