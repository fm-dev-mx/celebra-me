begin;

-- Records only releases successfully materialized by the managed workflow.
-- Legacy/dashboard-managed invitations deliberately have no row until adopted.
create table if not exists public.managed_invitation_release_provenance (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  definition_slug text not null,
  release_schema_version text not null,
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  package_hash text not null check (package_hash ~ '^[a-f0-9]{64}$'),
  metadata_hash text not null check (metadata_hash ~ '^[a-f0-9]{64}$'),
  projection_hash text not null check (projection_hash ~ '^[a-f0-9]{64}$'),
  asset_manifest_hash text not null check (asset_manifest_hash ~ '^[a-f0-9]{64}$'),
  applied_at timestamptz not null default now()
);

alter table public.managed_invitation_release_provenance enable row level security;

create policy "service_role manages invitation release provenance"
  on public.managed_invitation_release_provenance
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.managed_invitation_release_provenance is
  'Environment-local provenance for successfully verified declarative invitation releases.';

commit;
