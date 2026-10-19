---
title: Invitation Payment Status, Public Access and Preview Protection
lifecycle: evergreen
domain: invitation-delivery
last_reviewed: 2026-10-19
---

# Invitation payment status, public access and preview protection

Celebra-me delivers a finished invitation before payment; the client reviews it at its final URL
`/{eventType}/{slug}` and pays after adjustments. This document owns how an unpaid or disabled
invitation behaves for guests and how the administrator controls it.

## State model

`invitation_access_controls` holds one row per invitation with two independent values (schema:
[`../database/overview.md`](../database/overview.md#commercial-access-state)):

| `public_access` | `payment_status` | What guests see                                                                |
| --------------- | ---------------- | ------------------------------------------------------------------------------ |
| `enabled`       | `paid`           | The invitation, unchanged                                                      |
| `enabled`       | `unpaid`         | The full invitation, original photos and card, under a discreet preview banner |
| `disabled`      | any              | Neutral page «Esta invitación no está disponible por el momento.», HTTP `403`  |

A client invitation past its validity window — its own event date + 1 year, end of that day in the
event time zone ([creation contract](../../core/invitation-creation-contract.md)) — is **expired**:
guests get exactly what a disabled invitation gets, whatever both values say. Expiry is computed at
request time from the published event date; no row changes, the administrator cannot extend it, and
an invitation without a resolvable event date never expires.

Demos never carry access state and never expire. New invitations start unpaid and enabled; every
invitation that existed before `20261010150000` was backfilled as paid. Re-enabling restores the
previous payment state because the values are independent.

Only `super_admin` changes them (row menu in `/dashboard/invitaciones` or the invitation detail),
through `PATCH /api/dashboard/intake/[id]/access` and the audited RPC. Governance:
[`.agent/rules/intake-publishing.md`](../../../.agent/rules/intake-publishing.md).

## Server control points

- `resolvePublicInvitation` reads the access state in the single published-content read. Disabled or
  expired → `unavailable`; unpaid → the same view model as paid (photos are not altered).
  `resolveInvitationContent` maps `unavailable` to `null`, so location, RSVP, memories identity and
  social metadata treat a disabled or expired invitation as missing.
- Event-keyed checks (personalized RSVP, memories space) use `isEventInvitationUnavailable`: the
  access row first, then the published event timing (one extra read when enabled). Preview media
  (`/vista-previa/*`) also refuses an expired invitation.
- A missing access row is served as the unpaid preview, never as the clean invitation.
- No query parameter (`screenshot`, `skipEnvelope`, `animations`) bypasses either state.
- Disabled and expired invitations: page `403`; short links answer crawlers with an empty `403` and
  redirect guests to the neutral page; location and both RSVP APIs answer
  `403 invitation_unavailable`; the memories space resolves as unknown.

Response headers and the shared cache of preview media:
[`public-response-cache-policy.md`](public-response-cache-policy.md).

## Unpaid preview

- **Banner.** A thin fixed banner «Vista previa · Celebra-me» sits above the envelope and navigation
  (`--preview-banner-height`) and is the only preview cue. Photos, the social card and every section
  render exactly as on a paid invitation (owner decision 2026-10-19: the photo watermark and section
  seals hurt the invitation's quality more than they protected).
- **Copy friction.** Right-click save and drag of images are blocked on unpaid previews only; text
  selection, keyboard and zoom are untouched.

What actually protects an unpaid invitation is the administrator's switch (disabled → `403` on the
page, RSVP, location and memories) and the expiry window: the invitation's value is the live link,
and the banner tells guests it is not final. The photos belong to the client.

The `/vista-previa/` endpoint and `applyPreviewMediaPolicy` are no longer referenced by the page;
the endpoint still answers previously issued URLs (e.g. social cards WhatsApp cached) under the same
rules.

## Indexing, AI crawlers and rights

- Every client invitation response is `noindex, nofollow, noarchive, noimageindex` (meta and
  `X-Robots-Tag`); demos and the landing stay indexable.
- `robots.txt` (`src/lib/seo/robots-policy.ts`): AI training crawlers are refused the whole site; AI
  search and assistant agents are kept off invitation routes, short links and previews but may read
  the landing and demos. Link-preview crawlers are never listed.
- Every page carries `author`/`copyright` metas and a license link to
  `/terminos#propiedad-intelectual`; invitations with visible Celebra-me branding show a small «©
  Celebra-me · Diseño protegido · Términos» line in the footer.
- Client invitations carry an opaque `data-cm-ref` fingerprint on the theme wrapper, so a copied
  page can be traced to its invitation.

## Limits

These measures deter and trace; they cannot prevent screenshots, screen recordings, manual or
AI-assisted reconstruction from screenshots, reading of delivered HTML/CSS, or link previews that
WhatsApp already cached. After payment, original photos are public by design. Photos already served
before an invitation was marked unpaid remain wherever they were saved.

## Owner operations

- **Cloudflare AI Crawl Control:** keep the per-crawler blocks active and confirm WhatsApp and
  Facebook link previews still work.
- **Unpaid existing invitations:** mark them from the panel when the client is informed (the
  backfill left all existing invitations paid).
- **Terms:** `/terminos` §4 (owner-approved 2026-10-10) states that an unpaid preview grants no
  license, that Celebra-me may disable it, and that copying, AI training and automated recreation of
  the designs are prohibited; client photos and texts remain the client's.
