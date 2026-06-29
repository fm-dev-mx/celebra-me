# Deterministic Lead Attribution — SDD Implementation Plan

> **Goal:** Create a reliable first-party attribution chain from anonymous visitor/session events to
> identifiable commercial leads, with special support for WhatsApp-based sales.

> **Status:** Implemented. See
> [`docs/domains/tracking/commercial-attribution.md`](../../docs/domains/tracking/commercial-attribution.md)
> for the current contract.
>
> **Deviation notes from original spec:** The `lead_created` → `generate_lead` GA4 mapping is
> commented out because `lead_created` is emitted server-side only, while the GA4 forwarder runs
> client-side. `lead_created` deduplication uses a three-valued error-handling pattern (confirmed
> new → emit, confirmed existing → skip, lookup failure → upsert allowed but event skipped) that was
> refined during implementation. The `sourceEventId` for form leads comes from the client
> (pre-existing `form_submitted` event), not from a server-side insert. A `visitorId` hidden field
> was added to the contact form to resolve attribution through `visitor_sessions`.

---

## 1. Current-State Findings

### 1.1 Visitor and session identity

| Identifier   | Mechanism                           | Persistence           | Scope                   |
| ------------ | ----------------------------------- | --------------------- | ----------------------- |
| `visitor_id` | `cm_visitor_id` in localStorage     | Forever (device-side) | Cross-session           |
| `session_id` | `cm_session_id` in sessionStorage   | Tab lifetime          | Single session          |
| UTM snapshot | `cm_utm_snapshot` in sessionStorage | Tab lifetime          | First-touch attribution |

Both are generated in `src/lib/tracking/client.ts` and sent with every `/api/tracking/events` POST.
The server upserts `visitor_sessions` rows keyed by `session_id` (UUID primary key) and links them
to `visitor_id`.

**Finding 1 — No persistent session-to-visitor relation in DB:** The `visitor_sessions` table stores
`visitor_id` as an unindexed text column. There is no index on `(visitor_id, last_seen_at)` for
cross-session queries. The existing index `idx_visitor_sessions_visitor_id` is on `visitor_id`
alone.

**Finding 2 — Session ID is ephemeral for mobile users:** `sessionStorage` dies when the browser tab
closes. Mobile users who close their browser and return via a WhatsApp link start a new session.
Lead attribution survives this because `lead_code` is the stable cross-session pivot, not
`session_id`.

### 1.2 Lead code generation

- Module: `src/lib/tracking/lead-code.ts`
- Format: `CM-XXXXXX` where X ∈ `{2-9, A-H, J-N, P-Z}` (26 chars, no 0/1/I/O for readability)
- Currently injected into:
  - WhatsApp links as `Código: CM-XXXXXX` (via `updateWhatsAppUrl()` in `client.ts:236-245`)
  - Hidden form field `leadCode` (via `setContactHiddenFields()` in `client.ts:163-179`)
- Created on every WhatsApp click and form mount (client-side)

**Finding 3 — Lead codes are generated client-side, never stored server-side until a form is
submitted.** WhatsApp clicks create a `whatsapp_contact_clicked` tracking event with `lead_code` in
`event_properties`, but **no lead record is created**. The lead code is only meaningful if:

- The user mentions it back to us in WhatsApp chat, OR
- The user later submits the contact form (the code bridges the two events)

### 1.3 Lead creation coverage

| Channel                    | Lead created?                                           | Source event linked?                              | Session linked?                                      |
| -------------------------- | ------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| `contact_form`             | ✅ `createLeadFromContactSubmission()` → `upsertLead()` | ✅ `sourceEventId` optional, not always populated | ✅ `sessionId` optional, populated from hidden field |
| `whatsapp` (click)         | ❌ No lead created                                      | ❌ N/A                                            | ❌ N/A                                               |
| `whatsapp` (chat-to-order) | ❌ Must be done manually                                | ❌ N/A                                            | ❌ N/A                                               |

**Finding 4 — Zero leads for WhatsApp intents.** A WhatsApp click is the most valuable commercial
signal (high intent), yet it generates zero persistent lead records. The attribution chain
`visitor → session → lead` breaks at the WhatsApp step.

