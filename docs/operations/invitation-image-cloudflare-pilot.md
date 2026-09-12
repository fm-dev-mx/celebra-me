# Cloudflare image delivery pilot specification

Status: deferred. This document does not authorize provisioning, migration, or Production changes.

## Decision gate

Start a pilot only when at least one condition is observed after image weights and local CI egress
are corrected:

- Cloudinary usage exceeds 70 percent for two comparable reporting periods.
- Forecast usage exceeds 25 monthly credits.
- Cloudinary begins generating a monthly charge.
- Another confirmed image-delivery availability incident occurs.

Use provider dashboards or authenticated read-only reports. Referrer data alone is not attribution
to an invitation.

## Proposed isolated topology

- Preview: one private R2 Standard bucket, one Preview Cloudflare Images account binding, and a
  dedicated delivery hostname.
- Production: a different private R2 Standard bucket, Production binding, delivery hostname, and
  token.
- Tokens must be scoped by environment and limited to the required read/write operations.
- Source originals remain private. Public delivery uses immutable content-addressed keys and
  generated variants.
- The application keeps the existing provider-neutral asset schema. A provider adapter maps the
  canonical asset identity to R2 and Cloudflare Images.

## Pilot scope

Use one non-Production invitation with representative hero, portrait, gallery, interlude, venue,
map, and closing images. Compare:

- stored bytes and transformed bytes;
- requests and transfer per 1,000 complete opens;
- cache hit ratio;
- transformation latency and image decode failures;
- operational effort for upload, rollback, audit, and deletion;
- monthly cost at current traffic and at two growth scenarios.

The pilot must preserve the current mobile and desktop budgets, SHA-256 verification, immutable
environment namespaces, sanitized reports, and the public Preview smoke.

## Rollback

Keep Cloudinary references and binaries during the pilot. Switching the invitation back to its
verified Cloudinary asset manifest is the rollback. Do not delete either provider's source assets
until the acceptance window closes and the owner authorizes cleanup.

## Manual owner actions after approval

The owner creates the two buckets, delivery hostnames, narrowly scoped tokens, and Vercel
environment secrets. Repository code may prepare dry-run manifests and verification, but must not
provision or mutate Cloudflare without separate authorization.
