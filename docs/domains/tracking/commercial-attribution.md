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

The WhatsApp URL is rewritten client-side to include `Código: CM-XXXXXX`. The lead code bridges the
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

## Future Work

- Lead Management MVP: `new → contacted → quoted → won/lost` lifecycle
- Purchase/revenue attribution: `lead_id → order_id → revenue`
- Optional GA4 Measurement Protocol for server-side `generate_lead`
- Optional transactional lead creation if concurrency becomes relevant