### 1.4 Event taxonomy (current vs planned)

Current event names in `TRACKING_EVENT_NAMES` (`event-contract.ts:5-27`) match the MVP spec. All
events fire correctly except:

| Event                      | Fires?                                                      | Where                            |
| -------------------------- | ----------------------------------------------------------- | -------------------------------- |
| `page_viewed`              | ✅ `initCommercialTracking()`                               | After route policy gate          |
| `session_started`          | ❌ Not fired (session upsert at ingestion time is implicit) | —                                |
| `section_seen`             | ✅ `bindSectionVisibility()` via IntersectionObserver       |                                  |
| `scroll_depth_reached`     | ✅ `bindScrollDepth()`                                      |                                  |
| `cta_clicked`              | ✅ delegated click handler on `[data-track-event]`          |                                  |
| `whatsapp_contact_clicked` | ✅ same handler                                             |                                  |
| `form_started`             | ✅ `bindForms()`                                            |                                  |
| `form_submitted`           | ✅ `bindForms()`                                            |                                  |
| `lead_created`             | ❌ **Not fired anywhere**                                   | Server-side / post-lead-creation |
| `demo_viewed`              | ✅ `initCommercialTracking()`                               | Only if route is demo            |

**Finding 5 — `lead_created` never fires.** The event name exists in the schema and DB check
constraint but is never emitted by any code path. It should fire after a lead record is persisted.

### 1.5 Consent boundaries (current state)

| Category    | Status                       | Hard-gated?                |
| ----------- | ---------------------------- | -------------------------- |
| `necessary` | Always true                  | ✅ localStorage, hardcoded |
| `analytics` | Gates GA4 script load        | ✅ Basic Consent Mode      |
| `marketing` | Gates Meta Pixel script load | ✅ Basic Consent Mode      |

**Finding 6 — Consent boundaries are correctly implemented.** Analytics/marketing forwarding
respects consent. The cookie banner (`ConsentBanner.tsx`) uses Basic Consent Mode. The only consent
nuance for this feature: `lead_created` must NOT be forwarded to GA4/Meta when analytics/marketing
consent is absent, but the lead record itself is first-party operational and does not require
analytics consent (the user initiated contact, which implies contact consent).

### 1.6 RSVP / guest separation

**Finding 7 — RSVP is fully separated.** The route policy (`route-policy.ts:72-80`) excludes
`real_invitation`, `personalized_invitation`, `rsvp_guest_api`, and `dashboard_admin_auth` from
commercial tracking. The `leads` table has no foreign key to any RSVP/guest table. Guest engagement
tracking uses a completely separate mechanism (`guest_invitations.view_count` etc.). No changes
needed here.

### 1.7 Dashboard reads

The commercial dashboard (`commercial.astro` + `commercial-dashboard.ts`) already:

- Queries `leads` for "Leads recientes" table (code, name, contact, event_type, package_interest,
  status, channel)
- Shows lead counts, lead-by-status, lead-by-channel breakdowns
- Renders tracking quality metrics from `consent_snapshot`

**Finding 8 — Dashboard already supports the data model.** It reads from the `leads`,
`visitor_sessions`, and `tracking_events` tables. Adding WhatsApp leads will populate the same
dashboard table without any dashboard code changes.

---

## 2. Proposed Data Model Changes

### 2.1 Supabase migration: Add lead-source tracking + new channel enum value

One additive migration:

#### Change A — Add `waspm` channel to `leads` channel check constraint

The current constraint:

```sql
channel text not null default 'contact_form'
  check (channel in ('contact_form', 'whatsapp', 'manual'))
```

This already includes `whatsapp`. **No change required.** The channel `whatsapp` is ready for use
but no code path writes it yet.

#### Change B — Add index for cross-session visitor queries (optional but recommended)

```sql
create index if not exists idx_visitor_sessions_visitor_last_seen
  on public.visitor_sessions (visitor_id, last_seen_at desc);
```

#### Change C — Add `source_event_id` population to form-submission path

The schema already has
`source_event_id uuid null references public.tracking_events(id) on delete set null`. The form
submission path needs to pass the `form_submitted` event's ID.

### 2.2 No new columns or tables required

