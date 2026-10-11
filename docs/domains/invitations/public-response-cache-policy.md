---
title: Public Invitation Response Policy
lifecycle: evergreen
domain: invitation-delivery
last_reviewed: 2026-07-25
---

# Public invitation response policy

## Current contract

Public invitation freshness is intentionally correctness-first. Anonymous invitations use:

```http
Cache-Control: public, max-age=0, s-maxage=0, must-revalidate
```

Browsers and shared caches may retain the response, but must revalidate before reuse. This avoids
serving an obsolete published version after a host republishes an invitation. The policy is not a
performance-TTL proposal and does not imply a Vercel cache hit.

Every response that can contain guest, editor, draft, validation, conflict, or redirect state uses:

```http
Cache-Control: no-store, private
```

That includes personalized invitation URLs, metadata/context/view/RSVP APIs, dashboard preview,
preflight and publication APIs, authentication and authorization errors, invalid event types,
missing invitation routes, disabled invitations, render failures, and canonical redirects.

## Access state and indexing

The public route reads the invitation's access state (`invitation_access_controls`) in the same
single published-content read, on every request; there is no cache to invalidate when the
administrator changes it.

| Invitation state                   | Status | Body                     | `Cache-Control`                                  | `X-Robots-Tag`                               |
| ---------------------------------- | ------ | ------------------------ | ------------------------------------------------ | -------------------------------------------- |
| Client invitation (paid or unpaid) | 200    | Invitation               | `public, max-age=0, s-maxage=0, must-revalidate` | `noindex, nofollow, noarchive, noimageindex` |
| Disabled by the administrator      | 403    | Neutral unavailable page | `no-store, private`                              | `noindex, nofollow, noarchive`               |
| Archived or nonexistent            | 404    | Same neutral page        | `no-store, private`                              | `noindex, nofollow, noarchive`               |
| Static demo                        | 200    | Demo                     | `public, max-age=0, s-maxage=0, must-revalidate` | none (indexable)                             |

The neutral page carries no event data and no canonical or social URL (the path usually contains
names). Short links of a disabled invitation answer crawlers with an empty `403` (no metadata) and
still redirect guests to the route, which renders the neutral page. Public APIs (location, generic
and personalized RSVP) answer `403 invitation_unavailable`; the memories space of a disabled
invitation resolves as unknown (`404`).

## Watermarked preview media (shared cache decision)

An unpaid client invitation never references its original photos: the resolver replaces every
photograph with `/vista-previa/<token>.webp` (and the social card with `<token>.jpg`, 1200×630). The
token is an AES-256-GCM seal of the invitation id, source URL and variant; it is deterministic per
photo, so the URL is content-addressed. This is the one deliberate shared cache on public invitation
media:

```http
Cache-Control: public, max-age=86400, s-maxage=2592000
X-Robots-Tag: noindex, noimageindex, nofollow
```

- No invalidation is needed: marking the invitation paid switches its HTML to the original photo
  URLs, so cached watermarked copies are simply no longer referenced.
- A cached copy stays reachable at its opaque URL for up to 30 days at the CDN (owner decision);
  deleting a source photo does not purge it sooner.
- The endpoint serves only while the invitation is unpaid and enabled (otherwise `404`, `no-store`),
  refuses any query string (`400`) so variants cannot bust the cache, and fetches only same-origin,
  managed Storage or Cloudinary sources.
- Link previews already cached by WhatsApp cannot be purged; personalized short links get a fresh
  preview, and re-sharing the canonical URL with a new query string forces one.

## Verification

Local browser coverage verifies the effective headers for:

| Response                               | Required header                                  |
| -------------------------------------- | ------------------------------------------------ |
| Anonymous invitation                   | `public, max-age=0, s-maxage=0, must-revalidate` |
| Personalized invitation                | `no-store, private`                              |
| Invalid invitation-like route          | `no-store, private`                              |
| Canonical personalized redirect        | `no-store, private`                              |
| Disabled invitation (403)              | `no-store, private`                              |
| Preview and publication/preflight APIs | `no-store, private`                              |

The route must set a private policy on every early return. The middleware also protects
invitation-shaped 404 responses that Astro resolves before the dynamic invitation page can execute.

## Deployment-only checks

After an authorized Vercel deployment, request an anonymous invitation, a personalized invitation, a
dashboard preview, an invalid route, and a canonical redirect. Record status and effective
`Cache-Control`, `Age`, and Vercel cache headers. Local tests do not prove CDN behavior.

Do not introduce a positive `s-maxage`, stale-while-revalidate policy, ISR, or a new shared cache
without a separate freshness decision and validation plan.

## Related planning

Canonical delivery metrics, HTML budgets, and runtime monitoring live in
[`performance-metrics.md`](performance-metrics.md). This file remains the cache-header correctness
SSOT; do not duplicate budget numbers here.

Section-contract work lives in [`../theme/architecture.md`](../theme/architecture.md). Plan
governance and Task Contract semantics live in `.agent/plans/README.md`.
