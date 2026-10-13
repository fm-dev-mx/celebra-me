# Sensitive Data Guide

**Last updated:** 2026-10-13

This guide says which client data may live in the repository and which may not. Preparation-document
hygiene is owned by
[`invitation-preparation-contract.md`](invitation-preparation-contract.md#41-info-hygiene--persist-vs-session-only).

## Where real client data may live

Real invitations are managed content. Their event facts (celebrant and family names, dates, venues,
copy) are authored in `scripts/provision/invitations/<slug>.ts`, recorded in
`docs/invitations/<slug>.md`, and published to the database through the managed release workflow.
That is intended and allowed.

Real client data must never appear in:

- the demo collection `src/content/event-demos/` (`isDemo: true` showcase content uses fictitious
  data only; `pnpm validate:no-pii` enforces it, including that a demo uses only a `demo-*` visual
  profile);
- demo asset namespaces or reusable components, styles, and tests that are not scoped to that
  invitation;
- seed or fixture scripts outside the managed definitions.

## Never commit

- Client contact data the invitation does not publish, such as private email addresses. A WhatsApp
  RSVP destination shown to guests is event content and belongs only to its managed definition.
  Tests and fixtures use `@example.com` and `+521000000000` (synthetic patterns such as `0000000000`
  are fine for format checks).
- Bank details (CLABE, card or account numbers, account holder) outside a managed definition. A
  gifts transfer is event content only when the client asks to publish it, and then it lives only in
  that definition and its invitation doc; tests, fixtures and demos use synthetic values such as
  `0000 0000 0000 0000`.
- Guest data: guest names, RSVP responses, and personalized invite tokens.
- Secrets: API keys, service credentials, capture tokens, and credential-bearing URLs. Configuration
  lives in untracked `.env.local`; `src/env.d.ts` types the variables. The business WhatsApp number
  comes from `CONTACT_WHATSAPP`, never a literal.
- Raw client material: chat exports, absolute paths to client folders, and photo dumps.
- Backup or temporary files (`.bak`, `.tmp`, `.log`) that may contain any of the above.

## Photographs shared with demos

Demos use fictitious or owner-approved images. `pnpm validate:no-pii` rejects a demo image that is a
byte copy of a client photograph unless the client folder is approved; the executable list is
`APPROVED_SHARED_CLIENT_FOLDERS` in `scripts/validate-no-real-pii-in-content.mjs`. An approval needs
an owner decision recorded here, and leaves together with the client folder.

No client folder is approved at present: every demo image must differ from client photographs.

## Before committing

1. Is client contact, guest, or secret data present? Remove it.
2. Is real client data outside a managed definition or its invitation doc? Move or remove it.
3. Does a demo, fixture, or test reference a real client? Replace it with fictitious data.
4. Run `pnpm validate:no-pii` when demo content changes and `pnpm validate:invitation-preparation`
   when `docs/invitations/` changes.

## References

- `src/env.d.ts` — environment variable types
- `docs/core/git-governance.md` — commit policy
- `CONTRIBUTING.md` — contribution guide