The existing `leads` table schema fully supports this feature:

| Column                   | Purpose for WhatsApp leads                                                       |
| ------------------------ | -------------------------------------------------------------------------------- |
| `lead_code`              | Unique code for attribution                                                      |
| `session_id`             | FK to visitor session that generated the lead                                    |
| `source_event_id`        | FK to the `whatsapp_contact_clicked` or `form_submitted` event                   |
| `channel`                | `whatsapp`                                                                       |
| `status`                 | `new`                                                                            |
| `name`, `email`, `phone` | `null` initially (filled later via manual reconciliation or user providing them) |
| `utm_*`                  | Copied from the triggering event                                                 |
| `consent_contact`        | `true` (user initiated contact)                                                  |
| `consent_marketing`      | `false` (not inferred from analytics consent)                                    |

---

## 3. Event Taxonomy Changes

### 3.1 New event firing: `lead_created`

The existing event name `lead_created` must be fired **server-side** after any lead is persisted:

- After WhatsApp lead creation in the ingestion service
- After form-submission lead creation in the contact API

This event is:

- Persisted to `tracking_events` (always — first-party source of truth)
- Forwarded to GA4 as `generate_lead` only when analytics consent is present
- Reserved for future Meta `Lead` dispatch (not sent client-side per analytics-engineering
  principle)

### 3.2 Event contract impact

Add `lead_code` to `SAFE_EVENT_PROPERTY_KEYS`: ✅ Already present (`event-contract.ts:59`).

---

## 4. Files to Inspect Before Implementation

_(All read in this audit pass)_

| File                                                              | What it contains                                                       |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/lib/tracking/event-contract.ts`                              | Event names, safe keys, Zod schema                                     |
| `src/lib/tracking/client.ts`                                      | Client-side tracking init, lead code injection, WhatsApp URL rewriting |
| `src/lib/tracking/lead-code.ts`                                   | Lead code generation (`CM-XXXXXX`)                                     |
| `src/lib/tracking/lead.service.ts`                                | `createLeadFromContactSubmission()`                                    |
| `src/lib/tracking/lead.repository.ts`                             | `upsertLead()` Supabase REST call                                      |
| `src/lib/tracking/ingestion.service.ts`                           | Server-side event ingestion                                            |
| `src/lib/tracking/repository.ts`                                  | Visitor session upsert + tracking event insert                         |
| `src/lib/tracking/commercial-dashboard.ts`                        | Dashboard summary function + load function                             |
| `src/lib/tracking/consent-client.ts`                              | Client-side consent persistence                                        |
| `src/lib/tracking/ga4-forwarder.ts`                               | GA4 event mapping (missing `lead_created` → `generate_lead`)           |
| `src/lib/tracking/route-policy.ts`                                | Route classification                                                   |
| `src/lib/tracking/internal-exclusion.ts`                          | Internal traffic exclusion                                             |
| `src/pages/api/contact.ts`                                        | Contact form handler                                                   |
| `src/pages/api/tracking/events.ts`                                | Tracking events API                                                    |
| `src/pages/dashboard/commercial.astro`                            | Dashboard page                                                         |
| `src/components/ui/ContactForm.astro`                             | Contact form HTML + inline script                                      |
| `src/components/home/Contact.astro`                               | Contact section CTA                                                    |
| `src/utils/whatsapp.ts`                                           | WhatsApp link builder                                                  |
| `src/lib/rsvp/repositories/supabase.ts`                           | `supabaseRestRequest` helper                                           |
| `supabase/migrations/20260628000000_commercial_analytics_mvp.sql` | Table DDL                                                              |

---

## 5. Files Likely to Change

| File                                                              | Change Type   | Reason                                                                                                                         |
| ----------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/tracking/ingestion.service.ts`                           | **Modify**    | Auto-create `whatsapp` channel lead when `whatsapp_contact_clicked` has `lead_code`; fire `lead_created` event                 |
| `src/lib/tracking/lead.service.ts`                                | **Modify**    | Export `createLeadFromTrackingEvent()` for WhatsApp lead creation; fire `lead_created` event after form leads                  |
| `src/lib/tracking/lead.repository.ts`                             | **Modify**    | Return full StoredLead with id/leadCode/status for event linking                                                               |
| `src/pages/api/contact.ts`                                        | **Modify**    | Pass `form_submitted` event ID as `sourceEventId`                                                                              |
| `src/lib/tracking/ga4-forwarder.ts`                               | **Modify**    | Add `lead_created` → `generate_lead` to GA4_EVENT_MAP                                                                          |
| `src/lib/tracking/client.ts`                                      | **Minor**     | Possibly remove the client-side-only `lead_code` management for WhatsApp if ingestion handles it (or keep both for resilience) |
| `supabase/migrations/20260628000000_commercial_analytics_mvp.sql` | **Read-only** | Reference for current schema                                                                                                   |
| Need new migration file                                           | **Create**    | Add index for visitor_id cross-session queries                                                                                 |
| `tests/unit/tracking-lead.service.test.ts`                        | **Modify**    | Test WhatsApp lead creation                                                                                                    |
| `tests/unit/tracking-ingestion.service.test.ts`                   | **Modify**    | Test auto-lead-creation on `whatsapp_contact_clicked`                                                                          |
| `tests/unit/tracking-events-api.test.ts`                          | **Modify**    | Test lead-created event linkage                                                                                                |
| `tests/unit/tracking-policy.test.ts`                              | **Unchanged** | No policy change needed                                                                                                        |

