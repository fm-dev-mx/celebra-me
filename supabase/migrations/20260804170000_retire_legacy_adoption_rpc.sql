-- Retire the one-time Romina legacy-adoption RPC.
-- Historical receipts and provenance columns remain for durable audit reads.
-- Do not apply to persistent Local / Preview / Production without separate
-- owner-authorized `db:*:migrate` authorization.

begin;

drop function if exists public.adopt_managed_invitation_legacy_atomic(
  text, uuid, uuid, uuid, timestamptz, integer, text, text, text, text, text,
  text, text, text, text, text, text, text, jsonb
);

comment on table public.managed_invitation_legacy_adoption_receipts is
  'Historical durable receipts for the retired one-time Romina legacy adoption. Append-only audit evidence; no executable workflow may call a write path into this table.';

commit;
