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
missing invitation routes, render failures, and canonical redirects.

## Verification

Local browser coverage verifies the effective headers for:

| Response                               | Required header                                  |
| -------------------------------------- | ------------------------------------------------ |
| Anonymous invitation                   | `public, max-age=0, s-maxage=0, must-revalidate` |
| Personalized invitation                | `no-store, private`                              |
| Invalid invitation-like route          | `no-store, private`                              |
| Canonical personalized redirect        | `no-store, private`                              |
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

Section-contract work lives in [`../theme/architecture.md`](../theme/architecture.md).
Plan governance and Task Contract semantics live in `.agent/plans/README.md`.