---

## 6. Implementation Phases

### Phase A — Core: Auto-create WhatsApp leads in ingestion (2 files)

**Goal:** When the ingestion service receives a `whatsapp_contact_clicked` event with a `lead_code`
in properties, automatically create a lead record.

**File A1: `src/lib/tracking/lead.service.ts`**

Add:

```typescript
export async function createLeadFromTrackingEvent(params: {
  leadCode: string;
  sessionId: string;
  sourceEventId: string;
  channel: LeadChannel; // 'whatsapp' | 'contact_form'
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}): Promise<StoredLead>;
```

This function:

1. Calls `upsertLead()` with channel-specific defaults
2. Fires a `lead_created` tracking event by calling the repository's `insertTrackingEvent()`
3. Returns the stored lead

**File A2: `src/lib/tracking/ingestion.service.ts`**

After the tracking event is inserted but before returning, check:

```typescript
if (payload.eventName === 'whatsapp_contact_clicked') {
  const leadCode = propertyAsString(eventProperties, 'lead_code');
  if (leadCode) {
    await createLeadFromTrackingEvent({
      leadCode,
      sessionId: payload.sessionId,
      sourceEventId: event.id,
      channel: 'whatsapp',
      utmSource: payload.source,
      utmMedium: payload.medium,
      utmCampaign: payload.campaign,
    });
    // Note: the lead_created event is fired inside createLeadFromTrackingEvent
  }
}
```

### Phase B — Enhance form submission path (1 file)

**File B1: `src/pages/api/contact.ts`**

1. Before creating the lead, call the tracking event repository to record a `form_submitted` event
   (or accept it from the client — currently the client fires it). Since the client fires
   `form_submitted` before POSTing to `/api/contact`, we need the `sourceEventId` to come from the
   client.
2. The ContactForm.astro inline script already sends `sessionId` and `leadCode` in the POST body. We
   add `sourceEventId` there.

Actually, the simplest approach: the client fires `form_submitted` (which gets persisted), and the
response includes the event ID. Then the client sends that event ID as `sourceEventId` in the
contact POST.

But that introduces a race condition (the form_submitted event must resolve before the contact
POST). Simpler: have the `/api/contact` handler itself record a `form_submitted` event and use its
own event ID as `sourceEventId`.

**Simplified approach for Phase B:**

1. In `/api/contact`, before calling `createLeadFromContactSubmission()`, call
   `insertTrackingEvent()` to record a `form_submitted` event
2. Pass that event's ID as `sourceEventId` to `createLeadFromContactSubmission()`
3. `createLeadFromContactSubmission()` fires `lead_created` after upserting the lead

### Phase C — GA4 forwarder update (1 file, trivial)

**File C1: `src/lib/tracking/ga4-forwarder.ts`**

Add to `GA4_EVENT_MAP`:

