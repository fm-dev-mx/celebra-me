-- Trusted devices: server-side registry behind the «recordar este dispositivo» cookie.
--
-- The cookie used to be a self-contained signed token that could not be revoked before it expired.
-- It now carries a device id and a random secret; only the SHA-256 of the secret is stored here.
-- Every use checks the row (secret hash, user agent hash, revoked_at, 30-day age), so the owner
-- can close all trusted devices of an account from the dashboard by setting revoked_at.
--
-- Additive expand migration: a new table only, reachable by service_role alone. A deployed app
-- that does not know the table keeps using its signed cookies until it is replaced.
begin;

create table public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  secret_hash text not null check (secret_hash ~ '^[a-f0-9]{64}$'),
  user_agent_hash text not null check (user_agent_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz null
);

comment on table public.trusted_devices is
  'Devices that skip the second factor for 30 days. Revocable from the server, service_role only.';
comment on column public.trusted_devices.secret_hash is
  'SHA-256 (hex) of the random secret in the sb-trust-device cookie. The secret itself is never stored.';
comment on column public.trusted_devices.user_agent_hash is
  'SHA-256 (hex) of the user agent that enrolled the device, a different agent does not match.';
comment on column public.trusted_devices.revoked_at is
  'Set when the account closes all trusted devices, a revoked row never validates again.';

create index if not exists idx_trusted_devices_user_active
  on public.trusted_devices (user_id)
  where revoked_at is null;

revoke all on table public.trusted_devices from public, anon, authenticated, service_role;
alter table public.trusted_devices enable row level security;
alter table public.trusted_devices force row level security;
grant select, insert, update on table public.trusted_devices to service_role;

commit;
