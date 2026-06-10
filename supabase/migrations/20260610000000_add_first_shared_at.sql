begin;

alter table public.guest_invitations
  add column first_shared_at timestamptz null;

-- Backfill for existing guests with delivery_status = 'shared'.
-- We use updated_at as the best available approximation.
-- This is not exact — we cannot reconstruct the true first share
-- timestamp from historical data alone. updated_at is the last
-- write to the row, which serves as a conservative upper bound.
update public.guest_invitations
set first_shared_at = updated_at
where delivery_status = 'shared' and first_shared_at is null;

-- Guests with delivery_status = 'generated' remain null (never shared)

commit;