```typescript
lead_created: 'generate_lead',
```

### Phase D — Database migration (1 new file)

**File D1: `supabase/migrations/20260629000000_commercial_lead_state_index.sql`**

```sql
-- Add index for cross-session visitor queries on the commercial tracking tables.
create index if not exists idx_visitor_sessions_visitor_last_seen
  on public.visitor_sessions (visitor_id, last_seen_at desc);
```

### Phase E — Fix `lead_code` prefix (optional)

If the user wants `CLB-` prefix instead of `CM-`, change `lead-code.ts:13`:

```typescript
return `CLB-${code}`;
```

This is a one-character change. No data migration needed because the prefix change only affects new
codes; existing codes keep their original prefix. The `lead_code` column is a free-form text field
with a unique constraint — no format validation.

### Phase F — Tests

1. `tracking-lead.service.test.ts`: Test `createLeadFromTrackingEvent()` creates lead + fires
   `lead_created`
2. `tracking-ingestion.service.test.ts`: Test automatic lead creation on `whatsapp_contact_clicked`
3. `tracking-events-api.test.ts`: Verify `/api/contact` fires `lead_created` after successful
   submission

---

## 7. Detailed Data Flow

### WhatsApp flow (new)

```
User clicks WhatsApp CTA
  → client.ts bindClicks()
    → createLeadCode() → "CM-A3X9K2"
    → updateWhatsAppUrl(anchor, "CM-A3X9K2")
      → WhatsApp URL text includes "Código: CM-A3X9K2"
    → trackEvent('whatsapp_contact_clicked', { lead_code: "CM-A3X9K2", ... })
      → POST /api/tracking/events
        → ingestTrackingEvent()
          → upsertVisitorSession() [updates last_seen_at]
          → insertTrackingEvent() [persists the whatsapp_contact_clicked event]
          → 🔄 NEW: detect eventName === 'whatsapp_contact_clicked' && lead_code exists
            → createLeadFromTrackingEvent()
              → upsertLead() [creates lead with channel='whatsapp', status='new']
              → insertTrackingEvent() [fires lead_created event]
  → WhatsApp opens with pre-filled message
    "Hola, quiero información sobre una invitación digital. Código: CM-A3X9K2"
```

### Contact form flow (enhanced)

```
User submits contact form
  → ContactForm.astro inline script POSTs to /api/contact
    → 💡 Client sends: { name, email, ..., leadCode, sessionId, sourceEventId, utm* }
    → /api/contact validates
      → 🔄 NEW: insertTrackingEvent({ eventName: 'form_submitted', ... })
        → Returns event.id
      → createLeadFromContactSubmission({ ..., sourceEventId: event.id })
        → upsertLead() [upserts lead]
        → 🔄 NEW: insertTrackingEvent({ eventName: 'lead_created', ... })
      → sendEmail() [existing]
```

---

## 8. Acceptance Criteria

| #    | Criterion                                                       | How to verify                                                                                                                       |
| ---- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| AC1  | WhatsApp click creates a lead record with channel `whatsapp`    | Click WhatsApp CTA on landing page → check `leads` table has a row with the generated `lead_code`, channel=`whatsapp`, status=`new` |
| AC2  | WhatsApp URL includes stable lead code                          | Check generated WhatsApp URL contains `?text=...Código:+CM-XXXXXX` or `CLB-XXXXX`                                                   |
| AC3  | Lead code in WhatsApp URL matches lead record                   | The `lead_code` in the URL matches `leads.lead_code` in DB                                                                          |
| AC4  | Form submission creates lead linked to session/event            | Submit form → check `leads` row has `session_id` and `source_event_id` populated                                                    |
| AC5  | `lead_created` event fires for every lead                       | `tracking_events` table contains `lead_created` rows referencing the lead's associated session                                      |
| AC6  | Dashboard shows WhatsApp leads in "Leads recientes"             | Commercial dashboard table shows leads with channel "WhatsApp manual" and correct status                                            |
| AC7  | No server-only code leaks to client bundles                     | `pnpm build` succeeds, no SSR-only imports in client islands                                                                        |
| AC8  | RSVP/guest records are never mixed with lead records            | The `leads` table has no FK to RSVP guest tables; route policy still excludes invitation routes                                     |
| AC9  | Consent boundaries preserved                                    | `lead_created` fires as first-party event regardless of consent; GA4/Meta forwarding respects consent                               |
| AC10 | `generate_lead` event sent to GA4 when analytics consent exists | Check GA4 DebugView for `generate_lead` event with `lead_channel` parameter                                                         |

