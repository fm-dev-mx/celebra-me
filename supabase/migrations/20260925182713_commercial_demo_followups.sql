-- Append-only, administrator-confirmed funnel milestones. No browser tracking writes.
begin;
create table public.commercial_demo_followups (
  id uuid primary key,
  lead_id uuid not null references public.leads(id) on delete restrict,
  demo_slug text not null check (demo_slug ~ '^demo-[a-z0-9-]+$'),
  action text not null check (action in ('demo_shared', 'contact_received', 'quote_sent', 'lost')),
  loss_reason text not null default 'not_reported'
    check (loss_reason in ('not_reported', 'price', 'style', 'timing', 'no_response', 'other')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  unique (lead_id, demo_slug, action)
);
create index commercial_demo_followups_occurred_at_idx
  on public.commercial_demo_followups (occurred_at, id);
alter table public.commercial_demo_followups enable row level security;
alter table public.commercial_demo_followups force row level security;
revoke all on public.commercial_demo_followups from public, anon, authenticated, service_role;
grant select, insert on public.commercial_demo_followups to service_role;
create policy commercial_demo_followups_service_read on public.commercial_demo_followups
  for select to service_role using (true);
create policy commercial_demo_followups_service_insert on public.commercial_demo_followups
  for insert to service_role with check (true);
commit;
