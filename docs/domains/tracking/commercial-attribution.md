# Commercial Attribution

## Purpose

Celebra-me uses first-party deterministic attribution to connect anonymous commercial traffic to
identifiable leads. Attribution is resolved server-side through the tracking ingestion pipeline and
contact form API. No third-party cookies are used.

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

The WhatsApp URL is rewritten client-side to include `Folio: CM-899-XXXX`. The lead code bridges the
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

| First-party event            | Meta event    | When it fires                                                  | Metadata sent                                                   | Dedup key |
| ---------------------------- | ------------- | -------------------------------------------------------------- | --------------------------------------------------------------- | --------- |
| `page_viewed`                | `PageView`    | Commercial/demo page load after marketing consent              | `content_category=page`, optional `content_name`, `source_area` | —         |
| `demo_viewed`                | `ViewContent` | Demo page load on real showroom/demo routes                    | `content_name`, `content_category=demo`, `event_type`, `source_area` | —     |
| `package_viewed`             | `ViewContent` | Pricing/package card becomes visible on the landing page       | `content_name`, `content_category=package`, `source_area`       | —         |
| `whatsapp_contact_clicked`   | `Contact`     | Commercial WhatsApp CTA click                                  | `content_name`, `content_category`, optional `event_type`, `source_area` | `lead_code` when present |
| `form_submitted`             | `Lead`        | Contact form submission succeeds (`POST /api/contact` returns OK) | `content_name=contact`, `content_category=lead_form`, optional `event_type`, `source_area` | `lead_code` |

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

## Conversions API Readiness

The repository is **not** yet wired to a real confirmed-sale path for Meta Conversions API.

What exists today:

- `tracking_events` already reserves lifecycle names such as `quote_sent`, `production_authorized`,
  `payment_pending`, and `payment_received`.
- `leads.status` already supports later commercial states including `production_authorized` and
  `paid`.

What is still missing:

- no server endpoint currently sends Meta Conversions API requests,
- no confirmed production path was found that emits `payment_received`,
- no order/payment service was found that can act as the source of truth for `Purchase`.

### Future CAPI contract

When a real paid flow exists, the future server-only integration should:

- run only from a confirmed-sale path that is authoritative for paid status,
- use server-only env vars `META_CAPI_ACCESS_TOKEN` and `META_PIXEL_ID`,
- send `Purchase` only after a real `payment_received` or equivalent paid confirmation,
- reuse a stable `event_id` between browser/server when the same conversion is reported twice,
- log failures without breaking the user-facing sales flow.

Recommended future payload:

| Field           | Expected value |
| --------------- | -------------- |
| `event_name`    | `Purchase`     |
| `event_time`    | Unix timestamp at confirmed payment |
| `event_id`      | Stable non-PII identifier from the paid transaction |
| `action_source` | `website`      |
| `value`         | Confirmed paid amount |
| `currency`      | `MXN`          |

## Future Work

- Lead Management MVP: `new → contacted → quoted → won/lost` lifecycle
- Purchase/revenue attribution: `lead_id → order_id → revenue`
- Optional GA4 Measurement Protocol for server-side `generate_lead`
- Optional transactional lead creation if concurrency becomes relevant