---

## 9. Manual Configuration Required

None. The feature is entirely additive:

- No new environment variables
- No new Supabase secrets
- No Vercel configuration changes
- No GA4/Meta Pixel configuration changes
- Database migration is optional (index) — the lead records work without it

The only manual step is applying the Supabase migration (if the index is desired).

---

## 10. Risks and Rollback Plan

### Risks

| Risk                                                                             | Likelihood | Impact | Mitigation                                                                                                                  |
| -------------------------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| Duplicate lead records for same WhatsApp click                                   | Low        | Medium | `upsertLead` uses `on_conflict=lead_code` — upserts by lead code, never duplicates                                          |
| WhatsApp lead without eventual name/contact fills dashboard with anonymous leads | Medium     | Low    | Dashboard already shows `Sin nombre` / `Sin contacto` for null fields. Leads can be manually reconciled                     |
| Race condition: `lead_created` event fails but lead was created                  | Low        | Low    | Lead is the source of truth; missing event is a dashboard metric issue, not data loss. Add retry in `insertTrackingEvent()` |
| Existing `CM-` prefix vs new `CLB-` prefix confusion during transition           | Low        | Low    | No impact — both are unique strings in `lead_code` column. If prefix changes, only new codes get the new prefix             |
| GA4 `generate_lead` event rate-limit if many WhatsApp clicks                     | Low        | Low    | `trackEvent` already gracefully handles errors; GA4 accepts generous daily event limits                                     |
| Form submits before `form_submitted` tracking event resolves                     | Low        | Low    | If handler records its own `form_submitted` event server-side, no client race condition exists                              |

### Rollback Plan

If the feature causes issues:

1. **Quick rollback** — Revert the ingestion service change that auto-creates WhatsApp leads:
   ```bash
   git checkout HEAD~1 -- src/lib/tracking/ingestion.service.ts
   ```
2. **Full rollback** — Revert the entire commit:
   ```bash
   git revert HEAD
   ```
3. **Database** — No destructive DDL was run (only additive index). Remove the index:
   ```sql
   drop index if exists idx_visitor_sessions_visitor_last_seen;
   ```
4. **Existing WhatsApp leads** remain in the `leads` table with `channel='whatsapp'`. They do not
   cause errors — they are just orphan records if the ingestion path is removed.

---

## 11. Validation Commands

```bash
# Type-check + build (must pass)
pnpm type-check
pnpm build

# Unit tests
pnpm test -- tests/unit/tracking-lead.service.test.ts
pnpm test -- tests/unit/tracking-ingestion.service.test.ts
pnpm test -- tests/unit/tracking-events-api.test.ts
pnpm test -- tests/unit/tracking-policy.test.ts

# Server/client boundary — check no server-only code is imported in client islands
# (lint should catch this, but manual review too)
pnpm lint

# Git safety
pnpm agent:git-safety:check

# Dashboard — manual check on Vercel preview that /dashboard/commercial loads
# and shows leads with channel column
```

---

## 12. Commit Separation

Recommended as a single commit since all changes are within the tracking domain and cannot be
deployed independently:

```
feat(tracking): auto-create lead records for WhatsApp clicks, fire lead_created event

- Auto-create whatsapp-channel lead in ingestion service when
  whatsapp_contact_clicked has a lead_code
- Fire lead_created first-party event after any lead creation
- Add lead_created → generate_lead mapping to GA4 forwarder
- Record form_submitted event server-side in /api/contact
- Add visitor_id + last_seen_at index for cross-session queries
- Test: WhatsApp lead creation path
- Test: lead_created event linkage
- Test: ingestion service auto-lead creation
```

If the codebase has multiple stake owners, split:

1. `feat(tracking)` — Ingestion + lead service + GA4 map + `/api/contact`
2. `feat(db)` — New index migration only
