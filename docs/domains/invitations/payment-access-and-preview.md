---
title: Invitation Payment Status, Public Access and Preview Protection
lifecycle: evergreen
domain: invitation-delivery
last_reviewed: 2026-10-10
---

# Invitation payment status, public access and preview protection

Celebra-me delivers a finished invitation before payment; the client reviews it at its final URL
`/{eventType}/{slug}` and pays after adjustments. This document owns how an unpaid or disabled
invitation behaves for guests and how the administrator controls it.

## State model

`invitation_access_controls` holds one row per invitation with two independent values (schema:
[`../database/overview.md`](../database/overview.md#commercial-access-state)):

| `public_access` | `payment_status` | What guests see                                                               |
| --------------- | ---------------- | ----------------------------------------------------------------------------- |
| `enabled`       | `paid`           | The invitation, unchanged                                                     |
| `enabled`       | `unpaid`         | The full invitation as a preview: banner, seals, watermarked photos and card  |
| `disabled`      | any              | Neutral page «Esta invitación no está disponible por el momento.», HTTP `403` |

Demos never carry access state. New invitations start unpaid and enabled; every invitation that
existed before `20261010150000` was backfilled as paid. Re-enabling restores the previous payment
state because the values are independent.

Only `super_admin` changes them (row menu in `/dashboard/invitaciones` or the invitation detail),
through `PATCH /api/dashboard/intake/[id]/access` and the audited RPC. Governance:
[`.agent/rules/intake-publishing.md`](../../../.agent/rules/intake-publishing.md).

## Server control points

- `resolvePublicInvitation` reads the access state in the single published-content read. Disabled →
  `unavailable`; unpaid → the view model's photographs are rewritten to watermarked previews before
  anything renders. `resolveInvitationContent` maps `unavailable` to `null`, so location, RSVP,
  memories identity and social metadata treat a disabled invitation as missing.
- A missing access row is served as the unpaid preview, never as the clean invitation.
- No query parameter (`screenshot`, `skipEnvelope`, `animations`) bypasses either state.
- Disabled invitations: page `403`; short links answer crawlers with an empty `403` and redirect
  guests to the neutral page; location and both RSVP APIs answer `403 invitation_unavailable`; the
  memories space resolves as unknown.

Response headers and the shared cache of preview media:
[`public-response-cache-policy.md`](public-response-cache-policy.md).

## Unpaid preview

- **Photos.** Every photograph field (`PREVIEW_PHOTO_PATHS` in
  `src/lib/invitation/preview/preview-media-policy.ts`) points at `/vista-previa/<token>.webp`; the
  social card is a 1200×630 `<token>.jpg`. The token seals the invitation id, source URL and variant
  (AES-256-GCM); the original URL never reaches the HTML. The endpoint re-encodes at the original
  pixel size with a tiled «VISTA PREVIA · CELEBRA-ME» mark drawn as strokes (no font needed) and
  writes EXIF/XMP provenance with an opaque reference. Design assets keep their delivery. A unit
  test walks every demo view model and fails on an unclassified image field.
- **Markup.** A fixed banner «Vista previa · Celebra-me» sits above the envelope and navigation
  (`--preview-banner-height`); seals drawn with the preset's tokens appear on the closed envelope,
  the cover, the gallery and family sections and the closing.
- **Copy friction.** Right-click save and drag of images are blocked on unpaid previews only; text
  selection, keyboard and zoom are untouched.

Removing the banner or seals with DevTools only changes the viewer's own screen: the photos stay
marked in their pixels and the original URLs are not in the page.

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

- **Vercel Firewall:** enable the AI Bots managed ruleset in Log mode, confirm WhatsApp and Facebook
  link previews still work, then switch to Deny. Cloudflare does not front the main domain, so its
  AI crawler controls do not apply.
- **Unpaid existing invitations:** mark them from the panel when the client is informed (the
  backfill left all existing invitations paid).
- **Terms:** `/terminos` §4 (owner-approved 2026-10-10) states that an unpaid preview grants no
  license, that Celebra-me may disable it, and that copying, AI training and automated recreation of
  the designs are prohibited; client photos and texts remain the client's.
