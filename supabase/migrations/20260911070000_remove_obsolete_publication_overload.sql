-- The application and provisioning paths use the concurrency-safe eleven-argument contract.
-- The seven-argument overload only rejected drained pre-release callers and is no longer needed.
drop function if exists public.publish_invitation_atomic(
  uuid,
  uuid,
  timestamptz,
  text,
  text,
  boolean,
  jsonb
);
