/**
 * Deterministic service-layer counts for invite-link RSVP submit.
 * Canonical policy: `docs/domains/invitations/performance-metrics.md`.
 *
 * Live `submitGuestRsvpPublicRpc` then re-reads the guest to return the row.
 * That confirmation read is inside the repository helper, not a second RPC.
 */
export const RSVP_SUBMIT_BY_INVITE_SERVICE_LOOKUPS = 1;
export const RSVP_SUBMIT_BY_INVITE_MUTATION_RPCS = 1;
