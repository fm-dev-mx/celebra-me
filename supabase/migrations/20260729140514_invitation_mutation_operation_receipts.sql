begin;

create table public.invitation_mutation_operation_receipts (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null,
  invitation_id uuid,
  environment text not null check (environment in ('local', 'preview', 'production')),
  project_ref text not null check (project_ref ~ '^[a-z0-9-]{3,64}$'),
  actor_id uuid,
  actor_type text not null check (actor_type in ('admin', 'host', 'operator', 'system', 'recovery')),
  origin text not null check (
    origin in (
      'editor',
      'legacy_dashboard',
      'managed_cli_local',
      'managed_cli_hosted',
      'system',
      'recovery'
    )
  ),
  command_kind text not null check (command_kind ~ '^[a-z0-9_:-]{3,100}$'),
  input_hashes jsonb not null default '{}'::jsonb,
  expected_state jsonb not null default '{}'::jsonb,
  status text not null check (status in ('not_applied', 'applied', 'partial', 'replayed')),
  completed_steps text[] not null default '{}',
  result jsonb not null default '{}'::jsonb,
  sanitized_error jsonb not null default '{}'::jsonb,
  retry_of_operation_id uuid,
  created_at timestamptz not null default now(),
  constraint invitation_mutation_receipt_no_self_retry
    check (retry_of_operation_id is null or retry_of_operation_id <> operation_id)
);

create unique index invitation_mutation_receipts_operation_id_unique
  on public.invitation_mutation_operation_receipts (operation_id);
alter table public.invitation_mutation_operation_receipts
  add constraint invitation_mutation_receipts_retry_fk
  foreign key (retry_of_operation_id)
  references public.invitation_mutation_operation_receipts(operation_id)
  on delete restrict;
create index invitation_mutation_receipts_invitation_created_idx
  on public.invitation_mutation_operation_receipts (invitation_id, created_at desc);
create index invitation_mutation_receipts_retry_idx
  on public.invitation_mutation_operation_receipts (retry_of_operation_id)
  where retry_of_operation_id is not null;

comment on table public.invitation_mutation_operation_receipts is
  'Append-only final outcomes for material invitation mutations; complements publication idempotency and latest managed provenance.';
comment on column public.invitation_mutation_operation_receipts.sanitized_error is
  'Sanitized diagnostics only. Passwords, tokens, credentials, secrets, and unnecessary PII are prohibited.';

alter table public.invitation_mutation_operation_receipts enable row level security;
alter table public.invitation_mutation_operation_receipts force row level security;

revoke all on table public.invitation_mutation_operation_receipts
  from public, anon, authenticated, service_role;
grant select, insert on table public.invitation_mutation_operation_receipts to service_role;

create or replace function public.reject_invitation_mutation_receipt_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'invitation mutation receipts are append-only';
end;
$$;

create trigger invitation_mutation_receipts_append_only
before update or delete on public.invitation_mutation_operation_receipts
for each row execute function public.reject_invitation_mutation_receipt_change();

-- Invitation runtime credentials are read-only for critical RSVP state. RSVP
-- writes remain on authenticated RLS paths and RSVP-specific functions.
revoke insert, update, delete on public.guest_invitations from service_role;
revoke insert, update, delete on public.guest_invitation_audit from service_role;

commit;
